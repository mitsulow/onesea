"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { UpgradeDialog } from "@/components/UpgradeGate";
import { srcCdn, uploadImage } from "@/lib/images";
import { PREFS } from "@/lib/sekai";
import { SeedSection } from "@/components/sekai/sections";
import { fetchGroupMessages, type GroupMessageRow } from "@/lib/line";
import { useSnackbar } from "@/components/Snackbar";

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

  const { show: snack, node: snackNode } = useSnackbar();
  const [me, setMe] = useState<User | null>(null);
  const [showJoinLp, setShowJoinLp] = useState(false); // 通りすがりさん向け: シューマンと同じ導線(LP+ログイン)
  const [amOffice, setAmOffice] = useState(false);
  const [murabito, setMurabito] = useState(false);
  const [room, setRoom] = useState<any | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [villagers, setVillagers] = useState<any[]>([]);
  const [newcomers, setNewcomers] = useState<any[]>([]); // 14日以内に参加した新しい村人(村長のフォロー用)
  const [joinedCounty, setJoinedCounty] = useState<boolean | null>(null); // この県に参加中か
  const [countyBusy, setCountyBusy] = useState(false);
  /* 2県目以降に参加した時だけ「メインはどっち？」を聞く(メインはマイページのバッジに出る) */
  const [mainPick, setMainPick] = useState<string[] | null>(null);
  const [mainSel, setMainSel] = useState("");
  const [mainBusy, setMainBusy] = useState(false);
  const [seedOpen, setSeedOpen] = useState(false); // ＋拠点の申請(県ページ内でそのまま申請できる)
  /* チャット: 最初から最新6件を出しておく(押した人が迷子にならない) */
  const [chatMsgs, setChatMsgs] = useState<GroupMessageRow[]>([]);
  /* 県のFEED(こんなことをしました報告) */
  const [fposts, setFposts] = useState<any[]>([]);
  const [fBody, setFBody] = useState("");
  const [fPhoto, setFPhoto] = useState<string | null>(null);
  const [fUp, setFUp] = useState(false);
  const [fSending, setFSending] = useState(false);
  const [fEv, setFEv] = useState(false); // 📅 イベントとして投稿
  const [fEvDate, setFEvDate] = useState("");
  const [fEvSh, setFEvSh] = useState(10);
  const [fEvEh, setFEvEh] = useState(12);

  const loadFeed = useCallback(async (rid: string) => {
    const { data } = await createClient()
      .from("village_posts")
      .select("id, body, photo_url, created_at, user_id, profiles!village_posts_user_id_fkey(username, display_name, avatar_url)")
      .eq("pref_room_id", rid)
      .order("created_at", { ascending: false })
      .limit(30);
    setFposts(data ?? []);
  }, []);

  const submitFeed = async () => {
    if (!me || !room || !fBody.trim() || fSending) return;
    if (fEv && !fEvDate) { snack("イベントの日付を入れてください", false); return; }
    setFSending(true);
    const row: any = {
      user_id: me.id,
      body: fBody.trim(),
      photo_url: fPhoto,
      pref_room_id: room.id,
    };
    if (fEv && fEvDate) {
      const [y, mo, da] = fEvDate.split("-").map(Number);
      row.kind = "event";
      row.event_at = new Date(y, mo - 1, da, fEvSh, 0).toISOString();
      row.event_end = new Date(y, mo - 1, da, Math.max(fEvSh, fEvEh), 0).toISOString();
    }
    const { error } = await createClient().from("village_posts").insert(row);
    if (error) {
      snack("投稿できませんでした。「この県に参加する」を押してからどうぞ", false);
      setFSending(false);
      return;
    }
    snack(fEv ? "イベントを作成しました ✓ セカイムラトップにも並びます" : "投稿しました ✓");
    setFBody("");
    setFPhoto(null);
    setFEv(false);
    setFEvDate("");
    setFSending(false);
    loadFeed(room.id);
  };
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
      const { data: pm } = await supabase.from("pref_room_members").select("user_id, joined_at").eq("room_id", data.id).limit(60);
      const ids = (pm ?? []).map((r: any) => r.user_id);
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", ids);
        setVillagers(profs ?? []);
        // 14日以内に参加した人 = 新しい村人(参加が新しい順)
        const since = Date.now() - 14 * 86400000;
        const fresh = (pm ?? [])
          .filter((r: any) => r.joined_at && new Date(r.joined_at).getTime() >= since)
          .sort((a: any, b: any) => String(b.joined_at).localeCompare(String(a.joined_at)))
          .map((r: any) => ({ ...r, prof: (profs ?? []).find((x: any) => x.id === r.user_id) }))
          .filter((r: any) => r.prof);
        setNewcomers(fresh);
      } else {
        setVillagers([]);
        setNewcomers([]);
      }
      loadFeed(data.id);
      fetchGroupMessages("pref", data.id).then((list) => setChatMsgs(list.slice(-6))).catch(() => {});
    }
  }, [pref, loadFeed]);

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
      snack(`セカイムラ${disp}に参加しました ✓`);
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
      snack("参加できませんでした。もう一度お試しください", false);
    }
    setCountyBusy(false);
  };

  /* 参加中ボタンを押すと退会できる。ただし最後の1県は退会不可 */
  const leaveCounty = async () => {
    if (!me || !room || countyBusy) return;
    if (!confirm(`セカイムラ${disp}を退会しますか？`)) return;
    setCountyBusy(true);
    try {
      const supabase = createClient();
      const { data: mems } = await supabase
        .from("pref_room_members")
        .select("room_id, pref_rooms!inner(prefecture, kind)")
        .eq("user_id", me.id)
        .eq("pref_rooms.kind", "sekai");
      const myPrefs = [...new Set(((mems ?? []) as any[]).map((m) => m.pref_rooms?.prefecture).filter(Boolean))] as string[];
      if (myPrefs.length <= 1) {
        alert("退会できません。1つ以上の村を選んでください");
        setCountyBusy(false);
        return;
      }
      const { error } = await supabase.from("pref_room_members").delete().eq("room_id", room.id).eq("user_id", me.id);
      if (error) throw error;
      // メインをこの県にしていた場合は、残りの県へ自動で付け替え
      const rest = myPrefs.filter((p) => p !== pref);
      const { data: prof } = await supabase.from("profiles").select("prefecture").eq("id", me.id).maybeSingle();
      if (prof?.prefecture === pref && rest.length) {
        await supabase.from("profiles").update({ prefecture: rest[0] }).eq("id", me.id);
        snack(`セカイムラ${disp}を退会しました。メインはセカイムラ${rest[0].replace(/[都府県]$/, "")}になりました ✓`);
      } else {
        snack(`セカイムラ${disp}を退会しました ✓`);
      }
      setJoinedCounty(false);
      loadRoom();
    } catch {
      snack("退会できませんでした。もう一度お試しください", false);
    }
    setCountyBusy(false);
  };

  const saveMain = async () => {
    if (!me || !mainSel || mainBusy) return;
    setMainBusy(true);
    const { error } = await createClient().from("profiles").update({ prefecture: mainSel }).eq("id", me.id);
    setMainBusy(false);
    if (error) { snack("保存できませんでした。もう一度お試しください", false); return; }
    snack(`メインをセカイムラ${mainSel.replace(/[都府県]$/, "")}にしました ✓`);
    setMainPick(null);
  };

  const canEdit = amOffice || (!!me && leaders.some((l: any) => l.user_id === me.id));

  const changeImage = async (kind: "cover" | "icon", f: File | null) => {
    if (!f || !me || !room || upBusy) return;
    setUpBusy(kind);
    try {
      const url = await uploadImage("post-images", me.id, f, kind === "cover" ? 1600 : 512, 0.75);
      if (!url) throw new Error("upload");
      const { error } = await createClient().from("pref_rooms").update(kind === "cover" ? { cover_url: url } : { icon_url: url }).eq("id", room.id);
      if (error) throw error;
      await loadRoom();
      snack(kind === "cover" ? "背景写真を変更しました ✓" : "アイコンを変更しました ✓");
    } catch {
      snack("写真を変更できませんでした。HEICの写真は スクリーンショットにしてもう一度どうぞ", false);
    }
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
      {/* ヘッダー — Facebookページ型: 小さめの背景 + 左下に重なる丸アイコン */}
      <header className="relative">
        <div
          className="relative h-[124px]"
          style={{
            background: room?.cover_url
              ? `url(${srcCdn(room.cover_url)}) center/cover`
              : prefGradient(idx),
          }}
        >
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-2.5" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.35), transparent)" }}>
            <Link href="/sekai/villages" className="text-[12.5px] font-bold text-white no-underline drop-shadow">◀ 拠点トップ</Link>
            {me && (
              <button onClick={() => { setNewPref(""); setChanging(true); }} className="rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-bold text-white">
                🚚 セカイムラの県を変える
              </button>
            )}
          </div>
          {/* 背景画像の変更(村長・事務局) */}
          {canEdit && (
            <label className="absolute bottom-2 right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-[14px] shadow-lg">
              {upBusy === "cover" ? "⏳" : "📷"}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { changeImage("cover", e.target.files?.[0] ?? null); e.currentTarget.value = ""; }} />
            </label>
          )}
        </div>

        {/* 白バー: 重なるアイコン + 名前 + 参加まわり */}
        <div className="bg-white px-3 pb-2.5" style={{ borderBottom: "1px solid #e0e8dc" }}>
          <div className="flex items-end gap-2.5">
            <label className={"relative -mt-7 flex-shrink-0" + (canEdit ? " cursor-pointer" : "")}>
              {room?.icon_url ? (
                <img src={srcCdn(room.icon_url)} alt="" className="h-[64px] w-[64px] rounded-full border-4 border-white object-cover shadow" />
              ) : (
                <span
                  className="flex h-[64px] w-[64px] items-center justify-center rounded-full border-4 border-white font-extrabold text-white shadow"
                  style={{ background: prefGradient(idx), fontSize: disp.length >= 3 ? 14 : 18, letterSpacing: 1 }}
                >
                  {disp}
                </span>
              )}
              {canEdit && (
                <>
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] shadow">
                    {upBusy === "icon" ? "⏳" : "📷"}
                  </span>
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { changeImage("icon", e.target.files?.[0] ?? null); e.currentTarget.value = ""; }} />
                </>
              )}
            </label>
            <div className="min-w-0 flex-1 pb-0.5">
              <h1 className="truncate text-[17px] font-extrabold leading-tight text-[#1e4530]">セカイムラ{disp}</h1>
              <div className="text-[10.5px] text-[#8a9a84]">
                🌾 村人 {memberCount ?? villagers.length}人 ・ 拠点 {villages.length}
              </div>
            </div>
          </div>
          <div className="mt-1.5">
            {me && joinedCounty === true && (
              <button
                onClick={leaveCounty}
                disabled={countyBusy}
                className="rounded-full px-3 py-1.5 text-[11.5px] font-extrabold disabled:opacity-40"
                style={{ background: "#e8f4ec", color: "#2a7a48", border: "1px solid #bcdcc8" }}
                title="押すと退会できます"
              >
                ✓ セカイムラ{disp}に参加中 <span className="text-[9px] font-bold text-[#a0aca0]">（押すと退会）</span>
              </button>
            )}
            {me && joinedCounty === false && (
              <button
                onClick={joinCounty}
                disabled={countyBusy}
                className="rounded-full px-5 py-1.5 text-[12px] font-extrabold disabled:opacity-40"
                style={{ background: "#d4b96a", color: "#1a2432" }}
              >
                {countyBusy ? "参加中..." : "🌾 この県に参加する"}
              </button>
            )}
            {!me && (
              <button onClick={() => setShowJoinLp(true)} className="rounded-full px-4 py-1.5 text-[11.5px] font-bold text-white" style={{ background: GREEN }}>
                ログインしてこの県に参加する
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 💬 チャット: 背景のすぐ下に最新6件を最初から表示 */}
      <section className="px-3 pt-3">
        <div className="rounded-xl bg-white p-2.5" style={{ border: "1px solid #d8e4d0" }}>
          <div className="mb-1.5 flex items-center justify-between">
            <div className="text-[12px] font-extrabold text-[#2a4a34]">💬 セカイムラ{disp}のチャット</div>
            {room && <a href={`/talk/g/pref/${room.id}`} className="flex-shrink-0 text-[10.5px] font-bold text-[#8a9a84] no-underline">グループトークで観る →</a>}
          </div>
          {chatMsgs.length === 0 ? (
            <p className="py-3 text-center text-[11.5px] leading-relaxed text-[#a0b09a]">
              まだ書き込みがありません{me && joinedCounty !== true ? "（参加すると読み書きできます）" : ""}
            </p>
          ) : (
            <div className="space-y-2">
              {chatMsgs.map((m) => {
                const mine = m.sender_id === me?.id;
                const d = new Date(m.created_at);
                const prof = (m as any).profiles;
                return (
                  <div key={m.id} className={`flex items-start gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                    {prof?.avatar_url
                      ? <img src={srcCdn(prof.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-7 w-7 flex-shrink-0 rounded-full object-cover" />
                      : <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#dcead8] text-[11px]">🏡</span>}
                    <div className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                      <div className={`text-[9.5px] text-[#8a9a84] ${mine ? "pr-1" : "pl-1"}`}>{prof?.display_name ?? "むらびと"} ・ {d.getMonth() + 1}/{d.getDate()} {d.getHours()}:{String(d.getMinutes()).padStart(2, "0")}</div>
                      <div className={`mt-0.5 inline-block rounded-2xl px-3 py-1.5 text-left text-[12.5px] leading-relaxed ${mine ? "text-white" : "bg-[#f4f8f2] text-[#3a4438]"}`} style={mine ? { background: GREEN } : undefined}>
                        {(m as any).image_url && <img src={srcCdn((m as any).image_url)} alt="" className="mb-1 max-w-[160px] rounded-lg" />}
                        {m.body === "📷 写真" && (m as any).image_url ? "" : m.body}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Link
            href={`/sekai/mura/${idx}/chat`}
            className="mt-2.5 block rounded-xl py-2.5 text-center text-[13px] font-extrabold text-white no-underline"
            style={{ background: GREEN }}
          >
            💬 セカイムラ{disp}のチャットを開く（書き込む）→
          </Link>
        </div>
      </section>

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

      {/* 🌱 新しい村人(14日間だけ表示 — 村長がフォローする用) */}
      {newcomers.length > 0 && (
        <section className="px-3 pt-3">
          <div className="rounded-xl bg-white p-2.5" style={{ border: "1px solid #e8dcb8", background: "#fdfaf0" }}>
            <div className="mb-1.5 text-[12px] font-extrabold text-[#8a6a20]">🔰 新しいムラビト（14日で消えます）</div>
            <div className="flex flex-wrap gap-1.5">
              {newcomers.map((n: any) => {
                const days = Math.floor((Date.now() - new Date(n.joined_at).getTime()) / 86400000);
                const chip = (
                  <span className="flex items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-2.5" style={{ border: "1px solid #e8dcb8" }}>
                    {n.prof.avatar_url
                      ? <img src={srcCdn(n.prof.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full object-cover" />
                      : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f0e8d0] text-[11px]">🌱</span>}
                    <span className="max-w-[100px] truncate text-[11.5px] font-extrabold text-[#5a4a20]">{n.prof.display_name ?? "むらびと"}</span>
                    <span className="num text-[9px] text-[#b0a070]">{days === 0 ? "今日" : `${days}日前`}</span>
                  </span>
                );
                return <span key={n.user_id}>{n.prof.username ? <Link href={`/u/${n.prof.username}`} className="no-underline">{chip}</Link> : chip}</span>;
              })}
            </div>
            <p className="mt-1.5 text-[10px] font-bold text-[#8a6a20]">誰も、一人にしない</p>
          </div>
        </section>
      )}

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
          <button
            onClick={() => setSeedOpen((v) => !v)}
            className="rounded-full px-2.5 py-1 text-[10.5px] font-extrabold text-white"
            style={{ background: seedOpen ? "#8a9a84" : GREEN }}
          >
            {seedOpen ? "▲ とじる" : "＋ 拠点の申請"}
          </button>
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

      {/* ＋拠点の申請 — 県ページの中でそのまま申請(3人集め) */}
      {seedOpen && (
        <section className="px-3 pt-3">
          <SeedSection me={me} presetPref={pref} />
        </section>
      )}

      {/* 📣 セカイムラ◯◯のFEED — こんなことをしました報告(セカイムラトップとCotoZuteにも流れる) */}
      <section className="px-3 pt-3">
        <div className="rounded-xl bg-white p-2.5" style={{ border: "1px solid #d8e4d0" }}>
          <div className="mb-1.5 text-[12px] font-extrabold text-[#2a4a34]">📣 セカイムラ{disp}のFEED</div>

          {joinedCounty === true && me && (
            <div className="mb-3 rounded-xl border border-[#dce8d8] bg-[#f7fbf8] p-2">
              <textarea
                value={fBody}
                onChange={(e) => setFBody(e.target.value)}
                rows={2}
                placeholder={`セカイムラ${disp}のみんなに「こんなことをしました」を報告...`}
                className="w-full resize-none rounded-lg border border-[#e2eae0] bg-white px-2.5 py-2 text-[13px] outline-none focus:border-[#4a8a5c]"
              />
              {fPhoto && (
                <div className="mt-1.5 flex items-center gap-2">
                  <img src={srcCdn(fPhoto)} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  <button onClick={() => setFPhoto(null)} className="text-[11px] font-bold text-[#8a8070] underline">写真を外す</button>
                </div>
              )}
              {fEv && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <input type="date" value={fEvDate} onChange={(e) => setFEvDate(e.target.value)} className="rounded-lg border border-[#e2eae0] bg-white px-2 py-1.5 text-[12px] outline-none" />
                  <select value={fEvSh} onChange={(e) => setFEvSh(Number(e.target.value))} className="rounded-lg border border-[#e2eae0] bg-white px-1.5 py-1.5 text-[12px] outline-none">
                    {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}時</option>)}
                  </select>
                  〜
                  <select value={fEvEh} onChange={(e) => setFEvEh(Number(e.target.value))} className="rounded-lg border border-[#e2eae0] bg-white px-1.5 py-1.5 text-[12px] outline-none">
                    {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}時</option>)}
                  </select>
                </div>
              )}
              <div className="mt-1.5 flex items-center gap-2">
                <button
                  onClick={() => setFEv((v) => !v)}
                  className="rounded-full px-2.5 py-1.5 text-[11px] font-extrabold"
                  style={fEv ? { background: "#c94d3a", color: "#fff" } : { border: "1px solid #dce8d8", color: "#8a9a84", background: "#fff" }}
                >
                  📅 イベント{fEv ? "にする ✓" : "として投稿"}
                </button>
                <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-[15px]" style={{ border: "1px solid #dce8d8" }}>
                  {fUp ? "⏳" : "📷"}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f || !me || fUp) return;
                    setFUp(true);
                    try { setFPhoto(await uploadImage("post-images", me.id, f, 1600, 0.75)); } catch {}
                    setFUp(false);
                    e.currentTarget.value = "";
                  }} />
                </label>
                <button
                  onClick={submitFeed}
                  disabled={!fBody.trim() || fSending || fUp}
                  className="ml-auto rounded-full px-4 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-40"
                  style={{ background: GREEN }}
                >
                  {fSending ? "投稿中..." : "投稿する"}
                </button>
              </div>
            </div>
          )}

          {fposts.length === 0 ? (
            <p className="py-1 text-[11.5px] text-[#a0b09a]">まだ報告がありません。{joinedCounty === true ? "最初のひとことをどうぞ" : "参加すると投稿できます"}</p>
          ) : (
            fposts.map((p: any) => (
              <div key={p.id} className="border-b border-[#eef2ec] py-2 last:border-b-0">
                <div className="flex items-center gap-2">
                  {p.profiles?.avatar_url
                    ? <img src={srcCdn(p.profiles.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full object-cover" />
                    : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#dcead8] text-[11px]">🌾</span>}
                  <span className="text-[12px] font-bold text-[#3a4a34]">{p.profiles?.display_name ?? "むらびと"}</span>
                  <span className="num ml-auto text-[10px] text-[#c0c8c0]">
                    {new Date(p.created_at).getMonth() + 1}/{new Date(p.created_at).getDate()}
                  </span>
                  {me && (me.id === p.user_id || amOffice) && (
                    <button
                      onClick={async () => {
                        if (!confirm("この投稿を削除しますか？")) return;
                        await createClient().from("village_posts").delete().eq("id", p.id);
                        if (room) loadFeed(room.id);
                      }}
                      className="ml-1 text-[9px] font-bold text-[#c05030] underline"
                    >削除</button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#5a5448]">{p.body}</p>
                {p.photo_url && <img src={srcCdn(p.photo_url)} alt="" loading="lazy" className="mt-1.5 max-h-72 rounded-lg object-cover" />}
              </div>
            ))
          )}
        </div>
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

      {/* 写真変更中のバックドロップ */}
      {upBusy && (
        <div className="fixed inset-0 z-[130] flex flex-col items-center justify-center bg-black/60">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white" />
          <p className="mt-3 text-[13px] font-bold text-white">{upBusy === "cover" ? "背景写真を変更中..." : "アイコンを変更中..."}</p>
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
      <UpgradeDialog open={showJoinLp} onClose={() => setShowJoinLp(false)} feature="セカイムラへの参加" lp="/lp/sekai" />
      {snackNode}
    </main>
  );
}
