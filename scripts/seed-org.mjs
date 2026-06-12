// Give the Demo Co a minimal org chart so the leave approval workflow can
// resolve approvers (manager → HR). Idempotent.  node scripts/seed-org.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const { data: t } = await db.from("tenants").select("id").eq("slug", "demo").single();
const tenant = t.id;
const byCode = {};
const { data: emps } = await db.from("employees").select("id, employee_code, first_name").eq("tenant_id", tenant).is("deleted_at", null);
for (const e of emps) byCode[e.employee_code] = e;

const manager = byCode["EMP-2026-0006"]; // เมธี
const hr = byCode["EMP-2026-0005"];      // ปนัดดา
if (!manager || !hr) { console.error("ไม่พบพนักงานต้นแบบ (0005/0006)"); process.exit(1); }

// 1) roles
await db.from("employees").update({ role: "manager" }).eq("id", manager.id).eq("tenant_id", tenant);
await db.from("employees").update({ role: "hr" }).eq("id", hr.id).eq("tenant_id", tenant);

// 2) everyone else reports to the manager (manager reports to nobody)
const reports = emps.filter((e) => e.id !== manager.id);
for (const e of reports) {
  await db.from("employees").update({ manager_id: manager.id }).eq("id", e.id).eq("tenant_id", tenant);
}

console.log(`✅ org seeded:`);
console.log(`   หัวหน้า (manager): ${manager.first_name} ${manager.employee_code}`);
console.log(`   ฝ่ายบุคคล (hr):   ${hr.first_name} ${hr.employee_code}`);
console.log(`   ผูก manager ให้:   ${reports.length} คน`);
