import { getContext } from "@/lib/auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CompanySettingsClient,
  type CompanyHrContact,
  type CompanyLineInfo,
  type CompanySettingsInfo,
  type CompanyTenantInfo,
} from "./company-settings-client";

type PlanJoin = { name?: string | null; code?: string | null } | { name?: string | null; code?: string | null }[] | null;
const onePlan = (j: PlanJoin) => Array.isArray(j) ? j[0] ?? null : j;

export default async function CompanySettingsPage() {
  const ctx = await getContext();
  if (!ctx) return <p className="page-sub">ไม่พบบริษัทของผู้ใช้</p>;

  const admin = createAdminClient();
  const [tenantRes, settingsRes, lineRes, subRes] = await Promise.all([
    admin.from("tenants")
      .select("id, name, slug, legal_name, tax_id, logo_url, status")
      .eq("id", ctx.tenantId)
      .maybeSingle(),
    admin.from("tenant_settings")
      .select("timezone, locale, workweek, theme, branding")
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle(),
    admin.from("line_accounts")
      .select("basic_id, liff_id, channel_id, is_active, updated_at")
      .eq("tenant_id", ctx.tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("subscriptions")
      .select("status, current_period_end, plans(name, code)")
      .eq("tenant_id", ctx.tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const tenant = tenantRes.data as CompanyTenantInfo | null;
  if (!tenant) return <p className="page-sub">ไม่พบบริษัทของผู้ใช้</p>;

  const settings: CompanySettingsInfo = {
    timezone: (settingsRes.data?.timezone as string | null) ?? "Asia/Bangkok",
    locale: (settingsRes.data?.locale as string | null) ?? "th",
    workweek: (settingsRes.data?.workweek as number[] | null) ?? [1, 2, 3, 4, 5],
    theme: (settingsRes.data?.theme as string | null) ?? "light",
  };

  const branding = settingsRes.data?.branding;
  const rawContact = branding && typeof branding === "object" && !Array.isArray(branding)
    ? (branding as { hr_contact?: unknown }).hr_contact
    : null;
  const contactRecord = rawContact && typeof rawContact === "object" && !Array.isArray(rawContact)
    ? rawContact as Record<string, unknown>
    : {};
  const hrContact: CompanyHrContact = {
    email: typeof contactRecord.email === "string" ? contactRecord.email : "hr@demo.co",
    phone: typeof contactRecord.phone === "string" ? contactRecord.phone : "ต่อ 100",
    hours: typeof contactRecord.hours === "string" ? contactRecord.hours : "จ–ศ 9:00–18:00",
    note: typeof contactRecord.note === "string" ? contactRecord.note : "",
  };

  const plan = onePlan(subRes.data?.plans as PlanJoin);
  const line = lineRes.data ? {
    basic_id: (lineRes.data.basic_id as string | null) ?? null,
    liff_id: (lineRes.data.liff_id as string | null) ?? null,
    channel_id: (lineRes.data.channel_id as string | null) ?? null,
    is_active: !!lineRes.data.is_active,
    updated_at: (lineRes.data.updated_at as string | null) ?? null,
  } satisfies CompanyLineInfo : null;

  return (
    <CompanySettingsClient
      tenant={tenant}
      settings={settings}
      hrContact={hrContact}
      line={line}
      subscription={{
        status: (subRes.data?.status as string | null) ?? null,
        planName: plan?.name ?? null,
        planCode: plan?.code ?? null,
        currentPeriodEnd: (subRes.data?.current_period_end as string | null) ?? null,
      }}
    />
  );
}
