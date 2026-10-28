import type { Metadata, Viewport } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const sans = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "System One Playground",
  description: "Sandbox zum Testen von System-One-Modellen: Jev und lokale Modelle nebeneinander.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0d10" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <a
              href="#ergebnis"
              className="fixed top-3 left-3 z-50 -translate-y-16 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:translate-y-0"
            >
              Zum Ergebnis springen
            </a>
            {children}
            <Toaster position="bottom-left" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
