import { readTecho } from "@/lib/techoStore";

/**
 * 手帳のアラーム — 予定にアラームを付けると、その時刻に通知を鳴らす。
 * サーバー要らずの端末内アラーム: 手帳を開いている/PWAがバックグラウンドにある間、
 * 30秒ごとに今日の予定を見て、時刻が来たら Notification + バイブ。
 * （新月会・晦日そうじ等の自動入力される予定はアラーム無しで入る）
 */

let watcher: ReturnType<typeof setInterval> | null = null;

const FIRED_KEY = "techo-alarm-fired";

function firedSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function markFired(id: string) {
  const s = firedSet();
  s.add(id);
  // 200件を超えたら古い方から捨てる
  const arr = [...s].slice(-200);
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(arr));
  } catch {}
}

export async function ensureAlarmPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const r = await Notification.requestPermission();
  return r === "granted";
}

export function startAlarmWatcher() {
  if (watcher) return;
  const tick = () => {
    try {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const memos = JSON.parse(readTecho());
      const now = new Date();
      const tk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const day = memos[tk];
      if (!day?.ev) return;
      const nowMin = now.getHours() * 60 + now.getMinutes();
      for (const ev of day.ev) {
        if (!ev.alarm || !ev.id) continue;
        const evMin = (ev.sh ?? 0) * 60 + (ev.sm ?? 0);
        const key = `${tk}|${ev.id}`;
        // 予定時刻ちょうど〜2分以内に一度だけ鳴らす
        if (nowMin >= evMin && nowMin <= evMin + 2 && !firedSet().has(key)) {
          markFired(key);
          try {
            new Notification("⏰ " + ev.text, {
              body: `${String(ev.sh).padStart(2, "0")}:${String(ev.sm).padStart(2, "0")} の予定です`,
              tag: key,
            });
          } catch {}
          try {
            navigator.vibrate?.([200, 100, 200]);
          } catch {}
        }
      }
    } catch {}
  };
  tick();
  watcher = setInterval(tick, 30000);
}
