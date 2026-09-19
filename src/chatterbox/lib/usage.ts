/** Client for /api/usage. */

import { apiFetch } from "./api-client";

export type UsageBucket = {
  key: string;
  botId?: string;
  botName?: string;
  providerId?: string;
  modelId?: string;
  day?: string;
  promptTokens: number;
  completionTokens: number;
  messages: number;
};

export type UsageReport = {
  window: string;
  totals: {
    promptTokens: number;
    completionTokens: number;
    messages: number;
    messagesWithUsage: number;
  };
  byBot: UsageBucket[];
  byModel: UsageBucket[];
  byDay: UsageBucket[];
};

export function fetchUsage(window: string): Promise<UsageReport> {
  return apiFetch<UsageReport>(`/api/usage?window=${encodeURIComponent(window)}`);
}
