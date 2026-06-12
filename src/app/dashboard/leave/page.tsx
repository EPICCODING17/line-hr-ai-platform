import { getContext } from "@/lib/auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { LeaveClient, type LeaveRow } from "./leave-client";

type Joined = { name?: string | null } | { name?: string | null }[] | null;
const one = (j: Joined) => (Array.isArray(j) ? j[0]?.name : j?.name) ?? "";

export default async function LeavePage() {
  const ctx = await getContext();
  if (!ctx) return <p className="page-sub">ไม่พบบริษัทของผู้ใช้</p>;

  const admin = createAdminClient();
  const { data } = await admin
    .from("leave_requests")
    .select("id, request_no, start_date, end_date, total_days, is_half_day, half_day_period, reason, status, created_at, employees(first_name, last_name, employee_code), leave_types(name)")
    .eq("tenant_id", ctx.tenantId).is("deleted_at", null)
    .order("created_at", { ascending: false }).limit(100);

  const rows: LeaveRow[] = (data ?? []).map((r) => {
    const e = (Array.isArray(r.employees) ? r.employees[0] : r.employees) as
      { first_name?: string; last_name?: string; employee_code?: string } | null;
    return {
      id: r.id as string,
      requestNo: r.request_no as string,
      employee: `${e?.first_name ?? ""} ${e?.last_name ?? ""}`.trim() || "—",
      employeeCode: e?.employee_code ?? "",
      type: one(r.leave_types as Joined),
      range: r.start_date === r.end_date ? String(r.start_date) : `${r.start_date} – ${r.end_date}`,
      days: r.total_days as number,
      halfDay: r.is_half_day ? (r.half_day_period === "am" ? "ครึ่งวันเช้า" : "ครึ่งวันบ่าย") : null,
      reason: (r.reason as string) ?? null,
      status: r.status as LeaveRow["status"],
      createdAt: String(r.created_at).slice(0, 10),
    };
  });

  const canApprove = ctx.isSuperAdmin || ["company_admin", "hr", "manager"].includes(ctx.role);
  return <LeaveClient rows={rows} canApprove={canApprove} />;
}
