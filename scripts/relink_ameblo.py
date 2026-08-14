# 取込完了後の仕上げ: 記事本文中の「アメブロの過去記事へのリンク」を
# OneSea内の引っ越し先アドレス(/blog/mitsulow/entry-XXXX)に書き換える。
# こっちに存在する記事だけ書き換え、未取込の記事へのリンクはアメブロのまま残す(リンク切れ防止)。
# 何度実行しても安全(冪等)。
import json, os, re, sys, urllib.request

AMEBA_ID = sys.argv[1] if len(sys.argv) > 1 else "mitsulow"
USERNAME = sys.argv[2] if len(sys.argv) > 2 else "mitsulow"  # OneSea側ユーザー名
USER_ID = sys.argv[3] if len(sys.argv) > 3 else "27507412-19f4-4b09-93a2-aa629309f126"
SB_URL = "https://hpgofjkxqguzgrptchqj.supabase.co"

mgmt_tok = re.search(r'SUPABASE_ACCESS_TOKEN="?([^"\r\n]+)', open(os.path.expanduser("~/.rakuichi-env"), encoding="utf-8").read()).group(1)

def mgmt(url):
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + mgmt_tok, "User-Agent": "curl/8.0"})
    return json.loads(urllib.request.urlopen(req).read())

keys = mgmt("https://api.supabase.com/v1/projects/hpgofjkxqguzgrptchqj/api-keys")
KEY = next(k["api_key"] for k in keys if k["name"] == "service_role")

def sb(method, path, body=None, headers=None):
    h = {"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json"}
    if headers: h.update(headers)
    req = urllib.request.Request(SB_URL + path, method=method, headers=h,
                                 data=json.dumps(body).encode() if body is not None else None)
    return urllib.request.urlopen(req, timeout=60).read().decode()

# 1) こっちに存在する記事ID一覧
slugs, ofs = set(), 0
while True:
    rows = json.loads(sb("GET", f"/rest/v1/blog_posts?select=slug&user_id=eq.{USER_ID}&offset={ofs}&limit=1000"))
    for r in rows: slugs.add(r["slug"])
    if len(rows) < 1000: break
    ofs += 1000
have_ids = {s.replace("entry-", "") for s in slugs}
print(f"こっちに存在する記事: {len(have_ids)}件")

# 昔の記事は http:// や //(プロトコル相対) のリンクなので全形式に対応。.html直後のクエリ(?frm=等)も飲み込む
LINK_RE = re.compile(r"(?:https?:)?//ameblo\.jp/" + re.escape(AMEBA_ID) + r"/entry-(\d+)\.html(?:\?[^\"'\s<>]*)?")

def rewrite(body):
    changed = 0
    skipped = 0
    def sub(m):
        nonlocal changed, skipped
        eid = m.group(1)
        if eid in have_ids:
            changed += 1
            return f"/blog/{USERNAME}/entry-{eid}"
        skipped += 1
        return m.group(0)  # 未取込はアメブロのまま
    return LINK_RE.sub(sub, body), changed, skipped

# 2) アメブロリンクを含む記事を順に処理
total_posts = total_links = total_skip = 0
ofs = 0
while True:
    rows = json.loads(sb("GET",
        f"/rest/v1/blog_posts?select=id,slug,body_html&user_id=eq.{USER_ID}"
        f"&body_html=like.*ameblo.jp/{AMEBA_ID}/entry-*&offset={ofs}&limit=100"))
    if not rows: break
    progressed = False
    for r in rows:
        new_body, changed, skipped = rewrite(r["body_html"])
        total_skip += skipped
        if changed:
            sb("PATCH", f"/rest/v1/blog_posts?id=eq.{r['id']}",
               body={"body_html": new_body}, headers={"Prefer": "return=minimal"})
            total_posts += 1
            total_links += changed
            progressed = True
            print(f"{r['slug']}: {changed}リンク書換" + (f" (未取込{skipped}残し)" if skipped else ""), flush=True)
    # 書き換えた行は like 条件から外れることがあるので、全行書換無しの時だけページを進める
    if not progressed:
        ofs += 100
print(f"完了: {total_posts}記事 / {total_links}リンクをOneSea内アドレスへ書換 / 未取込のため温存 {total_skip}リンク")
