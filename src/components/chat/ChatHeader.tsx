import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, ChevronDown } from 'lucide-react';
import type { AIBeing } from './types';

interface ChatHeaderProps {
  currentAI: AIBeing;
  allAIs: AIBeing[];
  onAISwitch: (ai: AIBeing) => void;
  onMinimize: () => void;
  onMaximize: () => void;
  isMaximized: boolean;
}

export const ChatHeader = ({ 
  currentAI, 
  allAIs, 
  onAISwitch, 
  onMinimize, 
  onMaximize, 
  isMaximized 
}: ChatHeaderProps) => {
  const [showAISelector, setShowAISelector] = useState(false);

  return (
    <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 liquid-header">
      {/* AI Identity with Switcher */}
      <div className="flex items-center gap-2 sm:gap-3 relative">
        <button
          onClick={() => setShowAISelector(!showAISelector)}
          className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="relative flex-shrink-0">
            {currentAI.image ? (
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 border-primary/30">
                <img 
                  src={currentAI.image} 
                  alt={currentAI.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="avatar-ring w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                  <span className="text-primary text-base sm:text-lg font-bold">{currentAI.initial}</span>
                </div>
              </div>
            )}
          </div>
          <div className="text-left flex flex-col justify-center gap-0.5 min-h-8 sm:min-h-10">
            <h3 className="text-foreground font-semibold text-xs sm:text-sm flex items-center gap-1 sm:gap-2">
              {currentAI.name}
              <ChevronDown className={`w-3 h-3 transition-transform ${showAISelector ? 'rotate-180' : ''}`} />
              <span className="text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium hidden sm:inline">
                REAI Being
              </span>
            </h3>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.85)]" />
              <span className="text-[9px] sm:text-[11px] text-foreground/95 font-semibold uppercase tracking-wider">
                Live
              </span>
            </div>
          </div>
        </button>

        {/* AI Selector Dropdown */}
        <AnimatePresence>
          {showAISelector && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 mt-2 z-[120] liquid-dropdown p-2 min-w-[220px] sm:min-w-[260px]"
            >
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 py-1 mb-1">
                Switch Being
              </p>
              {allAIs.map((ai) => (
                <motion.button
                  key={ai.id}
                  whileHover={{ x: 4 }}
                  onClick={() => {
                    onAISwitch(ai);
                    setShowAISelector(false);
                  }}
                  className={`w-full flex items-center gap-2 sm:gap-3 p-2 rounded-2xl transition-colors ${
                    currentAI.id === ai.id 
                      ? 'bg-primary/30 text-foreground border border-primary/40' 
                      : 'hover:bg-white/12 text-foreground border border-transparent'
                  }`}
                >
                  {ai.image ? (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border border-primary/30">
                      <img 
                        src={ai.image} 
                        alt={ai.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-background border border-primary/30 flex items-center justify-center">
                      <span className="text-primary text-xs sm:text-sm font-bold">{ai.initial}</span>
                    </div>
                  )}
                  <div className="text-left">
                    <p className="text-xs sm:text-sm font-medium text-white">{ai.name}</p>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-0.5 sm:gap-1">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onMinimize}
          className="p-1.5 sm:p-2 rounded-xl liquid-chip hover:bg-muted/50 transition-colors"
        >
          <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
        </motion.button>
      </div>
    </div>
  );
};
