// 自分のアバターURLの端末キャッシュ。
// profiles.avatar_url の取得はネットワーク往復があるため、遅い回線だと
// 「Google認証アイコン → 正式アバター」の差し替えが丸見えになる。
// 一度解決したURLを保存しておき、次回から最初の描画で正式アバターを出す。
// (裏で毎回最新を取り直して上書きするので、変更後も次のページ表示から追いつく)

const key = (uid: string) => "onesea-av-" + uid;

export function cachedAvatar(uid: string | null | undefined): string | null {
  if (!uid) return null;
  try {
    return localStorage.getItem(key(uid));
  } catch {
    return null;
  }
}

export function cacheAvatar(uid: string, url: string | null | undefined) {
  try {
    if (url) localStorage.setItem(key(uid), url);
    else localStorage.removeItem(key(uid));
  } catch {
    /* private mode */
  }
}
