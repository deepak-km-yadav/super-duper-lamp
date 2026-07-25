import { useState, useCallback } from 'react';
import { useChatStore } from '../store/chatStore';
import type { Message } from '../types';
import { sendMessageToWebhook, createWebhookPayload, streamResponse } from '../services/webhookService';
import { v4 as uuidv4 } from 'uuid';

export const useChat = () => {
  const [isLoading, setIsLoading] = useState(false);

  const {
    activePersonalityId,
    personalities,
    userProfile,
    getOrCreateConversation,
    addMessage,
    updateMessage,
    updateMessageStatus,
    setTyping,
    addNotification,
  } = useChatStore();

  const sendMessage = useCallback(
    async (content: string) => {
      if (!activePersonalityId || !content.trim()) return;

      setIsLoading(true);

      const personality = personalities.find((p) => p.id === activePersonalityId);
      if (!personality) return;

      const conversation = getOrCreateConversation(activePersonalityId);

      // Create user message
      const userMessage: Message = {
        id: uuidv4(),
        conversationId: conversation.id,
        personalityId: activePersonalityId,
        sender: 'user',
        content: content.trim(),
        timestamp: new Date(),
        status: 'sending',
      };

      // Add user message to conversation
      addMessage(userMessage);

      // Update status to sent
      setTimeout(() => {
        updateMessageStatus(userMessage.id, 'sent');
      }, 300);

      // Show typing indicator
      setTyping(activePersonalityId, true);

      try {
        // Send to webhook
        const payload = createWebhookPayload(
          content.trim(),
          personality.id,
          personality.name,
          conversation.id,
          userProfile.username
        );

        const response = await sendMessageToWebhook(personality.webhookUrl, payload);

        // Hide typing indicator
        setTyping(activePersonalityId, false);

        if (response.success && response.reply) {
          // Create AI message
          const aiMessageId = uuidv4();
          const aiMessage: Message = {
            id: aiMessageId,
            conversationId: conversation.id,
            personalityId: activePersonalityId,
            sender: 'ai',
            content: '',
            timestamp: new Date(),
            status: 'delivered',
            isStreaming: true,
          };

          addMessage(aiMessage);

          // Stream the response
          await streamResponse(response.reply, (chunk) => {
            updateMessage(aiMessageId, { content: chunk });
          });

          // Mark streaming as complete
          updateMessage(aiMessageId, { isStreaming: false });

          // Mark user message as delivered
          updateMessageStatus(userMessage.id, 'delivered');
        } else {
          // Error handling
          updateMessageStatus(userMessage.id, 'error');
          addNotification({
            type: 'error',
            title: 'Message Failed',
            message: response.error || 'Failed to get response from AI',
            read: false,
            personalityId: activePersonalityId,
          });
        }
      } catch (error) {
        console.error('Error sending message:', error);
        setTyping(activePersonalityId, false);
        updateMessageStatus(userMessage.id, 'error');
        addNotification({
          type: 'error',
          title: 'Connection Error',
          message: 'Failed to connect to the AI service',
          read: false,
          personalityId: activePersonalityId,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [
      activePersonalityId,
      personalities,
      userProfile,
      getOrCreateConversation,
      addMessage,
      updateMessage,
      updateMessageStatus,
      setTyping,
      addNotification,
    ]
  );

  return {
    sendMessage,
    isLoading,
  };
};
