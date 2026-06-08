"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAPERS_BUCKET, formatFileSize, type Paper } from "@/lib/papers";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

interface PdfViewerProps {
  paper: Paper;
}

export function PdfViewer({ paper }: PdfViewerProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (paper.status !== "ready") {
      setObjectUrl((previousUrl) => {
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        return null;
      });
      setError(null);
      setIsLoading(false);
      return;
    }

    let isActive = true;
    let nextObjectUrl: string | null = null;

    setObjectUrl((previousUrl) => {
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      return null;
    });
    setError(null);
    setIsLoading(true);

    const loadPdf = async () => {
      const supabase = getBrowserSupabaseClient();
      const { data, error: downloadError } = await supabase.storage
        .from(PAPERS_BUCKET)
        .download(paper.storage_path);

      if (!isActive) return;

      if (downloadError || !data) {
        setError(downloadError?.message || "Could not load this PDF.");
        setIsLoading(false);
        return;
      }

      nextObjectUrl = URL.createObjectURL(data);
      setObjectUrl(nextObjectUrl);
      setIsLoading(false);
    };

    loadPdf().catch(() => {
      if (!isActive) return;
      setError("Could not load this PDF.");
      setIsLoading(false);
    });

    return () => {
      isActive = false;
      if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
    };
  }, [paper.status, paper.storage_path, reloadKey]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-2">
        <p className="truncate text-sm font-medium">{paper.title}</p>
        <p className="text-xs text-muted-foreground">
          {paper.status === "ready"
            ? `${formatFileSize(paper.file_size)} PDF`
            : "Finalizing upload..."}
        </p>
      </div>

      <div className="min-h-0 flex-1 bg-muted/30">
        {paper.status !== "ready" && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm">Finalizing upload...</p>
          </div>
        )}

        {paper.status === "ready" && isLoading && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm">Loading PDF...</p>
          </div>
        )}

        {paper.status === "ready" && error && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Could not load PDF</p>
              <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setReloadKey((key) => key + 1)}>
              Try again
            </Button>
          </div>
        )}

        {paper.status === "ready" && objectUrl && !error && (
          <iframe
            src={objectUrl}
            title={paper.title}
            className="h-full w-full"
          />
        )}
      </div>
    </div>
  );
}
