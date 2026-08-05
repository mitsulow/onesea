import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2（S3互換）への画像アップロード。サーバー側専用。
 * 表示は公開URL（pub-xxx.r2.dev）から。転送料ゼロなので、
 * 何億回表示されても課金されない。
 */
const R2_URL = process.env.R2_PUBLIC_URL ?? process.env.NEXT_PUBLIC_R2_URL ?? "";
const BUCKET = process.env.R2_BUCKET ?? "onesea-images";

let _client: S3Client | null = null;
function client(): S3Client | null {
  if (_client) return _client;
  const endpoint = process.env.R2_S3_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;
  _client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

/** R2 が使える構成か（鍵と公開URLが揃っているか） */
export function r2Ready(): boolean {
  return !!(client() && R2_URL);
}

/** バイト列を R2 に置き、公開URLを返す。失敗時は null（呼び出し側はSupabaseにフォールバック） */
export async function r2Put(key: string, body: Uint8Array, contentType: string): Promise<string | null> {
  const c = client();
  if (!c || !R2_URL) return null;
  try {
    await c.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    return `${R2_URL.replace(/\/$/, "")}/${key}`;
  } catch (e) {
    console.error("r2Put failed", e);
    return null;
  }
}
