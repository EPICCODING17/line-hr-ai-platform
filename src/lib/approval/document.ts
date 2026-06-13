// Document module descriptor + wrappers. Reuses the generic engine in ./core.
import "server-only";
import { instantiateApproval, actOnRequest, type Admin, type ApprovalModule, type ActResult } from "./core";
import { docApprovalRequestFlex, docApprovalResultFlex } from "@/lib/line/flex";

type DocReqRow = {
  id: string; employee_id: string; document_type_id: string;
  purpose: string | null; language: string; request_no: string;
  status: string; current_step: number | null;
};

const langLabel = (l: string) => (l === "en" ? "ภาษาอังกฤษ" : "ภาษาไทย");

async function docTypeName(admin: Admin, id: string) {
  const { data } = await admin.from("document_types").select("name").eq("id", id).maybeSingle();
  return (data?.name as string) ?? "เอกสาร";
}

const documentModule: ApprovalModule<DocReqRow> = {
  module: "document",
  requestTable: "document_requests",
  stepTable: "document_approval_steps",
  async loadRequest(admin, tenantId, id) {
    const { data } = await admin
      .from("document_requests")
      .select("id, employee_id, document_type_id, purpose, language, request_no, status, current_step")
      .eq("id", id).eq("tenant_id", tenantId).maybeSingle();
    return (data as DocReqRow) ?? null;
  },
  pick: (r) => ({ id: r.id, employeeId: r.employee_id, status: r.status, currentStep: r.current_step }),
  async approverMessages(admin, _tenantId, r, employeeName) {
    const typeName = await docTypeName(admin, r.document_type_id);
    return [docApprovalRequestFlex({
      requestId: r.id, employeeName, typeName, language: langLabel(r.language),
      purpose: r.purpose, requestNo: r.request_no,
    })];
  },
  async resultMessages(admin, _tenantId, r, info) {
    const typeName = await docTypeName(admin, r.document_type_id);
    return [docApprovalResultFlex({
      approved: info.approved, typeName, language: langLabel(r.language),
      requestNo: r.request_no, reason: info.reason, byName: info.byName,
    })];
  },
};

export function instantiateDocumentApproval(admin: Admin, tenantId: string, requestId: string) {
  return instantiateApproval(admin, tenantId, requestId, documentModule);
}

export function actOnDocRequest(admin: Admin, p: {
  tenantId: string; requestId: string; decision: "approved" | "rejected";
  comment?: string | null; byName?: string | null; requireApproverId?: string;
}): Promise<ActResult> {
  return actOnRequest(admin, documentModule, p);
}
