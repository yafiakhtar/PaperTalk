import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Instrument_Serif, Work_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "@/app/globals.css";

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
  display: "swap"
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
  display: "swap"
});

export const metadata: Metadata = {
  title: "PaperTalk",
  description: "Upload research papers and talk to an AI assistant."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${workSans.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <body className={workSans.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="bottom-center" theme="system" />
        </ThemeProvider>
      </body>
    </html>
  );
}
