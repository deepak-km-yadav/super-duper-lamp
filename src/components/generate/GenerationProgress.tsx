"use client";

import { Heart, Loader2, CheckCircle, XCircle, Music } from "lucide-react";

interface GenerationProgressProps {
  status: string;
  errorMessage?: string | null;
}

const STEPS = [
  { key: "queued", label: "Queued", desc: "Waiting in line..." },
  { key: "processing", label: "Generating", desc: "AI is composing your song..." },
  { key: "completed", label: "Complete", desc: "Your song is ready!" },
];

export default function GenerationProgress({ status, errorMessage }: GenerationProgressProps) {
  const currentIdx = STEPS.findIndex((s) => s.key === status);
  const isFailed = status === "failed";

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        {isFailed ? (
          <XCircle className="w-5 h-5 text-red-400" />
        ) : status === "completed" ? (
          <CheckCircle className="w-5 h-5 text-emerald-400" />
        ) : (
          <Loader2 className="w-5 h-5 text-rose-400 animate-spin" />
        )}
        <h3 className="font-semibold text-pink-50">
          {isFailed
            ? "Generation Failed"
            : status === "completed"
            ? "Song Ready!"
            : "Creating Your Song..."}
        </h3>
      </div>

      {isFailed && errorMessage && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">
          {errorMessage}
        </div>
      )}

      {/* Progress Steps */}
      <div className="flex items-center gap-0 mb-4">
        {STEPS.map((step, i) => {
          const isActive = i === currentIdx && !isFailed;
          const isDone = i < currentIdx || status === "completed";

          return (
            <div key={step.key} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isDone
                      ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                      : isActive
                      ? "bg-rose-500/20 border border-rose-500/40 text-rose-400 pulse-glow"
                      : "bg-pink-100/5 border border-pink-100/10 text-pink-100/30"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-xs mt-2 ${
                    isDone
                      ? "text-emerald-400"
                      : isActive
                      ? "text-rose-300"
                      : "text-pink-100/30"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 rounded ${
                    isDone ? "bg-emerald-500/30" : "bg-pink-100/5"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Animated progress bar */}
      {status !== "completed" && !isFailed && (
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{
              width: status === "queued" ? "15%" : status === "processing" ? "65%" : "100%",
            }}
          />
        </div>
      )}

      {/* Fun waiting messages */}
      {status === "processing" && (
        <div className="flex items-center gap-2 mt-4 text-sm text-pink-100/40">
          <Heart className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
          <span>Mixing love and melody together...</span>
          <Music className="w-3.5 h-3.5 text-rose-400/50" />
        </div>
      )}
    </div>
  );
}
