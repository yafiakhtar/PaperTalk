"use client";

import { useRouter } from "next/navigation";
import { TypingText } from "@/components/splash/typing-text";

export default function SplashPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <TypingText text="Welcome to PaperTalk" onComplete={() => router.push("/auth")} />
    </main>
  );
}
