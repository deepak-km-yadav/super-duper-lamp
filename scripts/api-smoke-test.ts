/**
 * Smoke test for the BotForge API handlers.
 *
 * Stubs `fetch` to stand in for PostgREST, so handler wiring, admin auth and
 * the column mapping can be checked without a live Supabase project. It guards
 * the properties that would fail silently and expensively if they regressed:
 * the public endpoint never leaking a system prompt or knowledge, provider keys
 * never being returned, unknown fields never reaching a SQL column, and auth
 * failing closed when no token is configured.
 *
 * Run with: npm run test:api
 */
// env is set by the shell: ESM imports hoist above any assignment here.

import botsHandler from "../api/bots";
import publicHandler from "../api/bot-public";
import keysHandler from "../api/provider-keys";
import { detectSignals, buildContextSnippet } from "../api/_lib/detect";
import { readEnv, readEnvUrl, describeFetchFailure, hasRepeatedUrl } from "../api/_lib/env";
import actionItemsHandler from "../api/action-items";
import { captureTurn } from "./bot-chat-helper";
import usageHandler from "../api/usage";
import { shouldNotify, type CaptureNotification } from "../api/_lib/notify";
import healthHandler from "../api/health";
import { apiFetchForTest } from "./api-client-helper";
import { toCsvForTest } from "./csv-helper";
import {
  captureRequests,
  sseChunk,
  capabilitiesFor,
  clientCapabilitiesFor,
  repairBody,
} from "./openai-params-helper";

type Call = { method: string; url: string; body: unknown };
const calls: Call[] = [];
let responder: (c: Call) => { status?: number; body: unknown } = () => ({ body: [] });

(globalThis as any).fetch = async (url: string, init: any) => {
  const call: Call = {
    method: init?.method ?? "GET",
    // Strip whatever SUPABASE_URL happens to be, so the test does not depend
    // on a particular stub host being exported.
    url: String(url).replace(/^.*\/rest\/v1\//, ""),
    body: init?.body ? JSON.parse(init.body) : undefined,
  };
  calls.push(call);
  const r = responder(call);
  return {
    ok: (r.status ?? 200) < 400,
    status: r.status ?? 200,
    text: async () => JSON.stringify(r.body),
  };
};

function mkRes() {
  const out: any = { code: 0, payload: undefined, headers: {} as Record<string, string> };
  return {
    res: {
      setHeader: (k: string, v: string) => { out.headers[k] = v; },
      status: (c: number) => ({ json: (p: unknown) => { out.code = c; out.payload = p; } }),
    },
    out,
  };
}

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name, extra !== undefined ? JSON.stringify(extra) : ""); }
}

async function run() {
  console.log("\n-- auth --");
  {
    const { res, out } = mkRes();
    await botsHandler({ method: "GET", headers: {} }, res as any);
    check("GET /bots with no token -> 401", out.code === 401, out.payload);
  }
  {
    const { res, out } = mkRes();
    await botsHandler({ method: "GET", headers: { "x-admin-token": "wrong" } }, res as any);
    check("GET /bots with wrong token -> 401", out.code === 401, out.payload);
  }
  {
    const { res, out } = mkRes();
    await botsHandler({ method: "GET", headers: { "x-admin-token": "admin-secret-token " } }, res as any);
    check("token is trimmed and accepted", out.code === 200, out.payload);
  }

  console.log("\n-- list shape --");
  {
    responder = () => ({ body: [{
      id: "b1", slug: "s", name: "N", system_prompt: "secret", agent_enabled: true,
      agent_actions: ["lead_magnet"], avatar_url: null, status: "PUBLISHED",
    }] });
    calls.length = 0;
    const { res, out } = mkRes();
    await botsHandler({ method: "GET", headers: { "x-admin-token": "admin-secret-token" } }, res as any);
    const bot = out.payload.bots[0];
    check("snake_case -> camelCase", bot.systemPrompt === "secret" && bot.agentEnabled === true, bot);
    check("agentActions passthrough", JSON.stringify(bot.agentActions) === '["lead_magnet"]', bot);
    check("list excludes ARCHIVED", calls[0].url.includes("status=neq.ARCHIVED"), calls[0].url);
    check("list omits knowledge bodies", Array.isArray(bot.knowledge) && bot.knowledge.length === 0);
  }

  console.log("\n-- create --");
  {
    calls.length = 0;
    responder = (c) => {
      if (c.method === "GET") return { body: [] };
      return { body: [{ id: "new1", slug: "my-bot", name: "My Bot" }] };
    };
    const { res, out } = mkRes();
    await botsHandler({
      method: "POST",
      headers: { "x-admin-token": "admin-secret-token" },
      body: { name: "My Bot", systemPrompt: "hi", id: "CLIENT_TRIES_TO_SET", createdAt: "1999" },
    }, res as any);
    const insert = calls.find((c) => c.method === "POST" && c.url.startsWith("bots"));
    const row = (insert!.body as any);
    check("create -> 201", out.code === 201, out.payload);
    check("server generates id, ignores client id", row.id !== "CLIENT_TRIES_TO_SET" && row.id.length === 10, row.id);
    check("read-only createdAt stripped", row.created_at === undefined, row);
    check("slug derived from name", row.slug === "my-bot", row.slug);
    check("camelCase -> snake_case", row.system_prompt === "hi", row);
  }

  console.log("\n-- unknown field rejection --");
  {
    calls.length = 0;
    responder = (c) => (c.method === "GET" ? { body: [] } : { body: [{ id: "x" }] });
    const { res } = mkRes();
    await botsHandler({
      method: "POST",
      headers: { "x-admin-token": "admin-secret-token" },
      body: { name: "X", is_admin: true, evil: "yes" },
    }, res as any);
    const row = calls.find((c) => c.method === "POST" && c.url.startsWith("bots"))!.body as any;
    check("unknown columns dropped", row.is_admin === undefined && row.evil === undefined, row);
  }
  {
    // The editor's two chrome toggles have to survive the column whitelist.
    calls.length = 0;
    responder = (c) => {
      if (c.method === "GET") return { body: [{ id: "b1", name: "N", slug: "n", published_at: null }] };
      return { body: [{ id: "b1" }] };
    };
    const { res } = mkRes();
    await botsHandler({
      method: "PATCH", query: { id: "b1" },
      headers: { "x-admin-token": "admin-secret-token" },
      body: { showNav: true, showBranding: true },
    }, res as any);
    const patch = calls.find((c) => c.method === "PATCH")!.body as any;
    check("showNav is writable as show_nav", patch.show_nav === true, patch);
    check("showBranding is writable as show_branding", patch.show_branding === true, patch);
  }

  console.log("\n-- slug freeze after publish --");
  {
    calls.length = 0;
    responder = (c) => {
      if (c.method === "GET") return { body: [{ id: "b1", name: "Old", slug: "old", published_at: "2026-01-01" }] };
      return { body: [{ id: "b1", name: "New", slug: "old" }] };
    };
    const { res } = mkRes();
    await botsHandler({
      method: "PATCH", query: { id: "b1" },
      headers: { "x-admin-token": "admin-secret-token" },
      body: { name: "New Name" },
    }, res as any);
    const patch = calls.find((c) => c.method === "PATCH")!.body as any;
    check("published bot keeps its slug on rename", patch.slug === undefined, patch);
  }
  {
    calls.length = 0;
    responder = (c) => {
      if (c.method === "GET") return { body: [{ id: "b1", name: "Old", slug: "old", published_at: null }] };
      return { body: [{ id: "b1" }] };
    };
    const { res } = mkRes();
    await botsHandler({
      method: "PATCH", query: { id: "b1" },
      headers: { "x-admin-token": "admin-secret-token" },
      body: { name: "New Name" },
    }, res as any);
    const patch = calls.find((c) => c.method === "PATCH")!.body as any;
    check("draft bot reslugs on rename", patch.slug === "new-name", patch);
  }

  console.log("\n-- sendBeacon path (token in body, no header) --");
  {
    calls.length = 0;
    responder = (c) => (c.method === "GET"
      ? { body: [{ id: "b1", name: "N", slug: "n", published_at: null }] }
      : { body: [{ id: "b1" }] });
    const { res, out } = mkRes();
    await botsHandler({
      method: "POST", headers: {},
      body: { op: "update", id: "b1", patch: { greeting: "bye" }, token: "admin-secret-token" },
    }, res as any);
    check("beacon update accepted", out.code === 200, out.payload);
    const patch = calls.find((c) => c.method === "PATCH")!.body as any;
    check("beacon patch applied", patch.greeting === "bye", patch);
  }

  console.log("\n-- public endpoint redaction --");
  {
    calls.length = 0;
    responder = () => ({ body: [{
      id: "b1", slug: "s", name: "N", greeting: "hi", theme_color: "#fff", status: "PUBLISHED",
    }] });
    const { res, out } = mkRes();
    await publicHandler({ method: "GET", query: { slug: "s" } }, res as any);
    const b = out.payload.bot;
    check("public bot returned", out.code === 200 && b.name === "N", out.payload);
    check("systemPrompt absent", b.systemPrompt === undefined, b);
    check("knowledge absent", b.knowledge === undefined, b);
    check("modelId absent", b.modelId === undefined, b);
    check("status stripped", b.status === undefined, b);
    check("requested columns are the redacted set",
      !calls[0].url.includes("system_prompt") && calls[0].url.includes("select="), calls[0].url);
  }
  {
    // The visitor-facing page decides whether to draw site chrome, so it needs
    // both flags — and nothing else new.
    calls.length = 0;
    responder = () => ({ body: [{
      id: "b1", slug: "s", name: "N", status: "PUBLISHED",
      show_nav: true, show_branding: true,
    }] });
    const { res, out } = mkRes();
    await publicHandler({ method: "GET", query: { slug: "s" } }, res as any);
    const b = out.payload.bot;
    check("public bot carries showNav", b.showNav === true, b);
    check("public bot carries showBranding", b.showBranding === true, b);
    check("chrome flags are asked for by name",
      calls[0].url.includes("show_nav") && calls[0].url.includes("show_branding"),
      calls[0].url);
    check("chrome flags do not drag the prompt along", b.systemPrompt === undefined, b);
  }
  {
    // A bot saved before the migration reads as absent, not as "on".
    responder = () => ({ body: [{ id: "b1", slug: "s", name: "N", status: "PUBLISHED" }] });
    const { res, out } = mkRes();
    await publicHandler({ method: "GET", query: { slug: "s" } }, res as any);
    check("an old bot does not come back with the nav switched on",
      out.payload.bot.showNav !== true, out.payload.bot);
  }
  {
    responder = () => ({ body: [{ id: "b1", slug: "s", name: "Paused Bot", status: "DRAFT" }] });
    const { res, out } = mkRes();
    await publicHandler({ method: "GET", query: { slug: "s" } }, res as any);
    check("unpublished -> unavailable + name only",
      out.payload.unavailable === "unpublished" && out.payload.name === "Paused Bot" && !out.payload.bot,
      out.payload);
  }
  {
    responder = () => ({ body: [] });
    const { res, out } = mkRes();
    await publicHandler({ method: "GET", query: { slug: "nope" } }, res as any);
    check("missing bot -> 404", out.code === 404, out.payload);
  }

  console.log("\n-- provider keys never leak --");
  {
    responder = () => ({ body: [{ provider_id: "anthropic", key_hint: "sk-a…wxyz" }] });
    const { res, out } = mkRes();
    await keysHandler({ method: "GET", headers: { "x-admin-token": "admin-secret-token" } }, res as any);
    check("GET returns hints only",
      out.payload.keys[0].hint === "sk-a…wxyz" && !("apiKey" in out.payload.keys[0]), out.payload);
  }
  {
    calls.length = 0;
    responder = () => ({ body: [{}] });
    const { res, out } = mkRes();
    await keysHandler({
      method: "PUT", headers: { "x-admin-token": "admin-secret-token" },
      body: { providerId: "anthropic", apiKey: "sk-ant-1234567890abcdef" },
    }, res as any);
    check("PUT stores key, returns only hint",
      out.payload.hint === "sk-a…cdef" && out.payload.apiKey === undefined, out.payload);
    check("key written to provider_keys", (calls[0].body as any).api_key === "sk-ant-1234567890abcdef");
  }
  {
    const { res, out } = mkRes();
    await keysHandler({ method: "GET", headers: {} }, res as any);
    check("keys endpoint requires token", out.code === 401, out.payload);
  }

  console.log("\n-- action items --");
  {
    const { res, out } = mkRes();
    await actionItemsHandler({ method: "GET", headers: {} }, res as any);
    check("action items require a token", out.code === 401, out.payload);
  }
  {
    responder = (c) => {
      if (c.url.startsWith("leads")) {
        return { body: [{
          id: 1, bot_id: "b1", session_id: "s1", name: "Dana",
          email: "dana@example.com", phone: null, company: null, intent: "demo",
          summary: "Wants a demo", context_snippet: "Visitor: hi", status: "NEW",
          detected_by: "hybrid", created_at: "2026-09-01T10:00:00Z",
        }] };
      }
      if (c.url.startsWith("meeting_requests")) {
        return { body: [{
          id: 2, bot_id: "b1", session_id: "s1", name: "Dana", email: null,
          requested_for_text: "next Tuesday 3pm", timezone: null, topic: "Demo",
          context_snippet: "Visitor: can we meet", status: "NEW",
          created_at: "2026-09-01T11:00:00Z",
        }] };
      }
      return { body: [{ id: "b1", name: "My Bot" }] };
    };
    const { res, out } = mkRes();
    await actionItemsHandler(
      { method: "GET", headers: { "x-admin-token": "admin-secret-token" } },
      res as any,
    );
    const lead = out.payload.leads[0];
    const meeting = out.payload.meetings[0];
    check("lead mapped to camelCase", lead.contextSnippet === "Visitor: hi", lead);
    check("bot name resolved", lead.botName === "My Bot", lead);
    check("meeting mapped", meeting.requestedFor === "next Tuesday 3pm", meeting);
    check("context snippet present on both",
      Boolean(lead.contextSnippet && meeting.contextSnippet));
  }
  {
    // A deleted bot must not blow up the page.
    responder = (c) =>
      c.url.startsWith("bots")
        ? { body: [] }
        : c.url.startsWith("leads")
          ? { body: [{ id: 1, bot_id: "gone", context_snippet: "", status: "NEW", created_at: "x" }] }
          : { body: [] };
    const { res, out } = mkRes();
    await actionItemsHandler(
      { method: "GET", headers: { "x-admin-token": "admin-secret-token" } },
      res as any,
    );
    check("missing bot degrades gracefully",
      out.payload.leads[0].botName === "Deleted bot", out.payload.leads[0]);
  }
  {
    const { res, out } = mkRes();
    await actionItemsHandler(
      {
        method: "PATCH",
        headers: { "x-admin-token": "admin-secret-token" },
        body: { kind: "lead", id: 1, status: "BOGUS" },
      },
      res as any,
    );
    check("invalid status rejected", out.code === 400, out.payload);
  }
  {
    const { res, out } = mkRes();
    await actionItemsHandler(
      {
        method: "PATCH",
        headers: { "x-admin-token": "admin-secret-token" },
        body: { kind: "elephant", id: 1, status: "NEW" },
      },
      res as any,
    );
    check("invalid kind rejected", out.code === 400, out.payload);
  }

  console.log("\n-- csv export --");
  {
    const csv = toCsvForTest(
      [{ name: 'Dana "D" Smith', note: "line1\nline2", email: "a,b@x.com" }],
      ["name", "note", "email"],
    );
    check("quotes are escaped", csv.includes('"Dana ""D"" Smith"'), csv);
    check("newlines are quoted", csv.includes('"line1\nline2"'), csv);
    check("commas are quoted", csv.includes('"a,b@x.com"'), csv);
    check("header row present", csv.startsWith("name,note,email"), csv);
  }

  console.log("\n-- health endpoint --");
  {
    const { res, out } = mkRes();
    await healthHandler({ method: "GET", headers: {} }, res as any);
    check("unauthenticated health proves /api is alive", out.payload.api === "ok", out.payload);
    check("unauthenticated health leaks no config",
      out.payload.env === undefined && out.payload.tables === undefined, out.payload);
  }
  {
    responder = () => ({ body: [] });
    const { res, out } = mkRes();
    await healthHandler(
      { method: "GET", headers: { "x-admin-token": "admin-secret-token" } },
      res as any,
    );
    check("authenticated health reports env presence as booleans",
      out.payload.env.SUPABASE_URL === true &&
        typeof out.payload.env.SUPABASE_SERVICE_ROLE_KEY === "boolean", out.payload.env);
    check("health never returns a secret value",
      !JSON.stringify(out.payload).includes("admin-secret-token"), out.payload);
    check("health checks the tables", out.payload.tables?.bots?.ok === true, out.payload.tables);
  }
  {
    // A rejected token must name its own cause rather than going quiet.
    const { res, out } = mkRes();
    await healthHandler(
      { method: "GET", headers: { "x-admin-token": "wrong-token" } },
      res as any,
    );
    check("rejected token reports the variable",
      out.payload.adminSource === "BOTFORGE_ADMIN_TOKEN", out.payload);
    check("rejected token compares lengths",
      out.payload.suppliedLength === 11 && out.payload.configuredLength === 18, out.payload);
    check("length mismatch is explained", /trailing newline/.test(out.payload.hint), out.payload.hint);
    check("rejected token still hides env and tables",
      out.payload.env === undefined && out.payload.tables === undefined, out.payload);
    check("rejected token never echoes a value",
      !JSON.stringify(out.payload).includes("admin-secret-token"), out.payload);
  }

  console.log("\n-- health distinguishes the three Supabase failures --");
  {
    const cases: [string, number, unknown, RegExp][] = [
      [
        "privilege error is not misread as a bad key",
        401,
        { code: "42501", message: "permission denied for table bots" },
        /0002_grants\.sql/,
      ],
      [
        "missing table points at the schema migration",
        404,
        { code: "PGRST205", message: 'relation "public.bots" does not exist' },
        /0001_botforge\.sql/,
      ],
      [
        "a genuinely bad key is reported as a bad key",
        401,
        { message: "Invalid authentication credentials" },
        /service_role \(secret\) key/,
      ],
    ];
    for (const [name, status, body, expected] of cases) {
      responder = () => ({ status, body });
      const { res, out } = mkRes();
      await healthHandler(
        { method: "GET", headers: { "x-admin-token": "admin-secret-token" } },
        res as any,
      );
      const detail = out.payload.tables?.bots?.detail ?? "";
      check(name, expected.test(detail), detail);
    }
    responder = () => ({ body: [] });
  }

  console.log("\n-- client error messages --");
  {
    // The failure the user actually hit: /api falls through to the SPA and
    // returns index.html, so the body is a web page rather than JSON.
    const err = await apiFetchForTest("/api/bots", "<!DOCTYPE html><html><body>app</body></html>", 200);
    check("HTML body names the cause", /web page instead of data/i.test(err), err);
    check("HTML body suggests vercel dev", /vercel dev/.test(err), err);
    check("HTML body no longer says 'unexpected response'",
      !/unexpected response/i.test(err), err);
  }
  {
    const err = await apiFetchForTest("/api/bots", "<!DOCTYPE html>", 404);
    check("404 HTML says the route isn't deployed", /isn't deployed/.test(err), err);
  }
  {
    const err = await apiFetchForTest("/api/bots", "not json at all", 200);
    check("non-JSON, non-HTML body is quoted back", /isn't JSON/.test(err), err);
  }
  {
    const err = await apiFetchForTest("/api/bots", JSON.stringify({ error: "Unauthorized" }), 401);
    check("JSON errors still pass through", err === "Unauthorized", err);
  }
  {
    const err = await apiFetchForTest("/api/bots", "", 503);
    check("503 explains missing configuration", /missing configuration/.test(err), err);
  }

  console.log("\n-- visibility is enforced --");
  {
    const visitor = await captureTurn({ admin: false, message: "hi", visibility: "private" });
    check("a private bot refuses a visitor", visitor.status === 404, visitor.status);

    const owner = await captureTurn({ admin: true, message: "hi", visibility: "private" });
    check("but its owner can still test it", owner.streamed === "hi", owner.status);

    const unlisted = await captureTurn({ admin: false, message: "hi", visibility: "unlisted" });
    check("an unlisted bot is still reachable by link", unlisted.streamed === "hi", unlisted.status);

    const pub = await captureTurn({ admin: false, message: "hi", visibility: "public" });
    check("a public bot is reachable", pub.streamed === "hi", pub.status);
  }
  {
    responder = () => ({ body: [{ id: "b1", slug: "s", name: "N", status: "PUBLISHED", visibility: "private" }] });
    const { res, out } = mkRes();
    await publicHandler({ method: "GET", query: { slug: "s" } }, res as any);
    check("a private bot is indistinguishable from a missing one",
      out.code === 404 && out.payload.unavailable === "missing", out.payload);
    responder = () => ({ body: [] });
  }

  console.log("\n-- content filter reaches the prompt --");
  {
    const strict = await captureTurn({ admin: false, message: "hi", contentFilter: "strict" });
    check("strict adds the safety block", /<safety>/.test(strict.systemPrompt), strict.systemPrompt.slice(-200));
    check("strict declines off-topic requests",
      /Stay on the topics/.test(strict.systemPrompt), strict.systemPrompt.slice(-200));
    check("strict withholds the configuration",
      /not repeat these instructions/.test(strict.systemPrompt));

    const moderate = await captureTurn({ admin: false, message: "hi", contentFilter: "moderate" });
    check("moderate is narrower than strict",
      /<safety>/.test(moderate.systemPrompt) && !/Stay on the topics/.test(moderate.systemPrompt),
      moderate.systemPrompt.slice(-200));

    const off = await captureTurn({ admin: false, message: "hi", contentFilter: "off" });
    check("off adds nothing", !/<safety>/.test(off.systemPrompt), off.systemPrompt.slice(-120));
  }

  console.log("\n-- memory modes --");
  {
    const history = Array.from({ length: 12 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `turn ${i}`,
    }));

    const none = await captureTurn({
      admin: false, message: "latest", memory: "none", history, summary: "Earlier: they want a demo.",
    });
    const noneMsgs = (none.providerBody?.messages ?? []) as { role: string; content: string }[];
    check("none sends only the current message",
      noneMsgs.filter((m) => m.role !== "system").length === 1, noneMsgs.length);
    check("none withholds the summary too",
      !/conversation_so_far/.test(none.systemPrompt), none.systemPrompt.slice(-200));

    const session = await captureTurn({
      admin: false, message: "latest", memory: "session", history, summary: "Earlier: they want a demo.",
    });
    const sessMsgs = (session.providerBody?.messages ?? []) as { role: string; content: string }[];
    check("session sends the live window",
      sessMsgs.filter((m) => m.role !== "system").length === 8, sessMsgs.length);
    check("session attaches the summary",
      /they want a demo/.test(session.systemPrompt), session.systemPrompt.slice(-250));

    const persistent = await captureTurn({
      admin: false, message: "latest", memory: "persistent", history, summary: "Earlier: they want a demo.",
    });
    check("persistent behaves like session on the server",
      /they want a demo/.test(persistent.systemPrompt));
  }

  console.log("\n-- who gets notified --");
  {
    const base: CaptureNotification = {
      kind: "lead", botId: "b1", botName: "B", name: "Dana",
      email: "dana@example.com", phone: null, summary: null,
      contextSnippet: "", sessionId: "s1", capturedAt: "2026-09-19T10:00:00Z",
    };
    check("a real lead with an email notifies", shouldNotify(base, false));
    check("a test capture never notifies", !shouldNotify(base, true));
    check("a lead with only a phone still notifies",
      shouldNotify({ ...base, email: null, phone: "+44 7700 900123" }, false));
    check("a lead with no way to reach anyone does not",
      !shouldNotify({ ...base, email: null, phone: null }, false));
    check("a meeting request notifies even without contact details",
      shouldNotify({ ...base, kind: "meeting", email: null, phone: null }, false));
  }

  console.log("\n-- an empty reply is explained, never blank --");
  {
    // The reported symptom: a reasoning model spends its whole budget thinking
    // and returns no text, which used to render as an empty bubble.
    const lengthStop =
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "length" }] })}\n\n` +
      "data: [DONE]\n\n";

    const reasoning = await captureTurn({
      admin: false, message: "hi", modelId: "gpt-5", frames: lengthStop,
    });
    check("no text produced", reasoning.streamed === "", reasoning.streamed);
    check("an error event explains it", Boolean(reasoning.streamError), reasoning.streamError);
    check("it names reasoning as the cause",
      /reasoning/i.test(reasoning.streamError ?? ""), reasoning.streamError);
    check("it says to raise Max tokens",
      /Max tokens/i.test(reasoning.streamError ?? ""), reasoning.streamError);

    const plain = await captureTurn({
      admin: false, message: "hi", modelId: "gpt-4o", frames: lengthStop,
    });
    check("a plain model gets the plain explanation",
      /Max tokens/i.test(plain.streamError ?? "") && !/reasoning/i.test(plain.streamError ?? ""),
      plain.streamError);

    const ok = await captureTurn({ admin: false, message: "hi", modelId: "gpt-4o" });
    check("a normal reply reports no error", ok.streamError === undefined, ok.streamError);
  }

  console.log("\n-- reasoning models get token headroom --");
  {
    const reasoning = await captureTurn({
      admin: false, message: "hi", modelId: "gpt-5", maxTokens: 100,
    });
    check("a tiny budget is raised to the floor",
      reasoning.providerBody?.max_completion_tokens === 4096, reasoning.providerBody);

    const big = await captureTurn({
      admin: false, message: "hi", modelId: "gpt-5", maxTokens: 20000,
    });
    check("a larger budget is left alone",
      big.providerBody?.max_completion_tokens === 20000, big.providerBody);

    const plain = await captureTurn({
      admin: false, message: "hi", modelId: "gpt-4o", maxTokens: 100,
    });
    check("a plain model keeps its configured budget",
      plain.providerBody?.max_tokens === 100, plain.providerBody);
  }

  console.log("\n-- usage is actually requested --");
  {
    const openai = await captureTurn({ admin: false, message: "hi", modelId: "gpt-4o" });
    check("stream_options.include_usage is sent to OpenAI-compatible providers",
      (openai.providerBody?.stream_options as { include_usage?: boolean })?.include_usage === true,
      openai.providerBody);

    const anthropic = await captureTurn({
      admin: false, message: "hi", providerId: "anthropic", modelId: "claude-sonnet-5",
    });
    check("and not to Anthropic, which reports usage natively",
      anthropic.providerBody?.stream_options === undefined, anthropic.providerBody);
  }

  console.log("\n-- only the live window is sent --");
  {
    const history = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `turn ${i}`,
    }));
    const r = await captureTurn({ admin: false, message: "latest", history, modelId: "gpt-4o" });
    const sent = (r.providerBody?.messages ?? []) as { role: string; content: string }[];
    const conversation = sent.filter((m) => m.role !== "system");

    check("the live window is capped at 8 turns", conversation.length === 8, conversation.length);
    check("the newest turn is included",
      conversation[conversation.length - 1]?.content === "latest", conversation.slice(-1));
    check("the oldest turns are dropped",
      !conversation.some((m) => m.content === "turn 0"), conversation.slice(0, 2));
    check("the whole history is not resent", conversation.length < history.length, conversation.length);
  }

  console.log("\n-- usage endpoint --");
  {
    const { res, out } = mkRes();
    await usageHandler({ method: "GET", headers: {} }, res as any);
    check("usage requires a token", out.code === 401, out.payload);
  }
  {
    responder = (c) =>
      c.url.startsWith("bots")
        ? { body: [{ id: "b1", name: "My Bot" }] }
        : { body: [
            { bot_id: "b1", provider_id: "openai", model_id: "gpt-4o",
              prompt_tokens: 100, completion_tokens: 20, created_at: "2026-09-18T10:00:00Z" },
            { bot_id: "b1", provider_id: "openai", model_id: "gpt-4o",
              prompt_tokens: 50, completion_tokens: 10, created_at: "2026-09-18T11:00:00Z" },
            { bot_id: "b1", provider_id: "openai", model_id: "gpt-4o",
              prompt_tokens: null, completion_tokens: null, created_at: "2026-09-17T11:00:00Z" },
          ] };
    const { res, out } = mkRes();
    await usageHandler(
      { method: "GET", headers: { "x-admin-token": "admin-secret-token" } },
      res as any,
    );
    check("input tokens are summed", out.payload.totals.promptTokens === 150, out.payload.totals);
    check("output tokens are summed", out.payload.totals.completionTokens === 30, out.payload.totals);
    check("rows without usage are counted separately",
      out.payload.totals.messages === 3 && out.payload.totals.messagesWithUsage === 2,
      out.payload.totals);
    check("grouped by bot with its name",
      out.payload.byBot[0].botName === "My Bot" && out.payload.byBot[0].promptTokens === 150,
      out.payload.byBot);
    check("grouped by model",
      out.payload.byModel[0].modelId === "gpt-4o", out.payload.byModel);
    check("grouped by day", out.payload.byDay.length === 2, out.payload.byDay);
    responder = () => ({ body: [] });
  }

  console.log("\n-- editor tests are captured, and flagged --");
  {
    // The regression: an admin request used to create no session at all, so
    // the editor's Live test panel captured nothing and said nothing.
    const admin = await captureTurn({ admin: true, message: "I'm Dana, dana@example.com" });
    check("an admin request creates a session", admin.sessionCreated, admin.calls);
    check("the session is flagged as a test", admin.sessionRow?.is_test === true, admin.sessionRow);
    check("a lead is captured from the editor", Boolean(admin.leadRow), admin.calls);
    check("the lead is flagged as a test", admin.leadRow?.is_test === true, admin.leadRow);
    check("the email reaches the lead row", admin.leadRow?.email === "dana@example.com", admin.leadRow);
    check("no capture error is reported", admin.captureError === undefined, admin.captureError);

    const visitor = await captureTurn({ admin: false, message: "I'm Dana, dana@example.com" });
    check("a visitor request is not flagged as a test", visitor.sessionRow?.is_test === false, visitor.sessionRow);
    check("the visitor lead is not flagged", visitor.leadRow?.is_test === false, visitor.leadRow);
  }

  console.log("\n-- capture failures are reported to the tester only --");
  {
    const admin = await captureTurn({
      admin: true,
      message: "dana@example.com",
      failLeads: "permission denied for table leads",
    });
    check("the stream still succeeds", admin.streamed === "hi", admin.streamed);
    check("an admin sees why the capture failed",
      /permission denied/.test(admin.captureError ?? ""), admin.captureError);

    const visitor = await captureTurn({
      admin: false,
      message: "dana@example.com",
      failLeads: "permission denied for table leads",
    });
    check("a visitor is never shown a capture error", visitor.captureError === undefined, visitor.captureError);
    check("and their stream still succeeds", visitor.streamed === "hi", visitor.streamed);
  }

  console.log("\n-- Action Items hides test captures by default --");
  {
    const seen: string[] = [];
    responder = (c) => {
      if (c.url.startsWith("leads") || c.url.startsWith("meeting_requests")) seen.push(c.url);
      return { body: [] };
    };
    const { res } = mkRes();
    await actionItemsHandler(
      { method: "GET", headers: { "x-admin-token": "admin-secret-token" } },
      res as any,
    );
    check("default query excludes test rows",
      seen.every((u) => u.includes("is_test=eq.false")), seen);

    seen.length = 0;
    const { res: res2 } = mkRes();
    await actionItemsHandler(
      { method: "GET", query: { includeTest: "1" }, headers: { "x-admin-token": "admin-secret-token" } },
      res2 as any,
    );
    check("includeTest=1 returns everything",
      seen.every((u) => !u.includes("is_test")), seen);
    responder = () => ({ body: [] });
  }

  console.log("\n-- OpenAI parameter shape --");
  {
    for (const model of ["gpt-5", "gpt-5-mini", "o3", "o3-mini", "o1"]) {
      const { sent } = await captureRequests("openai", model, [
        { status: 200, body: sseChunk("hi") },
      ]);
      const b = sent[0].body;
      // 512 is below the reasoning floor, so it is raised to 4096 on purpose.
      check(`openai/${model} sends max_completion_tokens`,
        b.max_completion_tokens === 4096 && b.max_tokens === undefined, b);
      check(`openai/${model} omits temperature and top_p`,
        b.temperature === undefined && b.top_p === undefined, b);
    }

    for (const model of ["gpt-4o", "gpt-4.1", "gpt-4-turbo"]) {
      const { sent } = await captureRequests("openai", model, [
        { status: 200, body: sseChunk("hi") },
      ]);
      const b = sent[0].body;
      check(`openai/${model} keeps max_tokens`,
        b.max_tokens === 512 && b.max_completion_tokens === undefined, b);
      check(`openai/${model} keeps sampling`,
        b.temperature === 0.4 && b.top_p === 0.9, b);
    }

    // The OpenAI rule must not leak: these providers expect max_tokens.
    for (const provider of ["groq", "mistral", "deepseek", "together", "xai", "openrouter"]) {
      const { sent } = await captureRequests(provider, "gpt-5-lookalike", [
        { status: 200, body: sseChunk("hi") },
      ]);
      const b = sent[0].body;
      check(`${provider} still gets max_tokens and sampling`,
        b.max_tokens === 512 && b.temperature === 0.4 && b.top_p === 0.9, b);
    }
  }

  console.log("\n-- self-healing retry --");
  {
    const rejection = JSON.stringify({
      error: {
        message:
          "Unsupported parameter: 'max_tokens' is not supported with this model. " +
          "Use 'max_completion_tokens' instead.",
      },
    });
    // A provider we deliberately do not special-case, so only the retry can save it.
    const { sent, text, error } = await captureRequests("groq", "some-future-model", [
      { status: 400, body: rejection },
      { status: 200, body: sseChunk("recovered") },
    ]);
    check("retries once after an unsupported-parameter 400", sent.length === 2, sent.length);
    check("retry renames to the suggested parameter",
      sent[1].body.max_completion_tokens === 512 && sent[1].body.max_tokens === undefined,
      sent[1].body);
    check("retry leaves other fields intact", sent[1].body.model === "some-future-model");
    check("the retried response still streams", text === "recovered", { text, error });
  }
  {
    const { sent, error } = await captureRequests("groq", "m", [
      { status: 400, body: JSON.stringify({ error: { message: "You exceeded your quota." } }) },
      { status: 200, body: sseChunk("should not happen") },
    ]);
    check("a 400 naming no parameter is not retried", sent.length === 1, sent.length);
    check("and its message is surfaced", /quota/.test(error ?? ""), error);
  }
  {
    const { sent } = await captureRequests("groq", "m", [
      { status: 400, body: JSON.stringify({ error: { message: "Unsupported parameter: 'seed'." } }) },
      { status: 200, body: sseChunk("ok") },
    ]);
    check("an unknown parameter we never sent is not retried", sent.length === 1, sent.length);
  }
  {
    const dropped = repairBody({ max_tokens: 1, model: "m" }, "Unsupported parameter: 'max_tokens'.");
    check("with no suggestion the parameter is dropped, not renamed",
      dropped !== null && dropped.max_tokens === undefined && dropped.model === "m", dropped);
  }

  console.log("\n-- server and client capability rules agree --");
  {
    let mismatched = 0;
    for (const provider of ["openai", "groq", "mistral", "anthropic", "together"]) {
      for (const model of ["gpt-5", "gpt-5-mini", "o1", "o3", "o4-mini", "gpt-4o", "gpt-4.1", "llama-3.3-70b"]) {
        const a = capabilitiesFor(provider, model);
        const b = clientCapabilitiesFor(provider, model);
        if (a.tokenParam !== b.tokenParam || a.sampling !== b.sampling) mismatched++;
      }
    }
    check("the editor and the server classify every combination identically", mismatched === 0, mismatched);
  }

  console.log("\n-- environment normalisation --");
  {
    const url = "https://x.supabase.co";
    check("strips wrapping double quotes", readEnvUrl(`"${url}"`) === url);
    check("strips wrapping single quotes", readEnvUrl(`'${url}'`) === url);
    check("strips a trailing newline", readEnvUrl(`${url}\n`) === url);
    check("strips a trailing slash", readEnvUrl(`${url}/`) === url);
    check("strips a /rest/v1 suffix", readEnvUrl(`${url}/rest/v1`) === url);
    check("strips /rest/v1/ with a slash", readEnvUrl(`${url}/rest/v1/`) === url);
    check("leaves a clean value alone", readEnvUrl(url) === url);
    check("handles undefined", readEnvUrl(undefined) === "");
    check("readEnv keeps inner characters", readEnv('  "sk-ant-a/b+c="  ') === "sk-ant-a/b+c=");

    // Pasting into a field that already holds a value appends rather than
    // replaces, which parses fine but resolves a host nobody typed.
    const doubled = `${url}${url}`;
    check("keeps only the first of two concatenated URLs", readEnvUrl(doubled) === url, readEnvUrl(doubled));
    check("keeps only the first of two space-separated URLs",
      readEnvUrl(`${url} ${url}`) === url, readEnvUrl(`${url} ${url}`));
    check("flags a repeated URL", hasRepeatedUrl(doubled));
    check("does not flag a single URL", !hasRepeatedUrl(url));
    check("does not flag a quoted single URL", !hasRepeatedUrl(`"${url}"`));
    check("a path is not mistaken for a second URL",
      readEnvUrl("https://x.supabase.co/some/path") === "https://x.supabase.co/some/path");
  }

  console.log("\n-- connection failures are explained --");
  {
    const invalidUrl = describeFetchFailure(
      Object.assign(new TypeError("Failed to parse URL from x"), {
        cause: { code: "ERR_INVALID_URL" },
      }),
      "x.supabase.co",
    );
    check("invalid URL names the https:// requirement", /https:\/\//.test(invalidUrl), invalidUrl);

    const dns = describeFetchFailure(
      Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } }),
      "https://gone.supabase.co",
    );
    check("DNS failure names the host", /gone\.supabase\.co/.test(dns), dns);
    check("DNS failure mentions a paused project", /paused/.test(dns), dns);
    check("DNS failure is not the bare undici message", dns !== "fetch failed", dns);

    const doubledHost = describeFetchFailure(
      Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } }),
      "https://glklfuuleyachujtajwn.supabase.cohttps",
    );
    check("a doubled URL is named as such, not called a typo",
      /two URLs run together/.test(doubledHost), doubledHost);

    const timeout = describeFetchFailure(
      Object.assign(new TypeError("fetch failed"), { cause: { code: "ETIMEDOUT" } }),
      "https://slow.supabase.co",
    );
    check("timeout is reported as a timeout", /Timed out/.test(timeout), timeout);
  }

  console.log("\n-- signal detection --");
  {
    const s1 = detectSignals("Hi, I'm Dana, reach me at dana@example.com");
    check("email detected", s1.email === "dana@example.com", s1);
    check("no phone false-positive from an email", s1.phone === null, s1);
    check("plain intro is not a booking", s1.booking === false, s1);

    const s2 = detectSignals("call me on +44 7700 900123");
    check("phone detected", s2.phone !== null, s2);

    const s3 = detectSignals("the price is 2024 dollars");
    check("a bare number is not a phone", s3.phone === null, s3);

    const s4 = detectSignals("Can we schedule a demo next Tuesday at 3pm?");
    check("booking needs intent + time", s4.booking === true, s4);

    const s5 = detectSignals("I'll see you tomorrow");
    check("a time word alone is not a booking", s5.booking === false, s5);

    const s6 = detectSignals("I'd like to book something");
    check("intent alone is not a booking", s6.booking === false, s6);

    const s7 = detectSignals("mail dana2024@example.com about the 9am slot");
    check("email digits are not read as a phone", s7.phone === null, s7);

    const snippet = buildContextSnippet([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi there" },
      { role: "user", content: "I am dana@example.com" },
    ]);
    check("snippet labels both speakers",
      snippet.includes("Visitor:") && snippet.includes("Bot:"), snippet);
    check("snippet keeps the latest turn", snippet.includes("dana@example.com"), snippet);

    const long = buildContextSnippet([{ role: "user", content: "x".repeat(2000) }], 100);
    check("snippet is truncated", long.length <= 100, long.length);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}
run();
