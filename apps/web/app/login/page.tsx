"use client";

import { useState } from "react";
import { Button, Input, Link, Divider } from "@heroui/react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24">
        <div className="absolute top-6 left-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center">
              <span className="text-white font-bold text-sm">MB</span>
            </div>
            <span className="font-semibold text-lg">My Best</span>
          </Link>
        </div>
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>

        <div className="max-w-sm w-full mx-auto">
          <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-bold">Welcome back</h1>
            <p className="text-zinc-500 dark:text-zinc-400">
              Sign in to continue your journey
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <Input
              type="email"
              label="Email"
              labelPlacement="outside"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              variant="bordered"
              isRequired
              classNames={{
                inputWrapper: "bg-white dark:bg-zinc-900",
                label: "text-zinc-700 dark:text-zinc-300 font-medium",
              }}
            />

            <Input
              type="password"
              label="Password"
              labelPlacement="outside"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              variant="bordered"
              isRequired
              classNames={{
                inputWrapper: "bg-white dark:bg-zinc-900",
                label: "text-zinc-700 dark:text-zinc-300 font-medium",
              }}
            />

            <div className="flex justify-end">
              <Link href="/forgot-password" size="sm" className="text-indigo-500">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-semibold"
              size="lg"
            >
              Sign In
            </Button>
          </form>

          <Divider className="my-8" />

          <p className="text-center text-zinc-500 dark:text-zinc-400 text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-indigo-500 font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side - Visual */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 p-12 items-center justify-center">
        <div className="max-w-lg text-white space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-4xl font-bold">
            Your AI Coach is waiting
          </h2>
          <p className="text-white/80 text-lg">
            Pick up where you left off. Your personalized training plan adapts to your schedule and progress—every single day.
          </p>
          <div className="flex items-center gap-4 pt-4">
            <div className="flex -space-x-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full bg-white/30 border-2 border-white flex items-center justify-center text-xs font-bold"
                >
                  {["🎯", "🏃", "💪", "🧠"][i]}
                </div>
              ))}
            </div>
            <span className="text-white/80 text-sm">Join thousands improving daily</span>
          </div>
        </div>
      </div>
    </div>
  );
}
