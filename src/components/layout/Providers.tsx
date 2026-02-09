"use client";

import { Toaster } from "react-hot-toast";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          className: "toast-valentine",
          duration: 4000,
          style: {
            background: "rgba(30, 10, 40, 0.95)",
            border: "1px solid rgba(244, 63, 94, 0.2)",
            color: "#fdf2f8",
          },
        }}
      />
    </>
  );
}
