// TEMP — validate the in-chat quick-reply message against the LINE API. DELETE after.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createAdminClient();
  const { data: t } = await admin.from("tenants").select("id").eq("slug", "demo").single();
  const { data: acct } = await admin.from("line_accounts").select("channel_access_token_enc").eq("tenant_id", t!.id).eq("is_active", true).single();
  const { data: emp } = await admin.from("employees").select("line_user_id").eq("tenant_id", t!.id).not("line_user_id", "is", null).limit(1).single();
  const token = decryptSecret(acct!.channel_access_token_enc as string);
  const message = {
    type: "text",
    text: "⏱️ ขอทำ OT\n📅 วันที่: 2026-06-13\n🕐 เวลา: 20:00 – 23:30  (รวม 3.5 ชม.)\n💼 อัตรา: เสาร์–อาทิตย์\n📝 หมายเหตุ: —\n\nแตะปุ่มด้านล่างเพื่อแก้ไข แล้วกด “ส่งคำขอ”",
    quickReply: {
      items: [
        { type: "action", action: { type: "datetimepicker", label: "📅 วันที่", data: "cf:date", mode: "date", initial: "2026-06-13" } },
        { type: "action", action: { type: "datetimepicker", label: "🕐 เวลาเริ่ม", data: "cf:start", mode: "time", initial: "20:00" } },
        { type: "action", action: { type: "datetimepicker", label: "🕐 เวลาสิ้นสุด", data: "cf:end", mode: "time", initial: "23:30" } },
        { type: "action", action: { type: "postback", label: "✏️ หมายเหตุ", data: "cf:note", displayText: "✏️ หมายเหตุ" } },
        { type: "action", action: { type: "postback", label: "✅ ส่งคำขอ", data: "cf:submit", displayText: "✅ ส่งคำขอ" } },
        { type: "action", action: { type: "postback", label: "✖️ ยกเลิก", data: "cf:cancel", displayText: "✖️ ยกเลิก" } },
        { type: "action", action: { type: "uri", label: "📄 ฟอร์มเต็ม", uri: "https://liff.line.me/2010383091-kBSUiU9b/ot" } },
      ],
    },
  };
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: emp!.line_user_id, messages: [message] }),
  });
  return NextResponse.json({ status: res.status, body: await res.text() });
}
