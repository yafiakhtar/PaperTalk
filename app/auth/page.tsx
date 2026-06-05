import { LandingFlow } from "@/components/landing/landing-flow";
import type { AuthMode } from "@/components/auth/auth-content";

interface AuthPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getMode(value: string | undefined): AuthMode | undefined {
  if (
    value === "signup" ||
    value === "login" ||
    value === "forgot-password" ||
    value === "update-password"
  ) {
    return value;
  }

  return undefined;
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const params = await searchParams;

  return (
    <LandingFlow
      initialPhase="auth"
      authMode={getMode(getParam(params.mode))}
      authError={getParam(params.error)}
      nextPath={getParam(params.next)}
    />
  );
}
