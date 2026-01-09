import { NextRequest, NextResponse } from "next/server";
import { createAIClient, chatWithFallback, type Message, getPlanGenerationPrompt } from "@repo/ai";
import { createClient } from "@/lib/supabase/server";

/**
 * Plan Generation API (Phase 2 Enhanced)
 * 
 * Generates personalized training plans based on:
 * - Goal details (type, title, experience level)
 * - User's AI conversation (from goal chat)
 * - User profile context
 * - Schedule preferences
 */
export async function POST(request: NextRequest) {
  try {
    const { 
      goalId, 
      goalTitle, 
      goalType, 
      experienceLevel, 
      shortTermGoal,
      longTermGoal,
      schedule, 
      userProfile,
      conversation,
      conversationSummary,
    } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    
    // Build comprehensive context for plan generation
    const conversationContext = conversation 
      ? `\n\nAI CONVERSATION INSIGHTS:\n${conversation
          .filter((m: any) => m.role !== "system")
          .map((m: any) => `${m.role === "user" ? "User" : "Coach"}: ${m.content}`)
          .join("\n")}`
      : "";

    const userContext = `
USER PROFILE:
- Name: ${userProfile?.name || 'User'}
- Experience Level: ${experienceLevel || 'beginner'}
- Available Days per Week: ${schedule?.daysPerWeek || 3}
- Time per Session: ${schedule?.minutesPerSession || 30} minutes
- Personality Type: ${userProfile?.personality?.description || userProfile?.personalityType || 'goal-driven'}
- Preferred Days: ${schedule?.preferredDays?.join(", ") || "flexible"}

GOAL DETAILS:
- Goal: ${goalTitle}
- Type: ${goalType}
- Short-term Goal (2-4 weeks): ${shortTermGoal || "Not specified"}
- Long-term Vision (2-3 months): ${longTermGoal || "Not specified"}
${conversationContext}

Please generate a training plan in JSON format with the following structure:
{
  "micro_cycle": {
    "title": "Plan title",
    "description": "What this achieves",
    "sessions": [
      {
        "day": 1,
        "title": "Session title",
        "duration_min": 30,
        "description": "Session focus",
        "tasks": [
          { "name": "Task name", "type": "rep_based|time_based|input_based", "target": { "reps": 50 } or { "minutes": 10 }, "tips": "Coaching tip" }
        ]
      }
    ],
    "expected_outcomes": ["What user will achieve"]
  },
  "macro_cycle": {
    "title": "3-month plan title",
    "phases": [
      { "name": "Phase name", "weeks": 4, "focus": "What to focus on", "objectives": [], "milestones": [] }
    ]
  },
  "ai_reasoning": "Why this plan was designed this way"
}`;

    let planData;

    if (apiKey) {
      try {
        const client = createAIClient(apiKey);
        
        const messages: Message[] = [
          { 
            role: "system", 
            content: `You are an expert training plan generator for a personal development app. Create detailed, personalized training plans based on user data. Always respond with valid JSON. Be specific with targets and make plans progressive.

For ${goalType} goals, include goal-specific exercises and metrics.
Schedule sessions only on available days and respect time constraints.
Include rest days and progressive difficulty.`
          },
          { role: "user", content: userContext },
        ];

        const response = await client.chat(messages, {
          temperature: 0.7,
          maxTokens: 3000,
        });

        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            planData = JSON.parse(jsonMatch[0]);
          } catch {
            console.log("JSON parse failed, using fallback plan");
            planData = generateFallbackPlan(goalTitle, goalType, schedule, shortTermGoal, longTermGoal);
          }
        } else {
          planData = generateFallbackPlan(goalTitle, goalType, schedule, shortTermGoal, longTermGoal);
        }
      } catch (aiError) {
        console.error("AI plan generation failed:", aiError);
        planData = generateFallbackPlan(goalTitle, goalType, schedule, shortTermGoal, longTermGoal);
      }
    } else {
      // Use fallback plan if no API key
      planData = generateFallbackPlan(goalTitle, goalType, schedule, shortTermGoal, longTermGoal);
    }

    // Save plan to database
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user && goalId) {
      // Save the plan to the plans table
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .insert({
          user_id: user.id,
          goal_id: goalId,
          title: planData.micro_cycle?.title || `${goalTitle} Training Plan`,
          description: planData.micro_cycle?.description || `AI-generated plan for ${goalTitle}`,
          plan_data: planData,
          duration_weeks: planData.micro_cycle?.sessions?.length ? Math.ceil(planData.micro_cycle.sessions.length / 7) * 2 : 2,
          status: 'active',
        })
        .select()
        .single();

      if (planError) {
        console.error('Error saving plan:', planError);
      } else if (plan && planData.micro_cycle?.sessions) {
        // Create sessions from the plan
        const today = new Date();
        const sessions = planData.micro_cycle.sessions.map((session: any, index: number) => {
          const sessionDate = new Date(today);
          sessionDate.setDate(today.getDate() + (session.day || index) - 1);
          
          return {
            user_id: user.id,
            plan_id: plan.id,
            title: session.title,
            scheduled_date: sessionDate.toISOString(),
            duration_min: session.duration_min || schedule?.minutesPerSession || 30,
            status: 'scheduled',
            tasks: session.tasks,
          };
        });

        const { error: sessionsError } = await supabase
          .from('sessions')
          .insert(sessions);

        if (sessionsError) {
          console.error('Error creating sessions:', sessionsError);
        }
      }

      // Update goal with AI reasoning
      if (planData.ai_reasoning) {
        await supabase
          .from('goals')
          .update({ 
            ai_reasoning: planData.ai_reasoning,
            updated_at: new Date().toISOString(),
          })
          .eq('id', goalId);
      }
    }

    return NextResponse.json({ 
      success: true,
      plan: planData,
    });
  } catch (error) {
    console.error("Plan Generation Error:", error);
    
    // Return fallback plan on error
    const { goalTitle, goalType, schedule, shortTermGoal, longTermGoal } = await request.json().catch(() => ({
      goalTitle: 'Training',
      goalType: 'skill',
      schedule: { daysPerWeek: 3, minutesPerSession: 30 },
      shortTermGoal: '',
      longTermGoal: '',
    }));
    
    return NextResponse.json({ 
      success: true,
      plan: generateFallbackPlan(goalTitle, goalType, schedule, shortTermGoal, longTermGoal),
      fallback: true,
    });
  }
}

// ============================================
// FALLBACK PLAN GENERATOR (Enhanced for Phase 2)
// ============================================

function generateFallbackPlan(
  goalTitle: string, 
  goalType: string, 
  schedule: { daysPerWeek?: number; minutesPerSession?: number } = {},
  shortTermGoal?: string,
  longTermGoal?: string
) {
  const daysPerWeek = schedule.daysPerWeek || 3;
  const duration = schedule.minutesPerSession || 30;
  
  const goalLower = goalTitle.toLowerCase();
  
  // Darts-specific plan
  if (goalType === "darts" || goalLower.includes('dart')) {
    return {
      micro_cycle: {
        title: "2-Week Darts Foundation",
        description: "Build proper throwing mechanics and consistency",
        sessions: [
          {
            day: 1,
            title: "Stance & Grip Foundation",
            duration_min: duration,
            description: "Establish your throwing foundation",
            tasks: [
              { name: "Warm-up throws (no aim)", type: "rep_based", target: { reps: 20 }, tips: "Focus on smooth release, not accuracy" },
              { name: "Grip practice - hold & release", type: "rep_based", target: { reps: 30 }, tips: "Find your natural grip position" },
              { name: "Stance alignment drills", type: "time_based", target: { minutes: 10 }, tips: "Shoulder, elbow, wrist aligned" },
              { name: "Target: Single 20", type: "rep_based", target: { reps: 50 }, tips: "Track how many hit the 20 section" },
            ]
          },
          {
            day: 3,
            title: "Throw Mechanics",
            duration_min: duration,
            description: "Refine your throwing motion",
            tasks: [
              { name: "Warm-up throws", type: "rep_based", target: { reps: 20 }, tips: "Loosen up your arm" },
              { name: "Elbow position drills", type: "rep_based", target: { reps: 30 }, tips: "Keep elbow at 90 degrees" },
              { name: "Follow-through practice", type: "rep_based", target: { reps: 30 }, tips: "Point to target after release" },
              { name: "Target: Triple 20", type: "rep_based", target: { reps: 30 }, tips: "Focus on grouping" },
            ]
          },
          {
            day: 5,
            title: "Consistency Training",
            duration_min: duration,
            description: "Build muscle memory",
            tasks: [
              { name: "Warm-up throws", type: "rep_based", target: { reps: 20 }, tips: "Same routine every time" },
              { name: "3-dart grouping practice", type: "rep_based", target: { sets: 20 }, tips: "Measure group size in cm" },
              { name: "Around the clock", type: "rep_based", target: { rounds: 2 }, tips: "Hit each number 1-20" },
              { name: "501 practice game", type: "rep_based", target: { games: 1 }, tips: "Track your average per dart" },
            ]
          },
          {
            day: 8,
            title: "Doubles Focus",
            duration_min: duration,
            description: "Master the checkout zone",
            tasks: [
              { name: "Warm-up throws", type: "rep_based", target: { reps: 20 } },
              { name: "Double 20 practice", type: "rep_based", target: { reps: 40 }, tips: "Most common checkout" },
              { name: "Double 16 practice", type: "rep_based", target: { reps: 40 }, tips: "Cover when you miss D20" },
              { name: "Checkout drills (40 out)", type: "rep_based", target: { reps: 20 }, tips: "D20 or D10 or D8" },
            ]
          },
          {
            day: 10,
            title: "Scoring Power",
            duration_min: duration,
            description: "Maximize your scoring potential",
            tasks: [
              { name: "Warm-up throws", type: "rep_based", target: { reps: 20 } },
              { name: "Triple 20 focus", type: "rep_based", target: { reps: 50 }, tips: "Aim small, miss small" },
              { name: "Triple 19 backup", type: "rep_based", target: { reps: 30 }, tips: "When T20 isn't working" },
              { name: "180 attempts", type: "rep_based", target: { attempts: 10 }, tips: "Celebrate any 140+" },
            ]
          },
          {
            day: 12,
            title: "Game Simulation",
            duration_min: duration,
            description: "Put it all together",
            tasks: [
              { name: "Warm-up routine", type: "rep_based", target: { reps: 20 } },
              { name: "501 games (vs target)", type: "rep_based", target: { games: 3 }, tips: "Try to beat 18 darts" },
              { name: "Record your average score", type: "input_based", target: { metric: "average" }, tips: "Track progress over time" },
            ]
          },
        ],
        expected_outcomes: [
          "Consistent stance and grip",
          "Improved grouping within 5cm",
          `${shortTermGoal || "Hit 60+ average"}`,
        ],
      },
      macro_cycle: {
        title: "3-Month Darts Mastery",
        phases: [
          { name: "Foundation", weeks: 4, focus: "Consistent stance, grip, and basic accuracy", objectives: ["Establish routine", "Find your style"], milestones: ["40+ average"] },
          { name: "Scoring", weeks: 4, focus: "Triple 20 proficiency and scoring power", objectives: ["T20 consistency", "Scoring combos"], milestones: ["50+ average", "First 100+ score"] },
          { name: "Finishing", weeks: 4, focus: "Doubles accuracy and checkout patterns", objectives: ["Checkout mastery", "Pressure handling"], milestones: [`${longTermGoal || "60+ average"}`] },
        ]
      },
      ai_reasoning: `This plan focuses on building fundamentals first, then progressing to scoring and finishing. Based on ${daysPerWeek} days/week and ${duration} minutes per session.`,
    };
  }
  
  // Running-specific plan
  if (goalType === "running" || goalLower.includes('run')) {
    return {
      micro_cycle: {
        title: "2-Week Running Kickstart",
        description: "Build cardiovascular base and running habit",
        sessions: [
          {
            day: 1,
            title: "Easy Run + Form",
            duration_min: duration,
            description: "Establish your base pace",
            tasks: [
              { name: "Dynamic warm-up", type: "time_based", target: { minutes: 5 }, tips: "Leg swings, high knees" },
              { name: "Easy pace run", type: "distance", target: { km: 2 }, tips: "Conversational pace" },
              { name: "Form drills", type: "time_based", target: { minutes: 5 }, tips: "High knees, butt kicks" },
              { name: "Cool-down walk", type: "time_based", target: { minutes: 5 } },
            ]
          },
          {
            day: 3,
            title: "Interval Introduction",
            duration_min: duration,
            description: "Start speed work",
            tasks: [
              { name: "Warm-up jog", type: "time_based", target: { minutes: 5 } },
              { name: "Run/walk intervals (1min/1min)", type: "rep_based", target: { reps: 8 }, tips: "Run comfortably hard" },
              { name: "Cool-down", type: "time_based", target: { minutes: 5 } },
            ]
          },
          {
            day: 5,
            title: "Long Easy Run",
            duration_min: duration + 10,
            description: "Build endurance",
            tasks: [
              { name: "Warm-up walk", type: "time_based", target: { minutes: 3 } },
              { name: "Easy pace run", type: "distance", target: { km: 3 }, tips: "Slow and steady" },
              { name: "Stretching", type: "time_based", target: { minutes: 7 } },
            ]
          },
          {
            day: 8,
            title: "Tempo Run",
            duration_min: duration,
            description: "Improve lactate threshold",
            tasks: [
              { name: "Warm-up", type: "time_based", target: { minutes: 5 } },
              { name: "Moderate pace run", type: "distance", target: { km: 2.5 }, tips: "Comfortably uncomfortable" },
              { name: "Cool-down jog", type: "time_based", target: { minutes: 5 } },
            ]
          },
          {
            day: 10,
            title: "Speed Work",
            duration_min: duration,
            description: "Build speed",
            tasks: [
              { name: "Warm-up", type: "time_based", target: { minutes: 5 } },
              { name: "Sprint intervals (30s fast/1min recovery)", type: "rep_based", target: { reps: 6 }, tips: "80% effort sprints" },
              { name: "Easy jog", type: "time_based", target: { minutes: 10 } },
            ]
          },
          {
            day: 12,
            title: "Progress Check Run",
            duration_min: duration,
            description: "Test your progress",
            tasks: [
              { name: "Warm-up", type: "time_based", target: { minutes: 5 } },
              { name: "Timed run (best effort)", type: "timed", target: { km: 3 }, tips: "Run your best but don't burn out" },
              { name: "Record your time", type: "input_based", target: { metric: "time" } },
            ]
          },
        ],
        expected_outcomes: [
          "Consistent running habit",
          "Improved endurance",
          `${shortTermGoal || "Run 3km without stopping"}`,
        ],
      },
      macro_cycle: {
        title: "3-Month Running Progress",
        phases: [
          { name: "Base Building", weeks: 4, focus: "Establish consistent running habit and aerobic base", objectives: ["Run 3x/week", "Build to 5km"], milestones: ["5km completed"] },
          { name: "Speed Development", weeks: 4, focus: "Introduce intervals and tempo runs", objectives: ["Faster pace", "Hill training"], milestones: ["10% pace improvement"] },
          { name: "Race Ready", weeks: 4, focus: "Peak performance and race simulation", objectives: ["Race strategy", "Mental prep"], milestones: [`${longTermGoal || "Complete 10km"}`] },
        ]
      },
      ai_reasoning: `Progressive running plan building from base fitness to speed work. Designed for ${daysPerWeek} days/week.`,
    };
  }

  // Bodyweight/Calisthenics plan
  if (goalType === "bodyweight" || goalLower.includes('bodyweight') || goalLower.includes('calisthenics')) {
    return {
      micro_cycle: {
        title: "2-Week Bodyweight Foundation",
        description: "Build strength with your own body",
        sessions: [
          {
            day: 1,
            title: "Push Day",
            duration_min: duration,
            description: "Upper body pushing movements",
            tasks: [
              { name: "Joint circles warm-up", type: "time_based", target: { minutes: 5 } },
              { name: "Push-ups (any variation)", type: "rep_based", target: { reps: 30 }, tips: "Full range of motion" },
              { name: "Pike push-ups", type: "rep_based", target: { reps: 15 }, tips: "Shoulders over wrists" },
              { name: "Plank hold", type: "time_based", target: { seconds: 60 }, tips: "Squeeze everything tight" },
            ]
          },
          {
            day: 3,
            title: "Pull & Core",
            duration_min: duration,
            description: "Back and core strength",
            tasks: [
              { name: "Warm-up", type: "time_based", target: { minutes: 5 } },
              { name: "Inverted rows / Pull-ups", type: "rep_based", target: { reps: 20 }, tips: "Squeeze shoulder blades" },
              { name: "Dead hangs", type: "time_based", target: { seconds: 30 }, tips: "Build grip strength" },
              { name: "Hollow body hold", type: "time_based", target: { seconds: 30 } },
            ]
          },
          {
            day: 5,
            title: "Legs & Movement",
            duration_min: duration,
            description: "Lower body and mobility",
            tasks: [
              { name: "Dynamic stretches", type: "time_based", target: { minutes: 5 } },
              { name: "Squats", type: "rep_based", target: { reps: 40 }, tips: "Below parallel" },
              { name: "Lunges (each leg)", type: "rep_based", target: { reps: 20 } },
              { name: "Calf raises", type: "rep_based", target: { reps: 30 } },
            ]
          },
          {
            day: 8,
            title: "Full Body Circuit",
            duration_min: duration,
            description: "Combine everything",
            tasks: [
              { name: "Warm-up", type: "time_based", target: { minutes: 5 } },
              { name: "Circuit: Push-up, Squat, Row, Lunge", type: "rep_based", target: { rounds: 3 }, tips: "10 reps each, minimal rest" },
              { name: "Finisher: Burpees", type: "rep_based", target: { reps: 10 } },
            ]
          },
        ],
        expected_outcomes: [
          "Improved push-up form and reps",
          "Better body control",
          `${shortTermGoal || "20 consecutive push-ups"}`,
        ],
      },
      macro_cycle: {
        title: "3-Month Calisthenics Journey",
        phases: [
          { name: "Foundation", weeks: 4, focus: "Master basic movements with good form", objectives: ["Push-up mastery", "Core stability"], milestones: ["20 push-ups"] },
          { name: "Progression", weeks: 4, focus: "Harder variations and skill work", objectives: ["Diamond push-ups", "Pull-up progress"], milestones: ["First pull-up"] },
          { name: "Skills", weeks: 4, focus: "Advanced movements", objectives: ["Muscle-up prep", "Handstand work"], milestones: [`${longTermGoal || "5 pull-ups"}`] },
        ]
      },
      ai_reasoning: `Bodyweight plan focusing on progressive overload through harder variations. ${daysPerWeek} days/week schedule.`,
    };
  }

  // Weight Training plan
  if (goalType === "weighttraining" || goalLower.includes('weight training') || goalLower.includes('gym')) {
    return {
      micro_cycle: {
        title: "2-Week Strength Foundation",
        description: "Build fundamental strength patterns",
        sessions: [
          {
            day: 1,
            title: "Push Day",
            duration_min: duration,
            description: "Chest, shoulders, triceps",
            tasks: [
              { name: "Warm-up: Light cardio + stretches", type: "time_based", target: { minutes: 5 } },
              { name: "Bench Press (or Push-ups)", type: "rep_based", target: { sets: 3, reps: 10 }, tips: "Control the weight down" },
              { name: "Overhead Press", type: "rep_based", target: { sets: 3, reps: 10 } },
              { name: "Tricep Dips or Pushdowns", type: "rep_based", target: { sets: 3, reps: 12 } },
            ]
          },
          {
            day: 3,
            title: "Pull Day",
            duration_min: duration,
            description: "Back, biceps",
            tasks: [
              { name: "Warm-up", type: "time_based", target: { minutes: 5 } },
              { name: "Lat Pulldowns / Pull-ups", type: "rep_based", target: { sets: 3, reps: 10 } },
              { name: "Rows", type: "rep_based", target: { sets: 3, reps: 10 }, tips: "Squeeze shoulder blades" },
              { name: "Bicep Curls", type: "rep_based", target: { sets: 3, reps: 12 } },
            ]
          },
          {
            day: 5,
            title: "Leg Day",
            duration_min: duration,
            description: "Quads, hamstrings, glutes",
            tasks: [
              { name: "Warm-up", type: "time_based", target: { minutes: 5 } },
              { name: "Squats", type: "rep_based", target: { sets: 3, reps: 10 }, tips: "Below parallel" },
              { name: "Romanian Deadlifts", type: "rep_based", target: { sets: 3, reps: 10 } },
              { name: "Leg Press / Lunges", type: "rep_based", target: { sets: 3, reps: 12 } },
            ]
          },
        ],
        expected_outcomes: [
          "Learn proper form",
          "Build strength foundation",
          `${shortTermGoal || "Consistent gym habit"}`,
        ],
      },
      macro_cycle: {
        title: "3-Month Strength Building",
        phases: [
          { name: "Foundation", weeks: 4, focus: "Learn movements, build habit", objectives: ["Form mastery", "Consistency"], milestones: ["3x/week adherence"] },
          { name: "Volume", weeks: 4, focus: "Increase training volume", objectives: ["More sets", "Progressive overload"], milestones: ["Strength gains"] },
          { name: "Intensity", weeks: 4, focus: "Heavier weights", objectives: ["Test maxes", "Peak strength"], milestones: [`${longTermGoal || "Significant strength increase"}`] },
        ]
      },
      ai_reasoning: `Push/Pull/Legs split for balanced development. Progressive overload built in.`,
    };
  }

  // Weight Loss plan
  if (goalType === "weightloss" || goalLower.includes('weight loss') || goalLower.includes('lose weight')) {
    return {
      micro_cycle: {
        title: "2-Week Healthy Habits Kickstart",
        description: "Build sustainable weight loss habits",
        sessions: [
          {
            day: 1,
            title: "Cardio + Movement",
            duration_min: duration,
            description: "Get moving and burn calories",
            tasks: [
              { name: "Brisk walk / Light jog", type: "time_based", target: { minutes: 20 }, tips: "Breathe through your nose" },
              { name: "Bodyweight circuit (squats, lunges, push-ups)", type: "rep_based", target: { rounds: 2 }, tips: "10 each exercise" },
              { name: "Stretching", type: "time_based", target: { minutes: 5 } },
            ]
          },
          {
            day: 2,
            title: "Active Recovery",
            duration_min: 20,
            description: "Stay active without intensity",
            tasks: [
              { name: "Easy walk", type: "time_based", target: { minutes: 15 }, tips: "Enjoy the movement" },
              { name: "Yoga / Stretching", type: "time_based", target: { minutes: 5 } },
            ]
          },
          {
            day: 4,
            title: "Strength + Cardio",
            duration_min: duration,
            description: "Build muscle to boost metabolism",
            tasks: [
              { name: "Warm-up", type: "time_based", target: { minutes: 5 } },
              { name: "Full body strength circuit", type: "rep_based", target: { rounds: 3 }, tips: "Push-ups, squats, rows" },
              { name: "HIIT finisher (30s on/30s off)", type: "rep_based", target: { rounds: 5 } },
            ]
          },
          {
            day: 6,
            title: "Longer Cardio",
            duration_min: duration + 15,
            description: "Extended fat-burning session",
            tasks: [
              { name: "Walk/Jog", type: "time_based", target: { minutes: 30 }, tips: "Zone 2 heart rate" },
              { name: "Light stretching", type: "time_based", target: { minutes: 10 } },
            ]
          },
        ],
        expected_outcomes: [
          "Consistent exercise habit",
          "Increased daily activity",
          `${shortTermGoal || "Feel more energetic"}`,
        ],
      },
      macro_cycle: {
        title: "3-Month Transformation",
        phases: [
          { name: "Habit Building", weeks: 4, focus: "Establish consistent routine", objectives: ["Daily movement", "Meal tracking"], milestones: ["Consistent 4x/week"] },
          { name: "Acceleration", weeks: 4, focus: "Increase intensity and results", objectives: ["More intense workouts", "Better food choices"], milestones: ["Measurable progress"] },
          { name: "Lifestyle", weeks: 4, focus: "Make it sustainable", objectives: ["Long-term habits", "Maintenance mindset"], milestones: [`${longTermGoal || "Target weight achieved"}`] },
        ]
      },
      ai_reasoning: `Combination of cardio and strength for optimal fat loss. Focus on sustainable habits over crash dieting.`,
    };
  }

  // Generic fitness/skill plan
  return {
    micro_cycle: {
      title: `2-Week ${goalTitle} Foundation`,
      description: `Build foundational skills and habits for ${goalTitle}`,
      sessions: Array.from({ length: Math.min(daysPerWeek * 2, 6) }, (_, i) => ({
        day: Math.ceil((i + 1) * (14 / (daysPerWeek * 2))),
        title: `Training Session ${i + 1}`,
        duration_min: duration,
        description: `Focus on ${goalTitle} fundamentals`,
        tasks: [
          { name: "Warm-up & preparation", type: "time_based", target: { minutes: 5 }, tips: "Get body ready" },
          { name: "Core skill practice", type: "time_based", target: { minutes: Math.floor(duration * 0.6) }, tips: "Focus on quality" },
          { name: "Review & cool-down", type: "time_based", target: { minutes: 5 }, tips: "Reflect on session" },
        ]
      }))
    },
    macro_cycle: {
      title: `3-Month ${goalTitle} Journey`,
      phases: [
        { name: "Foundation", weeks: 4, focus: "Learn fundamentals and build consistency", objectives: ["Basic skills", "Regular practice"], milestones: [shortTermGoal || "Solid basics"] },
        { name: "Development", weeks: 4, focus: "Refine technique and increase intensity", objectives: ["Skill refinement", "Challenge yourself"], milestones: ["Noticeable improvement"] },
        { name: "Mastery", weeks: 4, focus: "Advanced skills and measurable results", objectives: ["Advanced techniques", "Performance"], milestones: [longTermGoal || "Goal achieved"] },
      ]
    },
    ai_reasoning: `Customized plan for ${goalTitle} based on ${daysPerWeek} days/week availability and ${duration} minute sessions.`,
  };
}
