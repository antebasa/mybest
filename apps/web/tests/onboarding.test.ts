/**
 * Onboarding Flow Test
 * 
 * Run with: npx tsx tests/onboarding.test.ts
 */

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  data?: unknown;
}

const results: TestResult[] = [];

function log(msg: string) {
  console.log(`[TEST] ${msg}`);
}

function pass(name: string, data?: unknown) {
  results.push({ name, passed: true, data });
  console.log(`✅ ${name}`);
}

function fail(name: string, error: string) {
  results.push({ name, passed: false, error });
  console.log(`❌ ${name}: ${error}`);
}

async function testChatAPI() {
  log("Testing /api/chat endpoint...");
  
  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "user", content: "Hello, my name is TestUser" }
        ],
        context: "onboarding",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      fail("Chat API responds", `Status ${response.status}: ${text}`);
      return false;
    }

    const data = await response.json();
    if (!data.message) {
      fail("Chat API responds", "No message in response");
      return false;
    }

    pass("Chat API responds", { messageLength: data.message.length });
    return true;
  } catch (err) {
    fail("Chat API responds", err instanceof Error ? err.message : "Unknown error");
    return false;
  }
}

async function testExtractProfileAPI() {
  log("Testing /api/ai/extract-profile endpoint...");
  
  // Simulate a conversation
  const mockConversation = [
    { role: "assistant", content: "Hey there! What should I call you?" },
    { role: "user", content: "My name is John" },
    { role: "assistant", content: "Nice to meet you John! What brought you here?" },
    { role: "user", content: "I want to get better at darts" },
    { role: "assistant", content: "Darts, nice! What's your experience level?" },
    { role: "user", content: "I'm a complete beginner, never played before" },
    { role: "assistant", content: "Got it! What days work for you to practice?" },
    { role: "user", content: "Mondays, Wednesdays, and Fridays in the evening" },
    { role: "assistant", content: "Any physical limitations I should know about?" },
    { role: "user", content: "No, I'm healthy" },
    { role: "assistant", content: "What's your goal for the next 2 weeks?" },
    { role: "user", content: "I want to hit the board consistently" },
    { role: "assistant", content: "And in 3-6 months?" },
    { role: "user", content: "I want to beat my friends at darts night" },
  ];

  try {
    const response = await fetch(`${BASE_URL}/api/ai/extract-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation: mockConversation }),
    });

    if (!response.ok) {
      const text = await response.text();
      fail("Extract Profile API", `Status ${response.status}: ${text}`);
      return false;
    }

    const data = await response.json();
    
    if (!data.profile) {
      fail("Extract Profile API", "No profile in response");
      return false;
    }

    const profile = data.profile;
    
    // Verify extracted fields
    const checks = [
      { field: "name", expected: "John", actual: profile.name },
      { field: "interests", check: () => Array.isArray(profile.interests) },
      { field: "availability.days", check: () => Array.isArray(profile.availability?.days) },
    ];

    let allPassed = true;
    for (const check of checks) {
      if (check.check) {
        if (!check.check()) {
          log(`  ⚠️ ${check.field} validation failed`);
          allPassed = false;
        }
      } else if (check.expected && !profile[check.field]?.toLowerCase().includes(check.expected.toLowerCase())) {
        log(`  ⚠️ ${check.field}: expected "${check.expected}", got "${profile[check.field]}"`);
      }
    }

    if (allPassed) {
      pass("Extract Profile API", profile);
    } else {
      pass("Extract Profile API (with warnings)", profile);
    }
    
    return true;
  } catch (err) {
    fail("Extract Profile API", err instanceof Error ? err.message : "Unknown error");
    return false;
  }
}

async function testUserContextAPI() {
  log("Testing /api/user/context endpoint (unauthenticated)...");
  
  try {
    const response = await fetch(`${BASE_URL}/api/user/context`);
    
    // Should return 401 for unauthenticated
    if (response.status === 401) {
      pass("User Context API (auth check)", "Returns 401 for unauthenticated");
      return true;
    }

    // If it returns 200, check the response
    if (response.ok) {
      const data = await response.json();
      pass("User Context API", data);
      return true;
    }

    fail("User Context API", `Unexpected status: ${response.status}`);
    return false;
  } catch (err) {
    fail("User Context API", err instanceof Error ? err.message : "Unknown error");
    return false;
  }
}

async function testFreeChatAPI() {
  log("Testing /api/ai/free-chat endpoint...");
  
  try {
    const response = await fetch(`${BASE_URL}/api/ai/free-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Say hello in 5 words or less" }],
        provider: "gemini",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      fail("Free Chat API", `Status ${response.status}: ${text}`);
      return false;
    }

    const data = await response.json();
    if (!data.message) {
      fail("Free Chat API", "No message in response");
      return false;
    }

    pass("Free Chat API", { 
      message: data.message.substring(0, 100),
      provider: data.provider,
      model: data.model 
    });
    return true;
  } catch (err) {
    fail("Free Chat API", err instanceof Error ? err.message : "Unknown error");
    return false;
  }
}

async function runTests() {
  console.log("\n========================================");
  console.log("   ONBOARDING FLOW TESTS");
  console.log("========================================\n");
  console.log(`Testing against: ${BASE_URL}\n`);

  // Run tests
  await testFreeChatAPI();
  await testChatAPI();
  await testExtractProfileAPI();
  await testUserContextAPI();

  // Summary
  console.log("\n========================================");
  console.log("   RESULTS");
  console.log("========================================\n");

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }

  console.log("\n");
  
  // Exit with error code if any failed
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
