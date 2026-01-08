"use client";

import { useState } from "react";
import { Button, Card, CardBody, CardHeader, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Chip } from "@heroui/react";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

interface Goal {
  id: string;
  title: string;
  type: string;
  progress: number;
  sessions: string;
  status: "active" | "completed" | "paused";
  icon: string;
}

// Demo data
const DEMO_GOALS: Goal[] = [
  { id: "1", title: "Master Darts", type: "darts", progress: 35, sessions: "12/35", status: "active", icon: "🎯" },
  { id: "2", title: "5K Running", type: "running", progress: 60, sessions: "18/30", status: "active", icon: "🏃" },
  { id: "3", title: "Morning Routine", type: "habit", progress: 80, sessions: "24/30", status: "active", icon: "☀️" },
];

const GOAL_TYPES = [
  { id: "darts", label: "Darts", icon: "🎯" },
  { id: "running", label: "Running", icon: "🏃" },
  { id: "bodyweight", label: "Bodyweight", icon: "💪" },
  { id: "weightloss", label: "Weight Loss", icon: "⚖️" },
  { id: "habit", label: "Habit Building", icon: "✨" },
  { id: "custom", label: "Custom Goal", icon: "🎨" },
];

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>(DEMO_GOALS);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [customGoal, setCustomGoal] = useState("");
  const { isOpen, onOpen, onClose } = useDisclosure();

  const handleCreateGoal = () => {
    if (!selectedType) return;
    
    const typeInfo = GOAL_TYPES.find(t => t.id === selectedType);
    const newGoal: Goal = {
      id: Date.now().toString(),
      title: selectedType === "custom" ? customGoal : typeInfo?.label || "New Goal",
      type: selectedType,
      progress: 0,
      sessions: "0/0",
      status: "active",
      icon: typeInfo?.icon || "🎯",
    };
    
    setGoals([...goals, newGoal]);
    setSelectedType(null);
    setCustomGoal("");
    onClose();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 p-4 hidden lg:flex flex-col">
        <Link href="/dashboard" className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center">
            <span className="text-white font-bold">MB</span>
          </div>
          <span className="font-semibold text-xl">My Best</span>
        </Link>

        <nav className="flex-1 space-y-1">
          <NavItem icon="🏠" label="Dashboard" href="/dashboard" />
          <NavItem icon="🎯" label="Goals" href="/goals" active />
          <NavItem icon="📅" label="Calendar" href="/calendar" />
          <NavItem icon="💬" label="AI Coach" href="/coach" />
          <NavItem icon="📊" label="Progress" href="/progress" />
          <NavItem icon="⚙️" label="Settings" href="/settings" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64">
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">My Goals</h1>
              <p className="text-sm text-zinc-500">{goals.filter(g => g.status === "active").length} active goals</p>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Button 
                color="primary" 
                className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white"
                onPress={onOpen}
              >
                + New Goal
              </Button>
            </div>
          </div>
        </header>

        <div className="p-6">
          {/* Active Goals */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Active Goals</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {goals.filter(g => g.status === "active").map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          </section>

          {/* Completed Goals */}
          {goals.filter(g => g.status === "completed").length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-4">Completed</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {goals.filter(g => g.status === "completed").map((goal) => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* New Goal Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalContent>
          <ModalHeader>Create New Goal</ModalHeader>
          <ModalBody>
            <p className="text-zinc-500 mb-4">What do you want to improve?</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {GOAL_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`p-4 rounded-xl border-2 transition-all text-center ${
                    selectedType === type.id
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  <span className="text-2xl block mb-1">{type.icon}</span>
                  <span className="text-sm font-medium">{type.label}</span>
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
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>Cancel</Button>
            <Button 
              className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white"
              isDisabled={!selectedType || (selectedType === "custom" && !customGoal)}
              onPress={handleCreateGoal}
            >
              Create Goal
            </Button>
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

function GoalCard({ goal }: { goal: Goal }) {
  return (
    <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:shadow-lg transition-shadow">
      <CardHeader className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-cyan-100 dark:from-indigo-900/30 dark:to-cyan-900/30 flex items-center justify-center text-2xl">
            {goal.icon}
          </div>
          <div>
            <h3 className="font-semibold">{goal.title}</h3>
            <p className="text-sm text-zinc-500">{goal.sessions} sessions</p>
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
            <span className="text-zinc-500">Progress</span>
            <span className="font-medium">{goal.progress}%</span>
          </div>
          <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full transition-all"
              style={{ width: `${goal.progress}%` }}
            />
          </div>
        </div>
        <Button 
          variant="flat" 
          className="w-full mt-4"
          as={Link}
          href={`/goals/${goal.id}`}
        >
          View Details
        </Button>
      </CardBody>
    </Card>
  );
}
