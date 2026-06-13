"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/components/theme-provider";
import { CommandPalette } from "@/components/command-palette";
import {
  THEMES, DENSITIES, THEME_LABEL, DENSITY_LABEL, type Theme, type Density,
} from "@/lib/theme";
import {
  IconDashboard, IconUsers, IconInbox, IconSettings, IconLeave, IconClock,
  IconCheckin, IconDocument, IconBuilding, IconBadge, IconPanelLeft, IconChevronLeft,
  IconPlus, IconBell, IconSearch, IconMenu, IconSun, IconMoon, IconMoonStars,
  IconPalette, IconSliders, IconUser, IconLogout,
} from "@/components/icons";

type Item = { label: string; Icon: (p: { className?: string }) => React.ReactNode; href?: string; count?: string; soon?: boolean };
type Cat = { key: string; label: string; Icon: (p: { className?: string }) => React.ReactNode; route?: string };

const RAIL: Cat[] = [
  { key: "overview", label: "ภาพรวม", Icon: IconDashboard, route: "/dashboard" },
  { key: "people", label: "บุคคล", Icon: IconUsers, route: "/dashboard/employees" },
  { key: "requests", label: "คำขอ", Icon: IconInbox, route: "/dashboard/leave" },
  { key: "settings", label: "ตั้งค่า", Icon: IconSettings },
];

const SIDEBAR: Record<string, { title: string; items: Item[] }> = {
  people: {
    title: "บุคคล",
    items: [
      { label: "พนักงาน", Icon: IconUsers, href: "/dashboard/employees" },
      { label: "แผนก", Icon: IconBuilding, href: "/dashboard/departments" },
      { label: "ตำแหน่ง", Icon: IconBadge, href: "/dashboard/positions" },
    ],
  },
  requests: {
    title: "คำขอ",
    items: [
      { label: "การลา", Icon: IconLeave, href: "/dashboard/leave" },
      { label: "OT", Icon: IconClock, href: "/dashboard/ot" },
      { label: "ลงเวลา", Icon: IconCheckin, soon: true },
      { label: "เอกสาร", Icon: IconDocument, soon: true },
    ],
  },
  settings: {
    title: "ตั้งค่า",
    items: [
      { label: "ข้อมูลบริษัท", Icon: IconBuilding, soon: true },
      { label: "นโยบาย", Icon: IconSettings, soon: true },
      { label: "วันหยุด", Icon: IconLeave, soon: true },
    ],
  },
};

const TITLES: Record<string, string> = {
  "/dashboard": "ภาพรวม",
  "/dashboard/employees": "พนักงาน",
  "/dashboard/departments": "แผนก",
  "/dashboard/positions": "ตำแหน่ง",
  "/dashboard/leave": "การลา",
  "/dashboard/ot": "OT",
};

function catFromPath(path: string): string {
  if (/\/dashboard\/(employees|departments|positions)/.test(path)) return "people";
  if (path === "/dashboard") return "overview";
  if (/\/(leave|ot|attendance|documents)/.test(path)) return "requests";
  if (path.startsWith("/dashboard/settings")) return "settings";
  return "overview";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, density, setTheme, setDensity } = useTheme();

  const [cat, setCat] = useState("overview");
  const [sbOpen, setSbOpen] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [cmdk, setCmdk] = useState(false);

  useEffect(() => {
    const c = catFromPath(pathname);
    setCat(c);
    setSbOpen(c !== "overview");
    setDrawer(false);
    setProfileOpen(false);
  }, [pathname]);

  // Ctrl/⌘ + K toggles the command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdk((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const title = TITLES[pathname] ?? "ภาพรวม";
  const sidebar = SIDEBAR[cat];

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function onRail(c: Cat) {
    setCat(c.key);
    if (c.route) router.push(c.route);
    else setSbOpen(true);
    setDrawer(false);
  }

  const railNodes = useMemo(
    () =>
      RAIL.map((c) => {
        const active = cat === c.key;
        return (
          <button
            key={c.key}
            className={`rail-btn${active ? " active" : ""}`}
            onClick={() => onRail(c)}
            title={c.label}
            aria-current={active ? "page" : undefined}
          >
            <c.Icon className="" />
            <span>{c.label}</span>
          </button>
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cat],
  );

  return (
    <div className="shell">
      {/* RAIL */}
      <nav className={`rail${drawer ? " drawer-open" : ""}`} aria-label="เมนูหลัก">
        <div className="rail-logo">HR</div>
        <div className="rail-items">{railNodes}</div>
        <div className="rail-foot">
          <button className="rail-btn" onClick={() => setSbOpen((v) => !v)} title="ย่อ/ขยายเมนู">
            <IconPanelLeft className="" />
            <span>เมนู</span>
          </button>
        </div>
      </nav>

      {/* SIDEBAR */}
      <aside
        className={`sidebar${drawer ? " drawer-open" : ""}`}
        data-open={sbOpen && !!sidebar}
        aria-label="เมนูย่อย"
      >
        <div className="sb-head">
          <div className="sb-ws">
            <div className="avatar">D</div>
            <div style={{ minWidth: 0 }}>
              <div className="nm">Demo Co</div>
              <div className="sub">แพ็กเกจ Free</div>
            </div>
          </div>
          <button className="btn-icon" style={{ height: 30, width: 30 }} onClick={() => setSbOpen(false)} aria-label="ปิดเมนูย่อย">
            <IconChevronLeft className="" />
          </button>
        </div>
        <div className="sb-body">
          {sidebar && (
            <div className="sb-group">
              <div className="sb-glabel">{sidebar.title}</div>
              {sidebar.items.map((it) => {
                const active = it.href ? pathname === it.href : false;
                const cls = `sb-item${active ? " active" : ""}`;
                const inner = (
                  <>
                    <it.Icon className="" />
                    <span className="sb-txt">{it.label}</span>
                    {it.count && <span className="count">{it.count}</span>}
                    {it.soon && <span className="count">เร็วๆ นี้</span>}
                  </>
                );
                return it.href ? (
                  <button key={it.label} className={cls} onClick={() => router.push(it.href!)}>{inner}</button>
                ) : (
                  <button key={it.label} className={cls} style={{ opacity: 0.6, cursor: "default" }} aria-disabled>{inner}</button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* MAIN */}
      <div className="main">
        <header className="navbar">
          <button className="btn-icon mob-only" onClick={() => setDrawer(true)} aria-label="เปิดเมนู">
            <IconMenu className="" />
          </button>
          <button className="btn-icon mob-hide" onClick={() => setSbOpen((v) => !v)} aria-label="สลับเมนูย่อย" title="สลับเมนูย่อย">
            <IconPanelLeft className="" />
          </button>
          <div className="nav-title">
            <span className="t">{title}</span>
            <span className="b">Demo Co / {title}</span>
          </div>

          <div
            className="global-search mob-hide"
            role="button"
            tabIndex={0}
            aria-label="ค้นหาเมนูและคำสั่ง"
            onClick={() => setCmdk(true)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCmdk(true); } }}
          >
            <IconSearch className="" />
            <input placeholder="ค้นหาเมนูหรือคำสั่ง…" readOnly style={{ pointerEvents: "none" }} />
            <span className="kbd">Ctrl K</span>
          </div>

          <div className="nav-right">
            <button className="btn-icon mob-only" onClick={() => setCmdk(true)} aria-label="ค้นหา"><IconSearch className="" /></button>
            <button className="btn btn-primary"><IconPlus className="" /> <span className="mob-hide">สร้าง</span></button>
            <button className="btn-icon" aria-label="การแจ้งเตือน" title="การแจ้งเตือน">
              <IconBell className="" />
              <span className="nav-badge">2</span>
            </button>
            <div style={{ position: "relative" }}>
              <button className="nav-profile" onClick={() => setProfileOpen((v) => !v)} aria-label="โปรไฟล์">
                <span className="np-av">ป<span className="np-online" /></span>
                <span className="np-meta"><span className="np-name">Pong</span><span className="np-status">ออนไลน์</span></span>
              </button>

              {profileOpen && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 69 }} onClick={() => setProfileOpen(false)} />
                  <div className="pop" style={{ width: 300, right: 0, top: "calc(100% + 8px)" }} role="menu">
                    <div className="prof-head">
                      <div className="avatar">ป</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>Pong</div>
                        <div style={{ fontSize: ".78em", color: "var(--text-faint)" }}>admin@demo.co</div>
                        <span className="chip chip-info" style={{ marginTop: 4 }}>Company Admin</span>
                      </div>
                    </div>

                    <div className="appr">
                      <span className="appr-lbl"><IconPalette className="" /> ธีม</span>
                      <div className="seg grid3">
                        {THEMES.map((t) => (
                          <button key={t} className={theme === t ? "on" : ""} onClick={() => setTheme(t as Theme)} title={THEME_LABEL[t]}>
                            {t === "light" ? <IconSun className="" /> : t === "dark" ? <IconMoon className="" /> : <IconMoonStars className="" />}
                            <span>{THEME_LABEL[t]}</span>
                          </button>
                        ))}
                      </div>
                      <span className="appr-lbl" style={{ marginTop: 12 }}><IconSliders className="" /> ความหนาแน่น</span>
                      <div className="seg grid4">
                        {DENSITIES.map((d) => (
                          <button key={d} className={density === d ? "on" : ""} onClick={() => setDensity(d as Density)}>{DENSITY_LABEL[d]}</button>
                        ))}
                      </div>
                    </div>

                    <div className="menu-sep" />
                    <div style={{ padding: 6 }}>
                      <button className="menu-item"><IconUser className="" /> โปรไฟล์ของฉัน</button>
                      <button className="menu-item" onClick={() => router.push("/dashboard")}><IconSettings className="" /> ตั้งค่าบัญชี</button>
                      <div className="menu-sep" />
                      <button className="menu-item danger" onClick={logout}><IconLogout className="" /> ออกจากระบบ</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="content">
          <div className="page">{children}</div>
        </main>
      </div>

      {/* command palette */}
      <CommandPalette open={cmdk} onClose={() => setCmdk(false)} />

      {/* mobile drawer scrim */}
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}

      {/* mobile bottom nav */}
      <nav className="mobnav" aria-label="เมนูมือถือ">
        {RAIL.map((c) => (
          <button key={c.key} className={cat === c.key ? "active" : ""} onClick={() => onRail(c)}>
            <span className="mn-ic"><c.Icon className="" /></span>
            <span>{c.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
