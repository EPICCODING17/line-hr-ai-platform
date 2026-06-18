"use client";

const LIFF_SDK = "https://static.line-scdn.net/liff/edge/2/sdk.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    liff?: any;
  }
}

let scriptPromise: Promise<void> | null = null;
const initPromises = new Map<string, Promise<void>>();

function loadLiffScript() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("line-liff-sdk") as HTMLScriptElement | null;
    if (existing) {
      if (window.liff) return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("โหลด LINE SDK ไม่สำเร็จ")), { once: true });
      return;
    }

    const s = document.createElement("script");
    s.id = "line-liff-sdk";
    s.src = LIFF_SDK;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("โหลด LINE SDK ไม่สำเร็จ"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export async function initLiff(liffId: string) {
  await loadLiffScript();
  const existing = initPromises.get(liffId);
  if (existing) return existing;
  const next = window.liff.init({ liffId });
  initPromises.set(liffId, next);
  return next;
}

export async function resolveLiffUserId(liffId: string | null, devUserId: string | null) {
  if (devUserId) return devUserId;
  if (!liffId) throw new Error("ยังไม่ได้ตั้งค่า LIFF ID ของบริษัท กรุณาติดต่อ HR");

  await initLiff(liffId);
  if (!window.liff.isLoggedIn()) {
    window.liff.login();
    return null;
  }

  const profile = await window.liff.getProfile();
  return profile.userId as string;
}
