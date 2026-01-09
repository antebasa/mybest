# My Best - Revised Master Plan (v2.0)

## Vision Statement
**My Best** is an AI-powered life coach app where the AI is not a feature—it IS the product. Every user interaction flows through AI. Every piece of data enriches the AI's understanding. The AI observes, validates, adapts, and guides.

**Core Principle: "Nothing Goes Unchecked"**
- User says "blue" when asked for available days? AI catches it and asks again.
- User fills out a form? AI follows up with clarifying questions.
- User completes a training? AI analyzes and adjusts future plans.

---

## The User Journey (High-Level Flow)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER JOURNEY                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. REGISTRATION          2. ONBOARDING           3. GOAL SETUP             │
│  ┌──────────────┐         ┌──────────────┐        ┌──────────────┐          │
│  │ Name/Email/  │   →     │ AI Interview │   →    │ Pick/Write   │          │
│  │ Password     │         │ (8-10 Q's)   │        │ Your Goal    │          │
│  │              │         │ LLM-validated│        │              │          │
│  └──────────────┘         └──────────────┘        └──────────────┘          │
│                                                          ↓                   │
│  6. CONTINUOUS LOOP       5. EXECUTE & LOG        4. AI DEEP DIVE           │
│  ┌──────────────┐         ┌──────────────┐        ┌──────────────┐          │
│  │ AI Adjusts   │   ←     │ Calendar     │   ←    │ Goal-specific │         │
│  │ Based on     │         │ Training     │        │ AI chat       │         │
│  │ Progress     │         │ Data Entry   │        │ (experience,  │         │
│  └──────────────┘         │ Media Upload │        │  videos, etc) │         │
│         ↑                 └──────────────┘        └──────────────┘          │
│         │                        ↓                       ↓                   │
│         └────────────────────────┴───────────────────────┘                   │
│                     (All data feeds AI context)                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: AI-First Foundation 🏗️
*Duration: ~1 week | Goal: Rock-solid AI infrastructure + validated onboarding*

### 1.1 AI Validation System (The Brain)
**Every user input must pass through AI validation before being saved.**

Create a universal AI validation layer:
```typescript
// packages/ai/validation.ts
interface ValidationResult {
  isValid: boolean;
  parsedValue?: any;           // Extracted structured data
  followUpQuestion?: string;   // If invalid, what to ask
  confidence: number;          // 0-1 confidence score
}

// Example: Validate "available days" answer
validateResponse("blue", {
  expectedType: "days_of_week",
  question: "What days are you free to train?"
}) 
// → { isValid: false, followUpQuestion: "I need to know which days work for you. Could you tell me which days of the week (like Monday, Wednesday, Friday) you're available?" }
```

**Validation Contexts:**
| Context | What AI Validates | Expected Output |
|---------|------------------|-----------------|
| `name` | Is this a reasonable name? | `{ name: string }` |
| `days_available` | Are these valid weekdays? | `{ days: ["mon", "wed", "fri"] }` |
| `experience_level` | Beginner/Intermediate/etc | `{ level: string, details?: string }` |
| `time_commitment` | Hours/minutes per session | `{ minutes: number, frequency: string }` |
| `goal_description` | Is this a trainable goal? | `{ category: string, specifics: object }` |
| `free_text` | General validity check | `{ summary: string, sentiment: string }` |

### 1.2 Enhanced Onboarding (AI Interview)
**Replace the current dumb onboarding with intelligent AI-driven interview.**

**8-10 Questions (all LLM-validated, all skippable):**

1. **Name** - "What should I call you?"
2. **Why Here** - "What brought you to My Best today? What change are you looking for?"
3. **Interests/Hobbies** - "What activities do you enjoy? Sports, creative pursuits, anything!"
4. **Current Lifestyle** - "How would you describe your typical day? Active, sedentary, somewhere in between?"
5. **Past Experience** - "Have you tried improving yourself before? What worked, what didn't?"
6. **Personality/Drive** - "When things get tough, are you the type to push through or do you need encouragement?"
7. **Available Time** - "What days and times work best for you to train/practice?"
8. **Physical Considerations** - "Any injuries or limitations I should know about?" (skippable)
9. **Short-term Motivation** - "What would success look like for you in 2 weeks?"
10. **Long-term Vision** - "Where do you see yourself in 3-6 months?"

**How It Works:**
```
User types: "im free on weekends mostly"
    ↓
AI validates: ✓ Valid (extracted: { days: ["sat", "sun"], flexibility: "mostly" })
    ↓
AI responds: "Weekends work great! Saturday and Sunday it is. Now let me ask..."
    ↓
Data saved to user_profiles.weekly_availability
```

```
User types: "blue"
    ↓
AI validates: ✗ Invalid for days_available context
    ↓
AI responds: "Hmm, I'm not sure I understood that! 😅 Which days of the week work best for you? For example: Monday, Wednesday, Friday, or weekends?"
    ↓
No data saved, question repeated
```

**Skip Logic:**
- Each question has a "Skip" button
- AI acknowledges skips gracefully: "No problem! We can figure that out later."
- Skipped fields marked as `null` in profile, AI will ask during goal setup if relevant

### 1.3 User Profile Context Builder
Build a comprehensive context system that accumulates ALL user data:

```typescript
// packages/ai/context.ts
interface UserContext {
  // From Registration
  userId: string;
  name: string;
  email: string;
  
  // From Onboarding
  profile: {
    motivation: string;
    interests: string[];
    lifestyle: string;
    personality: string;
    availability: { days: string[], timePreference: string };
    limitations: string[];
    shortTermGoal: string;
    longTermVision: string;
  };
  
  // From Goals (accumulated)
  goals: Array<{
    id: string;
    type: string;
    title: string;
    experienceLevel: string;
    specificDetails: object;  // Goal-type specific
  }>;
  
  // From Training (accumulated)
  recentActivity: Array<{
    date: string;
    sessionId: string;
    performance: object;
    userFeedback: string;
    aiFeedback: string;
  }>;
  
  // AI-generated summary (updated after each interaction)
  aiSummary: string;  // "Maria is a determined beginner darts player who trains on weekends..."
}
```

**Every API call includes this context** (appropriately summarized to fit token limits).

### 1.4 BYOK (Bring Your Own Key) Setup
Allow users to use their own API keys:

- Settings page with API key input
- Encrypt and store in user_profiles.preferences
- Support for: OpenAI, Anthropic, Xiaomi MiMo, OpenRouter
- Fallback chain: User Key → App Key → Graceful Degradation

---

## Phase 2: Intelligent Goal System 🎯
*Duration: ~1 week | Goal: Smart goal creation with AI deep-dive*

### 2.1 Goal Selection (Form + AI Refinement)

**Step 1: Initial Selection (Form)**
User picks from categories OR writes custom:
- 🎯 Darts
- 🏃 Running  
- 💪 Bodyweight / Calisthenics
- ⚖️ Weight Loss
- 🏋️ Weight Training
- ⚽ Football / Soccer
- 🎾 Tennis / Racquet Sports
- 🎨 Custom (free text, AI categorizes)

**Step 2: Basic Details (Quick Form)**
- Experience level (beginner → advanced)
- Days per week available
- Minutes per session
- Short goal (2-4 weeks)
- Long goal (2-3 months)

**Step 3: AI Deep-Dive Chat (THE KEY FEATURE)**
After form submission, user enters AI chat that:

1. **Acknowledges the goal**: "Awesome, so you want to get better at darts! Let me ask a few more things to create the perfect plan..."

2. **Asks goal-specific questions** (AI decides based on goal type):
   - **Darts**: "Have you ever played before? Do you have your own darts and board? What's your typical score range?"
   - **Running**: "What's the longest you've run recently? Any races you're training for? Preferred terrain?"
   - **Weight Loss**: "What's your current weight? Target weight? Any dietary restrictions?"
   - **Custom**: AI generates appropriate questions dynamically

3. **May request media**:
   - "Could you send me a video of your dart throw from the side? I want to see your stance and release."
   - "Show me a photo of your current setup/equipment."
   - "Record yourself doing a push-up so I can check your form."

4. **Summarizes understanding**:
   - "Let me make sure I've got this right: You're a complete beginner to darts, you have a board at home, you want to hit triple 20 consistently within 2 weeks, and ultimately reach a 60 average in 3 months. Sound right?"

5. **User confirms or corrects**

6. **AI generates plans** (see 2.2)

### 2.2 Intelligent Plan Generation

AI generates TWO plans:

**Micro-Cycle (2-4 weeks):**
- Immediate actionable plan
- Specific sessions scheduled on user's available days
- Each session has detailed tasks
- Builds foundation skills

**Macro-Cycle (2-3 months):**
- Long-term roadmap
- Phase breakdown (Foundation → Development → Refinement)
- Milestone checkpoints
- Adaptive based on micro-cycle performance

**Plan Structure:**
```typescript
interface GeneratedPlan {
  microCycle: {
    title: string;           // "2-Week Darts Fundamentals"
    duration: number;        // days
    sessions: Array<{
      dayOffset: number;     // 0 = start date
      scheduledDate: Date;   // Actual calendar date
      title: string;
      duration: number;      // minutes
      focus: string;
      tasks: Array<{
        name: string;
        type: "reps" | "time" | "input" | "media_required";
        target: object;
        instructions: string;
        mediaPrompt?: string; // "Record your throw from behind"
      }>;
    }>;
    expectedOutcome: string;
  };
  
  macroCycle: {
    title: string;           // "3-Month Darts Mastery Journey"
    phases: Array<{
      name: string;
      weeks: number;
      focus: string;
      milestones: string[];
    }>;
    ultimateGoal: string;
  };
  
  aiReasoning: string;       // "Based on your complete beginner status and weekend availability..."
}
```

### 2.3 Calendar Integration

Sessions automatically populate the calendar:
- Show all scheduled sessions
- Color-coded by goal
- Click to start training
- Reschedule via drag-drop (AI notified of changes)
- Missed sessions trigger AI nudge

---

## Phase 3: Execution & Feedback Loop 🔄
*Duration: ~1 week | Goal: Training execution, data collection, AI adaptation*

### 3.1 Training Execution Flow

**When user opens a session:**

1. **Pre-Session AI Brief**
   - "Today's focus: Stance fundamentals. Remember, feet shoulder-width apart!"
   - Shows tasks to complete
   - Any media requests highlighted

2. **Task Completion**
   - User checks off tasks
   - Enters required data (reps, times, scores)
   - Uploads requested media (photos/videos)

3. **Media Analysis** (if applicable)
   - Video uploaded → AI analyzes form
   - Returns specific feedback: "Your elbow is dropping before release. Try keeping it at 90° angle."
   - Feedback saved to session log

4. **Post-Session AI Summary**
   - "Great session! You hit 23/50 bullseyes (46%). That's good for day 1!"
   - "I noticed your grouping is to the left—we'll work on that next time."
   - "How are you feeling? Any pain or concerns?"

5. **User Feedback**
   - Rate energy/mood (1-10)
   - Free text notes
   - AI processes and stores

### 3.2 Data Visualization

**Goal-Specific Graphs** (AI determines what's useful):

For Darts:
- Accuracy over time (% hitting target)
- Grouping consistency
- Score progression

For Running:
- Distance per session
- Pace improvement
- Heart rate trends (if integrated)

For Weight Loss:
- Weight chart
- Measurement trends
- Calorie/activity correlation

**The Dashboard Shows:**
- Current streak
- Next session countdown
- Recent AI feedback highlights
- Progress toward short-term goal (%)
- Weekly activity summary

### 3.3 AI Adaptation Engine

**After each session, AI evaluates:**

```typescript
interface AdaptationDecision {
  shouldAdjust: boolean;
  adjustmentType: "increase_difficulty" | "decrease_difficulty" | "modify_focus" | "add_rest" | "request_media";
  reasoning: string;
  changes: Array<{
    sessionId: string;
    modification: object;
  }>;
  userMessage?: string;  // "I'm bumping up your reps next session—you crushed it today!"
}
```

**Triggers for adaptation:**
- Performance significantly above/below target
- User reports pain or fatigue
- Missed sessions
- Media analysis reveals form issues
- User requests change

**Example Flow:**
```
User completes darts session: 45/50 bullseyes (target was 25)
    ↓
AI analyzes: Way above target, likely too easy
    ↓
AI adjusts next session: Increase target to 35, add new challenge task
    ↓
AI messages: "Wow, 45 bullseyes?! You're a natural! I'm making tomorrow a bit harder 😏"
```

### 3.4 Media Pipeline (Ephemeral)

1. User records video/photo in app
2. Compressed client-side (720p max)
3. Uploaded to temp storage
4. AI analyzes (multimodal or vision API)
5. Analysis result saved as JSON
6. Original media DELETED (privacy + cost)
7. User sees text feedback only

---

## Technical Implementation Details

### Database Updates Needed

```sql
-- Add to user_profiles
ALTER TABLE user_profiles ADD COLUMN api_keys jsonb DEFAULT '{}';
ALTER TABLE user_profiles ADD COLUMN ai_context_summary text;

-- Add to goals  
ALTER TABLE goals ADD COLUMN ai_conversation jsonb DEFAULT '[]';
ALTER TABLE goals ADD COLUMN media_requests jsonb DEFAULT '[]';

-- Add validation tracking
CREATE TABLE validation_logs (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  context text NOT NULL,
  user_input text NOT NULL,
  ai_response jsonb NOT NULL,
  is_valid boolean NOT NULL,
  created_at timestamp DEFAULT now()
);
```

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/ai/validate` | Validate any user input |
| `POST /api/ai/chat` | General AI chat (with full context) |
| `POST /api/ai/generate-plan` | Create training plans |
| `POST /api/ai/analyze-media` | Process uploaded video/photo |
| `POST /api/ai/adapt-plan` | Adjust plan based on performance |
| `GET /api/user/context` | Get full user context for AI |

### System Prompts Library

```typescript
const PROMPTS = {
  // Validation
  validateInput: (context, input) => `...`,
  
  // Onboarding
  onboardingInterview: `...`,
  
  // Goal-specific deep dives
  dartsExpert: `You are a professional darts coach...`,
  runningCoach: `You are an experienced running coach...`,
  fitnessTrainer: `You are a certified personal trainer...`,
  
  // Plan generation
  planGenerator: `Create a structured training plan...`,
  
  // Session feedback
  sessionAnalysis: `Analyze this training session...`,
  
  // Adaptation
  adaptationEngine: `Based on recent performance, decide if adjustments needed...`,
};
```

---

## Development Checklist

### Phase 1 Tasks
- [ ] Create `packages/ai/validation.ts` with validation system
- [ ] Create `packages/ai/context.ts` for context management
- [ ] Update `packages/ai/index.ts` with new prompts
- [ ] Rebuild onboarding page with LLM validation
- [ ] Add skip functionality to onboarding
- [ ] Save all onboarding data to user_profiles
- [ ] Add BYOK settings page
- [ ] Create `/api/ai/validate` endpoint
- [ ] Create `/api/user/context` endpoint

### Phase 2 Tasks
- [ ] Add AI chat step after goal form
- [ ] Create goal-specific question generators
- [ ] Build media upload component (basic)
- [ ] Update `/api/ai/generate-plan` with new structure
- [ ] Connect calendar to scheduled sessions
- [ ] Add plan preview before confirmation

### Phase 3 Tasks
- [ ] Build session execution UI
- [ ] Create task completion flow
- [ ] Implement media analysis pipeline
- [ ] Build post-session AI feedback
- [ ] Create adaptation engine
- [ ] Add goal-specific charts
- [ ] Build streak/progress tracking

---

## Success Metrics

1. **Validation Rate**: >95% of nonsense inputs caught
2. **Onboarding Completion**: >80% of users finish onboarding
3. **Plan Adherence**: >60% of scheduled sessions completed
4. **AI Accuracy**: User ratings of AI feedback >4/5
5. **Retention**: Users return 3+ times per week

---

*Last Updated: January 9, 2026*
*Version: 2.0 - AI-First Architecture*
