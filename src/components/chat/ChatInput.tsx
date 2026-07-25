import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { KeyboardEvent, useRef } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  aiName: string;
}

export const ChatInput = ({
  value,
  onChange,
  onSend,
  aiName,
}: ChatInputProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="p-4">
      <div className="chat-input liquid-subpanel flex items-center gap-3 p-3">
        {/* Input field */}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ask ${aiName} anything...`}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />

        {/* Send button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onSend}
          disabled={!value.trim()}
          className={`p-2.5 rounded-xl transition-all ${
            value.trim()
              ? 'send-glass'
              : 'send-glass-disabled'
          }`}
        >
          <Send className="w-4 h-4" />
        </motion.button>
      </div>

      {/* Powered by text */}
      <p className="text-center text-[10px] text-muted-foreground/60 mt-3">
        Powered by <span className="text-primary/80">REAI</span> • Relational Emotive Authentic Intelligence
      </p>
    </div>
  );
};
