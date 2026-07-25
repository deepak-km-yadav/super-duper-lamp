import * as React from "react";
import { BookOpen, FileText, Loader2, Plus, X } from "lucide-react";
import { Button } from "../ui/Button";
import {
  KB_MAX_FILE_SIZE,
  extractTextClient,
  isClientSideExtractable,
  isServerSideExtractable,
  makeKnowledgeDoc,
} from "../../lib/knowledge";
import type { KnowledgeDoc } from "../../lib/types";
import { cn } from "../../lib/utils";

export function KnowledgeUpload({
  docs,
  onChange,
}: {
  docs: KnowledgeDoc[];
  onChange: (docs: KnowledgeDoc[]) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    setError(null);
    setBusy(true);
    const list = Array.from(files);
    try {
      const next: KnowledgeDoc[] = [...docs];
      for (const file of list) {
        if (file.size > KB_MAX_FILE_SIZE) {
          throw new Error(
            `${file.name}: file too large (max ${(KB_MAX_FILE_SIZE / 1024).toFixed(0)} KB)`,
          );
        }
        let content = "";
        if (isClientSideExtractable(file.type, file.name)) {
          content = await extractTextClient(file);
        } else if (isServerSideExtractable(file.type, file.name)) {
          throw new Error(
            `${file.name}: PDF/DOCX extraction requires a server and is not supported in local mode. Convert to .txt or .md first.`,
          );
        } else {
          throw new Error(`${file.name}: unsupported type`);
        }
        next.push(
          makeKnowledgeDoc(
            file.name,
            file.type || "application/octet-stream",
            content,
          ),
        );
      }
      onChange(next);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeDoc = (id: string) => {
    onChange(docs.filter((d) => d.id !== id));
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-accent/15 text-accent">
          <BookOpen size={14} />
        </div>
        <div className="text-sm font-medium">Knowledge base</div>
        <span className="ml-1 text-[10px] text-muted">
          {docs.length} {docs.length === 1 ? "doc" : "docs"} ·{" "}
          {(docs.reduce((a, d) => a + d.charCount, 0) / 1000).toFixed(1)}k chars
        </span>
      </div>

      {docs.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {docs.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-bg/40 px-2.5 py-1.5"
            >
              <FileText size={14} className="text-muted" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{d.fileName}</div>
                <div className="text-[10px] text-muted">
                  {(d.charCount / 1000).toFixed(1)}k chars
                </div>
              </div>
              <button
                onClick={() => removeDoc(d.id)}
                className="rounded p-1 text-muted hover:bg-border/40 hover:text-red-500"
                title="Remove"
                aria-label="Remove document"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-3 py-4 text-center text-xs transition-colors",
          drag
            ? "border-accent bg-accent/5 text-accent"
            : "border-border bg-bg/30 text-muted hover:border-accent hover:bg-accent/5 hover:text-fg",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".txt,.md,.markdown,.csv,.json,text/plain,text/markdown,text/csv,application/json"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Extracting…
          </span>
        ) : (
          <>
            <Plus size={16} className="mb-1" />
            <span className="font-medium">Attach knowledge</span>
            <span className="mt-0.5 text-[10px] text-muted">
              .txt · .md · .csv · .json (max 1 MB each)
            </span>
          </>
        )}
      </label>

      {error && (
        <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-500">
          {error}
        </div>
      )}
      <Button className="hidden" />
    </div>
  );
}
