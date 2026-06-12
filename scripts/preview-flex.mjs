// Push sample Flex cards to the linked test employee so we can eyeball the real
// LINE rendering before deploying.  node scripts/preview-flex.mjs
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
const { data: acct } = await db.from("line_accounts").select("channel_access_token_enc").eq("tenant_id", t.id).eq("is_active", true).single();
const { data: emp } = await db.from("employees").select("line_user_id, first_name").not("line_user_id", "is", null).limit(1).single();
const token = decrypt(acct.channel_access_token_enc);

const INK = "#1f2733", MUTED = "#6b7480", FAINT = "#9aa1ab", BORDER = "#eceef3", PRIMARY = "#3c8cf3";
const row = (label, value, strong) => ({ type: "box", layout: "horizontal", contents: [
  { type: "text", text: label, size: "sm", color: MUTED, flex: 2, gravity: "center" },
  { type: "text", text: value, size: "sm", color: INK, weight: strong ? "bold" : "regular", align: "end", gravity: "center", flex: 3, wrap: true },
] });
const pill = (text, fg, bg, xxs) => ({ type: "box", layout: "vertical", flex: 0, backgroundColor: bg, cornerRadius: "20px", paddingAll: xxs ? "4px" : "5px", paddingStart: xxs ? "10px" : "12px", paddingEnd: xxs ? "10px" : "12px", contents: [{ type: "text", text, size: xxs ? "xxs" : "xs", weight: "bold", color: fg, align: "center" }] });

const receipt = { type: "flex", altText: "ส่งคำขอลาแล้ว LEV-12062026-0007", contents: { type: "bubble", size: "mega", body: { type: "box", layout: "vertical", paddingAll: "0px", contents: [
  { type: "box", layout: "horizontal", backgroundColor: "#05be8a", paddingAll: "18px", spacing: "md", contents: [
    { type: "box", layout: "vertical", flex: 0, width: "34px", height: "34px", backgroundColor: "#ffffff33", cornerRadius: "10px", justifyContent: "center", contents: [{ type: "text", text: "✓", size: "lg", color: "#ffffff", align: "center", weight: "bold" }] },
    { type: "box", layout: "vertical", justifyContent: "center", contents: [
      { type: "text", text: "ส่งคำขอลาแล้ว", color: "#ffffff", weight: "bold", size: "lg" },
      { type: "text", text: "ส่งให้หัวหน้าอนุมัติเรียบร้อย", color: "#eafff7", size: "xs" } ] } ] },
  { type: "box", layout: "vertical", paddingAll: "18px", spacing: "md", contents: [
    row("ประเภท", "ลากิจ", true), row("วันที่", "2026-06-15"), row("จำนวน", "1 วันทำงาน"),
    { type: "separator", color: BORDER }, row("เลขที่คำขอ", "LEV-12062026-0007"),
    { type: "box", layout: "horizontal", contents: [ { type: "text", text: "สถานะ", size: "sm", color: MUTED, gravity: "center", flex: 1 }, pill("รออนุมัติ", "#b06f00", "#fdf1dd", false) ] } ] } ] } } };

const status = { type: "flex", altText: "คำขอล่าสุดของคุณ", contents: { type: "bubble", size: "mega", body: { type: "box", layout: "vertical", paddingAll: "0px", contents: [
  { type: "box", layout: "vertical", backgroundColor: PRIMARY, paddingAll: "18px", contents: [
    { type: "text", text: "คำขอล่าสุดของคุณ", color: "#ffffff", weight: "bold", size: "lg" },
    { type: "text", text: emp.first_name, color: "#e8f1fe", size: "xs" } ] },
  { type: "box", layout: "vertical", paddingAll: "18px", contents: [
    { type: "box", layout: "vertical", spacing: "xs", contents: [
      { type: "box", layout: "horizontal", contents: [ { type: "text", text: "ลากิจ", size: "sm", weight: "bold", color: INK, flex: 1, gravity: "center" }, pill("รออนุมัติ", "#b06f00", "#fdf1dd", true) ] },
      { type: "text", text: "2026-06-15 · 1 วัน", size: "xs", color: MUTED }, { type: "text", text: "LEV-12062026-0007", size: "xxs", color: FAINT } ] },
    { type: "separator", color: BORDER, margin: "md" },
    { type: "box", layout: "vertical", spacing: "xs", paddingTop: "10px", contents: [
      { type: "box", layout: "horizontal", contents: [ { type: "text", text: "ลาพักร้อน", size: "sm", weight: "bold", color: INK, flex: 1, gravity: "center" }, pill("อนุมัติแล้ว", "#067a59", "#e1f7f1", true) ] },
      { type: "text", text: "2026-06-02 – 2026-06-03 · 2 วัน", size: "xs", color: MUTED }, { type: "text", text: "LEV-02062026-0003", size: "xxs", color: FAINT } ] } ] } ] } } };

const info = (color, emoji, title, text, btn) => ({ type: "flex", altText: title, contents: { type: "bubble", size: "kilo",
  body: { type: "box", layout: "vertical", paddingAll: "20px", spacing: "sm", contents: [
    { type: "box", layout: "vertical", flex: 0, width: "46px", height: "46px", backgroundColor: color, cornerRadius: "14px", justifyContent: "center", contents: [{ type: "text", text: emoji, size: "xl", align: "center" }] },
    { type: "text", text: title, weight: "bold", size: "lg", color: INK, margin: "md" },
    { type: "text", text, size: "sm", color: MUTED, wrap: true } ] },
  ...(btn ? { footer: { type: "box", layout: "vertical", paddingAll: "16px", paddingTop: "0px", contents: [{ type: "button", style: "primary", color, height: "sm", action: { type: "uri", label: btn.label, uri: btn.uri } }] } } : {}) } });

const welcome = info("#3c8cf3", "🎉", "ผูกบัญชีสำเร็จ", `ยินดีต้อนรับคุณ${emp.first_name} เลือกบริการจากเมนูด้านล่าง หรือกดปุ่มเพื่อขอลางานได้เลย`, { label: "ขอลางาน", uri: "https://liff.line.me/2010383091-kBSUiU9b" });
const coming = info("#745af2", "⏱️", "ขอ OT", "ฟีเจอร์นี้กำลังจะเปิดให้บริการเร็วๆ นี้ ขอบคุณที่รอนะคะ 🙏");
const contact = info("#f2647a", "🎧", "ติดต่อฝ่ายบุคคล", "อีเมล hr@demo.co · โทร ต่อ 100 · จ–ศ 9:00–18:00");

const res = await fetch("https://api.line.me/v2/bot/message/push", {
  method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ to: emp.line_user_id, messages: [welcome, receipt, status, coming, contact] }),
});
console.log(res.ok ? `✅ ส่งการ์ดตัวอย่าง 5 ใบไปที่ ${emp.first_name} แล้ว (HTTP ${res.status})` : `❌ FAIL ${res.status}: ${await res.text()}`);
