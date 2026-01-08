import { NextRequest, NextResponse } from "next/server";
import { AIClient, SYSTEM_PROMPTS, type Message } from "@repo/ai";

export async function POST(request: NextRequest) {
  let messages: Message[] = [];
  let context = "";

  try {
    const body = await request.json();
    messages = body.messages || [];
    context = body.context || "";
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const apiKey = process.env.XIAOMI_MIMO_API_KEY;
    if (!apiKey) {
      throw new Error("AI service not configured");
    }

    const client = new AIClient(apiKey);

    // Select system prompt based on context
    const systemPrompt = context === "onboarding" 
      ? SYSTEM_PROMPTS.onboarding 
      : SYSTEM_PROMPTS.coach;

    const fullMessages: Message[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const response = await client.chat(fullMessages, {
      temperature: 0.7,
      maxTokens: 512,
    });

    return NextResponse.json({ message: response });
  } catch (error) {
    console.error("AI Chat Error:", error);
    
    // Fallback to simulated response if AI fails
    const lastMessage = messages[messages.length - 1]?.content || "";
    const fallbackResponse = generateFallbackResponse(lastMessage, messages.length);
    
    return NextResponse.json({ 
      message: fallbackResponse,
      fallback: true 
    });
  }
}

// Fallback responses when AI is unavailable
function generateFallbackResponse(userMessage: string, messageCount: number): string {
  const step = Math.floor((messageCount - 1) / 2);
  
  const responses = [
    `Nice to meet you! 🎉 Now, what's the main thing you want to improve? It could be anything—sports like darts or running, fitness goals, learning a new skill, or building better habits.`,
    `Great choice! To create the perfect plan for you, I need to understand where you're starting from. What's your experience level?\n\n• Complete beginner\n• Some experience\n• Intermediate\n• Advanced`,
    `Got it! Now let's talk about your schedule. How many days per week can you dedicate to training? And roughly how much time per session?`,
    `Perfect! One more thing—what's your personality like when it comes to challenges?\n\n• 🔥 Tenacious (love pushing through)\n• 📊 Analytical (prefer structured progress)\n• 🎮 Playful (learn through fun)\n• 🎯 Goal-driven (focused on results)`,
    `Awesome! I have everything I need. I'm setting up your personalized journey now! 🚀\n\nReady to start your transformation?`,
  ];

  return responses[Math.min(step, responses.length - 1)];
}
