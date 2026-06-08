"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { TopNav } from "@/components/layout/top-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { EmptyState } from "@/components/paper/empty-state";
import { PdfViewer } from "@/components/paper/pdf-viewer";
import { UploadOverlay } from "@/components/paper/upload-overlay";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  MAX_PDF_SIZE_BYTES,
  PAPERS_BUCKET,
  PDF_MIME_TYPE,
  getPaperStoragePath,
  getPdfTitleFromFileName,
  isPdfFile,
  type Paper
} from "@/lib/papers";
import { type Message } from "@/lib/messages";

const INITIAL_MESSAGES: Message[] = [
  {
    id: "paper-chat-next",
    role: "assistant",
    content: "Upload and view PDFs here. Paper chat is coming in the next stage."
  }
];

interface WorkspaceShellProps {
  userId: string;
  userEmail: string | null;
  userName: string | null;
  initialPapers: Paper[];
}

function getUploadErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Could not upload this PDF.";
}

export function WorkspaceShell({
  userId,
  userEmail,
  userName,
  initialPapers
}: WorkspaceShellProps) {
  const [readMode, setReadMode] = useState(false);
  const [assistantExpanded, setAssistantExpanded] = useState(true);
  const [papers, setPapers] = useState<Paper[]>(initialPapers);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(
    initialPapers[0]?.id ?? null
  );
  const [isUploading, setIsUploading] = useState(false);
  const [deletingPaperId, setDeletingPaperId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);

  const selectedPaper = useMemo(
    () => papers.find((paper) => paper.id === selectedPaperId) ?? null,
    [papers, selectedPaperId]
  );

  const assistantDisabledMessage = selectedPaper
    ? "Paper chat is coming in the next stage."
    : "Upload a PDF to view it. Paper chat comes next.";

  const handleReadModeChange = (value: boolean) => {
    setReadMode(value);
    if (value) {
      setAssistantExpanded(false);
    } else {
      setAssistantExpanded(true);
    }
  };

  const removePaperLocally = (paperId: string) => {
    setPapers((currentPapers) => {
      const nextPapers = currentPapers.filter((paper) => paper.id !== paperId);
      setSelectedPaperId((currentSelectedId) =>
        currentSelectedId === paperId ? nextPapers[0]?.id ?? null : currentSelectedId
      );
      return nextPapers;
    });
  };

  const handleUpload = async (file: File) => {
    if (isUploading) return;

    if (!isPdfFile(file)) {
      toast.error("Upload a PDF file.");
      return;
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      toast.error("PDF must be 25 MB or smaller.");
      return;
    }

    const supabase = getBrowserSupabaseClient();
    const paperId = crypto.randomUUID();
    const title = getPdfTitleFromFileName(file.name);
    const storagePath = getPaperStoragePath(userId, paperId);
    const timestamp = new Date().toISOString();
    const draftPaper: Paper = {
      id: paperId,
      title,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: PDF_MIME_TYPE,
      status: "uploading",
      created_at: timestamp,
      updated_at: timestamp
    };

    setIsUploading(true);
    setPapers((currentPapers) => [draftPaper, ...currentPapers]);
    setSelectedPaperId(paperId);

    try {
      const { error: insertError } = await supabase.from("papers").insert({
        id: paperId,
        owner_id: userId,
        title,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: PDF_MIME_TYPE,
        status: "uploading"
      });

      if (insertError) throw insertError;

      const { error: uploadError } = await supabase.storage
        .from(PAPERS_BUCKET)
        .upload(storagePath, file, {
          cacheControl: "3600",
          contentType: PDF_MIME_TYPE,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: readyPaper, error: updateError } = await supabase
        .from("papers")
        .update({ status: "ready" })
        .eq("id", paperId)
        .select("id,title,storage_path,file_size,mime_type,status,created_at,updated_at")
        .single();

      if (updateError) throw updateError;

      setPapers((currentPapers) =>
        currentPapers.map((paper) => (paper.id === paperId ? (readyPaper as Paper) : paper))
      );
      toast.success("PDF uploaded");
    } catch (error) {
      await supabase.storage.from(PAPERS_BUCKET).remove([storagePath]);
      await supabase.from("papers").delete().eq("id", paperId);
      removePaperLocally(paperId);
      toast.error(getUploadErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectPaper = (paperId: string) => {
    setSelectedPaperId(paperId);
  };

  const handleClosePaper = () => {
    setSelectedPaperId(null);
  };

  const handleDeletePaper = async (paperId: string) => {
    const paper = papers.find((currentPaper) => currentPaper.id === paperId);
    if (!paper || deletingPaperId) return;

    const confirmed = window.confirm(`Delete "${paper.title}"?`);
    if (!confirmed) return;

    setDeletingPaperId(paperId);

    const supabase = getBrowserSupabaseClient();
    const { error: storageError } = await supabase.storage
      .from(PAPERS_BUCKET)
      .remove([paper.storage_path]);

    if (storageError) {
      setDeletingPaperId(null);
      toast.error(storageError.message);
      return;
    }

    const { error: deleteError } = await supabase.from("papers").delete().eq("id", paperId);

    setDeletingPaperId(null);

    if (deleteError) {
      toast.error(deleteError.message);
      return;
    }

    removePaperLocally(paperId);
    toast.success("Paper deleted");
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <TopNav readMode={readMode} onReadModeChange={handleReadModeChange} />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          readMode={readMode}
          userId={userId}
          userEmail={userEmail}
          userName={userName}
          papers={papers}
          selectedPaperId={selectedPaperId}
          isUploading={isUploading}
          onUploadPaper={handleUpload}
          onSelectPaper={handleSelectPaper}
          onDeletePaper={handleDeletePaper}
          deletingPaperId={deletingPaperId}
        />

        <main className="relative min-w-0 flex-1 border-r border-border">
          {selectedPaper ? (
            <PdfViewer paper={selectedPaper} onClose={handleClosePaper} />
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
          chatEnabled={false}
          disabledMessage={assistantDisabledMessage}
        />
      </div>
    </div>
  );
}
