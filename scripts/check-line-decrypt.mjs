// Round-trip check: decrypt stored line_account secret/token and compare to .env.local.
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

function decrypt(blob) {
  const k = Buffer.from(env.APP_ENCRYPTION_KEY, "hex");
  const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", k, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { data: t } = await db.from("tenants").select("id").eq("slug", "demo").single();
const { data } = await db.from("line_accounts")
  .select("id, channel_secret_enc, channel_access_token_enc").eq("tenant_id", t.id).single();

const secOk = decrypt(data.channel_secret_enc) === env.LINE_CHANNEL_SECRET;
const tokOk = decrypt(data.channel_access_token_enc) === env.LINE_CHANNEL_ACCESS_TOKEN;
console.log("secret decrypt match:", secOk ? "✅" : "❌");
console.log("token  decrypt match:", tokOk ? "✅" : "❌");
console.log(secOk && tokOk ? "\n🔐 webhook จะถอดรหัสและ verify ลายเซ็นได้ถูกต้อง" : "\n⚠️ มีปัญหาการเข้ารหัส");
