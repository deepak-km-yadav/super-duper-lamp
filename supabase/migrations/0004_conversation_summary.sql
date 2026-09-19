-- A rolling conversation summary, and summaries on meeting requests.
--
-- WHY
-- Every turn resent the whole conversation, so cost and latency grew with the
-- chat. Sessions now carry a running summary of the turns that have scrolled
-- out of the live window: the request sends the summary plus the last few
-- turns, and the summary is refreshed after the reply has already streamed, so
-- none of that work is on the path the visitor waits on.
--
-- summary_through_message_id records how far the summary covers, so a refresh
-- only has to read what is new.
--
-- Safe to run more than once.

alter table public.chat_sessions
  add column if not exists summary text,
  add column if not exists summary_through_message_id bigint,
  add column if not exists summary_updated_at timestamptz;

-- leads.summary already exists; meeting requests had only a short topic, which
-- is not enough for the Action Items page to be readable at a glance.
alter table public.meeting_requests
  add column if not exists summary text;

-- No grants needed: the table-level grants in 0002 cover columns added later.
