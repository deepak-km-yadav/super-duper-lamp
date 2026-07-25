import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatHeader } from './ChatHeader';
import { VideoPanel } from './VideoPanel';
import { FAQPanel } from './FAQPanel';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { IntroductionOverlay } from './IntroductionOverlay';
import { AI_BEINGS, type Message, type FAQItem, type AIBeing } from './types';
import { z } from 'zod';

const DEFAULT_CHAT_API_URL = '/api/chat';
const CHAT_API_URL = (import.meta.env.VITE_CHAT_API_URL || DEFAULT_CHAT_API_URL).trim();

const normalizeAIText = (text: string): string => {
  return text.replace(/—/g, ', ');
};

const defaultFAQs: FAQItem[] = [
  { id: '1', title: 'What is REAI?', thumbnail: '/placeholder.svg' },
  { id: '2', title: 'Meet the Beings', thumbnail: '/placeholder.svg' },
  { id: '3', title: 'How it Works', thumbnail: '/placeholder.svg' },
];

export const AIConcierge = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedFAQ, setSelectedFAQ] = useState<FAQItem | null>(null);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [currentAI, setCurrentAI] = useState<AIBeing>(
    AI_BEINGS.find((ai) => ai.id === 'maverick') ?? AI_BEINGS[0],
  );

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setShowIntro(true);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
    setIsMaximized(false);
  };

  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  const handleCloseIntro = () => {
    setShowIntro(false);
    if (messages.length === 0) {
      setMessages([
        {
          id: '1',
          role: 'ai',
          content: currentAI.greeting,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleAISwitch = (ai: AIBeing) => {
    setCurrentAI(ai);
    setShowIntro(true);
    setMessages([]);
    setSelectedFAQ(null);
    setIsVideoFullscreen(false);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    const history = [...messages, userMessage].slice(-10).map((msg) => ({
      role: msg.role === 'ai' ? 'assistant' : 'user',
      content: msg.content,
    }));

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          history,
          ai: currentAI.id,
          aiName: currentAI.name,
          timestamp: userMessage.timestamp.toISOString(),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      let parsed: unknown = null;
      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();

      if (contentType.includes('application/json')) {
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = null;
        }
      }

      const schema = z.object({
        response: z.string().optional(),
        message: z.string().optional(),
        reply: z.string().optional(),
        output: z.string().optional(),
        text: z.string().optional(),
        content: z.string().optional(),
        replies: z.array(z.string()).optional(),
        error: z.string().optional(),
      });

      const data = schema.safeParse(parsed);

      let replies: string[] = [];
      if (data.success) {
        replies =
          data.data.replies ??
          [
            data.data.response,
            data.data.message,
            data.data.reply,
            data.data.output,
            data.data.text,
            data.data.content,
          ].filter(Boolean);
      } else if (parsed && typeof parsed === 'object') {
        const firstString = Object.values(parsed as Record<string, unknown>).find(
          (v) => typeof v === 'string',
        ) as string | undefined;
        if (firstString) replies = [firstString];
      } else if (typeof parsed === 'string') {
        replies = [parsed];
      }

      const parsedErrorMessage =
        (data.success && data.data.error) ||
        (data.success && data.data.response) ||
        (data.success && data.data.message) ||
        (data.success && data.data.reply) ||
        (data.success && data.data.output) ||
        (data.success && data.data.text) ||
        (data.success && data.data.content) ||
        (parsed &&
        typeof parsed === 'object' &&
        'message' in parsed &&
        typeof (parsed as Record<string, unknown>).message === 'string'
          ? ((parsed as Record<string, unknown>).message as string)
          : undefined);

      const content = !response.ok
        ? `Webhook error (${response.status}${response.statusText ? ` ${response.statusText}` : ''}): ${
            parsedErrorMessage || rawText || 'Unknown error'
          }`
        : replies[0] ||
          rawText ||
          "I'm here, but I didn't receive a reply from the AI. Please try again.";

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: normalizeAIText(content),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: normalizeAIText(
          error instanceof Error && error.name === 'AbortError'
            ? 'The AI took too long to respond. Please try again.'
            : 'There was a problem reaching the AI. Please try again.',
        ),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFAQSelect = (faq: FAQItem) => {
    if (selectedFAQ?.id === faq.id) {
      setSelectedFAQ(null);
      setIsVideoFullscreen(false);
    } else {
      setSelectedFAQ(faq);
    }
  };

  if (!isOpen || isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="fixed bottom-10 right-8 sm:bottom-16 sm:right-10 z-50 flex items-center gap-3 sm:gap-4"
      >
        <button onClick={handleOpen} className="chat-minimized group">
          <div className="pulse-ring" />
          <div className="pulse-ring" style={{ animationDelay: '0.5s' }} />
          {currentAI.image ? (
            <div className="relative z-10 w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 border-white/50">
              <img src={currentAI.image} alt={currentAI.name} className="w-full h-full object-cover scale-135" />
            </div>
          ) : (
            <div className="relative z-10 avatar-ring w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                <span className="text-primary text-xl sm:text-2xl font-bold">{currentAI.initial}</span>
              </div>
            </div>
          )}
        </button>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={`fixed z-50 ${
          isMaximized
            ? 'inset-2 sm:inset-4'
            : 'inset-2 sm:bottom-16 sm:right-6 sm:left-auto sm:top-auto sm:w-[480px] sm:h-[700px] sm:max-h-[85vh]'
        }`}
      >
        <div className="glass-panel liquid-unchatbox w-full h-full flex flex-col overflow-hidden">

          <AnimatePresence>
            {showIntro && <IntroductionOverlay currentAI={currentAI} onClose={handleCloseIntro} />}
          </AnimatePresence>

          {!showIntro && (
            <>
              <div className="relative z-50">
                <ChatHeader
                  currentAI={currentAI}
                  allAIs={AI_BEINGS}
                  onAISwitch={handleAISwitch}
                  onMinimize={handleMinimize}
                  onMaximize={handleMaximize}
                  isMaximized={isMaximized}
                />
              </div>

              <div className="flex-1 flex flex-col overflow-hidden relative z-10">
                {isVideoFullscreen && selectedFAQ ? (
                  <div className="flex-1 p-3 sm:p-4">
                    <VideoPanel
                      currentAI={currentAI}
                      selectedFAQ={selectedFAQ}
                      isFillChatbox={isVideoFullscreen}
                      onToggleFillChatbox={() => setIsVideoFullscreen(false)}
                      onStopVideo={() => {
                        setSelectedFAQ(null);
                        setIsVideoFullscreen(false);
                      }}
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 sm:gap-3 p-3 sm:p-4">
                      <div className="flex-1 h-full min-h-0 relative z-0">
                        <VideoPanel
                          currentAI={currentAI}
                          selectedFAQ={selectedFAQ}
                          isFillChatbox={isVideoFullscreen}
                          onToggleFillChatbox={() => setIsVideoFullscreen((prev) => !prev)}
                          onStopVideo={() => {
                            setSelectedFAQ(null);
                            setIsVideoFullscreen(false);
                          }}
                        />
                      </div>

                      <div className="w-28 sm:w-32 h-full min-h-0 liquid-subpanel relative z-40">
                        <FAQPanel faqs={defaultFAQs} selectedFAQ={selectedFAQ} onSelect={handleFAQSelect} />
                      </div>
                    </div>

                    <ChatMessages messages={messages} isTyping={isTyping} currentAI={currentAI} />

                    <ChatInput
                      value={inputValue}
                      onChange={setInputValue}
                      onSend={handleSendMessage}
                      aiName={currentAI.name}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
