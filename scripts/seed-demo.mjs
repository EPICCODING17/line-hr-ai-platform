// Seed the Demo Co tenant: defaults + departments/positions + admin user + employees.
// Idempotent. Run: node scripts/seed-demo.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const ADMIN_EMAIL = "admin@demo.co";
const ADMIN_PASSWORD = "Demo!2026";

// 1) tenant
const { data: tenant } = await db
  .from("tenants").upsert({ name: "Demo Co", slug: "demo" }, { onConflict: "slug" })
  .select("id").single();
const tenantId = tenant.id;
console.log("tenant:", tenantId);

// 2) defaults (leave types, holidays, workflows, modules, trial sub…)
const { error: seedErr } = await db.rpc("seed_tenant_defaults", { p_tenant: tenantId });
console.log("seed_tenant_defaults:", seedErr ? `FAIL ${seedErr.message}` : "ok");

// 3) departments + positions
const deptDefs = [
  { code: "SALES", name: "ฝ่ายขาย" },
  { code: "ENG", name: "วิศวกรรม" },
  { code: "ACC", name: "บัญชี" },
  { code: "HR", name: "ฝ่ายบุคคล" },
];
const posDefs = [
  { code: "SE", name: "Software Engineer" },
  { code: "SALES_EXEC", name: "Sales Executive" },
  { code: "ACCT", name: "Accountant" },
  { code: "HR_OFF", name: "HR Officer" },
];
const { data: depts } = await db
  .from("departments")
  .upsert(deptDefs.map((d) => ({ ...d, tenant_id: tenantId })), { onConflict: "tenant_id,code" })
  .select("id, code");
const { data: poss } = await db
  .from("positions")
  .upsert(posDefs.map((p) => ({ ...p, tenant_id: tenantId })), { onConflict: "tenant_id,code" })
  .select("id, code");
const D = Object.fromEntries(depts.map((d) => [d.code, d.id]));
const P = Object.fromEntries(poss.map((p) => [p.code, p.id]));

// 4) admin auth user (create or fetch)
let adminId;
const created = await db.auth.admin.createUser({
  email: ADMIN_EMAIL, password: ADMIN_PASSWORD, email_confirm: true,
});
if (created.error) {
  const { data: list } = await db.auth.admin.listUsers();
  adminId = list.users.find((u) => u.email === ADMIN_EMAIL)?.id;
  console.log("admin user: existed");
} else {
  adminId = created.data.user.id;
  console.log("admin user: created");
}

await db.from("users").upsert(
  { id: adminId, tenant_id: tenantId, email: ADMIN_EMAIL, full_name: "Demo Admin", role: "company_admin" },
  { onConflict: "id" },
);

// 5) employees
const employees = [
  { code: "EMP-2026-0001", first: "สมชาย", last: "ใจดี", dept: "SALES", pos: "SALES_EXEC", status: "active" },
  { code: "EMP-2026-0002", first: "วราภรณ์", last: "สุข", dept: "ENG", pos: "SE", status: "active" },
  { code: "EMP-2026-0003", first: "ธนา", last: "รักงาน", dept: "ACC", pos: "ACCT", status: "active" },
  { code: "EMP-2026-0004", first: "ก้องภพ", last: "มั่นคง", dept: "ENG", pos: "SE", status: "inactive" },
  { code: "EMP-2026-0005", first: "ปนัดดา", last: "ดีงาม", dept: "SALES", pos: "SALES_EXEC", status: "active" },
  { code: "EMP-2026-0006", first: "เมธี", last: "ตั้งใจ", dept: "HR", pos: "HR_OFF", status: "active" },
];
const { error: empErr, count } = await db.from("employees").upsert(
  employees.map((e) => ({
    tenant_id: tenantId, employee_code: e.code,
    first_name: e.first, last_name: e.last,
    department_id: D[e.dept], position_id: P[e.pos],
    employment_status: e.status,
  })),
  { onConflict: "tenant_id,employee_code", count: "exact" },
);
console.log("employees:", empErr ? `FAIL ${empErr.message}` : `ok (${count ?? employees.length})`);

console.log(`\nLogin → ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
