/**
 * AI Validation System
 * 
 * Validates all user inputs through LLM before accepting them.
 * Ensures nonsense answers are caught and users are prompted for valid responses.
 */

import { AIClient, type Message } from "./index";

// ============================================
// TYPES
// ============================================

/**
 * Context types for validation - tells the AI what kind of input to expect
 */
export type ValidationContext =
  | "name"              // User's name
  | "days_available"    // Days of the week
  | "time_available"    // Time slots
  | "experience_level"  // Beginner/Intermediate/Advanced
  | "goal_description"  // What they want to achieve
  | "number"            // Numeric input
  | "yes_no"            // Boolean response
  | "duration"          // Time duration (minutes, hours)
  | "personality"       // Personality traits
  | "interests"         // Hobbies and interests
  | "physical_info"     // Height, weight, limitations
  | "free_text";        // Open-ended (always valid but summarized)

/**
 * Result of validation
 */
export interface ValidationResult {
  isValid: boolean;
  parsedValue?: Record<string, unknown>;
  followUpQuestion?: string;
  confidence: number;
  reasoning?: string;
}

/**
 * Options for validation
 */
export interface ValidationOptions {
  input: string;
  context: ValidationContext;
  question: string;
  previousAttempts?: number;
  conversationHistory?: Message[];
  userProfile?: Record<string, unknown>;
}

// ============================================
// VALIDATION PROMPT
// ============================================

function buildValidationPrompt(options: ValidationOptions): string {
  const { context, question, previousAttempts = 0 } = options;
  
  const contextDescriptions: Record<ValidationContext, string> = {
    name: "A person's name. Should be a reasonable name (1-50 characters). Can be first name, full name, or nickname.",
    days_available: "Days of the week when the user is available. Valid values: monday, tuesday, wednesday, thursday, friday, saturday, sunday (or abbreviations like mon, tue, wed). Can also accept 'weekdays', 'weekends', 'everyday'.",
    time_available: "Time slots when user is available. Should include times like '9am-5pm', 'mornings', 'evenings', 'after work', specific hours.",
    experience_level: "Experience level in an activity. Valid: beginner, some experience, intermediate, advanced, expert, professional. Also accept descriptive answers like 'never done it', 'been doing it for years'.",
    goal_description: "A goal or objective the user wants to achieve. Should be something trainable/improvable. Extract the core goal.",
    number: "A numeric value. Parse numbers from text like 'five' = 5, 'a dozen' = 12.",
    yes_no: "A yes or no response. Accept variations: yeah, yep, nope, nah, sure, definitely, not really.",
    duration: "A time duration. Parse: '30 minutes', 'half hour', '1 hour', '90 mins', 'an hour and a half'.",
    personality: "Personality traits or motivation style. Extract key traits: determined, analytical, playful, competitive, patient, etc.",
    interests: "Hobbies, interests, or activities. Extract as a list of distinct interests.",
    physical_info: "Physical information: height, weight, injuries, limitations. Extract what's provided.",
    free_text: "Open-ended response. Always valid. Summarize the key points.",
  };

  const isStrictContext = ["name", "days_available", "number", "yes_no", "duration"].includes(context);
  
  return `You are validating user input for an AI coaching app.

CONTEXT TYPE: ${context}
EXPECTED: ${contextDescriptions[context]}
QUESTION ASKED: "${question}"
USER INPUT: Will be provided in the user message
${previousAttempts > 0 ? `NOTE: This is attempt #${previousAttempts + 1}. User has already given ${previousAttempts} invalid response(s). Be more helpful and specific in your follow-up.` : ""}

YOUR TASK:
1. Determine if the input is valid for this context
2. If valid, extract structured data
3. If invalid, provide a helpful follow-up question

RULES:
${isStrictContext ? "- This is a STRICT context. The input MUST match the expected format." : "- This is a FLEXIBLE context. Be lenient but ensure the response is relevant to the question."}
- Be friendly and encouraging in follow-up questions
- Never be condescending or rude
- If the input is close but unclear, ask for clarification
- For free_text, always mark as valid but extract key information

RESPOND WITH VALID JSON ONLY (no markdown, no explanation outside JSON):
{
  "isValid": boolean,
  "parsedValue": { /* extracted structured data, or null if invalid */ },
  "followUpQuestion": "string or null - friendly question to get valid input",
  "confidence": number between 0 and 1,
  "reasoning": "brief explanation of your decision"
}`;
}

// ============================================
// VALIDATION FUNCTION
// ============================================

/**
 * Validate user input through LLM
 */
export async function validateInput(
  client: AIClient,
  options: ValidationOptions
): Promise<ValidationResult> {
  const { input, context, previousAttempts = 0 } = options;

  // Quick local validation for obvious cases
  const quickResult = quickValidate(input, context);
  if (quickResult) {
    return quickResult;
  }

  try {
    const systemPrompt = buildValidationPrompt(options);
    
    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: input }
    ];

    const response = await client.chat(messages, {
      temperature: 0.3, // Low temperature for consistent validation
      maxTokens: 500,
    });

    // Parse the JSON response
    const parsed = parseJsonResponse(response);
    
    if (!parsed) {
      // If AI returned invalid JSON, fallback
      return createFallbackResult(context, previousAttempts);
    }

    return {
      isValid: Boolean(parsed.isValid),
      parsedValue: parsed.parsedValue || undefined,
      followUpQuestion: parsed.followUpQuestion || undefined,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      reasoning: parsed.reasoning || undefined,
    };
  } catch (error) {
    console.error("Validation error:", error);
    return createFallbackResult(context, previousAttempts);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Quick local validation for obvious cases (saves API calls)
 */
function quickValidate(input: string, context: ValidationContext): ValidationResult | null {
  const trimmed = input.trim();
  
  // Empty input is always invalid
  if (!trimmed) {
    return {
      isValid: false,
      followUpQuestion: "I didn't catch that. Could you please type your response?",
      confidence: 1.0,
      reasoning: "Empty input",
    };
  }

  // Very short input for complex questions
  if (trimmed.length < 2 && context !== "yes_no" && context !== "number") {
    return {
      isValid: false,
      followUpQuestion: "Could you tell me a bit more?",
      confidence: 0.9,
      reasoning: "Input too short",
    };
  }

  // Name validation - quick pass for reasonable names
  if (context === "name" && /^[a-zA-Z\s'-]{1,50}$/.test(trimmed)) {
    return {
      isValid: true,
      parsedValue: { name: trimmed },
      confidence: 0.95,
      reasoning: "Valid name format",
    };
  }

  // Number validation - quick pass
  if (context === "number") {
    const num = parseInt(trimmed, 10);
    if (!isNaN(num)) {
      return {
        isValid: true,
        parsedValue: { value: num },
        confidence: 1.0,
        reasoning: "Valid number",
      };
    }
  }

  // Yes/No quick validation
  if (context === "yes_no") {
    const lower = trimmed.toLowerCase();
    const yesWords = ["yes", "yeah", "yep", "yup", "sure", "ok", "okay", "definitely", "absolutely", "of course", "y"];
    const noWords = ["no", "nope", "nah", "not really", "never", "n"];
    
    if (yesWords.includes(lower)) {
      return {
        isValid: true,
        parsedValue: { value: true },
        confidence: 1.0,
        reasoning: "Affirmative response",
      };
    }
    if (noWords.includes(lower)) {
      return {
        isValid: true,
        parsedValue: { value: false },
        confidence: 1.0,
        reasoning: "Negative response",
      };
    }
  }

  // Days validation - quick check for common patterns
  if (context === "days_available") {
    const lower = trimmed.toLowerCase();
    const dayWords = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
                      "mon", "tue", "wed", "thu", "fri", "sat", "sun",
                      "weekdays", "weekends", "everyday", "daily"];
    
    const hasValidDay = dayWords.some(day => lower.includes(day));
    if (hasValidDay) {
      // Let the AI extract the specific days
      return null;
    }
    
    // Obvious invalid - no day-related words
    if (!hasValidDay && lower.length < 20) {
      return {
        isValid: false,
        followUpQuestion: "I need to know which days of the week work for you. For example: Monday, Wednesday, Friday, or just 'weekends'?",
        confidence: 0.9,
        reasoning: "No valid day references found",
      };
    }
  }

  // Free text is always valid
  if (context === "free_text") {
    return {
      isValid: true,
      parsedValue: { text: trimmed },
      confidence: 1.0,
      reasoning: "Free text accepted",
    };
  }

  // Interests - be very permissive, just needs some text
  if (context === "interests") {
    return {
      isValid: true,
      parsedValue: { 
        interests: trimmed.split(/[,;]/).map((s) => s.trim()).filter(Boolean),
        raw: trimmed 
      },
      confidence: 0.9,
      reasoning: "Interests accepted",
    };
  }

  // Personality - be very permissive
  if (context === "personality") {
    return {
      isValid: true,
      parsedValue: { personality: trimmed },
      confidence: 0.9,
      reasoning: "Personality accepted",
    };
  }

  // Physical info - be permissive (can be "none" or actual info)
  if (context === "physical_info") {
    return {
      isValid: true,
      parsedValue: { 
        limitations: trimmed.toLowerCase().includes("none") ? [] : [trimmed]
      },
      confidence: 0.9,
      reasoning: "Physical info accepted",
    };
  }

  // Experience level - try to match common patterns
  if (context === "experience_level") {
    const lower = trimmed.toLowerCase();
    const levels = ["beginner", "intermediate", "advanced", "expert", "never", "some", "years"];
    const hasLevel = levels.some(l => lower.includes(l));
    
    if (hasLevel || trimmed.length > 5) {
      return {
        isValid: true,
        parsedValue: { level: trimmed },
        confidence: 0.8,
        reasoning: "Experience level accepted",
      };
    }
  }

  // Goal description - any reasonable text
  if (context === "goal_description") {
    if (trimmed.length >= 3) {
      return {
        isValid: true,
        parsedValue: { goal: trimmed },
        confidence: 0.9,
        reasoning: "Goal description accepted",
      };
    }
  }

  // Duration - look for time-related words or numbers
  if (context === "duration") {
    const hasDuration = /\d|hour|minute|min|hr|half|quarter/i.test(trimmed);
    if (hasDuration) {
      return {
        isValid: true,
        parsedValue: { duration: trimmed },
        confidence: 0.8,
        reasoning: "Duration accepted",
      };
    }
  }

  // Time available - look for time patterns
  if (context === "time_available") {
    const hasTime = /\d|morning|afternoon|evening|night|am|pm|after|before|work/i.test(trimmed);
    if (hasTime || trimmed.length > 5) {
      return {
        isValid: true,
        parsedValue: { timePreference: trimmed },
        confidence: 0.8,
        reasoning: "Time preference accepted",
      };
    }
  }

  // Let the AI handle complex cases
  return null;
}

/**
 * Parse JSON from AI response, handling common issues
 */
function parseJsonResponse(response: string): Record<string, unknown> | null {
  try {
    // Try direct parse
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

/**
 * Create fallback result when validation fails
 * For most contexts, we default to ACCEPTING the input when AI is unavailable
 */
function createFallbackResult(context: ValidationContext, attempts: number): ValidationResult {
  // For strict contexts only (name, days, number, yes_no), ask again
  const strictContexts: ValidationContext[] = ["name", "days_available", "number", "yes_no"];
  
  if (!strictContexts.includes(context)) {
    // For non-strict contexts, just accept the input when AI fails
    return {
      isValid: true,
      parsedValue: { accepted_without_ai: true },
      confidence: 0.5,
      reasoning: "Accepted without AI validation (non-strict context)",
    };
  }

  const fallbackQuestions: Record<ValidationContext, string> = {
    name: "What's your name?",
    days_available: "Which days of the week work best for you? (e.g., Monday, Wednesday, Friday)",
    time_available: "What times work best?",
    experience_level: "What's your experience level?",
    goal_description: "What would you like to achieve?",
    number: "Could you give me a number?",
    yes_no: "Is that a yes or no?",
    duration: "How much time can you dedicate?",
    personality: "How would you describe yourself?",
    interests: "What do you enjoy?",
    physical_info: "Any physical limitations?",
    free_text: "Tell me more?",
  };

  return {
    isValid: false,
    followUpQuestion: attempts > 1 
      ? `Let me try again: ${fallbackQuestions[context]}`
      : fallbackQuestions[context],
    confidence: 0.5,
    reasoning: "Fallback due to processing error",
  };
}

// ============================================
// BATCH VALIDATION (for forms)
// ============================================

export interface BatchValidationItem {
  field: string;
  input: string;
  context: ValidationContext;
  question: string;
}

export interface BatchValidationResult {
  allValid: boolean;
  results: Record<string, ValidationResult>;
  invalidFields: string[];
}

/**
 * Validate multiple fields at once
 */
export async function validateBatch(
  client: AIClient,
  items: BatchValidationItem[]
): Promise<BatchValidationResult> {
  const results: Record<string, ValidationResult> = {};
  const invalidFields: string[] = [];

  // Process in parallel for speed
  const promises = items.map(async (item) => {
    const result = await validateInput(client, {
      input: item.input,
      context: item.context,
      question: item.question,
    });
    return { field: item.field, result };
  });

  const resolved = await Promise.all(promises);
  
  for (const { field, result } of resolved) {
    results[field] = result;
    if (!result.isValid) {
      invalidFields.push(field);
    }
  }

  return {
    allValid: invalidFields.length === 0,
    results,
    invalidFields,
  };
}
