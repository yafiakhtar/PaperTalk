"use client";

import { useMemo, useState } from "react";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { TopNav } from "@/components/layout/top-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { EmptyState } from "@/components/paper/empty-state";
import { PdfViewer } from "@/components/paper/pdf-viewer";
import { UploadOverlay } from "@/components/paper/upload-overlay";
import { MOCK_INITIAL_MESSAGES, MOCK_PAPERS, type MockMessage } from "@/lib/mock-data";

export function WorkspaceShell() {
  const [readMode, setReadMode] = useState(false);
  const [assistantExpanded, setAssistantExpanded] = useState(true);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [hasUploadedPaper, setHasUploadedPaper] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [messages, setMessages] = useState<MockMessage[]>(MOCK_INITIAL_MESSAGES);

  const selectedPaper = useMemo(
    () => MOCK_PAPERS.find((paper) => paper.id === selectedPaperId) ?? null,
    [selectedPaperId]
  );

  const showPdf = hasUploadedPaper || selectedPaper?.status === "ready";
  const chatEnabled = showPdf;

  const handleReadModeChange = (value: boolean) => {
    setReadMode(value);
    if (value) {
      setAssistantExpanded(false);
    } else {
      setAssistantExpanded(true);
    }
  };

  const handleUpload = () => {
    setIsUploading(true);
    window.setTimeout(() => {
      setIsUploading(false);
      setHasUploadedPaper(true);
      setSelectedPaperId(MOCK_PAPERS[0].id);
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: "Your paper is ready. Ask me anything about it."
        }
      ]);
    }, 1500);
  };

  const handleSelectPaper = (paperId: string) => {
    setSelectedPaperId(paperId);
    const paper = MOCK_PAPERS.find((p) => p.id === paperId);
    if (paper?.status === "ready") {
      setHasUploadedPaper(true);
    }
  };

  const viewerTitle = selectedPaper?.title ?? "Uploaded Paper";

  return (
    <div className="flex h-screen flex-col bg-background">
      <TopNav readMode={readMode} onReadModeChange={handleReadModeChange} />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          readMode={readMode}
          selectedPaperId={selectedPaperId}
          onSelectPaper={handleSelectPaper}
        />

        <main className="relative min-w-0 flex-1 border-r border-border">
          {showPdf ? (
            <PdfViewer title={viewerTitle} />
          ) : (
            <>
              <EmptyState />
              <UploadOverlay isUploading={isUploading} onUpload={handleUpload} />
            </>
          )}
        </main>

        <AssistantPanel
          readMode={readMode}
          collapsed={readMode && !assistantExpanded}
          onExpand={() => setAssistantExpanded(true)}
          messages={messages}
          onMessagesChange={setMessages}
          chatEnabled={chatEnabled}
        />
      </div>
    </div>
  );
}
