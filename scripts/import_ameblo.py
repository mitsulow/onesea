# アメブロ公開ブログ → OneSea blog_posts 一括引っ越し(読み取りのみ・元ブログには一切書き込まない)
# 使い方: python scripts/import_ameblo.py <amebaId> <onesea_user_uuid> [--limit N] [--start-page N]
# - 公開記事を entrylist-N.html から列挙し、各記事の INIT_DATA から本文HTML/テーマ/日時を取得
# - 画像(stat.ameba.jp/user_images)は R2 にコピーして本文URLを書き換え(元画像サイズ、?caw=は除去)
# - blog_posts に upsert(user_id+slug)。既存slugはスキップ=何度でも再開できる
import json, os, re, sys, time, urllib.request, urllib.error

AMEBA_ID = sys.argv[1] if len(sys.argv) > 1 else "mitsulow"
USER_ID = sys.argv[2] if len(sys.argv) > 2 else "27507412-19f4-4b09-93a2-aa629309f126"
LIMIT = None
START_PAGE = 1
for i, a in enumerate(sys.argv):
    if a == "--limit": LIMIT = int(sys.argv[i + 1])
    if a == "--start-page": START_PAGE = int(sys.argv[i + 1])

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OneSeaBlogImport/1.0"}
SB_URL = "https://hpgofjkxqguzgrptchqj.supabase.co"

# ---- 認証情報 ----
def load_env(path):
    d = {}
    for line in open(os.path.expanduser(path), encoding="utf-8"):
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            d[k.strip()] = v.strip().strip('"')
    return d

r2 = load_env("~/.onesea-r2.txt")
mgmt_tok = re.search(r'SUPABASE_ACCESS_TOKEN="?([^"\r\n]+)', open(os.path.expanduser("~/.rakuichi-env"), encoding="utf-8").read()).group(1)

def mgmt(url):
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + mgmt_tok, "User-Agent": "curl/8.0"})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())  # timeout無しだと圏外時に永久ハング(実際に起きた)

keys = mgmt("https://api.supabase.com/v1/projects/hpgofjkxqguzgrptchqj/api-keys")
SERVICE_KEY = next(k["api_key"] for k in keys if k["name"] == "service_role")

import boto3
s3 = boto3.client(
    "s3",
    endpoint_url=r2["R2_S3_ENDPOINT"],
    aws_access_key_id=r2["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=r2["R2_SECRET_ACCESS_KEY"],
    region_name="auto",
)
BUCKET = r2["R2_BUCKET"]
R2_PUB = r2["R2_PUBLIC_URL"].rstrip("/")

# ---- HTTP ----
def fetch(url, binary=False, retries=3):
    for t in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            data = urllib.request.urlopen(req, timeout=60).read()
            return data if binary else data.decode("utf-8", "replace")
        except Exception as e:
            if t == retries - 1: raise
            time.sleep(1.5 * (t + 1))

def init_data(html):
    i = html.find("window.INIT_DATA")
    if i < 0: return None
    i = html.find("{", i)
    d, _ = json.JSONDecoder().raw_decode(html[i:])
    return d

def sb(method, path, body=None, headers=None):
    h = {"apikey": SERVICE_KEY, "Authorization": "Bearer " + SERVICE_KEY, "Content-Type": "application/json"}
    if headers: h.update(headers)
    req = urllib.request.Request(SB_URL + path, method=method, headers=h,
                                 data=json.dumps(body).encode() if body is not None else None)
    try:
        return urllib.request.urlopen(req, timeout=60).read().decode()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{e.code} {e.read().decode()[:300]}")

# ---- 既存slug(レジューム用) ----
def existing_slugs():
    slugs, ofs = set(), 0
    while True:
        rows = json.loads(sb("GET", f"/rest/v1/blog_posts?select=slug&user_id=eq.{USER_ID}&offset={ofs}&limit=1000"))
        for r in rows: slugs.add(r["slug"])
        if len(rows) < 1000: break
        ofs += 1000
    return slugs

# ---- 画像の R2 コピー ----
EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp"}
def mirror_images(eid, body):
    urls = re.findall(r'https://stat\.ameba\.jp/user_images/[^"\'\s\\)<>]+', body)
    seen, mapping = {}, {}
    n = 0
    for u in urls:
        base = u.split("?")[0]
        if base in seen: continue
        seen[base] = True
        try:
            data = fetch(base, binary=True)
        except Exception:
            continue  # 死んだ画像は原URLのまま残す(消さない)
        ct = "image/jpeg"
        if base.endswith(".png"): ct = "image/png"
        elif base.endswith(".gif"): ct = "image/gif"
        elif base.endswith(".webp"): ct = "image/webp"
        key = f"blog/{AMEBA_ID}/{eid}/{n}{EXT[ct]}"
        s3.put_object(Bucket=BUCKET, Key=key, Body=data, ContentType=ct,
                      CacheControl="public, max-age=31536000, immutable")
        mapping[base] = f"{R2_PUB}/{key}"
        n += 1
    # 書き換え: クエリ付きも含めて全出現を置換
    for base, r2url in mapping.items():
        body = re.sub(re.escape(base) + r"(\?[^\"'\s\\)<>]*)?", r2url, body)
    first = next(iter(mapping.values()), None)
    return body, first, n

# ---- 記事1件 ----
def import_entry(eid, slugs):
    slug = f"entry-{eid}"
    if slug in slugs: return "skip"
    html = fetch(f"https://ameblo.jp/{AMEBA_ID}/entry-{eid}.html")
    d = init_data(html)
    if not d: return "no-init"
    em = d.get("entryState", {}).get("entryMap", {})
    e = em.get(str(eid)) or (list(em.values())[0] if em else None)
    if not e or not e.get("entry_text"):
        return "no-body"  # アメンバー限定などは公開されていない
    body = e["entry_text"]
    body, thumb, nimg = mirror_images(eid, body)
    row = {
        "user_id": USER_ID,
        "slug": slug,
        "title": e.get("entry_title") or "(無題)",
        "body_html": body,
        "genre": e.get("theme_name") or None,
        "posted_at": e.get("entry_created_datetime"),
        "publish_at": e.get("entry_created_datetime"),
        "status": "published",
        "source": "ameba",
        "source_url": f"https://ameblo.jp/{AMEBA_ID}/entry-{eid}.html",
        "hashtags": [h.get("tag_name") or h.get("name") for h in (e.get("hash_tag_list") or []) if isinstance(h, dict)],
        "thumb_url": thumb or (e.get("image_url") and ("https:" + e["image_url"] if str(e["image_url"]).startswith("//") else e["image_url"])) or None,
    }
    sb("POST", "/rest/v1/blog_posts?on_conflict=user_id,slug", body=[row],
       headers={"Prefer": "resolution=merge-duplicates,return=minimal"})
    slugs.add(slug)
    return f"ok({nimg}img)"

# ---- メイン ----
def main():
    slugs = existing_slugs()
    print(f"既存 {len(slugs)}件 (スキップ対象)")
    page = START_PAGE
    done = 0
    while True:
        html = fetch(f"https://ameblo.jp/{AMEBA_ID}/entrylist-{page}.html")
        d = init_data(html)
        if not d: break
        pm = d.get("entryState", {}).get("blogPageMap", {})
        ids = []
        for v in pm.values():
            ids = v.get("data") or []
        if not ids:
            print(f"page {page}: 記事なし → 完了")
            break
        for eid in ids:
            try:
                r = import_entry(eid, slugs)
            except Exception as ex:
                r = f"ERROR {str(ex)[:120]}"
            if r != "skip":
                done += 1
                print(f"p{page} entry-{eid}: {r}", flush=True)
                time.sleep(0.35)
            if LIMIT and done >= LIMIT:
                print("limit到達"); return
        page += 1
        time.sleep(0.3)
    print(f"完了: 新規{done}件 / 総{len(slugs)}件")

main()
