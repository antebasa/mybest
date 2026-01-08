import { NextRequest, NextResponse } from "next/server";
import { AIClient, SYSTEM_PROMPTS, type Message } from "@repo/ai";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { goalId, goalTitle, goalType, experienceLevel, schedule, userProfile } = await request.json();

    const apiKey = process.env.XIAOMI_MIMO_API_KEY;
    
    // Build the context for plan generation
    const userContext = `
User Profile:
- Name: ${userProfile?.name || 'User'}
- Experience Level: ${experienceLevel || 'beginner'}
- Available Days per Week: ${schedule?.daysPerWeek || 3}
- Time per Session: ${schedule?.minutesPerSession || 30} minutes
- Personality Type: ${userProfile?.personalityType || 'goal-driven'}

Goal Details:
- Goal: ${goalTitle}
- Type: ${goalType}
- Target: Become proficient and see measurable progress

Please generate a training plan in JSON format.`;

    let planData;

    if (apiKey) {
      const client = new AIClient(apiKey);
      
      const messages: Message[] = [
        { role: "system", content: SYSTEM_PROMPTS.planGeneration },
        { role: "user", content: userContext },
      ];

      const response = await client.chat(messages, {
        temperature: 0.7,
        maxTokens: 2048,
      });

      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          planData = JSON.parse(jsonMatch[0]);
        } catch {
          planData = generateFallbackPlan(goalTitle, goalType, schedule);
        }
      } else {
        planData = generateFallbackPlan(goalTitle, goalType, schedule);
      }
    } else {
      // Use fallback plan if no API key
      planData = generateFallbackPlan(goalTitle, goalType, schedule);
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
          description: `AI-generated plan for ${goalTitle}`,
          plan_data: planData,
          duration_weeks: planData.micro_cycle?.sessions?.length ? Math.ceil(planData.micro_cycle.sessions.length / 7) : 2,
          status: 'active',
        })
        .select()
        .single();

      if (planError) {
        console.error('Error saving plan:', planError);
      } else if (plan && planData.micro_cycle?.sessions) {
        // Create sessions from the plan
        const today = new Date();
        const sessions = planData.micro_cycle.sessions.map((session: any) => {
          const sessionDate = new Date(today);
          sessionDate.setDate(today.getDate() + session.day - 1);
          
          return {
            user_id: user.id,
            plan_id: plan.id,
            title: session.title,
            scheduled_date: sessionDate.toISOString(),
            duration_min: session.duration_min,
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
    }

    return NextResponse.json({ 
      success: true,
      plan: planData,
    });
  } catch (error) {
    console.error("Plan Generation Error:", error);
    
    // Return fallback plan on error
    const { goalTitle, goalType, schedule } = await request.json().catch(() => ({
      goalTitle: 'Training',
      goalType: 'skill',
      schedule: { daysPerWeek: 3, minutesPerSession: 30 }
    }));
    
    return NextResponse.json({ 
      success: true,
      plan: generateFallbackPlan(goalTitle, goalType, schedule),
      fallback: true,
    });
  }
}

// Generate a structured fallback plan based on goal type
function generateFallbackPlan(goalTitle: string, goalType: string, schedule: { daysPerWeek?: number; minutesPerSession?: number } = {}) {
  const daysPerWeek = schedule.daysPerWeek || 3;
  const duration = schedule.minutesPerSession || 30;
  
  const goalLower = goalTitle.toLowerCase();
  
  // Darts-specific plan
  if (goalLower.includes('dart')) {
    return {
      micro_cycle: {
        title: "2-Week Darts Foundation",
        description: "Build proper throwing mechanics and consistency",
        sessions: [
          {
            day: 1,
            title: "Stance & Grip Foundation",
            duration_min: duration,
            tasks: [
              { name: "Warm-up throws (no aim)", type: "rep_based", target: { reps: 20 } },
              { name: "Grip practice - hold & release", type: "rep_based", target: { reps: 30 } },
              { name: "Stance alignment drills", type: "time_based", target: { minutes: 10 } },
              { name: "Target: Single 20", type: "rep_based", target: { reps: 50 } },
            ]
          },
          {
            day: 3,
            title: "Throw Mechanics",
            duration_min: duration,
            tasks: [
              { name: "Warm-up throws", type: "rep_based", target: { reps: 20 } },
              { name: "Elbow position drills", type: "rep_based", target: { reps: 30 } },
              { name: "Follow-through practice", type: "rep_based", target: { reps: 30 } },
              { name: "Target: Triple 20", type: "rep_based", target: { reps: 30 } },
            ]
          },
          {
            day: 5,
            title: "Consistency Training",
            duration_min: duration,
            tasks: [
              { name: "Warm-up throws", type: "rep_based", target: { reps: 20 } },
              { name: "3-dart grouping practice", type: "rep_based", target: { sets: 20 } },
              { name: "Around the clock", type: "game", target: { rounds: 2 } },
              { name: "501 game", type: "game", target: { games: 1 } },
            ]
          },
          {
            day: 8,
            title: "Doubles Focus",
            duration_min: duration,
            tasks: [
              { name: "Warm-up throws", type: "rep_based", target: { reps: 20 } },
              { name: "Double 20 practice", type: "rep_based", target: { reps: 40 } },
              { name: "Double 16 practice", type: "rep_based", target: { reps: 40 } },
              { name: "Checkout drills (40 out)", type: "rep_based", target: { reps: 20 } },
            ]
          },
          {
            day: 10,
            title: "Scoring Power",
            duration_min: duration,
            tasks: [
              { name: "Warm-up throws", type: "rep_based", target: { reps: 20 } },
              { name: "Triple 20 focus", type: "rep_based", target: { reps: 50 } },
              { name: "Triple 19 backup", type: "rep_based", target: { reps: 30 } },
              { name: "180 attempts", type: "rep_based", target: { reps: 10 } },
            ]
          },
          {
            day: 12,
            title: "Game Simulation",
            duration_min: duration,
            tasks: [
              { name: "Warm-up throws", type: "rep_based", target: { reps: 20 } },
              { name: "501 games", type: "game", target: { games: 3 } },
              { name: "Record your average score", type: "data_entry", target: { metric: "average" } },
            ]
          },
        ]
      },
      macro_cycle: {
        title: "3-Month Darts Mastery",
        phases: [
          { name: "Foundation", weeks: 4, focus: "Consistent stance, grip, and basic accuracy" },
          { name: "Scoring", weeks: 4, focus: "Triple 20 proficiency and scoring power" },
          { name: "Finishing", weeks: 4, focus: "Doubles accuracy and checkout patterns" },
        ]
      }
    };
  }
  
  // Running-specific plan
  if (goalLower.includes('run')) {
    return {
      micro_cycle: {
        title: "2-Week Running Kickstart",
        description: "Build cardiovascular base and running habit",
        sessions: [
          {
            day: 1,
            title: "Easy Run + Form",
            duration_min: duration,
            tasks: [
              { name: "Dynamic warm-up", type: "time_based", target: { minutes: 5 } },
              { name: "Easy pace run", type: "distance", target: { km: 2 } },
              { name: "Form drills", type: "time_based", target: { minutes: 5 } },
              { name: "Cool-down walk", type: "time_based", target: { minutes: 5 } },
            ]
          },
          {
            day: 3,
            title: "Interval Introduction",
            duration_min: duration,
            tasks: [
              { name: "Warm-up jog", type: "time_based", target: { minutes: 5 } },
              { name: "Run/walk intervals (1min/1min)", type: "rep_based", target: { reps: 8 } },
              { name: "Cool-down", type: "time_based", target: { minutes: 5 } },
            ]
          },
          {
            day: 5,
            title: "Long Easy Run",
            duration_min: duration + 10,
            tasks: [
              { name: "Warm-up walk", type: "time_based", target: { minutes: 3 } },
              { name: "Easy pace run", type: "distance", target: { km: 3 } },
              { name: "Stretching", type: "time_based", target: { minutes: 7 } },
            ]
          },
          {
            day: 8,
            title: "Tempo Run",
            duration_min: duration,
            tasks: [
              { name: "Warm-up", type: "time_based", target: { minutes: 5 } },
              { name: "Moderate pace run", type: "distance", target: { km: 2.5 } },
              { name: "Cool-down jog", type: "time_based", target: { minutes: 5 } },
            ]
          },
          {
            day: 10,
            title: "Speed Work",
            duration_min: duration,
            tasks: [
              { name: "Warm-up", type: "time_based", target: { minutes: 5 } },
              { name: "Sprint intervals (30s fast/1min recovery)", type: "rep_based", target: { reps: 6 } },
              { name: "Easy jog", type: "time_based", target: { minutes: 10 } },
            ]
          },
          {
            day: 12,
            title: "Progress Check Run",
            duration_min: duration,
            tasks: [
              { name: "Warm-up", type: "time_based", target: { minutes: 5 } },
              { name: "Timed 5K (or best effort)", type: "timed", target: { km: 5 } },
              { name: "Record your time", type: "data_entry", target: { metric: "5k_time" } },
            ]
          },
        ]
      },
      macro_cycle: {
        title: "3-Month Running Progress",
        phases: [
          { name: "Base Building", weeks: 4, focus: "Establish consistent running habit and aerobic base" },
          { name: "Speed Development", weeks: 4, focus: "Introduce intervals and tempo runs" },
          { name: "Race Ready", weeks: 4, focus: "Peak performance and race simulation" },
        ]
      }
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
        tasks: [
          { name: "Warm-up & preparation", type: "time_based", target: { minutes: 5 } },
          { name: "Core skill practice", type: "time_based", target: { minutes: Math.floor(duration * 0.6) } },
          { name: "Review & cool-down", type: "time_based", target: { minutes: 5 } },
        ]
      }))
    },
    macro_cycle: {
      title: `3-Month ${goalTitle} Journey`,
      phases: [
        { name: "Foundation", weeks: 4, focus: "Learn fundamentals and build consistency" },
        { name: "Development", weeks: 4, focus: "Refine technique and increase intensity" },
        { name: "Mastery", weeks: 4, focus: "Advanced skills and measurable results" },
      ]
    }
  };
}
