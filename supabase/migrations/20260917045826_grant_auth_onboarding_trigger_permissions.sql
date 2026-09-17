-- Supabase Auth executes this trigger after inserting a new auth.users row.
-- Keep the function private from browser-facing roles while allowing the
-- internal Auth database role to enter the schema and invoke it.
grant usage on schema private to supabase_auth_admin;
grant execute on function private.handle_new_user() to supabase_auth_admin;

revoke all on function private.handle_new_user() from public, anon, authenticated;
