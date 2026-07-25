import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AIPersonality,
  Conversation,
  Message,
  UserProfile,
  Notification,
  ThemeType,
  ChatWindowState,
  MessageStatus,
} from '../types';
import { AI_PERSONALITIES } from '../config/personalities';
import { v4 as uuidv4 } from 'uuid';

interface ChatState {
  // Personalities
  personalities: AIPersonality[];
  activePersonalityId: string | null;

  // Conversations
  conversations: Conversation[];

  // User profile
  userProfile: UserProfile;

  // Theme
  theme: ThemeType;

  // Notifications
  notifications: Notification[];

  // UI state
  chatWindowState: ChatWindowState;
  isSidebarOpen: boolean;
  isNotificationsPanelOpen: boolean;
  isSuggestionsPanelOpen: boolean;

  // Typing indicators
  typingPersonalities: Set<string>;

  // Actions - Personalities
  setActivePersonality: (personalityId: string) => void;
  toggleFavorite: (personalityId: string) => void;
  togglePin: (personalityId: string) => void;

  // Actions - Messages
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  updateMessageStatus: (messageId: string, status: MessageStatus) => void;
  clearConversation: (conversationId: string) => void;

  // Actions - Conversations
  getOrCreateConversation: (personalityId: string) => Conversation;
  getConversation: (conversationId: string) => Conversation | undefined;
  pinConversation: (conversationId: string) => void;
  markConversationAsRead: (conversationId: string) => void;

  // Actions - Profile
  updateUserProfile: (updates: Partial<UserProfile>) => void;

  // Actions - Theme
  setTheme: (theme: ThemeType) => void;

  // Actions - Notifications
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  markNotificationAsRead: (notificationId: string) => void;
  clearNotifications: () => void;

  // Actions - UI
  setChatWindowState: (state: Partial<ChatWindowState>) => void;
  toggleSidebar: () => void;
  toggleNotificationsPanel: () => void;
  toggleSuggestionsPanel: () => void;

  // Actions - Typing
  setTyping: (personalityId: string, isTyping: boolean) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Initial state
      personalities: AI_PERSONALITIES,
      activePersonalityId: AI_PERSONALITIES[0].id,
      conversations: [],
      userProfile: {
        id: 'user007',
        username: 'user007',
        displayName: 'Johan',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user007',
      },
      theme: 'light',
      notifications: [],
      chatWindowState: {
        isMinimized: false,
        isDocked: false,
        position: { x: 100, y: 100 },
        size: { width: 800, height: 600 },
      },
      isSidebarOpen: true,
      isNotificationsPanelOpen: false,
      isSuggestionsPanelOpen: true,
      typingPersonalities: new Set(),

      // Personality actions
      setActivePersonality: (personalityId) =>
        set({ activePersonalityId: personalityId }),

      toggleFavorite: (personalityId) =>
        set((state) => ({
          personalities: state.personalities.map((p) =>
            p.id === personalityId ? { ...p, isFavorite: !p.isFavorite } : p
          ),
        })),

      togglePin: (personalityId) =>
        set((state) => ({
          personalities: state.personalities.map((p) =>
            p.id === personalityId ? { ...p, isPinned: !p.isPinned } : p
          ),
        })),

      // Message actions
      addMessage: (message) =>
        set((state) => {
          const conversation = state.conversations.find(
            (c) => c.id === message.conversationId
          );

          if (conversation) {
            return {
              conversations: state.conversations.map((c) =>
                c.id === message.conversationId
                  ? {
                      ...c,
                      messages: [...c.messages, message],
                      lastActive: new Date(),
                      unreadCount:
                        message.sender === 'ai' ? c.unreadCount + 1 : c.unreadCount,
                    }
                  : c
              ),
            };
          }

          return state;
        }),

      updateMessage: (messageId, updates) =>
        set((state) => ({
          conversations: state.conversations.map((c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === messageId ? { ...m, ...updates } : m
            ),
          })),
        })),

      updateMessageStatus: (messageId, status) =>
        set((state) => ({
          conversations: state.conversations.map((c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === messageId ? { ...m, status } : m
            ),
          })),
        })),

      clearConversation: (conversationId) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, messages: [] } : c
          ),
        })),

      // Conversation actions
      getOrCreateConversation: (personalityId) => {
        const state = get();
        const existing = state.conversations.find(
          (c) => c.personalityId === personalityId
        );

        if (existing) {
          return existing;
        }

        const newConversation: Conversation = {
          id: uuidv4(),
          personalityId,
          messages: [],
          lastActive: new Date(),
          isPinned: false,
          unreadCount: 0,
        };

        set((state) => ({
          conversations: [...state.conversations, newConversation],
        }));

        return newConversation;
      },

      getConversation: (conversationId) => {
        return get().conversations.find((c) => c.id === conversationId);
      },

      pinConversation: (conversationId) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, isPinned: !c.isPinned } : c
          ),
        })),

      markConversationAsRead: (conversationId) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, unreadCount: 0 } : c
          ),
        })),

      // Profile actions
      updateUserProfile: (updates) =>
        set((state) => ({
          userProfile: { ...state.userProfile, ...updates },
        })),

      // Theme actions
      setTheme: (theme) => set({ theme }),

      // Notification actions
      addNotification: (notification) =>
        set((state) => ({
          notifications: [
            {
              ...notification,
              id: uuidv4(),
              timestamp: new Date(),
              read: false,
            },
            ...state.notifications,
          ],
        })),

      markNotificationAsRead: (notificationId) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          ),
        })),

      clearNotifications: () => set({ notifications: [] }),

      // UI actions
      setChatWindowState: (newState) =>
        set((state) => ({
          chatWindowState: { ...state.chatWindowState, ...newState },
        })),

      toggleSidebar: () =>
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

      toggleNotificationsPanel: () =>
        set((state) => ({
          isNotificationsPanelOpen: !state.isNotificationsPanelOpen,
        })),

      toggleSuggestionsPanel: () =>
        set((state) => ({
          isSuggestionsPanelOpen: !state.isSuggestionsPanelOpen,
        })),

      // Typing actions
      setTyping: (personalityId, isTyping) =>
        set((state) => {
          const newTyping = new Set(state.typingPersonalities);
          if (isTyping) {
            newTyping.add(personalityId);
          } else {
            newTyping.delete(personalityId);
          }
          return { typingPersonalities: newTyping };
        }),
    }),
    {
      name: 'chatterbox-storage',
      partialize: (state) => ({
        personalities: state.personalities,
        conversations: state.conversations,
        userProfile: state.userProfile,
        theme: state.theme,
      }),
    }
  )
);
