"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 事務局への通報フォーム(全サービス共通)。
 * - 通りすがり(未ログイン): 名前・電話番号・理由すべて必須
 * - OneSea会員(ログイン済み): 理由だけでOK(名前/連絡先は登録済み)
 * 送信先は post_reports → 事務局ページの通報受信箱。
 */
export function ReportDialog({
  kind,
  targetId,
  targetUrl,
  excerpt,
  meId,
  onClose,
}: {
  kind: string;
  targetId: string;
  targetUrl: string;
  excerpt: string;
  meId: string | null;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const anon = !meId;

  const submit = async () => {
    if (!reason.trim()) return;
    if (anon && (!name.trim() || !phone.trim())) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("post_reports").insert({
      kind,
      target_id: targetId,
      target_url: targetUrl,
      excerpt: excerpt.slice(0, 120),
      reporter: meId,
      reporter_name: anon ? name.trim() : null,
      reporter_phone: anon ? phone.trim() : null,
      reason: reason.trim(),
    });
    setBusy(false);
    if (error) {
      alert("送信できませんでした: " + error.message);
      return;
    }
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center px-5" onClick={onClose}>
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative w-full max-w-[360px] rounded-3xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-extrabold text-[#3a3428]">⚑ 事務局に通報する</div>
        {done ? (
          <>
            <p className="mt-3 text-[13px] leading-relaxed text-[#5a5448]">
              事務局に通報しました。内容を確認して対応します。ご協力ありがとうございます🙏
            </p>
            <button onClick={onClose} className="mt-4 w-full rounded-2xl py-3 text-[14px] font-extrabold text-white" style={{ background: "#1a2432" }}>
              とじる
            </button>
          </>
        ) : (
          <>
            <p className="mt-1 text-[11px] leading-relaxed text-[#a09888]">
              白タク・無許可の営業・危険な商品など、気になるものを事務局に知らせます。
            </p>
            {anon && (
              <>
                <label className="mt-3 block text-[11px] font-bold text-[#8a7a5a]">お名前 <span className="text-[#c05030]">必須</span></label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="お名前"
                  className="mt-1 w-full rounded-xl border border-[#e8dcc4] bg-[#fffdf8] px-3 py-2 text-[13.5px] outline-none focus:border-[#c94d3a]"
                />
                <label className="mt-2.5 block text-[11px] font-bold text-[#8a7a5a]">電話番号 <span className="text-[#c05030]">必須</span></label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="090-1234-5678"
                  className="mt-1 w-full rounded-xl border border-[#e8dcc4] bg-[#fffdf8] px-3 py-2 text-[13.5px] outline-none focus:border-[#c94d3a]"
                />
              </>
            )}
            <label className="mt-2.5 block text-[11px] font-bold text-[#8a7a5a]">理由 <span className="text-[#c05030]">必須</span></label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="どこが問題か教えてください"
              className="mt-1 w-full resize-none rounded-xl border border-[#e8dcc4] bg-[#fffdf8] p-3 text-[13.5px] outline-none focus:border-[#c94d3a]"
            />
            {!anon && (
              <p className="mt-1 text-[10.5px] text-[#a09888]">※ お名前・連絡先は登録済みなので、理由だけでOKです。</p>
            )}
            <button
              disabled={busy || !reason.trim() || (anon && (!name.trim() || !phone.trim()))}
              onClick={submit}
              className="mt-3 w-full rounded-2xl py-3 text-[14px] font-extrabold text-white disabled:opacity-40"
              style={{ background: "#c94d3a" }}
            >
              {busy ? "送信中..." : "事務局へ通報する"}
            </button>
            <button onClick={onClose} className="mt-2 block w-full text-center text-[11px] text-[#a09888]">キャンセル</button>
          </>
        )}
      </div>
    </div>
  );
}
