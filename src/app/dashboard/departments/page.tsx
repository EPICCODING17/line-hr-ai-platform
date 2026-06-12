import { getContext } from "@/lib/auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { NameCodeCrud, type NCRow } from "@/components/name-code-crud";
import { createDepartment, updateDepartment, deleteDepartments } from "./actions";

export default async function DepartmentsPage() {
  const ctx = await getContext();
  if (!ctx) return <p className="page-sub">ไม่พบบริษัทของผู้ใช้</p>;

  const admin = createAdminClient();
  const [deps, emps] = await Promise.all([
    admin.from("departments").select("id, name, code").eq("tenant_id", ctx.tenantId).is("deleted_at", null).order("name"),
    admin.from("employees").select("department_id").eq("tenant_id", ctx.tenantId).is("deleted_at", null),
  ]);

  const counts = new Map<string, number>();
  (emps.data ?? []).forEach((e) => {
    const id = e.department_id as string | null;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  });

  const rows: NCRow[] = (deps.data ?? []).map((d) => ({
    id: d.id as string, name: d.name as string, code: (d.code as string | null) ?? null, count: counts.get(d.id as string) ?? 0,
  }));

  return (
    <NameCodeCrud
      title="แผนก" singular="แผนก" rows={rows}
      onCreate={createDepartment} onUpdate={updateDepartment} onRemove={deleteDepartments}
    />
  );
}
