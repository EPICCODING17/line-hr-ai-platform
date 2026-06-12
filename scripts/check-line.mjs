// Verify the LINE channel access token by calling the Messaging API.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

console.log("CHANNEL_ID   :", env.LINE_CHANNEL_ID || "(ว่าง)");
console.log("SECRET length:", (env.LINE_CHANNEL_SECRET || "").length, "chars");
console.log("TOKEN length :", (env.LINE_CHANNEL_ACCESS_TOKEN || "").length, "chars");

const token = env.LINE_CHANNEL_ACCESS_TOKEN;
if (!token) { console.error("\n❌ ไม่มี access token"); process.exit(1); }

const res = await fetch("https://api.line.me/v2/bot/info", {
  headers: { Authorization: `Bearer ${token}` },
});
const body = await res.json().catch(() => ({}));
if (res.ok) {
  console.log("\n✅ Token ใช้งานได้!");
  console.log("Bot         :", body.displayName);
  console.log("Basic ID    :", body.basicId);
  console.log("User ID(bot):", body.userId);
} else {
  console.log("\n❌ Token ใช้ไม่ได้:", res.status, JSON.stringify(body));
}

// quota (extra sanity)
const q = await fetch("https://api.line.me/v2/bot/message/quota", {
  headers: { Authorization: `Bearer ${token}` },
});
if (q.ok) console.log("Quota       :", JSON.stringify(await q.json()));
