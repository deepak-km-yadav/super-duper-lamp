/**
 * Mapping between the `bots` table (snake_case columns) and the Bot object the
 * frontend uses (camelCase fields, defined in src/chatterbox/lib/types.ts).
 *
 * Kept here rather than imported from src/ because the serverless functions
 * are built separately from the Vite bundle.
 */

export type BotRow = {
  id: string;
  slug: string;
  name: string;
  bio: string;
  description: string;
  avatar_url: string | null;
  avatar_initials: string;
  theme_color: string;
  system_prompt: string;
  greeting: string;
  starter_prompts: string[];
  provider_id: string;
  model_id: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  memory: string;
  chat_theme: string;
  visibility: string;
  status: string;
  content_filter: string;
  tags: string[];
  language: string;
  allowed_domains: string[];
  agent_enabled: boolean;
  agent_actions: string[];
  show_nav: boolean;
  show_branding: boolean;
  daily_message_cap: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

/** Columns safe to expose on the public chat endpoint. */
export const PUBLIC_BOT_COLUMNS =
  "id,slug,name,bio,description,avatar_url,avatar_initials,theme_color," +
  "greeting,starter_prompts,chat_theme,tags,language,memory,status,visibility," +
  "show_nav,show_branding";

const ROW_TO_BOT: Record<string, string> = {
  avatar_url: "avatarUrl",
  avatar_initials: "avatarInitials",
  theme_color: "themeColor",
  system_prompt: "systemPrompt",
  starter_prompts: "starterPrompts",
  provider_id: "providerId",
  model_id: "modelId",
  max_tokens: "maxTokens",
  top_p: "topP",
  chat_theme: "chatTheme",
  content_filter: "contentFilter",
  allowed_domains: "allowedDomains",
  agent_enabled: "agentEnabled",
  agent_actions: "agentActions",
  show_nav: "showNav",
  show_branding: "showBranding",
  notify_email: "notifyEmail",
  notify_webhook_url: "notifyWebhookUrl",
  daily_message_cap: "dailyMessageCap",
  created_at: "createdAt",
  updated_at: "updatedAt",
  published_at: "publishedAt",
};

const BOT_TO_ROW: Record<string, string> = Object.fromEntries(
  Object.entries(ROW_TO_BOT).map(([row, bot]) => [bot, row]),
);

/** Fields the client may never set directly. */
const READ_ONLY_FIELDS = new Set(["id", "createdAt", "updatedAt", "knowledge"]);

export function rowToBot(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[ROW_TO_BOT[k] ?? k] = v === null && k === "avatar_url" ? undefined : v;
  }
  return out;
}

const KNOWN_COLUMNS = new Set([
  "slug", "name", "bio", "description", "avatar_url", "avatar_initials",
  "theme_color", "system_prompt", "greeting", "starter_prompts", "provider_id",
  "model_id", "temperature", "max_tokens", "top_p", "memory", "chat_theme",
  "visibility", "status", "content_filter", "tags", "language",
  "allowed_domains", "agent_enabled", "agent_actions", "daily_message_cap",
  "show_nav", "show_branding",
  "notify_email", "notify_webhook_url", "published_at",
]);

/**
 * Convert a partial Bot patch into table columns, dropping anything that is not
 * a known column so a client cannot write arbitrary fields.
 */
export function botToRow(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (READ_ONLY_FIELDS.has(k)) continue;
    const col = BOT_TO_ROW[k] ?? k;
    if (!KNOWN_COLUMNS.has(col)) continue;
    out[col] = v;
  }
  return out;
}


const SLUG_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function randomId(length = 10): string {
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  return out;
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "bot"
  );
}
