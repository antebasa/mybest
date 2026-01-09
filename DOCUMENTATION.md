# My Best - Technical Documentation

> This document tracks all implementation details, design decisions, and code explanations for the My Best app.

---

## Table of Contents
1. [Phase 1: AI-First Foundation](#phase-1-ai-first-foundation)
   - [1.1 AI Validation System](#11-ai-validation-system)
   - [1.2 AI Context System](#12-ai-context-system)
   - [1.3 AI Prompts Library](#13-ai-prompts-library)
   - [1.4 API Endpoints](#14-api-endpoints)
   - [1.5 Onboarding System](#15-onboarding-system)
   - [1.6 BYOK (Bring Your Own Key)](#16-byok-bring-your-own-key)
   - [1.7 Database Schema Updates](#17-database-schema-updates)

---

## Phase 1: AI-First Foundation

### 1.1 AI Validation System

**File:** `packages/ai/validation.ts`

**Purpose:** Validate all user inputs through LLM before accepting them. This ensures nonsense answers like "blue" when asked for available days are caught and the user is prompted for a valid response.

**Key Concepts:**

1. **ValidationContext** - Defines what type of input we're expecting:
   - `name` - User's name
   - `days_available` - Days of the week for training
   - `time_available` - Time slots for training
   - `experience_level` - Beginner/Intermediate/Advanced
   - `goal_description` - What they want to achieve
   - `number` - Numeric input
   - `yes_no` - Boolean response
   - `free_text` - Open-ended (always valid but summarized)

2. **ValidationResult** - What the validator returns:
   ```typescript
   {
     isValid: boolean;           // Did the input make sense?
     parsedValue?: any;          // Structured extraction (e.g., { days: ["mon", "wed"] })
     followUpQuestion?: string;  // If invalid, what to ask instead
     confidence: number;         // 0-1 how sure AI is
     reasoning?: string;         // Why this decision was made
   }
   ```

3. **How It Works:**
   - User input + context sent to LLM
   - LLM returns structured JSON
   - If valid: extract data, proceed
   - If invalid: show follow-up question, don't save

**Example Flow:**
```
Input: "blue"
Context: "days_available"
Question: "What days are you free?"
    ↓
LLM Response: {
  "isValid": false,
  "followUpQuestion": "I need to know which days work for you. Could you tell me the days of the week (like Monday, Wednesday, Friday)?",
  "confidence": 0.95,
  "reasoning": "User said 'blue' which is a color, not days of the week"
}
    ↓
UI shows follow-up question, doesn't proceed
```

---

### 1.2 AI Context System

**File:** `packages/ai/context.ts`

**Purpose:** Build a comprehensive context object containing ALL user data that gets sent with every AI request. This gives the AI full awareness of who the user is.

**Key Concepts:**

1. **UserContext** - Complete user state:
   ```typescript
   {
     // Identity
     userId: string;
     name: string;
     
     // From Onboarding
     profile: {
       motivation: string;
       interests: string[];
       lifestyle: string;
       personality: string;
       availability: object;
       limitations: string[];
       goals: { shortTerm: string; longTerm: string };
     };
     
     // Active Goals
     goals: Goal[];
     
     // Recent Activity (last 7 days)
     recentSessions: SessionLog[];
     
     // AI-generated summary
     summary: string;
   }
   ```

2. **Context Summarization** - For token efficiency:
   - Full context can be 10,000+ tokens
   - `summarizeForPrompt()` creates condensed version (~500 tokens)
   - Prioritizes recent/relevant information

3. **Context Refresh Strategy:**
   - Rebuilt on each major action (login, goal creation, session completion)
   - Cached for 5 minutes
   - Summary regenerated weekly or on major changes

---

### 1.3 AI Prompts Library

**File:** `packages/ai/prompts.ts`

**Purpose:** Centralized collection of all system prompts used throughout the app.

**Prompt Categories:**

1. **Validation Prompts** - For input validation
2. **Onboarding Prompts** - For the interview flow
3. **Goal Prompts** - For goal-specific conversations
4. **Plan Generation Prompts** - For creating training plans
5. **Analysis Prompts** - For session/media analysis
6. **Adaptation Prompts** - For adjusting plans

**Design Principles:**
- Each prompt is a function that takes context and returns the full prompt
- Prompts are versioned (can A/B test)
- Include examples where helpful
- Specify exact JSON output format

---

### 1.4 API Endpoints

#### POST /api/ai/validate

**Purpose:** Validate any user input before accepting it.

**Request:**
```typescript
{
  input: string;           // What the user typed
  context: string;         // Validation context (e.g., "days_available")
  question: string;        // The question that was asked
  conversationHistory?: Message[];  // Previous messages for context
}
```

**Response:**
```typescript
{
  isValid: boolean;
  parsedValue?: any;
  followUpQuestion?: string;
  confidence: number;
}
```

#### GET /api/user/context

**Purpose:** Fetch the complete user context for AI calls.

**Response:**
```typescript
{
  context: UserContext;
  summary: string;         // Token-efficient summary
  lastUpdated: string;
}
```

#### POST /api/ai/chat (Updated)

**Purpose:** General AI chat with full context awareness.

**Changes from v1:**
- Now fetches user context automatically
- Validates responses when appropriate
- Includes conversation history
- Saves messages to database

---

### 1.5 Onboarding System

**File:** `apps/web/app/onboarding/page.tsx`

**Complete Rebuild** - The new onboarding is a true AI interview.

**Questions (in order):**

| # | Question | Context | Skippable | Extraction |
|---|----------|---------|-----------|------------|
| 1 | What should I call you? | `name` | No | `{ name: string }` |
| 2 | What brought you to My Best? | `free_text` | Yes | `{ motivation: string }` |
| 3 | What activities do you enjoy? | `free_text` | Yes | `{ interests: string[] }` |
| 4 | How would you describe your typical day? | `free_text` | Yes | `{ lifestyle: string }` |
| 5 | Have you tried self-improvement before? | `free_text` | Yes | `{ pastExperience: string }` |
| 6 | How do you handle challenges? | `free_text` | Yes | `{ personality: string }` |
| 7 | What days/times work for training? | `days_available` | No | `{ days: [], times: {} }` |
| 8 | Any physical limitations? | `free_text` | Yes | `{ limitations: string[] }` |
| 9 | What's success in 2 weeks? | `free_text` | Yes | `{ shortTermGoal: string }` |
| 10 | Where do you see yourself in 3 months? | `free_text` | Yes | `{ longTermGoal: string }` |

**Flow:**
1. AI asks question
2. User types response (or clicks Skip)
3. Response sent to `/api/ai/validate`
4. If valid → extract data, save to profile, next question
5. If invalid → show follow-up, repeat
6. After all questions → AI generates summary → save to `ai_context_summary`
7. Redirect to dashboard or goal creation

**UI Features:**
- Progress bar (X of 10)
- Skip button (styled subtly)
- Typing indicator while AI processes
- Smooth animations between questions

---

### 1.6 BYOK (Bring Your Own Key)

**File:** `apps/web/app/settings/page.tsx`

**Purpose:** Allow users to use their own AI API keys.

**Supported Providers:**
- OpenAI (GPT-4, GPT-4o)
- Anthropic (Claude)
- Xiaomi MiMo
- OpenRouter (access to many models)

**Security:**
- Keys encrypted before storage
- Never logged or exposed in client
- Validated on save (test API call)
- Stored in `user_profiles.api_keys` as encrypted JSON

**Fallback Chain:**
```
User's Key → App's Key → Error (graceful message)
```

---

### 1.7 Database Schema Updates

**New Columns:**

```sql
-- user_profiles table
ALTER TABLE user_profiles ADD COLUMN api_keys jsonb DEFAULT '{}';
-- Stores: { openai: "encrypted...", anthropic: "encrypted..." }

ALTER TABLE user_profiles ADD COLUMN ai_context_summary text;
-- AI-generated summary of user for efficient prompts
```

**New Table:**

```sql
CREATE TABLE validation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  context text NOT NULL,           -- "days_available", "name", etc.
  question text NOT NULL,          -- The question asked
  user_input text NOT NULL,        -- What user typed
  ai_response jsonb NOT NULL,      -- Full validation result
  is_valid boolean NOT NULL,
  created_at timestamp DEFAULT now()
);
```

**Purpose of validation_logs:**
- Debugging failed validations
- Improving prompts over time
- Analytics on user behavior

---

## Code Conventions

### Naming
- Files: `kebab-case.ts`
- Types/Interfaces: `PascalCase`
- Functions: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`

### Error Handling
- Always try/catch AI calls
- Provide fallback responses
- Log errors with context
- Never expose internal errors to users

### AI Responses
- Always parse as JSON
- Validate structure before using
- Handle malformed responses gracefully

---

---

## Quick Reference: How to Use the AI System

### Validating User Input

```typescript
// In any API route or server component
import { AIClient, validateInput } from "@repo/ai";

const client = new AIClient(process.env.XIAOMI_MIMO_API_KEY);

const result = await validateInput(client, {
  input: "blue",                    // What user typed
  context: "days_available",        // What we're expecting
  question: "What days work for you?",
  previousAttempts: 0,
});

if (!result.isValid) {
  // Show result.followUpQuestion to user
}
```

### Building User Context

```typescript
import { buildUserContext, summarizeForPrompt } from "@repo/ai";

// Fetch user data from Supabase
const context = buildUserContext(user, profile, goals, sessions, stats);

// Get token-efficient version for prompts
const condensed = summarizeForPrompt(context);
// condensed.summary is ready to include in system prompt
```

### Using the Chat API

```typescript
// POST /api/chat
const response = await fetch("/api/chat", {
  method: "POST",
  body: JSON.stringify({
    messages: [...],
    context: "onboarding",  // or "goal", "coach", "general"
    currentQuestion: 3,     // for onboarding
    collectedData: {...},   // data collected so far
  }),
});
```

### BYOK Usage

User keys are stored in `user_profiles.api_keys` as JSON:
```json
{
  "openai": "sk-...",
  "anthropic": "sk-ant-...",
  "mimo": "...",
  "openrouter": "sk-or-..."
}
```

The AI client automatically uses user keys when available:
```typescript
import { createAIClient } from "@repo/ai";

// Will use user's key if available, otherwise app key
const client = createAIClient(
  process.env.XIAOMI_MIMO_API_KEY,
  userApiKeys,  // from user_profiles.api_keys
  "openai"      // preferred provider
);
```

---

## Implementation Status

### ✅ Completed Components

| Component | File(s) | Description |
|-----------|---------|-------------|
| AI Validation System | `packages/ai/validation.ts` | Validates user inputs through LLM |
| AI Context System | `packages/ai/context.ts` | Builds comprehensive user context |
| AI Prompts Library | `packages/ai/prompts.ts` | All system prompts for the app |
| AI Package Exports | `packages/ai/index.ts` | Unified exports with multi-provider support |
| Validation API | `apps/web/app/api/ai/validate/route.ts` | REST endpoint for validation |
| Context API | `apps/web/app/api/user/context/route.ts` | REST endpoint for user context |
| Chat API | `apps/web/app/api/chat/route.ts` | Updated with context awareness |
| Onboarding Page | `apps/web/app/onboarding/page.tsx` | Full rebuild with AI validation |
| Settings Page | `apps/web/app/settings/page.tsx` | BYOK API key management |
| Database Schema | `packages/db/schema.ts` | Updated with new tables/columns |

### New Database Columns (user_profiles)

| Column | Type | Purpose |
|--------|------|---------|
| `name` | text | User's name from onboarding |
| `motivation` | text | Why they're using the app |
| `interests` | jsonb | Array of hobbies/interests |
| `lifestyle` | text | Active/sedentary description |
| `past_experience` | text | Previous self-improvement attempts |
| `short_term_goal` | text | 2-week success vision |
| `long_term_goal` | text | 3-6 month vision |
| `limitations` | jsonb | Physical limitations array |
| `ai_context_summary` | text | AI-generated user summary |
| `api_keys` | jsonb | Encrypted BYOK keys |

### New Database Table: validation_logs

Tracks all AI validation attempts for debugging and improvement.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | Primary key |
| `user_id` | uuid | User reference |
| `context` | text | Validation context type |
| `question` | text | The question asked |
| `user_input` | text | What user typed |
| `ai_response` | jsonb | Full validation result |
| `is_valid` | boolean | Whether input was valid |
| `created_at` | timestamp | When validation occurred |

---

## How to Run Migrations

After making schema changes, run:

```bash
cd packages/db
npx drizzle-kit push
```

Or generate SQL migration:

```bash
npx drizzle-kit generate
```

---

## Testing the Implementation

### Test Onboarding Validation

1. Go to `/onboarding`
2. Try answering "blue" when asked for available days
3. AI should reject and ask for valid days
4. Provide valid days like "Monday and Wednesday"
5. AI should accept and continue

### Test BYOK

1. Go to `/settings`
2. Add an OpenAI API key
3. Click "Test" to verify
4. Go back to onboarding - should use your key

---

*Document started: January 9, 2026*
*Last updated: January 9, 2026*
*Phase 1: COMPLETE*
