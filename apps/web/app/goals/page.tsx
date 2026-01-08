"use client";

import { useState, useEffect } from "react";
import { Button, Card, CardBody, CardHeader, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Chip, Progress, Spinner, Select, SelectItem, Slider } from "@heroui/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Goal {
  id: string;
  title: string;
  goal_type: string;
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
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [customGoal, setCustomGoal] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("beginner");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [minutesPerSession, setMinutesPerSession] = useState(30);
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState(1);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchGoals();
  }, []);

  async function fetchGoals() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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

  async function handleCreateGoal() {
    if (!selectedType) return;
    setIsCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const goalTitle = selectedType === "custom" 
        ? customGoal 
        : GOAL_TYPES.find(t => t.id === selectedType)?.label || "New Goal";

      // Create the goal in the database
      const { data: goal, error } = await supabase
        .from("goals")
        .insert({
          user_id: user.id,
          title: goalTitle,
          goal_type: selectedType,
          status: "active",
          progress: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Get user profile for AI context
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // Generate AI training plan
      const planResponse = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalId: goal.id,
          goalTitle,
          goalType: selectedType,
          experienceLevel,
          schedule: {
            daysPerWeek,
            minutesPerSession,
          },
          userProfile: profile,
        }),
      });

      const planResult = await planResponse.json();
      
      // Reset form and refresh goals
      setSelectedType(null);
      setCustomGoal("");
      setExperienceLevel("beginner");
      setDaysPerWeek(3);
      setMinutesPerSession(30);
      setStep(1);
      onOpenChange(false);
      
      await fetchGoals();
      
      // Redirect to plans page to see the generated plan
      if (planResult.success) {
        router.push("/plans");
      }
    } catch (error) {
      console.error("Error creating goal:", error);
    } finally {
      setIsCreating(false);
    }
  }

  function closeModal() {
    setSelectedType(null);
    setCustomGoal("");
    setStep(1);
    onOpenChange(false);
  }

  function getGoalIcon(type: string) {
    return GOAL_TYPES.find(t => t.id === type)?.icon || "🎯";
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 p-4 hidden lg:flex flex-col">
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
          <NavItem icon="⚙️" label="Settings" href="/settings" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64">
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">My Goals</h1>
              <p className="text-sm text-zinc-500">{goals.filter(g => g.status === "active").length} active goals</p>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Button 
                color="primary" 
                className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/25"
                onPress={onOpen}
              >
                + New Goal
              </Button>
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
                <Button 
                  color="primary" 
                  size="lg"
                  className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white"
                  onPress={onOpen}
                >
                  Create Your First Goal
                </Button>
              </CardBody>
            </Card>
          ) : (
            <>
              {/* Active Goals */}
              <section className="mb-8">
                <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-white">Active Goals</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {goals.filter(g => g.status === "active").map((goal) => (
                    <GoalCard key={goal.id} goal={goal} icon={getGoalIcon(goal.goal_type)} />
                  ))}
                </div>
              </section>

              {/* Completed Goals */}
              {goals.filter(g => g.status === "completed").length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-white">Completed</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {goals.filter(g => g.status === "completed").map((goal) => (
                      <GoalCard key={goal.id} goal={goal} icon={getGoalIcon(goal.goal_type)} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      {/* New Goal Modal - Multi-step */}
      <Modal 
        isOpen={isOpen} 
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
        size="xl"
        classNames={{
          base: "bg-white dark:bg-zinc-900",
          header: "border-b border-zinc-200 dark:border-zinc-800",
          body: "py-6",
          footer: "border-t border-zinc-200 dark:border-zinc-800",
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
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
          </ModalHeader>
          <ModalBody>
            {step === 1 && (
              <>
                <p className="text-zinc-500 dark:text-zinc-400 mb-4">What do you want to improve?</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {GOAL_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setSelectedType(type.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
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
                  <Input
                    label="Goal Name"
                    labelPlacement="outside"
                    placeholder="What's your goal?"
                    value={customGoal}
                    onChange={(e) => setCustomGoal(e.target.value)}
                    variant="bordered"
                    className="mt-4"
                  />
                )}
              </>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <p className="text-zinc-500 dark:text-zinc-400 mb-4">
                    Tell us about your experience and schedule so we can create the perfect plan.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Experience Level
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {EXPERIENCE_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        onClick={() => setExperienceLevel(level.value)}
                        className={`p-3 rounded-lg border-2 text-sm transition-all ${
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
                  <Slider 
                    size="md"
                    step={1}
                    minValue={1}
                    maxValue={7}
                    value={daysPerWeek}
                    onChange={(val) => setDaysPerWeek(val as number)}
                    color="primary"
                    showSteps
                    marks={[
                      { value: 1, label: "1" },
                      { value: 3, label: "3" },
                      { value: 5, label: "5" },
                      { value: 7, label: "7" },
                    ]}
                    className="max-w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Minutes per Session: <span className="text-indigo-500">{minutesPerSession}</span>
                  </label>
                  <Slider 
                    size="md"
                    step={5}
                    minValue={15}
                    maxValue={120}
                    value={minutesPerSession}
                    onChange={(val) => setMinutesPerSession(val as number)}
                    color="primary"
                    marks={[
                      { value: 15, label: "15m" },
                      { value: 30, label: "30m" },
                      { value: 60, label: "1h" },
                      { value: 120, label: "2h" },
                    ]}
                    className="max-w-full"
                  />
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            {step === 1 ? (
              <>
                <Button variant="light" onPress={() => onOpenChange(false)}>Cancel</Button>
                <Button 
                  className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white"
                  isDisabled={!selectedType || (selectedType === "custom" && !customGoal)}
                  onPress={() => setStep(2)}
                >
                  Next →
                </Button>
              </>
            ) : (
              <>
                <Button variant="light" onPress={() => setStep(1)}>← Back</Button>
                <Button 
                  className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white"
                  onPress={handleCreateGoal}
                  isLoading={isCreating}
                >
                  {isCreating ? "Generating Plan..." : "Create Goal & Generate Plan"}
                </Button>
              </>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
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
    <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700 transition-all">
      <CardHeader className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-cyan-100 dark:from-indigo-900/30 dark:to-cyan-900/30 flex items-center justify-center text-2xl">
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-white">{goal.title}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {new Date(goal.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <Chip 
          size="sm" 
          variant="flat"
          color={goal.status === "active" ? "primary" : goal.status === "completed" ? "success" : "default"}
        >
          {goal.status}
        </Chip>
      </CardHeader>
      <CardBody className="pt-0">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Progress</span>
            <span className="font-medium text-zinc-900 dark:text-white">{goal.progress}%</span>
          </div>
          <Progress 
            value={goal.progress} 
            color="primary"
            className="max-w-full"
            classNames={{
              indicator: "bg-gradient-to-r from-indigo-500 to-cyan-500",
            }}
          />
        </div>
        <div className="flex gap-2 mt-4">
          <Button 
            variant="flat" 
            className="flex-1"
            as={Link}
            href="/plans"
          >
            View Plan
          </Button>
          <Button 
            color="primary" 
            variant="flat"
            className="flex-1"
            as={Link}
            href="/calendar"
          >
            Train
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
