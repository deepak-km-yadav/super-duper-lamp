export type BotStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";
export type BotVisibility = "public" | "unlisted" | "private";
export type ContentFilterLevel = "strict" | "moderate" | "off";
export type MemoryMode = "none" | "session" | "persistent";
/** What a bot is allowed to do automatically when "Act as an Agent" is on. */
export type AgentAction = "lead_magnet" | "scheduler";

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

  agentEnabled: boolean;
  agentActions: AgentAction[];
  notifyEmail?: string;
  notifyWebhookUrl?: string;

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

/**
 * What a visitor's browser is allowed to know about a bot.
 *
 * Deliberately excludes systemPrompt, knowledge, providerId, modelId and the
 * sampling settings: those stay on the server, which is the whole point of
 * routing chat through /api/bot-chat rather than calling providers directly.
 */
export type PublicBot = Pick<
  Bot,
  | "id"
  | "slug"
  | "name"
  | "bio"
  | "description"
  | "avatarUrl"
  | "avatarInitials"
  | "themeColor"
  | "greeting"
  | "starterPrompts"
  | "chatTheme"
  | "tags"
  | "language"
  | "memory"
>;

/** Notification targets for captured leads and meeting requests. */
export type BotNotifications = {
  notifyEmail?: string;
  notifyWebhookUrl?: string;
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
