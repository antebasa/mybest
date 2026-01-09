"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, Chip, Progress, Spinner } from "@heroui/react";
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

// ============================================
// EXPANDED GOAL TYPES (Phase 2)
// ============================================

const GOAL_TYPES = [
  { id: "darts", label: "Darts", icon: "🎯", description: "Improve accuracy and consistency" },
  { id: "running", label: "Running", icon: "🏃", description: "Build endurance and speed" },
  { id: "bodyweight", label: "Bodyweight / Calisthenics", icon: "💪", description: "Master your body weight" },
  { id: "weightloss", label: "Weight Loss", icon: "⚖️", description: "Achieve your target weight" },
  { id: "weighttraining", label: "Weight Training", icon: "🏋️", description: "Build strength and muscle" },
  { id: "football", label: "Football / Soccer", icon: "⚽", description: "Improve your game" },
  { id: "tennis", label: "Tennis / Racquet Sports", icon: "🎾", description: "Perfect your technique" },
  { id: "habit", label: "Habit Building", icon: "✨", description: "Create lasting habits" },
  { id: "custom", label: "Custom Goal", icon: "🎨", description: "Anything else you want to improve" },
];

const EXPERIENCE_LEVELS = [
  { value: "beginner", label: "Complete Beginner", description: "Never tried this before" },
  { value: "some_experience", label: "Some Experience", description: "Tried a few times casually" },
  { value: "intermediate", label: "Intermediate", description: "Regular practice, some skill" },
  { value: "advanced", label: "Advanced", description: "Significant experience" },
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
  const [shortTermGoal, setShortTermGoal] = useState("");
  const [longTermGoal, setLongTermGoal] = useState("");
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
    setShortTermGoal("");
    setLongTermGoal("");
    setExperienceLevel("beginner");
    setDaysPerWeek(3);
    setMinutesPerSession(30);
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

      // Ensure public user record exists
      const { data: publicUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!publicUser) {
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
        const { error: createProfileError } = await supabase
          .from("user_profiles")
          .insert({
            user_id: user.id,
            updated_at: new Date().toISOString(),
          });

        if (createProfileError) {
          console.error("Error creating user profile:", createProfileError);
        }
      }

      const goalTitle = selectedType === "custom"  
        ? customGoal 
        : GOAL_TYPES.find(t => t.id === selectedType)?.label || "New Goal";

      // Create the goal with extended data
      const { data: goal, error } = await supabase
        .from("goals")
        .insert({
          user_id: user.id,
          title: goalTitle,
          type: selectedType,
          status: "active",
          progress: 0,
          current_level: experienceLevel,
          description: `Short-term: ${shortTermGoal || "Not specified"}\nLong-term: ${longTermGoal || "Not specified"}`,
          ai_conversation: [], // Will be populated during chat
        })
        .select()
        .single();

      if (error) {
        console.error("Supabase error:", error);
        throw new Error("Database error: " + (error.message || error.code || JSON.stringify(error)));
      }
      
      console.log("Goal created:", goal);
      
      handleCloseModal();
      
      // Navigate to the AI chat for this goal (Phase 2 key feature!)
      router.push(`/goals/${goal.id}/chat?` + new URLSearchParams({
        goalTitle,
        goalType: selectedType,
        experienceLevel,
        daysPerWeek: daysPerWeek.toString(),
        minutesPerSession: minutesPerSession.toString(),
        shortTermGoal: shortTermGoal || "",
        longTermGoal: longTermGoal || "",
      }));
      
    } catch (error: any) {
      console.error("Error creating goal:", error);
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
          <NavItem icon="💬" label="AI Coach" href="/chat" />
          <NavItem icon="📊" label="Progress" href="/progress" />
          <NavItem icon="⚙️" label="Settings" href="/settings" />
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
                  Choose what you want to improve and our AI will have a conversation with you to create a personalized training plan.
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

      {/* Custom Modal - Multi-Step Goal Creation */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleCloseModal}
          />
          
          {/* Modal Content */}
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-auto">
            {/* Header */}
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Create New Goal</h2>
              <div className="flex items-center gap-2 mt-2">
                {[1, 2, 3].map((s) => (
                  <div 
                    key={s}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      s <= step ? "bg-gradient-to-r from-indigo-500 to-cyan-500" : "bg-zinc-200 dark:bg-zinc-700"
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm text-zinc-500 mt-2">
                Step {step} of 3: {step === 1 ? "Choose Goal Type" : step === 2 ? "Your Details" : "Your Vision"}
              </p>
            </div>

            {/* Body */}
            <div className="p-6">
              {/* Step 1: Goal Type Selection */}
              {step === 1 && (
                <>
                  <p className="text-zinc-500 dark:text-zinc-400 mb-4">What do you want to improve?</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {GOAL_TYPES.map((type) => (
                      <button
                        type="button"
                        key={type.id}
                        onClick={() => setSelectedType(type.id)}
                        className={`p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${
                          selectedType === type.id
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                            : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                        }`}
                      >
                        <span className="text-2xl block mb-2">{type.icon}</span>
                        <span className="text-sm font-medium text-zinc-900 dark:text-white block">{type.label}</span>
                        <span className="text-xs text-zinc-500 mt-1 block">{type.description}</span>
                      </button>
                    ))}
                  </div>
                  
                  {selectedType === "custom" && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        Describe your goal
                      </label>
                      <input
                        type="text"
                        placeholder="What do you want to achieve?"
                        value={customGoal}
                        onChange={(e) => setCustomGoal(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Step 2: Experience & Schedule */}
              {step === 2 && (
                <div className="space-y-6">
                  <p className="text-zinc-500 dark:text-zinc-400">
                    Tell us about your experience and availability.
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
                          className={`p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${
                            experienceLevel === level.value
                              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                              : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
                          }`}
                        >
                          <span className={`text-sm font-medium block ${
                            experienceLevel === level.value 
                              ? "text-indigo-700 dark:text-indigo-300" 
                              : "text-zinc-700 dark:text-zinc-300"
                          }`}>
                            {level.label}
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">{level.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Days per Week: <span className="text-indigo-500 font-bold">{daysPerWeek}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="7"
                      value={daysPerWeek}
                      onChange={(e) => setDaysPerWeek(parseInt(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                    <div className="flex justify-between text-xs text-zinc-400 mt-1">
                      <span>1 day</span>
                      <span>7 days</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Minutes per Session: <span className="text-indigo-500 font-bold">{minutesPerSession}</span>
                    </label>
                    <input
                      type="range"
                      min="15"
                      max="120"
                      step="5"
                      value={minutesPerSession}
                      onChange={(e) => setMinutesPerSession(parseInt(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                    <div className="flex justify-between text-xs text-zinc-400 mt-1">
                      <span>15 min</span>
                      <span>2 hours</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Short-term & Long-term Goals */}
              {step === 3 && (
                <div className="space-y-6">
                  <p className="text-zinc-500 dark:text-zinc-400">
                    Help us understand what success looks like for you.
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Short-term Goal <span className="text-zinc-400 font-normal">(2-4 weeks)</span>
                    </label>
                    <textarea
                      placeholder="What do you want to achieve in the next few weeks? Be specific!"
                      value={shortTermGoal}
                      onChange={(e) => setShortTermGoal(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white resize-none"
                    />
                    <p className="text-xs text-zinc-400 mt-1">
                      Example: "Hit the bullseye 20 times in a row" or "Run 5km without stopping"
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Long-term Vision <span className="text-zinc-400 font-normal">(2-3 months)</span>
                    </label>
                    <textarea
                      placeholder="Where do you see yourself in a few months?"
                      value={longTermGoal}
                      onChange={(e) => setLongTermGoal(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white resize-none"
                    />
                    <p className="text-xs text-zinc-400 mt-1">
                      Example: "Consistently score 60+ in darts" or "Complete a half marathon"
                    </p>
                  </div>

                  {/* Preview Card */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-cyan-50 dark:from-indigo-900/20 dark:to-cyan-900/20 border border-indigo-200 dark:border-indigo-800">
                    <h4 className="font-medium text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
                      {GOAL_TYPES.find(t => t.id === selectedType)?.icon} Your Goal Summary
                    </h4>
                    <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                      <li>📌 <strong>Goal:</strong> {selectedType === "custom" ? customGoal : GOAL_TYPES.find(t => t.id === selectedType)?.label}</li>
                      <li>📊 <strong>Level:</strong> {EXPERIENCE_LEVELS.find(l => l.value === experienceLevel)?.label}</li>
                      <li>📅 <strong>Schedule:</strong> {daysPerWeek} days/week, {minutesPerSession} min/session</li>
                    </ul>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-3">
                      💬 Next: AI will chat with you to refine your plan
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-between gap-3">
              {step === 1 && (
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
                    className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-xl font-medium disabled:opacity-50 cursor-pointer"
                  >
                    Next →
                  </button>
                </>
              )}
              {step === 2 && (
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
                    onClick={() => setStep(3)}
                    className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-xl font-medium cursor-pointer"
                  >
                    Next →
                  </button>
                </>
              )}
              {step === 3 && (
                <>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateGoal}
                    disabled={isCreating}
                    className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-xl font-medium disabled:opacity-50 cursor-pointer flex items-center gap-2"
                  >
                    {isCreating ? (
                      <>
                        <Spinner size="sm" color="white" />
                        Creating...
                      </>
                    ) : (
                      <>
                        Start AI Chat
                        <span>💬</span>
                      </>
                    )}
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
          <Link href={`/goals/${goal.id}/chat`} className="flex-1">
            <button className="w-full px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer">
              💬 Chat
            </button>
          </Link>
          <Link href="/plans" className="flex-1">
            <button className="w-full px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer">
              📋 Plan
            </button>
          </Link>
          <Link href="/calendar" className="flex-1">
            <button className="w-full px-3 py-2 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 cursor-pointer">
              🏋️ Train
            </button>
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
