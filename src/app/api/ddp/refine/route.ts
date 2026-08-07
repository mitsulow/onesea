import { NextRequest, NextResponse } from "next/server";

/**
 * DDP AI関門審査 — 手段性/時間性/自己中心性/積み重ねの4基準で審査し、磨いた一文を返す。
 * APIキーはサーバー側のみ（ANTHROPIC_API_KEY）。未設定なら 503 を返し、クライアントは静かにスキップする。
 */
export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "no-key" }, { status: 503 });
  let body: { ddp?: string; items?: unknown; details?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  const ddp = String(body.ddp ?? "").slice(0, 2000);
  if (!ddp.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });

  const prompt = `あなたはDDP（Deep Dream Plan）の関門審査官です。以下の願いを4つの基準で審査してください。

【願い（DDP）】
${ddp}

【変換の道の履歴】
${JSON.stringify(body.items ?? []).slice(0, 3000)}

【積み重ねのディテール】
${(body.details ?? []).join(" / ").slice(0, 1000)}

【4基準】
1. 手段性 — 道（手段）で止まっていないか。「なりたい」の層で書けているか
2. 時間性 — 12月21日（冬至）までに叶いうるか。未来をまるごと今に持ってくる願いでないか
3. 自己中心性 — 他人との比較や他人の心のコントロールが不要か。主導権が自分にあるか
4. 積み重ね — いま信じられる粒（ディテール）に支えられているか

必ず次のJSONだけを返してください（他のテキスト禁止）:
{"pass": true/false, "comment": "短評を100字以内で", "polished": "磨いた一文（『12月21日、私は——』に続く形で、少し背伸びした脚色で）"}`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.DDP_AI_MODEL || "claude-sonnet-5",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) return NextResponse.json({ error: "upstream" }, { status: 502 });
    const j = await r.json();
    const text: string = j?.content?.[0]?.text ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: "no-json" }, { status: 502 });
    const parsed = JSON.parse(m[0]);
    return NextResponse.json({
      pass: !!parsed.pass,
      comment: String(parsed.comment ?? "").slice(0, 300),
      polished: String(parsed.polished ?? "").slice(0, 500),
    });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
}
