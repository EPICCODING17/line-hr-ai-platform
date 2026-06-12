"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { pushMessage } from "@/lib/line/client";
import { leaveReceiptFlex } from "@/lib/line/flex";
import { instantiateLeaveApproval } from "@/lib/approval";

type Admin = ReturnType<typeof createAdminClient>;

export type LeaveBalance = {
  leaveTypeId: string;
  name: string;
  color: string | null;
  entitled: number;
  used: number;
  pending: number;
  remaining: number;
};

export type ResolveResult =
  | { ok: true; employee: { id: string; firstName: string; lastName: string; code: string }; balances: LeaveBalance[] }
  | { ok: false; reason: "no_account" | "not_linked" };

/** Resolve the active LINE channel for this LIFF surface. */
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

/** Given the LIFF account + the LINE userId from the SDK, return the linked
 *  employee and their current-year leave balances per type. */
export async function resolveEmployee(acctId: string, lineUserId: string): Promise<ResolveResult> {
  const admin = createAdminClient();
  const acct = await loadAccount(admin, acctId);
  if (!acct) return { ok: false, reason: "no_account" };

  const emp = await findEmployee(admin, acct.tenant_id, lineUserId);
  if (!emp) return { ok: false, reason: "not_linked" };

  const year = new Date().getUTCFullYear();
  const [{ data: types }, { data: balances }] = await Promise.all([
    admin
      .from("leave_types")
      .select("id, name, color")
      .eq("tenant_id", acct.tenant_id)
      .is("deleted_at", null)
      .order("name"),
    admin
      .from("leave_balances")
      .select("leave_type_id, entitled_days, carried_days, used_days, pending_days")
      .eq("tenant_id", acct.tenant_id)
      .eq("employee_id", emp.id)
      .eq("year", year),
  ]);

  const balByType = new Map(
    (balances ?? []).map((b) => [b.leave_type_id as string, b]),
  );

  const out: LeaveBalance[] = (types ?? []).map((t) => {
    const b = balByType.get(t.id as string);
    const entitled = Number(b?.entitled_days ?? 0) + Number(b?.carried_days ?? 0);
    const used = Number(b?.used_days ?? 0);
    const pending = Number(b?.pending_days ?? 0);
    return {
      leaveTypeId: t.id as string,
      name: t.name as string,
      color: (t.color as string) ?? null,
      entitled,
      used,
      pending,
      remaining: Math.max(0, entitled - used - pending),
    };
  });

  return {
    ok: true,
    employee: { id: emp.id, firstName: emp.first_name, lastName: emp.last_name, code: emp.employee_code },
    balances: out,
  };
}

const SubmitSchema = z
  .object({
    acctId: z.string().uuid(),
    lineUserId: z.string().min(1),
    leaveTypeId: z.string().uuid(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    isHalfDay: z.boolean(),
    halfDayPeriod: z.enum(["am", "pm"]).nullable(),
    reason: z.string().max(500).optional().default(""),
  })
  .refine((v) => v.endDate >= v.startDate, { message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม", path: ["endDate"] })
  .refine((v) => !v.isHalfDay || v.startDate === v.endDate, { message: "ลาครึ่งวันต้องเป็นวันเดียว", path: ["endDate"] });

export type SubmitResult =
  | { ok: true; requestNo: string; totalDays: number }
  | { ok: false; error: string };

/** Count working days (Mon–Fri, excluding tenant holidays) in [start, end]. */
function countWorkingDays(start: string, end: string, holidays: Set<string>): number {
  let days = 0;
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d <= last) {
    const dow = d.getUTCDay(); // 0 Sun .. 6 Sat
    const iso = d.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !holidays.has(iso)) days++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

export async function submitLeaveRequest(raw: unknown): Promise<SubmitResult> {
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

  // validate the leave type belongs to this tenant
  const { data: ltype } = await admin
    .from("leave_types")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("id", input.leaveTypeId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!ltype) return { ok: false, error: "ประเภทการลาไม่ถูกต้อง" };

  // holidays within the range → excluded from the day count
  const { data: hol } = await admin
    .from("holidays")
    .select("holiday_date")
    .eq("tenant_id", tenantId)
    .gte("holiday_date", input.startDate)
    .lte("holiday_date", input.endDate);
  const holidaySet = new Set((hol ?? []).map((h) => h.holiday_date as string));

  const totalDays = input.isHalfDay ? 0.5 : countWorkingDays(input.startDate, input.endDate, holidaySet);
  if (totalDays <= 0) {
    return { ok: false, error: "ช่วงวันที่เลือกไม่มีวันทำงาน (ตรงกับวันหยุด/สุดสัปดาห์)" };
  }

  // atomic per-tenant running number: LEV-DDMMYYYY-0001
  const { data: reqNo, error: rnErr } = await admin.rpc("gen_request_no", {
    p_tenant: tenantId,
    p_prefix: "LEV",
  });
  if (rnErr || !reqNo) return { ok: false, error: "ออกเลขที่คำขอไม่สำเร็จ" };

  const { data: inserted, error: insErr } = await admin.from("leave_requests").insert({
    tenant_id: tenantId,
    request_no: reqNo,
    employee_id: emp.id,
    leave_type_id: input.leaveTypeId,
    start_date: input.startDate,
    end_date: input.endDate,
    total_days: totalDays,
    is_half_day: input.isHalfDay,
    half_day_period: input.isHalfDay ? input.halfDayPeriod : null,
    reason: input.reason || null,
    status: "pending",
    source: "liff",
    created_by: emp.id,
  }).select("id").single();
  if (insErr || !inserted) return { ok: false, error: "บันทึกคำขอไม่สำเร็จ กรุณาลองใหม่" };

  // best-effort confirmation back into the LINE chat
  try {
    const token = decryptSecret(acct.channel_access_token_enc);
    const range = input.startDate === input.endDate ? input.startDate : `${input.startDate} – ${input.endDate}`;
    await pushMessage(token, input.lineUserId, [
      leaveReceiptFlex({ requestNo: reqNo as string, typeName: ltype.name, range, days: totalDays, status: "pending" }),
    ]);
  } catch {
    /* push failure must not fail the request */
  }

  // kick off the approval workflow (creates steps + notifies the first approver)
  try { await instantiateLeaveApproval(admin, tenantId, inserted.id as string); } catch (e) { console.error("approval instantiate", e); }

  return { ok: true, requestNo: reqNo as string, totalDays };
}
