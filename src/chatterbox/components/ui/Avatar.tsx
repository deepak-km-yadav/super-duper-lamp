import * as React from "react";
import { cn } from "../../lib/utils";

export function Avatar({
  name,
  initials,
  url,
  color,
  size = 40,
  className,
}: {
  name?: string;
  initials?: string;
  url?: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  const [imgErrored, setImgErrored] = React.useState(false);
  React.useEffect(() => {
    setImgErrored(false);
  }, [url]);

  const text = (initials || name || "B").slice(0, 2).toUpperCase();
  const bg = color || "#0ea5e9";
  const showImage = !!url && !imgErrored;

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-semibold text-white shadow-sm overflow-hidden shrink-0",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4, background: bg }}
    >
      {showImage ? (
        <img
          src={url}
          alt={name || "avatar"}
          className="h-full w-full object-cover"
          onError={() => setImgErrored(true)}
        />
      ) : (
        <span>{text}</span>
      )}
    </div>
  );
}
