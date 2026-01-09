"use client";

import { useState, useRef, useEffect } from "react";
import { Button, Card, CardBody, Spinner, Select, SelectItem } from "@heroui/react";
import Link from "next/link";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const PROVIDERS = [
  { key: "gemini", label: "Google Gemini" },
  { key: "openai", label: "OpenAI GPT-4" },
  { key: "anthropic", label: "Anthropic Claude" },
  { key: "openrouter", label: "OpenRouter" },
];

export default function FreeChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState("gemini");
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/free-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          provider,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.message,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-100 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center">
                <span className="text-white font-bold">MB</span>
              </div>
            </Link>
            <div>
              <h1 className="font-semibold text-zinc-900 dark:text-white">Free Chat</h1>
              <p className="text-sm text-zinc-500">Test AI directly</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Select
              size="sm"
              selectedKeys={[provider]}
              onChange={(e) => setProvider(e.target.value)}
              className="w-40"
              aria-label="Select AI provider"
            >
              {PROVIDERS.map((p) => (
                <SelectItem key={p.key}>{p.label}</SelectItem>
              ))}
            </Select>
            
            <Button
              size="sm"
              variant="flat"
              onPress={clearChat}
              isDisabled={messages.length === 0}
            >
              Clear
            </Button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
                Start a conversation
              </h2>
              <p className="text-zinc-500 max-w-md mx-auto">
                Chat directly with {PROVIDERS.find((p) => p.key === provider)?.label || "AI"}.
                This is a raw test interface - no context, no validation.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <Card
                className={`max-w-[80%] ${
                  message.role === "user"
                    ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white"
                    : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <CardBody className="py-3 px-4">
                  <pre className="text-sm whitespace-pre-wrap font-sans">
                    {message.content}
                  </pre>
                </CardBody>
              </Card>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <CardBody className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" />
                    <span className="text-sm text-zinc-500">Thinking...</span>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <Card className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <CardBody className="py-3 px-4">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    ❌ {error}
                  </p>
                </CardBody>
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="sticky bottom-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 p-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            disabled={isLoading}
          />
          <Button
            type="submit"
            isDisabled={!input.trim() || isLoading}
            className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white px-6"
          >
            {isLoading ? <Spinner size="sm" color="white" /> : "Send"}
          </Button>
        </form>
      </footer>
    </div>
  );
}
