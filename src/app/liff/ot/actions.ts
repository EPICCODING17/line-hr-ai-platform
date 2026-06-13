"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { pushMessage } from "@/lib/line/client";
import { otReceiptFlex } from "@/lib/line/flex";
import { instantiateOtApproval } from "@/lib/approval";
import { OT_RATE_TYPES, otHours, otTimestamps, otRateLabel, formatOtTimeRange } from "@/lib/ot";

type Admin = ReturnType<typeof createAdminClient>;

export type OtResolveResult =
  | { ok: true; employee: { id: string; firstName: string; lastName: string; code: string }; monthHours: number }
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

/** Bangkok "YYYY-MM" for the current month, and the [start, nextStart) bounds. */
function bangkokMonthBounds(): { start: string; nextStart: string } {
  const ym = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date());
  const [y, m] = ym.split("-").map(Number);
  const start = `${ym}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const nextStart = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  return { start, nextStart };
}

/** Resolve the linked employee + their OT hours already logged this month. */
export async function resolveOtEmployee(acctId: string, lineUserId: string): Promise<OtResolveResult> {
  const admin = createAdminClient();
  const acct = await loadAccount(admin, acctId);
  if (!acct) return { ok: false, reason: "no_account" };

  const emp = await findEmployee(admin, acct.tenant_id, lineUserId);
  if (!emp) return { ok: false, reason: "not_linked" };

  const { start, nextStart } = bangkokMonthBounds();
  const { data: rows } = await admin
    .from("ot_requests")
    .select("total_hours")
    .eq("tenant_id", acct.tenant_id)
    .eq("employee_id", emp.id)
    .in("status", ["pending", "approved"])
    .gte("ot_date", start)
    .lt("ot_date", nextStart)
    .is("deleted_at", null);

  const monthHours = (rows ?? []).reduce((s, r) => s + Number(r.total_hours ?? 0), 0);

  return {
    ok: true,
    employee: { id: emp.id, firstName: emp.first_name, lastName: emp.last_name, code: emp.employee_code },
    monthHours: Math.round(monthHours * 100) / 100,
  };
}

const SubmitSchema = z.object({
  acctId: z.string().uuid(),
  lineUserId: z.string().min(1),
  otDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  rateType: z.enum(OT_RATE_TYPES),
  reason: z.string().max(500).optional().default(""),
  project: z.string().max(200).optional().default(""),
  customer: z.string().max(200).optional().default(""),
});

export type OtSubmitResult =
  | { ok: true; requestNo: string; hours: number }
  | { ok: false; error: string };

export async function submitOtRequest(raw: unknown): Promise<OtSubmitResult> {
  const parsed = SubmitSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }
  const input = parsed.data;
  const admin = createAdminClient();

  const acct = await loadAccount(admin, input.acctId);
  if (!acct) return { ok: false, error: "ไม่พบช่องทาง LINE ของบริษัท" };
  const tenantId = acct.tenant_id;

  const emp = await findEmployee(admin, tenantId, input.lineUserId);
  if (!emp) return { ok: false, error: "ยังไม่ได้ผูกบัญชีพนักงาน" };

  const hours = otHours(input.startTime, input.endTime);
  if (hours <= 0) return { ok: false, error: "ช่วงเวลาไม่ถูกต้อง" };

  // tenant OT policy: per-day cap + project requirement
  const { data: policy } = await admin
    .from("ot_policies")
    .select("max_hours_per_day, requires_project")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at").limit(1).maybeSingle();

  const maxPerDay = policy?.max_hours_per_day != null ? Number(policy.max_hours_per_day) : null;
  if (maxPerDay != null && hours > maxPerDay) {
    return { ok: false, error: `เกินเพดาน OT ต่อวัน (${maxPerDay} ชม.)` };
  }
  if (policy?.requires_project && !input.project.trim()) {
    return { ok: false, error: "กรุณาระบุโปรเจกต์/งานที่ทำ OT" };
  }

  const { start, end } = otTimestamps(input.otDate, input.startTime, input.endTime);

  const { data: reqNo, error: rnErr } = await admin.rpc("gen_request_no", { p_tenant: tenantId, p_prefix: "OT" });
  if (rnErr || !reqNo) return { ok: false, error: "ออกเลขที่คำขอไม่สำเร็จ" };

  const { data: inserted, error: insErr } = await admin.from("ot_requests").insert({
    tenant_id: tenantId,
    request_no: reqNo,
    employee_id: emp.id,
    ot_date: input.otDate,
    start_time: start,
    end_time: end,
    total_hours: hours,
    rate_type: input.rateType,
    reason: input.reason.trim() || null,
    project: input.project.trim() || null,
    customer: input.customer.trim() || null,
    status: "pending",
    source: "liff",
    created_by: emp.id,
  }).select("id").single();
  if (insErr || !inserted) return { ok: false, error: "บันทึกคำขอไม่สำเร็จ กรุณาลองใหม่" };

  // best-effort receipt back into the LINE chat
  try {
    const token = decryptSecret(acct.channel_access_token_enc);
    await pushMessage(token, input.lineUserId, [
      otReceiptFlex({
        requestNo: reqNo as string, dateText: input.otDate,
        timeRange: formatOtTimeRange(start, end), hours, rateLabel: otRateLabel(input.rateType), status: "pending",
      }),
    ]);
  } catch {
    /* push failure must not fail the request */
  }

  try { await instantiateOtApproval(admin, tenantId, inserted.id as string); } catch (e) { console.error("ot approval instantiate", e); }

  return { ok: true, requestNo: reqNo as string, hours };
}
