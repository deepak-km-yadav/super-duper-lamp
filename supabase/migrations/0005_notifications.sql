-- Tell someone when a lead or meeting request is captured.
--
-- WHY
-- Capture worked, but nothing announced it: notification existed only in the
-- legacy DesignInc concierge (api/chat.ts and LEAD_CAPTURE_WEBHOOK_URL), never
-- in BotForge. A captured lead sat in the dashboard until somebody thought to
-- look, which is the weakest link in a tool whose purpose is follow-up.
--
-- Recipients are per bot rather than global, because different bots often
-- belong to different people.
--
-- Safe to run more than once.

alter table public.bots
  add column if not exists notify_email text,
  add column if not exists notify_webhook_url text;

-- Set once a capture has been announced, so it is announced exactly once even
-- though both the post-reply pass and the hourly sweeper can reach it.
alter table public.leads
  add column if not exists notified_at timestamptz;
alter table public.meeting_requests
  add column if not exists notified_at timestamptz;

-- The sweeper looks for exactly these.
create index if not exists leads_unnotified_idx
  on public.leads (created_at) where notified_at is null;
create index if not exists meeting_requests_unnotified_idx
  on public.meeting_requests (created_at) where notified_at is null;

-- No grants needed: the table-level grants in 0002 cover columns added later.
