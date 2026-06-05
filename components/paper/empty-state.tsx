export function EmptyState() {
  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <svg
        viewBox="0 0 120 150"
        className="h-40 w-32 text-muted-foreground/40"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <rect x="20" y="10" width="80" height="110" rx="2" />
        <line x1="32" y1="35" x2="88" y2="35" />
        <line x1="32" y1="50" x2="88" y2="50" />
        <line x1="32" y1="65" x2="72" y2="65" />
        <line x1="32" y1="80" x2="88" y2="80" />
        <line x1="32" y1="95" x2="64" y2="95" />
        <path d="M60 120 L50 140 L70 140 Z" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
