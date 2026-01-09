/**
 * Extract Profile API
 * 
 * Takes an onboarding conversation and extracts structured profile data.
 * This is a separate call to ensure we get proper JSON output.
 */

import { NextRequest, NextResponse } from "next/server";
import { chatWithFallback, type Message } from "@repo/ai";

const EXTRACTION_PROMPT = `You are extracting structured data from an onboarding conversation.

Given the conversation below, extract the user's profile information into JSON.

IMPORTANT: You MUST respond with ONLY valid JSON, no other text. No markdown, no explanation.

Extract these fields (use null if not mentioned):
{
  "name": "user's name",
  "motivation": "why they want to improve",
  "interests": ["array", "of", "interests"],
  "lifestyle": "active/sedentary/mixed or description",
  "pastExperience": "their past self-improvement experience",
  "personality": "how they handle challenges",
  "availability": {
    "days": ["monday", "tuesday", etc],
    "timePreference": "morning/afternoon/evening/flexible"
  },
  "limitations": ["physical", "limitations"] or [],
  "shortTermGoal": "2 week goal",
  "longTermGoal": "3-6 month vision"
}

Respond with ONLY the JSON object, nothing else.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversation } = body as {
      conversation: Array<{ role: string; content: string }>;
    };

    if (!conversation || !Array.isArray(conversation)) {
      return NextResponse.json({ error: "Conversation array required" }, { status: 400 });
    }

    // Build the conversation text
    const conversationText = conversation
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    // Try AI extraction first
    try {
      const messages: Message[] = [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `Here is the onboarding conversation:\n\n${conversationText}\n\nExtract the profile JSON:` }
      ];

      const result = await chatWithFallback(messages, {
        temperature: 0.1,
        maxTokens: 1024,
      });

      console.log(`Extraction response from ${result.provider}/${result.model}:`, result.content.substring(0, 200));

      // Try to parse the JSON
      let profile = null;
      
      try {
        profile = JSON.parse(result.content);
      } catch {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            profile = JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.error("Failed to parse extracted JSON:", e);
          }
        }
      }

      if (profile) {
        return NextResponse.json({ 
          profile,
          provider: result.provider,
          model: result.model,
        });
      }
    } catch (aiError) {
      console.log("AI extraction failed, using keyword extraction:", aiError);
    }

    // Fallback: Simple keyword-based extraction from conversation
    console.log("Using keyword-based profile extraction...");
    const profile = extractProfileFromConversation(conversation);
    
    return NextResponse.json({ 
      profile,
      provider: "keyword-extraction",
      model: "fallback",
    });
  } catch (error) {
    console.error("Extract profile error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}

/**
 * Fallback: Extract profile data from conversation using keyword matching
 * Not as smart as AI, but works without API calls
 */
function extractProfileFromConversation(
  conversation: Array<{ role: string; content: string }>
): Record<string, unknown> {
  const userMessages = conversation
    .filter(m => m.role === "user")
    .map(m => m.content.toLowerCase());
  
  const allUserText = userMessages.join(" ");
  
  // Extract name (usually in first message)
  let name = null;
  const namePatterns = [
    /my name is (\w+)/i,
    /i'm (\w+)/i,
    /call me (\w+)/i,
    /name's (\w+)/i,
    /^(\w+)$/i, // Just a name by itself
  ];
  for (const msg of userMessages.slice(0, 3)) {
    for (const pattern of namePatterns) {
      const match = msg.match(pattern);
      if (match) {
        name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
        break;
      }
    }
    if (name) break;
  }

  // Extract interests/activities
  const interestKeywords = ["darts", "running", "fitness", "gym", "yoga", "swimming", "cycling", 
    "reading", "writing", "coding", "gaming", "cooking", "music", "art", "sports", "basketball",
    "football", "soccer", "tennis", "golf", "chess", "meditation", "hiking", "climbing"];
  const interests = interestKeywords.filter(k => allUserText.includes(k));

  // Extract days
  const dayKeywords = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "weekday", "weekend", "everyday", "daily"];
  const days = dayKeywords.filter(k => allUserText.includes(k.toLowerCase()));
  
  // Map weekday/weekend to actual days
  let availableDays = days.filter(d => !["weekday", "weekend", "everyday", "daily"].includes(d));
  if (days.includes("weekday") || days.includes("weekdays")) {
    availableDays = [...availableDays, "monday", "tuesday", "wednesday", "thursday", "friday"];
  }
  if (days.includes("weekend") || days.includes("weekends")) {
    availableDays = [...availableDays, "saturday", "sunday"];
  }
  if (days.includes("everyday") || days.includes("daily")) {
    availableDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  }

  // Extract time preference
  let timePreference = "flexible";
  if (allUserText.includes("morning")) timePreference = "morning";
  else if (allUserText.includes("afternoon")) timePreference = "afternoon";
  else if (allUserText.includes("evening") || allUserText.includes("night")) timePreference = "evening";

  // Extract lifestyle
  let lifestyle = "mixed";
  if (allUserText.includes("sedentary") || allUserText.includes("desk job") || allUserText.includes("sit all day")) {
    lifestyle = "sedentary";
  } else if (allUserText.includes("active") || allUserText.includes("always moving")) {
    lifestyle = "active";
  }

  // Extract experience
  let pastExperience = null;
  if (allUserText.includes("beginner") || allUserText.includes("never") || allUserText.includes("new to")) {
    pastExperience = "beginner";
  } else if (allUserText.includes("some experience") || allUserText.includes("used to")) {
    pastExperience = "intermediate";
  } else if (allUserText.includes("experienced") || allUserText.includes("years")) {
    pastExperience = "experienced";
  }

  // Try to find goals in later messages (usually answered towards end)
  let shortTermGoal = null;
  let longTermGoal = null;
  
  for (let i = Math.floor(userMessages.length / 2); i < userMessages.length; i++) {
    const msg = userMessages[i];
    if (msg.length > 10 && !shortTermGoal) {
      shortTermGoal = conversation[i * 2 + 1]?.content || msg;
    } else if (msg.length > 10 && shortTermGoal && !longTermGoal) {
      longTermGoal = conversation[i * 2 + 1]?.content || msg;
    }
  }

  return {
    name,
    motivation: null,
    interests: interests.length > 0 ? interests : null,
    lifestyle,
    pastExperience,
    personality: null,
    availability: {
      days: [...new Set(availableDays)],
      timePreference,
    },
    limitations: [],
    shortTermGoal,
    longTermGoal,
  };
}
