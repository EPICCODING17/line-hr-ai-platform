import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { themeInitScript } from "@/lib/theme";

const prompt = Prompt({
  subsets: ["latin", "thai"],
  // Only the weights the UI actually uses (400 body · 500 medium · 600 heading ·
  // 700 display). Weight 300 was never referenced and the Thai glyph files are
  // heavy, so dropping it trims the largest blocking font payload.
  weight: ["400", "500", "600", "700"],
  variable: "--font-prompt",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LINE HR AI Platform",
  description: "Multi-tenant HR assistant on LINE — Leave · OT · Attendance · Documents",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={prompt.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
