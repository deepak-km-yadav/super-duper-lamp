# BotForge

A chatbot builder. Create bots, publish them, embed them on any site, and
collect the leads and meeting requests they pick up in conversation.

The repo also contains the older DesignInc "AI Concierge" (`/` and `/leads`,
served by `api/chat.ts`). It is a separate app and is untouched by the
BotForge setup below.

## Setup

### 1. Database

Run `supabase/migrations/0001_botforge.sql` in the Supabase SQL editor. It is
safe to re-run, and it leaves the existing `lead_captures` table alone.

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
| `BOTFORGE_ADMIN_TOKEN` | the dashboard | Long and random: it guards captured names, emails and phone numbers |
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

## Agent actions

Turn on **Act as an Agent** in a bot's settings and enable either action:

- **Lead Magnet** — captures a name, email or phone number from the chat.
- **Scheduler** — captures a requested date and time.

Detection is hybrid. A regex pass runs on the visitor's message before the
reply streams, so a lead is recorded before the first token and detection never
delays a response. A small model then enriches it out of band with the name,
intent and a date phrased in the visitor's own words. `api/detect-sweep.ts`
runs hourly to catch sessions abandoned mid-reply.

Everything captured appears at `/chatterbox/action-items`, with the
conversation context, the full transcript, a status workflow and CSV export.

## Development

```bash
npm install
npm run dev        # Vite only; /api routes are not served
npx vercel dev     # the full app, including the serverless functions

npm run build      # production build
npm run lint
npm run typecheck  # type-checks api/, which vite build does not cover
npm run test:api   # handler smoke tests against a stubbed PostgREST
```

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

`npm run test:api` needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
`BOTFORGE_ADMIN_TOKEN` set to any placeholder values.
