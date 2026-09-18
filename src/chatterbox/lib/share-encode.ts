import type { Bot, KnowledgeDoc } from "./types";

/**
 * Decoder for pre-server share links.
 *
 * Bots used to live only in the author's browser, so a share link had to carry
 * the entire configuration base64-encoded in its URL fragment. That produced
 * links of 30KB or more, could not be revoked once sent, exposed the system
 * prompt to anyone who decoded it, and still could not chat without a provider
 * key in the visitor's own browser.
 *
 * Bots are now served by slug, so nothing encodes this format any more. The
 * decoder stays so links already shared keep working.
 */
export function decodeBotFromShare(encoded: string): Partial<Bot> | null {
  try {
    let b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const m = JSON.parse(json) as Record<string, unknown>;
    if ((m as { v?: number }).v !== 1) return null;
    return {
      id: m.id as string,
      slug: m.sl as string,
      name: m.n as string,
      bio: (m.b as string) ?? "",
      description: (m.d as string) ?? "",
      avatarInitials: (m.ai as string) ?? "B",
      avatarUrl: m.au as string | undefined,
      themeColor: (m.tc as string) ?? "#0ea5e9",
      systemPrompt: (m.sp as string) ?? "",
      greeting: (m.g as string) ?? "",
      starterPrompts: (m.sP as string[]) ?? [],
      providerId: (m.p as string) ?? "anthropic",
      modelId: (m.m as string) ?? "claude-sonnet-5",
      temperature: (m.t as number) ?? 0.7,
      maxTokens: (m.mt as number) ?? 1024,
      topP: (m.tp as number) ?? 1,
      chatTheme: ((m.ct as string) ?? "default") as Bot["chatTheme"],
      knowledge: ((m.k as KnowledgeDoc[]) ?? []) as KnowledgeDoc[],
      status: "PUBLISHED",
      visibility: "unlisted",
      memory: "session",
      contentFilter: "moderate",
      tags: [],
      language: "en",
      allowedDomains: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
