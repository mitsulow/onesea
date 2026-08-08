// OneSea Service Worker — プッシュ通知 + ホーム画面アイコンの未読バッジ（Badging API）
// + シューマン音(10.5MB)の永続キャッシュ: 初回だけダウンロードし、以後はスマホ内から再生
//   (これが無いとiPhoneは大きい音声をすぐ捨て、毎日再ダウンロード = 転送料が爆発する)
const AUDIO_CACHE = "onesea-audio-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      // キャッシュ溜まりすぎ対策: 音声キャッシュ以外は掃除
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k !== AUDIO_CACHE).map((k) => caches.delete(k)));
      } catch {}
      await self.clients.claim();
    })()
  )
);

// /audio/ だけキャッシュファースト。<audio>のRange(部分)リクエストにも206で応える
self.addEventListener("fetch", (e) => {
  let url;
  try {
    url = new URL(e.request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/audio/")) return;
  e.respondWith(
    (async () => {
      const cache = await caches.open(AUDIO_CACHE);
      let full = await cache.match(url.pathname);
      if (!full) {
        // Rangeなしでファイル全体を1回だけ取得して保存
        const resp = await fetch(url.pathname);
        if (!resp.ok) return resp;
        try {
          await cache.put(url.pathname, resp.clone());
        } catch {}
        full = resp;
      }
      const range = e.request.headers.get("range");
      if (!range) return full.clone();
      const buf = await full.clone().arrayBuffer();
      const m = /bytes=(\d+)-(\d+)?/.exec(range);
      const start = m ? parseInt(m[1], 10) : 0;
      const end = m && m[2] ? Math.min(parseInt(m[2], 10), buf.byteLength - 1) : buf.byteLength - 1;
      return new Response(buf.slice(start, end + 1), {
        status: 206,
        headers: {
          "Content-Type": full.headers.get("Content-Type") || "audio/mpeg",
          "Content-Range": `bytes ${start}-${end}/${buf.byteLength}`,
          "Content-Length": String(end - start + 1),
          "Accept-Ranges": "bytes",
        },
      });
    })()
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {}
  const title = data.title || "OneSea";
  const body = data.body || "";
  const badge = typeof data.badge === "number" ? data.badge : undefined;
  event.waitUntil(
    (async () => {
      // ページが閉じていてもアイコンの数字バッジを更新（iOS 16.4+ / 対応環境のみ）
      if (badge !== undefined && "setAppBadge" in self.navigator) {
        try {
          if (badge > 0) await self.navigator.setAppBadge(badge);
          else await self.navigator.clearAppBadge();
        } catch {}
      }
      await self.registration.showNotification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: data.tag || "onesea-line",
        data: { url: data.url || "/talk" },
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/talk";
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of wins) {
        if ("focus" in c) {
          await c.focus();
          if ("navigate" in c) await c.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
