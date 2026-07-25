import React, { useState, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { FiSend } from 'react-icons/fi';
import Button from '../common/Button';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = 'Type your message...',
}) => {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <motion.div
      className="flex items-end gap-2 p-4 border-t border-white/10 bg-white/5 backdrop-blur-sm"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2 }}
    >
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="
          flex-1 px-4 py-3 rounded-lg resize-none
          bg-white/10 border border-white/20
          text-gray-100 placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          scrollbar-thin
        "
        style={{ maxHeight: '120px' }}
      />
      <Button
        onClick={handleSend}
        disabled={disabled || !message.trim()}
        icon={<FiSend />}
        variant="primary"
        size="md"
      >
        Send
      </Button>
    </motion.div>
  );
};

export default ChatInput;
