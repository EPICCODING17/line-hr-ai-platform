export const THEMES = ["light", "dark", "dark2"] as const;
export type Theme = (typeof THEMES)[number];

export const DENSITIES = ["sm", "compact", "md", "lg"] as const;
export type Density = (typeof DENSITIES)[number];

export const THEME_STORAGE_KEY = "hr-theme";
export const DENSITY_STORAGE_KEY = "hr-density";

export const THEME_LABEL: Record<Theme, string> = {
  light: "สว่าง",
  dark: "มืด",
  dark2: "มืด 2 โทน",
};

export const DENSITY_LABEL: Record<Density, string> = {
  sm: "เล็ก",
  compact: "กระชับ",
  md: "กลาง",
  lg: "ใหญ่",
};

/** Blocking script: set data-theme + data-density before first paint (no flash). */
export const themeInitScript = `
(function(){try{
  var t=localStorage.getItem("${THEME_STORAGE_KEY}");
  if(t!=="light"&&t!=="dark"&&t!=="dark2"){
    t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
  }
  document.documentElement.setAttribute("data-theme",t);
  var d=localStorage.getItem("${DENSITY_STORAGE_KEY}");
  if(["sm","compact","md","lg"].indexOf(d)<0)d="md";
  document.documentElement.setAttribute("data-density",d);
}catch(e){
  document.documentElement.setAttribute("data-theme","light");
  document.documentElement.setAttribute("data-density","md");
}})();
`;
