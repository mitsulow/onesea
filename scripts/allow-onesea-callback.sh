#!/bin/bash
# Supabase Auth の許可リダイレクトURLに rakuza-ten と onesea を追加する。
# （これをしないと Google ログイン後に旧サイトへ飛ばされる）
set -euo pipefail
source "$HOME/.rakuichi-env"

curl -sS -X PATCH \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"uri_allow_list":"http://localhost:3000/callback,https://rakuichi-sooty.vercel.app/callback,https://rakuza-ten.vercel.app/callback,https://onesea.vercel.app/callback"}' \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth" \
  | grep -o '"uri_allow_list":"[^"]*"'
echo
echo "OK: 許可リストを更新しました"
