/**
 * Bot CRUD for the BotForge dashboard. Admin token required on every path.
 *
 * One flat file dispatching on method + ?id= rather than api/bots/[id].ts:
 * it matches the existing flat convention, and it lets the editor's
 * save-on-unmount use navigator.sendBeacon, which can only issue a POST and
 * cannot set headers -- hence the `op` field and the in-body token.
 */

import {
  sbSelect,
  sbSelectOne,
  sbInsert,
  sbUpdate,
  sbDelete,
  SupabaseError,
} from "./_lib/supabase";
import { isAdminToken, isAdminConfigured, ADMIN_HEADER } from "./_lib/auth";
import {
  rowToBot,
  botToRow,
  randomId,
  slugify,
  type BotRow,
} from "./_lib/bot";
import {
  applyCors,
  header,
  jsonBody,
  queryParam,
  type ApiRequest,
  type ApiResponse,
} from "./_lib/http";

const BOT_COLUMNS = "*";

async function uniqueSlug(name: string, ignoreId?: string): Promise<string> {
  const base = slugify(name);
  const rows = await sbSelect<{ slug: string; id: string }>(
    "bots",
    `select=slug,id&slug=like.${encodeURIComponent(base + "*")}`,
  );
  const taken = new Set(rows.filter((r) => r.id !== ignoreId).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  }
  return `${base}-${randomId(5)}`;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(res, "GET, POST, PATCH, DELETE");
  if (req.method === "OPTIONS") return res.status(200).json({ ok: true });

  if (!isAdminConfigured()) {
    return res
      .status(503)
      .json({ error: "BOTFORGE_ADMIN_TOKEN is not configured on the server" });
  }

  const body = jsonBody(req);
  // sendBeacon cannot set headers, so that one path carries the token in-body.
  const token = header(req, ADMIN_HEADER) || String(body.token || "");
  if (!isAdminToken(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    switch (req.method) {
      case "GET":
        return await handleGet(req, res);
      case "POST":
        return await handlePost(req, res, body);
      case "PATCH":
        return await handlePatch(req, res, body);
      case "DELETE":
        return await handleDelete(req, res);
      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (e) {
    const err = e as SupabaseError;
    const status = typeof err.status === "number" ? err.status : 500;
    return res.status(status).json({ error: err.message || "Request failed" });
  }
}

async function handleGet(req: ApiRequest, res: ApiResponse) {
  const id = queryParam(req, "id");

  if (id) {
    const row = await sbSelectOne<BotRow>("bots", `select=${BOT_COLUMNS}&id=eq.${id}`);
    if (!row) return res.status(404).json({ error: "Bot not found" });
    const knowledge = await sbSelect<Record<string, unknown>>(
      "knowledge_docs",
      `select=id,file_name,mime_type,char_count,content,added_at&bot_id=eq.${id}&order=added_at.asc`,
    );
    return res.status(200).json({ bot: { ...rowToBot(row), knowledge: knowledge.map(knowledgeToDoc) } });
  }

  const includeArchived = queryParam(req, "includeArchived") === "1";
  const filter = includeArchived ? "" : "&status=neq.ARCHIVED";
  const rows = await sbSelect<BotRow>(
    "bots",
    `select=${BOT_COLUMNS}${filter}&order=updated_at.desc`,
  );
  // List view never needs knowledge bodies -- they can be hundreds of KB each.
  return res.status(200).json({ bots: rows.map((r) => ({ ...rowToBot(r), knowledge: [] })) });
}

async function handlePost(req: ApiRequest, res: ApiResponse, body: Record<string, unknown>) {
  const op = String(body.op || "create");

  // sendBeacon autosave: POST carrying an update.
  if (op === "update") {
    const id = String(body.id || "");
    if (!id) return res.status(400).json({ error: "id is required" });
    return await applyPatch(res, id, (body.patch as Record<string, unknown>) || {});
  }

  // One-time migration of bots out of the browser's localStorage.
  if (op === "import") {
    const incoming = Array.isArray(body.bots) ? (body.bots as Record<string, unknown>[]) : [];
    const created: Record<string, unknown>[] = [];
    let skipped = 0;
    for (const bot of incoming) {
      const id = String(bot.id || "") || randomId();
      const existing = await sbSelectOne<{ id: string }>("bots", `select=id&id=eq.${id}`);
      if (existing) {
        skipped++;
        continue;
      }
      const row = botToRow(bot);
      row.id = id;
      row.slug = await uniqueSlug(String(bot.name || row.name || "bot"));
      const [inserted] = await sbInsert<BotRow>("bots", row);
      await replaceKnowledge(id, bot.knowledge);
      created.push(rowToBot(inserted));
    }
    return res.status(200).json({ imported: created.length, skipped, bots: created });
  }

  // Normal create.
  const row = botToRow(body);
  const id = randomId();
  row.id = id;
  row.slug = await uniqueSlug(String(body.name || row.name || "Untitled Bot"));
  const [inserted] = await sbInsert<BotRow>("bots", row);
  await replaceKnowledge(id, body.knowledge);
  return res.status(201).json({ bot: { ...rowToBot(inserted), knowledge: [] } });
}

async function handlePatch(req: ApiRequest, res: ApiResponse, body: Record<string, unknown>) {
  const id = queryParam(req, "id") || String(body.id || "");
  if (!id) return res.status(400).json({ error: "id is required" });
  const patch = (body.patch as Record<string, unknown>) ?? body;
  return await applyPatch(res, id, patch);
}

async function applyPatch(res: ApiResponse, id: string, patch: Record<string, unknown>) {
  const existing = await sbSelectOne<BotRow>("bots", `select=*&id=eq.${id}`);
  if (!existing) return res.status(404).json({ error: "Bot not found" });

  const row = botToRow(patch);

  // The slug is the public URL. Regenerating it on every rename would silently
  // break links people have already shared, so it is frozen once published.
  const renamed = typeof patch.name === "string" && patch.name !== existing.name;
  const everPublished = Boolean(existing.published_at);
  if (renamed && !everPublished && patch.slug === undefined) {
    row.slug = await uniqueSlug(String(patch.name), id);
  } else {
    delete row.slug;
  }

  if (Object.keys(row).length === 0) {
    return res.status(200).json({ bot: rowToBot(existing) });
  }

  const [updated] = await sbUpdate<BotRow>("bots", `id=eq.${id}`, row);

  if (patch.knowledge !== undefined) await replaceKnowledge(id, patch.knowledge);

  return res.status(200).json({ bot: rowToBot(updated ?? existing) });
}

async function handleDelete(req: ApiRequest, res: ApiResponse) {
  const id = queryParam(req, "id");
  if (!id) return res.status(400).json({ error: "id is required" });
  await sbDelete("bots", `id=eq.${id}`); // knowledge/sessions cascade
  return res.status(200).json({ ok: true });
}

type KnowledgeRow = {
  id: string;
  file_name: string;
  mime_type: string;
  char_count: number;
  content: string;
  added_at: string;
};

function knowledgeToDoc(r: Record<string, unknown>) {
  const row = r as unknown as KnowledgeRow;
  return {
    id: row.id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    charCount: row.char_count,
    content: row.content,
    addedAt: row.added_at,
  };
}

/**
 * Replaces a bot's knowledge documents wholesale.
 *
 * Only called when a patch actually contains `knowledge`, which is on upload or
 * removal -- the editor's diffed autosave omits it the rest of the time, so
 * document bodies are not re-posted on every keystroke.
 */
async function replaceKnowledge(botId: string, docs: unknown): Promise<void> {
  if (!Array.isArray(docs)) return;
  await sbDelete("knowledge_docs", `bot_id=eq.${botId}`);
  if (docs.length === 0) return;
  const rows = docs.map((d) => {
    const doc = d as Record<string, unknown>;
    const content = String(doc.content ?? "");
    return {
      id: String(doc.id || randomId(12)),
      bot_id: botId,
      file_name: String(doc.fileName || "document.txt"),
      mime_type: String(doc.mimeType || "text/plain"),
      char_count: Number(doc.charCount ?? content.length),
      content,
      added_at: String(doc.addedAt || new Date().toISOString()),
    };
  });
  await sbInsert("knowledge_docs", rows);
}
