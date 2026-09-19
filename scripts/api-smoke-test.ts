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
import { readEnv, readEnvUrl, describeFetchFailure } from "../api/_lib/env";
import actionItemsHandler from "../api/action-items";
import healthHandler from "../api/health";
import { apiFetchForTest } from "./api-client-helper";
import { toCsvForTest } from "./csv-helper";

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
