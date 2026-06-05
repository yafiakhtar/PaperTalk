"use client";

import { Clock, FileText, MessageSquarePlus, Settings } from "lucide-react";
import { toast } from "sonner";
import { MOCK_PAPERS, type MockPaper } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  readMode: boolean;
  selectedPaperId: string | null;
  onSelectPaper: (paperId: string) => void;
}

const NAV_ITEMS = [
  { id: "settings", label: "Settings", icon: Settings },
  { id: "history", label: "History", icon: Clock },
  { id: "papers", label: "Papers", icon: FileText },
  { id: "new-chat", label: "New Chat", icon: MessageSquarePlus }
] as const;

export function Sidebar({ readMode, selectedPaperId, onSelectPaper }: SidebarProps) {
  const handleNavClick = (id: string) => {
    if (id !== "papers") {
      toast("Coming soon");
    }
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
