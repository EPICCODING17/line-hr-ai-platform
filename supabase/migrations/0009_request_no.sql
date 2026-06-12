-- 0009_request_no.sql
-- Public wrapper around app.next_doc_number so PostgREST/RPC can mint a
-- per-tenant running document number (leave/OT/document requests).
-- Pattern mirrors public.gen_employee_code (0008): SECURITY DEFINER so the
-- service_role / authenticated caller can bump running_number_counters under RLS.
-- Period key = Bangkok-local DDMMYYYY  ->  e.g. LEV-12062026-0001

create or replace function public.gen_request_no(p_tenant uuid, p_prefix text)
returns text
language plpgsql
security definer
set search_path = app, public
as $$
begin
  return app.next_doc_number(
    p_tenant,
    upper(p_prefix),
    to_char((now() at time zone 'Asia/Bangkok'), 'DDMMYYYY'),
    4
  );
end;
$$;

grant execute on function public.gen_request_no(uuid, text) to anon, authenticated, service_role;
