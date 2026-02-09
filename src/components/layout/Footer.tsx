"use client";

import { Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-rose-500/10 bg-[rgba(12,0,16,0.5)] backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-pink-100/40">
            <span>Made with</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse" />
            <span>for Valentine&apos;s Day 2026</span>
          </div>
          <p className="text-sm text-pink-100/30 italic">
            &quot;Every love story is beautiful, but yours is my favorite&quot;
          </p>
        </div>
      </div>
    </footer>
  );
}
