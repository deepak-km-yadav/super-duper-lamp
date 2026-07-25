import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../store/chatStore';
import { useChat } from '../../hooks/useChat';
import { DEFAULT_SUGGESTIONS } from '../../config/personalities';
import { FiZap, FiX } from 'react-icons/fi';
import Button from '../common/Button';

const SuggestionsPanel: React.FC = () => {
  const { isSuggestionsPanelOpen, toggleSuggestionsPanel } = useChatStore();
  const { sendMessage } = useChat();

  const handleSuggestionClick = (text: string) => {
    sendMessage(text);
  };

  return (
    <AnimatePresence>
      {isSuggestionsPanelOpen && (
        <motion.div
          className="w-80 h-full border-l border-white/10 bg-white/5 backdrop-blur-sm flex flex-col"
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* Header */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiZap className="w-5 h-5 text-yellow-400" />
                <h2 className="text-lg font-bold text-white">Quick Suggestions</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={toggleSuggestionsPanel}>
                <FiX />
              </Button>
            </div>
          </div>

          {/* Suggestions List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
            {DEFAULT_SUGGESTIONS.map((suggestion, index) => (
              <motion.div
                key={suggestion.id}
                className="
                  p-4 rounded-lg border border-white/20 bg-white/5
                  hover:bg-white/10 hover:border-primary-500/50
                  cursor-pointer transition-all
                "
                onClick={() => handleSuggestionClick(suggestion.text)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{suggestion.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-primary-400 uppercase tracking-wide">
                        {suggestion.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-200">{suggestion.text}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SuggestionsPanel;
