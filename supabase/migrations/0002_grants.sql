-- Grants for the BotForge tables.
--
-- WHY THIS IS SEPARATE FROM THE SCHEMA
-- 0001 enabled row level security and stopped there, on the assumption that
-- Supabase's default privileges would grant the new tables to service_role.
-- That assumption does not hold on every project, and the two mechanisms are
-- independent: BYPASSRLS lets service_role ignore RLS policies, but it does
-- not grant it privileges on a table in the first place. Without these grants
-- every request fails with 42501 "permission denied for table bots".
--
-- Safe to run more than once, and safe to run before or after 0001 has been
-- re-applied.

-- ---------------------------------------------------------------------------
-- service_role: full access. Every request from /api authenticates as this
-- role, and RLS is deliberately policy-free, so this is the only role that can
-- reach the data.
-- ---------------------------------------------------------------------------
grant usage on schema public to service_role;

grant all privileges on table
  public.bots,
  public.knowledge_docs,
  public.provider_keys,
  public.chat_sessions,
  public.chat_messages,
  public.leads,
  public.meeting_requests,
  public.lead_captures
to service_role;

grant select on public.action_items to service_role;

-- Identity and bigserial columns draw from sequences, so inserts fail without
-- this even when the table grant is present.
grant usage, select on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- anon and authenticated get nothing, deliberately.
--
-- RLS with no policies already blocks them, but withholding the grant means a
-- leaked publishable key cannot read these tables even if a policy is ever
-- added by mistake. The legacy lead_captures table keeps whatever grants it
-- already had -- api/lead-capture.ts and api/leads.ts use the service role too.
-- ---------------------------------------------------------------------------
revoke all on table
  public.bots,
  public.knowledge_docs,
  public.provider_keys,
  public.chat_sessions,
  public.chat_messages,
  public.leads,
  public.meeting_requests
from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Future tables in this schema, so a later migration cannot reintroduce the
-- same failure.
-- ---------------------------------------------------------------------------
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
