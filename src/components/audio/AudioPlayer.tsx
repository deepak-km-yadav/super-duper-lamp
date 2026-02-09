"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  Heart,
  Share2,
  SkipBack,
  SkipForward,
  Music,
} from "lucide-react";

interface AudioPlayerProps {
  src: string;
  title?: string;
  artist?: string;
  styleTags?: string;
  imageUrl?: string;
  duration?: number;
  onFavorite?: () => void;
  isFavorited?: boolean;
  compact?: boolean;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({
  src,
  title = "Untitled",
  styleTags,
  duration: initialDuration,
  onFavorite,
  isFavorited = false,
  compact = false,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const vol = parseFloat(e.target.value);
    audio.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isMuted) {
      audio.volume = volume || 0.8;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const skip = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, audio.duration || 0));
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (compact) {
    return (
      <div className="audio-player flex items-center gap-3 !p-3">
        <audio ref={audioRef} src={src} preload="metadata" />
        <button
          onClick={togglePlay}
          className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shrink-0 hover:shadow-lg hover:shadow-rose-500/20 transition-all"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 text-white" />
          ) : (
            <Play className="w-4 h-4 text-white ml-0.5" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-pink-50 truncate">{title}</div>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1"
            />
            <span className="text-xs text-pink-100/40 shrink-0">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="audio-player">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Track info */}
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/15 flex items-center justify-center shrink-0">
          <Music className="w-6 h-6 text-rose-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-pink-50 truncate">{title}</h4>
          {styleTags && (
            <p className="text-xs text-pink-100/35 truncate mt-0.5">{styleTags}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onFavorite && (
            <button
              onClick={onFavorite}
              className={`p-2 rounded-lg transition-colors ${
                isFavorited
                  ? "text-rose-400"
                  : "text-pink-100/30 hover:text-rose-400"
              }`}
            >
              <Heart
                className={`w-4 h-4 ${isFavorited ? "fill-current" : ""}`}
              />
            </button>
          )}
          {src && (
            <>
              <a
                href={src}
                download
                className="p-2 text-pink-100/30 hover:text-pink-100 rounded-lg transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(src);
                }}
                className="p-2 text-pink-100/30 hover:text-pink-100 rounded-lg transition-colors"
                title="Copy link"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="relative h-1.5 bg-rose-500/10 rounded-full overflow-hidden group cursor-pointer">
          <div
            className="absolute h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
            style={{ height: "100%" }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-pink-100/30">{formatTime(currentTime)}</span>
          <span className="text-xs text-pink-100/30">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => skip(-10)}
            className="p-2 text-pink-100/40 hover:text-pink-100 transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            className="w-11 h-11 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center hover:shadow-lg hover:shadow-rose-500/25 transition-all active:scale-95"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-white" />
            ) : (
              <Play className="w-5 h-5 text-white ml-0.5" />
            )}
          </button>

          <button
            onClick={() => skip(10)}
            className="p-2 text-pink-100/40 hover:text-pink-100 transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="p-1.5 text-pink-100/40 hover:text-pink-100 transition-colors"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20"
          />
        </div>
      </div>
    </div>
  );
}
