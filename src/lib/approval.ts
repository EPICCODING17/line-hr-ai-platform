// Leave approval engine — instantiates the configured workflow per request and
// advances it on each decision, notifying approvers + the employee over LINE.
// Server-only (uses the service-role admin client).
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { pushMessage, type LineMessage } from "@/lib/line/client";
import { approvalRequestFlex, approvalResultFlex } from "@/lib/line/flex";

type Admin = ReturnType<typeof createAdminClient>;

type Approver = { id: string; first_name: string; line_user_id: string | null };
type StepCfg = {
  step_order: number;
  approver_type: string;
  specific_approver_id: string | null;
  role_code: string | null;
};
type ReqEmp = { id: string; first_name: string; last_name: string; manager_id: string | null; department_id: string | null };

const rangeText = (start: string, end: string) => (start === end ? start : `${start} – ${end}`);

async function lineToken(admin: Admin, tenantId: string): Promise<string | null> {
  const { data } = await admin
    .from("line_accounts")
    .select("channel_access_token_enc")
    .eq("tenant_id", tenantId).eq("is_active", true).maybeSingle();
  if (!data) return null;
  try { return decryptSecret(data.channel_access_token_enc as string); } catch { return null; }
}

async function push(token: string | null, lineUserId: string | null | undefined, messages: LineMessage[]) {
  if (token && lineUserId) await pushMessage(token, lineUserId, messages);
}

async function getApprover(admin: Admin, tenantId: string, id: string | null): Promise<Approver | null> {
  if (!id) return null;
  const { data } = await admin
    .from("employees").select("id, first_name, line_user_id")
    .eq("id", id).eq("tenant_id", tenantId).is("deleted_at", null).maybeSingle();
  return (data as Approver) ?? null;
}

/** Resolve the employee who should approve a given workflow step. */
async function resolveApprover(admin: Admin, tenantId: string, step: StepCfg, emp: ReqEmp): Promise<Approver | null> {
  switch (step.approver_type) {
    case "manager":
      return getApprover(admin, tenantId, emp.manager_id);
    case "specific_user":
      return getApprover(admin, tenantId, step.specific_approver_id);
    case "role": {
      if (!step.role_code) return null;
      const { data } = await admin
        .from("employees").select("id, first_name, line_user_id")
        .eq("tenant_id", tenantId).eq("role", step.role_code).is("deleted_at", null)
        .order("employee_code").limit(1).maybeSingle();
      return (data as Approver) ?? null;
    }
    case "department_head": {
      if (!emp.department_id) return null;
      const { data: dep } = await admin
        .from("departments").select("head_employee_id").eq("id", emp.department_id).maybeSingle();
      return getApprover(admin, tenantId, (dep?.head_employee_id as string) ?? null);
    }
    default:
      return null;
  }
}

type LeaveReqRow = {
  id: string; employee_id: string; leave_type_id: string;
  start_date: string; end_date: string; total_days: number;
  reason: string | null; request_no: string; status: string; current_step: number | null;
};

async function loadRequest(admin: Admin, tenantId: string, requestId: string) {
  const { data } = await admin
    .from("leave_requests")
    .select("id, employee_id, leave_type_id, start_date, end_date, total_days, reason, request_no, status, current_step")
    .eq("id", requestId).eq("tenant_id", tenantId).maybeSingle();
  return (data as LeaveReqRow) ?? null;
}

async function leaveTypeName(admin: Admin, id: string) {
  const { data } = await admin.from("leave_types").select("name").eq("id", id).maybeSingle();
  return (data?.name as string) ?? "การลา";
}

async function notifyEmployeeResult(
  admin: Admin, tenantId: string, req: LeaveReqRow, approved: boolean, byName?: string | null, reason?: string | null,
) {
  const token = await lineToken(admin, tenantId);
  const { data: emp } = await admin.from("employees").select("line_user_id").eq("id", req.employee_id).maybeSingle();
  const typeName = await leaveTypeName(admin, req.leave_type_id);
  await push(token, emp?.line_user_id as string | null, [approvalResultFlex({
    approved, typeName, range: rangeText(req.start_date, req.end_date), days: req.total_days,
    requestNo: req.request_no, reason, byName,
  })]);
}

async function notifyApprover(admin: Admin, tenantId: string, req: LeaveReqRow, approver: Approver | null, empName: string) {
  if (!approver?.line_user_id) return;
  const token = await lineToken(admin, tenantId);
  const typeName = await leaveTypeName(admin, req.leave_type_id);
  await push(token, approver.line_user_id, [approvalRequestFlex({
    requestId: req.id, employeeName: empName, typeName,
    range: rangeText(req.start_date, req.end_date), days: req.total_days, reason: req.reason, requestNo: req.request_no,
  })]);
}

/** Build the approval steps for a freshly-created leave request and notify the
 *  first approver. Falls back to auto-approve when no workflow/approver exists. */
export async function instantiateLeaveApproval(admin: Admin, tenantId: string, requestId: string) {
  const req = await loadRequest(admin, tenantId, requestId);
  if (!req) return;

  const { data: emp } = await admin
    .from("employees").select("id, first_name, last_name, manager_id, department_id")
    .eq("id", req.employee_id).maybeSingle();
  if (!emp) return;
  const empName = `${emp.first_name} ${emp.last_name}`.trim();

  const { data: wf } = await admin
    .from("approval_workflows").select("id")
    .eq("tenant_id", tenantId).eq("module", "leave").eq("is_active", true).is("deleted_at", null)
    .order("created_at").limit(1).maybeSingle();

  if (!wf) {
    await admin.from("leave_requests").update({ status: "approved" }).eq("id", requestId);
    await notifyEmployeeResult(admin, tenantId, req, true);
    return;
  }

  const { data: steps } = await admin
    .from("approval_workflow_steps")
    .select("step_order, approver_type, specific_approver_id, role_code")
    .eq("workflow_id", wf.id).is("deleted_at", null).order("step_order");

  const stepRows: Record<string, unknown>[] = [];
  let first: { order: number; approver: Approver } | null = null;
  for (const s of (steps ?? []) as StepCfg[]) {
    const approver = await resolveApprover(admin, tenantId, s, emp as ReqEmp);
    const status = approver ? "pending" : "skipped";
    stepRows.push({
      tenant_id: tenantId, request_id: requestId, step_order: s.step_order,
      approver_id: approver?.id ?? null, approver_type: s.approver_type, status,
    });
    if (approver && !first) first = { order: s.step_order, approver };
  }
  if (stepRows.length) await admin.from("leave_approval_steps").insert(stepRows);

  await admin.from("leave_requests")
    .update({ workflow_id: wf.id, current_step: first?.order ?? null })
    .eq("id", requestId);

  if (!first) {
    await admin.from("leave_requests").update({ status: "approved" }).eq("id", requestId);
    await notifyEmployeeResult(admin, tenantId, req, true);
    return;
  }
  await notifyApprover(admin, tenantId, req, first.approver, empName);
}

export type ActResult =
  | { ok: true; final: "approved" | "rejected" | null }
  | { ok: false; error: string };

/** Apply an approve/reject decision to a request's current step.
 *  `requireApproverId` (LINE path) enforces that the actor is the current approver. */
export async function actOnLeaveRequest(admin: Admin, p: {
  tenantId: string; requestId: string; decision: "approved" | "rejected";
  comment?: string | null; byName?: string | null; requireApproverId?: string;
}): Promise<ActResult> {
  const req = await loadRequest(admin, p.tenantId, p.requestId);
  if (!req) return { ok: false, error: "ไม่พบคำขอลา" };
  if (req.status !== "pending") return { ok: false, error: "คำขอนี้ถูกดำเนินการไปแล้ว" };
  if (!req.current_step) return { ok: false, error: "คำขอนี้ไม่มีขั้นตอนอนุมัติที่รออยู่" };

  const { data: step } = await admin
    .from("leave_approval_steps")
    .select("id, approver_id, status")
    .eq("request_id", req.id).eq("step_order", req.current_step).maybeSingle();
  if (!step) return { ok: false, error: "ไม่พบขั้นตอนอนุมัติ" };
  if (p.requireApproverId && step.approver_id !== p.requireApproverId) {
    return { ok: false, error: "คุณไม่ใช่ผู้อนุมัติของคำขอนี้" };
  }

  await admin.from("leave_approval_steps")
    .update({ status: p.decision, comment: p.comment ?? null, acted_at: new Date().toISOString() })
    .eq("id", step.id);

  if (p.decision === "rejected") {
    await admin.from("leave_requests").update({ status: "rejected" }).eq("id", req.id);
    await notifyEmployeeResult(admin, p.tenantId, req, false, p.byName, p.comment);
    return { ok: true, final: "rejected" };
  }

  // approved → advance to the next pending step, else finalize
  const { data: next } = await admin
    .from("leave_approval_steps")
    .select("step_order, approver_id")
    .eq("request_id", req.id).eq("status", "pending").gt("step_order", req.current_step)
    .order("step_order").limit(1).maybeSingle();

  if (next) {
    await admin.from("leave_requests").update({ current_step: next.step_order }).eq("id", req.id);
    const { data: emp } = await admin.from("employees").select("first_name, last_name").eq("id", req.employee_id).maybeSingle();
    const approver = await getApprover(admin, p.tenantId, next.approver_id as string);
    await notifyApprover(admin, p.tenantId, req, approver, `${emp?.first_name ?? ""} ${emp?.last_name ?? ""}`.trim());
    return { ok: true, final: null };
  }

  await admin.from("leave_requests").update({ status: "approved" }).eq("id", req.id);
  await notifyEmployeeResult(admin, p.tenantId, req, true, p.byName);
  return { ok: true, final: "approved" };
}
