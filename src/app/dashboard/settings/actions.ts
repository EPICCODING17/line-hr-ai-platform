"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getContext, canManageEmployees, type SessionContext } from "@/lib/auth-context";
import { createAdminClient } from "@/lib/supabase/admin";

export type SettingsResult = { ok: true } | { ok: false; error: string };

async function authed(): Promise<SessionContext | SettingsResult> {
  const ctx = await getContext();
  if (!ctx) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };
  if (!canManageEmployees(ctx)) return { ok: false, error: "ไม่มีสิทธิ์จัดการการตั้งค่า" };
  return ctx;
}

const isErr = (v: SessionContext | SettingsResult): v is SettingsResult => "ok" in v;
const emptyToNull = z.string().trim().optional().or(z.literal("")).transform((v) => (v ? v : null));
const nullableNum = z.union([z.coerce.number().min(0), z.literal(""), z.null(), z.undefined()])
  .transform((v) => (v === "" || v == null ? null : Number(v)));
const nullableInt = z.union([z.coerce.number().int().min(0), z.literal(""), z.null(), z.undefined()])
  .transform((v) => (v === "" || v == null ? null : Number(v)));

const CompanySchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อบริษัท"),
  slug: z.string().trim().min(2, "slug สั้นเกินไป").regex(/^[a-z0-9-]+$/i, "slug ใช้ได้เฉพาะ a-z, 0-9 และ -"),
  legal_name: emptyToNull,
  tax_id: emptyToNull,
  timezone: z.string().trim().min(1).default("Asia/Bangkok"),
  locale: z.string().trim().min(2).default("th"),
  workweek: z.array(z.coerce.number().int().min(1).max(7)).min(1, "เลือกวันทำงานอย่างน้อย 1 วัน"),
});

export type CompanySettingsInput = z.input<typeof CompanySchema>;

export async function updateCompanySettings(input: CompanySettingsInput): Promise<SettingsResult> {
  const ctx = await authed();
  if (isErr(ctx)) return ctx;
  const parsed = CompanySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const v = parsed.data;
  const admin = createAdminClient();
  const tenant = await admin.from("tenants").update({
    name: v.name,
    slug: v.slug.toLowerCase(),
    legal_name: v.legal_name,
    tax_id: v.tax_id,
    updated_by: ctx.userId,
  }).eq("id", ctx.tenantId);

  if (tenant.error) {
    return { ok: false, error: tenant.error.code === "23505" ? "slug นี้ถูกใช้แล้ว" : tenant.error.message };
  }

  const settings = await admin.from("tenant_settings").upsert({
    tenant_id: ctx.tenantId,
    timezone: v.timezone,
    locale: v.locale,
    workweek: [...new Set(v.workweek)].sort((a, b) => a - b),
    updated_at: new Date().toISOString(),
  }, { onConflict: "tenant_id" });

  if (settings.error) return { ok: false, error: settings.error.message };
  revalidatePath("/dashboard/settings/company");
  return { ok: true };
}

const HolidaySchema = z.object({
  holiday_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "วันที่ไม่ถูกต้อง"),
  name: z.string().trim().min(1, "กรุณากรอกชื่อวันหยุด"),
  is_recurring: z.boolean().default(false),
});

export type HolidayInput = z.input<typeof HolidaySchema>;

export async function createHoliday(input: HolidayInput): Promise<SettingsResult> {
  const ctx = await authed();
  if (isErr(ctx)) return ctx;
  const parsed = HolidaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const admin = createAdminClient();
  const { error } = await admin.from("holidays").insert({
    tenant_id: ctx.tenantId,
    holiday_date: parsed.data.holiday_date,
    name: parsed.data.name,
    is_recurring: parsed.data.is_recurring,
    created_by: ctx.userId,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "วันนี้มีอยู่ในปฏิทินแล้ว" : error.message };
  revalidatePath("/dashboard/settings/holidays");
  return { ok: true };
}

export async function updateHoliday(id: string, input: HolidayInput): Promise<SettingsResult> {
  const ctx = await authed();
  if (isErr(ctx)) return ctx;
  const parsed = HolidaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const admin = createAdminClient();
  const { error } = await admin.from("holidays").update({
    holiday_date: parsed.data.holiday_date,
    name: parsed.data.name,
    is_recurring: parsed.data.is_recurring,
    updated_by: ctx.userId,
  }).eq("id", id).eq("tenant_id", ctx.tenantId);
  if (error) return { ok: false, error: error.code === "23505" ? "วันนี้มีอยู่ในปฏิทินแล้ว" : error.message };
  revalidatePath("/dashboard/settings/holidays");
  return { ok: true };
}

export async function deleteHolidays(ids: string[]): Promise<SettingsResult> {
  const ctx = await authed();
  if (isErr(ctx)) return ctx;
  if (ids.length === 0) return { ok: false, error: "ไม่ได้เลือกรายการ" };

  const admin = createAdminClient();
  const { error } = await admin.from("holidays").update({
    deleted_at: new Date().toISOString(),
    updated_by: ctx.userId,
  }).in("id", ids).eq("tenant_id", ctx.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings/holidays");
  return { ok: true };
}

const LeavePolicySchema = z.object({
  id: z.string().uuid(),
  quota_days: z.coerce.number().min(0).max(365),
  min_notice_days: z.coerce.number().int().min(0).max(365),
  allow_carry_forward: z.boolean().default(false),
  max_carry_forward: z.coerce.number().min(0).max(365),
  max_consecutive_days: nullableInt,
  is_paid: z.boolean().default(true),
  requires_attachment: z.boolean().default(false),
  attachment_after_days: nullableInt,
});

export type LeavePolicyInput = z.input<typeof LeavePolicySchema>;

export async function updateLeavePolicy(input: LeavePolicyInput): Promise<SettingsResult> {
  const ctx = await authed();
  if (isErr(ctx)) return ctx;
  const parsed = LeavePolicySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const admin = createAdminClient();
  const found = await admin.from("leave_policies")
    .select("id, leave_type_id")
    .eq("id", parsed.data.id).eq("tenant_id", ctx.tenantId).is("deleted_at", null)
    .maybeSingle();
  if (found.error) return { ok: false, error: found.error.message };
  if (!found.data) return { ok: false, error: "ไม่พบนโยบายลา" };

  const policy = await admin.from("leave_policies").update({
    quota_days: parsed.data.quota_days,
    min_notice_days: parsed.data.min_notice_days,
    allow_carry_forward: parsed.data.allow_carry_forward,
    max_carry_forward: parsed.data.max_carry_forward,
    max_consecutive_days: parsed.data.max_consecutive_days,
    updated_by: ctx.userId,
  }).eq("id", parsed.data.id).eq("tenant_id", ctx.tenantId);
  if (policy.error) return { ok: false, error: policy.error.message };

  const type = await admin.from("leave_types").update({
    is_paid: parsed.data.is_paid,
    requires_attachment: parsed.data.requires_attachment,
    attachment_after_days: parsed.data.attachment_after_days,
    updated_by: ctx.userId,
  }).eq("id", found.data.leave_type_id).eq("tenant_id", ctx.tenantId);
  if (type.error) return { ok: false, error: type.error.message };

  revalidatePath("/dashboard/settings/policies");
  return { ok: true };
}

const OtPolicySchema = z.object({
  id: z.string().uuid(),
  max_hours_per_day: nullableNum,
  max_hours_per_month: nullableNum,
  min_request_notice_hours: z.coerce.number().int().min(0).max(720),
  requires_project: z.boolean().default(false),
});

export type OtPolicyInput = z.input<typeof OtPolicySchema>;

export async function updateOtPolicy(input: OtPolicyInput): Promise<SettingsResult> {
  const ctx = await authed();
  if (isErr(ctx)) return ctx;
  const parsed = OtPolicySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const admin = createAdminClient();
  const { error } = await admin.from("ot_policies").update({
    max_hours_per_day: parsed.data.max_hours_per_day,
    max_hours_per_month: parsed.data.max_hours_per_month,
    min_request_notice_hours: parsed.data.min_request_notice_hours,
    requires_project: parsed.data.requires_project,
    updated_by: ctx.userId,
  }).eq("id", parsed.data.id).eq("tenant_id", ctx.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings/policies");
  return { ok: true };
}

const AttendancePolicySchema = z.object({
  id: z.string().uuid(),
  work_start: z.string().regex(/^\d{2}:\d{2}$/),
  work_end: z.string().regex(/^\d{2}:\d{2}$/),
  late_grace_minutes: z.coerce.number().int().min(0).max(240),
  require_gps: z.boolean().default(true),
  require_photo: z.boolean().default(false),
  allow_wfh: z.boolean().default(true),
});

export type AttendancePolicyInput = z.input<typeof AttendancePolicySchema>;

export async function updateAttendancePolicy(input: AttendancePolicyInput): Promise<SettingsResult> {
  const ctx = await authed();
  if (isErr(ctx)) return ctx;
  const parsed = AttendancePolicySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const admin = createAdminClient();
  const { error } = await admin.from("attendance_policies").update({
    work_start: parsed.data.work_start,
    work_end: parsed.data.work_end,
    late_grace_minutes: parsed.data.late_grace_minutes,
    require_gps: parsed.data.require_gps,
    require_photo: parsed.data.require_photo,
    allow_wfh: parsed.data.allow_wfh,
    updated_by: ctx.userId,
  }).eq("id", parsed.data.id).eq("tenant_id", ctx.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings/policies");
  return { ok: true };
}

const DocumentTypeSchema = z.object({
  id: z.string().uuid(),
  requires_approval: z.boolean().default(true),
  requires_salary: z.boolean().default(false),
  signer_role: emptyToNull,
});

export type DocumentTypeInput = z.input<typeof DocumentTypeSchema>;

export async function updateDocumentType(input: DocumentTypeInput): Promise<SettingsResult> {
  const ctx = await authed();
  if (isErr(ctx)) return ctx;
  const parsed = DocumentTypeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const admin = createAdminClient();
  const { error } = await admin.from("document_types").update({
    requires_approval: parsed.data.requires_approval,
    requires_salary: parsed.data.requires_salary,
    signer_role: parsed.data.signer_role,
    updated_by: ctx.userId,
  }).eq("id", parsed.data.id).eq("tenant_id", ctx.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings/policies");
  return { ok: true };
}
