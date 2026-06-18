import { Suspense } from "react";
import { getContext } from "@/lib/auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmployeesClient, type EmployeeRow, type Opt } from "./employees-client";

type Joined = { name?: string | null } | { name?: string | null }[] | null;
const one = (j: Joined) => (Array.isArray(j) ? j[0]?.name : j?.name) ?? "";

export default async function EmployeesPage() {
  const ctx = await getContext();
  if (!ctx) return <p className="page-sub">ไม่พบบริษัทของผู้ใช้</p>;

  const admin = createAdminClient();
  const [emps, depts, poss] = await Promise.all([
    admin.from("employees")
      .select("id, employee_code, first_name, last_name, employment_status, departments!employees_department_id_fkey(name), positions(name)")
      .eq("tenant_id", ctx.tenantId).is("deleted_at", null).order("employee_code"),
    admin.from("departments").select("id, name").eq("tenant_id", ctx.tenantId).is("deleted_at", null).order("name"),
    admin.from("positions").select("id, name").eq("tenant_id", ctx.tenantId).is("deleted_at", null).order("name"),
  ]);

  const rows: EmployeeRow[] = (emps.data ?? []).map((e) => ({
    id: e.id as string,
    code: e.employee_code as string,
    name: `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim(),
    dept: one(e.departments as Joined),
    position: one(e.positions as Joined),
    active: e.employment_status === "active",
  }));
  const departments: Opt[] = (depts.data ?? []).map((d) => ({ id: d.id as string, name: d.name as string }));
  const positions: Opt[] = (poss.data ?? []).map((p) => ({ id: p.id as string, name: p.name as string }));

  return (
    <Suspense>
      <EmployeesClient rows={rows} departments={departments} positions={positions} />
    </Suspense>
  );
}
