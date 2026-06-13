// Create + upload + set-default the LINE rich menu for the Demo Co channel.
//
//   node scripts/setup-rich-menu.mjs
//
// Requires in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY,
// APP_ENCRYPTION_KEY. Optional: LINE_LIFF_ID (makes the "ลางาน" button open the
// LIFF leave form directly; without it that button falls back to a postback the
// webhook answers). Renders scripts/richmenu.png first if you changed the design.
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const here = (p) => new URL(p, import.meta.url);
const env = Object.fromEntries(
  readFileSync(here("../.env.local"), "utf8")
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

const need = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "APP_ENCRYPTION_KEY"];
const missing = need.filter((k) => !env[k]);
if (missing.length) { console.error("ขาดค่าใน .env.local:", missing.join(", ")); process.exit(1); }

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { data: t } = await db.from("tenants").select("id").eq("slug", "demo").single();
const { data: acct } = await db
  .from("line_accounts")
  .select("id, channel_access_token_enc, liff_id")
  .eq("tenant_id", t.id).eq("is_active", true).single();
if (!acct) { console.error("ไม่พบ line_account ของ Demo Co"); process.exit(1); }

const token = decrypt(acct.channel_access_token_enc);
const liffId = env.LINE_LIFF_ID || acct.liff_id || null;
const auth = { Authorization: `Bearer ${token}` };

// 6 tap zones laid out 3 cols x 2 rows over the 2500 x 1686 canvas
const W = 2500, H = 1686, COL = Math.round(W / 3), ROW = H / 2;
const bounds = (c, r) => ({ x: c === 2 ? COL * 2 : COL * c, y: r * ROW, width: c === 2 ? W - COL * 2 : COL, height: ROW });
const leaveAction = liffId
  ? { type: "uri", uri: `https://liff.line.me/${liffId}` }
  : { type: "postback", data: "action=leave", displayText: "ขอลางาน" };
// LINE concatenates the path onto the LIFF endpoint (/liff/leave), so
// `/{liffId}/ot` resolves to /liff/leave/ot — in-scope — which next.config
// rewrites to the real /liff/ot route. Opens the OT form in one tap like leave.
const otAction = liffId
  ? { type: "uri", uri: `https://liff.line.me/${liffId}/ot` }
  : { type: "postback", data: "action=ot", displayText: "ขอ OT" };
const checkinAction = liffId
  ? { type: "uri", uri: `https://liff.line.me/${liffId}/checkin` }
  : { type: "postback", data: "action=checkin", displayText: "ลงเวลา" };
const documentAction = liffId
  ? { type: "uri", uri: `https://liff.line.me/${liffId}/document` }
  : { type: "postback", data: "action=document", displayText: "ขอเอกสาร" };

const richmenu = {
  size: { width: W, height: H },
  selected: true,
  name: "HR main menu",
  chatBarText: "เมนูบริการ",
  areas: [
    { bounds: bounds(0, 0), action: leaveAction },
    { bounds: bounds(1, 0), action: otAction },
    { bounds: bounds(2, 0), action: checkinAction },
    { bounds: bounds(0, 1), action: documentAction },
    { bounds: bounds(1, 1), action: { type: "postback", data: "action=status", displayText: "สถานะคำขอ" } },
    { bounds: bounds(2, 1), action: { type: "postback", data: "action=contact", displayText: "ติดต่อ HR" } },
  ],
};

async function lineJson(url, body) {
  const res = await fetch(url, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

// 0) clean up any previous menus so we don't accumulate
const list = await fetch("https://api.line.me/v2/bot/richmenu/list", { headers: auth }).then((r) => r.json());
for (const m of list.richmenus ?? []) {
  await fetch(`https://api.line.me/v2/bot/richmenu/${m.richMenuId}`, { method: "DELETE", headers: auth });
  console.log("ลบเมนูเก่า:", m.richMenuId);
}

// 1) create the menu definition
const { richMenuId } = await lineJson("https://api.line.me/v2/bot/richmenu", richmenu);
console.log("สร้างเมนู:", richMenuId);

// 2) upload the image (note: api-data host)
const png = readFileSync(here("./richmenu.png"));
const up = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
  method: "POST", headers: { ...auth, "Content-Type": "image/png" }, body: png,
});
if (!up.ok) throw new Error(`upload image -> ${up.status} ${await up.text()}`);
console.log("อัปโหลดรูปแล้ว");

// 3) set as the default menu for every user
await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, { method: "POST", headers: auth });

console.log("\n✅ ตั้ง Rich Menu เป็นค่าเริ่มต้นสำเร็จ");
console.log("ปุ่ม “ลางาน”:", liffId ? `เปิด LIFF (${liffId})` : "postback (ยังไม่ได้ตั้ง LINE_LIFF_ID — ตั้งแล้วรันใหม่เพื่อเปิดฟอร์มตรง)");
