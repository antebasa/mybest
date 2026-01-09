/**
 * Check user profile in database
 * 
 * Run with: npx tsx tests/check-db-profile.ts <email>
 * Example:  npx tsx tests/check-db-profile.ts antebasa@gmail.com
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;

if (!supabaseUrl) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx tests/check-db-profile.ts <email>");
  process.exit(1);
}

async function checkProfile() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`\n🔍 Looking up profile for: ${email}\n`);

  // Find user by email
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("email", email);

  if (userError) {
    console.error("Error fetching user:", userError);
    return;
  }

  if (!users || users.length === 0) {
    console.log("❌ No user found with that email");
    return;
  }

  const user = users[0];
  console.log("✅ User found:");
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Created: ${user.created_at}`);

  // Get profile
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (profileError && profileError.code !== "PGRST116") {
    console.error("Error fetching profile:", profileError);
    return;
  }

  if (!profile) {
    console.log("\n❌ No profile found for this user");
    return;
  }

  console.log("\n📋 Profile Data:");
  console.log("─".repeat(50));
  
  const fields = [
    "name",
    "motivation",
    "interests",
    "lifestyle",
    "past_experience",
    "personality",
    "available_days",
    "time_preference",
    "limitations",
    "short_term_goal",
    "long_term_goal",
    "onboarding_completed",
  ];

  for (const field of fields) {
    const value = profile[field];
    const displayValue = value === null ? "(not set)" : 
                         typeof value === "object" ? JSON.stringify(value) : 
                         String(value);
    console.log(`  ${field}: ${displayValue}`);
  }

  console.log("─".repeat(50));
  console.log(`\n  Onboarding completed: ${profile.onboarding_completed ? "✅ Yes" : "❌ No"}`);
  console.log(`  Last updated: ${profile.updated_at || "(unknown)"}\n`);
}

checkProfile().catch(console.error);
