"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { pushMessage } from "@/lib/line/client";
import { docReceiptFlex } from "@/lib/line/flex";
import { instantiateDocumentApproval } from "@/lib/approval";

type Admin = ReturnType<typeof createAdminClient>;

export type DocResolveResult =
  | { ok: true; employee: { id: string; firstName: string; lastName: string; code: string } }
  | { ok: false; reason: "no_account" | "not_linked" };

async function loadAccount(admin: Admin, acctId: string) {
  const { data } = await admin
    .from("line_accounts")
    .select("id, tenant_id, channel_access_token_enc, is_active")
    .eq("id", acctId)
    .maybeSingle();
  if (!data || !data.is_active) return null;
  return data as { id: string; tenant_id: string; channel_access_token_enc: string; is_active: boolean };
}

async function findEmployee(admin: Admin, tenantId: string, lineUserId: string) {
  const { data } = await admin
    .from("employees")
    .select("id, employee_code, first_name, last_name")
    .eq("tenant_id", tenantId)
    .eq("line_user_id", lineUserId)
    .is("deleted_at", null)
    .maybeSingle();
  return data as { id: string; employee_code: string; first_name: string; last_name: string } | null;
}

export async function resolveDocEmployee(acctId: string, lineUserId: string): Promise<DocResolveResult> {
  const admin = createAdminClient();
  const acct = await loadAccount(admin, acctId);
  if (!acct) return { ok: false, reason: "no_account" };
  const emp = await findEmployee(admin, acct.tenant_id, lineUserId);
  if (!emp) return { ok: false, reason: "not_linked" };
  return {
    ok: true,
    employee: { id: emp.id, firstName: emp.first_name, lastName: emp.last_name, code: emp.employee_code },
  };
}

const SubmitSchema = z.object({
  acctId: z.string().uuid(),
  lineUserId: z.string().min(1),
  documentTypeId: z.string().uuid(),
  language: z.enum(["th", "en"]),
  purpose: z.string().max(500).optional().default(""),
  refMonth: z.number().int().min(1).max(12).nullable().optional(),
  refYear: z.number().int().min(2000).max(2100).nullable().optional(),
});

export type DocSubmitResult =
  | { ok: true; requestNo: string }
  | { ok: false; error: string };

export async function submitDocRequest(raw: unknown): Promise<DocSubmitResult> {
  const parsed = SubmitSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const input = parsed.data;
  const admin = createAdminClient();

  const acct = await loadAccount(admin, input.acctId);
  if (!acct) return { ok: false, error: "ไม่พบช่องทาง LINE ของบริษัท" };
  const tenantId = acct.tenant_id;

  const emp = await findEmployee(admin, tenantId, input.lineUserId);
  if (!emp) return { ok: false, error: "ยังไม่ได้ผูกบัญชีพนักงาน" };

  const { data: dtype } = await admin
    .from("document_types")
    .select("id, name, requires_salary")
    .eq("tenant_id", tenantId).eq("id", input.documentTypeId)
    .is("deleted_at", null).maybeSingle();
  if (!dtype) return { ok: false, error: "ประเภทเอกสารไม่ถูกต้อง" };

  if (dtype.requires_salary && (!input.refMonth || !input.refYear)) {
    return { ok: false, error: "กรุณาเลือกเดือน/ปีของข้อมูลเงินเดือน" };
  }

  const { data: reqNo, error: rnErr } = await admin.rpc("gen_request_no", { p_tenant: tenantId, p_prefix: "DOC" });
  if (rnErr || !reqNo) return { ok: false, error: "ออกเลขที่คำขอไม่สำเร็จ" };

  const { data: inserted, error: insErr } = await admin.from("document_requests").insert({
    tenant_id: tenantId,
    request_no: reqNo,
    employee_id: emp.id,
    document_type_id: input.documentTypeId,
    purpose: input.purpose.trim() || null,
    language: input.language,
    ref_month: dtype.requires_salary ? input.refMonth : null,
    ref_year: dtype.requires_salary ? input.refYear : null,
    status: "pending",
    source: "liff",
    created_by: emp.id,
  }).select("id").single();
  if (insErr || !inserted) return { ok: false, error: "บันทึกคำขอไม่สำเร็จ กรุณาลองใหม่" };

  try {
    const token = decryptSecret(acct.channel_access_token_enc);
    await pushMessage(token, input.lineUserId, [
      docReceiptFlex({
        requestNo: reqNo as string, typeName: dtype.name as string,
        language: input.language === "en" ? "ภาษาอังกฤษ" : "ภาษาไทย",
        purpose: input.purpose.trim() || null, status: "pending",
      }),
    ]);
  } catch {
    /* push failure must not fail the request */
  }

  try { await instantiateDocumentApproval(admin, tenantId, inserted.id as string); } catch (e) { console.error("doc approval instantiate", e); }

  return { ok: true, requestNo: reqNo as string };
}
