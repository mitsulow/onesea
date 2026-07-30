// 旧静的版の Service Worker を無効化する自己破棄ワーカー。
// 旧版をキャッシュしている端末はこれを受け取った時点で全キャッシュを捨て、
// SW 登録を解除して最新ページを再読み込みする。
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((c) => c.navigate(c.url));
    })()
  );
});
