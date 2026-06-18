import { Suspense } from "react";
import { getContext } from "@/lib/auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { NameCodeCrud, type NCRow } from "@/components/name-code-crud";
import { createPosition, updatePosition, deletePositions } from "./actions";

export default async function PositionsPage() {
  const ctx = await getContext();
  if (!ctx) return <p className="page-sub">ไม่พบบริษัทของผู้ใช้</p>;

  const admin = createAdminClient();
  const [poss, emps] = await Promise.all([
    admin.from("positions").select("id, name, code").eq("tenant_id", ctx.tenantId).is("deleted_at", null).order("name"),
    admin.from("employees").select("position_id").eq("tenant_id", ctx.tenantId).is("deleted_at", null),
  ]);

  const counts = new Map<string, number>();
  (emps.data ?? []).forEach((e) => {
    const id = e.position_id as string | null;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  });

  const rows: NCRow[] = (poss.data ?? []).map((p) => ({
    id: p.id as string, name: p.name as string, code: (p.code as string | null) ?? null, count: counts.get(p.id as string) ?? 0,
  }));

  return (
    <Suspense>
    <NameCodeCrud
      title="ตำแหน่ง" singular="ตำแหน่ง" rows={rows}
      onCreate={createPosition} onUpdate={updatePosition} onRemove={deletePositions}
    />
    </Suspense>
  );
}
