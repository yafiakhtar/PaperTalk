"use client";

import {
  type ComponentProps,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState
} from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { getAuthCallbackUrl } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

export type AuthMode = "signup" | "login" | "forgot-password" | "update-password";

interface AuthContentProps {
  className?: string;
  initialMode?: AuthMode;
  initialError?: string;
  nextPath?: string;
}

type LoadingState = "signup" | "login" | "forgot-password" | "update-password" | null;

const ERROR_MESSAGES: Record<string, string> = {
  callback: "We could not finish signing you in. Try the link again.",
  "missing-code": "That auth link is missing a code. Request a new link and try again."
};

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getSafeNextPath(value: string | undefined) {
  if (value?.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return "/app";
}

function getInitialError(errorCode: string | undefined) {
  if (!errorCode) return null;
  return ERROR_MESSAGES[errorCode] ?? "Something went wrong. Please try again.";
}

export function AuthContent({
  className,
  initialMode = "signup",
  initialError,
  nextPath
}: AuthContentProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loading, setLoading] = useState<LoadingState>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(() =>
    getInitialError(initialError)
  );
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState<string | null>(null);
  const [passwordUpdated, setPasswordUpdated] = useState(false);

  const safeNextPath = useMemo(() => getSafeNextPath(nextPath), [nextPath]);

  useEffect(() => {
    setMode(initialMode);
    setLoading(null);
    setErrorMessage(getInitialError(initialError));
    setNoticeMessage(null);
    setCheckEmail(null);
    setPasswordUpdated(false);
  }, [initialMode, initialError, nextPath]);

  const setAuthMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setLoading(null);
    setErrorMessage(null);
    setNoticeMessage(null);
    setCheckEmail(null);
    setPasswordUpdated(false);
  };

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = readFormValue(formData, "signup-email");
    const password = readFormValue(formData, "signup-password");

    setLoading("signup");
    setErrorMessage(null);
    setNoticeMessage(null);
    setCheckEmail(null);

    const supabase = getBrowserSupabaseClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthCallbackUrl()
      }
    });

    setLoading(null);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setCheckEmail(email);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = readFormValue(formData, "login-email");
    const password = readFormValue(formData, "login-password");

    setLoading("login");
    setErrorMessage(null);
    setNoticeMessage(null);

    const supabase = getBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(null);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.push(safeNextPath);
    router.refresh();
  };

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = readFormValue(formData, "reset-email");

    setLoading("forgot-password");
    setErrorMessage(null);
    setNoticeMessage(null);

    const supabase = getBrowserSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthCallbackUrl()
    });

    setLoading(null);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setNoticeMessage("If an account exists, reset instructions are on the way.");
  };

  const handleUpdatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = readFormValue(formData, "new-password");
    const confirmPassword = readFormValue(formData, "confirm-password");

    setLoading("update-password");
    setErrorMessage(null);
    setNoticeMessage(null);
    setPasswordUpdated(false);

    if (password !== confirmPassword) {
      setLoading(null);
      setErrorMessage("Passwords do not match.");
      return;
    }

    const supabase = getBrowserSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });

    setLoading(null);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await supabase.auth.signOut();
    setPasswordUpdated(true);
    toast.success("Password updated");
  };

  if (checkEmail) {
    return (
      <AuthFrame
        className={className}
        title="Check your email"
        subtitle={`We sent a confirmation link to ${checkEmail}.`}
        errorMessage={errorMessage}
      >
        <Button className="w-full" onClick={() => setAuthMode("login")}>
          Back to Log In
        </Button>
      </AuthFrame>
    );
  }

  if (mode === "forgot-password") {
    return (
      <AuthFrame
        className={className}
        title="Reset password"
        subtitle="Enter your email and we will send a reset link."
        errorMessage={errorMessage}
        noticeMessage={noticeMessage}
      >
        <form className="space-y-4" onSubmit={handleForgotPassword}>
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              name="reset-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <Button className="w-full" type="submit" disabled={loading === "forgot-password"}>
            {loading === "forgot-password" ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>
        <Button className="w-full" variant="ghost" onClick={() => setAuthMode("login")}>
          Back to Log In
        </Button>
      </AuthFrame>
    );
  }

  if (mode === "update-password") {
    return (
      <AuthFrame
        className={className}
        title="Update password"
        subtitle="Choose a new password for your account."
        errorMessage={errorMessage}
        noticeMessage={passwordUpdated ? "Your password has been updated." : noticeMessage}
      >
        {passwordUpdated ? (
          <Button
            className="w-full"
            type="button"
            onClick={() => router.replace("/auth?mode=login")}
          >
            Back to Log In
          </Button>
        ) : (
          <form className="space-y-4" onSubmit={handleUpdatePassword}>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <PasswordInput
                id="new-password"
                name="new-password"
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <PasswordInput
                id="confirm-password"
                name="confirm-password"
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <Button className="w-full" type="submit" disabled={loading === "update-password"}>
              {loading === "update-password" ? "Updating..." : "Update Password"}
            </Button>
          </form>
        )}
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      className={className}
      title="PaperTalk"
      subtitle="Sign in to continue"
      errorMessage={errorMessage}
      noticeMessage={noticeMessage}
    >
      <Tabs value={mode} onValueChange={(value) => setAuthMode(value as AuthMode)} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signup">Sign Up</TabsTrigger>
          <TabsTrigger value="login">Log In</TabsTrigger>
        </TabsList>

        <TabsContent value="signup" className="mt-4">
          <form className="space-y-4" onSubmit={handleSignUp}>
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                name="signup-email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <PasswordInput
                id="signup-password"
                name="signup-password"
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <Button className="w-full" type="submit" disabled={loading === "signup"}>
              {loading === "signup" ? "Creating Account..." : "Create Account"}
            </Button>
          </form>
          <div className="mt-3 h-9" aria-hidden="true" />
        </TabsContent>

        <TabsContent value="login" className="mt-4">
          <form className="space-y-4" onSubmit={handleLogin}>
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                name="login-email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <PasswordInput
                id="login-password"
                name="login-password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
            <Button className="w-full" type="submit" disabled={loading === "login"}>
              {loading === "login" ? "Logging In..." : "Log In"}
            </Button>
          </form>
          <Button
            className="mt-3 w-full"
            variant="ghost"
            onClick={() => setAuthMode("forgot-password")}
          >
            Forgot password?
          </Button>
        </TabsContent>
      </Tabs>
    </AuthFrame>
  );
}

function PasswordInput({ className, ...props }: Omit<ComponentProps<typeof Input>, "type">) {
  const [isVisible, setIsVisible] = useState(false);
  const Icon = isVisible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input
        {...props}
        type={isVisible ? "text" : "password"}
        className={cn("pr-10", className)}
      />
      <Button
        type="button"
        size="icon"
        className="absolute right-2 top-1/2 h-5 w-5 -translate-y-1/2 rounded-none bg-transparent p-0 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
        aria-label={isVisible ? "Hide password" : "Show password"}
        aria-pressed={isVisible}
        onClick={() => setIsVisible((value) => !value)}
      >
        <Icon className="h-4 w-4" />
      </Button>
    </div>
  );
}

function AuthFrame({
  children,
  className,
  title,
  subtitle,
  errorMessage,
  noticeMessage
}: {
  children: ReactNode;
  className?: string;
  title: string;
  subtitle: string;
  errorMessage?: string | null;
  noticeMessage?: string | null;
}) {
  return (
    <div className={cn("w-full max-w-sm space-y-6", className)}>
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-medium tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {(errorMessage || noticeMessage) && (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            errorMessage
              ? "border-destructive/40 text-destructive"
              : "border-border text-muted-foreground"
          )}
        >
          {errorMessage || noticeMessage}
        </div>
      )}

      {children}
    </div>
  );
}
