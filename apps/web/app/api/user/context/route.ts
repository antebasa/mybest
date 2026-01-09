/**
 * User Context Endpoint
 * 
 * Fetches the complete user context for AI calls.
 * This aggregates all user data (profile, goals, sessions) into a unified context.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildUserContext,
  summarizeForPrompt,
  generateAISummary,
  type UserContext,
  type CondensedContext,
} from "@repo/ai";

export interface ContextResponse {
  context: UserContext | null;
  condensed: CondensedContext | null;
  summary: string | null;
  lastUpdated: string;
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<ContextResponse>> {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        {
          context: null,
          condensed: null,
          summary: null,
          lastUpdated: new Date().toISOString(),
          error: "Not authenticated",
        },
        { status: 401 }
      );
    }

    // Fetch all user data in parallel
    const [
      { data: userData },
      { data: profileData },
      { data: goalsData },
      { data: sessionsData },
      { data: statsData },
    ] = await Promise.all([
      // User basic info
      supabase
        .from("users")
        .select("id, email, full_name")
        .eq("id", user.id)
        .single(),
      
      // User profile
      supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single(),
      
      // User goals
      supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      
      // Recent session logs (last 7 days)
      supabase
        .from("session_logs")
        .select(`
          id,
          completed_at,
          metrics_result,
          user_feedback,
          ai_feedback,
          energy_level,
          sessions (title)
        `)
        .eq("user_id", user.id)
        .gte("completed_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("completed_at", { ascending: false })
        .limit(20),
      
      // Stats: total sessions, this week, streak
      supabase.rpc("get_user_stats", { p_user_id: user.id }),
    ]);

    // If user record doesn't exist yet, use auth data
    const userRecord = userData || {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name,
    };

    // Calculate stats (fallback if RPC doesn't exist)
    let stats = {
      totalSessions: 0,
      completedThisWeek: 0,
      currentStreak: 0,
    };

    if (statsData && typeof statsData === "object") {
      stats = {
        totalSessions: (statsData as Record<string, number>).total_sessions || 0,
        completedThisWeek: (statsData as Record<string, number>).completed_this_week || 0,
        currentStreak: (statsData as Record<string, number>).current_streak || 0,
      };
    } else {
      // Calculate manually if RPC not available
      const { count: totalCount } = await supabase
        .from("session_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: weekCount } = await supabase
        .from("session_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("completed_at", weekAgo);
      
      stats.totalSessions = totalCount || 0;
      stats.completedThisWeek = weekCount || 0;
      // Streak calculation would need more complex query - leave as 0 for now
    }

    // Parse session logs with their session titles
    const parsedSessions = (sessionsData || []).map((log: Record<string, unknown>) => ({
      id: log.id,
      title: (log.sessions as Record<string, string>)?.title || "Training Session",
      completed_at: log.completed_at,
      metrics_result: log.metrics_result,
      user_feedback: log.user_feedback,
      ai_feedback: log.ai_feedback,
      energy_level: log.energy_level,
    }));

    // Build the full context
    const context = buildUserContext(
      userRecord as { id: string; email?: string; full_name?: string },
      profileData,
      goalsData || [],
      parsedSessions,
      stats
    );

    // Generate condensed version for prompts
    const condensed = summarizeForPrompt(context);

    // Generate full summary
    const summary = generateAISummary(context);

    // Optionally update the stored summary if it's different
    if (profileData && summary !== profileData.ai_context_summary) {
      // Don't await - fire and forget
      supabase
        .from("user_profiles")
        .update({ 
          ai_context_summary: summary,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .then(() => {})
        .catch(() => {});
    }

    return NextResponse.json({
      context,
      condensed,
      summary,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Context endpoint error:", error);
    
    return NextResponse.json(
      {
        context: null,
        condensed: null,
        summary: null,
        lastUpdated: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST: Update specific context fields
 * Used during onboarding to save partial progress
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { updates, generateSummary = false } = body as {
      updates: Record<string, unknown>;
      generateSummary?: boolean;
    };

    if (!updates || typeof updates !== "object") {
      return NextResponse.json({ error: "Updates object required" }, { status: 400 });
    }

    // Ensure user profile exists
    const { data: existingProfile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!existingProfile) {
      // Create profile
      const { error: createError } = await supabase
        .from("user_profiles")
        .insert({
          user_id: user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        });

      if (createError) {
        throw createError;
      }
    } else {
      // Update profile
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) {
        throw updateError;
      }
    }

    // Optionally regenerate AI summary
    if (generateSummary) {
      // Fetch updated profile and generate new summary
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        const context = buildUserContext(
          { id: user.id, email: user.email, full_name: user.user_metadata?.full_name },
          profile,
          [],
          [],
          { totalSessions: 0, completedThisWeek: 0, currentStreak: 0 }
        );

        const summary = generateAISummary(context);

        await supabase
          .from("user_profiles")
          .update({ ai_context_summary: summary })
          .eq("user_id", user.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Context update error:", error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
