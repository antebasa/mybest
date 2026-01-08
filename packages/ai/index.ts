// Xiaomi MiMo AI Client
// Docs: https://platform.xiaomimimo.com/#/docs/quick-start/first-api-call

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

export class AIClient {
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, options?: { baseUrl?: string; model?: string }) {
    this.apiKey = apiKey;
    this.baseUrl = options?.baseUrl || "https://api.xiaomimimo.com/v1";
    this.model = options?.model || "MiMo-7B-RL";
  }

  async chat(messages: Message[], options?: { temperature?: number; maxTokens?: number }): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
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
          "Authorization": `Bearer ${this.apiKey}`,
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
          const lines = chunk.split("\n").filter(line => line.startsWith("data: "));
          
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
}

// System prompts for different contexts
export const SYSTEM_PROMPTS = {
  onboarding: `You are an empathetic and motivating AI coach for the "My Best" app. Your role is to help users become the best version of themselves.

During onboarding, you need to:
1. Learn the user's name
2. Understand their main goal (darts, running, fitness, etc.)
3. Assess their experience level
4. Learn their available schedule
5. Understand their personality/motivation style

Be conversational, warm, and encouraging. Use emojis sparingly but effectively. Keep responses concise (2-4 sentences max unless asking multiple choice).

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

// Helper to create the AI client
export function createAIClient(apiKey?: string) {
  const key = apiKey || process.env.XIAOMI_MIMO_API_KEY;
  if (!key) {
    throw new Error("AI API key is required");
  }
  return new AIClient(key);
}

export type { Message as AIMessage };
