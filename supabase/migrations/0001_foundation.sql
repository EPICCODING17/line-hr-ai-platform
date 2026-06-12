-- =====================================================================
-- 0001_foundation.sql
-- LINE HR AI Agent Platform — Phase 0 foundation
-- Extensions · helper schema · enums · running-number · core tables · audit
-- =====================================================================

-- ---------- Extensions ----------
create extension if not exists pgcrypto;   -- gen_random_uuid(), digest()
create extension if not exists citext;     -- case-insensitive email
create extension if not exists cube;       -- (optional) for earthdistance geofencing
create extension if not exists earthdistance;

-- ---------- Helper schema ----------
create schema if not exists app;

-- Read the current tenant from JWT claim first, fall back to a session GUC.
-- Dashboard requests carry tenant_id in the signed JWT (set by an auth hook).
-- Background jobs (webhook/cron) run as role `tenant_runtime` and do
--   SET LOCAL app.tenant_id = '<uuid>'  per transaction.
create or replace function app.current_tenant_id()
returns uuid
language plpgsql stable
as $$
declare
  v_claim text;
begin
  -- 1) JWT claim
  begin
    v_claim := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'tenant_id';
  exception when others then
    v_claim := null;
  end;
  if v_claim is not null then
    return v_claim::uuid;
  end if;
  -- 2) session GUC fallback
  v_claim := nullif(current_setting('app.tenant_id', true), '');
  if v_claim is not null then
    return v_claim::uuid;
  end if;
  return null;
end;
$$;

create or replace function app.is_super_admin()
returns boolean
language plpgsql stable
as $$
declare v text;
begin
  begin
    v := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'is_super_admin';
  exception when others then v := null;
  end;
  return coalesce(v, 'false') = 'true';
end;
$$;

create or replace function app.current_user_id()
returns uuid
language plpgsql stable
as $$
declare v text;
begin
  begin
    v := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub';
  exception when others then v := null;
  end;
  return v::uuid;  -- may be null
exception when others then return null;
end;
$$;

-- ---------- updated_at trigger ----------
create or replace function app.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =====================================================================
-- Running number service (race-safe)
-- =====================================================================
create table running_number_counters (
  tenant_id     uuid        not null,
  sequence_key  text        not null,   -- e.g. 'leave', 'ot', 'employee'
  period_key    text        not null,   -- e.g. '2026' or '11062026'
  current_value bigint      not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (tenant_id, sequence_key, period_key)
);

-- Returns formatted number like 'LEV-11062026-0001'. Atomic via upsert.
create or replace function app.next_doc_number(
  p_tenant   uuid,
  p_prefix   text,
  p_period   text,
  p_pad      int default 4
)
returns text
language plpgsql
as $$
declare v_next bigint;
begin
  insert into running_number_counters (tenant_id, sequence_key, period_key, current_value)
  values (p_tenant, lower(p_prefix), p_period, 1)
  on conflict (tenant_id, sequence_key, period_key)
  do update set current_value = running_number_counters.current_value + 1,
                updated_at = now()
  returning current_value into v_next;

  return p_prefix || '-' || p_period || '-' || lpad(v_next::text, p_pad, '0');
end;
$$;

-- =====================================================================
-- ENUM types
-- =====================================================================
create type user_role          as enum ('super_admin','company_admin','hr','manager','employee');
create type employment_type    as enum ('full_time','part_time','contract','probation','intern');
create type employment_status  as enum ('active','inactive','terminated','on_leave','suspended');
create type work_mode          as enum ('office','wfh','onsite','business_trip');
create type request_status     as enum ('draft','pending','approved','rejected','cancelled','completed','failed');
create type approval_step_status as enum ('pending','approved','rejected','skipped','auto_approved');
create type approver_type      as enum ('manager','specific_user','role','department_head');
create type leave_category     as enum ('annual','sick','personal','maternity','military','other');
create type ot_rate_type       as enum ('normal_day','holiday','weekend','special');
create type workflow_module    as enum ('leave','ot','attendance','document');
create type ai_agent           as enum ('leave','ot','attendance','document','general');
create type notification_channel as enum ('line','email','web');

-- =====================================================================
-- CORE tables
-- =====================================================================

-- tenants is the root; no tenant_id on itself.
create table tenants (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            citext unique not null,
  legal_name      text,
  tax_id          text,
  logo_url        text,
  status          text not null default 'active',  -- active | suspended | trial
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid,
  updated_by      uuid,
  deleted_at      timestamptz
);

create table departments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  code        text,
  name        text not null,
  parent_id   uuid references departments(id),
  head_employee_id uuid,           -- FK added after employees exists
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, code)
);

create table positions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  code        text,
  name        text not null,
  level       int default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, code)
);

create table employees (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  employee_code   text not null,                 -- EMP-2026-0001
  first_name      text not null,
  last_name       text not null,
  nickname        text,
  line_user_id    text,                           -- unique per (tenant, line_user_id)
  email           citext,
  phone           text,
  department_id   uuid references departments(id),
  position_id     uuid references positions(id),
  manager_id      uuid references employees(id),  -- direct manager
  start_date      date,
  employment_type employment_type not null default 'full_time',
  employment_status employment_status not null default 'active',
  role            user_role not null default 'employee',
  profile_image_url text,
  work_location_policy_id uuid,   -- FK -> attendance_policies (added in 0002)
  leave_policy_id uuid,           -- FK -> leave_policies      (added in 0002)
  ot_policy_id    uuid,           -- FK -> ot_policies         (added in 0002)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, employee_code),
  unique (tenant_id, line_user_id)
);

-- now we can wire department head
alter table departments
  add constraint departments_head_fk
  foreign key (head_employee_id) references employees(id);

-- Many-to-many / dotted-line managers (beyond the single manager_id)
create table employee_managers (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  employee_id   uuid not null references employees(id) on delete cascade,
  manager_id    uuid not null references employees(id) on delete cascade,
  relation      text not null default 'direct',  -- direct | dotted | functional
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, employee_id, manager_id, relation)
);

-- Supabase Auth users <-> employee link (dashboard logins: super/company admin, hr, manager)
create table users (
  id            uuid primary key,                  -- = auth.users.id
  tenant_id     uuid references tenants(id) on delete cascade,  -- null for super_admin
  employee_id   uuid references employees(id),
  email         citext not null,
  full_name     text,
  role          user_role not null default 'employee',
  is_super_admin boolean not null default false,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid, updated_by uuid, deleted_at timestamptz
);

-- RBAC + PBAC
create table roles (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references tenants(id) on delete cascade,  -- null = system role
  code        text not null,
  name        text not null,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, code)
);

create table permissions (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,   -- e.g. 'leave.approve', 'employee.write'
  module      text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table role_permissions (
  role_id        uuid not null references roles(id) on delete cascade,
  permission_id  uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- =====================================================================
-- Audit logs
-- =====================================================================
create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references tenants(id) on delete cascade,
  table_name  text not null,
  record_id   uuid,
  action      text not null,          -- INSERT | UPDATE | DELETE | SOFT_DELETE
  actor_id    uuid,                   -- user/employee who did it
  diff        jsonb,                  -- changed fields {col: {old, new}}
  ip_address  inet,
  created_at  timestamptz not null default now()
);
create index on audit_logs (tenant_id, table_name, record_id);
create index on audit_logs (tenant_id, created_at desc);

-- Generic audit trigger (attach selectively to sensitive tables)
create or replace function app.audit_row()
returns trigger language plpgsql as $$
declare
  v_diff jsonb := '{}'::jsonb;
  v_action text := tg_op;
  k text;
begin
  if tg_op = 'UPDATE' then
    -- soft delete detection
    if old.deleted_at is null and new.deleted_at is not null then
      v_action := 'SOFT_DELETE';
    end if;
    for k in select jsonb_object_keys(to_jsonb(new)) loop
      if to_jsonb(new) -> k is distinct from to_jsonb(old) -> k then
        v_diff := v_diff || jsonb_build_object(k,
          jsonb_build_object('old', to_jsonb(old) -> k, 'new', to_jsonb(new) -> k));
      end if;
    end loop;
  elsif tg_op = 'INSERT' then
    v_diff := to_jsonb(new);
  elsif tg_op = 'DELETE' then
    v_diff := to_jsonb(old);
  end if;

  insert into audit_logs (tenant_id, table_name, record_id, action, actor_id, diff)
  values (
    coalesce((to_jsonb(coalesce(new, old)) ->> 'tenant_id')::uuid, app.current_tenant_id()),
    tg_table_name,
    (to_jsonb(coalesce(new, old)) ->> 'id')::uuid,
    v_action,
    app.current_user_id(),
    v_diff
  );
  return coalesce(new, old);
end;
$$;

-- updated_at triggers for core tables
create trigger t_touch before update on tenants     for each row execute function app.touch_updated_at();
create trigger t_touch before update on departments for each row execute function app.touch_updated_at();
create trigger t_touch before update on positions   for each row execute function app.touch_updated_at();
create trigger t_touch before update on employees   for each row execute function app.touch_updated_at();
create trigger t_touch before update on users        for each row execute function app.touch_updated_at();
create trigger t_touch before update on roles        for each row execute function app.touch_updated_at();
create trigger t_touch before update on employee_managers for each row execute function app.touch_updated_at();

-- audit on the most sensitive tables (extend as needed)
create trigger t_audit after insert or update or delete on employees for each row execute function app.audit_row();
create trigger t_audit after insert or update or delete on users     for each row execute function app.audit_row();

-- Helpful core indexes
create index on employees (tenant_id, employment_status) where deleted_at is null;
create index on employees (tenant_id, department_id)     where deleted_at is null;
create index on employees (tenant_id, manager_id)        where deleted_at is null;
create index on departments (tenant_id) where deleted_at is null;
create index on positions  (tenant_id) where deleted_at is null;
