"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TypingTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

const BRAND_WORD = "PaperTalk";

function renderDisplayedText(displayed: string, fullText: string) {
  const brandStart = fullText.indexOf(BRAND_WORD);
  if (brandStart === -1 || displayed.length <= brandStart) return displayed;

  const brandEnd = brandStart + BRAND_WORD.length;
  const prefix = displayed.slice(0, brandStart);
  const brand = displayed.slice(brandStart, Math.min(displayed.length, brandEnd));
  const suffix = displayed.slice(brandEnd);

  return (
    <>
      {prefix}
      <span className="font-brand font-normal">{brand}</span>
      {suffix}
    </>
  );
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
    <p className={cn("text-2xl font-medium tracking-normal md:text-3xl", className)}>
      {renderDisplayedText(displayed, text)}
      {!done && (
        <span
          className="ml-1 inline-block h-[0.8em] w-[2px] animate-pulse bg-foreground align-baseline"
          aria-hidden="true"
        />
      )}
    </p>
  );
}
