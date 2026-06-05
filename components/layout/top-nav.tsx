"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Toggle } from "@/components/ui/toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

interface TopNavProps {
  readMode: boolean;
  onReadModeChange: (value: boolean) => void;
}

export function TopNav({ readMode, onReadModeChange }: TopNavProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = getBrowserSupabaseClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast.error(error.message);
      return;
    }

    router.push("/auth");
    router.refresh();
  };

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
        <Button
          variant="ghost"
          size="icon"
          aria-label="Sign out"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
