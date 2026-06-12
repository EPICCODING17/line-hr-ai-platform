import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type SessionContext = {
  userId: string;
  tenantId: string;
  role: string;
  isSuperAdmin: boolean;
  fullName: string | null;
  email: string;
};

/**
 * Resolve the logged-in user's tenant + role.
 * Auth comes from the session (RLS-safe); the users-row lookup uses the
 * service role so it works whether or not the JWT auth hook is enabled.
 */
export async function getContext(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("tenant_id, role, is_super_admin, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!data?.tenant_id) return null;

  return {
    userId: user.id,
    tenantId: data.tenant_id as string,
    role: data.role as string,
    isSuperAdmin: !!data.is_super_admin,
    fullName: data.full_name as string | null,
    email: data.email as string,
  };
}

export function canManageEmployees(ctx: SessionContext) {
  return ctx.isSuperAdmin || ctx.role === "company_admin" || ctx.role === "hr";
}
