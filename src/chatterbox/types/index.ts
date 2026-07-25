// Main type definitions for the multi-AI chat application

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'error';

export type ThemeType = 'light' | 'dark' | 'gradient' | 'liquid-glass';

export interface AIPersonality {
  id: string;
  name: string;
  avatar: string;
  personality: string;
  description: string;
  color: string;
  webhookUrl: string;
  isFavorite: boolean;
  isPinned: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  personalityId: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: Date;
  status: MessageStatus;
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  personalityId: string;
  messages: Message[];
  lastActive: Date;
  isPinned: boolean;
  unreadCount: number;
}

export interface WebhookPayload {
  message: string;
  username: string;
  personality_id: string;
  personality_name: string;
  timestamp: string;
  conversation_id: string;
}

export interface WebhookResponse {
  reply: string;
  success: boolean;
  error?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  email?: string;
}

export interface Notification {
  id: string;
  type: 'message' | 'system' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  personalityId?: string;
}

export interface ChatWindowState {
  isMinimized: boolean;
  isDocked: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface Suggestion {
  id: string;
  text: string;
  category: string;
  icon?: string;
}
