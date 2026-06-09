"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

interface AuthCallbackContentProps {
  nextPath: string;
}

function getHashParam(name: string) {
  if (typeof window === "undefined" || !window.location.hash) return null;

  return new URLSearchParams(window.location.hash.slice(1)).get(name);
}

export function AuthCallbackContent({ nextPath }: AuthCallbackContentProps) {
  const router = useRouter();
  const [message, setMessage] = useState("Finishing sign in...");

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    let handled = false;

    const finish = (path: string) => {
      if (handled) return;
      handled = true;
      router.replace(path);
      router.refresh();
    };

    const searchParams = new URLSearchParams(window.location.search);
    const urlError = searchParams.get("error") || getHashParam("error");
    const callbackType = searchParams.get("type") || getHashParam("type");

    if (urlError) {
      finish("/auth?error=callback");
      return;
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        finish("/auth?mode=update-password");
      }

      if (event === "SIGNED_IN") {
        finish(nextPath);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (handled) return;

        if (error) {
          finish("/auth?error=callback");
          return;
        }

        if (callbackType === "recovery") {
          finish("/auth?mode=update-password");
          return;
        }

        if (data.session) {
          finish(nextPath);
        }
      })
      .catch(() => {
        finish("/auth?error=callback");
      });

    const fallbackTimer = window.setTimeout(() => {
      if (handled) return;
      setMessage("This auth link could not be completed. Request a new link and try again.");
      finish("/auth?error=callback");
    }, 10000);

    return () => {
      window.clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, [nextPath, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-2 text-center">
        <h1 className="font-brand text-2xl tracking-normal">PaperTalk</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}
