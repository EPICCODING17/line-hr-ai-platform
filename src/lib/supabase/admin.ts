import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — SERVER ONLY. Bypasses RLS.
 * Always scope queries by the caller's tenant_id (app-layer guard).
 * Never import this into client components.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
