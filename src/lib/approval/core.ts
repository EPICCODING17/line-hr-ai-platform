// Generic approval engine — instantiates the configured workflow for a request
// and advances it on each decision, notifying approvers + the employee over LINE.
// Module-agnostic: each module (leave, ot, …) supplies a descriptor that knows
// its tables and how to render its LINE cards. Server-only (service-role client).
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { pushMessage, type LineMessage } from "@/lib/line/client";

export type Admin = ReturnType<typeof createAdminClient>;

export type Approver = { id: string; first_name: string; line_user_id: string | null };
type StepCfg = {
  step_order: number;
  approver_type: string;
  specific_approver_id: string | null;
  role_code: string | null;
};
type ReqEmp = { id: string; first_name: string; last_name: string; manager_id: string | null; department_id: string | null };

export type Decision = "approved" | "rejected";
export type ResultInfo = { approved: boolean; byName?: string | null; reason?: string | null };

/** What the engine needs to know about a request, regardless of module. */
export type PickedRequest = { id: string; employeeId: string; status: string; currentStep: number | null };

/** A module descriptor wires the generic engine to a concrete request type. */
export type ApprovalModule<TReq> = {
  /** matches approval_workflows.module */
  module: string;
  /** request table (leave_requests / ot_requests / …) */
  requestTable: string;
  /** per-request step table (leave_approval_steps / ot_approval_steps / …) */
  stepTable: string;
  loadRequest(admin: Admin, tenantId: string, id: string): Promise<TReq | null>;
  pick(req: TReq): PickedRequest;
  /** Card(s) pushed to an approver when it becomes their turn. */
  approverMessages(admin: Admin, tenantId: string, req: TReq, employeeName: string): Promise<LineMessage[]>;
  /** Card(s) pushed to the employee when the request is finalized. */
  resultMessages(admin: Admin, tenantId: string, req: TReq, info: ResultInfo): Promise<LineMessage[]>;
};

export type ActResult =
  | { ok: true; final: Decision | null }
  | { ok: false; error: string };

async function lineToken(admin: Admin, tenantId: string): Promise<string | null> {
  const { data } = await admin
    .from("line_accounts")
    .select("channel_access_token_enc")
    .eq("tenant_id", tenantId).eq("is_active", true).maybeSingle();
  if (!data) return null;
  try { return decryptSecret(data.channel_access_token_enc as string); } catch { return null; }
}

async function push(token: string | null, lineUserId: string | null | undefined, messages: LineMessage[]) {
  if (token && lineUserId && messages.length) await pushMessage(token, lineUserId, messages);
}

export async function getApprover(admin: Admin, tenantId: string, id: string | null): Promise<Approver | null> {
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

async function notifyApprover<TReq>(
  admin: Admin, tenantId: string, mod: ApprovalModule<TReq>, req: TReq, approver: Approver | null, employeeName: string,
) {
  if (!approver?.line_user_id) return;
  const token = await lineToken(admin, tenantId);
  await push(token, approver.line_user_id, await mod.approverMessages(admin, tenantId, req, employeeName));
}

async function notifyResult<TReq>(
  admin: Admin, tenantId: string, mod: ApprovalModule<TReq>, req: TReq, info: ResultInfo,
) {
  const token = await lineToken(admin, tenantId);
  const { employeeId } = mod.pick(req);
  const { data: emp } = await admin.from("employees").select("line_user_id").eq("id", employeeId).maybeSingle();
  await push(token, emp?.line_user_id as string | null, await mod.resultMessages(admin, tenantId, req, info));
}

/** Build the approval steps for a freshly-created request and notify the first
 *  approver. Falls back to auto-approve when no workflow/approver exists. */
export async function instantiateApproval<TReq>(
  admin: Admin, tenantId: string, requestId: string, mod: ApprovalModule<TReq>,
) {
  const req = await mod.loadRequest(admin, tenantId, requestId);
  if (!req) return;
  const { id, employeeId } = mod.pick(req);

  const { data: emp } = await admin
    .from("employees").select("id, first_name, last_name, manager_id, department_id")
    .eq("id", employeeId).maybeSingle();
  if (!emp) return;
  const empName = `${emp.first_name} ${emp.last_name}`.trim();

  const { data: wf } = await admin
    .from("approval_workflows").select("id")
    .eq("tenant_id", tenantId).eq("module", mod.module).eq("is_active", true).is("deleted_at", null)
    .order("created_at").limit(1).maybeSingle();

  if (!wf) {
    await admin.from(mod.requestTable).update({ status: "approved" }).eq("id", id);
    await notifyResult(admin, tenantId, mod, req, { approved: true });
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
      tenant_id: tenantId, request_id: id, step_order: s.step_order,
      approver_id: approver?.id ?? null, approver_type: s.approver_type, status,
    });
    if (approver && !first) first = { order: s.step_order, approver };
  }
  if (stepRows.length) await admin.from(mod.stepTable).insert(stepRows);

  await admin.from(mod.requestTable)
    .update({ workflow_id: wf.id, current_step: first?.order ?? null })
    .eq("id", id);

  if (!first) {
    await admin.from(mod.requestTable).update({ status: "approved" }).eq("id", id);
    await notifyResult(admin, tenantId, mod, req, { approved: true });
    return;
  }
  await notifyApprover(admin, tenantId, mod, req, first.approver, empName);
}

/** Apply an approve/reject decision to a request's current step.
 *  `requireApproverId` (LINE path) enforces that the actor is the current approver. */
export async function actOnRequest<TReq>(admin: Admin, mod: ApprovalModule<TReq>, p: {
  tenantId: string; requestId: string; decision: Decision;
  comment?: string | null; byName?: string | null; requireApproverId?: string;
}): Promise<ActResult> {
  const req = await mod.loadRequest(admin, p.tenantId, p.requestId);
  if (!req) return { ok: false, error: "ไม่พบคำขอ" };
  const { id, employeeId, status, currentStep } = mod.pick(req);
  if (status !== "pending") return { ok: false, error: "คำขอนี้ถูกดำเนินการไปแล้ว" };
  if (!currentStep) return { ok: false, error: "คำขอนี้ไม่มีขั้นตอนอนุมัติที่รออยู่" };

  const { data: step } = await admin
    .from(mod.stepTable)
    .select("id, approver_id, status")
    .eq("request_id", id).eq("step_order", currentStep).maybeSingle();
  if (!step) return { ok: false, error: "ไม่พบขั้นตอนอนุมัติ" };
  if (p.requireApproverId && step.approver_id !== p.requireApproverId) {
    return { ok: false, error: "คุณไม่ใช่ผู้อนุมัติของคำขอนี้" };
  }

  await admin.from(mod.stepTable)
    .update({ status: p.decision, comment: p.comment ?? null, acted_at: new Date().toISOString() })
    .eq("id", step.id);

  if (p.decision === "rejected") {
    await admin.from(mod.requestTable).update({ status: "rejected" }).eq("id", id);
    await notifyResult(admin, p.tenantId, mod, req, { approved: false, byName: p.byName, reason: p.comment });
    return { ok: true, final: "rejected" };
  }

  // approved → advance to the next pending step, else finalize
  const { data: next } = await admin
    .from(mod.stepTable)
    .select("step_order, approver_id")
    .eq("request_id", id).eq("status", "pending").gt("step_order", currentStep)
    .order("step_order").limit(1).maybeSingle();

  if (next) {
    await admin.from(mod.requestTable).update({ current_step: next.step_order }).eq("id", id);
    const { data: emp } = await admin.from("employees").select("first_name, last_name").eq("id", employeeId).maybeSingle();
    const approver = await getApprover(admin, p.tenantId, next.approver_id as string);
    await notifyApprover(admin, p.tenantId, mod, req, approver, `${emp?.first_name ?? ""} ${emp?.last_name ?? ""}`.trim());
    return { ok: true, final: null };
  }

  await admin.from(mod.requestTable).update({ status: "approved" }).eq("id", id);
  await notifyResult(admin, p.tenantId, mod, req, { approved: true, byName: p.byName });
  return { ok: true, final: "approved" };
}
