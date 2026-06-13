import { createAdminClient } from "@/lib/supabase/admin";
import { CheckinClient } from "./checkin-client";

export const dynamic = "force-dynamic";

export default async function LiffCheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ acct?: string; u?: string }>;
}) {
  const { acct, u } = await searchParams;

  if (!acct) {
    return <FatalNotice title="ลิงก์ไม่ถูกต้อง" detail="ไม่พบรหัสช่องทาง (acct) — กรุณาเปิดจากเมนูในแชต LINE" />;
  }

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("line_accounts")
    .select("id, liff_id, is_active")
    .eq("id", acct)
    .maybeSingle();

  if (!account || !account.is_active) {
    return <FatalNotice title="ช่องทางไม่พร้อมใช้งาน" detail="บริษัทนี้ยังไม่ได้เปิดใช้บริการ HR ผ่าน LINE" />;
  }

  return (
    <CheckinClient
      acctId={account.id as string}
      liffId={(account.liff_id as string) ?? null}
      devUserId={u ?? null}
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
