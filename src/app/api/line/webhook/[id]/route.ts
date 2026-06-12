import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { verifyLineSignature } from "@/lib/line/verify";
import { replyMessage, textMsg, type LineMessage } from "@/lib/line/client";
import { infoFlex, comingSoonFlex, contactFlex, welcomeFlex, statusListFlex } from "@/lib/line/flex";

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
    if (emp) return reply([welcomeFlex({ name: emp.first_name, linked: false, leaveUri: leaveLink(ctx) })]);
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
    if (linked) return reply([welcomeFlex({ name: linked.first_name, linked: true, leaveUri: leaveLink(ctx) })]);

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
      return [infoFlex({
        color: "#3c8cf3", emoji: "📝", title: "ขอลางาน",
        text: "กดปุ่มด้านล่างเพื่อเปิดฟอร์มกรอกรายละเอียดการลา ระบบจะส่งให้หัวหน้าอนุมัติให้",
        altText: "ขอลางาน", button: { label: "เปิดฟอร์มลางาน", uri: url },
      })];
    }
    case "status":
      return [await statusReply(admin, ctx.tenantId, emp)];
    case "ot":
      return [comingSoonFlex("ขอ OT", "⏱️")];
    case "checkin":
      return [comingSoonFlex("ลงเวลาเข้า–ออกงาน", "✅")];
    case "document":
      return [comingSoonFlex("ขอเอกสาร", "📄")];
    case "contact":
      return [contactFlex()];
    default:
      return [textMsg("เลือกบริการจากเมนูด้านล่างได้เลย")];
  }
}

async function statusReply(
  admin: ReturnType<typeof createAdminClient>, tenantId: string,
  emp: { id: string; first_name: string },
): Promise<LineMessage> {
  const { data } = await admin
    .from("leave_requests")
    .select("request_no, start_date, end_date, total_days, status, leave_types(name)")
    .eq("tenant_id", tenantId).eq("employee_id", emp.id)
    .is("deleted_at", null).order("created_at", { ascending: false }).limit(5);

  if (!data || data.length === 0) {
    return infoFlex({
      color: "#3c8cf3", emoji: "📋", title: "ยังไม่มีคำขอลา",
      text: "กดปุ่ม “ลางาน” ในเมนูด้านล่างเพื่อสร้างคำขอแรกของคุณได้เลย",
      altText: "ยังไม่มีคำขอลา",
    });
  }

  const items = data.map((r) => ({
    typeName: (r.leave_types as { name?: string } | null)?.name ?? "การลา",
    range: r.start_date === r.end_date ? String(r.start_date) : `${r.start_date}–${r.end_date}`,
    days: r.total_days as number,
    status: r.status as string,
    requestNo: r.request_no as string,
  }));
  return statusListFlex(emp.first_name, items);
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
