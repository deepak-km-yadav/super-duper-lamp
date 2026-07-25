import type { WebhookPayload, WebhookResponse } from '../types';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff in ms

// Delay utility
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Send a message to the n8n webhook with retry logic
 */
export const sendMessageToWebhook = async (
  webhookUrl: string,
  payload: WebhookPayload,
  retryCount = 0
): Promise<WebhookResponse> => {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return {
      reply: data.reply || data.message || data.response || 'No response from AI',
      success: true,
    };
  } catch (error) {
    console.error(`Webhook request failed (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, error);

    // Retry logic
    if (retryCount < MAX_RETRIES) {
      const delayMs = RETRY_DELAYS[retryCount];
      console.log(`Retrying in ${delayMs}ms...`);
      await delay(delayMs);
      return sendMessageToWebhook(webhookUrl, payload, retryCount + 1);
    }

    // All retries exhausted
    return {
      reply: '',
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to AI',
    };
  }
};

/**
 * Create a webhook payload from message data
 */
export const createWebhookPayload = (
  message: string,
  personalityId: string,
  personalityName: string,
  conversationId: string,
  username: string = 'user007'
): WebhookPayload => {
  return {
    message,
    username,
    personality_id: personalityId,
    personality_name: personalityName,
    timestamp: new Date().toISOString(),
    conversation_id: conversationId,
  };
};

/**
 * Simulate streaming response (character by character)
 */
export const streamResponse = async (
  text: string,
  onChunk: (chunk: string) => void,
  delayMs: number = 30
): Promise<void> => {
  for (let i = 0; i < text.length; i++) {
    await delay(delayMs);
    onChunk(text.substring(0, i + 1));
  }
};
