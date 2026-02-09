export interface GenerationFormData {
  songType: "instrumental" | "vocal";
  vocalGender: "Male" | "Female" | "Auto";
  mode: "simple" | "custom";
  genre: string[];
  style: string;
  mood: string;
  tempo: "Slow" | "Medium" | "Fast";
  title: string;
  prompt: string;
  lyrics: string;
  dedicationTo: string;
  dedicationFrom: string;
  relationship: string;
  dedicationMsg: string;
  model: "V4" | "V4_5" | "V4_5PLUS" | "V4_5ALL" | "V5";
  styleWeight: number;
  weirdnessConstraint: number;
  audioWeight: number;
  negativeTags: string;
  personaId: string;
}

export interface Track {
  id: string;
  generationId: string;
  audioUrl: string | null;
  title: string | null;
  duration: number | null;
  modelUsed: string | null;
  styleTags: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export interface Generation {
  id: string;
  userId: string;
  taskId: string | null;
  status: string;
  songType: string;
  vocalGender: string | null;
  mode: string;
  genre: string | null;
  style: string | null;
  mood: string | null;
  tempo: string | null;
  title: string | null;
  prompt: string | null;
  lyrics: string | null;
  dedicationTo: string | null;
  dedicationFrom: string | null;
  relationship: string | null;
  dedicationMsg: string | null;
  model: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  tracks: Track[];
}

export const GENRES = [
  "Pop",
  "Romantic Bollywood",
  "Lo-fi",
  "EDM",
  "Acoustic",
  "Piano Ballad",
  "R&B",
  "Devotional",
  "Retro",
  "Cinematic",
] as const;

export const MOODS = [
  "Romantic",
  "Happy",
  "Emotional",
  "Dreamy",
  "Party",
  "Calm",
  "Cute",
  "Sad",
] as const;

export const RELATIONSHIPS = [
  "Crush",
  "Partner",
  "Husband/Wife",
  "Friend",
  "Long-distance",
  "Secret admirer",
] as const;

export const MODELS = ["V4", "V4_5", "V4_5PLUS", "V4_5ALL", "V5"] as const;

export const SAMPLE_PROMPTS = [
  {
    label: "Crush Confession",
    prompt:
      "A sweet and nervous confession to my crush, with butterflies in my stomach, telling them how I feel for the first time",
    mood: "Cute",
    genre: ["Pop", "Acoustic"],
    tempo: "Medium" as const,
  },
  {
    label: "Long-distance Love",
    prompt:
      "Missing someone across the miles, counting days until we meet again, the love that distance cannot break",
    mood: "Emotional",
    genre: ["Piano Ballad", "Lo-fi"],
    tempo: "Slow" as const,
  },
  {
    label: "Anniversary Vibe",
    prompt:
      "Celebrating years of love together, every moment worth cherishing, growing old with my soulmate",
    mood: "Romantic",
    genre: ["R&B", "Acoustic"],
    tempo: "Medium" as const,
  },
  {
    label: "Funny Valentine Rap",
    prompt:
      "A playful and humorous Valentine's rap about being hopelessly in love, cheesy pickup lines included",
    mood: "Happy",
    genre: ["Pop", "EDM"],
    tempo: "Fast" as const,
  },
];
