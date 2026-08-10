"use client";

import { useCallback, useRef, useState } from "react";

/** スナックバー: 画面下に「完了しました ✓」「失敗しました」を3秒だけ出す */
export function useSnackbar() {
  const [snack, setSnack] = useState<{ text: string; ok: boolean } | null>(null);
  const timer = useRef<number | null>(null);
  const show = useCallback((text: string, ok = true) => {
    setSnack({ text, ok });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSnack(null), 3200);
  }, []);
  const node = snack ? (
    <div
      className="fixed bottom-20 left-1/2 z-[140] w-[calc(100%-48px)] max-w-[360px] -translate-x-1/2 rounded-xl px-4 py-3 text-center text-[13px] font-extrabold leading-relaxed text-white shadow-lg"
      style={{ background: snack.ok ? "#2a8a4a" : "#c05030" }}
    >
      {snack.text}
    </div>
  ) : null;
  return { show, node };
}
