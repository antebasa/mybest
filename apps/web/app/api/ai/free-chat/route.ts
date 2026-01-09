import { NextRequest, NextResponse } from "next/server";
import { createAIClient, chatWithFallback, type Message } from "@repo/ai";
import { createClient } from "@/lib/supabase/server";

/**
 * AI Free Chat API
 * 
 * Used for goal deep-dive conversations and general AI coaching.
 * Supports custom system prompts and context injection.
 */
export async function POST(request: NextRequest) {
  try {
    const { messages, goalId, context } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Get user's API keys if available
    let userKeys: Record<string, string> | undefined;
    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("api_keys")
        .eq("user_id", user.id)
        .single();

      if (profile?.api_keys) {
        userKeys = profile.api_keys as Record<string, string>;
      }
    }

    // Try to use user keys, fall back to app keys
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
      
      if (apiKey || userKeys) {
        const client = createAIClient(apiKey, userKeys);
        
        const response = await client.chat(
          messages as Message[],
          { temperature: 0.7, maxTokens: 1024 }
        );

        // Log conversation if goal context
        if (user && goalId) {
          await logConversation(supabase, user.id, goalId, messages, response, context);
        }

        return NextResponse.json({
          message: response,
          provider: client.getProvider(),
          model: client.getModel(),
        });
      }
    } catch (singleError) {
      console.log("Primary AI failed, trying fallback...", singleError);
    }

    // Use fallback system
    const result = await chatWithFallback(messages as Message[], {
      temperature: 0.7,
      maxTokens: 1024,
    });

    // Log conversation if goal context
    if (user && goalId) {
      await logConversation(supabase, user.id, goalId, messages, result.content, context);
    }

    return NextResponse.json({
      message: result.content,
      provider: result.provider,
      model: result.model,
    });

  } catch (error) {
    console.error("Free Chat Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI chat failed" },
      { status: 500 }
    );
  }
}

/**
 * Log conversation to database for context building
 */
async function logConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  goalId: string,
  messages: Message[],
  response: string,
  context?: string
) {
  try {
    // Save the latest exchange to chat_messages
    const lastUserMessage = messages.filter(m => m.role === "user").pop();
    if (lastUserMessage) {
      await supabase.from("chat_messages").insert([
        {
          user_id: userId,
          goal_id: goalId,
          role: "user",
          content: lastUserMessage.content,
          metadata: { context: context || "goal_chat" },
        },
        {
          user_id: userId,
          goal_id: goalId,
          role: "assistant",
          content: response,
          metadata: { context: context || "goal_chat" },
        },
      ]);
    }
  } catch (err) {
    console.error("Failed to log conversation:", err);
  }
}
