import "../styles/globals.css";

export const metadata = {
  title: "PaperTalk",
  description: "Upload a paper and talk to it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface text-ink font-body antialiased">
        <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-full items-center justify-between px-4 sm:px-6">
            <span className="font-display text-lg tracking-tight text-ink">PaperTalk</span>
            <div className="w-8" />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
