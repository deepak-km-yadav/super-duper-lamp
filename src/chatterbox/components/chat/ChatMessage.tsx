import React from 'react';
import { motion } from 'framer-motion';
import type { Message } from '../../types';
import { useChatStore } from '../../store/chatStore';
import Avatar from '../common/Avatar';
import { FiCheck, FiAlertCircle } from 'react-icons/fi';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const { personalities, userProfile } = useChatStore();

  const isUser = message.sender === 'user';
  const personality = personalities.find((p) => p.id === message.personalityId);

  const getStatusIcon = () => {
    switch (message.status) {
      case 'sending':
        return <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />;
      case 'sent':
        return <FiCheck className="w-3 h-3 text-gray-400" />;
      case 'delivered':
        return (
          <div className="flex">
            <FiCheck className="w-3 h-3 text-blue-400" />
            <FiCheck className="w-3 h-3 text-blue-400 -ml-1" />
          </div>
        );
      case 'error':
        return <FiAlertCircle className="w-3 h-3 text-red-400" />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      className={`flex gap-3 mb-6 ${isUser ? 'flex-row-reverse' : 'flex-row'} px-4 md:px-6`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <Avatar
        src={isUser ? userProfile.avatar : personality?.avatar || ''}
        alt={isUser ? userProfile.displayName : personality?.name || 'AI'}
        size="md"
      />

      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%] md:max-w-[65%]`}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-medium text-gray-300">
            {isUser ? userProfile.displayName : personality?.name}
          </span>
          <span className="text-xs text-gray-400">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <motion.div
          className={`
            px-5 py-3.5 rounded-3xl max-w-full break-words
            ${isUser
              ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-md shadow-sky-900/30'
              : 'bg-white/10 text-gray-100 border border-white/10 shadow-sm backdrop-blur-sm'}
          `}
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          {message.isStreaming && (
            <motion.span
              className="inline-block w-1 h-4 ml-1 bg-current"
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          )}
        </motion.div>

        {isUser && (
          <div className="flex items-center gap-1 mt-1.5">
            {getStatusIcon()}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ChatMessage;
