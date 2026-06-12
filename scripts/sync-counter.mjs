// Sync the employee running-number counter to the current employee count
// so gen_employee_code() never collides with seeded codes. Idempotent.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const { data: t } = await db.from("tenants").select("id").eq("slug", "demo").single();
const year = String(new Date().getFullYear());
const { count } = await db.from("employees").select("*", { count: "exact", head: true }).eq("tenant_id", t.id);

const { error } = await db.from("running_number_counters").upsert(
  { tenant_id: t.id, sequence_key: "emp", period_key: year, current_value: count ?? 0 },
  { onConflict: "tenant_id,sequence_key,period_key" },
);

const next = "EMP-" + year + "-" + String((count ?? 0) + 1).padStart(4, "0");
console.log(error ? "FAIL " + error.message : `counter synced to ${count} -> next = ${next}`);
