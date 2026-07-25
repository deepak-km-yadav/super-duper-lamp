import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input, Label } from "../components/ui/Input";
import { TEMPLATES } from "../lib/templates";
import { initialsFromName } from "../lib/utils";
import { createLocal } from "../lib/local-store";

export function NewBotPage() {
  const navigate = useNavigate();
  const [templateId, setTemplateId] = React.useState("blank");
  const [name, setName] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const tpl = TEMPLATES.find((t) => t.id === templateId)!;

  const create = () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const bot = createLocal({
        name: name.trim(),
        bio: bio.trim(),
        systemPrompt: tpl.systemPrompt,
        greeting: tpl.greeting,
        starterPrompts: tpl.starterPrompts,
        themeColor: tpl.themeColor,
        tags: tpl.tags,
        avatarInitials: initialsFromName(name),
      });
      navigate(`/chatterbox/bots/${bot.id}/edit`);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "Failed to create bot");
      setBusy(false);
    }
  };

  return (
    <div className="bg-orbs" style={{ minHeight: "100%" }}>
      <main className="relative mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-10">
        <div className="mb-6 animate-slide-down text-center sm:mb-8">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted backdrop-blur">
            <Sparkles size={12} className="text-accent animate-pulse" /> Step 1 of 2
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Create a new <span className="gradient-text">Bot</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            Pick a starting point and give your bot an identity. You can change everything later.
          </p>
        </div>

        <div className="animate-slide-up space-y-6 rounded-2xl border border-border bg-surface/70 p-6 backdrop-blur">
          <div>
            <Label>Pick a template</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={`card-lift rounded-lg border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    templateId === t.id
                      ? "border-accent bg-accent/5 ring-2 ring-accent/30"
                      : "border-border hover:border-muted"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: t.themeColor }}
                    />
                    <span className="text-sm font-medium">{t.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. RecipeBot, Study Buddy, Customer Support"
              maxLength={50}
            />
          </div>

          <div>
            <Label>Tagline (optional)</Label>
            <Input
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A one-liner that hooks people"
              maxLength={200}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={create} disabled={!name.trim() || busy}>
              {busy ? "Creating…" : "Continue"} <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
