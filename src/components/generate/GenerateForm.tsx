"use client";

import { useState } from "react";
import {
  Music,
  Mic,
  Sparkles,
  Heart,
  ChevronDown,
  ChevronUp,
  Zap,
  Info,
  Wand2,
} from "lucide-react";
import { GENRES, MOODS, RELATIONSHIPS, MODELS, SAMPLE_PROMPTS } from "@/types";
import type { GenerationFormData } from "@/types";
import toast from "react-hot-toast";

interface GenerateFormProps {
  onSubmit: (data: GenerationFormData) => Promise<void>;
  isGenerating: boolean;
}

export default function GenerateForm({ onSubmit, isGenerating }: GenerateFormProps) {
  const [songType, setSongType] = useState<"instrumental" | "vocal">("vocal");
  const [vocalGender, setVocalGender] = useState<"Male" | "Female" | "Auto">("Auto");
  const [mode, setMode] = useState<"simple" | "custom">("simple");
  const [genre, setGenre] = useState<string[]>(["Pop"]);
  const [style, setStyle] = useState("");
  const [mood, setMood] = useState("Romantic");
  const [tempo, setTempo] = useState<"Slow" | "Medium" | "Fast">("Medium");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [dedicationTo, setDedicationTo] = useState("");
  const [dedicationFrom, setDedicationFrom] = useState("");
  const [relationship, setRelationship] = useState("");
  const [dedicationMsg, setDedicationMsg] = useState("");
  const [model, setModel] = useState<GenerationFormData["model"]>("V4");
  const [styleWeight, setStyleWeight] = useState(0.5);
  const [weirdnessConstraint, setWeirdnessConstraint] = useState(0.5);
  const [audioWeight, setAudioWeight] = useState(0.5);
  const [negativeTags, setNegativeTags] = useState("");
  const [personaId, setPersonaId] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  const toggleGenre = (g: string) => {
    setGenre((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  const applySample = (sample: (typeof SAMPLE_PROMPTS)[number]) => {
    setPrompt(sample.prompt);
    setMood(sample.mood);
    setGenre(sample.genre as string[]);
    setTempo(sample.tempo);
    setMode("simple");
    toast.success(`"${sample.label}" template applied!`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "custom" && !title.trim()) {
      toast.error("Custom mode requires a title");
      return;
    }
    if (mode === "custom" && !style.trim() && genre.length === 0) {
      toast.error("Custom mode requires a style");
      return;
    }
    if (mode === "custom" && songType === "vocal" && !lyrics.trim()) {
      toast.error("Custom vocal mode requires lyrics");
      return;
    }
    if (mode === "simple" && !prompt.trim()) {
      toast.error("Please enter an idea prompt");
      return;
    }

    await onSubmit({
      songType,
      vocalGender,
      mode,
      genre,
      style: style || genre.join(", "),
      mood,
      tempo,
      title,
      prompt,
      lyrics,
      dedicationTo,
      dedicationFrom,
      relationship,
      dedicationMsg,
      model,
      styleWeight,
      weirdnessConstraint,
      audioWeight,
      negativeTags,
      personaId,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Sample Templates */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Wand2 className="w-4 h-4 text-rose-400" />
          <h3 className="font-semibold text-pink-50 text-sm">Quick Templates</h3>
          <span className="text-xs text-pink-100/30">Try a sample to get started</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_PROMPTS.map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => applySample(sample)}
              className="chip hover:!border-rose-400/50 text-xs"
            >
              <Sparkles className="w-3 h-3 mr-1.5 text-rose-400" />
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      {/* A1: Song Type */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-pink-50 mb-4 flex items-center gap-2">
          <Music className="w-4 h-4 text-rose-400" />
          Song Type
        </h3>
        <div className="space-y-4">
          <div className="toggle-group">
            <button
              type="button"
              onClick={() => setSongType("vocal")}
              className={`toggle-option ${songType === "vocal" ? "toggle-option-active" : ""}`}
            >
              <Mic className="w-3.5 h-3.5 inline mr-1.5" />
              Vocal
            </button>
            <button
              type="button"
              onClick={() => setSongType("instrumental")}
              className={`toggle-option ${songType === "instrumental" ? "toggle-option-active" : ""}`}
            >
              <Music className="w-3.5 h-3.5 inline mr-1.5" />
              Instrumental
            </button>
          </div>

          {songType === "vocal" && (
            <div>
              <label className="block text-sm text-pink-100/50 mb-2">Vocal Gender</label>
              <select
                value={vocalGender}
                onChange={(e) => setVocalGender(e.target.value as typeof vocalGender)}
                className="valentine-input max-w-[200px]"
              >
                <option value="Auto">Auto</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* A2: Mode */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-pink-50 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-rose-400" />
          Mode
          <button
            type="button"
            className="relative"
            onMouseEnter={() => setShowTooltip("mode")}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <Info className="w-3.5 h-3.5 text-pink-100/30" />
            {showTooltip === "mode" && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg bg-[rgba(20,5,30,0.95)] border border-rose-500/20 text-xs text-pink-100/60 z-50">
                <strong className="text-pink-50">Simple Mode:</strong> Describe your idea and let AI do the rest.
                <br /><br />
                <strong className="text-pink-50">Custom Mode:</strong> Provide specific title, style, and lyrics for full control.
              </div>
            )}
          </button>
        </h3>
        <div className="toggle-group">
          <button
            type="button"
            onClick={() => setMode("simple")}
            className={`toggle-option ${mode === "simple" ? "toggle-option-active" : ""}`}
          >
            Simple
          </button>
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`toggle-option ${mode === "custom" ? "toggle-option-active" : ""}`}
          >
            Custom
          </button>
        </div>
      </div>

      {/* A3: Genre & Style */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-pink-50 mb-4">Genre & Style</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {GENRES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => toggleGenre(g)}
              className={`chip ${genre.includes(g) ? "chip-active" : ""}`}
            >
              {g}
            </button>
          ))}
        </div>
        <div>
          <label className="block text-sm text-pink-100/50 mb-2">
            Style Override (optional)
          </label>
          <input
            type="text"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="valentine-input"
            placeholder='e.g., "Dreamy acoustic with soft piano and strings"'
          />
        </div>
      </div>

      {/* A4: Mood & Tempo */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-pink-50 mb-4">Mood & Tempo</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-pink-100/50 mb-2">Mood</label>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMood(m)}
                  className={`chip ${mood === m ? "chip-active" : ""}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-pink-100/50 mb-2">Tempo</label>
            <div className="toggle-group">
              {(["Slow", "Medium", "Fast"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTempo(t)}
                  className={`toggle-option ${tempo === t ? "toggle-option-active" : ""}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* A5: Dedication */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-pink-50 mb-4 flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose-400" />
          Dedication (Optional)
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-pink-100/50 mb-2">To (Name)</label>
            <input
              type="text"
              value={dedicationTo}
              onChange={(e) => setDedicationTo(e.target.value)}
              className="valentine-input"
              placeholder="Their name"
            />
          </div>
          <div>
            <label className="block text-sm text-pink-100/50 mb-2">From (Name)</label>
            <input
              type="text"
              value={dedicationFrom}
              onChange={(e) => setDedicationFrom(e.target.value)}
              className="valentine-input"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-sm text-pink-100/50 mb-2">Relationship</label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="valentine-input"
            >
              <option value="">Select...</option>
              {RELATIONSHIPS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-pink-100/50 mb-2">Message</label>
            <textarea
              value={dedicationMsg}
              onChange={(e) => setDedicationMsg(e.target.value)}
              className="valentine-input min-h-[80px] resize-y"
              placeholder="A short dedication message..."
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* A6: Prompt / Lyrics */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-pink-50 mb-4">
          {mode === "simple" ? "Idea Prompt" : songType === "vocal" ? "Title, Style & Lyrics" : "Title & Theme"}
        </h3>
        <div className="space-y-4">
          {mode === "custom" && (
            <>
              <div>
                <label className="block text-sm text-pink-100/50 mb-2">
                  Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="valentine-input"
                  placeholder="Song title"
                />
              </div>
            </>
          )}

          {mode === "simple" ? (
            <div>
              <label className="block text-sm text-pink-100/50 mb-2">
                Describe your song idea <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="valentine-input min-h-[120px] resize-y"
                placeholder='e.g., "A sweet, emotional love song for my girlfriend who lives far away. Soft piano with gentle vocals, telling her how much I miss her smile..."'
                rows={4}
              />
            </div>
          ) : songType === "vocal" ? (
            <div>
              <label className="block text-sm text-pink-100/50 mb-2">
                Lyrics <span className="text-rose-400">*</span>
                <button
                  type="button"
                  className="relative ml-2"
                  onMouseEnter={() => setShowTooltip("lyrics")}
                  onMouseLeave={() => setShowTooltip(null)}
                >
                  <Info className="w-3.5 h-3.5 text-pink-100/30 inline" />
                  {showTooltip === "lyrics" && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 p-3 rounded-lg bg-[rgba(20,5,30,0.95)] border border-rose-500/20 text-xs text-pink-100/60 z-50 text-left">
                      Use structure tags for best results:
                      <br /><br />
                      <code className="text-rose-300">[Verse]</code> - Main storytelling section
                      <br />
                      <code className="text-rose-300">[Chorus]</code> - Catchy repeated section
                      <br />
                      <code className="text-rose-300">[Bridge]</code> - Contrasting middle section
                      <br />
                      <code className="text-rose-300">[Outro]</code> - Closing section
                    </div>
                  )}
                </button>
              </label>
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                className="valentine-input min-h-[200px] resize-y font-mono text-sm"
                placeholder={`[Verse]\nEvery time I see your face\nMy heart skips and starts to race\n\n[Chorus]\nYou're the one I've waited for\nMy Valentine, forever more\n\n[Bridge]\nThrough the storms and sunny days\nI'll love you in a million ways`}
                rows={8}
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm text-pink-100/50 mb-2">
                Theme Prompt (optional)
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="valentine-input min-h-[100px] resize-y"
                placeholder="Describe the instrumental theme..."
                rows={3}
              />
            </div>
          )}
        </div>
      </div>

      {/* A7: Advanced Controls */}
      <div className="glass-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full p-6 flex items-center justify-between text-left"
        >
          <span className="font-semibold text-pink-50 flex items-center gap-2">
            <Zap className="w-4 h-4 text-rose-400" />
            Advanced Controls
          </span>
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4 text-pink-100/40" />
          ) : (
            <ChevronDown className="w-4 h-4 text-pink-100/40" />
          )}
        </button>

        <div className={`accordion-content ${showAdvanced ? "open" : ""}`}>
          <div className="px-6 pb-6 space-y-5">
            {/* Model */}
            <div>
              <label className="block text-sm text-pink-100/50 mb-2">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as GenerationFormData["model"])}
                className="valentine-input max-w-[200px]"
              >
                {MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Sliders */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-pink-100/50 flex items-center gap-1">
                  Style Weight
                  <button
                    type="button"
                    className="relative"
                    onMouseEnter={() => setShowTooltip("styleWeight")}
                    onMouseLeave={() => setShowTooltip(null)}
                  >
                    <Info className="w-3 h-3 text-pink-100/30" />
                    {showTooltip === "styleWeight" && (
                      <div className="absolute bottom-full left-0 mb-2 w-56 p-3 rounded-lg bg-[rgba(20,5,30,0.95)] border border-rose-500/20 text-xs text-pink-100/60 z-50">
                        Higher values make the AI follow your style description more closely.
                      </div>
                    )}
                  </button>
                </label>
                <span className="text-xs text-rose-400 font-mono">{styleWeight.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={styleWeight}
                onChange={(e) => setStyleWeight(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-pink-100/50 flex items-center gap-1">
                  Weirdness
                  <button
                    type="button"
                    className="relative"
                    onMouseEnter={() => setShowTooltip("weirdness")}
                    onMouseLeave={() => setShowTooltip(null)}
                  >
                    <Info className="w-3 h-3 text-pink-100/30" />
                    {showTooltip === "weirdness" && (
                      <div className="absolute bottom-full left-0 mb-2 w-56 p-3 rounded-lg bg-[rgba(20,5,30,0.95)] border border-rose-500/20 text-xs text-pink-100/60 z-50">
                        Controls creative variation. Higher = more experimental, lower = more conventional.
                      </div>
                    )}
                  </button>
                </label>
                <span className="text-xs text-rose-400 font-mono">{weirdnessConstraint.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weirdnessConstraint}
                onChange={(e) => setWeirdnessConstraint(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-pink-100/50 flex items-center gap-1">
                  Audio Weight
                  <button
                    type="button"
                    className="relative"
                    onMouseEnter={() => setShowTooltip("audioWeight")}
                    onMouseLeave={() => setShowTooltip(null)}
                  >
                    <Info className="w-3 h-3 text-pink-100/30" />
                    {showTooltip === "audioWeight" && (
                      <div className="absolute bottom-full left-0 mb-2 w-56 p-3 rounded-lg bg-[rgba(20,5,30,0.95)] border border-rose-500/20 text-xs text-pink-100/60 z-50">
                        Balances between music quality and adherence to your prompt.
                      </div>
                    )}
                  </button>
                </label>
                <span className="text-xs text-rose-400 font-mono">{audioWeight.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={audioWeight}
                onChange={(e) => setAudioWeight(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Negative Tags */}
            <div>
              <label className="text-sm text-pink-100/50 mb-2 flex items-center gap-1">
                Negative Tags
                <button
                  type="button"
                  className="relative"
                  onMouseEnter={() => setShowTooltip("negative")}
                  onMouseLeave={() => setShowTooltip(null)}
                >
                  <Info className="w-3 h-3 text-pink-100/30" />
                  {showTooltip === "negative" && (
                    <div className="absolute bottom-full left-0 mb-2 w-56 p-3 rounded-lg bg-[rgba(20,5,30,0.95)] border border-rose-500/20 text-xs text-pink-100/60 z-50">
                      Styles or elements to exclude from the generation. Comma-separated.
                    </div>
                  )}
                </button>
              </label>
              <input
                type="text"
                value={negativeTags}
                onChange={(e) => setNegativeTags(e.target.value)}
                className="valentine-input"
                placeholder="e.g., heavy metal, autotune, screaming"
              />
            </div>

            {/* Persona ID */}
            <div>
              <label className="block text-sm text-pink-100/50 mb-2">
                Persona ID (optional)
              </label>
              <input
                type="text"
                value={personaId}
                onChange={(e) => setPersonaId(e.target.value)}
                className="valentine-input"
                placeholder="Leave empty for default"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isGenerating}
        className="btn-primary w-full flex items-center justify-center gap-3 !py-4 text-base"
      >
        {isGenerating ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Generating your song...
          </>
        ) : (
          <>
            <Heart className="w-5 h-5" />
            Generate Love Song
            <Sparkles className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}
