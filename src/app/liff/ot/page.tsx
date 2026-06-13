import { createAdminClient } from "@/lib/supabase/admin";
import { OT_DEFAULT_MULTIPLIER, type OtRateType } from "@/lib/ot";
import { decodePrefill, type OtPrefill } from "@/lib/ai/prefill";
import { OtFormClient, type OtPolicyInfo } from "./ot-form-client";

export const dynamic = "force-dynamic";

export default async function LiffOtPage({
  searchParams,
}: {
  searchParams: Promise<{ acct?: string; u?: string; pre?: string }>;
}) {
  const { acct, u, pre } = await searchParams;
  const prefill = decodePrefill<OtPrefill>(pre);

  if (!acct) {
    return <FatalNotice title="ลิงก์ไม่ถูกต้อง" detail="ไม่พบรหัสช่องทาง (acct) — กรุณาเปิดจากเมนูในแชต LINE" />;
  }

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("line_accounts")
    .select("id, tenant_id, liff_id, is_active")
    .eq("id", acct)
    .maybeSingle();

  if (!account || !account.is_active) {
    return <FatalNotice title="ช่องทางไม่พร้อมใช้งาน" detail="บริษัทนี้ยังไม่ได้เปิดใช้บริการ HR ผ่าน LINE" />;
  }

  const year = new Date().getUTCFullYear();
  const [{ data: pol }, { data: holidays }] = await Promise.all([
    admin
      .from("ot_policies")
      .select("id, max_hours_per_day, max_hours_per_month, requires_project, ot_rates(rate_type, multiplier)")
      .eq("tenant_id", account.tenant_id)
      .is("deleted_at", null)
      .order("created_at").limit(1).maybeSingle(),
    admin
      .from("holidays")
      .select("holiday_date")
      .eq("tenant_id", account.tenant_id)
      .gte("holiday_date", `${year}-01-01`)
      .lte("holiday_date", `${year}-12-31`),
  ]);

  // per-tenant rate multipliers, falling back to statutory defaults
  const multipliers: Record<string, number> = { ...OT_DEFAULT_MULTIPLIER };
  for (const r of (pol?.ot_rates ?? []) as { rate_type: string; multiplier: number }[]) {
    multipliers[r.rate_type] = Number(r.multiplier);
  }

  const policy: OtPolicyInfo = {
    maxPerDay: pol?.max_hours_per_day != null ? Number(pol.max_hours_per_day) : null,
    maxPerMonth: pol?.max_hours_per_month != null ? Number(pol.max_hours_per_month) : null,
    requiresProject: Boolean(pol?.requires_project),
    multipliers: multipliers as Record<OtRateType, number>,
  };

  return (
    <OtFormClient
      acctId={account.id as string}
      liffId={(account.liff_id as string) ?? null}
      devUserId={u ?? null}
      policy={policy}
      holidays={(holidays ?? []).map((h) => h.holiday_date as string)}
      prefill={prefill}
    />
  );
}

function FatalNotice({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="liff-shell">
      <div className="liff-fatal">
        <div className="liff-fatal-icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5h.01" />
          </svg>
        </div>
        <h1 className="liff-fatal-title">{title}</h1>
        <p className="liff-fatal-detail">{detail}</p>
      </div>
    </main>
  );
}
