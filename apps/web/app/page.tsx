"use client";

import { Button, Link } from "@heroui/react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center">
              <span className="text-white font-bold text-sm">MB</span>
            </div>
            <span className="font-semibold text-lg">My Best</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button as={Link} href="/login" variant="light">
              Sign In
            </Button>
            <Button as={Link} href="/register" color="primary" className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white">
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-24">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            AI-Powered Personal Coach
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            Become{" "}
            <span className="text-gradient">Your Best</span>
            <br />
            Version
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            From Darts to Running, from Fitness to Chess—your AI coach observes, 
            analyzes, and adapts your training in real-time. Every rep counts.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button
              as={Link}
              href="/register"
              size="lg"
              className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-semibold px-8 shadow-lg shadow-indigo-500/25"
            >
              Start Your Journey
            </Button>
            <Button
              as={Link}
              href="#features"
              size="lg"
              variant="bordered"
              className="px-8"
            >
              See How It Works
            </Button>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center justify-center gap-8 pt-12 text-center">
            <div>
              <div className="text-3xl font-bold text-gradient">AI</div>
              <div className="text-sm text-zinc-500">Powered Coach</div>
            </div>
            <div className="h-12 w-px bg-zinc-200 dark:bg-zinc-800" />
            <div>
              <div className="text-3xl font-bold">∞</div>
              <div className="text-sm text-zinc-500">Goals Supported</div>
            </div>
            <div className="h-12 w-px bg-zinc-200 dark:bg-zinc-800" />
            <div>
              <div className="text-3xl font-bold">24/7</div>
              <div className="text-sm text-zinc-500">Progress Tracking</div>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <section id="features" className="w-full max-w-6xl mx-auto py-24 px-6">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Smart Onboarding</h3>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                Our AI interviews you to understand your goals, personality, and schedule—then crafts a perfect plan.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-cyan-500/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Video Analysis</h3>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                Record your form. Our AI analyzes your technique and provides instant feedback to optimize performance.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-purple-500/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Adaptive Plans</h3>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                Your training evolves with you. The AI adjusts intensity and focus based on your real performance data.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center">
              <span className="text-white font-bold text-xs">MB</span>
            </div>
            <span className="text-sm text-zinc-500">© 2026 My Best. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <Link href="#" className="hover:text-zinc-900 dark:hover:text-zinc-100">Privacy</Link>
            <Link href="#" className="hover:text-zinc-900 dark:hover:text-zinc-100">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
