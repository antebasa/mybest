"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, Input, Chip, Progress, Spinner, Slider } from "@heroui/react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Goal {
  id: string;
  title: string;
  type: string;
  progress: number;
  status: "active" | "completed" | "paused";
  created_at: string;
}

const GOAL_TYPES = [
  { id: "darts", label: "Darts", icon: "🎯" },
  { id: "running", label: "Running", icon: "🏃" },
  { id: "bodyweight", label: "Bodyweight", icon: "💪" },
  { id: "weightloss", label: "Weight Loss", icon: "⚖️" },
  { id: "habit", label: "Habit Building", icon: "✨" },
  { id: "custom", label: "Custom Goal", icon: "🎨" },
];

const EXPERIENCE_LEVELS = [
  { value: "beginner", label: "Complete Beginner" },
  { value: "some_experience", label: "Some Experience" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [customGoal, setCustomGoal] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("beginner");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [minutesPerSession, setMinutesPerSession] = useState(30);
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState(1);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchGoals();
  }, []);

  async function fetchGoals() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setGoals(data);
    }
    setLoading(false);
  }

  function handleOpenModal() {
    setShowModal(true);
  }

  function handleCloseModal() {
    setSelectedType(null);
    setCustomGoal("");
    setStep(1);
    setShowModal(false);
  }

  async function handleCreateGoal() {
    if (!selectedType) return;
    setIsCreating(true);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error("Auth error:", authError);
        throw new Error("Authentication error: " + authError.message);
      }
      
      if (!user) {
        throw new Error("Not authenticated - please log in first");
      }

      console.log("Creating goal for user:", user.id);

      // Ensure public user record exists
      const { data: publicUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!publicUser) {
        console.log("Public user missing, creating...");
        const { error: createUserError } = await supabase
          .from("users")
          .insert({
            id: user.id,
            email: user.email!,
            full_name: user.user_metadata?.full_name,
            auth_provider_id: user.id,
            updated_at: new Date().toISOString(),
          });

        if (createUserError) {
          console.error("Error creating public user:", createUserError);
          throw new Error("Failed to initialize user account: " + createUserError.message);
        }
      }

      // Ensure user profile exists
      const { data: existingProfile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!existingProfile) {
        console.log("User profile missing, creating...");
        const { error: createProfileError } = await supabase
          .from("user_profiles")
          .insert({
            user_id: user.id,
            updated_at: new Date().toISOString(),
          });

        if (createProfileError) {
          console.error("Error creating user profile:", createProfileError);
          // Continue anyway, profile is optional for goal creation but useful for plan gen
        }
      }

      const goalTitle = selectedType === "custom"  
        ? customGoal 
        : GOAL_TYPES.find(t => t.id === selectedType)?.label || "New Goal";

      const { data: goal, error } = await supabase
        .from("goals")
        .insert({
          user_id: user.id,
          title: goalTitle,
          type: selectedType,
          status: "active",
          progress: 0,
        })
        .select()
        .single();

      if (error) {
        console.error("Supabase error:", error);
        throw new Error("Database error: " + (error.message || error.code || JSON.stringify(error)));
      }
      
      console.log("Goal created:", goal);

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      const planResponse = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalId: goal.id,
          goalTitle,
          goalType: selectedType,
          experienceLevel,
          schedule: { daysPerWeek, minutesPerSession },
          userProfile: profile,
        }),
      });

      const planResult = await planResponse.json();
      
      handleCloseModal();
      await fetchGoals();
      
      if (planResult.success) {
        router.push("/plans");
      }
    } catch (error: any) {
      console.error("Error creating goal:", error);
      // Show user-friendly error
      const message = error?.message || "Unknown error occurred";
      alert("Failed to create goal: " + message);
    } finally {
      setIsCreating(false);
    }
  }

  function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.classList.contains("dark");
    if (isDark) {
      html.classList.remove("dark");
      localStorage.setItem("mybest-theme", "light");
    } else {
      html.classList.add("dark");
      localStorage.setItem("mybest-theme", "dark");
    }
  }

  function getGoalIcon(type: string) {
    return GOAL_TYPES.find(t => t.id === type)?.icon || "🎯";
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 p-4 hidden lg:flex flex-col z-50">
        <Link href="/dashboard" className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center">
            <span className="text-white font-bold">MB</span>
          </div>
          <span className="font-semibold text-xl text-zinc-900 dark:text-white">My Best</span>
        </Link>

        <nav className="flex-1 space-y-1">
          <NavItem icon="🏠" label="Dashboard" href="/dashboard" />
          <NavItem icon="🎯" label="Goals" href="/goals" active />
          <NavItem icon="📋" label="Plans" href="/plans" />
          <NavItem icon="📅" label="Calendar" href="/calendar" />
          <NavItem icon="💬" label="AI Coach" href="/onboarding" />
          <NavItem icon="📊" label="Progress" href="/progress" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64">
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">My Goals</h1>
              <p className="text-sm text-zinc-500">{goals.filter(g => g.status === "active").length} active goals</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer"
              >
                <span className="text-lg">🌓</span>
              </button>
              {/* New Goal Button */}
              <button
                type="button"
                onClick={handleOpenModal}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-xl font-medium shadow-lg hover:opacity-90 cursor-pointer"
              >
                + New Goal
              </button>
            </div>
          </div>
        </header>

        <div className="p-6">
          {goals.length === 0 ? (
            <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <CardBody className="py-16 text-center">
                <div className="text-6xl mb-4">🎯</div>
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
                  Set Your First Goal
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-md mx-auto">
                  Choose what you want to improve and our AI will create a personalized training plan just for you.
                </p>
                <button
                  type="button"
                  onClick={handleOpenModal}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-xl font-medium text-lg shadow-lg hover:opacity-90 cursor-pointer"
                >
                  Create Your First Goal
                </button>
              </CardBody>
            </Card>
          ) : (
            <>
              {/* Active Goals */}
              <section className="mb-8">
                <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-white">Active Goals</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {goals.filter(g => g.status === "active").map((goal) => (
                    <GoalCard key={goal.id} goal={goal} icon={getGoalIcon(goal.type)} />
                  ))}
                </div>
              </section>

              {/* Completed Goals */}
              {goals.filter(g => g.status === "completed").length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-white">Completed</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {goals.filter(g => g.status === "completed").map((goal) => (
                      <GoalCard key={goal.id} goal={goal} icon={getGoalIcon(goal.type)} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      {/* Custom Modal - No HeroUI */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleCloseModal}
          />
          
          {/* Modal Content */}
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] overflow-auto">
            {/* Header */}
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Create New Goal</h2>
              <div className="flex items-center gap-2 mt-2">
                {[1, 2].map((s) => (
                  <div 
                    key={s}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      s <= step ? "bg-indigo-500" : "bg-zinc-200 dark:bg-zinc-700"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              {step === 1 && (
                <>
                  <p className="text-zinc-500 dark:text-zinc-400 mb-4">What do you want to improve?</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {GOAL_TYPES.map((type) => (
                      <button
                        type="button"
                        key={type.id}
                        onClick={() => setSelectedType(type.id)}
                        className={`p-4 rounded-xl border-2 transition-all text-center cursor-pointer ${
                          selectedType === type.id
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                            : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                        }`}
                      >
                        <span className="text-2xl block mb-1">{type.icon}</span>
                        <span className="text-sm font-medium text-zinc-900 dark:text-white">{type.label}</span>
                      </button>
                    ))}
                  </div>
                  
                  {selectedType === "custom" && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        Goal Name
                      </label>
                      <input
                        type="text"
                        placeholder="What's your goal?"
                        value={customGoal}
                        onChange={(e) => setCustomGoal(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      />
                    </div>
                  )}
                </>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <p className="text-zinc-500 dark:text-zinc-400">
                    Tell us about your experience and schedule.
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Experience Level
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {EXPERIENCE_LEVELS.map((level) => (
                        <button
                          type="button"
                          key={level.value}
                          onClick={() => setExperienceLevel(level.value)}
                          className={`p-3 rounded-lg border-2 text-sm transition-all cursor-pointer ${
                            experienceLevel === level.value
                              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300"
                              : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"
                          }`}
                        >
                          {level.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Days per Week: <span className="text-indigo-500">{daysPerWeek}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="7"
                      value={daysPerWeek}
                      onChange={(e) => setDaysPerWeek(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Minutes per Session: <span className="text-indigo-500">{minutesPerSession}</span>
                    </label>
                    <input
                      type="range"
                      min="15"
                      max="120"
                      step="5"
                      value={minutesPerSession}
                      onChange={(e) => setMinutesPerSession(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
              {step === 1 ? (
                <>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!selectedType || (selectedType === "custom" && !customGoal)}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-xl font-medium disabled:opacity-50 cursor-pointer"
                  >
                    Next →
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateGoal}
                    disabled={isCreating}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-xl font-medium disabled:opacity-50 cursor-pointer"
                  >
                    {isCreating ? "Generating Plan..." : "Create Goal"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, label, href, active = false }: { icon: string; label: string; href: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
        active
          ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}

function GoalCard({ goal, icon }: { goal: Goal; icon: string }) {
  return (
    <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      <CardHeader className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-cyan-100 dark:from-indigo-900/30 dark:to-cyan-900/30 flex items-center justify-center text-2xl">
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-white">{goal.title}</h3>
            <p className="text-sm text-zinc-500">{new Date(goal.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <Chip size="sm" variant="flat" color={goal.status === "active" ? "primary" : "success"}>
          {goal.status}
        </Chip>
      </CardHeader>
      <CardBody className="pt-0">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Progress</span>
            <span className="font-medium text-zinc-900 dark:text-white">{goal.progress}%</span>
          </div>
          <Progress value={goal.progress} color="primary" />
        </div>
        <div className="flex gap-2 mt-4">
          <Link href="/plans" className="flex-1">
            <button className="w-full px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer">
              View Plan
            </button>
          </Link>
          <Link href="/calendar" className="flex-1">
            <button className="w-full px-3 py-2 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 cursor-pointer">
              Train
            </button>
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
