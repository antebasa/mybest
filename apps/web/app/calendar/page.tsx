"use client";

import { useState, useEffect } from "react";
import { Button, Card, CardBody, CardHeader, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Spinner, Checkbox, Textarea } from "@heroui/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Task {
  name: string;
  type: string;
  target: Record<string, number>;
  completed?: boolean;
}

interface Session {
  id: string;
  plan_id: string;
  title: string;
  scheduled_date: string;
  duration_min: number;
  status: "scheduled" | "completed" | "skipped";
  tasks: Task[];
  notes?: string;
  plans?: {
    title: string;
    goals?: {
      title: string;
      goal_type: string;
    };
  };
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const GOAL_ICONS: Record<string, string> = {
  darts: "🎯",
  running: "🏃",
  bodyweight: "💪",
  weightloss: "⚖️",
  habit: "✨",
  custom: "🎨",
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isSessionOpen, setIsSessionOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(new Set());
  const [sessionNotes, setSessionNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchSessions();
  }, [currentDate]);

  async function fetchSessions() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get first and last day of current month view
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const { data, error } = await supabase
      .from("sessions")
      .select(`
        *,
        plans (
          title,
          goals (
            title,
            goal_type
          )
        )
      `)
      .eq("user_id", user.id)
      .gte("scheduled_date", firstDay.toISOString())
      .lte("scheduled_date", lastDay.toISOString())
      .order("scheduled_date", { ascending: true });

    if (!error && data) {
      setSessions(data as Session[]);
    }
    setLoading(false);
  }

  function getDaysInMonth(): (Date | null)[] {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];

    // Add empty slots for days before first day of month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  }

  function getSessionsForDate(date: Date): Session[] {
    return sessions.filter(session => {
      const sessionDate = new Date(session.scheduled_date);
      return sessionDate.toDateString() === date.toDateString();
    });
  }

  function openSession(session: Session) {
    setSelectedSession(session);
    setCompletedTasks(new Set(
      session.tasks
        ?.map((t, idx) => t.completed ? idx : -1)
        .filter(idx => idx >= 0) || []
    ));
    setSessionNotes(session.notes || "");
    setIsSessionOpen(true);
  }

  async function completeSession() {
    if (!selectedSession) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update tasks with completion status
      const updatedTasks = selectedSession.tasks?.map((task, idx) => ({
        ...task,
        completed: completedTasks.has(idx),
      }));

      // Update session in database
      const { error } = await supabase
        .from("sessions")
        .update({
          status: "completed",
          tasks: updatedTasks,
          notes: sessionNotes,
          completed_at: new Date().toISOString(),
        })
        .eq("id", selectedSession.id);

      if (error) throw error;

      // Log the session
      await supabase
        .from("session_logs")
        .insert({
          user_id: user.id,
          session_id: selectedSession.id,
          metrics: {
            tasks_completed: completedTasks.size,
            total_tasks: selectedSession.tasks?.length || 0,
          },
          user_notes: sessionNotes,
        });

      // Refresh sessions
      await fetchSessions();
      setIsSessionOpen(false);
      setSelectedSession(null);
    } catch (error) {
      console.error("Error completing session:", error);
    } finally {
      setSaving(false);
    }
  }

  async function skipSession() {
    if (!selectedSession) return;
    setSaving(true);

    try {
      await supabase
        .from("sessions")
        .update({
          status: "skipped",
          notes: sessionNotes,
        })
        .eq("id", selectedSession.id);

      await fetchSessions();
      setIsSessionOpen(false);
      setSelectedSession(null);
    } catch (error) {
      console.error("Error skipping session:", error);
    } finally {
      setSaving(false);
    }
  }

  function prevMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  }

  function isToday(date: Date): boolean {
    return date.toDateString() === new Date().toDateString();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  const days = getDaysInMonth();

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
          <NavItem icon="🎯" label="Goals" href="/goals" />
          <NavItem icon="📋" label="Plans" href="/plans" />
          <NavItem icon="📅" label="Calendar" href="/calendar" active />
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
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Training Calendar</h1>
              <p className="text-sm text-zinc-500">
                {sessions.filter(s => s.status === "completed").length} of {sessions.length} sessions completed this month
              </p>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Link href="/goals">
                <Button color="primary" variant="flat">
                  + New Goal
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <div className="p-6">
          {/* Calendar Navigation */}
          <div className="flex items-center justify-between mb-6">
            <Button variant="light" onPress={prevMonth}>
              ← Previous
            </Button>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <Button variant="light" onPress={nextMonth}>
              Next →
            </Button>
          </div>

          {/* Calendar Grid */}
          <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <CardBody className="p-4">
              {/* Day Headers */}
              <div className="grid grid-cols-7 mb-2">
                {DAYS.map(day => (
                  <div key={day} className="text-center text-sm font-medium text-zinc-500 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((date, idx) => {
                  if (!date) {
                    return <div key={`empty-${idx}`} className="h-24" />;
                  }

                  const daySessions = getSessionsForDate(date);
                  const hasCompleted = daySessions.some(s => s.status === "completed");
                  const hasScheduled = daySessions.some(s => s.status === "scheduled");

                  return (
                    <div
                      key={date.toISOString()}
                      className={`h-24 p-2 rounded-lg border transition-colors ${
                        isToday(date)
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                      }`}
                    >
                      <div className={`text-sm font-medium mb-1 ${
                        isToday(date) ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-700 dark:text-zinc-300"
                      }`}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {daySessions.slice(0, 2).map((session) => (
                          <button
                            key={session.id}
                            onClick={() => openSession(session)}
                            className={`w-full text-left text-xs px-1.5 py-0.5 rounded truncate transition-colors ${
                              session.status === "completed"
                                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                : session.status === "skipped"
                                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 line-through"
                                : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
                            }`}
                          >
                            {GOAL_ICONS[session.plans?.goals?.goal_type || "custom"]} {session.title}
                          </button>
                        ))}
                        {daySessions.length > 2 && (
                          <div className="text-xs text-zinc-500">
                            +{daySessions.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {/* Upcoming Sessions */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Upcoming Sessions</h3>
            {sessions.filter(s => s.status === "scheduled" && new Date(s.scheduled_date) >= new Date()).length === 0 ? (
              <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <CardBody className="py-8 text-center">
                  <p className="text-zinc-500 dark:text-zinc-400 mb-4">
                    No upcoming sessions. Create a goal to generate your training plan!
                  </p>
                  <Link href="/goals">
                    <Button color="primary" variant="flat">
                      Create a Goal
                    </Button>
                  </Link>
                </CardBody>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {sessions
                  .filter(s => s.status === "scheduled" && new Date(s.scheduled_date) >= new Date())
                  .slice(0, 6)
                  .map((session) => (
                    <Card 
                      key={session.id} 
                      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:border-indigo-400 transition-colors"
                      isPressable
                      onPress={() => openSession(session)}
                    >
                      <CardBody className="p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="text-2xl">
                            {GOAL_ICONS[session.plans?.goals?.goal_type || "custom"]}
                          </div>
                          <div>
                            <h4 className="font-medium text-zinc-900 dark:text-white">{session.title}</h4>
                            <p className="text-xs text-zinc-500">
                              {new Date(session.scheduled_date).toLocaleDateString()} • {session.duration_min}min
                            </p>
                          </div>
                        </div>
                        <div className="text-xs text-zinc-500">
                          {session.tasks?.length || 0} tasks
                        </div>
                      </CardBody>
                    </Card>
                  ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Session Detail Modal */}
      <Modal 
        isOpen={isSessionOpen} 
        onOpenChange={setIsSessionOpen}
        size="2xl"
        scrollBehavior="inside"
        classNames={{
          base: "bg-white dark:bg-zinc-900",
          header: "border-b border-zinc-200 dark:border-zinc-800",
          body: "py-6",
          footer: "border-t border-zinc-200 dark:border-zinc-800",
        }}
      >
        <ModalContent>
          {(onClose) => selectedSession && (
            <>
              <ModalHeader>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">
                    {GOAL_ICONS[selectedSession.plans?.goals?.goal_type || "custom"]}
                  </span>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                      {selectedSession.title}
                    </h2>
                    <p className="text-sm text-zinc-500 font-normal">
                      {new Date(selectedSession.scheduled_date).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                      })} • {selectedSession.duration_min} minutes
                    </p>
                  </div>
                </div>
              </ModalHeader>
              <ModalBody>
                {selectedSession.status === "completed" ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">✅</div>
                    <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
                      Session Completed!
                    </h3>
                    <p className="text-zinc-500">
                      You completed this session. Great work!
                    </p>
                  </div>
                ) : selectedSession.status === "skipped" ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">⏭️</div>
                    <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
                      Session Skipped
                    </h3>
                    <p className="text-zinc-500">
                      You skipped this session.
                    </p>
                  </div>
                ) : (
                  <>
                    <h3 className="font-semibold text-zinc-900 dark:text-white mb-3">Tasks</h3>
                    <div className="space-y-3">
                      {selectedSession.tasks?.map((task, idx) => (
                        <div 
                          key={idx}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            completedTasks.has(idx)
                              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                              : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700"
                          }`}
                        >
                          <Checkbox
                            isSelected={completedTasks.has(idx)}
                            onValueChange={(checked) => {
                              const newSet = new Set(completedTasks);
                              if (checked) {
                                newSet.add(idx);
                              } else {
                                newSet.delete(idx);
                              }
                              setCompletedTasks(newSet);
                            }}
                            color="success"
                          />
                          <div className="flex-1">
                            <p className={`font-medium ${completedTasks.has(idx) ? "line-through text-zinc-500" : "text-zinc-900 dark:text-white"}`}>
                              {task.name}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {Object.entries(task.target).map(([key, val]) => `${val} ${key}`).join(", ")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6">
                      <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">Session Notes</h3>
                      <Textarea
                        placeholder="How did it go? Any observations..."
                        value={sessionNotes}
                        onValueChange={setSessionNotes}
                        variant="bordered"
                        minRows={3}
                      />
                    </div>
                  </>
                )}
              </ModalBody>
              <ModalFooter>
                {selectedSession.status === "scheduled" && (
                  <>
                    <Button variant="light" onPress={skipSession} isLoading={saving}>
                      Skip Session
                    </Button>
                    <Button 
                      color="success" 
                      onPress={completeSession}
                      isLoading={saving}
                      isDisabled={completedTasks.size === 0}
                    >
                      Complete Session ({completedTasks.size}/{selectedSession.tasks?.length || 0})
                    </Button>
                  </>
                )}
                {(selectedSession.status === "completed" || selectedSession.status === "skipped") && (
                  <Button variant="light" onPress={onClose}>
                    Close
                  </Button>
                )}
              </ModalFooter>
            </>
          )}
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
