"use client";

import { MessageSquare } from "lucide-react";
import { ChatPanel } from "@/components/assistant/chat-panel";
import { VoicePanel } from "@/components/assistant/voice-panel";
import { type Message } from "@/lib/messages";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AssistantPanelProps {
  readMode: boolean;
  collapsed: boolean;
  onExpand: () => void;
  messages: Message[];
  onMessagesChange: (messages: Message[]) => void;
  chatEnabled: boolean;
  disabledMessage?: string;
}

export function AssistantPanel({
  readMode,
  collapsed,
  onExpand,
  messages,
  onMessagesChange,
  chatEnabled,
  disabledMessage
}: AssistantPanelProps) {
  const panelContent = (
    <div className="flex h-full w-[360px] flex-col">
      <Tabs defaultValue="chat" className="flex h-full flex-col">
        <div className="border-b border-border px-4 py-3">
          <TabsList className="w-full">
            <TabsTrigger value="chat" className="flex-1">
              Chat
            </TabsTrigger>
            <TabsTrigger value="voice" className="flex-1">
              Voice
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="mt-0 flex-1 overflow-hidden">
          <ChatPanel
            messages={messages}
            onMessagesChange={onMessagesChange}
            disabled={!chatEnabled}
            disabledMessage={disabledMessage}
          />
        </TabsContent>

        <TabsContent value="voice" className="mt-0 flex-1 overflow-hidden">
          <VoicePanel disabled={!chatEnabled} disabledMessage={disabledMessage} />
        </TabsContent>
      </Tabs>
    </div>
  );

  if (collapsed) {
    return (
      <aside className="relative w-0 shrink-0">
        <Button
          variant="outline"
          size="icon"
          className="absolute -left-10 top-4 z-10 h-8 w-8"
          onClick={onExpand}
          aria-label="Expand assistant"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
      </aside>
    );
  }

  if (readMode) {
    return (
      <aside className="fixed inset-y-12 right-0 z-20 flex w-[360px] flex-col border-l border-border bg-background shadow-lg">
        {panelContent}
      </aside>
    );
  }

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-border transition-[width] duration-300">
      {panelContent}
    </aside>
  );
}
