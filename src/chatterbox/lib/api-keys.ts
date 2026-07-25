import type { ApiKeyMap } from "./types";

const KEY = "botforge:apikeys:v1";

export function loadApiKeys(): ApiKeyMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as ApiKeyMap) : {};
  } catch {
    return {};
  }
}

export function saveApiKey(providerId: string, value: string) {
  const all = loadApiKeys();
  if (value) all[providerId] = value;
  else delete all[providerId];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch (e) {
    console.warn("[api-keys] save failed", e);
  }
}

export function clearApiKey(providerId: string) {
  saveApiKey(providerId, "");
}

export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  return key.slice(0, 4) + "•".repeat(Math.max(4, key.length - 8)) + key.slice(-4);
}
