"use client";

import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UploadOverlayProps {
  isUploading: boolean;
  onUpload: () => void;
}

export function UploadOverlay({ isUploading, onUpload }: UploadOverlayProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <Button
        variant="outline"
        size="lg"
        onClick={onUpload}
        disabled={isUploading}
        className="gap-2 bg-background/80 backdrop-blur-sm"
      >
        {isUploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Upload PDF
          </>
        )}
      </Button>
    </div>
  );
}
