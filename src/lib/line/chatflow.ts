// In-chat quick forms: let an employee pick date/time, add a note, and submit a
// leave/OT request entirely inside the LINE chat (LINE datetime pickers + postback
// state in ai_conversations). Falls back to the full LIFF form via a link.
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { textMsg, type LineMessage } from "@/lib/line/client";
import { otHours, autoRateType, otRateLabel, fmtHours } from "@/lib/ot";
import { encodePrefill } from "@/lib/ai/prefill";
import { submitOtRequest } from "@/app/liff/ot/actions";
import { submitLeaveRequest } from "@/app/liff/leave/actions";
import type { Slots } from "@/lib/ai/intent";

/* Quick-reply builders: buttons float above the keyboard instead of piling up
   cards in the chat history. Labels must stay ≤ 20 chars (LINE limit). */
function qrPicker(label: string, data: string, mode: "date" | "time", initial: string) {
  return { type: "action", action: { type: "datetimepicker", label, data, mode, initial } };
}
function qrPost(label: string, data: string) {
  return { type: "action", action: { type: "postback", label, data, displayText: label } };
}
function qrUri(label: string, uri: string) {
  return { type: "action", action: { type: "uri", label, uri } };
}
function qrMsg(text: string, items: object[]): LineMessage {
  return { type: "text", text, quickReply: { items } } as LineMessage;
}

type Admin = ReturnType<typeof createAdminClient>;

export type CfCtx = {
  admin: Admin;
  tenantId: string;
  acctId: string;
  lineUserId: string;
  employeeId: string;
  otBase: string;    // base LIFF link for the OT form (no query)
  leaveBase: string; // base LIFF link for the leave form
};

type CfContext = {
  intent: "ot" | "leave";
  // ot
  otDate?: string; startTime?: string; endTime?: string;
  // leave
  startDate?: string; endDate?: string; leaveTypeId?: string; typeName?: string;
  // shared
  note?: string | null;
  awaitingNote?: boolean;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isChatPostback(data: string) {
  return data.startsWith("cf:");
}

function todayBkk() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function holidaysFor(admin: Admin, tenantId: string, year: string): Promise<Set<string>> {
  const { data } = await admin.from("holidays").select("holiday_date")
    .eq("tenant_id", tenantId).gte("holiday_date", `${year}-01-01`).lte("holiday_date", `${year}-12-31`);
  return new Set((data ?? []).map((h) => h.holiday_date as string));
}

function countWorkingDays(start: string, end: string, holidays: Set<string>): number {
  if (!DATE_RE.test(start) || !DATE_RE.test(end) || end < start) return 0;
  let n = 0;
  const d = new Date(`${start}T00:00:00Z`), last = new Date(`${end}T00:00:00Z`);
  while (d <= last) {
    const dow = d.getUTCDay();
    const iso = d.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !holidays.has(iso)) n++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return n;
}

/* ---------- conversation state ---------- */

async function getActive(admin: Admin, tenantId: string, lineUserId: string): Promise<{ id: string; context: CfContext } | null> {
  const { data } = await admin.from("ai_conversations")
    .select("id, context, expires_at")
    .eq("tenant_id", tenantId).eq("line_user_id", lineUserId).eq("state", "collecting")
    .is("deleted_at", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at as string).getTime() < Date.now()) return null;
  return { id: data.id as string, context: (data.context ?? {}) as CfContext };
}

async function save(ctx: CfCtx, id: string | null, context: CfContext) {
  const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  if (id) {
    await ctx.admin.from("ai_conversations").update({ context, updated_at: new Date().toISOString(), expires_at: expires }).eq("id", id);
  } else {
    await ctx.admin.from("ai_conversations").insert({
      tenant_id: ctx.tenantId, employee_id: ctx.employeeId, line_user_id: ctx.lineUserId,
      state: "collecting", pending_intent: context.intent, context, expires_at: expires,
    });
  }
}

async function clear(ctx: CfCtx) {
  await ctx.admin.from("ai_conversations").update({ state: "done", deleted_at: new Date().toISOString() })
    .eq("tenant_id", ctx.tenantId).eq("line_user_id", ctx.lineUserId).eq("state", "collecting").is("deleted_at", null);
}

/* ---------- rendering ---------- */

async function renderCard(ctx: CfCtx, c: CfContext, lead = ""): Promise<LineMessage> {
  const noteLine = (n: string | null | undefined) => `📝 หมายเหตุ: ${n ? n : "—"}`;
  if (c.intent === "ot") {
    const date = c.otDate ?? todayBkk();
    const start = c.startTime ?? "18:00";
    const end = c.endTime ?? "21:00";
    const hours = otHours(start, end);
    const hol = await holidaysFor(ctx.admin, ctx.tenantId, date.slice(0, 4));
    const rate = autoRateType(date, hol);
    const pre = encodePrefill({ date, start, end, reason: c.note ?? undefined });
    const fullUri = `${ctx.otBase}${ctx.otBase.includes("?") ? "&" : "?"}pre=${pre}`;
    const text = `${lead}⏱️ ขอทำ OT\n📅 วันที่: ${date}\n🕐 เวลา: ${start} – ${end}  (รวม ${fmtHours(hours)} ชม.)\n💼 อัตรา: ${otRateLabel(rate)}\n${noteLine(c.note)}\n\nแตะปุ่มด้านล่างเพื่อแก้ไข แล้วกด “ส่งคำขอ”`;
    return qrMsg(text, [
      qrPicker("📅 วันที่", "cf:date", "date", date),
      qrPicker("🕐 เวลาเริ่ม", "cf:start", "time", start),
      qrPicker("🕐 เวลาสิ้นสุด", "cf:end", "time", end),
      qrPost("✏️ หมายเหตุ", "cf:note"),
      qrPost("✅ ส่งคำขอ", "cf:submit"),
      qrPost("✖️ ยกเลิก", "cf:cancel"),
      qrUri("📄 ฟอร์มเต็ม", fullUri),
    ]);
  }
  const start = c.startDate ?? todayBkk();
  const end = c.endDate ?? start;
  const hol = await holidaysFor(ctx.admin, ctx.tenantId, start.slice(0, 4));
  const days = countWorkingDays(start, end, hol);
  const pre = encodePrefill({ start, end, reason: c.note ?? undefined });
  const fullUri = `${ctx.leaveBase}${ctx.leaveBase.includes("?") ? "&" : "?"}pre=${pre}`;
  const warn = days === 0 ? "\n⚠️ ช่วงนี้ตรงวันหยุด/สุดสัปดาห์ — เลือกวันทำงานก่อนส่ง" : "";
  const text = `${lead}📝 ขอลางาน · ${c.typeName ?? "ลางาน"}\n📅 ตั้งแต่: ${start}\n📅 ถึง: ${end}  (รวม ${days} วันทำงาน)${warn}\n${noteLine(c.note)}\n\nแตะปุ่มด้านล่างเพื่อแก้ไข แล้วกด “ส่งคำขอ”`;
  return qrMsg(text, [
    qrPicker("📅 ตั้งแต่", "cf:date", "date", start),
    qrPicker("📅 ถึง", "cf:end", "date", end),
    qrPost("✏️ หมายเหตุ", "cf:note"),
    qrPost("✅ ส่งคำขอ", "cf:submit"),
    qrPost("✖️ ยกเลิก", "cf:cancel"),
    qrUri("📄 ฟอร์มเต็ม", fullUri),
  ]);
}

/* ---------- public entry points ---------- */

/** Open an in-chat form for leave/ot, seeded from AI-extracted slots (or defaults). */
export async function startChat(ctx: CfCtx, intent: "ot" | "leave", slots: Partial<Slots>): Promise<LineMessage[]> {
  const today = todayBkk();
  let c: CfContext;
  if (intent === "ot") {
    c = {
      intent: "ot",
      otDate: slots.otDate && DATE_RE.test(slots.otDate) ? slots.otDate : today,
      startTime: slots.startTime && TIME_RE.test(slots.startTime) ? slots.startTime : "18:00",
      endTime: slots.endTime && TIME_RE.test(slots.endTime) ? slots.endTime : "21:00",
      note: slots.reason ?? null,
    };
  } else {
    // resolve leave type from the AI category (or default to the first type)
    let leaveTypeId: string | undefined, typeName = "ลางาน";
    const { data: types } = await ctx.admin.from("leave_types").select("id, name, category")
      .eq("tenant_id", ctx.tenantId).is("deleted_at", null).order("name");
    const list = (types ?? []) as { id: string; name: string; category: string }[];
    const match = (slots.leaveType && list.find((t) => t.category === slots.leaveType)) || list[0];
    if (match) { leaveTypeId = match.id; typeName = match.name; }
    c = {
      intent: "leave",
      startDate: slots.startDate && DATE_RE.test(slots.startDate) ? slots.startDate : today,
      endDate: slots.endDate && DATE_RE.test(slots.endDate) ? slots.endDate : (slots.startDate && DATE_RE.test(slots.startDate) ? slots.startDate : today),
      leaveTypeId, typeName, note: slots.reason ?? null,
    };
  }
  await save(ctx, null, c);
  return [await renderCard(ctx, c)];
}

/** Handle a `cf:*` postback (date/time picked, note, submit, cancel). */
export async function onChatPostback(ctx: CfCtx, data: string, params: { date?: string; time?: string }): Promise<LineMessage[]> {
  const conv = await getActive(ctx.admin, ctx.tenantId, ctx.lineUserId);
  if (!conv) return [textMsg("รายการนี้หมดอายุแล้ว ลองพิมพ์คำขอใหม่อีกครั้งได้เลยค่ะ")];
  const c = conv.context;
  const action = data.slice(3); // strip "cf:"

  if (action === "cancel") { await clear(ctx); return [textMsg("ยกเลิกรายการแล้วค่ะ 👍")]; }
  if (action === "note") { c.awaitingNote = true; await save(ctx, conv.id, c); return [textMsg("พิมพ์หมายเหตุที่ต้องการได้เลยค่ะ ✏️")]; }
  if (action === "submit") return submit(ctx, conv.id, c);

  // pickers
  if (action === "date") {
    if (params.date) { if (c.intent === "ot") c.otDate = params.date; else c.startDate = params.date; }
  } else if (action === "start") {
    if (params.time) c.startTime = params.time;
  } else if (action === "end") {
    if (c.intent === "ot") { if (params.time) c.endTime = params.time; }
    else if (params.date) c.endDate = params.date;
  }
  // keep leave end ≥ start
  if (c.intent === "leave" && c.startDate && c.endDate && c.endDate < c.startDate) c.endDate = c.startDate;
  await save(ctx, conv.id, c);
  return [await renderCard(ctx, c)];
}

/** If a note is being collected, store the typed text and re-show the card.
 *  Returns null when there is nothing to collect (caller continues normally). */
export async function maybeCollectNote(ctx: CfCtx, text: string): Promise<LineMessage[] | null> {
  const conv = await getActive(ctx.admin, ctx.tenantId, ctx.lineUserId);
  if (!conv || !conv.context.awaitingNote) return null;
  const c = conv.context;
  c.note = text.slice(0, 500);
  c.awaitingNote = false;
  await save(ctx, conv.id, c);
  return [await renderCard(ctx, c, "✅ บันทึกหมายเหตุแล้ว\n\n")];
}

async function submit(ctx: CfCtx, id: string, c: CfContext): Promise<LineMessage[]> {
  if (c.intent === "ot") {
    if (!c.otDate || !c.startTime || !c.endTime) return [textMsg("กรุณาเลือกวันและเวลาให้ครบก่อนส่งค่ะ")];
    const hol = await holidaysFor(ctx.admin, ctx.tenantId, c.otDate.slice(0, 4));
    const rateType = autoRateType(c.otDate, hol);
    const res = await submitOtRequest({
      acctId: ctx.acctId, lineUserId: ctx.lineUserId, otDate: c.otDate,
      startTime: c.startTime, endTime: c.endTime, rateType, reason: c.note ?? "", project: "", customer: "",
    });
    if (!res.ok) return [textMsg(`⚠️ ${res.error}`)];
    await clear(ctx);
    return [textMsg(`ส่งคำขอ OT แล้วค่ะ ✅ (เลขที่ ${res.requestNo}) — ดูใบเสร็จด้านล่างได้เลย`)];
  }
  if (!c.startDate || !c.endDate || !c.leaveTypeId) return [textMsg("กรุณาเลือกวันลาให้ครบก่อนส่งค่ะ")];
  const res = await submitLeaveRequest({
    acctId: ctx.acctId, lineUserId: ctx.lineUserId, leaveTypeId: c.leaveTypeId,
    startDate: c.startDate, endDate: c.endDate, isHalfDay: false, halfDayPeriod: null, reason: c.note ?? "",
  });
  if (!res.ok) return [textMsg(`⚠️ ${res.error}`)];
  await clear(ctx);
  return [textMsg(`ส่งคำขอลาแล้วค่ะ ✅ (เลขที่ ${res.requestNo}) — ดูใบเสร็จด้านล่างได้เลย`)];
}
