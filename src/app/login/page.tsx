"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/components/theme-provider";
import { THEMES, type Theme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import {
  IconMail, IconLock, IconEye, IconEyeOff, IconArrowRight, IconCheck,
  IconSun, IconMoon, IconMoonStars,
} from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [email, setEmail] = useState("admin@demo.co");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ThemeIcon = theme === "light" ? IconSun : theme === "dark" ? IconMoon : IconMoonStars;
  const cycleTheme = () => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length] as Theme);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div className="login-logo">HR</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16, lineHeight: 1.15 }}>LINE HR AI</div>
              <div style={{ fontSize: 12, color: "var(--text-faint)" }}>ระบบ HR ผ่าน LINE</div>
            </div>
          </div>
          <button className="btn-icon" onClick={cycleTheme} aria-label="สลับธีม" title="สลับธีม">
            <ThemeIcon className="" />
          </button>
        </div>

        <h1 style={{ fontSize: 23, fontWeight: 600, margin: "0 0 6px" }}>เข้าสู่ระบบ</h1>
        <p style={{ color: "var(--text-muted)", fontSize: ".92em", margin: "0 0 26px" }}>
          ยินดีต้อนรับกลับมา กรุณากรอกข้อมูลเพื่อเข้าใช้งาน
        </p>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="field-label" htmlFor="email">อีเมล</label>
            <div style={{ position: "relative" }}>
              <span className="in-icon"><IconMail className="" /></span>
              <input id="email" className="input" style={{ paddingLeft: 38 }} type="email" required
                value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.co" autoComplete="username" />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="password">รหัสผ่าน</label>
            <div style={{ position: "relative" }}>
              <span className="in-icon"><IconLock className="" /></span>
              <input id="password" className="input" style={{ paddingLeft: 38, paddingRight: 42 }}
                type={show ? "text" : "password"} required value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              <button type="button" className="btn-icon" onClick={() => setShow((v) => !v)}
                style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", height: 32, width: 32 }}
                aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>
                {show ? <IconEyeOff className="" /> : <IconEye className="" />}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: ".88em", color: "var(--text-muted)" }}>
              <span className={`cb${remember ? " on" : ""}`} onClick={() => setRemember((v) => !v)} role="checkbox" aria-checked={remember}>
                <IconCheck className="" />
              </span>
              จดจำฉันไว้
            </label>
            <a href="#" style={{ fontSize: ".88em", color: "var(--primary)", fontWeight: 500 }}>ลืมรหัสผ่าน?</a>
          </div>

          {error && <p className="helper err" role="alert">{error}</p>}

          <Button type="submit" loading={loading} style={{ width: "100%", marginTop: 6 }}>
            เข้าสู่ระบบ <IconArrowRight className="" />
          </Button>

          <p style={{ textAlign: "center", fontSize: ".85em", color: "var(--text-faint)", margin: "4px 0 0" }}>
            ยังไม่มีบัญชี? <a href="#" style={{ color: "var(--primary)", fontWeight: 500 }}>สมัครใช้งาน</a>
          </p>
        </form>
      </div>
    </div>
  );
}
