"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button, Card, CardBody, Progress, Avatar, Spinner } from "@heroui/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ============================================
// TYPES
// ============================================

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ============================================
// SYSTEM PROMPT - THE AI CONDUCTS EVERYTHING
// ============================================

const ONBOARDING_SYSTEM_PROMPT = `You are an empathetic AI coach for the "My Best" personal development app. You're conducting an onboarding interview to get to know the user.

YOUR PERSONALITY:
- Warm, encouraging, genuine
- Use 1-2 emojis per message max
- Keep responses to 2-4 sentences
- Be conversational, not robotic

YOUR TASK:
Guide the user through these topics (in order, but be natural about it):
1. Their name
2. What brought them here / what they want to improve
3. Their hobbies and interests  
4. Their lifestyle (active/sedentary)
5. Past experience with self-improvement
6. How they handle challenges (personality)
7. What days/times work for training
8. Any physical limitations (optional)
9. Short-term goal (2 weeks)
10. Long-term vision (3-6 months)

IMPORTANT RULES:
- If an answer is unclear, ask a natural follow-up (don't reject it!)
- If they say something like "all" for days, that's valid - it means all days
- If they want to skip something, let them ("no problem, we can figure that out later")
- Be flexible! This is a conversation, not an interrogation
- After covering all topics, summarize what you learned and say you're excited to start

EXTRACTION (in your final message only):
When you've covered everything, end with a JSON block like this:
\`\`\`json
{
  "complete": true,
  "profile": {
    "name": "extracted name",
    "motivation": "why they're here",
    "interests": ["list", "of", "interests"],
    "lifestyle": "active/sedentary/mixed",
    "pastExperience": "their experience",
    "personality": "how they handle challenges",
    "availability": {
      "days": ["monday", "tuesday", etc],
      "timePreference": "morning/evening/etc"
    },
    "limitations": ["any", "limitations"] or [],
    "shortTermGoal": "2 week goal",
    "longTermGoal": "3-6 month vision"
  }
}
\`\`\`

Start by warmly greeting them and asking their name.`;

// ============================================
// COMPONENT
// ============================================

export default function OnboardingPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [extractedProfile, setExtractedProfile] = useState<Record<string, unknown> | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [editableProfile, setEditableProfile] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();
  const initializedRef = useRef(false);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input
  useEffect(() => {
    if (!isProcessing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isProcessing]);

  // Start conversation on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    startConversation();
  }, []);

  // ============================================
  // AI CHAT
  // ============================================

  const sendToAI = async (conversationMessages: Message[]): Promise<string> => {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: ONBOARDING_SYSTEM_PROMPT },
          ...conversationMessages.map((m) => ({ role: m.role, content: m.content })),
        ],
        context: "onboarding",
        rawMode: true, // Skip the server's system prompt, use ours
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to get AI response");
    }

    const data = await response.json();
    return data.message;
  };

  const startConversation = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const aiResponse = await sendToAI([]);
      
      const welcomeMessage: Message = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: aiResponse,
      };
      
      setMessages([welcomeMessage]);
    } catch (err) {
      console.error("Failed to start conversation:", err);
      setError(err instanceof Error ? err.message : "Failed to connect to AI");
      
      // Fallback welcome
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: "Hey there! 👋 I'm your AI coach. I'm excited to help you become the best version of yourself. Let's start by getting to know each other.\n\nWhat should I call you?",
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================
  // HANDLE SUBMIT
  // ============================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing || isComplete) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsProcessing(true);
    setError(null);

    try {
      const aiResponse = await sendToAI(newMessages);
      
      // Check if AI included the completion JSON
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const extracted = JSON.parse(jsonMatch[1]);
          console.log("Extracted profile:", extracted);
          if (extracted.complete && extracted.profile) {
            setExtractedProfile(extracted.profile);
            setIsComplete(true);
            
            // Save profile
            const saved = await saveProfile(extracted.profile);
            console.log("Profile saved:", saved);
          }
        } catch (parseErr) {
          console.error("JSON parse failed:", parseErr, jsonMatch[1]);
        }
      } else {
        // Try to find JSON without code blocks (AI might format differently)
        const plainJsonMatch = aiResponse.match(/\{\s*"complete"\s*:\s*true[\s\S]*?"profile"\s*:[\s\S]*?\}\s*\}/);
        if (plainJsonMatch) {
          try {
            const extracted = JSON.parse(plainJsonMatch[0]);
            console.log("Extracted profile (plain):", extracted);
            if (extracted.profile) {
              setExtractedProfile(extracted.profile);
              setIsComplete(true);
              await saveProfile(extracted.profile);
            }
          } catch (parseErr) {
            console.error("Plain JSON parse failed:", parseErr);
          }
        }
      }

      // Remove JSON from displayed message
      const displayMessage = aiResponse.replace(/```json[\s\S]*?```/g, "").trim();

      const assistantMessage: Message = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: displayMessage || aiResponse,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("AI error:", err);
      setError(err instanceof Error ? err.message : "Failed to get response");
      
      // Add a fallback message so conversation can continue
      const fallbackMessage: Message = {
        id: `ai-fallback-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I had a brief hiccup! Could you repeat that?",
      };
      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================
  // SAVE PROFILE
  // ============================================

  const saveProfile = async (profile: Record<string, unknown>): Promise<boolean> => {
    console.log("Saving profile:", profile);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("No user found");
        return false;
      }
      
      console.log("User ID:", user.id);

      // Update auth metadata
      await supabase.auth.updateUser({
        data: {
          full_name: profile.name,
          onboarding_completed: true,
        },
      });

      // Prepare the update data
      const updateData = {
        name: profile.name || null,
        motivation: profile.motivation || null,
        interests: Array.isArray(profile.interests) ? profile.interests : [],
        lifestyle: profile.lifestyle || null,
        past_experience: profile.pastExperience || null,
        personality: typeof profile.personality === 'object' ? profile.personality : { description: profile.personality },
        weekly_availability: profile.availability || {},
        limitations: Array.isArray(profile.limitations) ? profile.limitations : [],
        short_term_goal: profile.shortTermGoal || null,
        long_term_goal: profile.longTermGoal || null,
        onboarding_completed: true,
      };
      
      console.log("Update data:", updateData);

      // Save to user_profiles via API
      const response = await fetch("/api/user/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: updateData,
          generateSummary: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to save profile:", response.status, errorText);
        return false;
      }
      
      console.log("Profile saved successfully!");
      return true;
    } catch (error) {
      console.error("Error saving profile:", error);
      return false;
    }
  };

  // ============================================
  // FINISH ONBOARDING (manual trigger)
  // ============================================

  const handleFinishOnboarding = async () => {
    if (isProcessing || isComplete) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Step 1: Call dedicated extraction API
      console.log("Extracting profile from conversation...");
      const extractResponse = await fetch("/api/ai/extract-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!extractResponse.ok) {
        const errData = await extractResponse.json();
        throw new Error(errData.error || "Failed to extract profile");
      }
      
      const { profile, provider } = await extractResponse.json();
      console.log("Extracted profile:", profile, "Provider:", provider);
      
      if (!profile) {
        throw new Error("No profile data extracted");
      }
      
      // Step 2: Show confirmation dialog so user can review/edit
      setExtractedProfile(profile);
      setEditableProfile({
        name: profile.name || "",
        motivation: profile.motivation || "",
        interests: Array.isArray(profile.interests) ? profile.interests.join(", ") : "",
        lifestyle: profile.lifestyle || "",
        pastExperience: profile.pastExperience || "",
        days: Array.isArray(profile.availability?.days) ? profile.availability.days.join(", ") : "",
        timePreference: profile.availability?.timePreference || "flexible",
        shortTermGoal: profile.shortTermGoal || "",
        longTermGoal: profile.longTermGoal || "",
      });
      setShowConfirmation(true);
      
      // Show message about review
      if (provider === "keyword-extraction") {
        setMessages(prev => [...prev, {
          id: `ai-review-${Date.now()}`,
          role: "assistant",
          content: "I've gathered your info! Since I'm running on fallback mode (AI is rate-limited), please review and fix anything I got wrong. 📝",
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: `ai-review-${Date.now()}`,
          role: "assistant",
          content: "I've summarized what you told me! Please review and make any corrections before we save. 📝",
        }]);
      }
      
    } catch (err) {
      console.error("Finish error:", err);
      setError(err instanceof Error ? err.message : "Failed to finish onboarding");
      
      setMessages(prev => [...prev, {
        id: `ai-error-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I had trouble extracting your info. Please try the 'Finish' button again.",
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Actually save after user confirms
  const handleConfirmSave = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      // Build profile from editable fields
      const finalProfile = {
        name: editableProfile.name || null,
        motivation: editableProfile.motivation || null,
        interests: editableProfile.interests ? editableProfile.interests.split(",").map(s => s.trim()).filter(Boolean) : [],
        lifestyle: editableProfile.lifestyle || null,
        pastExperience: editableProfile.pastExperience || null,
        availability: {
          days: editableProfile.days ? editableProfile.days.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) : [],
          timePreference: editableProfile.timePreference || "flexible",
        },
        shortTermGoal: editableProfile.shortTermGoal || null,
        longTermGoal: editableProfile.longTermGoal || null,
      };

      const saved = await saveProfile(finalProfile);
      if (!saved) {
        throw new Error("Failed to save profile to database");
      }
      
      setExtractedProfile(finalProfile);
      setShowConfirmation(false);
      setIsComplete(true);
      
      setMessages(prev => [...prev, {
        id: `ai-complete-${Date.now()}`,
        role: "assistant",
        content: `Perfect! I've saved your profile, ${finalProfile.name || "friend"}! 🎉 Let's set up your first goal!`,
      }]);
      
    } catch (err) {
      console.error("Save error:", err);
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================
  // NAVIGATION
  // ============================================

  const handleContinue = () => {
    router.push("/goals");
  };

  // ============================================
  // ESTIMATE PROGRESS
  // ============================================

  const estimateProgress = () => {
    // Rough estimate based on message count
    const userMessages = messages.filter((m) => m.role === "user").length;
    if (isComplete) return 100;
    return Math.min(userMessages * 10, 90);
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-zinc-100 via-zinc-50 to-indigo-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-indigo-950">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-white font-bold">MB</span>
            </div>
            <div>
              <span className="font-semibold text-zinc-900 dark:text-white">My Best</span>
              <span className="text-zinc-500 ml-2 text-sm">Getting to know you</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
        <div className="max-w-2xl mx-auto mt-4">
          <Progress
            value={estimateProgress()}
            size="sm"
            classNames={{
              track: "bg-zinc-200 dark:bg-zinc-800",
              indicator: "bg-gradient-to-r from-indigo-500 to-cyan-500",
            }}
          />
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="fixed top-24 left-0 right-0 z-40 px-4">
          <div className="max-w-2xl mx-auto bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 text-sm text-red-700 dark:text-red-300">
            ⚠️ {error}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900">
            <CardBody className="p-6 space-y-4">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                ✏️ Review Your Profile
              </h2>
              <p className="text-sm text-zinc-500">
                Please fix anything I got wrong:
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Name</label>
                  <input
                    type="text"
                    value={editableProfile.name}
                    onChange={e => setEditableProfile(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                    placeholder="Your name"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Why are you here? (motivation)</label>
                  <input
                    type="text"
                    value={editableProfile.motivation}
                    onChange={e => setEditableProfile(p => ({ ...p, motivation: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                    placeholder="What brings you here?"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Interests (comma separated)</label>
                  <input
                    type="text"
                    value={editableProfile.interests}
                    onChange={e => setEditableProfile(p => ({ ...p, interests: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                    placeholder="darts, running, coding..."
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Lifestyle</label>
                    <select
                      value={editableProfile.lifestyle}
                      onChange={e => setEditableProfile(p => ({ ...p, lifestyle: e.target.value }))}
                      className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                    >
                      <option value="">Select...</option>
                      <option value="active">Active</option>
                      <option value="sedentary">Sedentary</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Experience</label>
                    <select
                      value={editableProfile.pastExperience}
                      onChange={e => setEditableProfile(p => ({ ...p, pastExperience: e.target.value }))}
                      className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                    >
                      <option value="">Select...</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Some experience</option>
                      <option value="experienced">Experienced</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Available days (comma separated)</label>
                  <input
                    type="text"
                    value={editableProfile.days}
                    onChange={e => setEditableProfile(p => ({ ...p, days: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                    placeholder="monday, wednesday, friday..."
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Preferred time</label>
                  <select
                    value={editableProfile.timePreference}
                    onChange={e => setEditableProfile(p => ({ ...p, timePreference: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                  >
                    <option value="flexible">Flexible</option>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">2-week goal</label>
                  <input
                    type="text"
                    value={editableProfile.shortTermGoal}
                    onChange={e => setEditableProfile(p => ({ ...p, shortTermGoal: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                    placeholder="What do you want to achieve in 2 weeks?"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">3-6 month vision</label>
                  <input
                    type="text"
                    value={editableProfile.longTermGoal}
                    onChange={e => setEditableProfile(p => ({ ...p, longTermGoal: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                    placeholder="Where do you see yourself?"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button
                  variant="flat"
                  onPress={() => setShowConfirmation(false)}
                  className="flex-1"
                >
                  Back to chat
                </Button>
                <Button
                  onPress={handleConfirmSave}
                  isDisabled={isProcessing || !editableProfile.name}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white"
                >
                  {isProcessing ? <Spinner size="sm" color="white" /> : "Save Profile ✓"}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Chat Area */}
      <main className="flex-1 pt-32 pb-32 px-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`flex items-start gap-3 max-w-[85%] ${
                  message.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                {message.role === "assistant" && (
                  <Avatar
                    size="sm"
                    className="bg-gradient-to-br from-indigo-500 to-cyan-400 text-white flex-shrink-0 shadow-md"
                    name="AI"
                  />
                )}
                <Card
                  className={`${
                    message.role === "user"
                      ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/20"
                      : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm"
                  }`}
                >
                  <CardBody className="py-3 px-4">
                    <p className="text-sm whitespace-pre-line leading-relaxed">
                      {message.content}
                    </p>
                  </CardBody>
                </Card>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isProcessing && (
            <div className="flex justify-start animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <Avatar
                  size="sm"
                  className="bg-gradient-to-br from-indigo-500 to-cyan-400 text-white flex-shrink-0"
                  name="AI"
                />
                <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <CardBody className="py-3 px-4">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </CardBody>
                </Card>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 p-4">
        <div className="max-w-2xl mx-auto">
          {!isComplete ? (
            <div className="space-y-3">
              <form onSubmit={handleSubmit} className="flex gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your response..."
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 transition-all"
                />
                <Button
                  type="submit"
                  isDisabled={!input.trim() || isProcessing}
                  className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white px-6 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:shadow-none"
                >
                  {isProcessing ? (
                    <Spinner size="sm" color="white" />
                  ) : (
                    <span className="flex items-center gap-2">
                      Send
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </span>
                  )}
                </Button>
              </form>
              
              {/* Show Finish button after enough messages */}
              {messages.filter(m => m.role === "user").length >= 5 && (
                <Button
                  onPress={handleFinishOnboarding}
                  isDisabled={isProcessing}
                  variant="flat"
                  className="w-full text-indigo-600 dark:text-indigo-400"
                >
                  ✓ I'm done, finish onboarding
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {extractedProfile && (
                <div className="text-sm text-zinc-500 text-center">
                  ✅ Profile saved! Welcome, {extractedProfile.name as string}!
                </div>
              )}
              <Button
                onPress={handleContinue}
                className="w-full bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-semibold py-3 shadow-lg shadow-indigo-500/20"
                size="lg"
              >
                Set Up Your First Goal 🎯
              </Button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
