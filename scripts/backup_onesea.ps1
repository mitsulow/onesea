# OneSea 全部入りバックアップ (毎晩3時 / タスクスケジューラから実行)
# ソース + Supabase全テーブルJSON + 0Lei(シューマン宝の山・港・雷) → デスクトップ日付フォルダ
$ErrorActionPreference = "Continue"
$date = Get-Date -Format "yyyy-MM-dd"
$desk = "$env:USERPROFILE\OneDrive\デスクトップ"
$bk = "$desk\OneSea_バックアップ_$date"
$log = "$bk\backup.log"

New-Item -ItemType Directory -Force $bk | Out-Null
New-Item -ItemType Directory -Force "$bk\db" | Out-Null
"start $(Get-Date)" | Out-File $log -Encoding utf8

# ① ソース
tar --exclude="onesea/node_modules" --exclude="onesea/.next" --exclude="onesea/.git" --exclude="onesea/.vercel" -czf "$bk\onesea-source.tar.gz" -C $env:USERPROFILE onesea 2>$null
"source ok" | Out-File $log -Append -Encoding utf8

# ② 0Lei (シューマン蓄積・港・雷)
tar --exclude="0Lei/.git" -czf "$bk\0Lei-シューマン蓄積と港データ.tar.gz" -C $env:USERPROFILE 0Lei 2>$null
"0lei ok" | Out-File $log -Append -Encoding utf8

# ③ DB全テーブル
$token = ""
Get-Content "$env:USERPROFILE\.rakuichi-env" | ForEach-Object {
  if ($_ -match "SUPABASE_ACCESS_TOKEN\s*=\s*(.+)") { $token = $Matches[1].Trim().Trim('"').Trim("'") }
}
if ($token) {
  $api = "https://api.supabase.com/v1/projects/hpgofjkxqguzgrptchqj/database/query"
  $hdr = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
  try {
    $body = '{"query":"SELECT relname FROM pg_stat_user_tables WHERE schemaname=''public'' ORDER BY relname"}'
    $tables = Invoke-RestMethod -Method Post -Uri $api -Headers $hdr -Body $body
    foreach ($t in $tables) {
      $name = $t.relname
      $q = '{"query":"SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) AS j FROM ' + $name + ' t"}'
      try {
        $r = Invoke-RestMethod -Method Post -Uri $api -Headers $hdr -Body ([System.Text.Encoding]::UTF8.GetBytes($q))
        $r[0].j | ConvertTo-Json -Depth 20 | Out-File "$bk\db\$name.json" -Encoding utf8
      } catch { "table $name FAIL" | Out-File $log -Append -Encoding utf8 }
    }
    "db ok ($($tables.Count) tables)" | Out-File $log -Append -Encoding utf8
  } catch { "db list FAIL: $_" | Out-File $log -Append -Encoding utf8 }
} else {
  "no token" | Out-File $log -Append -Encoding utf8
}

# ④ README
@"
OneSea 自動バックアップ $date (毎晩3時)
- onesea-source.tar.gz : サイト全ソース+アイコン・画像
- 0Lei-シューマン蓄積と港データ.tar.gz : 宝の山2011〜/港239港/雷蓄積/取得スクリプト
- db\ : Supabase全テーブルJSON(会員・投稿・村・お米ほか)
GitHub(mitsulow/onesea, mitsulow/0Lei)にも全履歴あり。復元はREADME(初回2026-08-08版)参照。
"@ | Out-File "$bk\README.txt" -Encoding utf8

# ⑤ ローテーション: 最新10世代だけ残す
Get-ChildItem $desk -Directory -Filter "OneSea_バックアップ_*" |
  Sort-Object Name -Descending | Select-Object -Skip 10 |
  ForEach-Object { try { Remove-Item $_.FullName -Recurse -Force -Confirm:$false } catch {} }

"done $(Get-Date)" | Out-File $log -Append -Encoding utf8
