// OT module descriptor + wrappers. Reuses the generic engine in ./core.
import "server-only";
import { instantiateApproval, actOnRequest, type Admin, type ApprovalModule, type ActResult } from "./core";
import { otApprovalRequestFlex, otApprovalResultFlex } from "@/lib/line/flex";
import { otRateLabel, formatOtTimeRange } from "@/lib/ot";

type OtReqRow = {
  id: string; employee_id: string; ot_date: string;
  start_time: string; end_time: string; total_hours: number;
  rate_type: string; reason: string | null; project: string | null; customer: string | null;
  request_no: string; status: string; current_step: number | null;
};

const otModule: ApprovalModule<OtReqRow> = {
  module: "ot",
  requestTable: "ot_requests",
  stepTable: "ot_approval_steps",
  async loadRequest(admin, tenantId, id) {
    const { data } = await admin
      .from("ot_requests")
      .select("id, employee_id, ot_date, start_time, end_time, total_hours, rate_type, reason, project, customer, request_no, status, current_step")
      .eq("id", id).eq("tenant_id", tenantId).maybeSingle();
    return (data as OtReqRow) ?? null;
  },
  pick: (r) => ({ id: r.id, employeeId: r.employee_id, status: r.status, currentStep: r.current_step }),
  async approverMessages(_admin, _tenantId, r, employeeName) {
    return [otApprovalRequestFlex({
      requestId: r.id, employeeName, dateText: r.ot_date,
      timeRange: formatOtTimeRange(r.start_time, r.end_time), hours: r.total_hours,
      rateLabel: otRateLabel(r.rate_type), reason: r.reason, requestNo: r.request_no,
    })];
  },
  async resultMessages(_admin, _tenantId, r, info) {
    return [otApprovalResultFlex({
      approved: info.approved, dateText: r.ot_date,
      timeRange: formatOtTimeRange(r.start_time, r.end_time), hours: r.total_hours,
      rateLabel: otRateLabel(r.rate_type), requestNo: r.request_no, reason: info.reason, byName: info.byName,
    })];
  },
};

export function instantiateOtApproval(admin: Admin, tenantId: string, requestId: string) {
  return instantiateApproval(admin, tenantId, requestId, otModule);
}

export function actOnOtRequest(admin: Admin, p: {
  tenantId: string; requestId: string; decision: "approved" | "rejected";
  comment?: string | null; byName?: string | null; requireApproverId?: string;
}): Promise<ActResult> {
  return actOnRequest(admin, otModule, p);
}
