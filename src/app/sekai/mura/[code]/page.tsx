"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { srcCdn, uploadImage } from "@/lib/images";
import { PREFS } from "@/lib/sekai";

const GREEN = "#4a9a5a";
const ALL_PREFS = [...PREFS, "海外"] as string[];

/** 県ごとの背景色(背景画像が未設定のあいだ、48県それぞれ違う色合いに) */
function prefGradient(idx: number): string {
  const h = Math.round(((idx - 1) * 137.5) % 360);
  return `linear-gradient(165deg, hsl(${h},46%,34%) 0%, hsl(${h},56%,16%) 100%)`;
}

/** セカイムラ◯◯県トップ — 拠点ページと同じ仕組みの「県のページ」(村人・拠点・チャット・村長) */
export default function SekaiMuraPrefPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const idx = parseInt(params.code, 10);
  const pref = ALL_PREFS[idx - 1] ?? "";
  const disp = pref.replace(/[都府県]$/, "");

  const [me, setMe] = useState<User | null>(null);
  const [amOffice, setAmOffice] = useState(false);
  const [murabito, setMurabito] = useState(false);
  const [room, setRoom] = useState<any | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [villagers, setVillagers] = useState<any[]>([]);
  const [joinedCounty, setJoinedCounty] = useState<boolean | null>(null); // この県に参加中か
  const [countyBusy, setCountyBusy] = useState(false);
  /* 2県目以降に参加した時だけ「メインはどっち？」を聞く(メインはマイページのバッジに出る) */
  const [mainPick, setMainPick] = useState<string[] | null>(null);
  const [mainSel, setMainSel] = useState("");
  const [mainBusy, setMainBusy] = useState(false);
  const [villages, setVillages] = useState<any[]>([]);
  const [upBusy, setUpBusy] = useState<"cover" | "icon" | null>(null);
  /* 県の村長(3人まで) */
  const [leaders, setLeaders] = useState<any[]>([]);
  const [leaderBusy, setLeaderBusy] = useState(false);
  /* セカイムラの県を変える */
  const [changing, setChanging] = useState(false);
  const [newPref, setNewPref] = useState("");
  const [changeBusy, setChangeBusy] = useState(false);

  const loadLeaders = useCallback(async () => {
    const { data } = await createClient()
      .from("pref_leaders")
      .select("user_id, created_at, profiles!pref_leaders_user_id_fkey(username, display_name, avatar_url)")
      .eq("prefecture", pref)
      .order("created_at")
      .limit(3);
    setLeaders(data ?? []);
  }, [pref]);

  const loadRoom = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("pref_rooms").select("id, cover_url, icon_url").eq("kind", "sekai").eq("prefecture", pref).maybeSingle();
    setRoom(data ?? null);
    if (data) {
      const { count } = await supabase.from("pref_room_members").select("user_id", { count: "exact", head: true }).eq("room_id", data.id);
      setMemberCount(count ?? null);
      // この県に参加している村人(参加順)
      const { data: pm } = await supabase.from("pref_room_members").select("user_id").eq("room_id", data.id).limit(60);
      const ids = (pm ?? []).map((r: any) => r.user_id);
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", ids);
        setVillagers(profs ?? []);
      } else {
        setVillagers([]);
      }
    }
  }, [pref]);

  useEffect(() => {
    if (!pref) return;
    const supabase = createClient();
    loadRoom();
    loadLeaders();
    // この県の拠点(会員数が多い順)
    supabase.from("villages").select("id, name, prefecture, cover_url, icon_url, village_members(count)").then(({ data }) => {
      const list = (data ?? []).filter((v: any) =>
        pref === "海外" ? !PREFS.includes(v.prefecture) : v.prefecture === pref
      );
      list.sort((a: any, b: any) => (b.village_members?.[0]?.count ?? 0) - (a.village_members?.[0]?.count ?? 0));
      setVillages(list);
    });
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      if (!u) return;
      const [{ data: prof }, { data: adm }] = await Promise.all([
        supabase.from("profiles").select("murabito").eq("id", u.id).maybeSingle(),
        supabase.from("talk_admins").select("user_id").eq("user_id", u.id).maybeSingle(),
      ]);
      setMurabito(!!prof?.murabito);
      setAmOffice(!!adm);
    });
  }, [pref, loadRoom, loadLeaders]);

  // この県に参加しているか(=セカイムラ◯◯の部屋のメンバーか)
  useEffect(() => {
    if (!me || !room) { setJoinedCounty(me ? null : false); return; }
    createClient()
      .from("pref_room_members")
      .select("user_id")
      .eq("room_id", room.id)
      .eq("user_id", me.id)
      .maybeSingle()
      .then(({ data }) => setJoinedCounty(!!data));
  }, [me, room]);

  /* 県別セカイムラは拒否なし: 押せば誰でもその県の村人になる */
  const joinCounty = async () => {
    if (!me || !room || countyBusy) return;
    setCountyBusy(true);
    try {
      const supabase = createClient();
      if (!murabito) {
        // 村人でなければ、まず村人に(県別は誰でも参加できる)
        const { error } = await supabase.from("profiles").update({ murabito: true }).eq("id", me.id);
        if (error) throw error;
        setMurabito(true);
      }
      const { error: e2 } = await supabase.from("pref_room_members").upsert({ room_id: room.id, user_id: me.id });
      if (e2) throw e2;
      setJoinedCounty(true);
      // 参加している県を数える: 1県目ならそのままメイン、2県目以降ならメインを選んでもらう
      const { data: mems } = await supabase
        .from("pref_room_members")
        .select("room_id, pref_rooms!inner(prefecture, kind)")
        .eq("user_id", me.id)
        .eq("pref_rooms.kind", "sekai");
      const myPrefs = [...new Set(((mems ?? []) as any[]).map((m) => m.pref_rooms?.prefecture).filter(Boolean))] as string[];
      if (myPrefs.length <= 1) {
        await supabase.from("profiles").update({ prefecture: pref }).eq("id", me.id);
      } else {
        const { data: prof } = await supabase.from("profiles").select("prefecture").eq("id", me.id).maybeSingle();
        setMainSel(prof?.prefecture && myPrefs.includes(prof.prefecture) ? prof.prefecture : pref);
        setMainPick(myPrefs);
      }
      loadRoom();
    } catch {
      alert("参加できませんでした。もう一度お試しください");
    }
    setCountyBusy(false);
  };

  const saveMain = async () => {
    if (!me || !mainSel || mainBusy) return;
    setMainBusy(true);
    const { error } = await createClient().from("profiles").update({ prefecture: mainSel }).eq("id", me.id);
    setMainBusy(false);
    if (error) { alert("保存できませんでした。もう一度お試しください"); return; }
    setMainPick(null);
  };

  const canEdit = amOffice || (!!me && leaders.some((l: any) => l.user_id === me.id));

  const changeImage = async (kind: "cover" | "icon", f: File | null) => {
    if (!f || !me || !room || upBusy) return;
    setUpBusy(kind);
    try {
      const url = await uploadImage("post-images", me.id, f, kind === "cover" ? 1600 : 512, 0.75);
      if (url) {
        await createClient().from("pref_rooms").update(kind === "cover" ? { cover_url: url } : { icon_url: url }).eq("id", room.id);
        loadRoom();
      }
    } catch {}
    setUpBusy(null);
  };

  const joinLeader = async () => {
    if (!me || leaderBusy) return;
    setLeaderBusy(true);
    const { data, error } = await createClient().rpc("pref_leader_join", { p_pref: pref });
    setLeaderBusy(false);
    if (error) { alert("登録できませんでした。もう一度お試しください"); return; }
    if (data === "full") { alert("村長は3人までです。すでに埋まっています"); return; }
    if (data === "not_murabito") { alert("まず「村人になる」を押してセカイムラに入ってください"); return; }
    loadLeaders();
  };

  const leaveLeader = async () => {
    if (!me || leaderBusy || !confirm(`セカイムラ${disp}の村長をやめますか？`)) return;
    setLeaderBusy(true);
    await createClient().from("pref_leaders").delete().eq("prefecture", pref).eq("user_id", me.id);
    setLeaderBusy(false);
    loadLeaders();
  };

  /* 所属県の引っ越し: プロフィールの県を変えて、TalKのセカイムラグループも移す */
  const changePref = async () => {
    if (!me || !newPref || changeBusy) return;
    setChangeBusy(true);
    try {
      const supabase = createClient();
      const { data: prof } = await supabase.from("profiles").select("prefecture").eq("id", me.id).maybeSingle();
      const oldPref = prof?.prefecture ?? null;
      const { error } = await supabase.from("profiles").update({ prefecture: newPref }).eq("id", me.id);
      if (error) throw error;
      const { data: rooms } = await supabase.from("pref_rooms").select("id, prefecture").eq("kind", "sekai");
      const oldRoom = (rooms ?? []).find((r: any) => r.prefecture === oldPref);
      const newRoom = (rooms ?? []).find((r: any) => r.prefecture === newPref);
      if (oldRoom && oldRoom.prefecture !== newPref) await supabase.from("pref_room_members").delete().eq("room_id", oldRoom.id).eq("user_id", me.id);
      if (newRoom) await supabase.from("pref_room_members").upsert({ room_id: newRoom.id, user_id: me.id });
      setChanging(false);
      const code = ALL_PREFS.indexOf(newPref) + 1;
      alert(`セカイムラ${newPref.replace(/[都府県]$/, "")}に引っ越しました！`);
      router.push(`/sekai/mura/${code}`);
    } catch {
      alert("変更できませんでした。もう一度お試しください");
    }
    setChangeBusy(false);
  };

  if (!pref) {
    return (
      <main className="min-h-dvh px-6 pt-24 text-center" style={{ background: "#eef4ee" }}>
        <p className="text-[14px] font-bold text-[#5a6a54]">このセカイムラは見つかりませんでした</p>
        <Link href="/sekai/villages" className="mt-4 inline-block text-[13px] font-bold underline" style={{ color: GREEN }}>拠点トップへ戻る</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-20 lg:max-w-3xl" style={{ background: "#eef4ee" }}>
      {/* ヘッダー — 拠点ページと同じ作法(背景画像 or 県ごとの色 + 丸アイコン) */}
      <header
        className="relative px-4 pb-6 pt-4 text-center"
        style={{
          background: room?.cover_url
            ? `linear-gradient(165deg, rgba(10,22,14,.36) 0%, rgba(14,32,20,.44) 60%, rgba(20,44,30,.56) 100%), url(${srcCdn(room.cover_url)}) center/cover`
            : prefGradient(idx),
        }}
      >
        <div className="flex items-center justify-between">
          <Link href="/sekai/villages" className="text-[13px] font-bold text-white/80 no-underline">◀ 拠点トップ</Link>
          {me && (
            <button onClick={() => { setNewPref(""); setChanging(true); }} className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold text-white/90">
              🚚 セカイムラの県を変える
            </button>
          )}
        </div>

        {/* 丸アイコン: 自動で県名入り。村長・事務局は写真に変更できる */}
        <div className="mt-3 flex justify-center">
          <label className={canEdit ? "relative cursor-pointer" : "relative"}>
            {room?.icon_url ? (
              <img src={srcCdn(room.icon_url)} alt="" className="h-[76px] w-[76px] rounded-full border-4 border-white/60 object-cover shadow-lg" />
            ) : (
              <span
                className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-4 border-white/50 font-extrabold text-white shadow-lg"
                style={{ background: "rgba(255,255,255,.14)", fontSize: disp.length >= 3 ? 17 : 22, letterSpacing: 1 }}
              >
                {disp}
              </span>
            )}
            {canEdit && (
              <>
                <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[13px] shadow">
                  {upBusy === "icon" ? "⏳" : "📷"}
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { changeImage("icon", e.target.files?.[0] ?? null); e.currentTarget.value = ""; }} />
              </>
            )}
          </label>
        </div>
        <h1 className="mt-2 text-[21px] font-extrabold tracking-[2px] text-white">セカイムラ{disp}</h1>
        <div className="mt-1 text-[11.5px] text-white/75">
          🌾 村人 {memberCount ?? villagers.length}人 ・ 拠点 {villages.length}
        </div>

        {/* 県別セカイムラは拒否なし: 参加中バッジ or 参加ボタン */}
        {me && joinedCounty === true && (
          <div className="mx-auto mt-2.5 inline-block rounded-full bg-white/90 px-4 py-1.5 text-[12px] font-extrabold" style={{ color: "#2a7a48" }}>
            ✓ セカイムラ{disp}に参加中
          </div>
        )}
        {me && joinedCounty === false && (
          <button
            onClick={joinCounty}
            disabled={countyBusy}
            className="mx-auto mt-2.5 block rounded-full px-6 py-2 text-[13px] font-extrabold disabled:opacity-40"
            style={{ background: "#d4b96a", color: "#1a2432" }}
          >
            {countyBusy ? "参加中..." : "🌾 この県に参加する"}
          </button>
        )}
        {!me && (
          <Link href="/" className="mx-auto mt-2.5 inline-block rounded-full bg-white/20 px-5 py-1.5 text-[11.5px] font-bold text-white no-underline">
            ログインしてこの県に参加する
          </Link>
        )}

        {/* 💬 チャットページへ(グループTalKと同期) */}
        <Link
          href={`/sekai/mura/${idx}/chat`}
          className="mx-auto mt-3 block max-w-[300px] rounded-xl py-3 text-[14px] font-extrabold text-white no-underline shadow"
          style={{ background: GREEN }}
        >
          💬 セカイムラ{disp}のチャットを開く
        </Link>

        {/* 背景画像の変更(村長・事務局) */}
        {canEdit && (
          <label className="absolute right-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white text-[15px] shadow-lg" style={{ bottom: -18 }}>
            {upBusy === "cover" ? "⏳" : "📷"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { changeImage("cover", e.target.files?.[0] ?? null); e.currentTarget.value = ""; }} />
          </label>
        )}
      </header>

      {/* 👑 セカイムラ◯◯の村長(3人まで) */}
      <section className="px-3 pt-4">
        <div className="rounded-xl bg-white p-2.5" style={{ border: "1px solid #d8e4d0" }}>
          <div className="mb-1.5 text-[12px] font-extrabold text-[#2a4a34]">👑 セカイムラ{disp}の村長（3人まで）</div>
          {leaders.length === 0 && <p className="text-[11px] text-[#a0b09a]">まだ村長がいません。最初の村長になりませんか？</p>}
          <div className="flex flex-wrap items-center gap-2">
            {leaders.map((l: any) => {
              const p = l.profiles;
              const chip = (
                <span className="flex items-center gap-1.5 rounded-full bg-[#f2f8f0] py-1 pl-1 pr-2.5" style={{ border: "1px solid #d8e4d0" }}>
                  {p?.avatar_url
                    ? <img src={srcCdn(p.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full object-cover" />
                    : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#dcead8] text-[12px]">👑</span>}
                  <span className="max-w-[110px] truncate text-[11.5px] font-extrabold text-[#2a4a34]">{p?.display_name ?? "むらびと"}</span>
                </span>
              );
              return <span key={l.user_id}>{p?.username ? <Link href={`/u/${p.username}`} className="no-underline">{chip}</Link> : chip}</span>;
            })}
            {me && leaders.some((l: any) => l.user_id === me.id) ? (
              <button onClick={leaveLeader} disabled={leaderBusy} className="rounded-full border border-[#e0d8c8] px-2.5 py-1.5 text-[10.5px] font-bold text-[#a09888]">
                村長をやめる
              </button>
            ) : me && murabito && leaders.length < 3 ? (
              <button onClick={joinLeader} disabled={leaderBusy} className="rounded-full px-3 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-40" style={{ background: "#b8860b" }}>
                {leaderBusy ? "登録中..." : `👑 村長になる（あと${3 - leaders.length}枠）`}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* 🌾 セカイムラ◯◯の村人 */}
      <section className="px-3 pt-3">
        <div className="rounded-xl bg-white p-2.5" style={{ border: "1px solid #d8e4d0" }}>
          <div className="mb-1.5 text-[12px] font-extrabold text-[#2a4a34]">🌾 セカイムラ{disp}の村人（{villagers.length}）</div>
          {villagers.length === 0 ? (
            <p className="text-[11px] text-[#a0b09a]">まだ村人がいません。上の「この県に参加する」で最初の村人になれます</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {villagers.map((p: any) => {
                const av = p.avatar_url
                  ? <img src={srcCdn(p.avatar_url)} alt="" referrerPolicy="no-referrer" title={p.display_name ?? ""} className="h-9 w-9 rounded-full object-cover" />
                  : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dcead8] text-[13px]">🌾</span>;
                return p.username
                  ? <Link key={p.id} href={`/u/${p.username}`}>{av}</Link>
                  : <span key={p.id}>{av}</span>;
              })}
            </div>
          )}
        </div>
      </section>

      {/* 🏡 この県の拠点 — 右スワイプで並ぶ。タッチで拠点ページへ */}
      <section className="px-3 pt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <div className="text-[12px] font-extrabold text-[#2a4a34]">
            <img src="/icons/icon-base.webp" alt="" style={{ width: 15, height: 15, display: "inline", verticalAlign: -3 }} /> セカイムラ{disp}の拠点（{villages.length}）
          </div>
          <Link
            href={`/sekai/villages?pref=${encodeURIComponent(pref)}#seed-sec`}
            className="rounded-full px-2.5 py-1 text-[10.5px] font-extrabold text-white no-underline"
            style={{ background: GREEN }}
          >
            ＋ 拠点の申請
          </Link>
        </div>
        {villages.length === 0 ? (
          <p className="rounded-xl bg-white px-3 py-3 text-[11.5px] leading-relaxed text-[#8a9a84]">
            {disp}にはまだ拠点がありません。最初の拠点を立ち上げてみませんか？
          </p>
        ) : (
          <div className="hide-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-1" data-noswipe>
            {villages.map((v: any) => (
              <Link key={v.id} href={`/sekai/village/${v.id}`} className="w-[150px] flex-shrink-0 overflow-hidden rounded-xl border border-[#d8e4d0] bg-white no-underline">
                <div className="h-[80px] bg-[#eaf2ea]">
                  {v.cover_url
                    ? <img src={srcCdn(v.cover_url)} alt="" loading="lazy" className="h-full w-full object-cover" />
                    : <div className="flex h-full w-full items-center justify-center text-[24px]" style={{ background: "linear-gradient(150deg,#4a9a5a,#1e4530)" }}>🏡</div>}
                </div>
                <div className="px-2 py-1.5">
                  <div className="truncate text-[11px] font-extrabold text-[#2a4a34]">{v.name}</div>
                  <div className="num text-[9.5px] text-[#8a9a84]">{v.village_members?.[0]?.count ?? 0}人</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* メインのセカイムラ選択(2県目以降に参加した時だけ) */}
      {mainPick && (
        <div className="fixed inset-0 z-[116] flex items-center justify-center bg-black/55 px-6">
          <div className="w-full max-w-[340px] rounded-2xl bg-white p-5 text-center">
            <div className="text-[30px]">🌾</div>
            <h2 className="mt-1 text-[15px] font-extrabold text-[#1e4530]">
              メインは{mainPick.map((p) => p.replace(/[都府県]$/, "")).join("と、")}どちらにしますか？
            </h2>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#8a9a84]">メインは1つだけ。マイページのバッジには「セカイムラ◯◯所属」としてメインの県が表示されます。</p>
            <div className="mt-3 space-y-1.5">
              {mainPick.map((p) => (
                <button
                  key={p}
                  onClick={() => setMainSel(p)}
                  className="w-full rounded-xl border px-3 py-2.5 text-[13px] font-extrabold"
                  style={mainSel === p ? { borderColor: GREEN, background: "#eef8f0", color: "#1e4530" } : { borderColor: "#e0e6dc", color: "#8a9a84" }}
                >
                  {mainSel === p ? "✓ " : ""}セカイムラ{p.replace(/[都府県]$/, "")}
                </button>
              ))}
            </div>
            <button onClick={saveMain} disabled={!mainSel || mainBusy} className="mt-3 w-full rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40" style={{ background: GREEN }}>
              {mainBusy ? "保存中..." : "これをメインにする"}
            </button>
          </div>
        </div>
      )}

      {/* 県の引っ越しモーダル */}
      {changing && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/55 px-6" onClick={() => setChanging(false)}>
          <div className="w-full max-w-[340px] rounded-2xl bg-white p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-[30px]">🚚</div>
            <h2 className="mt-1 text-[15px] font-extrabold text-[#1e4530]">セカイムラの県を変える</h2>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#8a9a84]">所属するセカイムラを引っ越します。TalKの「セカイムラ◯◯」グループも新しい県のものに変わります。</p>
            <select value={newPref} onChange={(e) => setNewPref(e.target.value)} className="mt-3 w-full rounded-xl border border-[#d8e4d0] bg-white px-3 py-2.5 text-[13px] outline-none">
              <option value="">引っ越し先をえらぶ</option>
              {ALL_PREFS.map((p) => <option key={p} value={p}>セカイムラ{p.replace(/[都府県]$/, "")}</option>)}
            </select>
            <button onClick={changePref} disabled={!newPref || changeBusy} className="mt-3 w-full rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40" style={{ background: GREEN }}>
              {changeBusy ? "引っ越し中..." : "この県に引っ越す"}
            </button>
            <button onClick={() => setChanging(false)} className="mt-1.5 w-full py-1.5 text-[11.5px] font-bold text-[#a09a88]">キャンセル</button>
          </div>
        </div>
      )}
    </main>
  );
}
