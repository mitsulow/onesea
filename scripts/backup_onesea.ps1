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

# ③ DB全テーブル (pooler直結・Management APIトークン失効2026-09-01を機に移行)
$env:PYTHONIOENCODING = "utf-8"; $env:PYTHONUTF8 = "1"
try {
  $out = python "$env:USERPROFILE\onesea\scripts\db_dump.py" "$bk\db" 2>&1
  $out | Out-File $log -Append -Encoding utf8
} catch { "db dump FAIL: $_" | Out-File $log -Append -Encoding utf8 }

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
