export type BotStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";
export type BotVisibility = "public" | "unlisted" | "private";
export type ContentFilterLevel = "strict" | "moderate" | "off";
export type MemoryMode = "none" | "session" | "persistent";
export type ChatTheme =
  | "default"
  | "bubble"
  | "glass"
  | "terminal"
  | "minimal"
  | "neon";

export type Bot = {
  id: string;
  slug: string;
  name: string;
  bio: string;
  description: string;
  avatarUrl?: string;
  avatarInitials?: string;
  themeColor: string;

  systemPrompt: string;
  greeting: string;
  starterPrompts: string[];

  providerId: string;
  modelId: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  memory: MemoryMode;

  chatTheme: ChatTheme;

  visibility: BotVisibility;
  status: BotStatus;
  contentFilter: ContentFilterLevel;
  tags: string[];
  language: string;
  allowedDomains: string[];

  createdAt: string;
  updatedAt: string;
  publishedAt?: string;

  knowledge: KnowledgeDoc[];
};

export type KnowledgeDoc = {
  id: string;
  fileName: string;
  mimeType: string;
  charCount: number;
  content: string;
  addedAt: string;
};

export type UsageRecord = {
  id: string;
  botId: string;
  providerId: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  ts: string;
};

export type ApiKeyMap = Partial<Record<string, string>>;

export type ChatMessage = {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
};
