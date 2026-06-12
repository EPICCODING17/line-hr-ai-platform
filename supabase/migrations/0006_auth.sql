-- =====================================================================
-- 0006_auth.sql
-- Custom Access Token hook (inject tenant_id/role into JWT) + seed wrapper.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Custom Access Token hook
-- Supabase calls this as role `supabase_auth_admin` on token issue.
-- It merges tenant_id / user_role / is_super_admin / platform_role into
-- the JWT claims, which app.current_tenant_id() / app.is_super_admin() read.
-- ---------------------------------------------------------------------
create or replace function app.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_uid   uuid := (event ->> 'user_id')::uuid;
  claims  jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  u       record;
  p       record;
begin
  select tenant_id, role, is_super_admin
    into u
  from public.users
  where id = v_uid and deleted_at is null;

  if found then
    if u.tenant_id is not null then
      claims := jsonb_set(claims, '{tenant_id}', to_jsonb(u.tenant_id::text));
    end if;
    claims := jsonb_set(claims, '{user_role}', to_jsonb(u.role::text));
    claims := jsonb_set(claims, '{is_super_admin}', to_jsonb(coalesce(u.is_super_admin, false)));
  end if;

  select role into p
  from public.platform_users
  where id = v_uid and is_active and deleted_at is null;

  if found then
    claims := jsonb_set(claims, '{platform_role}', to_jsonb(p.role::text));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Auth admin must execute the hook and read the lookup tables.
grant usage on schema app to supabase_auth_admin;
grant execute on function app.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function app.custom_access_token_hook(jsonb) from authenticated, anon, public;

grant select on public.users, public.platform_users to supabase_auth_admin;

-- Permissive policies so the hook (running as supabase_auth_admin, with no JWT
-- context yet) can read the lookup rows despite FORCE RLS.
create policy users_auth_admin_read on public.users
  as permissive for select to supabase_auth_admin using (true);
create policy platform_users_auth_admin_read on public.platform_users
  as permissive for select to supabase_auth_admin using (true);

-- ---------------------------------------------------------------------
-- public wrapper for app.seed_tenant_defaults (PostgREST only exposes public).
-- Called server-side with the service key when a tenant is created.
-- ---------------------------------------------------------------------
create or replace function public.seed_tenant_defaults(p_tenant uuid)
returns void
language sql
security definer
set search_path = public, app
as $$
  select app.seed_tenant_defaults(p_tenant);
$$;

revoke execute on function public.seed_tenant_defaults(uuid) from anon, authenticated;
grant execute on function public.seed_tenant_defaults(uuid) to service_role;
