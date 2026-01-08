"use client";

import { Button, Card, CardBody, CardHeader, Progress, Avatar, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Spinner } from "@heroui/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Goal {
  id: string;
  title: string;
  goal_type: string;
  progress: number;
  status: string;
}

interface Plan {
  id: string;
  title: string;
  goal_id: string;
  plan_data: any;
  status: string;
}

interface Session {
  id: string;
  plan_id: string;
  title: string;
  scheduled_date: string;
  duration_min: number;
  status: string;
  tasks: any[];
}

interface Stats {
  activeGoals: number;
  completedSessions: number;
  totalSessions: number;
  currentStreak: number;
}

const GOAL_ICONS: Record<string, string> = {
  darts: "🎯",
  running: "🏃",
  bodyweight: "💪",
  weightloss: "⚖️",
  habit: "✨",
  custom: "🎨",
};

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [todaySession, setTodaySession] = useState<Session | null>(null);
  const [stats, setStats] = useState<Stats>({ activeGoals: 0, completedSessions: 0, totalSessions: 0, currentStreak: 0 });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setUser(user);

    // Fetch goals
    const { data: goalsData } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (goalsData) {
      setGoals(goalsData);
      setStats(prev => ({ ...prev, activeGoals: goalsData.filter(g => g.status === "active").length }));
    }

    // Fetch sessions for today
    const today = new Date().toISOString().split("T")[0];
    const { data: sessionsData } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user.id)
      .gte("scheduled_date", today)
      .lte("scheduled_date", today + "T23:59:59")
      .order("scheduled_date", { ascending: true })
      .limit(1);

    if (sessionsData && sessionsData.length > 0) {
      setTodaySession(sessionsData[0]);
    }

    // Fetch session stats
    const { data: allSessions } = await supabase
      .from("sessions")
      .select("id, status, scheduled_date")
      .eq("user_id", user.id);

    if (allSessions) {
      const completed = allSessions.filter(s => s.status === "completed").length;
      setStats(prev => ({ 
        ...prev, 
        completedSessions: completed,
        totalSessions: allSessions.length,
        currentStreak: calculateStreak(allSessions)
      }));
    }

    setLoading(false);
  }

  function calculateStreak(sessions: any[]): number {
    const completedDates = sessions
      .filter(s => s.status === "completed")
      .map(s => new Date(s.scheduled_date).toDateString())
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    if (completedDates.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    let currentDate = new Date(today);

    for (let i = 0; i < 365; i++) {
      const dateStr = currentDate.toDateString();
      if (completedDates.includes(dateStr)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (i === 0) {
        // Today might not be completed yet, check yesterday
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

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
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 p-4 hidden lg:flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center">
            <span className="text-white font-bold">MB</span>
          </div>
          <span className="font-semibold text-xl text-zinc-900 dark:text-white">My Best</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          <NavItem icon="🏠" label="Dashboard" href="/dashboard" active />
          <NavItem icon="🎯" label="Goals" href="/goals" />
          <NavItem icon="📋" label="Plans" href="/plans" />
          <NavItem icon="📅" label="Calendar" href="/calendar" />
          <NavItem icon="💬" label="AI Coach" href="/onboarding" />
          <NavItem icon="📊" label="Progress" href="/progress" />
          <NavItem icon="⚙️" label="Settings" href="/settings" />
        </nav>

        {/* User */}
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <Dropdown placement="top-start">
            <DropdownTrigger>
              <Button variant="light" className="w-full justify-start gap-3 h-auto py-3">
                <Avatar
                  size="sm"
                  name={user?.user_metadata?.full_name || "User"}
                  className="bg-gradient-to-br from-indigo-500 to-cyan-400"
                />
                <div className="flex-1 text-left">
                  <div className="font-medium text-sm text-zinc-900 dark:text-white">{user?.user_metadata?.full_name || "User"}</div>
                  <div className="text-xs text-zinc-500 truncate">{user?.email}</div>
                </div>
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="User menu">
              <DropdownItem key="profile">Profile</DropdownItem>
              <DropdownItem key="settings">Settings</DropdownItem>
              <DropdownItem key="logout" color="danger" onPress={handleSignOut}>
                Sign Out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Dashboard</h1>
              <p className="text-sm text-zinc-500">Welcome back, {user?.user_metadata?.full_name?.split(" ")[0] || "Champion"}!</p>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Link href="/goals">
                <Button color="primary" className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white">
                  + New Goal
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              title="Active Goals" 
              value={stats.activeGoals.toString()} 
              icon="🎯" 
              trend={stats.activeGoals > 0 ? "Keep pushing!" : "Set your first goal"} 
            />
            <StatCard 
              title="Sessions Completed" 
              value={stats.completedSessions.toString()} 
              icon="✅" 
              trend={stats.totalSessions > 0 ? `${Math.round((stats.completedSessions / stats.totalSessions) * 100)}% completion rate` : "No sessions yet"} 
            />
            <StatCard 
              title="Current Streak" 
              value={stats.currentStreak.toString()} 
              icon="🔥" 
              trend="days" 
            />
            <StatCard 
              title="Total Sessions" 
              value={stats.totalSessions.toString()} 
              icon="📊" 
              trend="scheduled" 
            />
          </div>

          {/* Today's Session */}
          <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <CardHeader className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Today&apos;s Session</h2>
                <p className="text-sm text-zinc-500">
                  {todaySession ? todaySession.title : "No session scheduled for today"}
                </p>
              </div>
              {todaySession ? (
                <Link href={`/session/${todaySession.id}`}>
                  <Button color="primary" className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white">
                    Start Session
                  </Button>
                </Link>
              ) : (
                <Link href="/goals">
                  <Button variant="flat" color="primary">
                    Create a Goal
                  </Button>
                </Link>
              )}
            </CardHeader>
            <CardBody>
              {todaySession ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-2xl">
                      🎯
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-zinc-900 dark:text-white">
                        {todaySession.tasks?.length || 0} tasks to complete
                      </div>
                      <div className="text-sm text-zinc-500">
                        Estimated {todaySession.duration_min} minutes
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-zinc-900 dark:text-white">~{todaySession.duration_min} min</div>
                      <div className="text-xs text-zinc-500">estimated</div>
                    </div>
                  </div>
                  <Progress
                    value={todaySession.status === "completed" ? 100 : 0}
                    className="h-2"
                    classNames={{
                      indicator: "bg-gradient-to-r from-indigo-500 to-cyan-500",
                    }}
                  />
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-zinc-500 dark:text-zinc-400 mb-4">
                    Create a goal to get personalized training sessions!
                  </p>
                  <Link href="/goals">
                    <Button color="primary" variant="flat">
                      Get Started →
                    </Button>
                  </Link>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Goals Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <CardHeader className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Active Goals</h2>
                <Link href="/goals">
                  <Button size="sm" variant="light">View All</Button>
                </Link>
              </CardHeader>
              <CardBody className="space-y-4">
                {goals.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">🎯</div>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-4">No goals yet</p>
                    <Link href="/goals">
                      <Button size="sm" color="primary" variant="flat">Create Your First Goal</Button>
                    </Link>
                  </div>
                ) : (
                  goals.slice(0, 3).map((goal) => (
                    <GoalItem
                      key={goal.id}
                      title={goal.title}
                      progress={goal.progress}
                      status={goal.status}
                      icon={GOAL_ICONS[goal.goal_type] || "🎯"}
                    />
                  ))
                )}
              </CardBody>
            </Card>

            <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">AI Coach</h2>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-sm">
                      AI
                    </div>
                    <div>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">
                        {goals.length > 0 
                          ? `You have ${stats.activeGoals} active goal${stats.activeGoals !== 1 ? 's' : ''}. Keep up the great work! Your consistency is building real progress.`
                          : "Welcome! I'm your AI coach. Create your first goal and I'll help you build a personalized training plan to achieve it."}
                      </p>
                      <p className="text-xs text-zinc-500 mt-2">Just now</p>
                    </div>
                  </div>
                </div>
                <Link href="/onboarding">
                  <Button variant="light" className="w-full">
                    Chat with AI Coach →
                  </Button>
                </Link>
              </CardBody>
            </Card>
          </div>
        </div>
      </main>
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

function StatCard({ title, value, icon, trend }: { title: string; value: string; icon: string; trend: string }) {
  return (
    <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      <CardBody className="flex flex-row items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-cyan-100 dark:from-indigo-900/30 dark:to-cyan-900/30 flex items-center justify-center text-2xl">
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white">{value}</div>
          <div className="text-sm text-zinc-500">{title}</div>
          <div className="text-xs text-indigo-500">{trend}</div>
        </div>
      </CardBody>
    </Card>
  );
}

function GoalItem({ title, progress, status, icon }: { title: string; progress: number; status: string; icon: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-zinc-900 dark:text-white">{title}</span>
          <span className="text-sm text-zinc-500">{progress}%</span>
        </div>
        <Progress
          value={progress}
          size="sm"
          classNames={{
            indicator: "bg-gradient-to-r from-indigo-500 to-cyan-500",
          }}
        />
        <div className="text-xs text-zinc-500 mt-1 capitalize">{status}</div>
      </div>
    </div>
  );
}
