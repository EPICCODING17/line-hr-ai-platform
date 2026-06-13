import { getContext } from "@/lib/auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { otRateLabel, formatOtTimeRange } from "@/lib/ot";
import { OtClient, type OtRow } from "./ot-client";

export default async function OtPage() {
  const ctx = await getContext();
  if (!ctx) return <p className="page-sub">ไม่พบบริษัทของผู้ใช้</p>;

  const admin = createAdminClient();
  const { data } = await admin
    .from("ot_requests")
    .select("id, request_no, ot_date, start_time, end_time, total_hours, rate_type, reason, project, status, created_at, employees(first_name, last_name, employee_code)")
    .eq("tenant_id", ctx.tenantId).is("deleted_at", null)
    .order("created_at", { ascending: false }).limit(100);

  const rows: OtRow[] = (data ?? []).map((r) => {
    const e = (Array.isArray(r.employees) ? r.employees[0] : r.employees) as
      { first_name?: string; last_name?: string; employee_code?: string } | null;
    return {
      id: r.id as string,
      requestNo: r.request_no as string,
      employee: `${e?.first_name ?? ""} ${e?.last_name ?? ""}`.trim() || "—",
      employeeCode: e?.employee_code ?? "",
      date: String(r.ot_date),
      timeRange: formatOtTimeRange(r.start_time as string, r.end_time as string),
      hours: Number(r.total_hours),
      rate: otRateLabel(r.rate_type as string),
      project: (r.project as string) ?? null,
      reason: (r.reason as string) ?? null,
      status: r.status as OtRow["status"],
      createdAt: String(r.created_at).slice(0, 10),
    };
  });

  const canApprove = ctx.isSuperAdmin || ["company_admin", "hr", "manager"].includes(ctx.role);
  return <OtClient rows={rows} canApprove={canApprove} />;
}
