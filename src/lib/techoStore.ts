/**
 * 手帳データの置き場所 — ユーザーごとに分離。
 * 以前は端末共通キー("techo-memos")だったため、ログアウト後のゲストや
 * 別のGoogleアカウントに前の人の予定が見えてしまった。
 * いまは "techo-memos:<uid>"。ゲストは "techo-memos:guest"（実質空）。
 * ログイン中のuidは onesea-uid に置き、AvatarMenu/手帳が同期する。
 */

const LEGACY_KEY = "techo-memos";

export function currentUid(): string | null {
  try {
    return localStorage.getItem("onesea-uid");
  } catch {
    return null;
  }
}

export function setCurrentUid(uid: string | null) {
  try {
    if (uid) localStorage.setItem("onesea-uid", uid);
    else localStorage.removeItem("onesea-uid");
  } catch {}
}

export function techoKey(): string {
  return `${LEGACY_KEY}:${currentUid() ?? "guest"}`;
}

export function readTecho(): string {
  try {
    return localStorage.getItem(techoKey()) ?? "{}";
  } catch {
    return "{}";
  }
}

export function writeTecho(json: string, opts?: { mtime?: number; silentSync?: boolean }) {
  try {
    localStorage.setItem(techoKey(), json);
    // 端末間同期のための最終更新時刻。サーバー由来の書き込みはその時刻を刻む
    localStorage.setItem("techo-mtime:" + (currentUid() ?? "guest"), String(opts?.mtime ?? Date.now()));
    if (!opts?.silentSync && typeof window !== "undefined") window.dispatchEvent(new Event("onesea:techoWrote"));
  } catch {}
}

/** この端末で手帳を最後に書いた時刻(ms)。端末間同期の新旧比較に使う */
export function readTechoMtime(): number {
  try {
    return Number(localStorage.getItem("techo-mtime:" + (currentUid() ?? "guest")) ?? 0);
  } catch {
    return 0;
  }
}

/**
 * 旧キーからの一回きりの引っ越し。ログイン済みで自分のキーがまだ空、
 * かつ旧キーにデータがあれば自分のものとして引き取る（旧キーは削除して、
 * 以後ゲストや別アカウントには二度と見えない）。
 */
export function migrateLegacyTecho() {
  try {
    const uid = currentUid();
    if (!uid) return;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    if (!localStorage.getItem(techoKey())) {
      localStorage.setItem(techoKey(), legacy);
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
}
