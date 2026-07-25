import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Message, AIBeing } from './types';

interface ChatMessagesProps {
  messages: Message[];
  isTyping: boolean;
  currentAI: AIBeing;
}

export const ChatMessages = ({ messages, isTyping, currentAI }: ChatMessagesProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    // Auto-scroll only after the first message to avoid anchoring the very first message at the bottom.
    if (messages.length > 1 || isTyping) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-3 sm:space-y-4"
    >
      <AnimatePresence initial={false}>
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className="max-w-[85%]">
              {message.role === 'ai' && (
                <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                  {currentAI.image ? (
                    <div className="chat-message-avatar w-7 h-7 sm:w-8 sm:h-8">
                      <img
                        src={currentAI.image}
                        alt={currentAI.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="chat-message-avatar w-7 h-7 sm:w-8 sm:h-8 bg-background flex items-center justify-center">
                      <span className="text-primary text-[11px] sm:text-xs font-bold">{currentAI.initial}</span>
                    </div>
                  )}
                  <span className="text-[10px] sm:text-[11px] text-primary font-medium">
                    {currentAI.name}
                  </span>
                </div>
              )}
              <div
                className={`${
                  message.role === 'ai' ? 'chat-bubble-ai' : 'chat-bubble-user'
                } p-3 sm:p-4`}
              >
              <p className={`text-xs sm:text-sm leading-relaxed ${
                message.role === 'ai' ? 'text-foreground/90' : 'text-foreground'
              }`}>
                {message.content}
              </p>
              <p className="text-[8px] sm:text-[10px] text-muted-foreground mt-1.5 sm:mt-2">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Typing indicator */}
      <AnimatePresence>
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex justify-start"
          >
            <div className="chat-bubble-ai p-3 sm:p-4 flex items-center gap-1.5 sm:gap-2">
              <div className="flex items-center gap-1">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {messages.length === 0 && !isTyping && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center h-full text-center py-6 sm:py-8"
        >
          <div className="avatar-ring w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center mb-3 sm:mb-4">
            <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
              <span className="text-primary text-xl sm:text-2xl font-bold">{currentAI.initial}</span>
            </div>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Start a conversation with {currentAI.name}
          </p>
        </motion.div>
      )}
    </div>
  );
};
