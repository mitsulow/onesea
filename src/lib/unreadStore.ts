import { fetchUnreadTotal } from "@/lib/line";

/**
 * 未読数の共有ポーラー（1タブにつき1本だけ動く）。
 * 以前は BottomNav / AvatarMenu / ServiceDock が各々30秒間隔でポーリングし、
 * 1ユーザーがホームで毎30秒×3回=9本以上のクエリを投げていた（会員数に比例して爆発）。
 * ここに集約し、(1) 購読者が何人いても実クエリは1本、(2) タブ非表示中は止める、
 * (3) 間隔を45秒に、で実オリジン負荷を大きく減らす。
 */

let userId: string | null = null;
let latest = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;
const subs = new Set<(n: number) => void>();
const INTERVAL = 45000;

async function poll() {
  if (!userId || inFlight) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return; // 非表示中は打たない
  inFlight = true;
  try {
    const n = await fetchUnreadTotal(userId);
    latest = n;
    subs.forEach((cb) => cb(n));
  } catch {
    /* 一時的な失敗は次回に任せる */
  } finally {
    inFlight = false;
  }
}

function ensureRunning() {
  if (timer || typeof window === "undefined") return;
  timer = setInterval(poll, INTERVAL);
  window.addEventListener("focus", poll);
  document.addEventListener("visibilitychange", poll);
  window.addEventListener("onesea:unreadRefresh", poll);
}

/** 未読数を購読する。返り値で購読解除。userId が変わったら再購読すること。 */
export function subscribeUnread(uid: string, cb: (n: number) => void): () => void {
  userId = uid;
  subs.add(cb);
  cb(latest); // 手元の最新値を即返す
  ensureRunning();
  poll(); // 初回は即取得
  return () => {
    subs.delete(cb);
  };
}
