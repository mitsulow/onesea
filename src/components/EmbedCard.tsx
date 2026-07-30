"use client";

export interface OGPEmbed {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  platform?: string;
}

function getInstagramPostId(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?]+)/);
  return match ? match[1] : null;
}

function getYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?&#]+)/,
    /youtube\.com\/shorts\/([^?&#]+)/,
    /youtube\.com\/embed\/([^?&#]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function getTweetId(url: string): string | null {
  const match = url.match(/(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/);
  return match ? match[1] : null;
}

/** SNS URL を自動で綺麗にリサイズ表示（楽市楽座「情緒」から移植） */
export function EmbedCard({ embed }: { embed: OGPEmbed }) {
  const url = embed.url;

  const igId = getInstagramPostId(url);
  if (igId) {
    return (
      <div className="mt-2 overflow-hidden rounded-xl border border-[#ede5d8] bg-[#faf8f2]">
        <iframe
          src={`https://www.instagram.com/p/${igId}/embed/captioned/`}
          className="w-full"
          style={{ height: "560px", border: "none" }}
          scrolling="no"
          allowFullScreen
          title="Instagram post"
        />
      </div>
    );
  }

  const ytId = getYouTubeId(url);
  if (ytId) {
    return (
      <div className="mt-2 overflow-hidden rounded-xl border border-[#ede5d8]">
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={`https://www.youtube.com/embed/${ytId}`}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube video"
          />
        </div>
      </div>
    );
  }

  const tweetId = getTweetId(url);
  if (tweetId) {
    return (
      <div className="mt-2 overflow-hidden rounded-xl border border-[#ede5d8] bg-[#faf8f2]">
        <iframe
          src={`https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=light`}
          className="w-full"
          style={{ height: "560px", border: "none" }}
          scrolling="no"
          title="Tweet"
        />
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block overflow-hidden rounded-xl border border-[#ede5d8] no-underline transition-colors hover:bg-[#faf8f2]"
    >
      {embed.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={embed.image} alt="" className="h-36 w-full object-cover" />
      )}
      <div className="p-2.5">
        <div className="line-clamp-2 text-xs font-medium text-[#4a4438]">{embed.title}</div>
        {embed.description && (
          <div className="mt-0.5 line-clamp-2 text-xs text-[#b0a898]">{embed.description}</div>
        )}
        <div className="mt-1 flex items-center gap-1 text-xs text-[#b0a898]">
          {embed.platform && (
            <span className="rounded bg-[#f4f0e6] px-1.5 py-0.5 capitalize">{embed.platform}</span>
          )}
          <span className="truncate">{new URL(url).hostname}</span>
        </div>
      </div>
    </a>
  );
}
