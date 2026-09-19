/**
 * Provider API keys, stored on the server.
 *
 * These used to live in localStorage and were sent straight from the browser to
 * the provider. That is why an embedded bot never replied for a visitor -- they
 * had no key -- and it meant the key was readable by anything running on the
 * page. Keys now go to /api/provider-keys and come back only as masked hints.
 */

import type { ApiKeyMap } from "./types";
import { apiFetch } from "./api-client";

export type ProviderKeyInfo = { providerId: string; hint: string };

export async function listProviderKeys(): Promise<ProviderKeyInfo[]> {
  const { keys } = await apiFetch<{ keys: ProviderKeyInfo[] }>("/api/provider-keys");
  return keys ?? [];
}

export async function saveProviderKey(providerId: string, apiKey: string): Promise<void> {
  await apiFetch("/api/provider-keys", { method: "PUT", body: { providerId, apiKey } });
}

export async function deleteProviderKey(providerId: string): Promise<void> {
  await apiFetch(`/api/provider-keys?providerId=${encodeURIComponent(providerId)}`, {
    method: "DELETE",
  });
}

export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

// --- Legacy localStorage keys, read only so they can be offered for upload ---

const LEGACY_KEY = "botforge:apikeys:v1";

export function loadLegacyApiKeys(): ApiKeyMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as ApiKeyMap) : {};
  } catch {
    return {};
  }
}

export function clearLegacyApiKeys(): void {
  try {
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Nothing to do; the keys are simply left in place.
  }
}
