import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { getServerSupabaseClient } from "@/lib/supabase/server";

export default async function AppPage() {
  const supabase = await getServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/app");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <WorkspaceShell
      userId={user.id}
      userEmail={user.email ?? null}
      userName={profile?.username ?? null}
    />
  );
}
