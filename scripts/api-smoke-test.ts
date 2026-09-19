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
      check(`openai/${model} sends max_completion_tokens`,
        b.max_completion_tokens === 512 && b.max_tokens === undefined, b);
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
