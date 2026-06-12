import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getContext, canManageEmployees, type SessionContext } from "@/lib/auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NCInput, CrudResult } from "@/lib/crud/types";

export type NCTable = "departments" | "positions";

const Schema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อ"),
  code: z.string().trim().optional().transform((v) => (v ? v : null)),
});

const pathOf = (t: NCTable) => (t === "departments" ? "/dashboard/departments" : "/dashboard/positions");

async function authed(): Promise<SessionContext | CrudResult> {
  const ctx = await getContext();
  if (!ctx) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };
  if (!canManageEmployees(ctx)) return { ok: false, error: "ไม่มีสิทธิ์ดำเนินการ" };
  return ctx;
}
const isErr = (v: SessionContext | CrudResult): v is CrudResult => "ok" in v;

export async function createNC(table: NCTable, input: NCInput): Promise<CrudResult> {
  const ctx = await authed();
  if (isErr(ctx)) return ctx;
  const p = Schema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const admin = createAdminClient();
  const { error } = await admin.from(table).insert({
    tenant_id: ctx.tenantId, name: p.data.name, code: p.data.code, created_by: ctx.userId,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "รหัสนี้มีอยู่แล้ว" : error.message };
  revalidatePath(pathOf(table));
  return { ok: true };
}

export async function updateNC(table: NCTable, id: string, input: NCInput): Promise<CrudResult> {
  const ctx = await authed();
  if (isErr(ctx)) return ctx;
  const p = Schema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const admin = createAdminClient();
  const { error } = await admin.from(table)
    .update({ name: p.data.name, code: p.data.code, updated_by: ctx.userId })
    .eq("id", id).eq("tenant_id", ctx.tenantId);
  if (error) return { ok: false, error: error.code === "23505" ? "รหัสนี้มีอยู่แล้ว" : error.message };
  revalidatePath(pathOf(table));
  return { ok: true };
}

export async function removeNC(table: NCTable, ids: string[]): Promise<CrudResult> {
  const ctx = await authed();
  if (isErr(ctx)) return ctx;
  if (ids.length === 0) return { ok: false, error: "ไม่ได้เลือกรายการ" };

  const admin = createAdminClient();
  const { error } = await admin.from(table)
    .update({ deleted_at: new Date().toISOString(), updated_by: ctx.userId })
    .in("id", ids).eq("tenant_id", ctx.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(pathOf(table));
  return { ok: true };
}
