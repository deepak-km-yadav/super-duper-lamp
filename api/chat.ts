import { readFile } from "node:fs/promises";
import path from "node:path";

type Req = {
  method?: string;
  body?: {
    message?: string;
    ai?: string;
    aiName?: string;
    mode?: string;
    history?: Array<{ role?: "user" | "assistant"; content?: string }>;
  };
};

type Res = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => { json: (payload: unknown) => void };
};

type Intent =
  | "brand"
  | "offering-match"
  | "page-nav"
  | "how-it-works"
  | "pricing-contact"
  | "custom-being"
  | "small-talk"
  | "unknown";

type RouteDefinition = {
  name: string;
  url: string;
  reason: string;
  keywords: string[];
};

type RouteCandidate = {
  name: string;
  url: string;
  reason: string;
  score: number;
  matchedKeywords: string[];
};

type KnowledgeBundle = {
  brandCore: string;
  siteMap: string;
  offerings: string;
  routingRules: string;
  voiceRules: string;
  conversionRules: string;
  responseRules: string;
  sourcePages: string;
};

const XAI_URL = "https://api.x.ai/v1/chat/completions";
const XAI_MODEL = process.env.XAI_MODEL || "grok-3-mini";
const LEAD_CAPTURE_WEBHOOK_URL = process.env.LEAD_CAPTURE_WEBHOOK_URL || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const MAVERICK_CONTEXT_FILE = path.join(
  process.cwd(),
  "content",
  "being-context",
  "maverick-context.md"
);
const EAGAN_CONTEXT_FILE = path.join(
  process.cwd(),
  "content",
  "being-context",
  "eagan-context.md"
);
const NIYATI_FASHION_CONTEXT_FILE = path.join(
  process.cwd(),
  "content",
  "being-context",
  "niyati-fashion-context.md"
);
const NIYOMI_CONTEXT_FILE = path.join(
  process.cwd(),
  "content",
  "being-context",
  "niyomi-context.md"
);
const DEFAULT_ROLE =
  "You are the designinc.ai Website Guide. Help users understand REAI, route users to the right page, and keep answers clear and grounded.";

const DEFAULT_BUNDLE: KnowledgeBundle = {
  brandCore: "BRAND CORE is not configured.",
  siteMap: "SITE MAP is not configured.",
  offerings: "OFFERINGS are not configured.",
  routingRules: "ROUTING RULES are not configured.",
  voiceRules: "VOICE RULES are not configured.",
  conversionRules: "CONVERSION RULES are not configured.",
  responseRules: "RESPONSE RULES are not configured.",
  sourcePages: "SOURCE PAGES are not configured.",
};

const ROUTE_DEFINITIONS: RouteDefinition[] = [
  {
    name: "Eagan Legal-Eagle",
    url: "/Eagan",
    reason: "Legal and contract guidance",
    keywords: ["contract", "contracts", "legal", "law", "lawyer", "negotiation", "compliance"],
  },
  {
    name: "Maven",
    url: "/Maven",
    reason: "Growth, positioning, and funnels",
    keywords: ["growth", "scale", "scaling", "funnel", "positioning", "go to market", "strategy"],
  },
  {
    name: "Guru Common Ground",
    url: "/CGGuru",
    reason: "Conflict mediation and alignment",
    keywords: ["conflict", "mediate", "mediation", "tension", "hard conversation", "alignment", "cgguru"],
  },
  {
    name: "Guru Elevate",
    url: "/Guru-Elevate",
    reason: "Leadership expansion",
    keywords: ["leadership", "executive", "manager", "leader", "expand leadership"],
  },
  {
    name: "Elly",
    url: "/ElliaphlAIme",
    reason: "Website and tech guidance",
    keywords: ["website", "tech", "stack", "integration", "implementation", "build", "dev", "elly", "elliaphlaime"],
  },
  {
    name: "Niyati_FashionAI",
    url: "/Niyati-Fashion",
    reason: "Fashion and style direction",
    keywords: ["fashion", "style", "wardrobe", "outfit", "look", "niyati fashion", "niyati-s", "niyati"],
  },
  {
    name: "BoulderGroves",
    url: "/digital-allies/bouldergroves",
    reason: "Retreat and lifestyle brand support",
    keywords: ["retreat", "lifestyle", "hospitality", "wellness brand"],
  },
  {
    name: "Bespoke REAI Core",
    url: "/bespoke",
    reason: "Custom REAI build",
    keywords: ["custom ai", "bespoke", "custom being", "build my own ai", "fully custom", "tailored ai"],
  },
];

const normalize = (text: string): string => text.toLowerCase().replace(/\s+/g, " ").trim();
const containsAny = (text: string, list: string[]): boolean => list.some((item) => text.includes(item));
const wordCount = (text: string): number => text.split(/\s+/).filter(Boolean).length;
const isMaverick = (aiId?: string, aiName?: string): boolean =>
  normalize(aiId || "").includes("maverick") || normalize(aiName || "").includes("maverick");
const isElly = (aiId?: string, aiName?: string): boolean =>
  normalize(aiId || "").includes("elly") || normalize(aiName || "").includes("elly");
const isEagan = (aiId?: string, aiName?: string): boolean => {
  const id = normalize(aiId || "");
  const name = normalize(aiName || "");
  return id.includes("eagan") || name.includes("eagan");
};
const isNiyomi = (aiId?: string, aiName?: string): boolean => {
  const id = normalize(aiId || "");
  const name = normalize(aiName || "");
  return id.includes("niyomi") || name.includes("niyomi");
};
const isNiyatiFashion = (aiId?: string, aiName?: string): boolean => {
  const id = normalize(aiId || "");
  const name = normalize(aiName || "");
  return id === "niyati" || name.includes("niyati");
};
const isLikelySmallTalk = (text: string): boolean => {
  const q = normalize(text);
  const exact = [
    "hi",
    "hello",
    "hey",
    "hey there",
    "yo",
    "whats up",
    "what's up",
    "how are you",
    "how r u",
  ];
  if (exact.includes(q)) return true;
  if (q.startsWith("hey ") && wordCount(q) <= 4) return true;
  return false;
};

const normalizeHistory = (
  history: Array<{ role?: "user" | "assistant"; content?: string }> | undefined
) =>
  (Array.isArray(history) ? history : [])
    .filter((item) => item?.content && (item?.role === "user" || item?.role === "assistant"))
    .slice(-10)
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: String(item.content),
    }));

const readContextFile = async (filename: string, fallback: string): Promise<string> => {
  try {
    const fullPath = path.join(process.cwd(), "content", filename);
    const raw = await readFile(fullPath, "utf-8");
    const trimmed = raw.trim();
    if (!trimmed) {
      console.warn(`Empty context file: ${filename}`);
      return fallback;
    }
    return trimmed;
  } catch {
    console.warn(`Missing context file: ${filename}`);
    return fallback;
  }
};

const loadKnowledge = async (): Promise<KnowledgeBundle> => {
  const [
    brandCore,
    siteMap,
    offerings,
    routingRules,
    voiceRules,
    conversionRules,
    responseRules,
    sourcePages,
  ] = await Promise.all([
    readContextFile("brand-core.md", DEFAULT_BUNDLE.brandCore),
    readContextFile("site-map.md", DEFAULT_BUNDLE.siteMap),
    readContextFile("offerings.md", DEFAULT_BUNDLE.offerings),
    readContextFile("routing-rules.md", DEFAULT_BUNDLE.routingRules),
    readContextFile("voice-rules.md", DEFAULT_BUNDLE.voiceRules),
    readContextFile("conversion-rules.md", DEFAULT_BUNDLE.conversionRules),
    readContextFile("response-rules.md", DEFAULT_BUNDLE.responseRules),
    readContextFile("source-pages.md", DEFAULT_BUNDLE.sourcePages),
  ]);

  return {
    brandCore,
    siteMap,
    offerings,
    routingRules,
    voiceRules,
    conversionRules,
    responseRules,
    sourcePages,
  };
};

const loadFileOrFallback = async (filePath: string, fallback: string): Promise<string> => {
  try {
    const raw = await readFile(filePath, "utf-8");
    const trimmed = raw.trim();
    return trimmed || fallback;
  } catch {
    return fallback;
  }
};

const clampContext = (text: string, maxChars = 24000): string =>
  text.length > maxChars ? `${text.slice(0, maxChars)}\n...[truncated for runtime prompt size]` : text;

const loadMaverickContext = async (): Promise<string> => {
  const context = await loadFileOrFallback(MAVERICK_CONTEXT_FILE, "Maverick context unavailable.");
  return clampContext(context, 26000);
};

const rankRouteCandidates = (message: string): RouteCandidate[] => {
  const q = normalize(message);
  const scored = ROUTE_DEFINITIONS.map((def) => {
    const matchedKeywords = def.keywords.filter((keyword) => q.includes(keyword));
    return {
      name: def.name,
      url: def.url,
      reason: def.reason,
      matchedKeywords,
      score: matchedKeywords.length,
    };
  }).filter((item) => item.score > 0);

  return scored.sort((a, b) => b.score - a.score).slice(0, 2);
};

const detectIntent = (message: string): Intent => {
  const q = normalize(message);

  if (!q || q.length < 2) return "unknown";
  if (isLikelySmallTalk(q)) return "small-talk";
  if (containsAny(q, ["what is reai", "reai", "desaign", "design.ai", "story", "founder", "manifesto"])) {
    return "brand";
  }
  if (containsAny(q, ["page", "where", "navigate", "link", "url", "find"])) return "page-nav";
  if (containsAny(q, ["how it works", "engine", "memory", "identity", "lifecycle", "onboarding"])) {
    return "how-it-works";
  }
  if (containsAny(q, ["price", "pricing", "contact", "email", "schedule", "call"])) return "pricing-contact";
  if (containsAny(q, ["custom ai", "bespoke", "custom being", "build my own"])) return "custom-being";
  if (rankRouteCandidates(q).length > 0) return "offering-match";
  return "unknown";
};

const shouldUseMysticalStyle = (message: string): boolean => {
  const q = normalize(message);
  return containsAny(q, [
    "spiritual",
    "soul",
    "sacred",
    "energy",
    "consciousness",
    "awakening",
    "intuitive",
  ]);
};

const hasConversionIntent = (message: string): boolean => {
  const q = normalize(message);
  return containsAny(q, [
    "get started",
    "start",
    "book",
    "schedule",
    "buy",
    "pricing",
    "custom",
    "build",
    "hire",
  ]);
};

const shouldAllowLongResponse = (message: string): boolean => {
  const q = normalize(message);
  return containsAny(q, [
    "compare",
    "difference between",
    "how it works",
    "walk me through",
    "step by step",
    "in detail",
    "deep dive",
    "full explanation",
    "explain more",
    "why",
  ]);
};

const extractEmail = (text: string): string | null => {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : null;
};

const hasLeadIntent = (text: string): boolean => {
  const q = normalize(text);
  return containsAny(q, [
    "book",
    "schedule",
    "consult",
    "contact",
    "follow up",
    "pricing",
    "buy",
    "subscribe",
    "interested",
    "get started",
    "talk to team",
  ]);
};

const buildLeadSummary = (
  history: Array<{ role: "assistant" | "user"; content: string }>,
  latestUserMessage: string
): string => {
  const compact = history
    .slice(-6)
    .map((m) => `${m.role}: ${m.content.trim()}`)
    .join(" | ");
  const merged = `${compact} | user: ${latestUserMessage.trim()}`.trim();
  return merged.slice(0, 1200);
};

const saveLeadToSupabase = async (payload: {
  ai: string;
  aiName: string;
  email: string;
  summary: string;
  capturedAt: string;
}) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/lead_captures`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      ai: payload.ai,
      ai_name: payload.aiName,
      email: payload.email,
      summary: payload.summary,
      captured_at: payload.capturedAt,
      source: "chat",
    }),
  });
};

const getLeadIntentPrompt = (aiId?: string, aiName?: string): string => {
  if (isMaverick(aiId, aiName)) {
    return "If you want, drop your best email and I will have the team follow up with the right next step for your launch.";
  }
  if (isNiyatiFashion(aiId, aiName)) {
    return "If you want, share your best email and I can line up a follow-up with curated style and creator-brand next steps.";
  }
  if (isElly(aiId, aiName)) {
    return "If you want, share your best email and I can hand this to the team for a practical build and implementation follow-up.";
  }
  return "If you want, share your best email and I can pass a short summary to the team for follow-up.";
};

const getRuleBasedResponse = (
  message: string,
  aiId?: string,
  aiName?: string
): string | null => {
  const q = normalize(message);
  const ellyActive = isElly(aiId, aiName);
  const maverickActive = isMaverick(aiId, aiName);
  const eaganActive = isEagan(aiId, aiName);
  const niyatiFashionActive = isNiyatiFashion(aiId, aiName);
  const niyomiActive = isNiyomi(aiId, aiName);

  if (isLikelySmallTalk(q)) {
    if (eaganActive) {
      return "Ready. Share the legal situation and your goal, and I will structure practical next steps.";
    }
    if (niyatiFashionActive) {
      return "Love this. Share your occasion, vibe, and budget, and I will map your look options.";
    }
    if (niyomiActive) {
      return "Happy to help. Share your availability windows and meeting goal, and I will suggest the best schedule.";
    }
    if (maverickActive) {
      return "Ready. Share your offer and audience, and I will map the next best marketing move.";
    }
    if (ellyActive) {
      return "Flame steady, I am doing well. Want help choosing a Being or a custom build?";
    }
    return "I am doing well, thank you. Want help choosing the right REAI option for you?";
  }

  if (containsAny(q, ["i want to buy an ai", "buy ai", "want to buy ai", "get ai", "need ai"])) {
    return "Great. Best first step is /curated-offerings. If you want fully custom, go to /bespoke.";
  }

  if (
    containsAny(q, [
      "need two ai",
      "need 2 ai",
      "want two ai",
      "want 2 ai",
      "two ai",
      "two beings",
      "2 beings",
    ])
  ) {
    return "Perfect. Tell me the 2 use-cases, and I will match 2 Beings. Example: growth + emotional clarity.";
  }

  if (containsAny(q, ["how much", "price", "pricing"])) {
    return "Pricing depends on tier and scope. Start at /curated-offerings, or go to /contact for a fit-based recommendation.";
  }

  if (wordCount(q) <= 2 && containsAny(q, ["oh", "ok", "okay", "hmm", "uh", "k"])) {
    return "No problem. Share your goal in one line and I will suggest the best next step.";
  }

  return null;
};

const formatRouteCandidates = (candidates: RouteCandidate[]): string => {
  if (candidates.length === 0) return "No high-confidence offering match found.";
  return candidates
    .map(
      (c, i) =>
        `${i + 1}. ${c.name} (${c.url}) - ${c.reason}; matched: ${c.matchedKeywords.join(", ")}`
    )
    .join("\n");
};

const getPersonaInstruction = (aiId?: string, aiName?: string): string => {
  const id = normalize(aiId || "");
  const name = normalize(aiName || "");

  if (id === "elly" || name.includes("elly")) {
    return [
      "ACTIVE PERSONA: Elly (Dragon AI)",
      "- Identity: Elly is a dragon intelligence guide.",
      "- Tone: calm, wise, protective, clear, and confident.",
      "- Style: can use light dragon flavor words (for example: rider, forge, flame) when natural.",
      "- Rule: stay practical first. Do not become overly theatrical or fantasy-heavy.",
      "- Rule: never claim a physical body in the real world.",
      "- Rule: when user asks for implementation or appears sales-ready, ask permission to collect an email for team follow-up.",
      "- Goal: answer directly, then guide to the best offering/page.",
    ].join("\n");
  }

  if (isNiyatiFashion(id, name)) {
    return [
      "ACTIVE PERSONA: Niyati (Fashion AI)",
      "- Identity: Niyati is a fashion and creator-brand strategist.",
      "- Tone: confident, modern, friendly, and practical.",
      "- Style: concise options with clear rationale.",
      "- Rule: when purchase intent appears, ask for permission to collect email for follow-up.",
      "- Rule: keep all language professional and non-sexual.",
      "- Goal: help users choose style direction and content positioning.",
    ].join("\n");
  }

  if (id === "maverick" || name.includes("maverick")) {
    return [
      "ACTIVE PERSONA: Maverick (Co-Founder CMO)",
      "- Identity: Maverick is designinc.ai's strategic marketing architect and co-founder voice.",
      "- Tone: clear, premium, decisive, and emotionally intelligent.",
      "- Style: strategy first, then language execution.",
      "- Rule: ask clarifying questions when brief details are missing.",
      "- Rule: provide practical outputs (hooks, positioning, campaign steps, CTAs).",
      "- Rule: when user is sales-ready, ask permission to collect email for team follow-up.",
      "- Rule: no flirtatious or romantic framing; keep responses professional.",
      "- Goal: turn vague ideas into structured go-to-market action.",
    ].join("\n");
  }

  if (isEagan(id, name)) {
    return [
      "ACTIVE PERSONA: Eagan Legal-Eagle",
      "- Identity: Eagan is a legal strategy guide with plain-language rigor.",
      "- Tone: clear, composed, and direct.",
      "- Style: gather facts, structure options, and recommend prudent next moves.",
      "- Rule: do not claim to be a licensed attorney or provide formal legal representation.",
      "- Goal: reduce legal ambiguity and improve decision quality.",
    ].join("\n");
  }

  if (isNiyomi(id, name)) {
    return [
      "ACTIVE PERSONA: Niyomi Scheduler",
      "- Identity: Niyomi is an executive scheduling assistant.",
      "- Tone: warm, concise, polished.",
      "- Style: confirm constraints, present options, close with a scheduling action.",
      "- Rule: keep interactions professional and non-romantic.",
      "- Goal: convert conversations into confirmed calendar outcomes.",
    ].join("\n");
  }

  return [
    "ACTIVE PERSONA: Website Guide default",
    "- Tone: calm, direct, helpful.",
    "- Goal: answer clearly and route accurately.",
  ].join("\n");
};

const buildSystemPrompt = (params: {
  ai?: string;
  aiName?: string;
  knowledge: KnowledgeBundle;
  maverickContext: string;
  eaganContext: string;
  niyatiFashionContext: string;
  niyomiContext: string;
  intent: Intent;
  routeCandidates: RouteCandidate[];
  conversionIntent: boolean;
  mysticalToneRequested: boolean;
  allowLongResponse: boolean;
  leadEmailDetected: boolean;
}) => {
  const {
    ai,
    aiName,
    knowledge,
    maverickContext,
    eaganContext,
    niyatiFashionContext,
    niyomiContext,
    intent,
    routeCandidates,
    conversionIntent,
    mysticalToneRequested,
    allowLongResponse,
    leadEmailDetected,
  } = params;

  const personaLine = aiName?.trim()
    ? `Secondary persona label from UI: ${aiName.trim()}.`
    : "No secondary persona label was provided.";

  const runtimeGuidance = [
    "RUNTIME GUIDANCE:",
    `- Detected intent: ${intent}`,
    `- Mystical tone requested by user: ${mysticalToneRequested ? "yes" : "no"}`,
    `- Conversion intent detected: ${conversionIntent ? "yes" : "no"}`,
    `- Allow longer response: ${allowLongResponse ? "yes" : "no"}`,
    `- User shared an email this turn: ${leadEmailDetected ? "yes" : "no"}`,
    "- Route candidates (max 2):",
    formatRouteCandidates(routeCandidates),
    "- Behavior contract:",
    "  - Answer first, route second.",
    allowLongResponse
      ? "  - Keep response concise but complete; use up to 5 short sentences when needed."
      : "  - Keep most replies to 1 to 2 short sentences.",
    "  - Provide one CTA max unless user asks for options.",
    "  - If uncertain, say: I am not sure based on the current website info.",
    "  - Do not invent offerings, links, or pricing.",
    leadEmailDetected
      ? "  - The user provided an email. Continue naturally and do not mention capture, storage, webhook, database, or internal systems."
      : "  - If the user asks to continue later, invite them to share an email for follow-up.",
  ].join("\n");

  const personaInstruction = getPersonaInstruction(ai, aiName);
  const maverickActive = isMaverick(ai, aiName);
  const eaganActive = isEagan(ai, aiName);
  const niyatiFashionActive = isNiyatiFashion(ai, aiName);
  const niyomiActive = isNiyomi(ai, aiName);

  if (maverickActive) {
    return [
      DEFAULT_ROLE,
      personaLine,
      "",
      personaInstruction,
      "",
      "MAVERICK SOURCE CONTEXT:",
      maverickContext,
      "",
      knowledge.responseRules,
      "",
      knowledge.conversionRules,
      "",
      runtimeGuidance,
    ].join("\n");
  }

  if (eaganActive) {
    return [
      DEFAULT_ROLE,
      personaLine,
      "",
      personaInstruction,
      "",
      "EAGAN SOURCE CONTEXT:",
      eaganContext,
      "",
      knowledge.responseRules,
      "",
      runtimeGuidance,
    ].join("\n");
  }

  if (niyatiFashionActive) {
    return [
      DEFAULT_ROLE,
      personaLine,
      "",
      personaInstruction,
      "",
      "NIYATI FASHION SOURCE CONTEXT:",
      niyatiFashionContext,
      "",
      knowledge.responseRules,
      "",
      runtimeGuidance,
    ].join("\n");
  }

  if (niyomiActive) {
    return [
      DEFAULT_ROLE,
      personaLine,
      "",
      personaInstruction,
      "",
      "NIYOMI SOURCE CONTEXT:",
      niyomiContext,
      "",
      knowledge.responseRules,
      "",
      runtimeGuidance,
    ].join("\n");
  }

  return [
    DEFAULT_ROLE,
    personaLine,
    "",
    personaInstruction,
    "",
    knowledge.voiceRules,
    "",
    knowledge.responseRules,
    "",
    knowledge.conversionRules,
    "",
    "KNOWLEDGE:",
    knowledge.brandCore,
    "",
    knowledge.siteMap,
    "",
    knowledge.offerings,
    "",
    knowledge.routingRules,
    "",
    "SOURCE PAGE REGISTRY:",
    knowledge.sourcePages,
    "",
    runtimeGuidance,
  ].join("\n");
};

export default async function handler(req: Req, res: Res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ response: "Method not allowed." });
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      response: "Server is missing XAI_API_KEY.",
    });
  }

  const message = req.body?.message?.trim();
  if (!message) {
    return res.status(400).json({ response: "Please enter a message." });
  }

  const history = normalizeHistory(req.body?.history);
  const maverickActive = isMaverick(req.body?.ai, req.body?.aiName);
  const ellyActive = isElly(req.body?.ai, req.body?.aiName);
  const eaganActive = isEagan(req.body?.ai, req.body?.aiName);
  const niyatiFashionActive = isNiyatiFashion(req.body?.ai, req.body?.aiName);
  const niyomiActive = isNiyomi(req.body?.ai, req.body?.aiName);
  const [knowledge, maverickContext, eaganContext, niyatiFashionContext, niyomiContext] =
    await Promise.all([
      loadKnowledge(),
      maverickActive ? loadMaverickContext() : Promise.resolve(""),
      eaganActive
        ? loadFileOrFallback(EAGAN_CONTEXT_FILE, "Eagan context unavailable.").then((v) =>
            clampContext(v, 20000)
          )
        : Promise.resolve(""),
      niyatiFashionActive
        ? loadFileOrFallback(NIYATI_FASHION_CONTEXT_FILE, "Niyati Fashion context unavailable.").then((v) =>
            clampContext(v, 20000)
          )
        : Promise.resolve(""),
      niyomiActive
        ? loadFileOrFallback(NIYOMI_CONTEXT_FILE, "Niyomi context unavailable.").then((v) =>
            clampContext(v, 18000)
          )
        : Promise.resolve(""),
    ]);
  const intent = detectIntent(message);
  const routeCandidates = rankRouteCandidates(message);
  const conversionIntent = hasConversionIntent(message);
  const mysticalToneRequested = shouldUseMysticalStyle(message);
  const allowLongResponse = shouldAllowLongResponse(message);
  const ruleBased = getRuleBasedResponse(message, req.body?.ai, req.body?.aiName);
  const leadCaptureActive = maverickActive || niyatiFashionActive || ellyActive;
  let leadEmailDetected = false;

  if (leadCaptureActive) {
    const email = extractEmail(message);
    if (email) {
      leadEmailDetected = true;
      const summary = buildLeadSummary(history, message);
      const payload = {
        ai: req.body?.ai || req.body?.aiName || "unknown",
        aiName: req.body?.aiName || req.body?.ai || "unknown",
        email,
        summary,
        capturedAt: new Date().toISOString(),
      };

      if (LEAD_CAPTURE_WEBHOOK_URL) {
        try {
          await fetch(LEAD_CAPTURE_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } catch (error) {
          console.error("lead webhook failed", error);
        }
      } else {
        try {
          await saveLeadToSupabase(payload);
        } catch (error) {
          console.error("lead supabase save failed", error);
        }
      }
    }

    if (!leadEmailDetected && hasLeadIntent(message)) {
      return res.status(200).json({
        response: getLeadIntentPrompt(req.body?.ai, req.body?.aiName),
      });
    }
  }

  if (ruleBased) {
    return res.status(200).json({ response: ruleBased });
  }

  const systemPrompt = buildSystemPrompt({
    ai: req.body?.ai,
    aiName: req.body?.aiName,
    knowledge,
    maverickContext,
    eaganContext,
    niyatiFashionContext,
    niyomiContext,
    intent,
    routeCandidates,
    conversionIntent,
    mysticalToneRequested,
    allowLongResponse,
    leadEmailDetected,
  });

  const payload = {
    model: XAI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: message },
    ],
    temperature: 0.35,
    max_tokens: allowLongResponse ? 260 : 120,
  };

  try {
    const response = await fetch(XAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    let data: unknown = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }

    const text =
      typeof data === "object" && data
        ? (data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content
        : null;

    if (!response.ok) {
      const apiError =
        typeof data === "object" && data && "error" in data
          ? (data as { error?: { message?: string } }).error?.message
          : null;
      return res.status(response.status || 500).json({
        response: apiError || (typeof data === "string" ? data : "x.ai request failed."),
      });
    }

    if (typeof text === "string" && text.trim()) {
      return res.status(200).json({ response: text.trim() });
    }

    return res.status(200).json({ response: "I could not generate a response." });
  } catch (error) {
    console.error("x.ai request failed", error);
    return res.status(500).json({
      response: "I couldn't reach the AI service right now.",
    });
  }
}
