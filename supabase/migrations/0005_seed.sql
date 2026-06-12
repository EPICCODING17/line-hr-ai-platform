-- =====================================================================
-- 0005_seed.sql
-- Global seed (idempotent): permission catalog · system roles · plans.
-- Plus app.seed_tenant_defaults(tenant) — run once per new company signup.
-- =====================================================================

-- ---------- Permission catalog (global) ----------
insert into permissions (code, module, description) values
  ('employee.read','employee','ดูข้อมูลพนักงาน'),
  ('employee.write','employee','เพิ่ม/แก้ไขพนักงาน'),
  ('department.read','department','ดูแผนก'),
  ('department.write','department','จัดการแผนก'),
  ('leave.read','leave','ดูคำขอลา'),
  ('leave.write','leave','สร้าง/แก้คำขอลา'),
  ('leave.approve','leave','อนุมัติคำขอลา'),
  ('ot.read','ot','ดูคำขอ OT'),
  ('ot.write','ot','สร้าง/แก้คำขอ OT'),
  ('ot.approve','ot','อนุมัติ OT'),
  ('attendance.read','attendance','ดูการลงเวลา'),
  ('attendance.write','attendance','ปรับปรุงการลงเวลา'),
  ('document.read','document','ดูคำขอเอกสาร'),
  ('document.write','document','สร้างคำขอเอกสาร'),
  ('document.approve','document','อนุมัติ/ออกเอกสาร'),
  ('report.export','report','ส่งออกรายงาน'),
  ('workflow.manage','workflow','ตั้งค่า approval workflow'),
  ('policy.manage','settings','ตั้งค่านโยบาย (ลา/OT/ลงเวลา)'),
  ('tenant.manage','tenant','ตั้งค่าบริษัท')
on conflict (code) do nothing;

-- ---------- System role templates (tenant_id null) ----------
insert into roles (tenant_id, code, name, is_system)
select null, v.code, v.name, true
from (values
  ('company_admin','Company Admin'),
  ('hr','HR'),
  ('manager','Manager'),
  ('employee','Employee')
) as v(code, name)
where not exists (
  select 1 from roles r where r.tenant_id is null and r.code = v.code
);

-- company_admin → ทุกสิทธิ์
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r cross join permissions p
where r.tenant_id is null and r.code = 'company_admin'
on conflict do nothing;

-- hr → ทุกอย่างยกเว้น tenant.manage
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r join permissions p on p.code <> 'tenant.manage'
where r.tenant_id is null and r.code = 'hr'
on conflict do nothing;

-- manager → อ่าน + อนุมัติ
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r join permissions p
  on p.code in ('employee.read','leave.read','leave.approve','ot.read','ot.approve',
                'attendance.read','document.read')
where r.tenant_id is null and r.code = 'manager'
on conflict do nothing;

-- employee → อ่าน/สร้างของตัวเอง (enforce ownership ที่ app layer)
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r join permissions p
  on p.code in ('leave.read','leave.write','ot.read','ot.write',
                'attendance.read','attendance.write','document.read','document.write')
where r.tenant_id is null and r.code = 'employee'
on conflict do nothing;

-- ---------- Plans ----------
insert into plans (code, name, price_monthly, currency, max_employees,
                   ai_messages_per_month, storage_mb, features, sort_order) values
  ('free','Free',        0,   'THB', 10,   200,   500,  '{"document_ai":false,"export":false}', 1),
  ('starter','Starter',  590, 'THB', 30,   2000,  2000, '{"document_ai":true,"export":true}',   2),
  ('pro','Pro',          1990,'THB', 150,  10000, 10000,'{"document_ai":true,"export":true}',   3),
  ('enterprise','Enterprise', 0, 'THB', null, null, null, '{"document_ai":true,"export":true,"sso":true}', 4)
on conflict (code) do nothing;

-- =====================================================================
-- Per-tenant defaults — run once when a company signs up.
-- No-op if the tenant was already seeded (tenant_settings exists).
-- =====================================================================
create or replace function app.seed_tenant_defaults(p_tenant uuid)
returns void
language plpgsql
as $$
declare
  v_ot_policy uuid;
  v_free_plan uuid;
  v_wf uuid;
begin
  if exists (select 1 from tenant_settings where tenant_id = p_tenant) then
    return;  -- already seeded
  end if;

  -- settings
  insert into tenant_settings (tenant_id) values (p_tenant);

  -- modules (all enabled by default)
  insert into tenant_modules (tenant_id, feature_key, is_enabled, enabled_at)
  select p_tenant, k, true, now()
  from unnest(array['leave','ot','attendance','document','ai']) as k
  on conflict (tenant_id, feature_key) do nothing;

  -- leave types (6 categories)
  insert into leave_types (tenant_id, code, name, category, is_paid, requires_attachment, attachment_after_days, color) values
    (p_tenant,'annual_leave','ลาพักร้อน','annual',true,false,null,'#05be8a'),
    (p_tenant,'sick_leave','ลาป่วย','sick',true,true,3,'#ef5350'),
    (p_tenant,'personal_leave','ลากิจ','personal',true,false,null,'#745af2'),
    (p_tenant,'maternity_leave','ลาคลอด','maternity',true,true,null,'#3c8cf3'),
    (p_tenant,'military_leave','ลาเกณฑ์ทหาร','military',true,false,null,'#6c757d'),
    (p_tenant,'other_leave','ลาอื่นๆ','other',false,false,null,'#6c757d')
  on conflict (tenant_id, code) do nothing;

  -- default leave policies (quota per type)
  insert into leave_policies (tenant_id, leave_type_id, name, quota_days, accrual, allow_carry_forward, max_carry_forward, max_consecutive_days, min_notice_days)
  select p_tenant, lt.id, lt.name || ' Policy',
         case lt.code when 'annual_leave' then 6 when 'sick_leave' then 30
                      when 'personal_leave' then 3 when 'maternity_leave' then 98 else 0 end,
         'yearly',
         (lt.code = 'annual_leave'),
         case when lt.code = 'annual_leave' then 5 else 0 end,
         null,
         case lt.code when 'annual_leave' then 7 else 0 end
  from leave_types lt
  where lt.tenant_id = p_tenant;

  -- OT policy + rates
  insert into ot_policies (tenant_id, name, max_hours_per_day, max_hours_per_month, min_request_notice_hours, requires_project)
  values (p_tenant, 'นโยบาย OT มาตรฐาน', 4, 36, 0, false)
  returning id into v_ot_policy;

  insert into ot_rates (tenant_id, ot_policy_id, rate_type, multiplier) values
    (p_tenant, v_ot_policy, 'normal_day', 1.5),
    (p_tenant, v_ot_policy, 'holiday',    3.0),
    (p_tenant, v_ot_policy, 'weekend',    2.0),
    (p_tenant, v_ot_policy, 'special',    3.0);

  -- attendance policy
  insert into attendance_policies (tenant_id, name, work_start, work_end, late_grace_minutes, require_gps, require_photo, allow_wfh)
  values (p_tenant, 'นโยบายลงเวลามาตรฐาน', '09:00', '18:00', 15, true, false, true);

  -- document types
  insert into document_types (tenant_id, code, name, requires_approval, requires_salary, signer_role) values
    (p_tenant,'employment_certificate','หนังสือรับรองการทำงาน',true,false,'hr'),
    (p_tenant,'salary_certificate','หนังสือรับรองเงินเดือน',true,true,'hr'),
    (p_tenant,'payroll_slip','สลิปเงินเดือน',false,true,'hr'),
    (p_tenant,'work_certificate','หนังสือรับรองการปฏิบัติงาน',true,false,'hr'),
    (p_tenant,'custom_letter','หนังสือ HR อื่นๆ',true,false,'hr')
  on conflict (tenant_id, code) do nothing;

  -- approval workflows: Leave (Manager → HR)
  insert into approval_workflows (tenant_id, module, name) values (p_tenant,'leave','อนุมัติการลา') returning id into v_wf;
  insert into approval_workflow_steps (tenant_id, workflow_id, step_order, approver_type, manager_level, role_code, is_required) values
    (p_tenant, v_wf, 1, 'manager', 1, null, true),
    (p_tenant, v_wf, 2, 'role',    null, 'hr', true);

  -- OT (Manager → HR)
  insert into approval_workflows (tenant_id, module, name) values (p_tenant,'ot','อนุมัติ OT') returning id into v_wf;
  insert into approval_workflow_steps (tenant_id, workflow_id, step_order, approver_type, manager_level, role_code, is_required) values
    (p_tenant, v_wf, 1, 'manager', 1, null, true),
    (p_tenant, v_wf, 2, 'role',    null, 'hr', true);

  -- Document (HR only)
  insert into approval_workflows (tenant_id, module, name) values (p_tenant,'document','อนุมัติเอกสาร') returning id into v_wf;
  insert into approval_workflow_steps (tenant_id, workflow_id, step_order, approver_type, role_code, is_required) values
    (p_tenant, v_wf, 1, 'role', 'hr', true);

  -- Thai public holidays 2026
  -- NOTE: วันหยุดทางพุทธศาสนา (มาฆ/วิสาข/อาสาฬห) อิงปฏิทินจันทรคติ — ควรยืนยันกับ
  --       ประกาศวันหยุดราชการอย่างเป็นทางการอีกครั้งก่อนใช้งานจริง
  insert into holidays (tenant_id, holiday_date, name) values
    (p_tenant,'2026-01-01','วันขึ้นปีใหม่'),
    (p_tenant,'2026-03-03','วันมาฆบูชา'),
    (p_tenant,'2026-04-06','วันจักรี'),
    (p_tenant,'2026-04-13','วันสงกรานต์'),
    (p_tenant,'2026-04-14','วันสงกรานต์'),
    (p_tenant,'2026-04-15','วันสงกรานต์'),
    (p_tenant,'2026-05-01','วันแรงงานแห่งชาติ'),
    (p_tenant,'2026-05-04','วันฉัตรมงคล'),
    (p_tenant,'2026-06-01','วันวิสาขบูชา (ชดเชย)'),
    (p_tenant,'2026-06-03','วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี'),
    (p_tenant,'2026-07-28','วันเฉลิมพระชนมพรรษา ร.10'),
    (p_tenant,'2026-07-29','วันอาสาฬหบูชา'),
    (p_tenant,'2026-07-30','วันเข้าพรรษา'),
    (p_tenant,'2026-08-12','วันแม่แห่งชาติ'),
    (p_tenant,'2026-10-13','วันคล้ายวันสวรรคต ร.9'),
    (p_tenant,'2026-10-23','วันปิยมหาราช'),
    (p_tenant,'2026-12-05','วันพ่อแห่งชาติ'),
    (p_tenant,'2026-12-10','วันรัฐธรรมนูญ'),
    (p_tenant,'2026-12-31','วันสิ้นปี')
  on conflict (tenant_id, holiday_date) do nothing;

  -- starter subscription on Free plan (trial)
  select id into v_free_plan from plans where code = 'free';
  if v_free_plan is not null then
    insert into subscriptions (tenant_id, plan_id, status, started_at,
                               current_period_start, current_period_end)
    values (p_tenant, v_free_plan, 'trial', now(), now(), now() + interval '30 days')
    on conflict do nothing;
  end if;
end;
$$;
