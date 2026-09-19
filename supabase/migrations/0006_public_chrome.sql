-- What a visitor sees around a published bot.
--
-- WHY
-- The share link rendered the site's own top bar above the conversation, with
-- links back into the bot builder. src/pages/ChatterboxPage.tsx hid it only for
-- ?embed=1, which the iframe and widget pass and the plain link does not -- so
-- the embeds were already clean and the link was not. A visitor sent a bot's
-- link could click straight into the dashboard.
--
-- Both default to false, so every existing published bot becomes independent
-- as soon as this is applied. That is the point; an admin turns them back on
-- deliberately.
--
-- These govern the standalone link only. An iframe and the widget render
-- inside someone else's site and stay chrome-free whatever these say.
--
-- Safe to run more than once.

alter table public.bots
  add column if not exists show_nav boolean not null default false,
  add column if not exists show_branding boolean not null default false;

-- No grants needed: the table-level grants in 0002 cover columns added later.
