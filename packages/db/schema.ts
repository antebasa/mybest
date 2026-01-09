import { pgTable, text, timestamp, uuid, jsonb, boolean, integer, pgEnum, date } from "drizzle-orm/pg-core";

// ============================================
// ENUMS
// ============================================
export const sessionStatusEnum = pgEnum("session_status", ["pending", "completed", "skipped"]);
export const planTypeEnum = pgEnum("plan_type", ["macro_cycle", "micro_cycle"]);
export const taskTypeEnum = pgEnum("task_type", ["rep_based", "time_based", "input_based", "media_required"]);
export const mediaTypeEnum = pgEnum("media_type", ["video", "image"]);

// ============================================
// USERS & PROFILES
// ============================================
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  authProviderId: text("auth_provider_id"), // Supabase Auth UID
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  
  // ============================================
  // ONBOARDING DATA (Phase 1)
  // ============================================
  
  // User's name (from onboarding Q1)
  name: text("name"),
  
  // Why they're here / motivation (from onboarding Q2)
  motivation: text("motivation"),
  
  // User interests and hobbies (from onboarding Q3)
  interests: jsonb("interests").default([]), // ["darts", "running", "chess"]
  
  // Lifestyle description (from onboarding Q4)
  lifestyle: text("lifestyle"),
  
  // Past experience with self-improvement (from onboarding Q5)
  pastExperience: text("past_experience"),
  
  // AI-derived personality traits (from onboarding Q6)
  personality: jsonb("personality").default({}), // { tenacious: true, analytical: false }
  
  // Schedule availability (from onboarding Q7)
  weeklyAvailability: jsonb("weekly_availability").default({}), // { days: ["mon", "wed", "fri"], timePreference: "evening" }
  
  // Physical limitations (from onboarding Q8)
  limitations: jsonb("limitations").default([]), // ["bad knee", "shoulder issues"]
  
  // Short-term goal vision (from onboarding Q9)
  shortTermGoal: text("short_term_goal"),
  
  // Long-term goal vision (from onboarding Q10)
  longTermGoal: text("long_term_goal"),
  
  // ============================================
  // PHYSICAL STATS (optional, for fitness goals)
  // ============================================
  physicalStats: jsonb("physical_stats").default({}), // { height_cm: 180, weight_kg: 75, age: 30 }
  
  // ============================================
  // PREFERENCES
  // ============================================
  preferences: jsonb("preferences").default({}), // { notifications: true, theme: "dark" }
  
  // ============================================
  // AI CONTEXT & BYOK (Phase 1)
  // ============================================
  
  // AI-generated summary of user for efficient prompts
  aiContextSummary: text("ai_context_summary"),
  
  // User's own API keys (encrypted)
  // Structure: { openai: "sk-...", anthropic: "sk-ant-...", mimo: "...", openrouter: "sk-or-..." }
  apiKeys: jsonb("api_keys").default({}),
  
  // ============================================
  // STATUS
  // ============================================
  onboardingCompleted: boolean("onboarding_completed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// GOALS & PLANS
// ============================================
export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  title: text("title").notNull(), // "Master Darts"
  type: text("type").notNull(), // "darts", "running", "bodyweight", "custom"
  description: text("description"),
  
  currentLevel: text("current_level"), // "beginner", "intermediate", "advanced"
  targetLevel: text("target_level"),
  
  // AI reasoning for this goal setup
  aiReasoning: text("ai_reasoning"),
  
  // AI conversation during goal setup (Phase 2)
  aiConversation: jsonb("ai_conversation").default([]), // Array of { role, content }
  
  // Media requested during goal setup
  mediaRequests: jsonb("media_requests").default([]), // Array of { type, prompt, received }
  
  status: text("status").default("active"), // "active", "completed", "paused"
  progress: integer("progress").default(0),
  
  isActive: boolean("is_active").default(true),
  completedAt: timestamp("completed_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  goalId: uuid("goal_id").references(() => goals.id, { onDelete: "cascade" }).notNull(),
  
  title: text("title").notNull(), // "2 Week Quick Start"
  type: planTypeEnum("type").notNull(), // macro_cycle or micro_cycle
  
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  
  // Structured plan data generated by AI
  planData: jsonb("plan_data").default({}),
  
  // AI reasoning for why this plan was created
  aiReasoning: text("ai_reasoning"),
  
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// SESSIONS & TASKS
// ============================================
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").references(() => plans.id, { onDelete: "cascade" }).notNull(),
  
  title: text("title").notNull(), // "Accuracy Training Day 1"
  description: text("description"),
  
  scheduledDate: date("scheduled_date").notNull(),
  estimatedDurationMin: integer("estimated_duration_min").default(30),
  
  status: sessionStatusEnum("status").default("pending"),
  completedAt: timestamp("completed_at"),
  
  // Order within the plan
  orderIndex: integer("order_index").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "cascade" }).notNull(),
  
  name: text("name").notNull(), // "Throw 50 darts at bullseye"
  description: text("description"),
  type: taskTypeEnum("type").notNull(),
  
  // Target metrics for this task
  targetMetrics: jsonb("target_metrics").default({}), // { bullseyes: 25, total_throws: 50 }
  
  // Coaching tips from AI
  tips: text("tips"),
  
  // If media_required, what prompt to show
  mediaPrompt: text("media_prompt"),
  
  // Order within the session
  orderIndex: integer("order_index").default(0),
  
  isCompleted: boolean("is_completed").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// LOGS & MEDIA
// ============================================
export const sessionLogs = pgTable("session_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  
  // Actual results recorded by user
  metricsResult: jsonb("metrics_result").default({}), // { bullseyes: 42, total_throws: 50 }
  
  // User's self-reported feedback
  userFeedback: text("user_feedback"), // "Felt shoulder pain after 30 throws"
  
  // AI-generated feedback after analysis
  aiFeedback: text("ai_feedback"), // "Your elbow is dropping too early..."
  
  // Overall mood/energy rating
  energyLevel: integer("energy_level"), // 1-10
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mediaUploads = pgTable("media_uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  logId: uuid("log_id").references(() => sessionLogs.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  storagePath: text("storage_path").notNull(), // Supabase Storage path
  type: mediaTypeEnum("type").notNull(),
  
  // Analysis status
  isAnalyzed: boolean("is_analyzed").default(false),
  analysisResult: jsonb("analysis_result").default({}), // AI analysis output
  
  // Soft delete after analysis to save storage
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// CHAT & NOTIFICATIONS
// ============================================
export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  role: text("role").notNull(), // "user" | "assistant" | "system"
  content: text("content").notNull(),
  
  // Optional: link to a specific goal context
  goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
  
  // Metadata for context management
  metadata: jsonb("metadata").default({}), // { context: "onboarding", questionIndex: 3 }
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull(), // "reminder" | "achievement" | "nudge"
  
  // Link to related entity
  relatedEntityType: text("related_entity_type"), // "session" | "goal"
  relatedEntityId: uuid("related_entity_id"),
  
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  
  // For push notifications
  sentAt: timestamp("sent_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// VALIDATION LOGS (Phase 1 - for debugging)
// ============================================
export const validationLogs = pgTable("validation_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  context: text("context").notNull(), // "days_available", "name", etc.
  question: text("question").notNull(), // The question asked
  userInput: text("user_input").notNull(), // What user typed
  aiResponse: jsonb("ai_response").notNull(), // Full validation result
  isValid: boolean("is_valid").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// OFFLINE SYNC TRACKING
// ============================================
export const syncQueue = pgTable("sync_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  tableName: text("table_name").notNull(),
  recordId: uuid("record_id").notNull(),
  operation: text("operation").notNull(), // "insert" | "update" | "delete"
  payload: jsonb("payload").default({}),
  
  isSynced: boolean("is_synced").default(false),
  syncedAt: timestamp("synced_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
