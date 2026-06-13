// TEMP — validate the in-chat Flex cards against the LINE API. DELETE after.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { chatLeaveFlex, chatOtFlex } from "@/lib/line/flex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createAdminClient();
  const { data: t } = await admin.from("tenants").select("id").eq("slug", "demo").single();
  const { data: acct } = await admin.from("line_accounts").select("channel_access_token_enc").eq("tenant_id", t!.id).eq("is_active", true).single();
  const { data: emp } = await admin.from("employees").select("line_user_id").eq("tenant_id", t!.id).not("line_user_id", "is", null).limit(1).single();
  const token = decryptSecret(acct!.channel_access_token_enc as string);
  const messages = [
    chatLeaveFlex({ typeName: "ลาป่วย", start: "2026-06-15", end: "2026-06-15", note: null, days: 1, fullUri: "https://liff.line.me/x" }),
    chatOtFlex({ date: "2026-06-13", start: "20:00", end: "23:30", note: "ทดสอบ", hours: 3.5, rateLabel: "เสาร์–อาทิตย์", fullUri: "https://liff.line.me/x/ot" }),
  ];
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: emp!.line_user_id, messages }),
  });
  return NextResponse.json({ status: res.status, body: await res.text() });
}
