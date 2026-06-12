// Verify the service (secret) key bypasses RLS by writing/reading `tenants`.
// Reads keys from .env.local. Run: node scripts/check-secret.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const secret = env.SUPABASE_SECRET_KEY;
const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const admin = createClient(url, secret, { auth: { persistSession: false } });
const anon = createClient(url, publishable, { auth: { persistSession: false } });

// 1) service key: upsert a demo tenant (anon would be blocked by RLS)
const { data: up, error: upErr } = await admin
  .from("tenants")
  .upsert({ name: "Demo Co", slug: "demo" }, { onConflict: "slug" })
  .select("id, name, slug")
  .single();
console.log("[service] upsert tenant:", upErr ? `FAIL ${upErr.message}` : up);

// 2) service key sees all tenants (bypass RLS)
const { count: adminCount } = await admin
  .from("tenants")
  .select("*", { count: "exact", head: true });
console.log("[service] tenants visible:", adminCount);

// 3) anon (publishable) trying the same write must be blocked
const { error: anonErr } = await anon
  .from("tenants")
  .insert({ name: "Hacker Co", slug: "hacker" });
console.log("[anon] insert blocked?:", anonErr ? `YES (${anonErr.code ?? anonErr.message})` : "NO — RLS LEAK!");

// 4) anon read of tenants without a session (no tenant claim) should see 0
const { count: anonCount } = await anon
  .from("tenants")
  .select("*", { count: "exact", head: true });
console.log("[anon] tenants visible (expect 0):", anonCount ?? 0);

if (up?.id) console.log("\nDemo tenant id:", up.id);
