// Register the Demo Co LINE channel into line_accounts (encrypts secret + token).
// Fill LINE_* in .env.local first, then: node scripts/register-line.mjs
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

function encrypt(plain) {
  const k = Buffer.from(env.APP_ENCRYPTION_KEY, "hex");
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

const need = ["LINE_CHANNEL_ID", "LINE_CHANNEL_SECRET", "LINE_CHANNEL_ACCESS_TOKEN", "APP_ENCRYPTION_KEY"];
const missing = need.filter((k) => !env[k]);
if (missing.length) { console.error("ขาดค่าใน .env.local:", missing.join(", ")); process.exit(1); }

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { data: t } = await db.from("tenants").select("id").eq("slug", "demo").single();

const { data, error } = await db.from("line_accounts").upsert({
  tenant_id: t.id,
  channel_id: env.LINE_CHANNEL_ID,
  channel_secret_enc: encrypt(env.LINE_CHANNEL_SECRET),
  channel_access_token_enc: encrypt(env.LINE_CHANNEL_ACCESS_TOKEN),
  liff_id: env.LINE_LIFF_ID || null,
  is_active: true,
}, { onConflict: "tenant_id,channel_id" }).select("id").single();

if (error) { console.error("FAIL:", error.message); process.exit(1); }

console.log("✅ ลงทะเบียน LINE channel สำเร็จ");
console.log("line_account id:", data.id);
console.log("\n👉 ตั้ง Webhook URL ใน LINE Developers เป็น:");
console.log(`   https://<PUBLIC_HOST>/api/line/webhook/${data.id}`);
