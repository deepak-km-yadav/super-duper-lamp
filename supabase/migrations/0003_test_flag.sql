-- Distinguish captures made while testing from real visitor captures.
--
-- api/bot-chat.ts previously created no session at all for an admin request,
-- so chatting in the editor's Live test panel recorded nothing -- no
-- transcript, no lead, no meeting request, and no indication that anything had
-- been skipped. That made the one place an owner would naturally verify Lead
-- Magnet the one place it could not work.
--
-- Those requests are now recorded like any other, marked with is_test so the
-- Action Items page can keep them out of the real list by default.
--
-- Safe to run more than once. Existing rows default to false, which is correct:
-- they came from visitors.

alter table public.chat_sessions
  add column if not exists is_test boolean not null default false;
alter table public.leads
  add column if not exists is_test boolean not null default false;
alter table public.meeting_requests
  add column if not exists is_test boolean not null default false;

-- The Action Items query now filters on this by default.
create index if not exists leads_is_test_created_idx
  on public.leads (is_test, created_at desc);
create index if not exists meeting_requests_is_test_created_idx
  on public.meeting_requests (is_test, created_at desc);

-- No grants needed: the table-level grants in 0002 cover columns added later.
