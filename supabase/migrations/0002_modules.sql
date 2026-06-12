-- =====================================================================
-- 0002_modules.sql
-- LINE · AI · Leave · OT · Attendance · Documents · Workflow · Notifications
-- All tables: tenant_id + standard columns + soft delete.
-- =====================================================================

-- Reusable standard-column reminder (kept inline per table for clarity).

-- =====================================================================
-- LINE
-- =====================================================================
create table line_accounts (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  channel_id            text not null,
  channel_secret_enc    text not null,   -- encrypted at app layer (KMS / pgcrypto)
  channel_access_token_enc text not null,
  basic_id              text,            -- @paypers-style id
  liff_id               text,
  provider_id           text,
  is_active             boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, channel_id)
);

create table rich_menus (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  line_account_id uuid not null references line_accounts(id) on delete cascade,
  line_rich_menu_id text,               -- id returned by LINE API
  name          text not null,
  config        jsonb not null,         -- areas/actions definition
  is_default    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

-- Idempotency: dedupe LINE webhook deliveries by event id / dedup key.
create table line_webhook_events (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references tenants(id) on delete cascade,
  line_account_id uuid references line_accounts(id),
  dedup_key     text not null,          -- webhookEventId or hash(payload)
  event_type    text,
  payload       jsonb not null,
  status        text not null default 'received', -- received|processing|done|failed
  error         text,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  unique (dedup_key)                     -- global dedupe; LINE event ids are unique
);
create index on line_webhook_events (tenant_id, status, received_at);

create table line_messages (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  line_account_id uuid references line_accounts(id),
  employee_id   uuid references employees(id),
  line_user_id  text,
  direction     text not null,          -- inbound | outbound
  message_type  text,                   -- text|image|location|flex|...
  content       jsonb,
  reply_token   text,
  created_at    timestamptz not null default now()
);
create index on line_messages (tenant_id, employee_id, created_at desc);

-- =====================================================================
-- AI — conversation state + intent/extraction logs (multi-turn slot filling)
-- =====================================================================
create table ai_conversations (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  employee_id   uuid references employees(id),
  line_user_id  text,
  agent         ai_agent,
  state         text not null default 'idle',  -- idle|collecting|confirming|done
  context       jsonb not null default '{}',   -- accumulated slots between turns
  pending_intent text,
  expires_at    timestamptz,                    -- abandon stale dialogs
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index on ai_conversations (tenant_id, line_user_id) where deleted_at is null;

create table ai_intent_logs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  conversation_id uuid references ai_conversations(id) on delete set null,
  employee_id     uuid references employees(id),
  input_text      text not null,
  agent           ai_agent,
  intent          text,
  confidence      numeric(4,3),
  missing_fields  text[] not null default '{}',
  model           text,                          -- e.g. gpt-4o-mini
  prompt_tokens   int,
  completion_tokens int,
  latency_ms      int,
  raw_response    jsonb,
  created_at      timestamptz not null default now()
);
create index on ai_intent_logs (tenant_id, created_at desc);

create table ai_extraction_logs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  intent_log_id   uuid references ai_intent_logs(id) on delete cascade,
  extracted       jsonb not null,                -- normalized slot values
  validation      jsonb,                         -- which checks passed/failed
  created_at      timestamptz not null default now()
);

-- =====================================================================
-- Shared APPROVAL WORKFLOW engine (definition)
-- =====================================================================
create table approval_workflows (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  module        workflow_module not null,
  name          text not null,
  is_active     boolean not null default true,
  -- optional scoping: apply only to a department / leave_type / etc.
  scope         jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

create table approval_workflow_steps (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  workflow_id     uuid not null references approval_workflows(id) on delete cascade,
  step_order      int not null,
  approver_type   approver_type not null,
  specific_approver_id uuid references employees(id),  -- when approver_type=specific_user
  role_code       text,                                -- when approver_type=role
  manager_level   int,                                 -- when approver_type=manager (1=direct)
  is_required     boolean not null default true,
  auto_approve_condition jsonb,                         -- e.g. {"max_days":1}
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (workflow_id, step_order)
);

-- =====================================================================
-- LEAVE
-- =====================================================================
create table leave_types (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  code          text not null,                  -- annual_leave, sick_leave...
  name          text not null,
  category      leave_category not null,
  is_paid       boolean not null default true,
  requires_attachment boolean not null default false,  -- e.g. sick > N days
  attachment_after_days int,                     -- threshold to force medical cert
  color         text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, code)
);

create table leave_policies (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id) on delete cascade,
  name          text not null,
  quota_days    numeric(5,2) not null default 0,
  accrual       text not null default 'yearly',  -- yearly|monthly|none
  allow_carry_forward boolean not null default false,
  max_carry_forward numeric(5,2) default 0,
  max_consecutive_days int,                       -- ลาติดต่อกันเกินกำหนด
  min_notice_days int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

create table leave_balances (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  employee_id   uuid not null references employees(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id) on delete cascade,
  year          int not null,
  entitled_days numeric(5,2) not null default 0,
  carried_days  numeric(5,2) not null default 0,
  used_days     numeric(5,2) not null default 0,
  pending_days  numeric(5,2) not null default 0,  -- reserved by pending requests
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, employee_id, leave_type_id, year)
);

create table leave_requests (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  request_no    text not null,                  -- LEV-11062026-0001
  employee_id   uuid not null references employees(id),
  leave_type_id uuid not null references leave_types(id),
  start_date    date not null,
  end_date      date not null,
  total_days    numeric(5,2) not null,
  is_half_day   boolean not null default false,
  half_day_period text,                         -- am|pm
  reason        text,
  status        request_status not null default 'pending',
  workflow_id   uuid references approval_workflows(id),
  current_step  int default 1,
  source        text not null default 'line',   -- line|liff|web
  ai_intent_log_id uuid references ai_intent_logs(id),
  cancelled_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, request_no),
  check (end_date >= start_date)
);
create index on leave_requests (tenant_id, status, start_date);
create index on leave_requests (tenant_id, employee_id, start_date desc);

-- Instantiated approval steps (snapshot per request)
create table leave_approval_steps (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  request_id    uuid not null references leave_requests(id) on delete cascade,
  step_order    int not null,
  approver_id   uuid references employees(id),
  approver_type approver_type not null,
  status        approval_step_status not null default 'pending',
  comment       text,
  acted_at      timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, step_order)
);

create table leave_attachments (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  request_id    uuid not null references leave_requests(id) on delete cascade,
  file_path     text not null,                  -- Supabase Storage path
  file_name     text,
  mime_type     text,
  size_bytes    bigint,
  created_at timestamptz not null default now(),
  created_by uuid, deleted_at timestamptz
);

-- =====================================================================
-- OT
-- =====================================================================
create table ot_policies (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  name          text not null,
  max_hours_per_day   numeric(4,2),
  max_hours_per_month numeric(5,2),
  min_request_notice_hours int default 0,
  requires_project boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

create table ot_rates (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  ot_policy_id  uuid not null references ot_policies(id) on delete cascade,
  rate_type     ot_rate_type not null,
  multiplier    numeric(4,2) not null default 1.5,  -- 1.5x, 3x ...
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (ot_policy_id, rate_type)
);

create table ot_requests (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  request_no    text not null,                  -- OT-11062026-0001
  employee_id   uuid not null references employees(id),
  ot_date       date not null,
  start_time    timestamptz not null,
  end_time      timestamptz not null,
  total_hours   numeric(5,2) not null,
  rate_type     ot_rate_type not null default 'normal_day',
  reason        text,
  project       text,
  customer      text,
  status        request_status not null default 'pending',
  workflow_id   uuid references approval_workflows(id),
  current_step  int default 1,
  source        text not null default 'line',
  ai_intent_log_id uuid references ai_intent_logs(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, request_no),
  check (end_time > start_time)
);
create index on ot_requests (tenant_id, employee_id, ot_date desc);
create index on ot_requests (tenant_id, status, ot_date);

create table ot_approval_steps (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  request_id    uuid not null references ot_requests(id) on delete cascade,
  step_order    int not null,
  approver_id   uuid references employees(id),
  approver_type approver_type not null,
  status        approval_step_status not null default 'pending',
  comment       text,
  acted_at      timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, step_order)
);

create table ot_attachments (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  request_id    uuid not null references ot_requests(id) on delete cascade,
  file_path     text not null,
  file_name     text, mime_type text, size_bytes bigint,
  created_at timestamptz not null default now(),
  created_by uuid, deleted_at timestamptz
);

-- =====================================================================
-- ATTENDANCE
-- =====================================================================
create table work_locations (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  name          text not null,
  latitude      double precision,
  longitude     double precision,
  radius_meters int not null default 200,        -- geofence radius
  address       text,
  is_active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

create table attendance_policies (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  name          text not null,
  work_start    time not null default '09:00',
  work_end      time not null default '18:00',
  late_grace_minutes int not null default 15,
  require_gps   boolean not null default true,
  require_photo boolean not null default false,
  allow_wfh     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

create table attendance_devices (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  employee_id   uuid not null references employees(id) on delete cascade,
  device_info   text,
  last_ip       inet,
  last_seen_at  timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table attendance_records (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  record_no       text,                         -- ATT-11062026-0001
  employee_id     uuid not null references employees(id),
  work_date       date not null,
  check_in_time   timestamptz,
  check_out_time  timestamptz,
  break_start     timestamptz,
  break_end       timestamptz,
  work_mode       work_mode not null default 'office',
  work_location_id uuid references work_locations(id),
  in_latitude     double precision,
  in_longitude    double precision,
  out_latitude    double precision,
  out_longitude   double precision,
  location_name   text,
  in_photo_path   text,
  device_info     text,
  ip_address      inet,
  is_late         boolean not null default false,
  late_minutes    int default 0,
  missing_checkout boolean not null default false,
  status          request_status not null default 'completed',
  source          text not null default 'liff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, employee_id, work_date)
);
create index on attendance_records (tenant_id, work_date);
create index on attendance_records (tenant_id, employee_id, work_date desc);

create table attendance_adjustment_requests (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  attendance_record_id uuid references attendance_records(id),
  employee_id   uuid not null references employees(id),
  work_date     date not null,
  field         text not null,                  -- check_in_time | check_out_time
  requested_value timestamptz,
  reason        text,
  status        request_status not null default 'pending',
  approver_id   uuid references employees(id),
  acted_at      timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

-- =====================================================================
-- DOCUMENTS
-- =====================================================================
create table document_types (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  code          text not null,                  -- employment_certificate ...
  name          text not null,
  requires_approval boolean not null default true,
  requires_salary   boolean not null default false,  -- needs payroll data
  signer_role   text,                            -- who signs
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, code)
);

create table document_templates (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  document_type_id uuid not null references document_types(id) on delete cascade,
  language      text not null default 'th',     -- th | en
  version       int not null default 1,
  body          text not null,                  -- handlebars/mustache template
  is_active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, document_type_id, language, version)
);

create table document_requests (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  request_no    text not null,                  -- DOC-11062026-0001
  employee_id   uuid not null references employees(id),
  document_type_id uuid not null references document_types(id),
  purpose       text,
  language      text not null default 'th',
  ref_month     int,
  ref_year      int,
  status        request_status not null default 'pending',
  workflow_id   uuid references approval_workflows(id),
  current_step  int default 1,
  source        text not null default 'line',
  ai_intent_log_id uuid references ai_intent_logs(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, request_no)
);
create index on document_requests (tenant_id, status, created_at desc);

create table document_approval_steps (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  request_id    uuid not null references document_requests(id) on delete cascade,
  step_order    int not null,
  approver_id   uuid references employees(id),
  approver_type approver_type not null,
  status        approval_step_status not null default 'pending',
  comment       text,
  acted_at      timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, step_order)
);

create table generated_documents (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  request_id    uuid not null references document_requests(id) on delete cascade,
  template_id   uuid references document_templates(id),
  file_path     text not null,                  -- Supabase Storage / Google Drive
  download_url  text,
  url_expires_at timestamptz,
  signed_by     uuid references employees(id),
  created_at timestamptz not null default now(),
  created_by uuid, deleted_at timestamptz
);

-- =====================================================================
-- NOTIFICATIONS · REPORTS · SETTINGS
-- =====================================================================
create table notification_templates (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references tenants(id) on delete cascade,  -- null = system default
  code          text not null,
  channel       notification_channel not null,
  subject       text,
  body          text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, code, channel)
);

create table notifications (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  recipient_employee_id uuid references employees(id),
  recipient_user_id     uuid references users(id),
  channel       notification_channel not null default 'line',
  title         text,
  body          text,
  payload       jsonb,
  status        text not null default 'pending',  -- pending|sent|failed|read
  sent_at       timestamptz,
  read_at       timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (tenant_id, recipient_employee_id, status, created_at desc);

create table report_exports (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  report_type   text not null,                  -- leave_report|ot_summary|timesheet
  params        jsonb,
  format        text not null default 'xlsx',   -- xlsx|pdf|csv
  status        text not null default 'pending',
  file_path     text,
  requested_by  uuid references users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table tenant_settings (
  tenant_id     uuid primary key references tenants(id) on delete cascade,
  timezone      text not null default 'Asia/Bangkok',
  locale        text not null default 'th',
  workweek      int[] not null default '{1,2,3,4,5}',  -- Mon..Fri
  theme         text not null default 'light',          -- light|dark|dark2
  google_drive_config jsonb,
  branding      jsonb,
  updated_at timestamptz not null default now()
);

create table system_settings (
  key           text primary key,
  value         jsonb not null,
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- Deferred FKs from employees (policies now exist)
-- =====================================================================
alter table employees
  add constraint employees_attendance_policy_fk
    foreign key (work_location_policy_id) references attendance_policies(id),
  add constraint employees_leave_policy_fk
    foreign key (leave_policy_id) references leave_policies(id),
  add constraint employees_ot_policy_fk
    foreign key (ot_policy_id) references ot_policies(id);

-- =====================================================================
-- updated_at triggers (module tables that mutate)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'line_accounts','rich_menus','ai_conversations',
    'approval_workflows','approval_workflow_steps',
    'leave_types','leave_policies','leave_balances','leave_requests','leave_approval_steps',
    'ot_policies','ot_rates','ot_requests','ot_approval_steps',
    'work_locations','attendance_policies','attendance_records','attendance_adjustment_requests',
    'document_types','document_templates','document_requests','document_approval_steps',
    'notification_templates','tenant_settings'
  ] loop
    execute format(
      'create trigger t_touch before update on %I for each row execute function app.touch_updated_at();', t);
  end loop;
end $$;

-- Audit on financial/sensitive request tables
create trigger t_audit after insert or update or delete on leave_requests    for each row execute function app.audit_row();
create trigger t_audit after insert or update or delete on ot_requests       for each row execute function app.audit_row();
create trigger t_audit after insert or update or delete on document_requests for each row execute function app.audit_row();
create trigger t_audit after insert or update or delete on generated_documents for each row execute function app.audit_row();
