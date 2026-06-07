"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Clock, FileText, LogOut, MessageSquarePlus, Settings } from "lucide-react";
import { toast } from "sonner";
import { MOCK_PAPERS, type MockPaper } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

interface SidebarProps {
  readMode: boolean;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  selectedPaperId: string | null;
  onSelectPaper: (paperId: string) => void;
}

const USERNAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,31}$/;

const NAV_ITEMS = [
  { id: "settings", label: "Settings", icon: Settings },
  { id: "history", label: "History", icon: Clock },
  { id: "papers", label: "Papers", icon: FileText },
  { id: "new-chat", label: "New Chat", icon: MessageSquarePlus }
] as const;

function getDefaultUsername(email: string | null) {
  if (!email) return "Profile";
  return email.split("@")[0] || "Profile";
}

function getProfileInitial(username: string) {
  return username.charAt(0).toUpperCase();
}

export function Sidebar({
  readMode,
  userId,
  userEmail,
  userName,
  selectedPaperId,
  onSelectPaper
}: SidebarProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const defaultUsername = getDefaultUsername(userEmail);
  const initialUsername = userName?.trim() || defaultUsername;
  const [username, setUsername] = useState(initialUsername);
  const [draftUsername, setDraftUsername] = useState(initialUsername);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const profileInitial = getProfileInitial(username);

  useEffect(() => {
    setUsername(initialUsername);
    setDraftUsername(initialUsername);
  }, [initialUsername]);

  const handleNavClick = (id: string) => {
    if (id !== "papers") {
      toast("Coming soon");
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);

    const supabase = getBrowserSupabaseClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setIsSigningOut(false);
      toast.error(error.message);
      return;
    }

    router.push("/auth");
    router.refresh();
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextUsername = draftUsername.trim();
    if (!nextUsername) {
      toast.error("Username cannot be empty");
      return;
    }

    if (!USERNAME_PATTERN.test(nextUsername)) {
      toast.error("Use 1-32 letters, numbers, underscores, dots, or hyphens.");
      return;
    }

    setIsSavingProfile(true);

    const supabase = getBrowserSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          username: nextUsername
        },
        { onConflict: "id" }
      )
      .select("username")
      .single();

    setIsSavingProfile(false);

    if (error) {
      const isDuplicateUsername =
        error.code === "23505" || error.message.toLowerCase().includes("duplicate");

      toast.error(
        isDuplicateUsername ? "That username is already taken." : error.message
      );
      return;
    }

    const savedUsername = data.username;

    setUsername(savedUsername);
    setDraftUsername(savedUsername);
    toast.success("Username updated");
    router.refresh();
  };

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-border transition-[width] duration-300",
        readMode ? "w-12" : "w-[200px]"
      )}
    >
      <nav className="flex flex-col gap-1 p-2">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant="ghost"
            className={cn(
              "justify-start gap-2 px-2",
              readMode && "justify-center px-0"
            )}
            aria-label={readMode ? label : undefined}
            onClick={() => handleNavClick(id)}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!readMode && <span className="truncate text-sm">{label}</span>}
          </Button>
        ))}
      </nav>

      {!readMode && (
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto border-t border-border p-2">
          <p className="px-2 py-1 text-xs text-muted-foreground">Papers</p>
          {MOCK_PAPERS.map((paper) => (
            <PaperItem
              key={paper.id}
              paper={paper}
              selected={selectedPaperId === paper.id}
              onSelect={() => onSelectPaper(paper.id)}
            />
          ))}
        </div>
      )}

      <div
        className={cn(
          "mt-auto border-t border-border p-2",
          readMode ? "space-y-1" : "space-y-2"
        )}
      >
        <div className="group relative">
          <div
            tabIndex={0}
            className={cn(
              "flex min-h-10 items-center rounded-md outline-none transition-colors hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring",
              readMode ? "justify-center" : "gap-2 px-2"
            )}
            aria-label="Profile"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-medium">
              {profileInitial}
            </div>
            {!readMode && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{username}</p>
              </div>
            )}
          </div>

          <div
            className={cn(
              "pointer-events-none absolute z-30 w-[260px] translate-y-1 rounded-md border border-border bg-background p-3 opacity-0 shadow-lg transition-all group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100",
              readMode ? "bottom-0 left-full" : "bottom-full left-0"
            )}
          >
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-medium">
                {profileInitial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{username}</p>
                {userEmail && (
                  <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                )}
              </div>
            </div>

            <form className="space-y-2" onSubmit={handleProfileSubmit}>
              <label
                className="block text-xs font-medium text-muted-foreground"
                htmlFor="profile-username"
              >
                Username
              </label>
              <Input
                id="profile-username"
                value={draftUsername}
                maxLength={32}
                onChange={(event) => setDraftUsername(event.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSavingProfile || draftUsername.trim() === username}
                >
                  {isSavingProfile ? "Saving" : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>

        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2 px-2",
            readMode && "justify-center px-0"
          )}
          disabled={isSigningOut}
          aria-label={readMode ? "Sign out" : undefined}
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!readMode && <span className="truncate text-sm">Sign out</span>}
        </Button>
      </div>
    </aside>
  );
}

function PaperItem({
  paper,
  selected,
  onSelect
}: {
  paper: MockPaper;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted",
        selected && "border-l-2 border-foreground bg-muted pl-[6px]"
      )}
    >
      <span className="line-clamp-2">{paper.title}</span>
      {paper.status === "processing" && (
        <span className="mt-0.5 block text-xs text-muted-foreground">Processing…</span>
      )}
    </button>
  );
}
