import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import type { Paper } from "@/lib/papers";

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

  const { data: papers } = await supabase
    .from("papers")
    .select("id,title,storage_path,file_size,mime_type,status,created_at,updated_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <WorkspaceShell
      userId={user.id}
      userEmail={user.email ?? null}
      userName={profile?.username ?? null}
      initialPapers={(papers ?? []) as Paper[]}
    />
  );
}
