import { create } from "zustand";
import type { Generation } from "@/types";

interface AppState {
  generations: Generation[];
  currentGeneration: Generation | null;
  isGenerating: boolean;
  pollingId: string | null;

  setGenerations: (generations: Generation[]) => void;
  addGeneration: (generation: Generation) => void;
  updateGeneration: (id: string, data: Partial<Generation>) => void;
  setCurrentGeneration: (generation: Generation | null) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setPollingId: (id: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  generations: [],
  currentGeneration: null,
  isGenerating: false,
  pollingId: null,

  setGenerations: (generations) => set({ generations }),
  addGeneration: (generation) =>
    set((state) => ({ generations: [generation, ...state.generations] })),
  updateGeneration: (id, data) =>
    set((state) => ({
      generations: state.generations.map((g) =>
        g.id === id ? { ...g, ...data } : g
      ),
      currentGeneration:
        state.currentGeneration?.id === id
          ? { ...state.currentGeneration, ...data }
          : state.currentGeneration,
    })),
  setCurrentGeneration: (generation) =>
    set({ currentGeneration: generation }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setPollingId: (pollingId) => set({ pollingId }),
}));
