"use client";

/** バグを事務局へ報告（右上アバターメニューから）。
 *  上がったバグは事務局ページの「🐛 バグ報告」タブに一覧で並ぶ */

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function BugReportPage() {
  const [me, setMe] = useState<string | null | undefined>(undefined);
  const [body, setBody] = useState("");
  const [from, setFrom] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => setMe(session?.user?.id ?? null));
    try {
      setFrom(document.referrer && document.referrer.includes(location.host) ? new URL(document.referrer).pathname : "");
    } catch { /* noop */ }
  }, []);

  const send = async () => {
    if (!me || !body.trim() || state !== "idle") return;
    setState("busy");
    const { error } = await createClient().from("bug_reports").insert({
      user_id: me,
      body: body.trim(),
      page_url: from || null,
      ua: navigator.userAgent.slice(0, 250),
    });
    setState(error ? "idle" : "done");
    if (error) alert("送信できませんでした。もう一度お試しください");
  };

  return (
    <main className="min-h-dvh px-5 pb-16 pt-8" style={{ background: "#f7f4ec" }}>
      <div className="mx-auto max-w-[480px]">
        <h1 className="text-[17px] font-extrabold text-[#3a3428]">🐛 バグを事務局へ報告</h1>
        <p className="mt-1.5 text-[12px] leading-relaxed text-[#8a8070]">
          「押しても反応しない」「表示が崩れる」「消えた」など、おかしいと思ったことを教えてください。
          スクショの言葉での説明でもOK。どのページで起きたかも書いてもらえると助かります。
        </p>

        {me === null && (
          <p className="mt-4 rounded-xl bg-white p-4 text-[13px] text-[#8a8070]">報告にはログインが必要です</p>
        )}

        {state === "done" ? (
          <div className="mt-4 rounded-2xl bg-white p-5 text-center" style={{ border: "1px solid #e5dcc8" }}>
            <div className="text-[28px]">🙏</div>
            <p className="mt-1 text-[14px] font-extrabold text-[#2a7a4a]">報告ありがとう！</p>
            <p className="mt-1 text-[12px] text-[#8a8070]">事務局が確認して、直していきます。</p>
            <Link href="/" className="mt-4 inline-block rounded-full border border-[#e0d6c6] bg-white px-5 py-2 text-[12.5px] font-bold text-[#8a7a5a] no-underline">
              トップへもどる
            </Link>
          </div>
        ) : (
          me && (
            <>
              <input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="どのページ？（例: /mmm、マイページ など）"
                className="mt-4 w-full rounded-xl border border-[#e0d6c6] bg-white px-4 py-2.5 text-[13px] outline-none focus:border-[#c94d3a]"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={7}
                placeholder={"何が起きた？\n（例: シューマン音の再生ボタンを押しても音が出ない。iPhoneのSafariです）"}
                className="mt-2 w-full rounded-xl border border-[#e0d6c6] bg-white p-4 text-[14px] leading-relaxed outline-none focus:border-[#c94d3a]"
              />
              <button
                onClick={send}
                disabled={!body.trim() || state === "busy"}
                className="mt-3 w-full rounded-2xl py-3.5 text-[14.5px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#c94d3a" }}
              >
                {state === "busy" ? "送信中..." : "事務局へ送る"}
              </button>
            </>
          )
        )}
      </div>
    </main>
  );
}
