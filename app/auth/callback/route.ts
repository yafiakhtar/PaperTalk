import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase/server";

function getSafeNextPath(value: string | null) {
  if (value?.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return "/app";
}

function redirectToAuth(requestUrl: URL, error: string) {
  const redirectUrl = new URL("/auth", requestUrl.origin);
  redirectUrl.searchParams.set("error", error);

  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return redirectToAuth(requestUrl, "missing-code");
  }

  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectToAuth(requestUrl, "callback");
  }

  const redirectType =
    (data as { redirectType?: string | null }).redirectType ||
    requestUrl.searchParams.get("type");

  if (redirectType === "recovery") {
    return NextResponse.redirect(
      new URL("/auth?mode=update-password", requestUrl.origin)
    );
  }

  return NextResponse.redirect(
    new URL(getSafeNextPath(requestUrl.searchParams.get("next")), requestUrl.origin)
  );
}
