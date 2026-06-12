import type { Metadata, Viewport } from "next";
import "./liff.css";
import { LiffThemeLock } from "./theme-lock";

export const metadata: Metadata = {
  title: "HR — บริการพนักงาน",
  description: "ทำรายการ HR ผ่าน LINE",
};

// LIFF runs full-bleed inside the LINE in-app browser.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#3c8cf3",
};

// Nested under the root layout (which owns <html>/<body> + Prompt font).
// LIFF is a standalone surface: no app-shell, locked to the light theme so the
// form reads identically against LINE's chrome on every device.
export default function LiffLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="liff-body">
      <LiffThemeLock />
      {children}
    </div>
  );
}
