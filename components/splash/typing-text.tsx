"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TypingTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export function TypingText({ text, speed = 95, onComplete, className }: TypingTextProps) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let index = 0;
    const interval = window.setInterval(() => {
      index += 1;
      setDisplayed(text.slice(0, index));

      if (index >= text.length) {
        window.clearInterval(interval);
        setDone(true);
        onComplete?.();
      }
    }, speed);

    return () => window.clearInterval(interval);
  }, [text, speed, onComplete]);

  return (
    <p className={cn("text-2xl font-medium tracking-tight md:text-3xl", className)}>
      {displayed}
      {!done && <span className="ml-0.5 inline-block w-[2px] animate-pulse bg-foreground">|</span>}
    </p>
  );
}
