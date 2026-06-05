"use client";

interface PdfViewerProps {
  title: string;
}

export function PdfViewer({ title }: PdfViewerProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-2">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">Mock PDF viewer</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-4 border border-border bg-background p-8 shadow-sm">
          <h2 className="text-lg font-medium">{title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Abstract — This is a placeholder PDF view. In a future phase, your uploaded research
            paper will render here with page navigation and citations linked to the assistant.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
            exercitation ullamco laboris.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat
            nulla pariatur. Excepteur sint occaecat cupidatat non proident.
          </p>
        </div>
      </div>
    </div>
  );
}
