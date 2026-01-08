"use client";

import { useState, useEffect } from "react";
import { Button, Card, CardBody, CardHeader, Chip, Spinner, Select, SelectItem } from "@heroui/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Goal {
  id: string;
  title: string;
  goal_type: string;
  progress: number;
  status: string;
  created_at: string;
}

interface Session {
  id: string;
  title: string;
  scheduled_date: string;
  status: string;
  completed_at?: string;
  duration_min: number;
  tasks: any[];
}

interface SessionLog {
  id: string;
  session_id: string;
  metrics: any;
  user_notes: string;
  created_at: string;
}

const COLORS = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

const GOAL_ICONS: Record<string, string> = {
  darts: "🎯",
  running: "🏃",
  bodyweight: "💪",
  weightloss: "⚖️",
  habit: "✨",
  custom: "🎨",
};

export default function ProgressPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoalId, setSelectedGoalId] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<string>("30");
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch goals
    const { data: goalsData } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (goalsData) setGoals(goalsData);

    // Fetch sessions
    const { data: sessionsData } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("scheduled_date", { ascending: true });

    if (sessionsData) setSessions(sessionsData);

    // Fetch session logs
    const { data: logsData } = await supabase
      .from("session_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (logsData) setLogs(logsData);

    setLoading(false);
  }

  // Calculate stats
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(s => s.status === "completed").length;
  const skippedSessions = sessions.filter(s => s.status === "skipped").length;
  const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  // Calculate streak
  function calculateStreak(): number {
    const completedDates = sessions
      .filter(s => s.status === "completed")
      .map(s => new Date(s.scheduled_date).toDateString())
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    if (completedDates.length === 0) return 0;

    let streak = 0;
    const uniqueDates = [...new Set(completedDates)];
    const today = new Date();
    let currentDate = new Date(today);

    for (let i = 0; i < 365; i++) {
      const dateStr = currentDate.toDateString();
      if (uniqueDates.includes(dateStr)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (i === 0) {
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  // Prepare chart data
  function getCompletionChartData() {
    const days = parseInt(timeRange);
    const data: { date: string; completed: number; total: number }[] = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toDateString();
      
      const daySessions = sessions.filter(s => 
        new Date(s.scheduled_date).toDateString() === dateStr
      );
      
      data.push({
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        completed: daySessions.filter(s => s.status === "completed").length,
        total: daySessions.length,
      });
    }

    return data;
  }

  function getSessionStatusData() {
    return [
      { name: "Completed", value: completedSessions, color: "#10b981" },
      { name: "Scheduled", value: sessions.filter(s => s.status === "scheduled").length, color: "#6366f1" },
      { name: "Skipped", value: skippedSessions, color: "#ef4444" },
    ].filter(d => d.value > 0);
  }

  function getWeeklyProgressData() {
    const weeks: { week: string; sessions: number; minutes: number }[] = [];
    const now = new Date();

    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (i * 7) - now.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekSessions = sessions.filter(s => {
        const date = new Date(s.scheduled_date);
        return s.status === "completed" && date >= weekStart && date <= weekEnd;
      });

      weeks.push({
        week: `Week ${4 - i}`,
        sessions: weekSessions.length,
        minutes: weekSessions.reduce((acc, s) => acc + s.duration_min, 0),
      });
    }

    return weeks;
  }

  function getGoalProgressData() {
    return goals.map(goal => ({
      name: goal.title,
      progress: goal.progress,
      icon: GOAL_ICONS[goal.goal_type] || "🎯",
    }));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  const completionData = getCompletionChartData();
  const statusData = getSessionStatusData();
  const weeklyData = getWeeklyProgressData();
  const goalProgressData = getGoalProgressData();
  const streak = calculateStreak();

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
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
          <NavItem icon="📅" label="Calendar" href="/calendar" />
          <NavItem icon="💬" label="AI Coach" href="/onboarding" />
          <NavItem icon="📊" label="Progress" href="/progress" active />
          <NavItem icon="⚙️" label="Settings" href="/settings" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64">
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Progress</h1>
              <p className="text-sm text-zinc-500">Track your journey to becoming your best self</p>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
              >
                <option value="7">Last 7 days</option>
                <option value="14">Last 14 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              title="Completion Rate" 
              value={`${completionRate}%`}
              subtitle={`${completedSessions}/${totalSessions} sessions`}
              icon="✅"
              color="green"
            />
            <StatCard 
              title="Current Streak" 
              value={`${streak}`}
              subtitle="consecutive days"
              icon="🔥"
              color="orange"
            />
            <StatCard 
              title="Total Time" 
              value={`${Math.round(sessions.filter(s => s.status === "completed").reduce((acc, s) => acc + s.duration_min, 0) / 60)}h`}
              subtitle="training logged"
              icon="⏱️"
              color="blue"
            />
            <StatCard 
              title="Active Goals" 
              value={`${goals.filter(g => g.status === "active").length}`}
              subtitle="in progress"
              icon="🎯"
              color="purple"
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Session Completion Over Time */}
            <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Session Completion</h2>
              </CardHeader>
              <CardBody>
                {completionData.length > 0 && completedSessions > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={completionData}>
                      <defs>
                        <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                      <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                      <YAxis stroke="#9ca3af" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "var(--tooltip-bg, #18181b)", 
                          border: "1px solid #3f3f46",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#fff" }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="completed" 
                        stroke="#6366f1" 
                        fillOpacity={1} 
                        fill="url(#colorCompleted)" 
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-zinc-500">
                    <div className="text-center">
                      <p className="text-4xl mb-2">📊</p>
                      <p>Complete sessions to see your progress chart</p>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Session Status Distribution */}
            <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Session Status</h2>
              </CardHeader>
              <CardBody>
                {statusData.length > 0 ? (
                  <div className="flex items-center">
                    <ResponsiveContainer width="50%" height={200}>
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-3">
                      {statusData.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: item.color }}
                          />
                          <div>
                            <p className="font-medium text-zinc-900 dark:text-white">{item.name}</p>
                            <p className="text-sm text-zinc-500">{item.value} sessions</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-zinc-500">
                    <div className="text-center">
                      <p className="text-4xl mb-2">🎯</p>
                      <p>Create a goal to start tracking sessions</p>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Progress */}
            <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Weekly Activity</h2>
              </CardHeader>
              <CardBody>
                {weeklyData.some(w => w.sessions > 0) ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                      <XAxis dataKey="week" stroke="#9ca3af" fontSize={12} />
                      <YAxis stroke="#9ca3af" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "var(--tooltip-bg, #18181b)", 
                          border: "1px solid #3f3f46",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="sessions" fill="#6366f1" radius={[4, 4, 0, 0]} name="Sessions" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-zinc-500">
                    <div className="text-center">
                      <p className="text-4xl mb-2">📅</p>
                      <p>No weekly data yet</p>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Goal Progress */}
            <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Goal Progress</h2>
              </CardHeader>
              <CardBody>
                {goalProgressData.length > 0 ? (
                  <div className="space-y-4">
                    {goalProgressData.map((goal, idx) => (
                      <div key={idx}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{goal.icon}</span>
                            <span className="font-medium text-zinc-900 dark:text-white">{goal.name}</span>
                          </div>
                          <span className="text-sm text-zinc-500">{goal.progress}%</span>
                        </div>
                        <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all bg-gradient-to-r from-indigo-500 to-cyan-500"
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-zinc-500">
                    <div className="text-center">
                      <p className="text-4xl mb-2">🎯</p>
                      <p>No goals yet</p>
                      <Link href="/goals">
                        <Button color="primary" variant="flat" size="sm" className="mt-4">
                          Create a Goal
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <CardHeader>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Recent Activity</h2>
            </CardHeader>
            <CardBody>
              {sessions.filter(s => s.status === "completed").length > 0 ? (
                <div className="space-y-3">
                  {sessions
                    .filter(s => s.status === "completed")
                    .sort((a, b) => new Date(b.completed_at || b.scheduled_date).getTime() - new Date(a.completed_at || a.scheduled_date).getTime())
                    .slice(0, 5)
                    .map((session) => (
                      <div 
                        key={session.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                            ✓
                          </div>
                          <div>
                            <p className="font-medium text-zinc-900 dark:text-white">{session.title}</p>
                            <p className="text-sm text-zinc-500">
                              {new Date(session.completed_at || session.scheduled_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Chip size="sm" color="success" variant="flat">
                          {session.duration_min}min
                        </Chip>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500">
                  <p className="text-4xl mb-2">📝</p>
                  <p>No completed sessions yet</p>
                  <Link href="/calendar">
                    <Button color="primary" variant="flat" size="sm" className="mt-4">
                      View Calendar
                    </Button>
                  </Link>
                </div>
              )}
            </CardBody>
          </Card>
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

function StatCard({ title, value, subtitle, icon, color }: { 
  title: string; 
  value: string; 
  subtitle: string; 
  icon: string;
  color: "green" | "orange" | "blue" | "purple";
}) {
  const colorClasses = {
    green: "from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30",
    orange: "from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30",
    blue: "from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30",
    purple: "from-indigo-100 to-violet-100 dark:from-indigo-900/30 dark:to-violet-900/30",
  };

  return (
    <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      <CardBody className="flex flex-row items-center gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center text-2xl`}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white">{value}</div>
          <div className="text-sm text-zinc-500">{title}</div>
          <div className="text-xs text-zinc-400">{subtitle}</div>
        </div>
      </CardBody>
    </Card>
  );
}
