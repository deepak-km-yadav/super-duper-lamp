import React from 'react';
import { motion } from 'framer-motion';
import type { AIPersonality, Conversation } from '../../types';
import { useChatStore } from '../../store/chatStore';
import Avatar from '../common/Avatar';
import Badge from '../common/Badge';
import { FiStar } from 'react-icons/fi';

interface PersonalityCardProps {
  personality: AIPersonality;
  conversation?: Conversation;
  isActive: boolean;
  onClick: () => void;
}

const PersonalityCard: React.FC<PersonalityCardProps> = ({
  personality,
  conversation,
  isActive,
  onClick,
}) => {
  const { toggleFavorite, typingPersonalities } = useChatStore();

  const isTyping = typingPersonalities.has(personality.id);
  const lastMessage = conversation?.messages[conversation.messages.length - 1];
  const unreadCount = conversation?.unreadCount || 0;

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(personality.id);
  };

  return (
    <motion.div
      className={`
        group relative p-4 rounded-xl cursor-pointer transition-all
        ${isActive
          ? 'bg-gradient-to-r from-sky-600/20 to-blue-500/20 border border-sky-500/40'
          : 'bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10'}
        shadow-sm hover:shadow-md
      `}
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <div className="flex items-center gap-3">
        <Avatar
          src={personality.avatar}
          alt={personality.name}
          size="md"
          status={isTyping ? 'typing' : undefined}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <h3 className="font-semibold text-base truncate text-white">
              {personality.name}
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Badge variant="primary" size="sm">
                  {unreadCount}
                </Badge>
              )}
              <motion.button
                onClick={handleFavorite}
                className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                  personality.isFavorite ? 'text-yellow-400' : 'text-gray-400'
                } hover:bg-white/10`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <FiStar className={personality.isFavorite ? 'fill-current' : ''} size={14} />
              </motion.button>
            </div>
          </div>

          <p className="text-xs text-gray-400 truncate mb-1">
            {personality.personality}
          </p>

          {lastMessage && (
            <p className="text-xs text-gray-500 truncate">
              {lastMessage.sender === 'user' ? 'You: ' : ''}
              {lastMessage.content}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default PersonalityCard;
