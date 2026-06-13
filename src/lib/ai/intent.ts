// Phase 4 — natural-language intent routing for the LINE bot.
// One Claude call classifies a free-form message into an HR intent + a short
// Thai acknowledgement. The webhook then routes to the matching structured flow.
// Server-only. No-ops (returns null) when ANTHROPIC_API_KEY is unset, so the bot
// keeps working with keyword routing until the key is configured.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const INTENTS = ["leave", "ot", "document", "attendance", "status", "greeting", "unknown"] as const;
export type Intent = (typeof INTENTS)[number];

export type IntentResult = {
  intent: Intent;
  reply: string;
  confidence: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
};

export function aiEnabled() {
  return !!process.env.ANTHROPIC_API_KEY;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: { type: "string", enum: [...INTENTS] },
    confidence: { type: "number", description: "ความมั่นใจ 0–1" },
    reply: { type: "string", description: "ข้อความตอบกลับสั้น ๆ ภาษาไทย สุภาพ 1 ประโยค" },
  },
  required: ["intent", "confidence", "reply"],
} as const;

const SYSTEM = `คุณคือผู้ช่วยฝ่ายบุคคล (HR) ในแชต LINE ของบริษัท หน้าที่ของคุณคือจัดประเภท "เจตนา" ของข้อความพนักงาน แล้วตอบรับสั้น ๆ อย่างสุภาพเป็นภาษาไทย

ประเภทเจตนา (intent):
- leave — ขอลา ลางาน ลาป่วย ลากิจ ลาพักร้อน ลาคลอด
- ot — ขอทำโอที ทำงานล่วงเวลา
- document — ขอเอกสาร หนังสือรับรองการทำงาน/เงินเดือน สลิปเงินเดือน
- attendance — ลงเวลาเข้า–ออกงาน เช็คอิน เช็คเอาท์
- status — สอบถามสถานะคำขอที่เคยส่งไป
- greeting — ทักทาย ขอบคุณ คุยเล่นทั่วไป
- unknown — นอกเหนือจากนี้ หรือไม่ชัดเจน

reply: ตอบรับ 1 ประโยค
- ถ้าเป็นบริการ (leave/ot/document/attendance/status): บอกว่ากำลังพาไปยังบริการที่ต้องการ เช่น "ได้เลยค่ะ เปิดฟอร์มขอลาให้นะคะ"
- อย่าสัญญาว่าทำรายการให้เสร็จแล้ว เพราะพนักงานต้องกดกรอกฟอร์มเอง
- greeting/unknown: ช่วยเหลือทั่วไป เช่น แนะนำให้เลือกจากเมนูด้านล่าง

ตอบเฉพาะตามสคีมา ไม่ต้องอธิบายเพิ่ม`;

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
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: "user", content: text.slice(0, 1000) }],
      output_config,
    });
    const latencyMs = Date.now() - started;
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;
    const parsed = JSON.parse(block.text) as { intent?: string; confidence?: number; reply?: string };
    const intent = (INTENTS as readonly string[]).includes(parsed.intent ?? "")
      ? (parsed.intent as Intent)
      : "unknown";
    return {
      intent,
      reply: parsed.reply?.trim() || "เลือกบริการจากเมนูด้านล่างได้เลยค่ะ",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
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
