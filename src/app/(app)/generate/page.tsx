"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import GenerateForm from "@/components/generate/GenerateForm";
import GenerationProgress from "@/components/generate/GenerationProgress";
import ResultCard from "@/components/generate/ResultCard";
import Onboarding from "@/components/generate/Onboarding";
import type { GenerationFormData, Generation } from "@/types";
import toast from "react-hot-toast";

export default function GeneratePage() {
  const { data: session, status } = useSession();
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGeneration, setCurrentGeneration] = useState<Generation | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
  }, [status]);

  const pollStatus = useCallback((generationId: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/suno/status?id=${generationId}`);
        if (!res.ok) return;

        const data = await res.json();
        setCurrentGeneration(data);

        if (data.status === "completed") {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setIsGenerating(false);
          toast.success("Your love song is ready!");
          // Auto scroll to results
          setTimeout(() => {
            resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 300);
        } else if (data.status === "failed") {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setIsGenerating(false);
          toast.error(data.errorMessage || "Generation failed");
        }
      } catch {
        // Keep polling on network errors
      }
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const handleGenerate = async (formData: GenerationFormData) => {
    setIsGenerating(true);
    setCurrentGeneration(null);

    try {
      const res = await fetch("/api/suno/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Generation failed");
        setIsGenerating(false);
        return;
      }

      // Set initial state
      setCurrentGeneration({
        id: data.id,
        taskId: data.taskId,
        status: data.status || "processing",
        userId: session?.user?.id || "",
        songType: formData.songType,
        vocalGender: formData.vocalGender,
        mode: formData.mode,
        genre: formData.genre.join(", "),
        style: formData.style,
        mood: formData.mood,
        tempo: formData.tempo,
        title: formData.title,
        prompt: formData.prompt,
        lyrics: formData.lyrics,
        dedicationTo: formData.dedicationTo,
        dedicationFrom: formData.dedicationFrom,
        relationship: formData.relationship,
        dedicationMsg: formData.dedicationMsg,
        model: formData.model,
        errorMessage: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tracks: [],
      });

      toast.success("Generation started! Creating your song...");
      pollStatus(data.id);
    } catch {
      toast.error("Failed to start generation");
      setIsGenerating(false);
    }
  };

  const handleFavorite = async (trackId: string) => {
    try {
      await fetch("/api/user/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId }),
      });
      toast.success("Added to favorites!");
    } catch {
      toast.error("Failed to favorite");
    }
  };

  if (status === "loading") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-pink-50 flex items-center gap-3">
          <Sparkles className="w-7 h-7 text-rose-400" />
          Generate Love Song
        </h1>
        <p className="text-pink-100/40 mt-2">
          Fill in the options below and let AI create a beautiful song for your Valentine.
        </p>
      </div>

      {/* Onboarding */}
      <Onboarding />

      {/* Generation Progress */}
      {currentGeneration && currentGeneration.status !== "completed" && (
        <div className="mb-8">
          <GenerationProgress
            status={currentGeneration.status}
            errorMessage={currentGeneration.errorMessage}
          />
        </div>
      )}

      {/* Results */}
      {currentGeneration?.status === "completed" && currentGeneration.tracks.length > 0 && (
        <div ref={resultsRef} className="mb-10">
          <h2 className="text-xl font-semibold text-pink-50 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-rose-400" />
            Your Generated Tracks
          </h2>
          <div className="space-y-4">
            {currentGeneration.tracks.map((track, i) => (
              <ResultCard
                key={track.id}
                track={track}
                isNew={i === 0}
                onFavorite={() => handleFavorite(track.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      <GenerateForm onSubmit={handleGenerate} isGenerating={isGenerating} />
    </div>
  );
}
