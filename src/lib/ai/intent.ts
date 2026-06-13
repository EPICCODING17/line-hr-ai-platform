// Phase 4 — natural-language intent + slot extraction for the LINE bot.
// One Claude call classifies a free-form message into an HR intent, extracts
// any slots it can (dates/times/type, with relative Thai dates resolved against
// today), and returns a short Thai acknowledgement. The webhook routes to the
// matching flow and pre-fills the form. Server-only. No-ops (returns null) when
// ANTHROPIC_API_KEY is unset, so keyword routing keeps working.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const INTENTS = ["leave", "ot", "document", "attendance", "status", "greeting", "unknown"] as const;
export type Intent = (typeof INTENTS)[number];

export type Slots = {
  leaveType: string | null;
  startDate: string | null;
  endDate: string | null;
  halfDay: string | null;
  otDate: string | null;
  startTime: string | null;
  endTime: string | null;
  docType: string | null;
  language: string | null;
  reason: string | null;
};

export type IntentResult = {
  intent: Intent;
  reply: string;
  confidence: number;
  slots: Slots;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
};

export function aiEnabled() {
  return !!process.env.ANTHROPIC_API_KEY;
}

const nullableStr = { type: ["string", "null"] };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: { type: "string", enum: [...INTENTS] },
    confidence: { type: "number", description: "ความมั่นใจ 0–1" },
    reply: { type: "string", description: "ข้อความตอบกลับสั้น ๆ ภาษาไทย สุภาพ 1 ประโยค" },
    slots: {
      type: "object",
      additionalProperties: false,
      properties: {
        leaveType: { ...nullableStr, description: "ประเภทลา: annual|sick|personal|maternity|military|other" },
        startDate: { ...nullableStr, description: "วันเริ่ม YYYY-MM-DD" },
        endDate: { ...nullableStr, description: "วันสิ้นสุด YYYY-MM-DD" },
        halfDay: { ...nullableStr, description: "am|pm ถ้าลาครึ่งวัน ไม่งั้น null" },
        otDate: { ...nullableStr, description: "วันที่ทำ OT YYYY-MM-DD" },
        startTime: { ...nullableStr, description: "เวลาเริ่ม HH:MM (24 ชม.)" },
        endTime: { ...nullableStr, description: "เวลาสิ้นสุด HH:MM" },
        docType: { ...nullableStr, description: "employment_certificate|salary_certificate|payroll_slip|work_certificate|custom_letter" },
        language: { ...nullableStr, description: "th|en ของเอกสาร" },
        reason: { ...nullableStr, description: "เหตุผล/วัตถุประสงค์ (ถ้ามี)" },
      },
      required: ["leaveType", "startDate", "endDate", "halfDay", "otDate", "startTime", "endTime", "docType", "language", "reason"],
    },
  },
  required: ["intent", "confidence", "reply", "slots"],
} as const;

function bangkokToday() {
  const d = new Date();
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const thai = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
  return { iso, thai };
}

function buildSystem(): string {
  const { iso, thai } = bangkokToday();
  return `คุณคือผู้ช่วยฝ่ายบุคคล (HR) ในแชต LINE ของบริษัท จัดประเภท "เจตนา" ของข้อความพนักงาน ดึงข้อมูลที่ระบุ (slots) และตอบรับสั้น ๆ อย่างสุภาพเป็นภาษาไทย

วันนี้คือ ${thai} (${iso}) — ใช้แปลงวันสัมพัทธ์ให้เป็น YYYY-MM-DD เช่น "พรุ่งนี้" = วันถัดจากวันนี้, "มะรืน" = +2 วัน, "วันจันทร์หน้า", "สิ้นเดือน" ฯลฯ

ประเภทเจตนา (intent):
- leave — ขอลา ลาป่วย ลากิจ ลาพักร้อน ลาคลอด → slots: leaveType, startDate, endDate, halfDay, reason
- ot — ขอทำโอที ทำงานล่วงเวลา → slots: otDate, startTime, endTime, reason
- document — ขอเอกสาร/หนังสือรับรอง/สลิปเงินเดือน → slots: docType, language, reason(วัตถุประสงค์)
- attendance — ลงเวลาเข้า–ออกงาน เช็คอิน/เช็คเอาท์
- status — สอบถามสถานะคำขอ
- greeting — ทักทาย ขอบคุณ คุยเล่น
- unknown — นอกเหนือจากนี้/ไม่ชัดเจน

กฎ slots:
- ใส่เฉพาะที่ผู้ใช้บอกหรืออนุมานได้ชัดเจน ที่เหลือเป็น null
- leaveType: ป่วย→sick, กิจ/ธุระ→personal, พักร้อน/ประจำปี→annual, คลอด→maternity, ทหาร→military, อื่น ๆ→other
- ถ้าระบุวันเดียว ให้ startDate = endDate
- halfDay: "เช้า"→am, "บ่าย"→pm, ไม่ใช่ครึ่งวัน→null
- docType: รับรองการทำงาน→employment_certificate, รับรองเงินเดือน→salary_certificate, สลิป→payroll_slip, รับรองการปฏิบัติงาน→work_certificate, อื่น ๆ→custom_letter
- reason: เก็บข้อความเหตุผล/วัตถุประสงค์ตามที่พูด

reply: ตอบรับ 1 ประโยค — ถ้าเป็นบริการ บอกว่ากำลังเปิดฟอร์มที่กรอกข้อมูลเบื้องต้นให้แล้ว (อย่าสัญญาว่าทำรายการเสร็จ เพราะต้องกดส่งเอง) · greeting/unknown ช่วยเหลือทั่วไป

ตอบตามสคีมาเท่านั้น`;
}

const EMPTY_SLOTS: Slots = {
  leaveType: null, startDate: null, endDate: null, halfDay: null,
  otDate: null, startTime: null, endTime: null, docType: null, language: null, reason: null,
};

export async function classifyIntent(text: string): Promise<IntentResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
  const client = new Anthropic({ apiKey });
  const started = Date.now();
  try {
    const format = { type: "json_schema", schema: SCHEMA } as const;
    // `effort` is unsupported on Haiku 4.5 (returns 400) — only send it to models
    // that accept it. Haiku is already fast/cheap and needs no effort knob.
    const output_config = /haiku/i.test(model)
      ? { format }
      : { format, effort: "low" as const };
    const res = await client.messages.create({
      model,
      max_tokens: 600,
      system: buildSystem(),
      messages: [{ role: "user", content: text.slice(0, 1000) }],
      output_config,
    });
    const latencyMs = Date.now() - started;
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;
    const parsed = JSON.parse(block.text) as { intent?: string; confidence?: number; reply?: string; slots?: Partial<Slots> };
    const intent = (INTENTS as readonly string[]).includes(parsed.intent ?? "")
      ? (parsed.intent as Intent)
      : "unknown";
    return {
      intent,
      reply: parsed.reply?.trim() || "เลือกบริการจากเมนูด้านล่างได้เลยค่ะ",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      slots: { ...EMPTY_SLOTS, ...(parsed.slots ?? {}) },
      model: res.model,
      promptTokens: res.usage.input_tokens,
      completionTokens: res.usage.output_tokens,
      latencyMs,
    };
  } catch (e) {
    console.error("AI classify error", e);
    return null;
  }
}
