// Sign in as the demo admin (publishable key) and read employees under RLS.
// 6 rows  => auth hook is injecting tenant_id correctly.
// 0 rows  => hook not enabled on the project (enable it in the dashboard).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});

const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email: "admin@demo.co", password: "Demo!2026",
});
if (authErr) { console.log("login FAIL:", authErr.message); process.exit(1); }

// decode JWT claims to see what the hook injected
const payload = JSON.parse(Buffer.from(auth.session.access_token.split(".")[1], "base64").toString());
console.log("JWT tenant_id   :", payload.tenant_id ?? "(missing)");
console.log("JWT user_role   :", payload.user_role ?? "(missing)");

const { data: emps, error } = await supabase
  .from("employees").select("employee_code, first_name").order("employee_code");
console.log("employees visible:", error ? `ERR ${error.message}` : emps.length);
if (emps?.length) console.log(emps.map((e) => `  ${e.employee_code} ${e.first_name}`).join("\n"));

if (!payload.tenant_id) {
  console.log("\n⚠️  hook not active — enable Custom Access Token hook in the Supabase dashboard.");
}
