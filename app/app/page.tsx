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

  return <WorkspaceShell />;
}
