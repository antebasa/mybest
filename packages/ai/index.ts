/**
 * My Best AI Package
 * 
 * Unified AI client and utilities for the My Best app.
 * Supports multiple providers: Google Gemini, OpenAI, Anthropic, OpenRouter
 */

// ============================================
// CORE CLIENT
// ============================================

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export type AIProvider = "gemini" | "openai" | "anthropic" | "openrouter";

export interface AIClientOptions {
  baseUrl?: string;
  model?: string;
  provider?: AIProvider;
}

const PROVIDER_CONFIGS: Record<AIProvider, { baseUrl: string; defaultModel: string }> = {
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-flash",  // With fallback to other models if rate limited
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-opus-20240229",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-3-opus",
  },
};

export class AIClient {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private provider: AIProvider;

  constructor(apiKey: string, options?: AIClientOptions) {
    this.apiKey = apiKey;
    this.provider = options?.provider || "gemini";
    
    const config = PROVIDER_CONFIGS[this.provider];
    this.baseUrl = options?.baseUrl || config.baseUrl;
    this.model = options?.model || config.defaultModel;
  }

  async chat(
    messages: Message[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    try {
      // Handle Gemini with native API
      if (this.provider === "gemini") {
        return this.chatGemini(messages, options);
      }

      // Handle Anthropic differently (different API format)
      if (this.provider === "anthropic") {
        return this.chatAnthropic(messages, options);
      }

      // OpenAI-compatible format (OpenAI, OpenRouter)
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...(this.provider === "openrouter" && {
            "HTTP-Referer": "https://mybest.app",
            "X-Title": "My Best",
          }),
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 1024,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI API Error: ${response.status} - ${errorText}`);
      }

      const data: ChatResponse = await response.json();
      return data.choices[0]?.message?.content || "";
    } catch (error) {
      console.error("AI Service Error:", error);
      throw error;
    }
  }

  /**
   * Native Gemini API with retry and fallback
   */
  private async chatGemini(
    messages: Message[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    // Models to try in order (fallback if rate limited)
    // Each model has separate rate limits on free tier
    // Using versioned model names for v1beta API
    const modelsToTry = [
      this.model,                    // User's chosen model
      "gemini-2.0-flash-001",        // Versioned 2.0 flash
      "gemini-1.5-flash-001",        // Versioned 1.5 flash  
      "gemini-1.5-pro-001",          // Versioned 1.5 pro
      "gemini-1.0-pro-001",          // Versioned 1.0 pro
    ].filter((m, i, arr) => arr.indexOf(m) === i); // Remove duplicates

    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        const result = await this.callGeminiAPI(model, messages, options);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        
        // If rate limited, try next model
        if (lastError.message.includes("429") || lastError.message.includes("RESOURCE_EXHAUSTED")) {
          console.log(`Rate limited on ${model}, trying next model...`);
          // Small delay before trying next model
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        // If model not found, try next
        if (lastError.message.includes("404") || lastError.message.includes("NOT_FOUND")) {
          console.log(`Model ${model} not found, trying next...`);
          continue;
        }
        
        // For other errors, throw immediately
        throw lastError;
      }
    }

    throw lastError || new Error("All Gemini models failed");
  }

  private async callGeminiAPI(
    model: string,
    messages: Message[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    // Convert messages to Gemini format
    const systemInstruction = messages.find(m => m.role === "system")?.content;
    const chatMessages = messages.filter(m => m.role !== "system");

    // Build contents array in Gemini format
    const contents = chatMessages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const requestBody: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 1024,
      },
    };

    // Add system instruction if present
    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    const url = `${this.baseUrl}/models/${model}:generateContent`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Extract text from Gemini response format
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error("Unexpected Gemini response:", JSON.stringify(data));
      throw new Error("No text in Gemini response");
    }
    
    return text;
  }

  private async chatAnthropic(
    messages: Message[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    // Extract system message
    const systemMessage = messages.find((m) => m.role === "system")?.content || "";
    const userMessages = messages.filter((m) => m.role !== "system");

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options?.maxTokens ?? 1024,
        system: systemMessage,
        messages: userMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || "";
  }

  async streamChat(
    messages: Message[],
    onChunk: (chunk: string) => void,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 1024,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API Error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));

          for (const line of lines) {
            const data = line.replace("data: ", "");
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              if (content) {
                fullContent += content;
                onChunk(content);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      return fullContent;
    } catch (error) {
      console.error("AI Stream Error:", error);
      throw error;
    }
  }

  /**
   * Test if the API key is valid
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.chat(
        [{ role: "user", content: "Say 'OK' if you can hear me." }],
        { maxTokens: 10 }
      );
      return response.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get the current provider
   */
  getProvider(): AIProvider {
    return this.provider;
  }

  /**
   * Get the current model
   */
  getModel(): string {
    return this.model;
  }
}

// ============================================
// LEGACY SYSTEM PROMPTS (for backwards compatibility)
// ============================================

export const SYSTEM_PROMPTS = {
  onboarding: `You are an empathetic and motivating AI coach for the "My Best" app. Your role is to help users become the best version of themselves.

During onboarding, you need to:
1. Learn the user's name
2. Understand their main goal (darts, running, fitness, etc.)
3. Assess their experience level
4. Learn their available schedule
5. Understand their personality/motivation style

Be conversational, warm, and encouraging. Use emojis sparingly but effectively. Keep responses concise (2-4 sentences max unless asking multiple choice).

IMPORTANT: Validate user responses. If they give nonsense answers (like "blue" when asked for days), politely ask again.

After gathering all info, summarize what you learned and express excitement to start their journey.`,

  coach: `You are an expert AI coach for the "My Best" app. You have access to the user's profile, goals, and training history.

Your role is to:
- Provide personalized advice based on their data
- Analyze their performance and suggest improvements
- Adjust training plans based on progress
- Motivate and encourage them

Be specific, actionable, and supportive. Reference their actual data when giving advice.`,

  planGeneration: `You are a training plan generator for the "My Best" app. Based on the user's goal, experience level, and schedule, create a structured training plan.

Output your plan as valid JSON with this structure:
{
  "micro_cycle": {
    "title": "2-Week Quick Start",
    "sessions": [
      {
        "day": 1,
        "title": "Session Title",
        "duration_min": 30,
        "tasks": [
          { "name": "Task name", "type": "rep_based", "target": { "reps": 50 } }
        ]
      }
    ]
  },
  "macro_cycle": {
    "title": "3-Month Mastery",
    "phases": [
      { "name": "Foundation", "weeks": 4, "focus": "..." }
    ]
  }
}`,

  videoAnalysis: `You are analyzing a user's form/technique video. Provide specific, actionable feedback.

Structure your response as:
1. What they're doing well (1-2 points)
2. Areas for improvement (2-3 points)
3. Specific drill to practice (1 drill)

Be encouraging but honest. Reference specific body parts and movements.`,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Create an AI client with optional user key fallback
 */
export function createAIClient(
  apiKey?: string,
  userKeys?: Record<string, string>,
  preferredProvider?: AIProvider
): AIClient {
  // Priority: User's preferred provider key > User's any key > App key
  if (preferredProvider && userKeys?.[preferredProvider]) {
    return new AIClient(userKeys[preferredProvider], { provider: preferredProvider });
  }

  // Try user keys in order of preference
  const providerOrder: AIProvider[] = ["gemini", "openai", "anthropic", "openrouter"];
  for (const provider of providerOrder) {
    if (userKeys?.[provider]) {
      return new AIClient(userKeys[provider], { provider });
    }
  }

  // Fall back to app key
  const key = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!key) {
    throw new Error("AI API key is required. Set GEMINI_API_KEY in your environment.");
  }

  return new AIClient(key, { provider: "gemini" });
}

/**
 * Chat with automatic provider fallback
 * Tries primary provider first, then falls back to alternatives
 */
export async function chatWithFallback(
  messages: Message[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<{ content: string; provider: string; model: string }> {
  const providers: { key: string | undefined; provider: AIProvider; model?: string }[] = [
    { key: process.env.GEMINI_API_KEY, provider: "gemini" },
    { key: process.env.OPENAI_API_KEY, provider: "openai" },
    { key: process.env.ANTHROPIC_API_KEY, provider: "anthropic" },
    { key: process.env.OPENROUTER_API_KEY, provider: "openrouter", model: "mistralai/mixtral-8x7b-instruct" },
  ];

  let lastError: Error | null = null;

  for (const { key, provider, model } of providers) {
    if (!key) continue;

    try {
      const client = new AIClient(key, { provider, model });
      const content = await client.chat(messages, options);
      return { content, provider, model: client.getModel() };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.log(`Provider ${provider} failed, trying next...`, lastError.message.substring(0, 100));
      continue;
    }
  }

  throw lastError || new Error("All AI providers failed. Please check your API keys.");
}

/**
 * Parse JSON from AI response, handling common issues
 */
export function parseAIJson<T>(response: string): T | null {
  try {
    return JSON.parse(response);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // Fall through
      }
    }

    // Try to find JSON object in response
    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Fall through
      }
    }

    return null;
  }
}

// ============================================
// EXPORTS FROM SUB-MODULES
// ============================================

// Validation system
export {
  validateInput,
  validateBatch,
  type ValidationContext,
  type ValidationResult,
  type ValidationOptions,
  type BatchValidationItem,
  type BatchValidationResult,
} from "./validation";

// Context system
export {
  buildUserContext,
  summarizeForPrompt,
  generateAISummary,
  buildOnboardingContext,
  buildGoalChatContext,
  buildSessionContext,
  type UserContext,
  type UserProfile,
  type UserGoal,
  type SessionLog,
  type CondensedContext,
} from "./context";

// Prompts library
export {
  getOnboardingPrompt,
  getOnboardingExtractionPrompt,
  getOnboardingSummaryPrompt,
  getGoalChatPrompt,
  getGoalSummaryPrompt,
  getPlanGenerationPrompt,
  getPreSessionPrompt,
  getPostSessionPrompt,
  getMediaAnalysisPrompt,
  getAdaptationPrompt,
  getCoachPrompt,
  getProgressInsightsPrompt,
} from "./prompts";

// Type exports
export type { Message as AIMessage };
