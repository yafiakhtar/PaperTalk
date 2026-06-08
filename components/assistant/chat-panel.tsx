"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { type Message } from "@/lib/messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  messages: Message[];
  onMessagesChange: (messages: Message[]) => void;
  disabled?: boolean;
  disabledMessage?: string;
}

export function ChatPanel({
  messages,
  onMessagesChange,
  disabled,
  disabledMessage = "Paper chat is coming in the next stage."
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed
    };

    const withUser = [...messages, userMessage];
    onMessagesChange(withUser);
    setInput("");
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
          placeholder={disabled ? disabledMessage : "Ask about the paper..."}
          disabled={disabled}
        />
        <Button size="icon" onClick={handleSend} disabled={disabled || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
