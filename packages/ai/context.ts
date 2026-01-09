/**
 * AI Context System
 * 
 * Builds and manages comprehensive user context that gets sent with every AI request.
 * This gives the AI full awareness of who the user is, their goals, and their progress.
 */

// ============================================
// TYPES
// ============================================

/**
 * User's onboarding profile data
 */
export interface UserProfile {
  name: string;
  motivation?: string;
  interests?: string[];
  lifestyle?: string;
  pastExperience?: string;
  personality?: string;
  availability?: {
    days: string[];
    timePreference?: string;
    minutesPerSession?: number;
  };
  limitations?: string[];
  goals?: {
    shortTerm?: string;
    longTerm?: string;
  };
  physicalStats?: {
    height?: number;
    weight?: number;
    age?: number;
  };
}

/**
 * A user's goal
 */
export interface UserGoal {
  id: string;
  title: string;
  type: string;
  description?: string;
  currentLevel?: string;
  targetLevel?: string;
  status: "active" | "completed" | "paused";
  progress: number;
  createdAt: string;
  aiConversation?: Array<{ role: string; content: string }>;
}

/**
 * A training session log
 */
export interface SessionLog {
  id: string;
  sessionTitle: string;
  completedAt: string;
  metricsResult?: Record<string, unknown>;
  userFeedback?: string;
  aiFeedback?: string;
  energyLevel?: number;
}

/**
 * Complete user context
 */
export interface UserContext {
  // Core identity
  userId: string;
  email?: string;
  
  // Profile from onboarding
  profile: UserProfile;
  
  // Active and recent goals
  goals: UserGoal[];
  
  // Recent training activity (last 7 days)
  recentSessions: SessionLog[];
  
  // Statistics
  stats: {
    totalSessions: number;
    completedThisWeek: number;
    currentStreak: number;
    averageEnergyLevel?: number;
  };
  
  // AI-generated summary (cached)
  summary?: string;
  
  // Metadata
  lastUpdated: string;
  onboardingCompleted: boolean;
}

/**
 * Condensed context for prompts (token-efficient)
 */
export interface CondensedContext {
  name: string;
  summary: string;
  currentGoals: string[];
  recentPerformance: string;
  keyTraits: string[];
}

// ============================================
// CONTEXT BUILDER
// ============================================

/**
 * Build a complete user context from database records
 */
export function buildUserContext(
  user: {
    id: string;
    email?: string;
    full_name?: string;
  },
  profile: Record<string, unknown> | null,
  goals: Array<Record<string, unknown>>,
  sessions: Array<Record<string, unknown>>,
  stats: {
    totalSessions: number;
    completedThisWeek: number;
    currentStreak: number;
  }
): UserContext {
  // Parse profile
  const parsedProfile: UserProfile = {
    name: (profile?.name as string) || user.full_name || "Friend",
    motivation: profile?.motivation as string | undefined,
    interests: parseJsonField<string[]>(profile?.interests, []),
    lifestyle: profile?.lifestyle as string | undefined,
    pastExperience: profile?.past_experience as string | undefined,
    personality: parseJsonField<string>(profile?.personality),
    availability: parseJsonField<UserProfile["availability"]>(profile?.weekly_availability),
    limitations: parseJsonField<string[]>(profile?.limitations, []),
    goals: {
      shortTerm: profile?.short_term_goal as string | undefined,
      longTerm: profile?.long_term_goal as string | undefined,
    },
    physicalStats: parseJsonField<UserProfile["physicalStats"]>(profile?.physical_stats),
  };

  // Parse goals
  const parsedGoals: UserGoal[] = goals.map((g) => ({
    id: g.id as string,
    title: g.title as string,
    type: g.type as string,
    description: g.description as string | undefined,
    currentLevel: g.current_level as string | undefined,
    targetLevel: g.target_level as string | undefined,
    status: (g.status as "active" | "completed" | "paused") || "active",
    progress: (g.progress as number) || 0,
    createdAt: g.created_at as string,
    aiConversation: parseJsonField<Array<{ role: string; content: string }>>(g.ai_conversation),
  }));

  // Parse recent sessions
  const parsedSessions: SessionLog[] = sessions.map((s) => ({
    id: s.id as string,
    sessionTitle: s.title as string || "Training Session",
    completedAt: s.completed_at as string,
    metricsResult: parseJsonField<Record<string, unknown>>(s.metrics_result),
    userFeedback: s.user_feedback as string | undefined,
    aiFeedback: s.ai_feedback as string | undefined,
    energyLevel: s.energy_level as number | undefined,
  }));

  // Calculate average energy level
  const energyLevels = parsedSessions
    .map((s) => s.energyLevel)
    .filter((e): e is number => e !== undefined);
  const averageEnergyLevel = energyLevels.length > 0
    ? energyLevels.reduce((a, b) => a + b, 0) / energyLevels.length
    : undefined;

  return {
    userId: user.id,
    email: user.email,
    profile: parsedProfile,
    goals: parsedGoals,
    recentSessions: parsedSessions,
    stats: {
      ...stats,
      averageEnergyLevel,
    },
    lastUpdated: new Date().toISOString(),
    onboardingCompleted: Boolean(profile?.onboarding_completed),
  };
}

// ============================================
// CONTEXT SUMMARIZATION
// ============================================

/**
 * Generate a condensed, token-efficient summary for prompts
 */
export function summarizeForPrompt(context: UserContext): CondensedContext {
  const { profile, goals, recentSessions, stats } = context;

  // Build key traits
  const keyTraits: string[] = [];
  if (profile.personality) {
    keyTraits.push(profile.personality);
  }
  if (profile.lifestyle) {
    keyTraits.push(profile.lifestyle);
  }
  if (stats.currentStreak > 3) {
    keyTraits.push("consistent");
  }
  if (stats.averageEnergyLevel && stats.averageEnergyLevel >= 7) {
    keyTraits.push("high-energy");
  }

  // Build performance summary
  let recentPerformance = "";
  if (recentSessions.length > 0) {
    const completedCount = recentSessions.length;
    const latestFeedback = recentSessions[0]?.aiFeedback;
    recentPerformance = `${completedCount} sessions in last 7 days.`;
    if (latestFeedback) {
      recentPerformance += ` Latest: ${latestFeedback.slice(0, 100)}`;
    }
  } else {
    recentPerformance = "No recent sessions.";
  }

  // Build summary
  const summaryParts: string[] = [];
  summaryParts.push(`${profile.name} is a user of My Best.`);
  
  if (profile.motivation) {
    summaryParts.push(`Motivation: ${profile.motivation.slice(0, 100)}`);
  }
  
  if (profile.availability?.days?.length) {
    summaryParts.push(`Available: ${profile.availability.days.join(", ")}`);
  }
  
  if (profile.limitations?.length) {
    summaryParts.push(`Limitations: ${profile.limitations.join(", ")}`);
  }
  
  if (goals.length > 0) {
    const activeGoals = goals.filter((g) => g.status === "active");
    summaryParts.push(`Working on ${activeGoals.length} active goal(s).`);
  }

  return {
    name: profile.name,
    summary: summaryParts.join(" "),
    currentGoals: goals
      .filter((g) => g.status === "active")
      .map((g) => `${g.title} (${g.type}, ${g.progress}% complete)`),
    recentPerformance,
    keyTraits,
  };
}

/**
 * Generate a full AI context summary (for storage in user_profiles.ai_context_summary)
 */
export function generateAISummary(context: UserContext): string {
  const { profile, goals, recentSessions, stats } = context;
  
  const parts: string[] = [];

  // Identity
  parts.push(`User: ${profile.name}`);
  
  // Background
  if (profile.motivation) {
    parts.push(`Why they're here: ${profile.motivation}`);
  }
  
  if (profile.interests?.length) {
    parts.push(`Interests: ${profile.interests.join(", ")}`);
  }
  
  if (profile.personality) {
    parts.push(`Personality: ${profile.personality}`);
  }
  
  // Availability
  if (profile.availability) {
    const { days, timePreference, minutesPerSession } = profile.availability;
    if (days?.length) {
      parts.push(`Available: ${days.join(", ")}${timePreference ? ` (${timePreference})` : ""}`);
    }
    if (minutesPerSession) {
      parts.push(`Session length: ${minutesPerSession} minutes`);
    }
  }
  
  // Limitations
  if (profile.limitations?.length) {
    parts.push(`Physical considerations: ${profile.limitations.join(", ")}`);
  }
  
  // Goals
  if (profile.goals?.shortTerm) {
    parts.push(`Short-term goal: ${profile.goals.shortTerm}`);
  }
  if (profile.goals?.longTerm) {
    parts.push(`Long-term vision: ${profile.goals.longTerm}`);
  }
  
  // Active goals
  const activeGoals = goals.filter((g) => g.status === "active");
  if (activeGoals.length > 0) {
    parts.push(`\nActive Goals:`);
    activeGoals.forEach((g) => {
      parts.push(`- ${g.title} (${g.type}): ${g.progress}% complete, level: ${g.currentLevel || "not set"}`);
    });
  }
  
  // Recent activity
  if (stats.totalSessions > 0) {
    parts.push(`\nActivity: ${stats.totalSessions} total sessions, ${stats.completedThisWeek} this week, ${stats.currentStreak} day streak`);
  }
  
  // Recent performance
  if (recentSessions.length > 0) {
    const latest = recentSessions[0];
    if (latest.aiFeedback) {
      parts.push(`Latest feedback: ${latest.aiFeedback}`);
    }
    if (stats.averageEnergyLevel) {
      parts.push(`Average energy: ${stats.averageEnergyLevel.toFixed(1)}/10`);
    }
  }
  
  return parts.join("\n");
}

// ============================================
// CONTEXT FOR SPECIFIC USE CASES
// ============================================

/**
 * Build context for onboarding (minimal - user is new)
 */
export function buildOnboardingContext(
  partialProfile: Partial<UserProfile>,
  conversationHistory: Array<{ role: string; content: string }>
): string {
  const parts: string[] = [];
  
  if (partialProfile.name) {
    parts.push(`User's name: ${partialProfile.name}`);
  }
  
  if (partialProfile.motivation) {
    parts.push(`Their motivation: ${partialProfile.motivation}`);
  }
  
  if (partialProfile.interests?.length) {
    parts.push(`Interests so far: ${partialProfile.interests.join(", ")}`);
  }
  
  if (partialProfile.availability?.days?.length) {
    parts.push(`Available: ${partialProfile.availability.days.join(", ")}`);
  }

  if (parts.length === 0) {
    return "New user, just starting onboarding.";
  }
  
  return `Current onboarding progress:\n${parts.join("\n")}`;
}

/**
 * Build context for goal-specific chat
 */
export function buildGoalChatContext(
  context: UserContext,
  goalId: string
): string {
  const goal = context.goals.find((g) => g.id === goalId);
  if (!goal) {
    return "Goal not found.";
  }

  const parts: string[] = [];
  
  // User background
  parts.push(`User: ${context.profile.name}`);
  if (context.profile.personality) {
    parts.push(`Personality: ${context.profile.personality}`);
  }
  if (context.profile.availability?.days?.length) {
    parts.push(`Available: ${context.profile.availability.days.join(", ")}`);
  }
  
  // Goal details
  parts.push(`\nGoal: ${goal.title}`);
  parts.push(`Type: ${goal.type}`);
  parts.push(`Current level: ${goal.currentLevel || "Not assessed"}`);
  parts.push(`Target: ${goal.targetLevel || "Not set"}`);
  parts.push(`Progress: ${goal.progress}%`);
  
  // Previous conversation
  if (goal.aiConversation?.length) {
    parts.push(`\nPrevious conversation:`);
    // Only include last 5 messages to save tokens
    const recent = goal.aiConversation.slice(-5);
    recent.forEach((msg) => {
      parts.push(`${msg.role}: ${msg.content.slice(0, 200)}`);
    });
  }
  
  // Related sessions
  const relatedSessions = context.recentSessions.slice(0, 3);
  if (relatedSessions.length > 0) {
    parts.push(`\nRecent training:`);
    relatedSessions.forEach((s) => {
      parts.push(`- ${s.sessionTitle}: ${s.aiFeedback?.slice(0, 100) || "No feedback"}`);
    });
  }
  
  return parts.join("\n");
}

/**
 * Build context for session execution
 */
export function buildSessionContext(
  context: UserContext,
  sessionDetails: {
    title: string;
    tasks: Array<{ name: string; type: string; target?: Record<string, unknown> }>;
    previousSessions?: SessionLog[];
  }
): string {
  const parts: string[] = [];
  
  parts.push(`User: ${context.profile.name}`);
  
  if (context.profile.limitations?.length) {
    parts.push(`Limitations to consider: ${context.profile.limitations.join(", ")}`);
  }
  
  parts.push(`\nToday's session: ${sessionDetails.title}`);
  parts.push(`Tasks:`);
  sessionDetails.tasks.forEach((t, i) => {
    parts.push(`${i + 1}. ${t.name} (${t.type})`);
  });
  
  if (sessionDetails.previousSessions?.length) {
    parts.push(`\nPrevious performance:`);
    sessionDetails.previousSessions.slice(0, 3).forEach((s) => {
      if (s.aiFeedback) {
        parts.push(`- ${s.aiFeedback.slice(0, 100)}`);
      }
    });
  }
  
  return parts.join("\n");
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Safely parse JSON fields from database
 */
function parseJsonField<T>(value: unknown, defaultValue?: T): T | undefined {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  }
  
  // Already parsed (Supabase does this automatically for jsonb)
  return value as T;
}

/**
 * Calculate days since a date
 */
export function daysSince(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get sessions from the last N days
 */
export function filterRecentSessions(
  sessions: SessionLog[],
  days: number
): SessionLog[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  return sessions.filter((s) => {
    const sessionDate = new Date(s.completedAt);
    return sessionDate >= cutoff;
  });
}
