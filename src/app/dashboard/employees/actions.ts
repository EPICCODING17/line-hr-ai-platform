"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getContext, canManageEmployees } from "@/lib/auth-context";
import { createAdminClient } from "@/lib/supabase/admin";

const optStr = z.string().trim().optional().transform((v) => (v ? v : null));
const optUuid = z.string().uuid().optional().or(z.literal("")).transform((v) => (v ? v : null));

const Schema = z.object({
  first_name: z.string().trim().min(1, "กรุณากรอกชื่อ"),
  last_name: z.string().trim().min(1, "กรุณากรอกนามสกุล"),
  nickname: optStr,
  email: z.string().trim().email("อีเมลไม่ถูกต้อง").optional().or(z.literal("")).transform((v) => (v ? v : null)),
  phone: optStr,
  department_id: optUuid,
  position_id: optUuid,
  employment_type: z.enum(["full_time", "part_time", "contract", "probation", "intern"]).default("full_time"),
  start_date: z.string().optional().or(z.literal("")).transform((v) => (v ? v : null)),
});

export type CreateEmployeeInput = z.input<typeof Schema>;
export type ActionResult = { ok: true; code: string } | { ok: false; error: string };

export async function createEmployee(input: CreateEmployeeInput): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };
  if (!canManageEmployees(ctx)) return { ok: false, error: "ไม่มีสิทธิ์เพิ่มพนักงาน" };

  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }
  const v = parsed.data;

  const admin = createAdminClient();
  const { data: code, error: codeErr } = await admin.rpc("gen_employee_code", { p_tenant: ctx.tenantId });
  if (codeErr || !code) return { ok: false, error: "ออกรหัสพนักงานไม่สำเร็จ" };

  const { error } = await admin.from("employees").insert({
    tenant_id: ctx.tenantId,
    employee_code: code,
    first_name: v.first_name,
    last_name: v.last_name,
    nickname: v.nickname,
    email: v.email,
    phone: v.phone,
    department_id: v.department_id,
    position_id: v.position_id,
    employment_type: v.employment_type,
    start_date: v.start_date,
    employment_status: "active",
    created_by: ctx.userId,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/employees");
  return { ok: true, code: code as string };
}

export type EmployeeDetail = {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  department_id: string | null;
  position_id: string | null;
  employment_type: string;
  start_date: string | null;
};

export async function getEmployee(id: string): Promise<EmployeeDetail | null> {
  const ctx = await getContext();
  if (!ctx) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("employees")
    .select("id, first_name, last_name, nickname, email, phone, department_id, position_id, employment_type, start_date")
    .eq("id", id).eq("tenant_id", ctx.tenantId).is("deleted_at", null)
    .maybeSingle();
  return (data as EmployeeDetail) ?? null;
}

export async function updateEmployee(id: string, input: CreateEmployeeInput): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };
  if (!canManageEmployees(ctx)) return { ok: false, error: "ไม่มีสิทธิ์แก้ไขพนักงาน" };

  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const v = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.from("employees").update({
    first_name: v.first_name, last_name: v.last_name, nickname: v.nickname,
    email: v.email, phone: v.phone, department_id: v.department_id, position_id: v.position_id,
    employment_type: v.employment_type, start_date: v.start_date, updated_by: ctx.userId,
  }).eq("id", id).eq("tenant_id", ctx.tenantId);  // tenant scope guard

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/employees");
  return { ok: true, code: "" };
}

export async function deleteEmployees(ids: string[]): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };
  if (!canManageEmployees(ctx)) return { ok: false, error: "ไม่มีสิทธิ์ลบพนักงาน" };
  if (ids.length === 0) return { ok: false, error: "ไม่ได้เลือกรายการ" };

  const admin = createAdminClient();
  const { error } = await admin.from("employees")
    .update({ deleted_at: new Date().toISOString(), updated_by: ctx.userId })
    .in("id", ids).eq("tenant_id", ctx.tenantId);  // soft delete + tenant scope

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/employees");
  return { ok: true, code: "" };
}
