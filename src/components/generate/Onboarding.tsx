"use client";

import { useState } from "react";
import { X, Mic, Heart, Headphones, Sparkles, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Onboarding() {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("onboarding-dismissed");
    }
    return true;
  });
  const [step, setStep] = useState(0);

  const dismiss = () => {
    setIsOpen(false);
    localStorage.setItem("onboarding-dismissed", "true");
  };

  const steps = [
    {
      icon: Mic,
      title: "Choose Song Type & Mood",
      description:
        "Start by selecting whether you want a vocal or instrumental track. Pick your genre (Pop, Lo-fi, Piano Ballad, etc.), set the mood (Romantic, Dreamy, Cute), and choose your tempo.",
      tip: "Simple Mode lets AI handle the details. Custom Mode gives you full control over title, style, and lyrics.",
    },
    {
      icon: Heart,
      title: "Write Your Dedication",
      description:
        "Make it personal! Enter names, your relationship, and a heartfelt message. In Simple Mode, describe your idea and let AI write the song. In Custom Mode, write your own lyrics with [Verse], [Chorus], and [Bridge] tags.",
      tip: "Try our Quick Templates for instant inspiration — from 'Crush Confession' to 'Funny Valentine Rap'.",
    },
    {
      icon: Headphones,
      title: "Generate & Listen Instantly",
      description:
        "Hit Generate and watch the magic happen. You'll get 2 unique versions of your song. Play them right here, download, share, or save to your favorites. Every song is stored in your History.",
      tip: "Use the Remix button in History to regenerate with the same settings but a fresh take.",
    },
  ];

  if (!isOpen) return null;

  return (
    <div className="glass-card p-6 mb-8 relative overflow-hidden">
      {/* Close button */}
      <button
        onClick={dismiss}
        className="absolute top-4 right-4 p-1.5 text-pink-100/30 hover:text-pink-100 transition-colors rounded-lg z-10"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 mb-5">
        <Sparkles className="w-4 h-4 text-rose-400" />
        <h3 className="font-semibold text-pink-50">How It Works</h3>
        <span className="text-xs text-pink-100/30 ml-1">
          Step {step + 1} of {steps.length}
        </span>
      </div>

      {/* Step indicators */}
      <div className="flex gap-1.5 mb-5">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            className={`h-1 rounded-full transition-all ${
              i === step ? "w-8 bg-rose-500" : "w-4 bg-rose-500/20"
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/15 flex items-center justify-center shrink-0">
              {(() => {
                const Icon = steps[step].icon;
                return <Icon className="w-5 h-5 text-rose-400" />;
              })()}
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-pink-50 mb-2">{steps[step].title}</h4>
              <p className="text-sm text-pink-100/45 leading-relaxed mb-3">
                {steps[step].description}
              </p>
              <div className="text-xs text-rose-400/70 bg-rose-500/5 border border-rose-500/10 rounded-lg px-3 py-2">
                <strong className="text-rose-400">Tip:</strong> {steps[step].tip}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-rose-500/10">
        <button
          onClick={dismiss}
          className="text-xs text-pink-100/30 hover:text-pink-100/50 transition-colors"
        >
          Don&apos;t show again
        </button>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="text-xs text-pink-100/40 hover:text-pink-100 transition-colors px-3 py-1.5"
            >
              Back
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="btn-secondary text-xs !py-1.5 !px-4 flex items-center gap-1"
            >
              Next
              <ChevronRight className="w-3 h-3" />
            </button>
          ) : (
            <button
              onClick={dismiss}
              className="btn-primary text-xs !py-1.5 !px-4"
            >
              Got it!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
