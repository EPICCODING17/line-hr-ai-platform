import { Suspense } from "react";
import { getContext } from "@/lib/auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { HolidaysClient, type HolidayRow } from "./holidays-client";

export default async function HolidaysSettingsPage() {
  const ctx = await getContext();
  if (!ctx) return <p className="page-sub">ไม่พบบริษัทของผู้ใช้</p>;

  const admin = createAdminClient();
  const { data } = await admin.from("holidays")
    .select("id, holiday_date, name, is_recurring")
    .eq("tenant_id", ctx.tenantId)
    .is("deleted_at", null)
    .order("holiday_date", { ascending: true });

  const rows: HolidayRow[] = (data ?? []).map((h) => ({
    id: h.id as string,
    holiday_date: h.holiday_date as string,
    name: h.name as string,
    is_recurring: !!h.is_recurring,
  }));

  return (
    <Suspense>
      <HolidaysClient rows={rows} />
    </Suspense>
  );
}
