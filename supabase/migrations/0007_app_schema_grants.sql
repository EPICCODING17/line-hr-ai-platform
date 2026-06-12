-- =====================================================================
-- 0007_app_schema_grants.sql
-- Client roles need USAGE on schema `app` so audit/touch triggers and RLS
-- helper functions resolve during normal DML (insert/update from dashboard
-- via `authenticated`, server tasks via `service_role`).
-- =====================================================================

grant usage on schema app to anon, authenticated, service_role;

-- Trigger + RLS helper functions executed in the caller's context.
grant execute on function
  app.audit_row(),
  app.touch_updated_at(),
  app.current_tenant_id(),
  app.current_user_id(),
  app.is_super_admin(),
  app.is_platform(),
  app.platform_role(),
  app.next_doc_number(uuid, text, text, int),
  app.bump_usage(uuid, text, text, bigint),
  app.is_working_day(uuid, date)
to anon, authenticated, service_role;

-- Keep the auth hook restricted to supabase_auth_admin only.
revoke execute on function app.custom_access_token_hook(jsonb) from anon, authenticated, service_role, public;
