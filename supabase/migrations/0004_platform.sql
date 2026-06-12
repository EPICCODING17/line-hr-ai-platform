-- =====================================================================
-- 0004_platform.sql
-- Platform (SaaS-operator) layer + holidays.
-- Closes 5 gaps: platform roles · plans/subscriptions · usage metrics ·
--               per-tenant module toggles · holiday calendar.
-- =====================================================================

-- ---------- Platform role enum ----------
create type platform_role as enum ('platform_owner','platform_admin','platform_support');

-- =====================================================================
-- Helper functions (platform awareness)
-- =====================================================================

-- platform_role claim from JWT (null for tenant users)
create or replace function app.platform_role()
returns text language plpgsql stable as $$
declare v text;
begin
  begin
    v := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'platform_role';
  exception when others then v := null;
  end;
  return v;
end;
$$;

-- any platform operator (owner/admin/support)
create or replace function app.is_platform()
returns boolean language sql stable as $$
  select app.platform_role() is not null;
$$;

-- Redefine super-admin: full cross-tenant power = platform owner/admin
-- (kept backward-compatible with the legacy is_super_admin JWT flag).
create or replace function app.is_super_admin()
returns boolean language plpgsql stable as $$
declare v text; pr text;
begin
  begin
    v := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'is_super_admin';
  exception when others then v := null;
  end;
  pr := app.platform_role();
  return coalesce(v, 'false') = 'true'
      or pr in ('platform_owner','platform_admin');
end;
$$;
-- NOTE: platform_support is NOT super_admin → read-only via app.is_platform()
--       on platform-view tables; it cannot write tenant business data.

-- =====================================================================
-- 1) Platform users (SaaS operators) — separate from tenant `users`
-- =====================================================================
create table platform_users (
  id            uuid primary key,                 -- = auth.users.id
  email         citext not null unique,
  full_name     text,
  role          platform_role not null default 'platform_support',
  is_active     boolean not null default true,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- =====================================================================
-- 2) Plans + Subscriptions
-- =====================================================================
create table plans (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,             -- free | starter | pro | enterprise
  name          text not null,
  price_monthly numeric(10,2) not null default 0,
  currency      text not null default 'THB',
  -- hard limits enforced by app/usage checks
  max_employees int,                              -- null = unlimited
  ai_messages_per_month int,                      -- null = unlimited
  storage_mb    int,
  features      jsonb not null default '{}',      -- {"document_ai":true,...}
  is_active     boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create type subscription_status as enum ('trial','active','past_due','cancelled','expired');

create table subscriptions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  plan_id       uuid not null references plans(id),
  status        subscription_status not null default 'trial',
  started_at    timestamptz not null default now(),
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  cancel_at     timestamptz,
  cancelled_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);
-- one active/trial subscription per tenant (history kept; only one live)
create unique index subscriptions_one_live
  on subscriptions (tenant_id)
  where status in ('trial','active','past_due') and deleted_at is null;
create index on subscriptions (tenant_id, status);

-- =====================================================================
-- 3) Per-tenant module enablement (เปิด/ปิด Leave/OT/Attendance/Document/AI)
-- =====================================================================
create table tenant_modules (
  tenant_id     uuid not null references tenants(id) on delete cascade,
  feature_key   text not null,                    -- leave|ot|attendance|document|ai
  is_enabled    boolean not null default true,
  enabled_at    timestamptz,
  config        jsonb not null default '{}',
  updated_at    timestamptz not null default now(),
  primary key (tenant_id, feature_key)
);

-- =====================================================================
-- 4) Usage metrics (AI messages / storage) — rollup per month
-- =====================================================================
create table usage_counters (
  tenant_id     uuid not null references tenants(id) on delete cascade,
  metric        text not null,                    -- ai_messages | storage_bytes | line_push
  period_key    text not null,                    -- 'YYYYMM' (or 'lifetime')
  value         bigint not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (tenant_id, metric, period_key)
);

-- atomic increment helper (call from webhook/AI/storage handlers)
create or replace function app.bump_usage(
  p_tenant uuid, p_metric text, p_period text, p_delta bigint default 1
) returns bigint
language plpgsql as $$
declare v bigint;
begin
  insert into usage_counters (tenant_id, metric, period_key, value)
  values (p_tenant, p_metric, p_period, p_delta)
  on conflict (tenant_id, metric, period_key)
  do update set value = usage_counters.value + p_delta, updated_at = now()
  returning value into v;
  return v;
end;
$$;

-- =====================================================================
-- 5) Holiday calendar + working-day helper
-- =====================================================================
create table holidays (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  holiday_date  date not null,
  name          text not null,
  is_recurring  boolean not null default false,   -- repeats yearly (same MM-DD)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, holiday_date)
);
create index on holidays (tenant_id, holiday_date);

-- Is p_date a working day for this tenant?
-- Honors tenant_settings.workweek (ISO dow 1=Mon..7=Sun) + holidays (incl. recurring).
create or replace function app.is_working_day(p_tenant uuid, p_date date)
returns boolean
language plpgsql stable as $$
declare
  v_workweek int[];
  v_dow int := extract(isodow from p_date);
begin
  select coalesce(workweek, '{1,2,3,4,5}') into v_workweek
  from tenant_settings where tenant_id = p_tenant;
  if v_workweek is null then v_workweek := '{1,2,3,4,5}'; end if;

  if not (v_dow = any(v_workweek)) then
    return false;  -- weekend per this tenant's workweek
  end if;

  if exists (
    select 1 from holidays h
    where h.tenant_id = p_tenant and h.deleted_at is null
      and ( h.holiday_date = p_date
            or ( h.is_recurring
                 and extract(month from h.holiday_date) = extract(month from p_date)
                 and extract(day   from h.holiday_date) = extract(day   from p_date) ) )
  ) then
    return false;  -- public holiday
  end if;

  return true;
end;
$$;

-- =====================================================================
-- updated_at triggers
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'platform_users','plans','subscriptions','tenant_modules','usage_counters','holidays'
  ] loop
    execute format(
      'create trigger t_touch before update on %I for each row execute function app.touch_updated_at();', t);
  end loop;
end $$;

create trigger t_audit after insert or update or delete on subscriptions for each row execute function app.audit_row();

-- =====================================================================
-- RLS for new tables (the 0003 loop already ran — must add explicitly here)
-- =====================================================================

-- platform_users: only platform operators (and the user themself) can see
alter table platform_users enable row level security;
alter table platform_users force row level security;
create policy platform_users_select on platform_users for select
  using ( app.is_platform() or id = app.current_user_id() );
create policy platform_users_write on platform_users for all
  using ( app.platform_role() = 'platform_owner' )
  with check ( app.platform_role() = 'platform_owner' );

-- plans: global catalog — readable by everyone, writable by platform owner/admin
alter table plans enable row level security;
create policy plans_read  on plans for select using ( true );
create policy plans_write on plans for all
  using ( app.is_super_admin() ) with check ( app.is_super_admin() );

-- tenant-scoped platform tables: tenant sees own; platform sees all (read),
-- platform owner/admin can write (is_super_admin); support read-only.
do $$
declare r text;
begin
  foreach r in array array['subscriptions','tenant_modules','usage_counters','holidays'] loop
    execute format('alter table public.%I enable row level security;', r);
    execute format('alter table public.%I force row level security;', r);

    -- read: own tenant, OR any platform operator (incl. support)
    execute format($f$
      create policy %1$s_sel on public.%1$I for select
      using ( app.is_platform() or tenant_id = app.current_tenant_id() );
    $f$, r);

    -- insert/update/delete: super_admin (platform owner/admin) or own tenant
    execute format($f$
      create policy %1$s_ins on public.%1$I for insert
      with check ( app.is_super_admin() or tenant_id = app.current_tenant_id() );
    $f$, r);
    execute format($f$
      create policy %1$s_upd on public.%1$I for update
      using ( app.is_super_admin() or tenant_id = app.current_tenant_id() )
      with check ( app.is_super_admin() or tenant_id = app.current_tenant_id() );
    $f$, r);
    execute format($f$
      create policy %1$s_del on public.%1$I for delete
      using ( app.is_super_admin() or tenant_id = app.current_tenant_id() );
    $f$, r);
  end loop;
end $$;

grant select, insert, update, delete on
  platform_users, plans, subscriptions, tenant_modules, usage_counters, holidays
  to tenant_runtime;
grant execute on function app.bump_usage(uuid,text,text,bigint),
                          app.is_working_day(uuid,date),
                          app.platform_role(), app.is_platform()
  to tenant_runtime;
