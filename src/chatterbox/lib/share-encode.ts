import type { Bot, KnowledgeDoc } from "./types";

const SHARE_KNOWLEDGE_BUDGET = 16_000;

export function trimKnowledgeForShare(docs: KnowledgeDoc[] | undefined): KnowledgeDoc[] {
  if (!docs || docs.length === 0) return [];
  const out: KnowledgeDoc[] = [];
  let used = 0;
  for (const d of docs) {
    if (used + d.content.length > SHARE_KNOWLEDGE_BUDGET) break;
    out.push(d);
    used += d.content.length;
  }
  return out;
}

export function encodeBotForShare(bot: Bot): string {
  const minimal = {
    v: 1,
    id: bot.id,
    sl: bot.slug,
    n: bot.name,
    b: bot.bio,
    d: bot.description,
    ai: bot.avatarInitials,
    au: bot.avatarUrl,
    tc: bot.themeColor,
    sp: bot.systemPrompt,
    g: bot.greeting,
    sP: bot.starterPrompts,
    p: bot.providerId,
    m: bot.modelId,
    t: bot.temperature,
    mt: bot.maxTokens,
    tp: bot.topP,
    ct: bot.chatTheme,
    k: trimKnowledgeForShare(bot.knowledge),
  };
  const json = JSON.stringify(minimal);
  const utf8 = new TextEncoder().encode(json);
  let bin = "";
  for (let i = 0; i < utf8.length; i++) bin += String.fromCharCode(utf8[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

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
      modelId: (m.m as string) ?? "claude-haiku-4-5",
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
