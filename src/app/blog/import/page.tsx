"use client";

/** ブログ引っ越しボタン。アメブロ/noteのIDを入れるだけで、
 *  過去記事・画像を全部OneSeaブログへコピーする（昔の「お引っ越しツール」の再現）。
 *  元のブログは公開ページを読むだけ — 書き込みも削除も一切しない。 */

import { useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Log = { id: string; msg: string; ok: boolean };

export default function BlogImportPage() {
  const [source, setSource] = useState<"ameba" | "note">("ameba");
  const [blogId, setBlogId] = useState("");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [failed, setFailed] = useState(0);
  const [phase, setPhase] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const stopRef = useRef(false);

  const start = async () => {
    const id = blogId.trim();
    if (!id) return;
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setPhase("ログインが必要です"); return; }
    const { data: prof } = await supabase.from("profiles").select("username").eq("id", session.user.id).maybeSingle();
    setUsername(prof?.username ?? null);

    setRunning(true);
    stopRef.current = false;
    setDone(0); setSkipped(0); setFailed(0); setLogs([]);
    let page = 1;
    let total = 0;
    try {
      while (!stopRef.current) {
        setPhase(`記事一覧を取得中... (${page}ページ目)`);
        const lr = await fetch("/api/blog/import", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, blogId: id, action: "list", page }),
        }).then((r) => r.json());
        if (lr.error) { setPhase(`エラー: ${lr.error}`); break; }
        const ids: string[] = lr.ids ?? [];
        if (ids.length === 0) { setPhase(`完了！ 取込 ${total}件`); break; }
        for (const eid of ids) {
          if (stopRef.current) break;
          setPhase(`${page}ページ目: entry-${eid} を取込中...`);
          const er = await fetch("/api/blog/import", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source, blogId: id, action: "entry", entryId: eid }),
          }).then((r) => r.json());
          if (er.ok && er.skipped) setSkipped((v) => v + 1);
          else if (er.ok) { setDone((v) => v + 1); total++; }
          else {
            setFailed((v) => v + 1);
            setLogs((l) => [...l.slice(-30), { id: eid, msg: er.reason ?? "失敗", ok: false }]);
          }
        }
        if (lr.last) { setPhase(`完了！ 取込 ${total}件`); break; }
        page++;
      }
    } catch (e) {
      setPhase(`中断されました: ${String(e).slice(0, 100)}`);
    }
    setRunning(false);
  };

  return (
    <main className="min-h-screen bg-[#f4f6f2] pb-24">
      <header className="sticky top-0 z-40 border-b border-[#e0e4d8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[52px] max-w-[640px] items-center px-4">
          <span className="text-[14px] font-extrabold text-[#3a4030]">🚚 ブログお引っ越し</span>
        </div>
      </header>

      <div className="mx-auto max-w-[640px] px-4 pt-4">
        <p className="text-[12.5px] leading-relaxed text-[#6a7260]">
          アメブロ・noteのIDを入れるだけで、公開中の過去記事と画像を<b>全部</b>OneSeaブログへコピーします。
          <br />
          <b className="text-[#5a8a3c]">元のブログには何もしません</b>（読むだけ。書き込み・削除は一切なし）。記事はそのまま残ります。
        </p>

        <div className="mt-4 flex gap-2">
          {(["ameba", "note"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              disabled={running}
              className="flex-1 rounded-xl border py-3 text-[13.5px] font-extrabold"
              style={source === s ? { background: s === "ameba" ? "#2d8c3c" : "#41c9b4", borderColor: "transparent", color: "#fff" } : { background: "#fff", borderColor: "#dde2d2", color: "#6a7260" }}
            >
              {s === "ameba" ? "アメブロ" : "note"}
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <span className="flex items-center rounded-xl border border-[#dde2d2] bg-[#eef0e8] px-3 text-[12px] text-[#8a9280]">
            {source === "ameba" ? "ameblo.jp/" : "note.com/"}
          </span>
          <input
            value={blogId}
            onChange={(e) => setBlogId(e.target.value)}
            placeholder={source === "ameba" ? "あなたのアメーバID" : "あなたのnote ID"}
            disabled={running}
            className="min-w-0 flex-1 rounded-xl border border-[#dde2d2] bg-white px-4 py-3 text-[15px] outline-none focus:border-[#5a8a3c]"
          />
        </div>

        {!running ? (
          <button
            onClick={start}
            disabled={!blogId.trim()}
            className="mt-4 w-full rounded-2xl py-4 text-[16px] font-extrabold text-white disabled:opacity-40"
            style={{ background: "linear-gradient(120deg,#5a8a3c,#3c6a28)", boxShadow: "0 6px 20px rgba(90,138,60,.35)" }}
          >
            🚚 ブログ引っ越しを開始
          </button>
        ) : (
          <button onClick={() => { stopRef.current = true; }} className="mt-4 w-full rounded-2xl border border-[#dde2d2] bg-white py-4 text-[14px] font-extrabold text-[#c05030]">
            ⏸ 一時停止（あとで同じIDで再開すると続きから）
          </button>
        )}

        {(running || done + skipped + failed > 0) && (
          <div className="mt-4 rounded-xl border border-[#e4e8dc] bg-white p-4">
            <p className="text-[12.5px] font-bold text-[#3a4030]">{phase}</p>
            <p className="num mt-2 text-[13px] text-[#5a8a3c]">
              ✅ 取込 {done}件　⏭ すでに取込済み {skipped}件　{failed > 0 && <span className="text-[#c05030]">⚠ スキップ {failed}件</span>}
            </p>
            {logs.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-[#faf8f2] p-2 text-[10.5px] leading-relaxed text-[#8a8070]">
                {logs.map((l, i) => <div key={i}>entry-{l.id}: {l.msg}</div>)}
              </div>
            )}
            {!running && username && done + skipped > 0 && (
              <Link href={`/blog/${username}`} className="mt-3 block rounded-xl py-3 text-center text-[14px] font-extrabold text-white no-underline" style={{ background: "#5a8a3c" }}>
                自分のブログを見る →
              </Link>
            )}
          </div>
        )}

        <p className="mt-4 text-[10.5px] leading-relaxed text-[#a0a894]">
          ・時間はかかります（1記事ずつ画像も含めて丁寧にコピーするため）。画面を開いたままにしてください。<br />
          ・途中で止めても、もう一度開始すれば取込済みの記事は飛ばして続きから再開します。<br />
          ・アメンバー限定記事・noteの有料記事は公開されていないため取込できません。
        </p>
      </div>
    </main>
  );
}
