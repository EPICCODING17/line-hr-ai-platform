import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { verifyLineSignature } from "@/lib/line/verify";
import { replyMessage, textMsg, type LineMessage } from "@/lib/line/client";

export const runtime = "nodejs";

type LineEvent = {
  type: string;
  webhookEventId?: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
  postback?: { data?: string };
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");
  const admin = createAdminClient();

  // 1) resolve the tenant's LINE channel from the path id
  const { data: acct } = await admin
    .from("line_accounts")
    .select("id, tenant_id, channel_secret_enc, channel_access_token_enc, is_active")
    .eq("id", id).maybeSingle();
  if (!acct || !acct.is_active) return new Response("not found", { status: 404 });

  // 2) verify signature with this channel's secret
  const secret = decryptSecret(acct.channel_secret_enc as string);
  if (!verifyLineSignature(rawBody, signature, secret)) {
    return new Response("bad signature", { status: 401 });
  }

  const accessToken = decryptSecret(acct.channel_access_token_enc as string);
  const tenantId = acct.tenant_id as string;

  // public base URL of this deployment (tunnel / vercel) for LIFF deep-links
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const baseUrl = host ? `${proto}://${host}` : "";

  let events: LineEvent[] = [];
  try { events = JSON.parse(rawBody).events ?? []; } catch { /* ignore */ }

  // 3) process each event (idempotent). Always 200 so LINE doesn't retry.
  for (const ev of events) {
    try {
      // dedupe by webhookEventId
      if (ev.webhookEventId) {
        const { error } = await admin.from("line_webhook_events").insert({
          tenant_id: tenantId, line_account_id: id, dedup_key: ev.webhookEventId,
          event_type: ev.type, payload: ev, status: "processing",
        });
        if (error) continue; // 23505 = already handled
      }
      await handleEvent(admin, { tenantId, accessToken, acctId: id, baseUrl }, ev);
    } catch (e) {
      console.error("LINE event error", e);
    }
  }

  return new Response("ok", { status: 200 });
}

type Ctx = { tenantId: string; accessToken: string; acctId: string; baseUrl: string };

function leaveLink(ctx: Ctx) {
  return ctx.baseUrl ? `${ctx.baseUrl}/liff/leave?acct=${ctx.acctId}` : "";
}

async function handleEvent(admin: ReturnType<typeof createAdminClient>, ctx: Ctx, ev: LineEvent) {
  const userId = ev.source?.userId;
  const reply = (messages: LineMessage[]) => ev.replyToken ? replyMessage(ctx.accessToken, ev.replyToken, messages) : null;
  if (!userId) return;

  if (ev.type === "follow") {
    const emp = await findEmployeeByLine(admin, ctx.tenantId, userId);
    if (emp) return reply([textMsg(`สวัสดีคุณ${emp.first_name} 🙌 เลือกบริการจากเมนูด้านล่างได้เลย`)]);
    return reply([textMsg("ยินดีต้อนรับสู่ระบบ HR 👋\nกรุณาพิมพ์ “รหัสพนักงาน” ของคุณเพื่อผูกบัญชี\nตัวอย่าง: EMP-2026-0001")]);
  }

  // rich-menu buttons
  if (ev.type === "postback") {
    const action = new URLSearchParams(ev.postback?.data ?? "").get("action");
    const emp = await findEmployeeByLine(admin, ctx.tenantId, userId);
    if (!emp) return reply([textMsg("กรุณาผูกบัญชีก่อน โดยพิมพ์รหัสพนักงาน (เช่น EMP-2026-0001)")]);
    return reply(await actionReply(admin, ctx, emp, action));
  }

  if (ev.type === "message" && ev.message?.type === "text") {
    const text = (ev.message.text ?? "").trim();
    await admin.from("line_messages").insert({
      tenant_id: ctx.tenantId, line_user_id: userId, direction: "inbound",
      message_type: "text", content: { text },
    });

    const emp = await findEmployeeByLine(admin, ctx.tenantId, userId);
    if (emp) {
      // keyword shortcuts so it works even before/without the rich menu
      if (/ลา|leave/i.test(text)) return reply(await actionReply(admin, ctx, emp, "leave"));
      if (/สถานะ|status/i.test(text)) return reply(await actionReply(admin, ctx, emp, "status"));
      return reply([textMsg(`สวัสดีคุณ${emp.first_name} 🙌\nเลือกบริการจากเมนูด้านล่าง หรือพิมพ์ “ลางาน” เพื่อเริ่มได้เลย`)]);
    }

    const linked = await linkByCode(admin, ctx.tenantId, userId, text);
    if (linked) return reply([textMsg(`ผูกบัญชีสำเร็จ ✅ สวัสดีคุณ${linked.first_name}\nเลือกบริการจากเมนูด้านล่างได้เลย`)]);

    return reply([textMsg("ยังไม่พบบัญชีของคุณ 🔎\nกรุณาพิมพ์ “รหัสพนักงาน” เพื่อผูกบัญชี (เช่น EMP-2026-0001)\nหรือติดต่อ HR")]);
  }
}

async function actionReply(
  admin: ReturnType<typeof createAdminClient>, ctx: Ctx,
  emp: { id: string; first_name: string }, action: string | null,
): Promise<LineMessage[]> {
  switch (action) {
    case "leave": {
      const url = leaveLink(ctx);
      if (!url) return [textMsg("ขออภัย ระบบฟอร์มลายังไม่พร้อมใช้งานชั่วคราว")];
      return [{
        type: "template",
        altText: "ขอลางาน",
        template: {
          type: "buttons",
          title: "ขอลางาน",
          text: "กดเปิดฟอร์มเพื่อกรอกรายละเอียดการลา",
          actions: [{ type: "uri", label: "เปิดฟอร์มลางาน", uri: url }],
        },
      }];
    }
    case "status":
      return [textMsg(await statusText(admin, ctx.tenantId, emp.id))];
    case "ot":
      return [textMsg("ฟีเจอร์ขอ OT กำลังจะเปิดให้บริการเร็วๆ นี้ ⏱️")];
    case "checkin":
      return [textMsg("ฟีเจอร์ลงเวลาเข้า–ออกงาน กำลังจะเปิดให้บริการเร็วๆ นี้ ✅")];
    case "document":
      return [textMsg("ฟีเจอร์ขอเอกสาร (หนังสือรับรอง ฯลฯ) กำลังจะเปิดให้บริการเร็วๆ นี้ 📄")];
    case "contact":
      return [textMsg("ติดต่อฝ่ายบุคคล (HR)\n📧 hr@demo.co\n☎️ ต่อ 100\nเวลาทำการ จันทร์–ศุกร์ 9:00–18:00")];
    default:
      return [textMsg("เลือกบริการจากเมนูด้านล่างได้เลย")];
  }
}

const STATUS_LABEL: Record<string, string> = {
  pending: "⏳ รออนุมัติ", approved: "✅ อนุมัติแล้ว", rejected: "❌ ไม่อนุมัติ",
  cancelled: "🚫 ยกเลิก", completed: "🏁 เสร็จสิ้น", draft: "📝 ร่าง", failed: "⚠️ ล้มเหลว",
};

async function statusText(admin: ReturnType<typeof createAdminClient>, tenantId: string, employeeId: string) {
  const { data } = await admin
    .from("leave_requests")
    .select("request_no, start_date, end_date, total_days, status, leave_types(name)")
    .eq("tenant_id", tenantId).eq("employee_id", employeeId)
    .is("deleted_at", null).order("created_at", { ascending: false }).limit(5);

  if (!data || data.length === 0) return "ยังไม่มีคำขอลาในระบบ\nกดปุ่ม “ลางาน” เพื่อสร้างคำขอแรกได้เลย";

  const lines = data.map((r) => {
    const lt = (r.leave_types as { name?: string } | null)?.name ?? "การลา";
    const range = r.start_date === r.end_date ? r.start_date : `${r.start_date}–${r.end_date}`;
    return `${STATUS_LABEL[r.status as string] ?? r.status}  ${lt}\n  ${range} · ${r.total_days} วัน · ${r.request_no}`;
  });
  return `คำขอล่าสุดของคุณ\n\n${lines.join("\n\n")}`;
}

async function findEmployeeByLine(admin: ReturnType<typeof createAdminClient>, tenantId: string, userId: string) {
  const { data } = await admin.from("employees")
    .select("id, first_name").eq("tenant_id", tenantId).eq("line_user_id", userId).is("deleted_at", null).maybeSingle();
  return data as { id: string; first_name: string } | null;
}

async function linkByCode(admin: ReturnType<typeof createAdminClient>, tenantId: string, userId: string, code: string) {
  if (!/^EMP-/i.test(code)) return null;
  const { data } = await admin.from("employees")
    .select("id, first_name").eq("tenant_id", tenantId).eq("employee_code", code.toUpperCase())
    .is("line_user_id", null).is("deleted_at", null).maybeSingle();
  if (!data) return null;
  await admin.from("employees").update({ line_user_id: userId }).eq("id", data.id).eq("tenant_id", tenantId);
  return data as { id: string; first_name: string };
}
