"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";

interface TopNavProps {
  readMode: boolean;
  onReadModeChange: (value: boolean) => void;
}

export function TopNav({ readMode, onReadModeChange }: TopNavProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
      <Link href="/app" className="text-sm font-medium tracking-tight">
        PaperTalk
      </Link>

      <div className="flex items-center gap-1">
        <Toggle
          pressed={readMode}
          onPressedChange={onReadModeChange}
          variant="outline"
          size="sm"
          aria-label="Read mode"
        >
          <BookOpen className="h-4 w-4" />
          <span className="hidden sm:inline">Read Mode</span>
        </Toggle>
        <ThemeToggle />
      </div>
    </header>
  );
}
