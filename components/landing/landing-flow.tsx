"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthContent, type AuthMode } from "@/components/auth/auth-content";
import { TypingText } from "@/components/splash/typing-text";
import { cn } from "@/lib/utils";

const PAUSE_AFTER_TYPING_MS = 900;
const FADE_DURATION_MS = 700;

type Phase = "typing" | "auth";

interface LandingFlowProps {
  initialPhase?: Phase;
  authMode?: AuthMode;
  authError?: string;
  nextPath?: string;
}

export function LandingFlow({
  initialPhase = "typing",
  authMode,
  authError,
  nextPath
}: LandingFlowProps) {
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [showAuth, setShowAuth] = useState(initialPhase === "auth");

  const handleTypingComplete = useCallback(() => {
    window.setTimeout(() => setPhase("auth"), PAUSE_AFTER_TYPING_MS);
  }, []);

  useEffect(() => {
    if (phase !== "auth") return;

    const timer = window.setTimeout(() => setShowAuth(true), 50);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity ease-in-out",
          phase === "auth" ? "pointer-events-none opacity-0" : "opacity-100"
        )}
        style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
      >
        <TypingText text="Welcome to PaperTalk" speed={95} onComplete={handleTypingComplete} />
      </div>

      <div
        className={cn(
          "relative w-full transition-all ease-in-out",
          showAuth ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        )}
        style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
        aria-hidden={!showAuth}
      >
        <div className="mx-auto flex justify-center">
          <AuthContent initialMode={authMode} initialError={authError} nextPath={nextPath} />
        </div>
      </div>
    </main>
  );
}
