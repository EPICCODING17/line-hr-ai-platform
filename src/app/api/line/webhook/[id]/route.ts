import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { verifyLineSignature } from "@/lib/line/verify";
import { replyMessage, textMsg, type LineMessage } from "@/lib/line/client";
import { infoFlex, comingSoonFlex, contactFlex, welcomeFlex, statusListFlex } from "@/lib/line/flex";
import { actOnLeaveRequest, actOnOtRequest } from "@/lib/approval";
import { otRateLabel } from "@/lib/ot";

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
    .select("id, tenant_id, channel_secret_enc, channel_access_token_enc, liff_id, is_active")
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
      await handleEvent(admin, { tenantId, accessToken, acctId: id, baseUrl, liffId: (acct.liff_id as string) ?? null }, ev);
    } catch (e) {
      console.error("LINE event error", e);
    }
  }

  return new Response("ok", { status: 200 });
}

type Ctx = { tenantId: string; accessToken: string; acctId: string; baseUrl: string; liffId: string | null };

// Prefer the LIFF launcher (opens in-LINE, in-scope, gets the user profile with
// no login bounce). LINE appends the path onto the endpoint (/liff/leave), so
// `/{liffId}/ot` → /liff/leave/ot, which next.config rewrites to /liff/ot.
// Fall back to a raw URL only when the company has no LIFF configured yet.
function leaveLink(ctx: Ctx) {
  if (ctx.liffId) return `https://liff.line.me/${ctx.liffId}`;
  return ctx.baseUrl ? `${ctx.baseUrl}/liff/leave?acct=${ctx.acctId}` : "";
}

function otLink(ctx: Ctx) {
  if (ctx.liffId) return `https://liff.line.me/${ctx.liffId}/ot`;
  return ctx.baseUrl ? `${ctx.baseUrl}/liff/ot?acct=${ctx.acctId}` : "";
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

  // rich-menu buttons + approval decisions
  if (ev.type === "postback") {
    const data = ev.postback?.data ?? "";
    const emp = await findEmployeeByLine(admin, ctx.tenantId, userId);
    if (!emp) return reply([textMsg("กรุณาผูกบัญชีก่อน โดยพิมพ์รหัสพนักงาน (เช่น EMP-2026-0001)")]);

    // OT approval decisions (module-tagged to avoid colliding with leave)
    const otMatch = /^(otapprove|otreject):(.+)$/.exec(data);
    if (otMatch) {
      const decision = otMatch[1] === "otapprove" ? "approved" : "rejected";
      const res = await actOnOtRequest(admin, {
        tenantId: ctx.tenantId, requestId: otMatch[2], decision,
        byName: emp.first_name, requireApproverId: emp.id,
      });
      if (!res.ok) return reply([textMsg(`⚠️ ${res.error}`)]);
      const msg = decision === "rejected"
        ? "ปฏิเสธคำขอ OT แล้ว — ระบบแจ้งผลให้พนักงานเรียบร้อย"
        : res.final === "approved"
          ? "อนุมัติคำขอ OT เรียบร้อย ✅ ระบบแจ้งผลให้พนักงานแล้ว"
          : "อนุมัติขั้นของคุณแล้ว ✅ ส่งต่อให้ผู้อนุมัติลำดับถัดไป";
      return reply([textMsg(msg)]);
    }

    const decisionMatch = /^(approve|reject):(.+)$/.exec(data);
    if (decisionMatch) {
      const decision = decisionMatch[1] === "approve" ? "approved" : "rejected";
      const res = await actOnLeaveRequest(admin, {
        tenantId: ctx.tenantId, requestId: decisionMatch[2], decision,
        byName: emp.first_name, requireApproverId: emp.id,
      });
      if (!res.ok) return reply([textMsg(`⚠️ ${res.error}`)]);
      const msg = decision === "rejected"
        ? "ปฏิเสธคำขอลาแล้ว — ระบบแจ้งผลให้พนักงานเรียบร้อย"
        : res.final === "approved"
          ? "อนุมัติคำขอลาเรียบร้อย ✅ ระบบแจ้งผลให้พนักงานแล้ว"
          : "อนุมัติขั้นของคุณแล้ว ✅ ส่งต่อให้ผู้อนุมัติลำดับถัดไป";
      return reply([textMsg(msg)]);
    }

    const action = new URLSearchParams(data).get("action");
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
      if (/โอที|\bo\.?t\b/i.test(text)) return reply(await actionReply(admin, ctx, emp, "ot"));
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
    case "ot": {
      const url = otLink(ctx);
      if (!url) return [textMsg("ขออภัย ระบบฟอร์ม OT ยังไม่พร้อมใช้งานชั่วคราว")];
      return [infoFlex({
        color: "#e8920c", emoji: "⏱️", title: "ขอทำ OT",
        text: "กดปุ่มด้านล่างเพื่อเปิดฟอร์มกรอกรายละเอียดการทำงานล่วงเวลา ระบบจะส่งให้หัวหน้าอนุมัติให้",
        altText: "ขอทำ OT", button: { label: "เปิดฟอร์ม OT", uri: url },
      })];
    }
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

type StatusItem = { title: string; sub: string; status: string; requestNo: string; createdAt: string };

async function statusReply(
  admin: ReturnType<typeof createAdminClient>, tenantId: string,
  emp: { id: string; first_name: string },
): Promise<LineMessage> {
  const [{ data: leave }, { data: ot }] = await Promise.all([
    admin.from("leave_requests")
      .select("request_no, start_date, end_date, total_days, status, created_at, leave_types(name)")
      .eq("tenant_id", tenantId).eq("employee_id", emp.id)
      .is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
    admin.from("ot_requests")
      .select("request_no, ot_date, total_hours, rate_type, status, created_at")
      .eq("tenant_id", tenantId).eq("employee_id", emp.id)
      .is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
  ]);

  const items: StatusItem[] = [
    ...(leave ?? []).map((r) => ({
      title: (r.leave_types as { name?: string } | null)?.name ?? "การลา",
      sub: `${r.start_date === r.end_date ? r.start_date : `${r.start_date}–${r.end_date}`} · ${r.total_days} วัน`,
      status: r.status as string,
      requestNo: r.request_no as string,
      createdAt: String(r.created_at),
    })),
    ...(ot ?? []).map((r) => ({
      title: `OT · ${otRateLabel(r.rate_type as string)}`,
      sub: `${r.ot_date} · ${r.total_hours} ชม.`,
      status: r.status as string,
      requestNo: r.request_no as string,
      createdAt: String(r.created_at),
    })),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 6);

  if (items.length === 0) {
    return infoFlex({
      color: "#3c8cf3", emoji: "📋", title: "ยังไม่มีคำขอ",
      text: "เลือก “ลางาน” หรือ “ขอ OT” ในเมนูด้านล่างเพื่อสร้างคำขอแรกของคุณได้เลย",
      altText: "ยังไม่มีคำขอ",
    });
  }
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
