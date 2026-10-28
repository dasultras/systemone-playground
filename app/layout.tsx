import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Decision Playground",
  description: "Sandbox zum Testen von System-One-Modellen: Jev und lokale Modelle nebeneinander.",
};

const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
