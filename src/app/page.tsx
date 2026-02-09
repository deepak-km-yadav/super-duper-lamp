"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Heart, Music, Sparkles, Play, ArrowRight, Mic, Headphones } from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function LandingPage() {
  const { data: session, status } = useSession();

  if (status === "authenticated" && session) {
    redirect("/generate");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero Section */}
      <section className="flex-1 flex items-center relative overflow-hidden">
        {/* Decorative hearts */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute float-heart"
              style={{
                left: `${15 + i * 15}%`,
                top: `${20 + (i % 3) * 25}%`,
                animationDelay: `${i * 0.7}s`,
                opacity: 0.1,
              }}
            >
              <Heart
                className="text-rose-500"
                style={{
                  width: `${20 + (i % 3) * 12}px`,
                  height: `${20 + (i % 3) * 12}px`,
                }}
              />
            </div>
          ))}
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm mb-8">
                <Sparkles className="w-4 h-4" />
                AI-Powered Valentine&apos;s Music Generator
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-6"
            >
              <span className="text-pink-50">Create the Perfect</span>
              <br />
              <span className="bg-gradient-to-r from-rose-400 via-pink-400 to-rose-300 bg-clip-text text-transparent">
                Love Song
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg sm:text-xl text-pink-100/50 max-w-2xl mx-auto mb-10"
            >
              Generate personalized Valentine&apos;s Day songs with AI. Choose your genre, mood,
              and style — dedicate a unique song to the person who makes your heart sing.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link
                href="/register"
                className="btn-primary text-base flex items-center gap-2 !px-8 !py-3.5"
              >
                <Heart className="w-5 h-5" />
                Start Creating
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="btn-secondary flex items-center gap-2 !px-8 !py-3"
              >
                <Play className="w-4 h-4" />
                Sign In
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 md:py-28 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-pink-50 mb-4">
              How It Works
            </h2>
            <p className="text-pink-100/40 text-lg max-w-xl mx-auto">
              Three simple steps to create your perfect Valentine&apos;s song
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Mic,
                step: "01",
                title: "Choose Your Style",
                desc: "Select song type, genre, mood, and tempo. Pick from Pop, Lo-fi, Bollywood, Piano Ballad, and more.",
              },
              {
                icon: Heart,
                step: "02",
                title: "Write Your Dedication",
                desc: "Add lyrics, a love message, or let AI craft the perfect words. Personalize it with names and feelings.",
              },
              {
                icon: Headphones,
                step: "03",
                title: "Generate & Play",
                desc: "Hit generate and listen to your unique love song. Download, share, or save it to your library.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="glass-card glass-card-hover p-8 text-center group"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/20 flex items-center justify-center mx-auto mb-5 group-hover:border-rose-500/40 transition-colors">
                  <item.icon className="w-6 h-6 text-rose-400" />
                </div>
                <div className="text-xs font-bold text-rose-500/40 tracking-widest mb-3">
                  STEP {item.step}
                </div>
                <h3 className="text-xl font-semibold text-pink-50 mb-3">
                  {item.title}
                </h3>
                <p className="text-pink-100/40 text-sm leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t border-rose-500/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Music, label: "10+ Genres", sub: "Pop to Cinematic" },
              { icon: Sparkles, label: "AI Powered", sub: "Suno V4/V5 Models" },
              { icon: Heart, label: "Dedications", sub: "Personalized Songs" },
              { icon: Headphones, label: "In-App Player", sub: "Listen Instantly" },
            ].map((feat) => (
              <div
                key={feat.label}
                className="flex items-center gap-4 p-5 rounded-xl bg-rose-500/[0.03] border border-rose-500/[0.06] hover:border-rose-500/15 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                  <feat.icon className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <div className="font-semibold text-pink-50 text-sm">
                    {feat.label}
                  </div>
                  <div className="text-xs text-pink-100/35">{feat.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass-card p-12 relative overflow-hidden"
          >
            <div className="absolute top-4 right-4 float-heart" style={{ animationDelay: "0.5s" }}>
              <Heart className="w-6 h-6 text-rose-500/20" />
            </div>
            <Heart className="w-10 h-10 text-rose-500/30 mx-auto mb-6" />
            <h2 className="text-2xl sm:text-3xl font-bold text-pink-50 mb-4">
              Make This Valentine&apos;s Unforgettable
            </h2>
            <p className="text-pink-100/40 mb-8 max-w-lg mx-auto">
              Create a one-of-a-kind love song in minutes. No musical experience needed.
            </p>
            <Link
              href="/register"
              className="btn-primary inline-flex items-center gap-2 text-base !px-10 !py-3.5"
            >
              <Heart className="w-5 h-5" />
              Create Your Song Now
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
