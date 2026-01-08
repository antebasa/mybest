"use client";

import { useState, useEffect } from "react";
import { Button, Card, CardBody, CardHeader, Chip, Progress, Tabs, Tab, Divider, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Spinner } from "@heroui/react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Task {
  name: string;
  type: string;
  target: Record<string, number>;
}

interface Session {
  day: number;
  title: string;
  duration_min: number;
  tasks: Task[];
}

interface Phase {
  name: string;
  weeks: number;
  focus: string;
}

interface PlanData {
  micro_cycle: {
    title: string;
    description?: string;
    sessions: Session[];
  };
  macro_cycle: {
    title: string;
    phases: Phase[];
  };
}

interface Plan {
  id: string;
  goal_id: string;
  title: string;
  description: string;
  plan_data: PlanData;
  duration_weeks: number;
  status: string;
  created_at: string;
  goals?: {
    title: string;
    goal_type: string;
  };
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("plans")
      .select(`
        *,
        goals (
          title,
          goal_type
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setPlans(data as Plan[]);
    }
    setLoading(false);
  }

  function openPlanDetail(plan: Plan) {
    setSelectedPlan(plan);
    setIsDetailOpen(true);
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "active": return "success";
      case "completed": return "primary";
      case "paused": return "warning";
      default: return "default";
    }
  }

  function formatTarget(target: Record<string, number>) {
    return Object.entries(target)
      .map(([key, value]) => `${value} ${key}`)
      .join(", ");
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
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Training Plans</h1>
            </div>
            <Link href="/goals">
              <Button color="primary" variant="flat" size="sm">
                + Create New Goal
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {plans.length === 0 ? (
          <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <CardBody className="py-16 text-center">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
                No Training Plans Yet
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-md mx-auto">
                Create a goal and our AI will generate a personalized training plan tailored to your experience level and schedule.
              </p>
              <Link href="/goals">
                <Button color="primary" size="lg">
                  Create Your First Goal
                </Button>
              </Link>
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card 
                key={plan.id} 
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-primary-400 dark:hover:border-primary-500 transition-all cursor-pointer"
                isPressable
                onPress={() => openPlanDetail(plan)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between w-full">
                    <div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                        {plan.goals?.goal_type || "Training"}
                      </p>
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                        {plan.title}
                      </h3>
                    </div>
                    <Chip size="sm" color={getStatusColor(plan.status)} variant="flat">
                      {plan.status}
                    </Chip>
                  </div>
                </CardHeader>
                <CardBody className="pt-0">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                    {plan.description}
                  </p>
                  
                  <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                    <span className="flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {plan.plan_data?.micro_cycle?.sessions?.length || 0} sessions
                    </span>
                    <span className="flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {plan.duration_weeks} weeks
                    </span>
                  </div>

                  {/* Macro cycle phases preview */}
                  {plan.plan_data?.macro_cycle?.phases && (
                    <div className="flex gap-1">
                      {plan.plan_data.macro_cycle.phases.map((phase, idx) => (
                        <div 
                          key={idx}
                          className="flex-1 h-2 rounded-full bg-gradient-to-r from-primary-400 to-primary-600"
                          style={{ opacity: 0.3 + (idx * 0.3) }}
                          title={phase.name}
                        />
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Plan Detail Modal */}
      <Modal 
        isOpen={isDetailOpen} 
        onOpenChange={setIsDetailOpen}
        size="4xl"
        scrollBehavior="inside"
        classNames={{
          base: "bg-white dark:bg-zinc-900",
          header: "border-b border-zinc-200 dark:border-zinc-800",
          body: "py-6",
          footer: "border-t border-zinc-200 dark:border-zinc-800",
        }}
      >
        <ModalContent>
          {(onClose) => selectedPlan && (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                      {selectedPlan.title}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 font-normal">
                      {selectedPlan.goals?.title}
                    </p>
                  </div>
                </div>
              </ModalHeader>
              <ModalBody>
                <Tabs aria-label="Plan sections" color="primary" variant="underlined">
                  {/* Micro Cycle Tab */}
                  <Tab key="micro" title="2-Week Plan">
                    <div className="space-y-4 mt-4">
                      {selectedPlan.plan_data?.micro_cycle?.description && (
                        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                          {selectedPlan.plan_data.micro_cycle.description}
                        </p>
                      )}
                      
                      {selectedPlan.plan_data?.micro_cycle?.sessions?.map((session, idx) => (
                        <Card key={idx} className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                          <CardBody className="py-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">
                                  D{session.day}
                                </div>
                                <div>
                                  <h4 className="font-semibold text-zinc-900 dark:text-white">
                                    {session.title}
                                  </h4>
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {session.duration_min} minutes
                                  </p>
                                </div>
                              </div>
                              <Button size="sm" variant="flat" color="primary">
                                Start Session
                              </Button>
                            </div>
                            
                            <Divider className="my-3" />
                            
                            <ul className="space-y-2">
                              {session.tasks.map((task, taskIdx) => (
                                <li key={taskIdx} className="flex items-center justify-between text-sm">
                                  <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs">
                                      {taskIdx + 1}
                                    </span>
                                    {task.name}
                                  </span>
                                  <Chip size="sm" variant="flat" color="default">
                                    {formatTarget(task.target)}
                                  </Chip>
                                </li>
                              ))}
                            </ul>
                          </CardBody>
                        </Card>
                      ))}
                    </div>
                  </Tab>
                  
                  {/* Macro Cycle Tab */}
                  <Tab key="macro" title="3-Month Overview">
                    <div className="space-y-6 mt-4">
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                        {selectedPlan.plan_data?.macro_cycle?.title}
                      </h3>
                      
                      <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary-400 via-primary-500 to-primary-600" />
                        
                        {selectedPlan.plan_data?.macro_cycle?.phases?.map((phase, idx) => (
                          <div key={idx} className="relative pl-14 pb-8 last:pb-0">
                            {/* Timeline dot */}
                            <div className="absolute left-3 w-5 h-5 rounded-full bg-primary-500 border-4 border-white dark:border-zinc-900 shadow-lg" />
                            
                            <Card className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                              <CardBody>
                                <div className="flex items-start justify-between">
                                  <div>
                                    <Chip size="sm" color="primary" variant="flat" className="mb-2">
                                      Weeks {idx * 4 + 1} - {(idx + 1) * 4}
                                    </Chip>
                                    <h4 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
                                      {phase.name}
                                    </h4>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                      {phase.focus}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-2xl font-bold text-primary-500">{phase.weeks}</p>
                                    <p className="text-xs text-zinc-500">weeks</p>
                                  </div>
                                </div>
                              </CardBody>
                            </Card>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Tab>
                </Tabs>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Close
                </Button>
                <Button color="primary">
                  Start Training
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
