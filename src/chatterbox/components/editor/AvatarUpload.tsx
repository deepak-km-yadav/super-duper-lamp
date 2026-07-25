import * as React from "react";
import { Camera, Loader2, Upload, X } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { compressAvatarToDataUrl } from "../../lib/image-compress";
import { cn } from "../../lib/utils";

export function AvatarUpload({
  name,
  initials,
  url,
  color,
  onChange,
}: {
  name: string;
  initials?: string;
  url?: string;
  color: string;
  onChange: (dataUrl: string | undefined) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const pick = () => inputRef.current?.click();

  const onFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await compressAvatarToDataUrl(file);
      onChange(dataUrl);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "Couldn't process image");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = () => {
    onChange(undefined);
    setError(null);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
        className={cn(
          "group relative inline-block cursor-pointer rounded-full transition-all",
          drag && "ring-2 ring-accent ring-offset-2 ring-offset-bg",
        )}
        onClick={pick}
      >
        <Avatar
          name={name}
          initials={initials}
          url={url}
          color={color}
          size={64}
          className="shadow-md"
        />
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white",
            "opacity-0 transition-opacity group-hover:opacity-100",
            busy && "opacity-100",
          )}
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Camera size={16} />
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <button
          type="button"
          onClick={pick}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 hover:bg-border/40"
        >
          <Upload size={11} /> {url ? "Replace" : "Upload"}
        </button>
        {url && (
          <button
            type="button"
            onClick={remove}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-muted hover:text-red-500"
          >
            <X size={11} /> Remove
          </button>
        )}
      </div>

      {error && (
        <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-500">
          {error}
        </div>
      )}
    </div>
  );
}
