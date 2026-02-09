import type { Metadata } from "next";
import Providers from "@/components/layout/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Valentine Music Maker - Create Beautiful Love Songs",
  description:
    "Generate personalized Valentine's Day songs with AI. Choose genre, mood, and style to create the perfect love song for your special someone.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
