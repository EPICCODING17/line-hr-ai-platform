-- =====================================================================
-- 0008_employee_code.sql
-- Public RPC to generate the next employee code (EMP-YYYY-0001) for a tenant.
-- SECURITY INVOKER: called by service_role server-side, which bypasses RLS
-- on running_number_counters and has execute on app.next_doc_number (0007).
-- =====================================================================
create or replace function public.gen_employee_code(p_tenant uuid)
returns text
language sql
as $$
  select app.next_doc_number(p_tenant, 'EMP', to_char((now() at time zone 'Asia/Bangkok'), 'YYYY'), 4);
$$;

revoke execute on function public.gen_employee_code(uuid) from anon, authenticated, public;
grant execute on function public.gen_employee_code(uuid) to service_role;
