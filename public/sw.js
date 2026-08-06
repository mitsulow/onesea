// OneSea Service Worker — プッシュ通知 + ホーム画面アイコンの未読バッジ（Badging API）
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

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
