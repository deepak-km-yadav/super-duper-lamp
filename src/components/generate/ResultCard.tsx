"use client";

import { Clock, Cpu, Tag, Sparkles } from "lucide-react";
import AudioPlayer from "@/components/audio/AudioPlayer";
import type { Track } from "@/types";

interface ResultCardProps {
  track: Track;
  isNew?: boolean;
  onFavorite?: () => void;
  isFavorited?: boolean;
}

export default function ResultCard({ track, isNew, onFavorite, isFavorited }: ResultCardProps) {
  return (
    <div className={`glass-card p-6 transition-all ${isNew ? "ring-1 ring-rose-500/30 shadow-lg shadow-rose-500/5" : ""}`}>
      {isNew && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300 text-xs font-medium mb-4">
          <Sparkles className="w-3 h-3" />
          New
        </div>
      )}

      {/* Audio Player */}
      {track.audioUrl && (
        <AudioPlayer
          src={track.audioUrl}
          title={track.title || "Untitled"}
          styleTags={track.styleTags || undefined}
          duration={track.duration || undefined}
          onFavorite={onFavorite}
          isFavorited={isFavorited}
        />
      )}

      {/* Meta info */}
      <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-rose-500/10">
        {track.duration && (
          <div className="flex items-center gap-1.5 text-xs text-pink-100/35">
            <Clock className="w-3 h-3" />
            {Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, "0")}
          </div>
        )}
        {track.modelUsed && (
          <div className="flex items-center gap-1.5 text-xs text-pink-100/35">
            <Cpu className="w-3 h-3" />
            {track.modelUsed}
          </div>
        )}
        {track.styleTags && (
          <div className="flex items-center gap-1.5 text-xs text-pink-100/35">
            <Tag className="w-3 h-3" />
            {track.styleTags}
          </div>
        )}
      </div>
    </div>
  );
}
