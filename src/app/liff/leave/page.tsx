import { createAdminClient } from "@/lib/supabase/admin";
import { decodePrefill, type LeavePrefill } from "@/lib/ai/prefill";
import { LeaveFormClient, type LeaveTypeOption } from "./leave-form-client";

export const dynamic = "force-dynamic";

export default async function LiffLeavePage({
  searchParams,
}: {
  searchParams: Promise<{ acct?: string; u?: string; pre?: string; "liff.state"?: string }>;
}) {
  const sp = await searchParams;
  const { acct, u } = sp;
  const liffState = sp["liff.state"];
  const prefill = decodePrefill<LeavePrefill>(sp.pre);

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

  // This page is the LIFF endpoint. When a button opens liff.line.me/{id}/<form>,
  // LINE loads us first with liff.state=/<form> then liff.init() redirects there.
  // On that transit, render a splash matching the destination (not the leave form)
  // so the user never sees "เตรียมฟอร์มลา" before another form appears.
  const transitTarget =
    liffState && liffState !== "/" && !liffState.toLowerCase().includes("leave") ? liffState : null;

  let options: LeaveTypeOption[] = [];
  if (!transitTarget) {
    const { data: types } = await admin
      .from("leave_types")
      .select("id, name, color, category, requires_attachment")
      .eq("tenant_id", account.tenant_id)
      .is("deleted_at", null)
      .order("name");
    options = (types ?? []).map((t) => ({
      id: t.id as string,
      name: t.name as string,
      color: (t.color as string) ?? null,
      category: t.category as string,
      requiresAttachment: Boolean(t.requires_attachment),
    }));
  }

  return (
    <LeaveFormClient
      acctId={account.id as string}
      liffId={(account.liff_id as string) ?? null}
      devUserId={u ?? null}
      leaveTypes={options}
      transitTarget={transitTarget}
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
