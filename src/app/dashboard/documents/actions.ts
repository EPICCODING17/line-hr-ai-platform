"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { actOnDocRequest, type ActResult } from "@/lib/approval";

function canApprove(role: string, isSuper: boolean) {
  return isSuper || ["company_admin", "hr", "manager"].includes(role);
}

export async function approveDocRequest(id: string): Promise<ActResult> {
  const ctx = await getContext();
  if (!ctx || !canApprove(ctx.role, ctx.isSuperAdmin)) return { ok: false, error: "ไม่มีสิทธิ์อนุมัติ" };
  const res = await actOnDocRequest(createAdminClient(), {
    tenantId: ctx.tenantId, requestId: id, decision: "approved",
    byName: ctx.fullName ?? "ฝ่ายบุคคล", comment: "อนุมัติผ่านแดชบอร์ด",
  });
  revalidatePath("/dashboard/documents");
  return res;
}

export async function rejectDocRequest(id: string, reason: string): Promise<ActResult> {
  const ctx = await getContext();
  if (!ctx || !canApprove(ctx.role, ctx.isSuperAdmin)) return { ok: false, error: "ไม่มีสิทธิ์ดำเนินการ" };
  const res = await actOnDocRequest(createAdminClient(), {
    tenantId: ctx.tenantId, requestId: id, decision: "rejected",
    byName: ctx.fullName ?? "ฝ่ายบุคคล", comment: reason.trim() || "ปฏิเสธผ่านแดชบอร์ด",
  });
  revalidatePath("/dashboard/documents");
  return res;
}
