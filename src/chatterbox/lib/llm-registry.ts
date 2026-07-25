export type ModelMeta = {
  id: string;
  name: string;
  contextWindow: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
  pricePerMTokIn?: number;
  pricePerMTokOut?: number;
  legacy?: boolean;
};

export type ProviderMeta = {
  id: string;
  name: string;
  envKey: string;
  models: ModelMeta[];
};

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    envKey: "ANTHROPIC_API_KEY",
    models: [
      { id: "claude-opus-4-7", name: "Claude Opus 4.7", contextWindow: 200000, supportsVision: true, supportsTools: true, pricePerMTokIn: 15, pricePerMTokOut: 75 },
      { id: "claude-opus-4-6", name: "Claude Opus 4.6", contextWindow: 200000, supportsVision: true, supportsTools: true, pricePerMTokIn: 15, pricePerMTokOut: 75 },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", contextWindow: 200000, supportsVision: true, supportsTools: true, pricePerMTokIn: 3, pricePerMTokOut: 15 },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", contextWindow: 200000, supportsVision: true, supportsTools: true, pricePerMTokIn: 1, pricePerMTokOut: 5 },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", contextWindow: 200000, supportsVision: true, supportsTools: true, pricePerMTokIn: 3, pricePerMTokOut: 15, legacy: true },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", contextWindow: 200000, supportsTools: true, pricePerMTokIn: 0.8, pricePerMTokOut: 4, legacy: true },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus", contextWindow: 200000, supportsVision: true, supportsTools: true, pricePerMTokIn: 15, pricePerMTokOut: 75, legacy: true },
      { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", contextWindow: 200000, supportsVision: true, supportsTools: true, pricePerMTokIn: 0.25, pricePerMTokOut: 1.25, legacy: true },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    envKey: "OPENAI_API_KEY",
    models: [
      { id: "gpt-5", name: "GPT-5", contextWindow: 256000, supportsVision: true, supportsTools: true },
      { id: "gpt-5-mini", name: "GPT-5 mini", contextWindow: 256000, supportsVision: true, supportsTools: true },
      { id: "gpt-4.1", name: "GPT-4.1", contextWindow: 128000, supportsVision: true, supportsTools: true },
      { id: "gpt-4o", name: "GPT-4o", contextWindow: 128000, supportsVision: true, supportsTools: true, pricePerMTokIn: 2.5, pricePerMTokOut: 10 },
      { id: "o3", name: "o3", contextWindow: 128000, supportsTools: true },
      { id: "o3-mini", name: "o3-mini", contextWindow: 128000, supportsTools: true },
      { id: "gpt-4o-mini", name: "GPT-4o mini", contextWindow: 128000, supportsVision: true, supportsTools: true, pricePerMTokIn: 0.15, pricePerMTokOut: 0.6, legacy: true },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", contextWindow: 128000, supportsVision: true, supportsTools: true, pricePerMTokIn: 10, pricePerMTokOut: 30, legacy: true },
    ],
  },
  {
    id: "google",
    name: "Google",
    envKey: "GOOGLE_API_KEY",
    models: [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", contextWindow: 2000000, supportsVision: true, supportsTools: true },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", contextWindow: 1000000, supportsVision: true, supportsTools: true },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", contextWindow: 1000000, supportsVision: true, supportsTools: true },
      { id: "gemini-1.5-pro-latest", name: "Gemini 1.5 Pro", contextWindow: 2000000, supportsVision: true, supportsTools: true, pricePerMTokIn: 1.25, pricePerMTokOut: 5, legacy: true },
      { id: "gemini-1.5-flash-latest", name: "Gemini 1.5 Flash", contextWindow: 1000000, supportsVision: true, supportsTools: true, pricePerMTokIn: 0.075, pricePerMTokOut: 0.3, legacy: true },
    ],
  },
  {
    id: "mistral",
    name: "Mistral",
    envKey: "MISTRAL_API_KEY",
    models: [
      { id: "mistral-large-latest", name: "Mistral Large", contextWindow: 128000, supportsTools: true },
      { id: "mistral-small-latest", name: "Mistral Small", contextWindow: 128000, supportsTools: true },
      { id: "codestral-latest", name: "Codestral", contextWindow: 32000 },
      { id: "open-mixtral-8x22b", name: "Open Mixtral 8x22B", contextWindow: 64000, legacy: true },
      { id: "open-mistral-7b", name: "Open Mistral 7B", contextWindow: 32000, legacy: true },
    ],
  },
  {
    id: "groq",
    name: "Groq",
    envKey: "GROQ_API_KEY",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", contextWindow: 128000 },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", contextWindow: 128000 },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", contextWindow: 32768 },
      { id: "llama3-70b-8192", name: "Llama 3 70B", contextWindow: 8192, legacy: true },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    envKey: "DEEPSEEK_API_KEY",
    models: [
      { id: "deepseek-chat", name: "DeepSeek V3", contextWindow: 64000 },
      { id: "deepseek-reasoner", name: "DeepSeek R1", contextWindow: 64000 },
      { id: "deepseek-coder", name: "DeepSeek Coder", contextWindow: 16000, legacy: true },
    ],
  },
  {
    id: "xai",
    name: "xAI",
    envKey: "XAI_API_KEY",
    models: [
      { id: "grok-4", name: "Grok 4", contextWindow: 256000, supportsTools: true },
      { id: "grok-3", name: "Grok 3", contextWindow: 128000, supportsTools: true },
      { id: "grok-2-1212", name: "Grok 2", contextWindow: 131072, supportsTools: true, legacy: true },
    ],
  },
  {
    id: "cohere",
    name: "Cohere",
    envKey: "COHERE_API_KEY",
    models: [
      { id: "command-r-plus", name: "Command R+", contextWindow: 128000, supportsTools: true },
      { id: "command-r", name: "Command R", contextWindow: 128000, supportsTools: true },
      { id: "command", name: "Command", contextWindow: 4096, legacy: true },
    ],
  },
  {
    id: "perplexity",
    name: "Perplexity",
    envKey: "PERPLEXITY_API_KEY",
    models: [
      { id: "sonar-pro", name: "Sonar Large", contextWindow: 128000 },
      { id: "sonar", name: "Sonar Small", contextWindow: 128000 },
    ],
  },
  {
    id: "together",
    name: "Together AI",
    envKey: "TOGETHER_API_KEY",
    models: [
      { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", name: "Llama 3.3 70B", contextWindow: 128000 },
      { id: "Qwen/Qwen2.5-72B-Instruct-Turbo", name: "Qwen 2.5 72B", contextWindow: 32000 },
      { id: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", name: "Llama 3.1 70B", contextWindow: 128000, legacy: true },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    envKey: "OPENROUTER_API_KEY",
    models: [
      { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5 (via OR)", contextWindow: 200000 },
      { id: "openai/gpt-4o", name: "GPT-4o (via OR)", contextWindow: 128000 },
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash (via OR)", contextWindow: 1000000 },
      { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B (via OR)", contextWindow: 128000 },
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet (via OR)", contextWindow: 200000, legacy: true },
    ],
  },
  {
    id: "ollama",
    name: "Ollama (local)",
    envKey: "OLLAMA_BASE_URL",
    models: [
      { id: "llama3.2", name: "Llama 3.2 (local)", contextWindow: 128000 },
      { id: "qwen2.5", name: "Qwen 2.5 (local)", contextWindow: 32000 },
      { id: "mistral", name: "Mistral (local)", contextWindow: 32000 },
      { id: "llama3.1", name: "Llama 3.1 (local)", contextWindow: 128000, legacy: true },
      { id: "llama3", name: "Llama 3 (local)", contextWindow: 8000, legacy: true },
      { id: "phi3", name: "Phi 3 (local)", contextWindow: 128000, legacy: true },
    ],
  },
];

export function getProvider(id: string): ProviderMeta | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function getModel(providerId: string, modelId: string): ModelMeta | undefined {
  return getProvider(providerId)?.models.find((m) => m.id === modelId);
}

export type ProviderStatus = ProviderMeta & { available: boolean };

export function getProviderStatuses(): ProviderStatus[] {
  return PROVIDERS.map((p) => ({ ...p, available: false }));
}

export function isProviderAvailable(_providerId: string): boolean {
  return false;
}
