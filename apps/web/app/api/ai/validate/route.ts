/**
 * AI Validation Endpoint
 * 
 * Validates user input through LLM before accepting it.
 * This ensures nonsense answers are caught and the user is prompted for valid responses.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  AIClient,
  validateInput,
  type ValidationContext,
  type ValidationResult,
} from "@repo/ai";

export interface ValidateRequest {
  input: string;
  context: ValidationContext;
  question: string;
  previousAttempts?: number;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface ValidateResponse extends ValidationResult {
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ValidateResponse>> {
  try {
    // Parse request body
    const body: ValidateRequest = await request.json();
    const { input, context, question, previousAttempts = 0, conversationHistory = [] } = body;

    // Validate required fields
    if (!input || typeof input !== "string") {
      return NextResponse.json(
        {
          isValid: false,
          followUpQuestion: "I didn't catch that. Could you please type your response?",
          confidence: 1.0,
          error: "Input is required",
        },
        { status: 400 }
      );
    }

    if (!context) {
      return NextResponse.json(
        {
          isValid: false,
          error: "Validation context is required",
          confidence: 0,
        },
        { status: 400 }
      );
    }

    // Get user's API keys if available
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    let userApiKeys: Record<string, string> | undefined;
    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("api_keys")
        .eq("user_id", user.id)
        .single();
      
      if (profile?.api_keys) {
        userApiKeys = profile.api_keys as Record<string, string>;
      }
    }

    // Create AI client (will use user's key if available, otherwise app key)
    const apiKey = process.env.GEMINI_API_KEY;
    let client: AIClient;

    try {
      // Try user keys first
      if (userApiKeys && Object.keys(userApiKeys).length > 0) {
        const provider = Object.keys(userApiKeys)[0] as "gemini" | "openai" | "anthropic" | "openrouter";
        client = new AIClient(userApiKeys[provider]!, { provider });
      } else if (apiKey) {
        client = new AIClient(apiKey);
      } else {
        // No API key available - use quick validation only
        return handleQuickValidationOnly(input, context);
      }
    } catch {
      return handleQuickValidationOnly(input, context);
    }

    // Perform validation
    const result = await validateInput(client, {
      input,
      context,
      question,
      previousAttempts,
      conversationHistory: conversationHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    // Log validation for debugging (optional - can be disabled in production)
    if (user && process.env.NODE_ENV === "development") {
      await logValidation(supabase, user.id, {
        context,
        question,
        input,
        result,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Validation endpoint error:", error);
    
    return NextResponse.json(
      {
        isValid: false,
        followUpQuestion: "Something went wrong. Could you try again?",
        confidence: 0.5,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle cases where no AI is available - use quick local validation
 * PRINCIPLE: Be LENIENT for most contexts. Only strict for name and days.
 */
function handleQuickValidationOnly(
  input: string,
  context: ValidationContext
): NextResponse<ValidateResponse> {
  const trimmed = input.trim();

  // Empty input - always reject
  if (!trimmed) {
    return NextResponse.json({
      isValid: false,
      followUpQuestion: "I didn't catch that. Could you please type your response?",
      confidence: 1.0,
    });
  }

  // === STRICT CONTEXTS (actually validate) ===

  // Name validation - must look like a name
  if (context === "name") {
    if (/^[a-zA-Z\s'-]{1,50}$/.test(trimmed) && trimmed.length >= 2) {
      return NextResponse.json({
        isValid: true,
        parsedValue: { name: trimmed },
        confidence: 0.95,
      });
    }
    return NextResponse.json({
      isValid: false,
      followUpQuestion: "Could you please tell me your name?",
      confidence: 0.8,
    });
  }

  // Days validation - must contain day references
  if (context === "days_available") {
    const lower = trimmed.toLowerCase();
    const dayPatterns = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|weekday|weekend|everyday|daily|anyday|any day)\b/i;
    
    if (dayPatterns.test(lower)) {
      // Extract days
      const days: string[] = [];
      if (/monday|mon\b/i.test(lower)) days.push("monday");
      if (/tuesday|tue\b/i.test(lower)) days.push("tuesday");
      if (/wednesday|wed\b/i.test(lower)) days.push("wednesday");
      if (/thursday|thu\b/i.test(lower)) days.push("thursday");
      if (/friday|fri\b/i.test(lower)) days.push("friday");
      if (/saturday|sat\b/i.test(lower)) days.push("saturday");
      if (/sunday|sun\b/i.test(lower)) days.push("sunday");
      if (/weekday/i.test(lower)) days.push("monday", "tuesday", "wednesday", "thursday", "friday");
      if (/weekend/i.test(lower)) days.push("saturday", "sunday");
      if (/everyday|every day|daily|anyday|any day/i.test(lower)) 
        days.push("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday");
      
      return NextResponse.json({
        isValid: true,
        parsedValue: { days: [...new Set(days)], raw: trimmed },
        confidence: 0.9,
      });
    }
    
    return NextResponse.json({
      isValid: false,
      followUpQuestion: "Which days work for you? For example: Monday, Wednesday, Friday, or just 'weekends'?",
      confidence: 0.9,
    });
  }

  // Yes/No validation
  if (context === "yes_no") {
    const lower = trimmed.toLowerCase();
    const yesWords = ["yes", "yeah", "yep", "yup", "sure", "ok", "okay", "definitely", "absolutely", "of course", "y"];
    const noWords = ["no", "nope", "nah", "not really", "never", "n"];
    
    if (yesWords.includes(lower)) {
      return NextResponse.json({ isValid: true, parsedValue: { value: true }, confidence: 1.0 });
    }
    if (noWords.includes(lower)) {
      return NextResponse.json({ isValid: true, parsedValue: { value: false }, confidence: 1.0 });
    }
    
    return NextResponse.json({
      isValid: false,
      followUpQuestion: "Is that a yes or no?",
      confidence: 0.9,
    });
  }

  // Number validation
  if (context === "number") {
    const num = parseInt(trimmed, 10);
    if (!isNaN(num)) {
      return NextResponse.json({ isValid: true, parsedValue: { value: num }, confidence: 1.0 });
    }
    return NextResponse.json({
      isValid: false,
      followUpQuestion: "Could you give me a number?",
      confidence: 0.9,
    });
  }

  // === PERMISSIVE CONTEXTS (accept almost anything) ===

  // Free text - always valid
  if (context === "free_text") {
    return NextResponse.json({
      isValid: true,
      parsedValue: { text: trimmed },
      confidence: 1.0,
    });
  }

  // Interests - always accept, extract comma-separated values
  if (context === "interests") {
    return NextResponse.json({
      isValid: true,
      parsedValue: { 
        interests: trimmed.split(/[,;]/).map(s => s.trim()).filter(Boolean),
        raw: trimmed 
      },
      confidence: 0.9,
    });
  }

  // Personality - always accept
  if (context === "personality") {
    return NextResponse.json({
      isValid: true,
      parsedValue: { personality: trimmed },
      confidence: 0.9,
    });
  }

  // Physical info - always accept
  if (context === "physical_info") {
    const isNone = /\b(none|no|nope|nothing|n\/a|na)\b/i.test(trimmed.toLowerCase());
    return NextResponse.json({
      isValid: true,
      parsedValue: { limitations: isNone ? [] : [trimmed] },
      confidence: 0.9,
    });
  }

  // Experience level - always accept
  if (context === "experience_level") {
    return NextResponse.json({
      isValid: true,
      parsedValue: { level: trimmed },
      confidence: 0.8,
    });
  }

  // Goal description - always accept if has some content
  if (context === "goal_description") {
    return NextResponse.json({
      isValid: true,
      parsedValue: { goal: trimmed },
      confidence: 0.9,
    });
  }

  // Duration - accept if reasonable
  if (context === "duration") {
    return NextResponse.json({
      isValid: true,
      parsedValue: { duration: trimmed },
      confidence: 0.8,
    });
  }

  // Time available - accept if reasonable
  if (context === "time_available") {
    return NextResponse.json({
      isValid: true,
      parsedValue: { timePreference: trimmed },
      confidence: 0.8,
    });
  }

  // Default: Accept everything else (be permissive!)
  return NextResponse.json({
    isValid: true,
    parsedValue: { raw: trimmed },
    confidence: 0.7,
    reasoning: "Accepted without AI - permissive mode",
  });
}

/**
 * Log validation attempt for debugging
 */
async function logValidation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  data: {
    context: string;
    question: string;
    input: string;
    result: ValidationResult;
  }
): Promise<void> {
  try {
    await supabase.from("validation_logs").insert({
      user_id: userId,
      context: data.context,
      question: data.question,
      user_input: data.input,
      ai_response: data.result,
      is_valid: data.result.isValid,
    });
  } catch (error) {
    // Non-critical - just log
    console.error("Failed to log validation:", error);
  }
}
