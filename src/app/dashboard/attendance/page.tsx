import { getContext } from "@/lib/auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTimeBkk, workModeLabel, workedDuration, bangkokNow } from "@/lib/attendance";
import { AttendanceClient, type AttRow } from "./attendance-client";

export default async function AttendancePage() {
  const ctx = await getContext();
  if (!ctx) return <p className="page-sub">ไม่พบบริษัทของผู้ใช้</p>;

  const admin = createAdminClient();
  const { data } = await admin
    .from("attendance_records")
    .select("id, work_date, check_in_time, check_out_time, work_mode, is_late, late_minutes, employees(first_name, last_name, employee_code)")
    .eq("tenant_id", ctx.tenantId).is("deleted_at", null)
    .order("work_date", { ascending: false }).order("check_in_time", { ascending: false })
    .limit(100);

  const rows: AttRow[] = (data ?? []).map((r) => {
    const e = (Array.isArray(r.employees) ? r.employees[0] : r.employees) as
      { first_name?: string; last_name?: string; employee_code?: string } | null;
    return {
      id: r.id as string,
      employee: `${e?.first_name ?? ""} ${e?.last_name ?? ""}`.trim() || "—",
      employeeCode: e?.employee_code ?? "",
      date: String(r.work_date),
      checkIn: formatTimeBkk(r.check_in_time as string),
      checkOut: formatTimeBkk(r.check_out_time as string),
      worked: workedDuration(r.check_in_time as string, r.check_out_time as string),
      mode: workModeLabel(r.work_mode as string),
      isLate: Boolean(r.is_late),
      lateMinutes: Number(r.late_minutes ?? 0),
      missingOut: !!r.check_in_time && !r.check_out_time,
    };
  });

  return <AttendanceClient rows={rows} today={bangkokNow().date} />;
}
