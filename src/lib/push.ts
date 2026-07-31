"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * ホーム画面PWAの未読バッジ（Badging API）+ Web Push。
 * - iOS 16.4+: ホーム画面に追加 & 通知許可でアイコンに「③」が出る
 * - Android: 通知は届く（数字バッジはランチャー依存）
 */

export const VAPID_PUBLIC_KEY =
  "BAgTNqpjivdwkSRJUpg5rnzjHQ5k1UoQ67KLVQqNsakCha1MMqw10hjTTQq10QyR_h2dMWigz3V5NlsnER7lB-U";

type BadgeNav = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/** アイコンの数字バッジを更新（未対応環境では何もしない） */
export function setBadge(n: number) {
  try {
    const nav = navigator as BadgeNav;
    if (n > 0) nav.setAppBadge?.(n);
    else nav.clearAppBadge?.();
  } catch {}
}

export async function ensureSw(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

function b64ToU8(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const buf = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(await reg?.pushManager.getSubscription());
}

/** 通知許可を取り、購読をDBに保存（ユーザー操作から呼ぶこと） */
export async function enablePush(userId: string): Promise<"ok" | "denied" | "unsupported"> {
  if (!pushSupported()) return "unsupported";
  const reg = await ensureSw();
  if (!reg) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: b64ToU8(VAPID_PUBLIC_KEY),
  });
  const j = sub.toJSON();
  const supabase = createClient();
  await supabase.from("push_subscriptions").upsert({
    endpoint: sub.endpoint,
    user_id: userId,
    p256dh: j.keys?.p256dh ?? "",
    auth: j.keys?.auth ?? "",
  });
  return "ok";
}
