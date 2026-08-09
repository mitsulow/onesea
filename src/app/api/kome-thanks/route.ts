import { NextRequest, NextResponse } from "next/server";

/**
 * 田んぼ申請の自動返信メール。
 * RESEND_API_KEY が設定されている時だけ実送信する(未設定なら黙ってスキップ)。
 * 送信元は RESEND_FROM(検証済みドメイン)が無ければ Resend のテスト送信元。
 */
export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json();
    if (!email || typeof email !== "string") return NextResponse.json({ ok: false }, { status: 400 });
    const key = process.env.RESEND_API_KEY;
    if (!key) return NextResponse.json({ ok: false, skipped: "no-key" });

    const body = [
      `${name ?? ""}さま`,
      "",
      "田んぼの申請ありがとうございました。以下の登録者様向けの資料とYouTube動画をご確認の後、ヒアリングシートへのご登録をお願い致します。",
      "",
      "■ 田んぼ登録者向け説明会",
      "【アーカイブ動画】",
      "https://youtu.be/Ek8wu2uiibM",
      "【資料】",
      "https://drive.google.com/file/d/138XH2fmAUS4GpB1_AFVPp6xfRXQNuXbN/view?usp=drive_link",
      "",
      "こちらをご覧になってから、米部の活動に賛同された方は、下記のヒアリングシートにご回答ください。",
      "https://onesea.vercel.app/sekai/kome/hearing",
      "",
      "セカイムラ米部 事務局",
    ].join("\n");

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "OneSea米部 <onboarding@resend.dev>",
        to: [email],
        subject: "田んぼの申請ありがとうございました",
        text: body,
      }),
    });
    return NextResponse.json({ ok: r.ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
