#!/bin/bash
# Onesea 専用 Supabase に Google OAuth を設定する。
# 使い方: bash scripts/set-google-oauth.sh <GoogleクライアントID> <クライアントシークレット>
set -euo pipefail
source "$HOME/.rakuichi-env"

CLIENT_ID="${1:?GoogleクライアントIDを指定してください}"
CLIENT_SECRET="${2:?クライアントシークレットを指定してください}"

curl -sS -X PATCH \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"external_google_enabled\":true,\"external_google_client_id\":\"$CLIENT_ID\",\"external_google_secret\":\"$CLIENT_SECRET\"}" \
  "https://api.supabase.com/v1/projects/hpgofjkxqguzgrptchqj/config/auth" \
  | grep -o '"external_google_enabled":[a-z]*'
echo
echo "OK: Google ログインを有効化しました → https://onesea.vercel.app で試せます"
