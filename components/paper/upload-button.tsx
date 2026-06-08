"use client";

import { useRef, type ChangeEvent, type ReactNode } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

interface UploadButtonProps {
  isUploading: boolean;
  onUpload: (file: File) => void;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  ariaLabel?: string;
  children?: ReactNode;
}

export function UploadButton({
  isUploading,
  onUpload,
  variant = "outline",
  size = "lg",
  className,
  ariaLabel = "Upload PDF",
  children
}: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file) {
      onUpload(file);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        variant={variant}
        size={size}
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className={className}
        aria-label={ariaLabel}
      >
        {children ??
          (isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Upload PDF
            </>
          ))}
      </Button>
    </>
  );
}
