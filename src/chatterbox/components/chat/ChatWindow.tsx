import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../store/chatStore';
import { useChat } from '../../hooks/useChat';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import { FiMoreVertical, FiTrash2 } from 'react-icons/fi';
import Button from '../common/Button';

const ChatWindow: React.FC = () => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    activePersonalityId,
    personalities,
    getOrCreateConversation,
    clearConversation,
    typingPersonalities,
  } = useChatStore();
  const { sendMessage, isLoading } = useChat();

  const activePersonality = personalities.find((p) => p.id === activePersonalityId);
  const conversation = activePersonalityId
    ? getOrCreateConversation(activePersonalityId)
    : null;

  const isTyping = activePersonalityId
    ? typingPersonalities.has(activePersonalityId)
    : false;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages, isTyping]);

  const handleClearChat = () => {
    if (conversation && window.confirm('Are you sure you want to clear this conversation?')) {
      clearConversation(conversation.id);
    }
  };

  if (!activePersonality || !conversation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-2">No conversation selected</p>
          <p className="text-gray-500 text-sm">Select an AI personality to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <motion.div
        className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5 backdrop-blur-sm"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="flex items-center gap-3">
          <img
            src={activePersonality.avatar}
            alt={activePersonality.name}
            className="w-10 h-10 rounded-full border-2 border-white/20"
          />
          <div>
            <h2 className="font-semibold text-lg" style={{ color: activePersonality.color }}>
              {activePersonality.name}
            </h2>
            <p className="text-xs text-gray-400">{activePersonality.personality}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleClearChat}>
            <FiTrash2 />
          </Button>
          <Button variant="ghost" size="sm">
            <FiMoreVertical />
          </Button>
        </div>
      </motion.div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        <AnimatePresence>
          {conversation.messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isTyping && (
            <TypingIndicator
              name={activePersonality.name}
              avatar={activePersonality.avatar}
            />
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <ChatInput
        onSendMessage={sendMessage}
        disabled={isLoading}
        placeholder={`Message ${activePersonality.name}...`}
      />
    </div>
  );
};

export default ChatWindow;
