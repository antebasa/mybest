/**
 * AI Chat Endpoint
 * 
 * Handles all AI chat interactions with full context awareness.
 * Supports multiple contexts: onboarding, goal chat, general coaching.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  chatWithFallback,
  type Message,
  buildUserContext,
  summarizeForPrompt,
  getOnboardingPrompt,
  getGoalChatPrompt,
  getCoachPrompt,
  type CondensedContext,
} from "@repo/ai";

export type ChatContext = "onboarding" | "goal" | "coach" | "general";

export interface ChatRequest {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  context: ChatContext;
  // For onboarding
  currentQuestion?: number;
  collectedData?: Record<string, unknown>;
  // For goal chat
  goalId?: string;
  goalType?: string;
  goalTitle?: string;
  // Save messages to DB?
  persist?: boolean;
  // Raw mode - don't add server system prompt, use client's messages as-is
  rawMode?: boolean;
}

export interface ChatResponse {
  message: string;
  fallback?: boolean;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  let messages: Message[] = [];
  let context: ChatContext = "general";

  try {
    const body: ChatRequest = await request.json();
    messages = (body.messages || []).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    context = body.context || "general";

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Get user context data if available
    let userContextData: CondensedContext | null = null;

    if (user) {
      // Fetch profile
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // Build user context for non-onboarding contexts
      if (context !== "onboarding" && profile) {
        const { data: goals } = await supabase
          .from("goals")
          .select("*")
          .eq("user_id", user.id);

        const { data: sessions } = await supabase
          .from("session_logs")
          .select("*")
          .eq("user_id", user.id)
          .order("completed_at", { ascending: false })
          .limit(10);

        const fullContext = buildUserContext(
          { id: user.id, email: user.email, full_name: user.user_metadata?.full_name },
          profile,
          goals || [],
          sessions || [],
          { totalSessions: 0, completedThisWeek: 0, currentStreak: 0 }
        );

        userContextData = summarizeForPrompt(fullContext);
      }
    }

    // Build full message array
    let fullMessages: Message[];

    if (body.rawMode) {
      // Raw mode - use client messages as-is (they include system prompt)
      fullMessages = messages;
    } else {
      // Build system prompt based on context
      let systemPrompt: string;

      switch (context) {
        case "onboarding":
          systemPrompt = getOnboardingPrompt(
            body.currentQuestion || 1,
            body.collectedData || {}
          );
          break;

        case "goal":
          if (!userContextData) {
            userContextData = {
              name: "User",
              summary: "New user setting up a goal.",
              currentGoals: [],
              recentPerformance: "No recent sessions.",
              keyTraits: [],
            };
          }
          systemPrompt = getGoalChatPrompt(
            body.goalType || "custom",
            body.goalTitle || "New Goal",
            userContextData
          );
          break;

        case "coach":
          if (!userContextData) {
            userContextData = {
              name: "User",
              summary: "User seeking coaching advice.",
              currentGoals: [],
              recentPerformance: "No recent sessions.",
              keyTraits: [],
            };
          }
          systemPrompt = getCoachPrompt(userContextData);
          break;

        default:
          systemPrompt = `You are a helpful AI assistant for the "My Best" personal development app. Be friendly, encouraging, and helpful.`;
      }

      fullMessages = [
        { role: "system", content: systemPrompt },
        ...messages,
      ];
    }

    // Call AI with multi-provider fallback
    const result = await chatWithFallback(fullMessages, {
      temperature: 0.7,
      maxTokens: 1024,
    });
    
    const response = result.content;

    // Optionally persist messages
    if (body.persist && user) {
      const lastUserMessage = messages[messages.length - 1];
      if (lastUserMessage) {
        // Save user message
        await supabase.from("chat_messages").insert({
          user_id: user.id,
          role: "user",
          content: lastUserMessage.content,
          goal_id: body.goalId || null,
          metadata: { context },
        });

        // Save assistant message
        await supabase.from("chat_messages").insert({
          user_id: user.id,
          role: "assistant",
          content: response,
          goal_id: body.goalId || null,
          metadata: { context },
        });
      }
    }

    return NextResponse.json({ message: response });
  } catch (error) {
    console.error("AI Chat Error:", error);

    // Fallback to simulated response if AI fails
    const fallbackResponse = generateFallbackResponse(context, messages.length);

    return NextResponse.json({
      message: fallbackResponse,
      fallback: true,
    });
  }
}

/**
 * Fallback responses when AI is unavailable
 */
function generateFallbackResponse(
  context: ChatContext,
  messageCount: number,
  body?: ChatRequest
): string {
  if (context === "onboarding") {
    const step = body?.currentQuestion || Math.floor((messageCount - 1) / 2);

    const responses = [
      `Nice to meet you! 🎉 Now, what brought you to My Best? What change are you hoping to make in your life?`,
      `Thanks for sharing! What activities or hobbies do you enjoy? Sports, creative pursuits, anything you're passionate about.`,
      `Great! How would you describe your typical day - are you fairly active, mostly sedentary, or somewhere in between?`,
      `Got it! Have you tried improving yourself before? What worked, what didn't?`,
      `Interesting! When things get tough, what's your style - do you push through, or do you need encouragement along the way?`,
      `Now let's talk about your schedule. What days of the week work best for you to train or practice?`,
      `Thanks! Any physical limitations or injuries I should know about? (Feel free to skip if none)`,
      `Almost done! What would success look like for you in the next 2 weeks?`,
      `Last one! Where do you see yourself in 3-6 months? What's your bigger vision?`,
      `Awesome! I have everything I need. Let's get started on your journey! 🚀`,
    ];

    return responses[Math.min(step, responses.length - 1)];
  }

  if (context === "goal") {
    return `Great choice! Tell me more about your experience with ${body?.goalType || "this activity"}. Are you a complete beginner, or have you done this before?`;
  }

  if (context === "coach") {
    return `I'm here to help! What would you like to work on today? I can answer questions about your training, give technique advice, or help you plan ahead.`;
  }

  return `I'm here to help you become your best self! What would you like to know?`;
}
