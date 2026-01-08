"use client";

import { Button, Card, CardBody, CardHeader, Progress, Avatar, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Link } from "@heroui/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 p-4 hidden lg:flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center">
            <span className="text-white font-bold">MB</span>
          </div>
          <span className="font-semibold text-xl">My Best</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          <NavItem icon="🏠" label="Dashboard" href="/dashboard" active />
          <NavItem icon="🎯" label="Goals" href="/goals" />
          <NavItem icon="📅" label="Calendar" href="/calendar" />
          <NavItem icon="💬" label="AI Coach" href="/coach" />
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
                  <div className="font-medium text-sm">{user?.user_metadata?.full_name || "User"}</div>
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
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-sm text-zinc-500">Welcome back, {user?.user_metadata?.full_name?.split(" ")[0] || "Champion"}!</p>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Button color="primary" className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white">
                + New Goal
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Active Goals" value="3" icon="🎯" trend="+1 this week" />
            <StatCard title="Sessions Completed" value="24" icon="✅" trend="87% completion rate" />
            <StatCard title="Current Streak" value="7" icon="🔥" trend="days" />
            <StatCard title="AI Insights" value="12" icon="💡" trend="new recommendations" />
          </div>

          {/* Today's Session */}
          <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <CardHeader className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold">Today&apos;s Session</h2>
                <p className="text-sm text-zinc-500">Darts Accuracy Training - Day 5</p>
              </div>
              <Button color="primary" className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white">
                Start Session
              </Button>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-2xl">
                    🎯
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">50 Bullseye Attempts</div>
                    <div className="text-sm text-zinc-500">Focus on elbow position</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">~20 min</div>
                    <div className="text-xs text-zinc-500">estimated</div>
                  </div>
                </div>
                <Progress
                  value={0}
                  className="h-2"
                  classNames={{
                    indicator: "bg-gradient-to-r from-indigo-500 to-cyan-500",
                  }}
                />
              </div>
            </CardBody>
          </Card>

          {/* Goals Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <h2 className="text-lg font-semibold">Active Goals</h2>
              </CardHeader>
              <CardBody className="space-y-4">
                <GoalItem
                  title="Master Darts"
                  progress={35}
                  sessions="12/35 sessions"
                  icon="🎯"
                />
                <GoalItem
                  title="5K Running"
                  progress={60}
                  sessions="18/30 sessions"
                  icon="🏃"
                />
                <GoalItem
                  title="Morning Routine"
                  progress={80}
                  sessions="24/30 days"
                  icon="☀️"
                />
              </CardBody>
            </Card>

            <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <h2 className="text-lg font-semibold">AI Coach Notes</h2>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-sm">
                      AI
                    </div>
                    <div>
                      <p className="text-sm">
                        Great progress on your dart accuracy! I noticed your elbow drops slightly on longer throws. 
                        Today&apos;s session focuses on maintaining consistent arm position.
                      </p>
                      <p className="text-xs text-zinc-500 mt-2">2 hours ago</p>
                    </div>
                  </div>
                </div>
                <Button variant="light" className="w-full">
                  Chat with AI Coach →
                </Button>
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
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-sm text-zinc-500">{title}</div>
          <div className="text-xs text-indigo-500">{trend}</div>
        </div>
      </CardBody>
    </Card>
  );
}

function GoalItem({ title, progress, sessions, icon }: { title: string; progress: number; sessions: string; icon: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium">{title}</span>
          <span className="text-sm text-zinc-500">{progress}%</span>
        </div>
        <Progress
          value={progress}
          size="sm"
          classNames={{
            indicator: "bg-gradient-to-r from-indigo-500 to-cyan-500",
          }}
        />
        <div className="text-xs text-zinc-500 mt-1">{sessions}</div>
      </div>
    </div>
  );
}

