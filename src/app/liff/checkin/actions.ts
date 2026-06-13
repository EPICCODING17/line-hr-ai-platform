"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { pushMessage } from "@/lib/line/client";
import { attendanceReceiptFlex } from "@/lib/line/flex";
import { bangkokNow, timeToMinutes, workModeLabel, formatTimeBkk, workedDuration } from "@/lib/attendance";

type Admin = ReturnType<typeof createAdminClient>;

export type TodayRecord = {
  checkInTime: string | null;
  checkOutTime: string | null;
  workMode: string;
  isLate: boolean;
  lateMinutes: number;
};

export type AttResolveResult =
  | {
      ok: true;
      employee: { id: string; firstName: string; lastName: string; code: string };
      today: TodayRecord | null;
      policy: { workStart: string; workEnd: string; requireGps: boolean; allowWfh: boolean };
    }
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

async function loadPolicy(admin: Admin, tenantId: string) {
  const { data } = await admin
    .from("attendance_policies")
    .select("work_start, work_end, late_grace_minutes, require_gps, allow_wfh")
    .eq("tenant_id", tenantId).is("deleted_at", null)
    .order("created_at").limit(1).maybeSingle();
  return data;
}

async function loadToday(admin: Admin, tenantId: string, employeeId: string, date: string) {
  const { data } = await admin
    .from("attendance_records")
    .select("check_in_time, check_out_time, work_mode, is_late, late_minutes")
    .eq("tenant_id", tenantId).eq("employee_id", employeeId).eq("work_date", date)
    .is("deleted_at", null).maybeSingle();
  return data;
}

export async function resolveAttendance(acctId: string, lineUserId: string): Promise<AttResolveResult> {
  const admin = createAdminClient();
  const acct = await loadAccount(admin, acctId);
  if (!acct) return { ok: false, reason: "no_account" };
  const emp = await findEmployee(admin, acct.tenant_id, lineUserId);
  if (!emp) return { ok: false, reason: "not_linked" };

  const { date } = bangkokNow();
  const [policy, today] = await Promise.all([
    loadPolicy(admin, acct.tenant_id),
    loadToday(admin, acct.tenant_id, emp.id, date),
  ]);

  return {
    ok: true,
    employee: { id: emp.id, firstName: emp.first_name, lastName: emp.last_name, code: emp.employee_code },
    today: today
      ? {
          checkInTime: (today.check_in_time as string) ?? null,
          checkOutTime: (today.check_out_time as string) ?? null,
          workMode: (today.work_mode as string) ?? "office",
          isLate: Boolean(today.is_late),
          lateMinutes: Number(today.late_minutes ?? 0),
        }
      : null,
    policy: {
      workStart: (policy?.work_start as string) ?? "09:00",
      workEnd: (policy?.work_end as string) ?? "18:00",
      requireGps: policy?.require_gps ?? false,
      allowWfh: policy?.allow_wfh ?? true,
    },
  };
}

const ClockSchema = z.object({
  acctId: z.string().uuid(),
  lineUserId: z.string().min(1),
  workMode: z.enum(["office", "wfh", "onsite", "business_trip"]).default("office"),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
});

export type ClockResult =
  | { ok: true; kind: "in" | "out"; timeText: string; late?: boolean; lateMinutes?: number }
  | { ok: false; error: string };

async function pushReceipt(
  admin: Admin, acct: { channel_access_token_enc: string }, lineUserId: string,
  p: Parameters<typeof attendanceReceiptFlex>[0],
) {
  try {
    const token = decryptSecret(acct.channel_access_token_enc);
    await pushMessage(token, lineUserId, [attendanceReceiptFlex(p)]);
  } catch {
    /* push failure must not fail the action */
  }
}

export async function checkIn(raw: unknown): Promise<ClockResult> {
  const parsed = ClockSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const input = parsed.data;
  const admin = createAdminClient();

  const acct = await loadAccount(admin, input.acctId);
  if (!acct) return { ok: false, error: "ไม่พบช่องทาง LINE ของบริษัท" };
  const tenantId = acct.tenant_id;
  const emp = await findEmployee(admin, tenantId, input.lineUserId);
  if (!emp) return { ok: false, error: "ยังไม่ได้ผูกบัญชีพนักงาน" };

  const { date, minutes, iso } = bangkokNow();
  const existing = await loadToday(admin, tenantId, emp.id, date);
  if (existing?.check_in_time) return { ok: false, error: "วันนี้คุณลงเวลาเข้างานไปแล้ว" };

  const policy = await loadPolicy(admin, tenantId);
  const startMin = timeToMinutes((policy?.work_start as string) ?? "09:00");
  const grace = Number(policy?.late_grace_minutes ?? 0);
  const isLate = minutes > startMin + grace;
  const lateMinutes = isLate ? minutes - startMin : 0;

  const { data: recNo } = await admin.rpc("gen_request_no", { p_tenant: tenantId, p_prefix: "ATT" });

  const { error } = await admin.from("attendance_records").upsert({
    tenant_id: tenantId,
    record_no: recNo,
    employee_id: emp.id,
    work_date: date,
    check_in_time: iso,
    work_mode: input.workMode,
    in_latitude: input.lat ?? null,
    in_longitude: input.lng ?? null,
    is_late: isLate,
    late_minutes: lateMinutes,
    status: "completed",
    source: "liff",
    created_by: emp.id,
  }, { onConflict: "tenant_id,employee_id,work_date" });
  if (error) return { ok: false, error: "บันทึกเวลาเข้างานไม่สำเร็จ" };

  await pushReceipt(admin, acct, input.lineUserId, {
    kind: "in", timeText: formatTimeBkk(iso), dateText: date, workMode: workModeLabel(input.workMode),
    late: isLate, lateMinutes,
  });

  return { ok: true, kind: "in", timeText: formatTimeBkk(iso), late: isLate, lateMinutes };
}

export async function checkOut(raw: unknown): Promise<ClockResult> {
  const parsed = ClockSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const input = parsed.data;
  const admin = createAdminClient();

  const acct = await loadAccount(admin, input.acctId);
  if (!acct) return { ok: false, error: "ไม่พบช่องทาง LINE ของบริษัท" };
  const tenantId = acct.tenant_id;
  const emp = await findEmployee(admin, tenantId, input.lineUserId);
  if (!emp) return { ok: false, error: "ยังไม่ได้ผูกบัญชีพนักงาน" };

  const { date, iso } = bangkokNow();
  const existing = await loadToday(admin, tenantId, emp.id, date);
  if (!existing?.check_in_time) return { ok: false, error: "ยังไม่ได้ลงเวลาเข้างานวันนี้" };
  if (existing.check_out_time) return { ok: false, error: "วันนี้คุณลงเวลาออกงานไปแล้ว" };

  const { error } = await admin.from("attendance_records")
    .update({ check_out_time: iso, out_latitude: input.lat ?? null, out_longitude: input.lng ?? null })
    .eq("tenant_id", tenantId).eq("employee_id", emp.id).eq("work_date", date);
  if (error) return { ok: false, error: "บันทึกเวลาออกงานไม่สำเร็จ" };

  await pushReceipt(admin, acct, input.lineUserId, {
    kind: "out", timeText: formatTimeBkk(iso), dateText: date,
    workMode: workModeLabel((existing.work_mode as string) ?? "office"),
    workedText: workedDuration(existing.check_in_time as string, iso),
  });

  return { ok: true, kind: "out", timeText: formatTimeBkk(iso) };
}
