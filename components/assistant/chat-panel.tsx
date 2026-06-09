"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { type Message } from "@/lib/messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (content: string) => Promise<void> | void;
  disabled?: boolean;
  disabledMessage?: string;
  isSending?: boolean;
  isLoading?: boolean;
  isClearing?: boolean;
  privacyWarning?: string;
  onClearMessages?: () => Promise<void> | void;
}

export function ChatPanel({
  messages,
  onSendMessage,
  disabled,
  disabledMessage = "Paper chat is coming in the next stage.",
  isSending,
  isLoading,
  isClearing,
  privacyWarning,
  onClearMessages
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || disabled || isSending) return;

    setInput("");
    await onSendMessage(trimmed);
  };

  return (
    <div className="flex h-full flex-col">
      {(privacyWarning || onClearMessages) && (
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          {privacyWarning && (
            <p className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">
              {privacyWarning}
            </p>
          )}
          {onClearMessages && messages.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground"
              onClick={onClearMessages}
              disabled={isClearing || isSending || isLoading}
              aria-label="Clear chat"
              title="Clear chat"
            >
              {isClearing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading chat...
          </div>
        ) : messages.length > 0 ? (
          messages.map((message) => {
            const pages = Array.from(
              new Set((message.citations ?? []).map((citation) => citation.page))
            ).sort((a, b) => a - b);

            return (
              <div
                key={message.id}
                className={cn(
                  "max-w-[90%] rounded-md px-3 py-2 text-sm",
                  message.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                <div className="whitespace-pre-wrap leading-6">{message.content}</div>
                {message.role === "assistant" && pages.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pages.map((page) => (
                      <span
                        key={page}
                        className="rounded-sm border border-border/70 px-1.5 py-0.5 text-[11px] text-muted-foreground"
                      >
                        Page {page}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm leading-6 text-muted-foreground">
            {disabled ? disabledMessage : "Ask a question about this paper."}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form className="flex gap-2 border-t border-border p-3" onSubmit={handleSend}>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={disabled ? disabledMessage : "Ask about the paper..."}
          disabled={disabled || isSending}
        />
        <Button
          type="submit"
          size="icon"
          disabled={disabled || isSending || !input.trim()}
          aria-label="Send message"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
