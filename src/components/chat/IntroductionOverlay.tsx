import { motion } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import type { AIBeing } from './types';

interface IntroductionOverlayProps {
  currentAI: AIBeing;
  onClose: () => void;
}

export const IntroductionOverlay = ({ currentAI, onClose }: IntroductionOverlayProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 z-50 flex items-center justify-center p-4 sm:p-6 liquid-intro-overlay"
    >
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        onClick={onClose}
        className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 sm:p-2 rounded-lg liquid-chip hover:bg-white/10 transition-colors z-10"
      >
        <X className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
      </motion.button>

      <div className="text-center max-w-sm px-4 py-5 sm:px-6 sm:py-7">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 15, stiffness: 200 }}
          className="relative mx-auto mb-6 sm:mb-8"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.1, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="w-24 sm:w-32 h-24 sm:h-32 rounded-full bg-primary/20 blur-xl"
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ scale: [1.1, 1.4, 1.1], opacity: [0.2, 0.05, 0.2] }}
              transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
              className="w-32 sm:w-40 h-32 sm:h-40 rounded-full bg-primary/10 blur-2xl"
            />
          </div>

          {currentAI.image ? (
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full overflow-hidden border-2 border-primary/30">
              <motion.img
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                src={currentAI.image}
                alt={currentAI.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="relative avatar-ring w-20 h-20 sm:w-24 sm:h-24 mx-auto flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-primary text-3xl sm:text-4xl font-bold"
                >
                  {currentAI.initial}
                </motion.span>
              </div>
            </div>
          )}

          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0"
          >
            <Sparkles className="absolute top-0 right-4 w-3 h-3 sm:w-4 sm:h-4 text-primary/60" />
            <Sparkles className="absolute bottom-2 left-2 w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary/40" />
            <Sparkles className="absolute top-8 left-0 w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary/50" />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
            I'm <span className="text-primary">{currentAI.name}</span>
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed mb-4 sm:mb-6">
            {currentAI.description}
          </p>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onClose}
          className="w-full py-3 sm:py-4 rounded-2xl send-glass font-medium text-xs sm:text-sm transition-all"
        >
          Begin Conversation
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-[10px] sm:text-[11px] text-muted-foreground/50 mt-3 sm:mt-4"
        >
          Authentic Intelligence - Crafted by Design
        </motion.p>
      </div>
    </motion.div>
  );
};
