import { getContext } from "@/lib/auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PoliciesSettingsClient,
  type AttendancePolicyRow,
  type DocumentTypeRow,
  type LeavePolicyRow,
  type OtPolicyRow,
} from "./policies-settings-client";

type One<T> = T | T[] | null;
const one = <T,>(v: One<T>) => (Array.isArray(v) ? v[0] ?? null : v);

type LeaveTypeJoin = {
  id?: string | null;
  name?: string | null;
  code?: string | null;
  category?: string | null;
  is_paid?: boolean | null;
  requires_attachment?: boolean | null;
  attachment_after_days?: number | null;
  color?: string | null;
};

type OtRateJoin = { rate_type?: string | null; multiplier?: number | string | null };

export default async function PoliciesSettingsPage() {
  const ctx = await getContext();
  if (!ctx) return <p className="page-sub">ไม่พบบริษัทของผู้ใช้</p>;

  const admin = createAdminClient();
  const [leaveRes, otRes, attendanceRes, docsRes] = await Promise.all([
    admin.from("leave_policies")
      .select("id, name, quota_days, accrual, allow_carry_forward, max_carry_forward, max_consecutive_days, min_notice_days, leave_types(id, name, code, category, is_paid, requires_attachment, attachment_after_days, color)")
      .eq("tenant_id", ctx.tenantId)
      .is("deleted_at", null)
      .order("name"),
    admin.from("ot_policies")
      .select("id, name, max_hours_per_day, max_hours_per_month, min_request_notice_hours, requires_project, ot_rates(rate_type, multiplier)")
      .eq("tenant_id", ctx.tenantId)
      .is("deleted_at", null)
      .order("name"),
    admin.from("attendance_policies")
      .select("id, name, work_start, work_end, late_grace_minutes, require_gps, require_photo, allow_wfh")
      .eq("tenant_id", ctx.tenantId)
      .is("deleted_at", null)
      .order("name"),
    admin.from("document_types")
      .select("id, code, name, requires_approval, requires_salary, signer_role")
      .eq("tenant_id", ctx.tenantId)
      .is("deleted_at", null)
      .order("name"),
  ]);

  const leavePolicies: LeavePolicyRow[] = (leaveRes.data ?? []).map((p) => {
    const lt = one(p.leave_types as One<LeaveTypeJoin>);
    return {
      id: p.id as string,
      name: p.name as string,
      quota_days: Number(p.quota_days ?? 0),
      accrual: (p.accrual as string | null) ?? "yearly",
      allow_carry_forward: !!p.allow_carry_forward,
      max_carry_forward: Number(p.max_carry_forward ?? 0),
      max_consecutive_days: (p.max_consecutive_days as number | null) ?? null,
      min_notice_days: Number(p.min_notice_days ?? 0),
      leave_type: {
        id: lt?.id ?? "",
        name: lt?.name ?? "ประเภทลา",
        code: lt?.code ?? "",
        category: lt?.category ?? "other",
        is_paid: !!lt?.is_paid,
        requires_attachment: !!lt?.requires_attachment,
        attachment_after_days: lt?.attachment_after_days ?? null,
        color: lt?.color ?? null,
      },
    };
  });

  const otPolicies: OtPolicyRow[] = (otRes.data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    max_hours_per_day: p.max_hours_per_day == null ? null : Number(p.max_hours_per_day),
    max_hours_per_month: p.max_hours_per_month == null ? null : Number(p.max_hours_per_month),
    min_request_notice_hours: Number(p.min_request_notice_hours ?? 0),
    requires_project: !!p.requires_project,
    rates: ((p.ot_rates ?? []) as OtRateJoin[]).map((r) => ({
      rate_type: r.rate_type ?? "normal_day",
      multiplier: Number(r.multiplier ?? 1),
    })),
  }));

  const attendancePolicies: AttendancePolicyRow[] = (attendanceRes.data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    work_start: String(p.work_start ?? "09:00").slice(0, 5),
    work_end: String(p.work_end ?? "18:00").slice(0, 5),
    late_grace_minutes: Number(p.late_grace_minutes ?? 0),
    require_gps: !!p.require_gps,
    require_photo: !!p.require_photo,
    allow_wfh: !!p.allow_wfh,
  }));

  const documentTypes: DocumentTypeRow[] = (docsRes.data ?? []).map((d) => ({
    id: d.id as string,
    code: d.code as string,
    name: d.name as string,
    requires_approval: !!d.requires_approval,
    requires_salary: !!d.requires_salary,
    signer_role: (d.signer_role as string | null) ?? "",
  }));

  return (
    <PoliciesSettingsClient
      leavePolicies={leavePolicies}
      otPolicies={otPolicies}
      attendancePolicies={attendancePolicies}
      documentTypes={documentTypes}
    />
  );
}
