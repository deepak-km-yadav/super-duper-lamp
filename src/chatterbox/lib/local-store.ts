import { customAlphabet } from "nanoid";
import type { Bot } from "./types";
import { initialsFromName } from "./utils";

const KEY = "botforge:bots:v1";
const slugId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

export const LOCAL_DEFAULTS: Omit<Bot, "id" | "slug" | "createdAt" | "updatedAt"> = {
  name: "Untitled Bot",
  bio: "",
  description: "",
  avatarUrl: undefined,
  avatarInitials: "B",
  themeColor: "#0ea5e9",
  systemPrompt: "You are a helpful, concise assistant.",
  greeting: "Hi! How can I help you today?",
  starterPrompts: [],
  providerId: "anthropic",
  modelId: "claude-haiku-4-5",
  temperature: 0.7,
  maxTokens: 1024,
  topP: 1,
  memory: "session",
  chatTheme: "default",
  visibility: "unlisted",
  status: "DRAFT",
  contentFilter: "moderate",
  tags: [],
  language: "en",
  allowedDomains: [],
  knowledge: [],
};

function withDefaults(b: Bot): Bot {
  return { ...LOCAL_DEFAULTS, ...b } as Bot;
}

function safeWindow(): Window | null {
  return typeof window !== "undefined" ? window : null;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "bot"
  );
}

export function loadAll(): Bot[] {
  const w = safeWindow();
  if (!w) return [];
  try {
    const raw = w.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Bot[];
    return Array.isArray(arr) ? arr.map(withDefaults) : [];
  } catch {
    return [];
  }
}

function saveAll(bots: Bot[]) {
  const w = safeWindow();
  if (!w) return;
  try {
    w.localStorage.setItem(KEY, JSON.stringify(bots));
  } catch (e) {
    console.warn("[local-store] save failed", e);
  }
}

export function listLocal(): Bot[] {
  return loadAll()
    .filter((b) => b.status !== "ARCHIVED")
    .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
}

export function getLocal(id: string): Bot | null {
  return loadAll().find((b) => b.id === id) ?? null;
}

export function uniqueSlugLocal(name: string, ignoreId?: string): string {
  const base = slugify(name);
  const taken = new Set(loadAll().filter((b) => b.id !== ignoreId).map((b) => b.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${slugId().slice(0, 5)}`;
}

export function createLocal(input: Partial<Bot>): Bot {
  const now = new Date().toISOString();
  const name = input.name?.trim() || LOCAL_DEFAULTS.name;
  const initials = initialsFromName(name);
  const bot: Bot = {
    ...LOCAL_DEFAULTS,
    ...input,
    name,
    avatarInitials: input.avatarInitials ?? initials,
    id: slugId(),
    slug: uniqueSlugLocal(name),
    createdAt: now,
    updatedAt: now,
  };
  const all = loadAll();
  all.push(bot);
  saveAll(all);
  return bot;
}

export function updateLocal(id: string, patch: Partial<Bot>): Bot | null {
  const all = loadAll();
  const idx = all.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  const existing = all[idx];

  let slug = existing.slug;
  if (patch.name && patch.name !== existing.name && !patch.slug) {
    slug = uniqueSlugLocal(patch.name, id);
  }

  const updated: Bot = {
    ...existing,
    ...patch,
    id: existing.id,
    slug,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = updated;
  saveAll(all);
  return updated;
}

export function removeLocal(id: string): boolean {
  const all = loadAll();
  const next = all.filter((b) => b.id !== id);
  if (next.length === all.length) return false;
  saveAll(next);
  return true;
}

export function setLocalStatus(
  id: string,
  status: Bot["status"],
  publishedAt?: string,
): Bot | null {
  return updateLocal(id, {
    status,
    ...(publishedAt ? { publishedAt } : {}),
  });
}
