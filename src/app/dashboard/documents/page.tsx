import { getContext } from "@/lib/auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { DocumentsClient, type DocRow } from "./documents-client";

type Joined = { name?: string | null } | { name?: string | null }[] | null;
const one = (j: Joined) => (Array.isArray(j) ? j[0]?.name : j?.name) ?? "";

export default async function DocumentsPage() {
  const ctx = await getContext();
  if (!ctx) return <p className="page-sub">ไม่พบบริษัทของผู้ใช้</p>;

  const admin = createAdminClient();
  const { data } = await admin
    .from("document_requests")
    .select("id, request_no, purpose, language, ref_month, ref_year, status, created_at, employees(first_name, last_name, employee_code), document_types(name)")
    .eq("tenant_id", ctx.tenantId).is("deleted_at", null)
    .order("created_at", { ascending: false }).limit(100);

  const rows: DocRow[] = (data ?? []).map((r) => {
    const e = (Array.isArray(r.employees) ? r.employees[0] : r.employees) as
      { first_name?: string; last_name?: string; employee_code?: string } | null;
    return {
      id: r.id as string,
      requestNo: r.request_no as string,
      employee: `${e?.first_name ?? ""} ${e?.last_name ?? ""}`.trim() || "—",
      employeeCode: e?.employee_code ?? "",
      type: one(r.document_types as Joined),
      language: r.language === "en" ? "อังกฤษ" : "ไทย",
      refPeriod: r.ref_month && r.ref_year ? `${String(r.ref_month).padStart(2, "0")}/${r.ref_year}` : null,
      purpose: (r.purpose as string) ?? null,
      status: r.status as DocRow["status"],
      createdAt: String(r.created_at).slice(0, 10),
    };
  });

  const canApprove = ctx.isSuperAdmin || ["company_admin", "hr", "manager"].includes(ctx.role);
  return <DocumentsClient rows={rows} canApprove={canApprove} />;
}
