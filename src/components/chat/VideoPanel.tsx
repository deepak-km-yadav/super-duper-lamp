import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Minimize2, Play, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FAQItem, AIBeing } from './types';

interface VideoPanelProps {
  currentAI: AIBeing;
  selectedFAQ: FAQItem | null;
  isFillChatbox: boolean;
  onToggleFillChatbox: () => void;
  onStopVideo: () => void;
}

export const VideoPanel = ({
  currentAI,
  selectedFAQ,
  isFillChatbox,
  onToggleFillChatbox,
  onStopVideo,
}: VideoPanelProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    setIsPlaying(Boolean(selectedFAQ));
  }, [selectedFAQ]);

  useEffect(() => {
    if (!selectedFAQ) return;
    if (selectedFAQ.videoUrl) return;

    const timeout = window.setTimeout(() => {
      setIsPlaying(false);
      onStopVideo();
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [selectedFAQ, onStopVideo]);

  const hasVideoAsset = Boolean(selectedFAQ?.videoUrl);
  const showVideo = Boolean(selectedFAQ && isPlaying);
  const containerClass = 'video-container liquid-subpanel relative isolate group h-full';

  const handleStop = () => {
    setIsPlaying(false);
    onStopVideo();
  };

  return (
    <>
      <div className={containerClass}>
      {/* Placeholder/Video area */}
      <div
        className={`absolute inset-0 ${
          showVideo
            ? 'bg-gradient-to-br from-black/85 via-black/70 to-black/80'
            : 'bg-gradient-to-br from-primary/10 via-background to-primary/5'
        }`}
      >
        <AnimatePresence mode="wait">
          {showVideo ? (
            // Show video when FAQ is selected
            <motion.div
              key="video"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              {/* Video placeholder */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-sm">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-center px-4 py-3"
                >
                  <Play className="w-8 h-8 sm:w-10 sm:h-10 text-primary mx-auto mb-2" />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{selectedFAQ.title}</p>
                </motion.div>
              </div>

              {/* FAQ title overlay */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 bg-gradient-to-t from-black/70 to-transparent"
              >
                  <p className="text-[8px] sm:text-xs text-primary font-medium">Now Playing</p>
                  <p className="text-[10px] sm:text-sm text-foreground truncate">{selectedFAQ.title}</p>
                </motion.div>
            </motion.div>
          ) : (
            // Show AI avatar when no FAQ is selected
            <motion.div
              key="avatar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {currentAI.image ? (
                // Show full image when available
                <div className="absolute inset-0 z-0">
                  <img
                    src={currentAI.image}
                    alt={currentAI.name}
                    className="w-full h-full object-cover"
                  />
                  {/* Subtle overlay for name label */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 bg-gradient-to-t from-background/80 to-transparent text-center">
                    <p className="text-[10px] sm:text-sm text-foreground font-medium">{currentAI.name}</p>
                  </div>
                </div>
              ) : (
                // Show avatar with glow when no image
                <motion.div
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="relative flex flex-col items-center gap-2"
                >
                  {/* Glowing background */}
                  <div className="absolute inset-0 blur-2xl bg-primary/20 rounded-full scale-150" />

                  {/* Avatar circle */}
                  <div className="relative avatar-ring w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                    <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                      <span className="text-primary text-2xl sm:text-3xl font-bold">{currentAI.initial}</span>
                    </div>
                  </div>

                  {/* AI Name label */}
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[10px] sm:text-sm text-foreground font-medium text-center"
                  >
                    {currentAI.name}
                  </motion.p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls overlay - show whenever a FAQ item is selected */}
        {selectedFAQ && (
          <>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {showVideo ? (
                <div />
              ) : (
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsPlaying(true)}
                  className="glass-card w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center"
                  title="Play video"
                >
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 text-primary ml-0.5" />
                </motion.button>
              )}
            </div>

            {/* Mute button */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsMuted(!isMuted)}
                className="p-1.5 sm:p-2 glass-card rounded-lg"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <VolumeX className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-muted-foreground" />
                ) : (
                  <Volume2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary" />
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggleFillChatbox}
                className="p-1.5 sm:p-2 glass-card rounded-lg"
                title={isFillChatbox ? 'Back to chat' : 'Fill chatbox'}
              >
                {isFillChatbox ? (
                  <Minimize2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary" />
                ) : (
                  <Maximize2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary" />
                )}
              </motion.button>
            </div>

          </>
        )}
      </div>

      </div>
    </>
  );
};
