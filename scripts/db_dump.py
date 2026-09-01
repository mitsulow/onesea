"""OneSea 全publicテーブルをJSONダンプ（毎晩バックアップ用）。
Management APIトークン失効(2026-09-01)を機に pooler 直結(pg8000)へ移行。
使い方: python scripts/db_dump.py <出力ディレクトリ>
接続: Supabase pooler(セッションモード5432・IPv4) / パスワードは ~/.onesea-env の ONESEA_DB_PASS
"""
import json
import os
import sys

import pg8000.native

REF = "hpgofjkxqguzgrptchqj"
HOSTS = [
    "aws-0-ap-northeast-1.pooler.supabase.com",
    "aws-1-ap-northeast-1.pooler.supabase.com",
]


def password() -> str:
    for line in open(os.path.expanduser("~/.onesea-env"), encoding="utf-8"):
        if line.startswith("ONESEA_DB_PASS="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("no db pass")


def connect():
    last = None
    for host in HOSTS:
        try:
            return pg8000.native.Connection(
                user=f"postgres.{REF}", password=password(), host=host, port=5432,
                database="postgres", ssl_context=True, timeout=120,
            )
        except Exception as e:
            last = e
    raise SystemExit(f"connect failed: {last}")


def main():
    outdir = sys.argv[1]
    os.makedirs(outdir, exist_ok=True)
    con = connect()
    try:
        tables = con.run(
            "select relname from pg_stat_user_tables where schemaname='public' order by relname")
        ok = fail = 0
        for (name,) in tables:
            try:
                # jsonb_agg(全件を1行に集約)はblog_posts等の巨大テーブルでタイムアウトする
                # (旧Management API版が2テーブルで止まっていた原因)。行単位のto_jsonbで流す
                rows = con.run(f'select to_jsonb(t)::text from "{name}" t')
                with open(os.path.join(outdir, f"{name}.json"), "w", encoding="utf-8") as f:
                    f.write("[")
                    for i, (j,) in enumerate(rows):
                        if i:
                            f.write(",\n")
                        f.write(j)
                    f.write("]")
                ok += 1
            except Exception as e:
                fail += 1
                print(f"table {name} FAIL: {e}")
        print(f"db ok ({ok} tables, {fail} fail)")
    finally:
        con.close()


if __name__ == "__main__":
    main()
