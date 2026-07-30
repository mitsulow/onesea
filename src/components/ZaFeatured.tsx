"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Shop } from "@/lib/za";

/**
 * 本日のパワープッシュ楽座（楽市楽座から移植）。
 * 画像つき楽座から日替わりで最大6件、4.5秒ごとに自動回転・スワイプ可。
 */
export function ZaFeatured({ shops }: { shops: Shop[] }) {
  const withImage = shops.filter((s) => s.image_urls.length > 0);
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const picks: Shop[] = [];
  if (withImage.length > 0) {
    const start = dayOfYear % withImage.length;
    const count = Math.min(6, withImage.length);
    for (let i = 0; i < count; i++) picks.push(withImage[(start + i) % withImage.length]);
  }

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    if (picks.length <= 1 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % picks.length), 4500);
    return () => clearInterval(t);
  }, [picks.length, paused]);

  useEffect(() => {
    if (index >= picks.length) setIndex(0);
  }, [picks.length, index]);

  if (picks.length === 0) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
    setPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(dx) > 40) setIndex((i) => (i + (dx > 0 ? -1 : 1) + picks.length) % picks.length);
    touchStart.current = null;
    setTimeout(() => setPaused(false), 1000);
  };

  return (
    <div
      className="overflow-hidden rounded-2xl border-2 shadow-md"
      style={{ borderColor: "#c94d3a", background: "linear-gradient(135deg,#fdf6e9 0%,#f5e8d5 100%)" }}
    >
      {/* リボン */}
      <div
        className="flex items-center justify-center gap-2 px-3 py-1"
        style={{ background: "linear-gradient(90deg,#c94d3a 0%,#d4612e 50%,#c94d3a 100%)" }}
      >
        {picks.length > 1 && (
          <div className="flex flex-shrink-0 gap-1">
            {picks.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setIndex(i);
                  setPaused(true);
                  setTimeout(() => setPaused(false), 4000);
                }}
                aria-label={`楽座 ${i + 1}`}
                className="rounded-full transition-all"
                style={{
                  width: i === index ? 14 : 5,
                  height: 5,
                  background: i === index ? "white" : "rgba(255,255,255,0.5)",
                }}
              />
            ))}
          </div>
        )}
        <span className="whitespace-nowrap text-[11px] font-bold tracking-widest text-white">
          🌟 本日のパワープッシュ楽座 🌟
        </span>
      </div>

      {/* スライド */}
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {picks.map((shop) => (
            <Link key={shop.id} href={`/za/${shop.id}`} className="block w-full flex-shrink-0 no-underline">
              <div className="flex h-24">
                <div className="relative w-24 flex-shrink-0 overflow-hidden bg-[#f2ede4]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shop.image_urls[0]}
                    alt={shop.name}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between overflow-hidden p-2">
                  <div className="min-w-0">
                    {shop.is_trial && (
                      <span
                        className="mr-1 rounded-sm px-1 py-0.5 text-[9px] font-bold text-white"
                        style={{ background: "#c94d3a" }}
                      >
                        お試し
                      </span>
                    )}
                    <h2 className="line-clamp-1 text-sm font-bold leading-tight text-[#3a3428]">
                      {shop.name}
                    </h2>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1">
                      {shop.profiles?.avatar_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={shop.profiles.avatar_url}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-6 w-6 rounded-full object-cover"
                        />
                      )}
                      <span className="truncate text-[10px] text-[#8a8070]">
                        {shop.profiles?.display_name ?? ""}
                      </span>
                    </div>
                    <div className="flex-shrink-0 text-sm font-bold" style={{ color: "#c94d3a" }}>
                      {shop.is_trial
                        ? "0円〜"
                        : shop.price_jpy != null
                          ? `¥${shop.price_jpy.toLocaleString()}`
                          : ""}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
