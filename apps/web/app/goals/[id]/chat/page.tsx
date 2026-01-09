"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button, Card, CardBody, Progress, Avatar, Spinner, Chip } from "@heroui/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

// ============================================
// TYPES
// ============================================

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  mediaRequest?: boolean;
}

interface GeneratedPlan {
  microCycle: {
    title: string;
    durationDays: number;
    description: string;
    sessions: Array<{
      dayOffset: number;
      dayOfWeek: string;
      title: string;
      description: string;
      durationMinutes: number;
      tasks: Array<{
        name: string;
        description: string;
        type: string;
        target: { value: number; unit: string };
        tips: string;
      }>;
    }>;
    expectedOutcomes: string[];
  };
  macroCycle: {
    title: string;
    durationMonths: number;
    phases: Array<{
      name: string;
      weeks: number;
      focus: string;
      objectives: string[];
      milestones: string[];
    }>;
    ultimateGoal: string;
  };
  aiReasoning: string;
}

// ============================================
// GOAL CHAT PAGE (Phase 2 Key Feature)
// ============================================

export default function GoalChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  
  const goalId = params.id as string;
  const goalTitle = searchParams.get("goalTitle") || "Your Goal";
  const goalType = searchParams.get("goalType") || "custom";
  const experienceLevel = searchParams.get("experienceLevel") || "beginner";
  const daysPerWeek = parseInt(searchParams.get("daysPerWeek") || "3");
  const minutesPerSession = parseInt(searchParams.get("minutesPerSession") || "30");
  const shortTermGoal = searchParams.get("shortTermGoal") || "";
  const longTermGoal = searchParams.get("longTermGoal") || "";
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReadyForPlan, setIsReadyForPlan] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);
  const [showPlanPreview, setShowPlanPreview] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input
  useEffect(() => {
    if (!isProcessing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isProcessing]);

  // Start conversation on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    startConversation();
  }, []);

  // ============================================
  // AI CHAT
  // ============================================

  const getSystemPrompt = () => {
    return `You are an expert AI coach helping a user refine their ${goalType} goal and prepare for plan generation.

USER'S GOAL DETAILS:
- Goal: ${goalTitle}
- Type: ${goalType}
- Experience Level: ${experienceLevel}
- Schedule: ${daysPerWeek} days/week, ${minutesPerSession} minutes/session
- Short-term goal (2-4 weeks): ${shortTermGoal || "Not specified"}
- Long-term vision (2-3 months): ${longTermGoal || "Not specified"}

YOUR TASK:
Have a focused conversation to understand their goal better. Ask about:
1. Their current level and any experience
2. Equipment/resources they have access to
3. Specific aspects they want to improve
4. Any constraints or preferences
5. What's worked or not worked before

GUIDELINES:
- Ask 1-2 questions at a time, not a wall of text
- Be specific to ${goalType}
- After 3-5 exchanges, you should have enough info
- Keep responses concise and natural
- Show genuine expertise in ${goalType}
- Use 1-2 emojis per message max

${goalType === "darts" ? `
DARTS-SPECIFIC QUESTIONS:
- Do you have your own darts and board?
- What's your typical score range?
- Are you focusing on 501, cricket, or both?
- What's your biggest challenge (accuracy, consistency, doubles)?
` : ""}

${goalType === "running" ? `
RUNNING-SPECIFIC QUESTIONS:
- What's the longest distance you've run recently?
- Any races or events coming up?
- Road, trail, or treadmill preference?
- Any history of injuries?
` : ""}

${goalType === "bodyweight" ? `
CALISTHENICS-SPECIFIC QUESTIONS:
- Can you do push-ups/pull-ups currently?
- Any equipment (pull-up bar, rings)?
- Specific skills you want (muscle-up, handstand)?
- Current flexibility level?
` : ""}

${goalType === "weightloss" ? `
WEIGHT LOSS-SPECIFIC QUESTIONS:
- Current and target weight?
- Previous attempts - what worked/didn't?
- Dietary restrictions or preferences?
- Open to tracking food intake?
` : ""}

When you feel you have enough information (usually after 3-5 exchanges), end your message with:
[READY_FOR_PLAN]

This signals we can generate the training plan.`;
  };

  const sendToAI = async (conversationMessages: Message[]): Promise<string> => {
    const response = await fetch("/api/ai/free-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: getSystemPrompt() },
          ...conversationMessages.map((m) => ({ role: m.role, content: m.content })),
        ],
        goalId,
        context: "goal_deepdive",
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to get AI response");
    }

    const data = await response.json();
    return data.message;
  };

  const startConversation = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const openingMessage = `Awesome! So you want to ${goalType === "custom" ? goalTitle.toLowerCase() : `get better at ${goalTitle.toLowerCase()}`}! 🎯

I've got your basics:
• Experience: ${experienceLevel.replace("_", " ")}
• Schedule: ${daysPerWeek} days/week, ${minutesPerSession} min sessions
${shortTermGoal ? `• 2-week goal: ${shortTermGoal}` : ""}
${longTermGoal ? `• 3-month vision: ${longTermGoal}` : ""}

Let me ask a few more questions to create the perfect plan for you.

${getFirstQuestion()}`;

      const welcomeMessage: Message = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: openingMessage,
      };
      
      setMessages([welcomeMessage]);
    } catch (err) {
      console.error("Failed to start conversation:", err);
      setError(err instanceof Error ? err.message : "Failed to connect to AI");
    } finally {
      setIsProcessing(false);
    }
  };

  const getFirstQuestion = () => {
    switch (goalType) {
      case "darts":
        return "First off - do you have your own darts and dartboard at home? And have you played before, even casually?";
      case "running":
        return "What's the longest distance you've run recently? And do you usually run on roads, trails, or a treadmill?";
      case "bodyweight":
        return "Can you currently do push-ups with good form? What about pull-ups - any at all?";
      case "weightloss":
        return "What's your current weight and goal weight? And have you tried losing weight before - what happened?";
      case "weighttraining":
        return "Do you have gym access? And what's your main focus - building muscle, getting stronger, or both?";
      case "football":
        return "What position do you play or want to play? And are you currently on a team?";
      case "tennis":
        return "How often do you get to play? And what's the biggest challenge in your game right now?";
      default:
        return "What specifically do you want to achieve? And what resources do you currently have to work with?";
    }
  };

  // ============================================
  // HANDLE SUBMIT
  // ============================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing || showPlanPreview) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsProcessing(true);
    setError(null);
    setQuestionCount(prev => prev + 1);

    try {
      const aiResponse = await sendToAI(newMessages);
      
      // Check if AI is ready for plan generation
      const isReady = aiResponse.includes("[READY_FOR_PLAN]");
      const displayMessage = aiResponse.replace("[READY_FOR_PLAN]", "").trim();

      const assistantMessage: Message = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: displayMessage,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      if (isReady) {
        setIsReadyForPlan(true);
      }
      
      // Save conversation to goal
      await saveConversation([...newMessages, assistantMessage]);
      
    } catch (err) {
      console.error("AI error:", err);
      setError(err instanceof Error ? err.message : "Failed to get response");
      
      const fallbackMessage: Message = {
        id: `ai-fallback-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I had a brief hiccup! Could you repeat that?",
      };
      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================
  // SAVE CONVERSATION
  // ============================================

  const saveConversation = async (msgs: Message[]) => {
    try {
      await supabase
        .from("goals")
        .update({
          ai_conversation: msgs.map(m => ({ role: m.role, content: m.content })),
          updated_at: new Date().toISOString(),
        })
        .eq("id", goalId);
    } catch (err) {
      console.error("Failed to save conversation:", err);
    }
  };

  // ============================================
  // GENERATE PLAN
  // ============================================

  const handleGeneratePlan = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Get user profile for context
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // Build the conversation summary for plan generation
      const conversationSummary = messages
        .filter(m => m.role === "user")
        .map(m => m.content)
        .join("\n");

      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalId,
          goalTitle,
          goalType,
          experienceLevel,
          shortTermGoal,
          longTermGoal,
          schedule: {
            daysPerWeek,
            minutesPerSession,
            preferredDays: profile?.weekly_availability?.days || [],
          },
          userProfile: profile,
          conversation: messages.map(m => ({ role: m.role, content: m.content })),
          conversationSummary,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate plan");
      }

      const data = await response.json();
      console.log("Generated plan:", data);
      
      if (data.plan) {
        // Transform to our expected format if needed
        const plan: GeneratedPlan = {
          microCycle: {
            title: data.plan.micro_cycle?.title || `${goalTitle} Foundation`,
            durationDays: data.plan.micro_cycle?.sessions?.length * 2 || 14,
            description: data.plan.micro_cycle?.description || "",
            sessions: data.plan.micro_cycle?.sessions?.map((s: any, idx: number) => ({
              dayOffset: s.day || idx,
              dayOfWeek: getDayOfWeek(s.day || idx),
              title: s.title,
              description: s.description || "",
              durationMinutes: s.duration_min || minutesPerSession,
              tasks: s.tasks || [],
            })) || [],
            expectedOutcomes: data.plan.micro_cycle?.expected_outcomes || [],
          },
          macroCycle: {
            title: data.plan.macro_cycle?.title || `${goalTitle} Journey`,
            durationMonths: 3,
            phases: data.plan.macro_cycle?.phases || [],
            ultimateGoal: longTermGoal || "Achieve mastery",
          },
          aiReasoning: data.plan.ai_reasoning || "Plan created based on your inputs.",
        };
        
        setGeneratedPlan(plan);
        setShowPlanPreview(true);
        
        // Add message about plan
        setMessages(prev => [...prev, {
          id: `ai-plan-${Date.now()}`,
          role: "assistant",
          content: `I've created your personalized ${goalTitle} plan! 🎉\n\nTake a look at the preview above. It includes:\n• ${plan.microCycle.sessions.length} sessions over ${Math.ceil(plan.microCycle.durationDays / 7)} weeks\n• A 3-month roadmap with ${plan.macroCycle.phases.length} phases\n\nIf it looks good, confirm it and we'll add it to your calendar!`,
        }]);
      }
    } catch (err) {
      console.error("Plan generation error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setIsProcessing(false);
    }
  };

  const getDayOfWeek = (dayNum: number) => {
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    return days[dayNum % 7];
  };

  // ============================================
  // CONFIRM PLAN
  // ============================================

  const handleConfirmPlan = async () => {
    if (!generatedPlan) return;
    setIsSavingPlan(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // The plan was already saved by generate-plan API
      // Just navigate to plans page
      
      setMessages(prev => [...prev, {
        id: `ai-confirm-${Date.now()}`,
        role: "assistant",
        content: `Your plan is ready! 🚀 I've added all sessions to your calendar. Let's crush this goal together!\n\nHead to your Calendar to see your upcoming sessions, or check out the Plans page for the full overview.`,
      }]);

      // Short delay then redirect
      setTimeout(() => {
        router.push("/plans");
      }, 2000);
      
    } catch (err) {
      console.error("Failed to save plan:", err);
      setError(err instanceof Error ? err.message : "Failed to save plan");
    } finally {
      setIsSavingPlan(false);
    }
  };

  // ============================================
  // MANUALLY TRIGGER PLAN (skip more questions)
  // ============================================

  const handleSkipToGenerate = () => {
    setIsReadyForPlan(true);
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-zinc-100 via-zinc-50 to-indigo-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-indigo-950">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/goals" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
              ← Back
            </Link>
            <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-700" />
            <div className="flex items-center gap-2">
              <span className="text-xl">{getGoalIcon(goalType)}</span>
              <div>
                <span className="font-semibold text-zinc-900 dark:text-white">{goalTitle}</span>
                <Chip size="sm" variant="flat" className="ml-2">{experienceLevel.replace("_", " ")}</Chip>
              </div>
            </div>
          </div>
          <ThemeToggle />
        </div>
        {/* Progress Bar */}
        <div className="max-w-3xl mx-auto mt-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <span>Goal Deep-Dive</span>
            <span>→</span>
            <span className={isReadyForPlan ? "text-indigo-500 font-medium" : ""}>Plan Generation</span>
            <span>→</span>
            <span className={showPlanPreview ? "text-indigo-500 font-medium" : ""}>Review & Confirm</span>
          </div>
          <Progress
            value={showPlanPreview ? 100 : isReadyForPlan ? 66 : Math.min(questionCount * 15, 50)}
            size="sm"
            classNames={{
              track: "bg-zinc-200 dark:bg-zinc-800",
              indicator: "bg-gradient-to-r from-indigo-500 to-cyan-500",
            }}
          />
        </div>
      </header>

      {/* Plan Preview Modal */}
      {showPlanPreview && generatedPlan && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Plan Header */}
            <div className="sticky top-0 bg-white dark:bg-zinc-900 p-6 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                    ✨ Your Personalized Plan
                  </h2>
                  <p className="text-sm text-zinc-500">{generatedPlan.microCycle.title}</p>
                </div>
                <button
                  onClick={() => setShowPlanPreview(false)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Plan Content */}
            <div className="p-6 space-y-6">
              {/* AI Reasoning */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-cyan-50 dark:from-indigo-900/20 dark:to-cyan-900/20 border border-indigo-200 dark:border-indigo-800">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  <strong>🤖 AI Reasoning:</strong> {generatedPlan.aiReasoning}
                </p>
              </div>

              {/* Micro Cycle Preview */}
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                  📅 2-Week Quick Start
                  <Chip size="sm" variant="flat" color="primary">{generatedPlan.microCycle.sessions.length} sessions</Chip>
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {generatedPlan.microCycle.sessions.slice(0, 6).map((session, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-indigo-500 font-medium uppercase">
                          Day {session.dayOffset + 1} • {session.dayOfWeek}
                        </span>
                        <span className="text-xs text-zinc-400">{session.durationMinutes} min</span>
                      </div>
                      <h4 className="font-medium text-zinc-900 dark:text-white text-sm">{session.title}</h4>
                      <p className="text-xs text-zinc-500 mt-1">{session.tasks?.length || 0} tasks</p>
                    </div>
                  ))}
                </div>
                {generatedPlan.microCycle.sessions.length > 6 && (
                  <p className="text-sm text-zinc-500 mt-2">
                    +{generatedPlan.microCycle.sessions.length - 6} more sessions...
                  </p>
                )}
              </div>

              {/* Macro Cycle Preview */}
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-white mb-3">
                  🎯 3-Month Roadmap
                </h3>
                <div className="space-y-2">
                  {generatedPlan.macroCycle.phases.map((phase, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-zinc-900 dark:text-white text-sm">{phase.name}</h4>
                        <p className="text-xs text-zinc-500">{phase.focus}</p>
                      </div>
                      <span className="text-xs text-zinc-400">{phase.weeks} weeks</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Plan Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-zinc-900 p-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-between">
              <Button
                variant="flat"
                onPress={() => setShowPlanPreview(false)}
              >
                Back to Chat
              </Button>
              <Button
                className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white"
                onPress={handleConfirmPlan}
                isLoading={isSavingPlan}
              >
                Confirm & Start Training 🚀
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="fixed top-28 left-0 right-0 z-40 px-4">
          <div className="max-w-3xl mx-auto bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 text-sm text-red-700 dark:text-red-300">
            ⚠️ {error}
          </div>
        </div>
      )}

      {/* Chat Area */}
      <main className="flex-1 pt-36 pb-40 px-4 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`flex items-start gap-3 max-w-[85%] ${
                  message.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                {message.role === "assistant" && (
                  <Avatar
                    size="sm"
                    className="bg-gradient-to-br from-indigo-500 to-cyan-400 text-white flex-shrink-0 shadow-md"
                    name="AI"
                  />
                )}
                <Card
                  className={`${
                    message.role === "user"
                      ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/20"
                      : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm"
                  }`}
                >
                  <CardBody className="py-3 px-4">
                    <p className="text-sm whitespace-pre-line leading-relaxed">
                      {message.content}
                    </p>
                  </CardBody>
                </Card>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isProcessing && (
            <div className="flex justify-start animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <Avatar
                  size="sm"
                  className="bg-gradient-to-br from-indigo-500 to-cyan-400 text-white flex-shrink-0"
                  name="AI"
                />
                <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <CardBody className="py-3 px-4">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </CardBody>
                </Card>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 p-4">
        <div className="max-w-3xl mx-auto">
          {!showPlanPreview ? (
            <div className="space-y-3">
              <form onSubmit={handleSubmit} className="flex gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isReadyForPlan ? "Add more details or generate your plan..." : "Type your response..."}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 transition-all"
                />
                <Button
                  type="submit"
                  isDisabled={!input.trim() || isProcessing}
                  className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white px-6 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:shadow-none"
                >
                  {isProcessing ? (
                    <Spinner size="sm" color="white" />
                  ) : (
                    <span className="flex items-center gap-2">
                      Send
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </span>
                  )}
                </Button>
              </form>
              
              {/* Generate Plan Button */}
              {(isReadyForPlan || questionCount >= 2) && (
                <Button
                  onPress={handleGeneratePlan}
                  isDisabled={isProcessing}
                  className={`w-full ${
                    isReadyForPlan 
                      ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold" 
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {isProcessing ? (
                    <Spinner size="sm" />
                  ) : isReadyForPlan ? (
                    "✨ Generate My Plan"
                  ) : (
                    "Skip to Plan Generation →"
                  )}
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center">
              <Button
                onPress={() => setShowPlanPreview(true)}
                className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white"
              >
                View Your Plan ✨
              </Button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

// Helper function
function getGoalIcon(type: string) {
  const icons: Record<string, string> = {
    darts: "🎯",
    running: "🏃",
    bodyweight: "💪",
    weightloss: "⚖️",
    weighttraining: "🏋️",
    football: "⚽",
    tennis: "🎾",
    habit: "✨",
    custom: "🎨",
  };
  return icons[type] || "🎯";
}
