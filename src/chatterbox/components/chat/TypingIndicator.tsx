import React from 'react';
import { motion } from 'framer-motion';

interface TypingIndicatorProps {
  name: string;
  avatar: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ name, avatar }) => {
  return (
    <motion.div
      className="flex items-center gap-3 mb-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <img
        src={avatar}
        alt={name}
        className="w-8 h-8 rounded-full border-2 border-white/20"
      />
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-sm">
        <span className="text-xs text-gray-400">{name} is typing</span>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-gray-400"
              animate={{ y: [0, -5, 0] }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default TypingIndicator;
