import type { SVGProps } from "react";

/* Minimal, clean stroke icons (currentColor). Not from an icon library.
   Size is driven by the `.icn` class (→ var(--icon)) so icons scale with the
   global density control. Pass a className/style to override per-use. */
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type P = SVGProps<SVGSVGElement>;
const I = ({ className, ...rest }: P, paths: React.ReactNode) => (
  <svg {...base} className={["icn", className].filter(Boolean).join(" ")} {...rest}>
    {paths}
  </svg>
);

export const IconDashboard = (p: P) =>
  I(p, <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>);

export const IconUsers = (p: P) =>
  I(p, <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3 3 0 0 1 0 5.6" /><path d="M17.5 19a5 5 0 0 0-3-4.6" /></>);

export const IconLeave = (p: P) =>
  I(p, <><rect x="3.5" y="4.5" width="17" height="16" rx="2.5" /><path d="M3.5 9h17M8 3v3M16 3v3" /><path d="m9 14 2 2 4-4" /></>);

export const IconClock = (p: P) =>
  I(p, <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" /></>);

export const IconCheckin = (p: P) =>
  I(p, <><path d="M12 21s-6.5-5.3-6.5-10.2A6.5 6.5 0 0 1 12 4a6.5 6.5 0 0 1 6.5 6.8C18.5 15.7 12 21 12 21Z" /><circle cx="12" cy="10.5" r="2.3" /></>);

export const IconDocument = (p: P) =>
  I(p, <><path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v4h4M8.5 13h7M8.5 16.5h7" /></>);

export const IconHistory = (p: P) =>
  I(p, <><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5V9H8" /><path d="M12 8v4.2l2.8 1.6" /></>);

export const IconSettings = (p: P) =>
  I(p, <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6" /></>);

export const IconMenu = (p: P) => I(p, <><path d="M4 7h16M4 12h16M4 17h16" /></>);
export const IconClose = (p: P) => I(p, <><path d="M6 6l12 12M18 6 6 18" /></>);
export const IconBell = (p: P) =>
  I(p, <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M9.5 19a2.5 2.5 0 0 0 5 0" /></>);
export const IconSearch = (p: P) =>
  I(p, <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.5-3.5" /></>);

export const IconSun = (p: P) =>
  I(p, <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19" /></>);
export const IconMoon = (p: P) =>
  I(p, <><path d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z" /></>);
export const IconMoonStars = (p: P) =>
  I(p, <><path d="M19 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 19 14.5Z" /><path d="M18 3.5v3M16.5 5h3" /></>);

export const IconPanelLeft = (p: P) =>
  I(p, <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>);
export const IconChevronLeft = (p: P) => I(p, <><path d="m15 18-6-6 6-6" /></>);
export const IconPlus = (p: P) => I(p, <><path d="M12 5v14M5 12h14" /></>);
export const IconCheck = (p: P) => I(p, <><path d="M20 6 9 17l-5-5" /></>);
export const IconPalette = (p: P) =>
  I(p, <><path d="M12 3a9 9 0 1 0 0 18 2 2 0 0 0 2-2 2 2 0 0 0-.5-1.3 2 2 0 0 1 1.5-3.2H17a4 4 0 0 0 4-4 9 9 0 0 0-9-7.5Z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="14.5" cy="7.5" r="1" /></>);
export const IconSliders = (p: P) =>
  I(p, <><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="14" cy="18" r="2" /></>);
export const IconUser = (p: P) =>
  I(p, <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>);
export const IconLogout = (p: P) =>
  I(p, <><path d="m16 17 5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /></>);
export const IconInbox = (p: P) =>
  I(p, <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1Z" /></>);
export const IconBuilding = (p: P) =>
  I(p, <><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-3h4v3" /></>);
export const IconBadge = (p: P) =>
  I(p, <><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m9 12 2 2 4-4" /></>);
export const IconEye = (p: P) =>
  I(p, <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>);
export const IconPencil = (p: P) =>
  I(p, <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>);
export const IconCopy = (p: P) =>
  I(p, <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></>);
export const IconArchive = (p: P) =>
  I(p, <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" /></>);
export const IconTrash = (p: P) =>
  I(p, <><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>);
export const IconExport = (p: P) =>
  I(p, <><path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></>);
export const IconMail = (p: P) =>
  I(p, <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a2 2 0 0 1-2.06 0L2 7" /></>);
export const IconLock = (p: P) =>
  I(p, <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>);
export const IconEyeOff = (p: P) =>
  I(p, <><path d="M10.7 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.2M6.6 6.6A18 18 0 0 0 2 12s3.5 7 10 7a10.7 10.7 0 0 0 5.4-1.4" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="m2 2 20 20" /></>);
export const IconArrowRight = (p: P) => I(p, <><path d="M5 12h14M12 5l7 7-7 7" /></>);
