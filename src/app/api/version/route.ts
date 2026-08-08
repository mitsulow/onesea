import { NextResponse } from "next/server";

/** いま動いているビルドの版数。クライアントはこれを見て自動で新版に更新する */
const BUILD = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";

export async function GET() {
  return NextResponse.json(
    { v: BUILD },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}
