"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { MOCK_ASSISTANT_REPLY, type MockMessage } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  messages: MockMessage[];
  onMessagesChange: (messages: MockMessage[]) => void;
  disabled?: boolean;
}

export function ChatPanel({ messages, onMessagesChange, disabled }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isSending || disabled) return;

    const userMessage: MockMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed
    };

    const withUser = [...messages, userMessage];
    onMessagesChange(withUser);
    setInput("");
    setIsSending(true);

    window.setTimeout(() => {
      const assistantMessage: MockMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: MOCK_ASSISTANT_REPLY
      };
      onMessagesChange([...withUser, assistantMessage]);
      setIsSending(false);
    }, 500);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "max-w-[90%] rounded-md px-3 py-2 text-sm",
              message.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            )}
          >
            {message.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 border-t border-border p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={disabled ? "Upload a paper first…" : "Ask about the paper…"}
          disabled={disabled || isSending}
        />
        <Button size="icon" onClick={handleSend} disabled={disabled || isSending || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
