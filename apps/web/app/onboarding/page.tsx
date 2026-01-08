"use client";

import { useState, useRef, useEffect } from "react";
import { Button, Input, Card, CardBody, Progress, Avatar } from "@heroui/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: "Hey there! 👋 I'm your AI coach. I'm here to help you become the best version of yourself. Let's start by getting to know each other a bit better.",
  },
  {
    id: "2",
    role: "assistant",
    content: "First things first—what should I call you?",
  },
];

export default function OnboardingPage() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [step, setStep] = useState(0);
  const [userData, setUserData] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendToAI = async (userMessage: string, history: Message[]): Promise<string> => {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
          context: "onboarding",
        }),
      });

      const data = await response.json();
      return data.message;
    } catch (error) {
      console.error("AI Error:", error);
      // Return fallback
      return getFallbackResponse(step);
    }
  };

  const getFallbackResponse = (currentStep: number): string => {
    const responses = [
      `Nice to meet you! 🎉 Now, what's the main thing you want to improve? It could be anything—sports like darts or running, fitness goals, or building better habits.`,
      `Great choice! What's your experience level?\n\n• Complete beginner\n• Some experience\n• Intermediate\n• Advanced`,
      `Got it! How many days per week can you dedicate to training? And roughly how much time per session?`,
      `Perfect! What's your personality like when it comes to challenges?\n\n• 🔥 Tenacious\n• 📊 Analytical\n• 🎮 Playful\n• 🎯 Goal-driven`,
      `Awesome! I have everything I need to create your personalized journey! 🚀\n\nReady to start?`,
    ];
    return responses[Math.min(currentStep, responses.length - 1)];
  };

  const saveUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update user metadata
      await supabase.auth.updateUser({
        data: {
          full_name: userData.name,
          onboarding_completed: true,
        },
      });

      // Save to user_profiles table (when DB is ready)
      // For now, just log it
      console.log("User profile data:", userData);
    } catch (error) {
      console.error("Error saving profile:", error);
    }
  };

  const processResponse = async (userMessage: string) => {
    setIsTyping(true);
    
    const newUserData = { ...userData };

    // Extract data based on step
    switch (step) {
      case 0:
        newUserData.name = userMessage;
        break;
      case 1:
        newUserData.mainGoal = userMessage;
        break;
      case 2:
        newUserData.experienceLevel = userMessage;
        break;
      case 3:
        newUserData.schedule = userMessage;
        break;
      case 4:
        newUserData.personality = userMessage;
        break;
    }
    setUserData(newUserData);

    // Build message history
    const newHistory: Message[] = [
      ...messages,
      { id: Date.now().toString(), role: "user", content: userMessage },
    ];

    // Get AI response
    const aiResponse = await sendToAI(userMessage, newHistory);

    setStep((prev) => prev + 1);
    setIsTyping(false);

    setMessages([
      ...newHistory,
      {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: aiResponse,
      },
    ]);

    // If onboarding complete, save and redirect
    if (step >= 4) {
      await saveUserProfile();
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    processResponse(input);
  };

  const progressPercentage = Math.min((step / 5) * 100, 100);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center">
              <span className="text-white font-bold text-sm">MB</span>
            </div>
            <div>
              <span className="font-semibold">My Best</span>
              <span className="text-zinc-500 ml-2 text-sm">Onboarding</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-zinc-500">Step {Math.min(step + 1, 5)} of 5</div>
            <ThemeToggle />
          </div>
        </div>
        <div className="max-w-2xl mx-auto mt-3">
          <Progress
            value={progressPercentage}
            size="sm"
            classNames={{
              indicator: "bg-gradient-to-r from-indigo-500 to-cyan-500",
            }}
          />
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 pt-28 pb-24 px-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`flex items-start gap-3 max-w-[85%] ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                {message.role === "assistant" && (
                  <Avatar
                    size="sm"
                    className="bg-gradient-to-br from-indigo-500 to-cyan-400 text-white flex-shrink-0"
                    name="AI"
                  />
                )}
                <Card
                  className={`${
                    message.role === "user"
                      ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white"
                      : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <CardBody className="py-3 px-4">
                    <p className="text-sm whitespace-pre-line">{message.content}</p>
                  </CardBody>
                </Card>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-start gap-3">
                <Avatar
                  size="sm"
                  className="bg-gradient-to-br from-indigo-500 to-cyan-400 text-white flex-shrink-0"
                  name="AI"
                />
                <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <CardBody className="py-3 px-4">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
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
      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-lg border-t border-zinc-200 dark:border-zinc-800 p-4">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex gap-3">
          {step < 5 ? (
            <>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your response..."
                variant="bordered"
                size="lg"
                classNames={{
                  inputWrapper: "bg-white dark:bg-zinc-900",
                }}
                disabled={isTyping}
              />
              <Button
                type="submit"
                isDisabled={!input.trim() || isTyping}
                className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white px-6"
                size="lg"
              >
                Send
              </Button>
            </>
          ) : (
            <Button
              onPress={() => router.push("/dashboard")}
              className="w-full bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-semibold"
              size="lg"
            >
              Go to Dashboard 🚀
            </Button>
          )}
        </form>
      </footer>
    </div>
  );
}
