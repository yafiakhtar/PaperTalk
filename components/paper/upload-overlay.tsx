"use client";

import { UploadButton } from "@/components/paper/upload-button";

interface UploadOverlayProps {
  isUploading: boolean;
  onUpload: (file: File) => void;
}

export function UploadOverlay({ isUploading, onUpload }: UploadOverlayProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <UploadButton
        isUploading={isUploading}
        onUpload={onUpload}
        className="gap-2 bg-background/80 backdrop-blur-sm"
      />
    </div>
  );
}
