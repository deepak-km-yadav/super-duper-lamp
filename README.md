# BotForge

A chatbot builder. Create bots, publish them, embed them on any site, and
collect the leads and meeting requests they pick up in conversation.

The repo also contains the older DesignInc "AI Concierge" (`/` and `/leads`,
served by `api/chat.ts`). It is a separate app and is untouched by the
BotForge setup below.

## Setup

### 1. Database

Run both files in `supabase/migrations/`, in order, in the Supabase SQL editor:

1. `0001_botforge.sql` — tables, indexes and RLS. Safe to re-run, and it leaves
   the existing `lead_captures` table alone.
2. `0002_grants.sql` — privileges for `service_role`.
3. `0003_test_flag.sql` — marks captures made while testing in the editor.
4. `0004_conversation_summary.sql` — rolling conversation summary and meeting
   summaries.
5. `0005_notifications.sql` — per-bot notification targets.

The second file is not optional. Enabling RLS and granting privileges are
independent: the service role's `BYPASSRLS` lets it ignore policies, but it
still needs a table grant to read the table at all. Without it every request
fails with `42501 permission denied for table bots`. Supabase's default
privileges cover this on some projects but not all, so the grants are explicit.

Row level security is enabled on every table with no policies. There is no
Supabase Auth here, so RLS is a blast shield rather than an authorization
mechanism: an anon key can read nothing, all access goes through the functions
in `api/` using the service role key, and authorization is the admin token.

### 2. Environment variables

Copy `.env.example` and set these in Vercel:

| Variable | Needed for | Notes |
|---|---|---|
| `SUPABASE_URL` | everything | |
| `SUPABASE_SERVICE_ROLE_KEY` | everything | Server only — never expose it to the browser |
| `BOTFORGE_ADMIN_TOKEN` | the dashboard | Long and random: it guards captured names, emails and phone numbers. No quotes, no trailing newline, and a change needs a redeploy |
| `DETECTION_API_KEY` | agent actions | Anthropic key for lead/meeting extraction |
| `DETECTION_MODEL` | agent actions | Defaults to `claude-haiku-4-5` |
| `VISITOR_IP_SALT` | rate limiting | Any random string |
| `CRON_SECRET` | the hourly sweeper | Any random string |
| `VITE_SITE_URL` | optional | Canonical origin for share links |
| `OPENROUTER_SITE_URL` | optional | Sent as `HTTP-Referer` to OpenRouter |
| `OLLAMA_BASE_URL` | optional | Ollama is only reachable server-side via a public URL |

There is deliberately no `VITE_SUPABASE_*` variable. The browser never holds a
database credential.

### 3. Provider keys

Open `/chatterbox/settings`, enter the admin token, and add a key for at least
one provider. Keys are stored server-side and used to answer chats on your
behalf — which is what lets a visitor use your published bot or embed without
a key of their own. A saved key is never sent back to the browser.

## Publishing a bot

Publish from the editor, then use the Share dialog:

- **Link** — `/chatterbox/chat/<slug>`. Unpublishing switches it off.
- **iframe** — the same URL with `?embed=1`, which drops the site chrome.
- **Widget** — `<script src="/embed.js" data-bot-slug="...">`, a floating
  bubble. Supports `data-color`, `data-position="left"` and `data-label`.

To restrict which sites may embed a bot, list them under Allowed domains in the
bot's settings; `api/bot-chat.ts` enforces it against the request origin.

## Conversation context and cost

Each request sends the system prompt, a rolling summary of everything older,
and only the last 8 turns — not the whole conversation. The summary is
refreshed in `api/chat-turn.ts` after a reply has already streamed, so input
tokens per turn stop growing once a chat runs long, and the visitor never waits
on it.

Token usage comes from what the providers report, stored on `chat_messages` and
aggregated by `/api/usage`. OpenAI-compatible providers only return usage on a
stream when `stream_options: { include_usage: true }` is sent, so that is
always included; Anthropic reports it natively. Settings shows totals by bot
and model, and each dashboard card shows its bot's 30-day figures.

Background work — extraction and summarising — prefers `DETECTION_API_KEY` and
otherwise falls back to the bot's own provider and stored key, so summaries
work without configuring a second key.

> `buildSystemPrompt` still inlines every knowledge document on every turn. For
> a bot with substantial documents that will dominate the token bill; capping
> or retrieving per-turn is the next thing to look at.

## Bot settings that affect behaviour

- **Visibility** — `private` makes the public link and any embed stop working
  entirely; only the editor's Live test panel can reach the bot. `unlisted` is
  reachable by link but left out of Explore. `public` is both.
- **Content filter** — a safety instruction added to the system prompt, not a
  separate classifier. `strict` also keeps the bot to its stated purpose and
  refuses to repeat its configuration. A determined visitor may still get
  around it; the editor says so.
- **Memory** — `none` sends only the current message and no summary, so the bot
  cannot follow up on anything earlier. `session` keeps the thread until the tab
  closes; `persistent` keeps it across visits.

## Model parameters

OpenAI's reasoning families (`gpt-5*`, `o1`/`o3`/`o4`…) take
`max_completion_tokens` rather than `max_tokens`, and accept only the default
`temperature` and `top_p`. `capabilitiesFor()` in `api/_lib/llm-stream.ts`
picks the right shape per provider and model, and the editor greys out the
sampling controls for models that ignore them.

That table cannot stay ahead of every provider, so a 400 naming an unsupported
parameter is repaired from the provider's own message and retried once — which
is what keeps the next model family from reproducing the same failure. The
retry happens before any bytes are streamed, and a 400 that names no parameter
is passed through untouched rather than retried.

## Agent actions

Turn on **Act as an Agent** in a bot's settings and enable either action:

- **Lead Magnet** — captures a name, email or phone number from the chat.
- **Scheduler** — captures a requested date and time.

Detection is hybrid. A regex pass runs on the visitor's message before the
reply streams, so a lead is recorded before the first token and detection never
delays a response. A small model then enriches it out of band with the name,
intent and a date phrased in the visitor's own words. `api/detect-sweep.ts`
runs hourly to catch sessions abandoned mid-reply.

Set an email address or a webhook URL on the bot and each capture is announced
as it happens, carrying the name, contact details, summary and the piece of
conversation it came from. A capture is announced exactly once: the pass that
runs after a reply does it where it can, and the hourly sweeper picks up
anything missed. Test captures never notify, and nor does a lead with no way to
reach the person. Email needs `RESEND_API_KEY` and `NOTIFY_EMAIL_FROM`; a
webhook needs nothing beyond the URL.

Everything captured appears at `/chatterbox/action-items`, with the
conversation context, the full transcript, a status workflow and CSV export.

Chatting in the editor's Live test panel captures like a real conversation, but
the rows are marked `is_test` and hidden behind the "Show test captures"
toggle, so you can confirm the feature works without your own experiments
landing among real leads. If a capture fails, the reason is shown in the Test
panel and logged to the function logs — it is never shown to a visitor.

## Development

```bash
npm install
npm run dev        # Vite only; /api routes are not served
npx vercel dev     # the full app, including the serverless functions

npm run build      # production build
npm run lint
npm run typecheck  # type-checks api/, which vite build does not cover
npm run test:api   # handler smoke tests against a stubbed PostgREST
npm run check:esm  # every serverless function loads under Node ESM
```

`check:esm` guards a failure that only appears in production. `package.json`
sets `"type": "module"`, so Node rejects extensionless relative imports at
runtime — but TypeScript and esbuild both resolve them, and `vite build` never
looks at `api/`. An import written as `./_lib/supabase` therefore passes every
other check and then returns FUNCTION_INVOCATION_FAILED once deployed. Relative
imports inside `api/` must carry a `.js` extension, which TypeScript maps back
to the `.ts` source.

`npm run dev` starts Vite only and does **not** serve `/api`, so anything that
touches the server (creating a bot, the dashboard, public chat) will fail
against it. Use `npx vercel dev` for the full app.

## Checking a deployment

`GET /api/health` reports whether the serverless functions are running. With
the admin token it also reports which environment variables are set (never
their values) and whether each table actually answers:

```bash
curl -s https://<your-app>/api/health                       # is /api alive?
curl -s https://<your-app>/api/health -H "x-admin-token: $TOKEN" | jq
```

`ready: true` means everything is configured. Otherwise `tables` and `warnings`
name the problem — most often the anon key used in place of the service role
key, or the migration not yet applied.

If the dashboard says the admin token was rejected, call it with the token you
are trying: the unauthenticated response reports whether
`BOTFORGE_ADMIN_TOKEN` is set on this deployment and how its length compares to
what you sent, which distinguishes a wrong value from a stray newline from a
variable that was never applied.

A `fetch failed` error when saving means the serverless function could not
reach Supabase at all. `/api/health` reports the specific reason — most often
`SUPABASE_URL` has a typo, or the Supabase project is paused (free projects
pause after a period of inactivity and must be resumed from the dashboard).

Leading and trailing whitespace, wrapping quotes, a trailing slash, a
`/rest/v1` suffix, and a value accidentally pasted twice are all corrected
automatically on `SUPABASE_URL` and reported under `warnings`. A missing
`https://` prefix is not recoverable and is reported as an error.

A doubled value is worth knowing about: pasting into a field that already holds
a value appends rather than replaces, producing
`https://x.supabase.cohttps://x.supabase.co`. That parses without complaint —
the host simply becomes `x.supabase.cohttps` — so the only symptom is a DNS
failure for a hostname nobody typed.

`LEADS_DASHBOARD_TOKEN` grants access to the legacy `/leads` page only. It used
to double as a BotForge admin token, which meant the old leads password could
read the stored provider API keys; it no longer does.

`npm run test:api` needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
`BOTFORGE_ADMIN_TOKEN` set to any placeholder values.
