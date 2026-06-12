-- =====================================================================
-- 0003_rls.sql
-- Row Level Security: tenant isolation on every tenant-scoped table.
--
-- Model:
--   * Dashboard requests  -> authenticated role + signed JWT carrying tenant_id
--   * Background jobs      -> role `tenant_runtime` (NO bypassrls)
--                             + SET LOCAL app.tenant_id = '<uuid>' per tx
--   * Supabase `service_role` BYPASSES RLS — never use it for per-user/per-tenant
--     request handling. Use it only for migrations / cross-tenant admin tasks.
-- =====================================================================

-- ---------- runtime role for webhook/cron (no BYPASSRLS) ----------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'tenant_runtime') then
    create role tenant_runtime nologin noinherit;
  end if;
end $$;
grant usage on schema public, app to tenant_runtime;
grant select, insert, update, delete on all tables in schema public to tenant_runtime;
grant usage, select on all sequences in schema public to tenant_runtime;
grant execute on all functions in schema app to tenant_runtime;
alter default privileges in schema public
  grant select, insert, update, delete on tables to tenant_runtime;

-- =====================================================================
-- Apply standard tenant-isolation policies to every table that has tenant_id.
-- =====================================================================
do $$
declare
  r record;
begin
  for r in
    select c.relname as tbl
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and exists (
        select 1 from pg_attribute a
        where a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped
      )
      -- users & roles are special-cased below (own full policy set) — skip here
      and c.relname <> all (array['users','roles'])
  loop
    execute format('alter table public.%I enable row level security;', r.tbl);
    execute format('alter table public.%I force row level security;', r.tbl);

    -- SELECT
    execute format($f$
      create policy %1$I on public.%1$I for select
      using ( app.is_super_admin() or tenant_id = app.current_tenant_id() );
    $f$, r.tbl);

    -- INSERT
    execute format($f$
      create policy %1$s_ins on public.%1$I for insert
      with check ( app.is_super_admin() or tenant_id = app.current_tenant_id() );
    $f$, r.tbl);

    -- UPDATE
    execute format($f$
      create policy %1$s_upd on public.%1$I for update
      using ( app.is_super_admin() or tenant_id = app.current_tenant_id() )
      with check ( app.is_super_admin() or tenant_id = app.current_tenant_id() );
    $f$, r.tbl);

    -- DELETE (hard delete; app should prefer soft delete)
    execute format($f$
      create policy %1$s_del on public.%1$I for delete
      using ( app.is_super_admin() or tenant_id = app.current_tenant_id() );
    $f$, r.tbl);
  end loop;
end $$;

-- =====================================================================
-- Special tables (no tenant_id column or different rule)
-- =====================================================================

-- tenants: a user sees only their own tenant; super_admin sees all.
alter table tenants enable row level security;
alter table tenants force row level security;
create policy tenants_select on tenants for select
  using ( app.is_super_admin() or id = app.current_tenant_id() );
create policy tenants_modify on tenants for all
  using ( app.is_super_admin() )
  with check ( app.is_super_admin() );

-- users: scoped by tenant_id (nullable for super admins).
alter table users enable row level security;
alter table users force row level security;
create policy users_select on users for select
  using ( app.is_super_admin() or tenant_id = app.current_tenant_id() or id = app.current_user_id() );
create policy users_ins on users for insert
  with check ( app.is_super_admin() or tenant_id = app.current_tenant_id() );
create policy users_upd on users for update
  using ( app.is_super_admin() or tenant_id = app.current_tenant_id() or id = app.current_user_id() )
  with check ( app.is_super_admin() or tenant_id = app.current_tenant_id() or id = app.current_user_id() );
create policy users_del on users for delete
  using ( app.is_super_admin() or tenant_id = app.current_tenant_id() );

-- line_webhook_events: tenant_id may be null on first receipt (before routing).
--   The standard loop already covered it; relax SELECT/INSERT for unrouted rows
--   handled by the webhook runtime which sets app.tenant_id once resolved.

-- permissions / system_settings: global, super-admin only for writes.
alter table permissions enable row level security;
create policy permissions_read on permissions for select using ( true );
create policy permissions_write on permissions for all
  using ( app.is_super_admin() ) with check ( app.is_super_admin() );

alter table system_settings enable row level security;
create policy system_settings_admin on system_settings for all
  using ( app.is_super_admin() ) with check ( app.is_super_admin() );

-- roles can be system-wide (tenant_id null) or tenant-scoped.
alter table roles enable row level security;
alter table roles force row level security;
create policy roles_select on roles for select
  using ( app.is_super_admin() or tenant_id is null or tenant_id = app.current_tenant_id() );
create policy roles_ins on roles for insert
  with check ( app.is_super_admin() or tenant_id = app.current_tenant_id() );
create policy roles_upd on roles for update
  using ( app.is_super_admin() or tenant_id = app.current_tenant_id() )
  with check ( app.is_super_admin() or tenant_id = app.current_tenant_id() );
create policy roles_del on roles for delete
  using ( app.is_super_admin() or tenant_id = app.current_tenant_id() );

-- role_permissions has no tenant_id; gate via parent role visibility.
alter table role_permissions enable row level security;
create policy role_permissions_rw on role_permissions for all
  using (
    app.is_super_admin() or exists (
      select 1 from roles rr where rr.id = role_id
        and (rr.tenant_id is null or rr.tenant_id = app.current_tenant_id())
    )
  )
  with check (
    app.is_super_admin() or exists (
      select 1 from roles rr where rr.id = role_id
        and rr.tenant_id = app.current_tenant_id()
    )
  );

-- =====================================================================
-- NOTE for app developers
-- =====================================================================
-- Webhook / cron handler pattern (per request, inside one transaction):
--    set local role tenant_runtime;
--    set local app.tenant_id = '<tenant-uuid>';
--    ... queries here are tenant-isolated by RLS ...
-- Dashboard handler: use the user's Supabase JWT (authenticated role); the
--    auth hook must inject tenant_id / is_super_admin into the JWT claims.
