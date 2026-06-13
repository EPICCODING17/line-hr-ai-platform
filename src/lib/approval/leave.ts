// Leave module descriptor + thin wrappers (preserve the original API so existing
// call sites keep working). All control flow lives in ./core.
import "server-only";
import { instantiateApproval, actOnRequest, type Admin, type ApprovalModule, type ActResult } from "./core";
import { approvalRequestFlex, approvalResultFlex } from "@/lib/line/flex";

type LeaveReqRow = {
  id: string; employee_id: string; leave_type_id: string;
  start_date: string; end_date: string; total_days: number;
  reason: string | null; request_no: string; status: string; current_step: number | null;
};

const rangeText = (start: string, end: string) => (start === end ? start : `${start} – ${end}`);

async function leaveTypeName(admin: Admin, id: string) {
  const { data } = await admin.from("leave_types").select("name").eq("id", id).maybeSingle();
  return (data?.name as string) ?? "การลา";
}

const leaveModule: ApprovalModule<LeaveReqRow> = {
  module: "leave",
  requestTable: "leave_requests",
  stepTable: "leave_approval_steps",
  async loadRequest(admin, tenantId, id) {
    const { data } = await admin
      .from("leave_requests")
      .select("id, employee_id, leave_type_id, start_date, end_date, total_days, reason, request_no, status, current_step")
      .eq("id", id).eq("tenant_id", tenantId).maybeSingle();
    return (data as LeaveReqRow) ?? null;
  },
  pick: (r) => ({ id: r.id, employeeId: r.employee_id, status: r.status, currentStep: r.current_step }),
  async approverMessages(admin, _tenantId, r, employeeName) {
    const typeName = await leaveTypeName(admin, r.leave_type_id);
    return [approvalRequestFlex({
      requestId: r.id, employeeName, typeName,
      range: rangeText(r.start_date, r.end_date), days: r.total_days, reason: r.reason, requestNo: r.request_no,
    })];
  },
  async resultMessages(admin, _tenantId, r, info) {
    const typeName = await leaveTypeName(admin, r.leave_type_id);
    return [approvalResultFlex({
      approved: info.approved, typeName, range: rangeText(r.start_date, r.end_date),
      days: r.total_days, requestNo: r.request_no, reason: info.reason, byName: info.byName,
    })];
  },
};

export function instantiateLeaveApproval(admin: Admin, tenantId: string, requestId: string) {
  return instantiateApproval(admin, tenantId, requestId, leaveModule);
}

export function actOnLeaveRequest(admin: Admin, p: {
  tenantId: string; requestId: string; decision: "approved" | "rejected";
  comment?: string | null; byName?: string | null; requireApproverId?: string;
}): Promise<ActResult> {
  return actOnRequest(admin, leaveModule, p);
}
