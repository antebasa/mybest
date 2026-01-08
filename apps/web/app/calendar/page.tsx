"use client";

import { useState } from "react";
import { Button, Card, CardBody, Chip } from "@heroui/react";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

interface Session {
  id: string;
  title: string;
  goalTitle: string;
  time: string;
  duration: string;
  status: "upcoming" | "completed" | "missed";
  icon: string;
}

// Demo data
const DEMO_SESSIONS: Record<string, Session[]> = {
  "2026-01-08": [
    { id: "1", title: "Darts Accuracy Training", goalTitle: "Master Darts", time: "18:00", duration: "30 min", status: "upcoming", icon: "🎯" },
  ],
  "2026-01-09": [
    { id: "2", title: "5K Easy Run", goalTitle: "5K Running", time: "07:00", duration: "45 min", status: "upcoming", icon: "🏃" },
    { id: "3", title: "Morning Stretch", goalTitle: "Morning Routine", time: "06:30", duration: "15 min", status: "upcoming", icon: "☀️" },
  ],
  "2026-01-10": [
    { id: "4", title: "Darts Form Practice", goalTitle: "Master Darts", time: "18:00", duration: "30 min", status: "upcoming", icon: "🎯" },
  ],
  "2026-01-06": [
    { id: "5", title: "Interval Training", goalTitle: "5K Running", time: "07:00", duration: "40 min", status: "completed", icon: "🏃" },
  ],
  "2026-01-07": [
    { id: "6", title: "Darts Bullseye Focus", goalTitle: "Master Darts", time: "18:00", duration: "30 min", status: "completed", icon: "🎯" },
  ],
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 8)); // January 8, 2026
  const [selectedDate, setSelectedDate] = useState<string>("2026-01-08");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const formatDateKey = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  const sessionsForSelectedDate = DEMO_SESSIONS[selectedDate] || [];

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
          <NavItem icon="🎯" label="Goals" href="/goals" />
          <NavItem icon="📅" label="Calendar" href="/calendar" active />
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
              <h1 className="text-2xl font-bold">Calendar</h1>
              <p className="text-sm text-zinc-500">Your training schedule</p>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar Grid */}
            <Card className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <CardBody>
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-6">
                  <Button variant="light" isIconOnly onPress={prevMonth}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </Button>
                  <h2 className="text-xl font-semibold">
                    {MONTHS[month]} {year}
                  </h2>
                  <Button variant="light" isIconOnly onPress={nextMonth}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAYS.map((day) => (
                    <div key={day} className="text-center text-sm font-medium text-zinc-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Empty cells for days before the first of the month */}
                  {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}

                  {/* Days of the month */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateKey = formatDateKey(day);
                    const hasSessions = DEMO_SESSIONS[dateKey]?.length > 0;
                    const isSelected = dateKey === selectedDate;
                    const isToday = dateKey === "2026-01-08";

                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDate(dateKey)}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all relative ${
                          isSelected
                            ? "bg-gradient-to-br from-indigo-500 to-cyan-500 text-white"
                            : isToday
                            ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                            : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <span className="font-medium">{day}</span>
                        {hasSessions && !isSelected && (
                          <div className="absolute bottom-1 flex gap-0.5">
                            {DEMO_SESSIONS[dateKey].slice(0, 3).map((_, idx) => (
                              <div
                                key={idx}
                                className="w-1.5 h-1.5 rounded-full bg-indigo-500"
                              />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardBody>
            </Card>

            {/* Sessions for Selected Date */}
            <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <CardBody>
                <h3 className="font-semibold mb-4">
                  {new Date(selectedDate).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </h3>

                {sessionsForSelectedDate.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <div className="text-4xl mb-2">📭</div>
                    <p>No sessions scheduled</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessionsForSelectedDate.map((session) => (
                      <div
                        key={session.id}
                        className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center text-xl">
                            {session.icon}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">{session.title}</h4>
                              <Chip
                                size="sm"
                                variant="flat"
                                color={
                                  session.status === "completed"
                                    ? "success"
                                    : session.status === "missed"
                                    ? "danger"
                                    : "primary"
                                }
                              >
                                {session.status}
                              </Chip>
                            </div>
                            <p className="text-sm text-zinc-500">{session.goalTitle}</p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-zinc-500">
                              <span>🕐 {session.time}</span>
                              <span>⏱️ {session.duration}</span>
                            </div>
                          </div>
                        </div>
                        {session.status === "upcoming" && (
                          <Button
                            className="w-full mt-3 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white"
                            size="sm"
                          >
                            Start Session
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
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
