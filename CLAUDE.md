# OneSea — 開発引き継ぎメモ（CLAUDE.md）

コードを読めば分かることは書かない。読んでも分からない「判断の理由・経緯・地雷」だけを書く。
最終更新: 2026-08-12（このファイルは大きな設計判断のたびに追記すること）

## 0. 運用の基本

- 本番: https://onesea.vercel.app / repo: mitsulow/onesea（main直push OK・solo dev）
- 毎リクエスト完結: 実装 → build → commit/push → `vercel deploy --prod` → `/api/version` で反映SHAを確認、まで一気にやる
- DB操作は Supabase Management API（トークン: `~/.rakuichi-env`）。**1リクエスト=1トランザクション**なので、末尾にrollbackを書くとDDLごと消える。検証は別リクエストで
- R2直アップロードは boto3 + `~/.onesea-r2.txt`（/api/uploadはログイン必須なのでスクリプトからは使えない）
- 権限の最終権威 = デスクトップの **「会員区分別アクセス権限シート.xlsx」**。UIの思いつきで権限を変えない。迷ったらシートを読み直す

### パッチ作業の地雷（何度も踏んだ）
- bashヒアドキュメントにPythonを直書きすると `\n` や `${}` が化けてファイルを壊す。**必ずscratchpadに .py をWriteして実行**
- `git checkout --` するとファイルがCRLF化して以後のパッチのアンカーが合わなくなる。パッチは冒頭で `\r\n → \n` 正規化を必ず入れる
- `public/tsukiyoga-v7/index.html` は元からCRLF。編集後はCRLFに戻して保存

## 1. 会員セグメント（固有概念）

1. **通りすがり閲覧者** = 未ログイン。ほぼ全ページ閲覧のみ可
2. **OneSea無料会員** = Googleログイン済み。閲覧+ごく一部（夢叶えナビ登録・ツキヨガ暦登録・楽市の購入/コメント等）
3. **わらわ〜会員** = `profiles.warawa_until` が未来（年39,600円）。投稿・参加・チャット系はほぼ全てここ。**member_noは決済の瞬間に採番**（登録時ではない。INSERTトリガは廃止済み、UPDATEトリガのみ）
4. **事務局** = `talk_admins`（6人）。RLSの各所にadmin例外。入村申請の承認だけは事務局に**見せない**（拠点オーナー専権）

ゲートの作法: `useWarawaGate(lp)`（lib/warawaGate.tsx）→ 不足時は `UpgradeDialog`（シューマン音と同じ導線: サービス別LP `/lp/mmm` `/lp/sekai` 等 + Googleログイン）。**alertで断る実装は書かない**。UpgradeDialogは背景タップで閉じない仕様（読む前に消える事故対策）。シューマンの15秒試聴ポップアップはsessionStorage `schumann-upsell` で再マウント後も維持。

## 2. サービス別の設計思想（違う設定にしないため）

- **MMM** — キャッチ「夢とヒラメキの保管庫」。シューマン音は無料15秒試聴（再生位置ハードキャップ・時限式は聴き直し悪用があり却下済み）。OTOHIKARI地球儀: 雷=Blitzortung WSに**ユーザー端末が直接続**（うちの帯域ゼロ）、光柱=聴いてる人のpresence
- **セカイムラ** — キャッチ「世界は一つの村になる。」。**ムラビト** = `profiles.murabito=true`。所属メイン県 = `profiles.prefecture`（1つだけ。2県目参加時にメイン選択ダイアログ）。マイページのバッジは「🌾 セカイムラ◯◯所属」（旧「拠点名所属」は廃止済み・戻さない）
  - **県ページ48枚**（/sekai/mura/1〜48、47県+海外）= `pref_rooms` の kind='sekai' 行が実体。FBページ型（小さい背景+重なりアイコン）。背景はWikipedia名所写真を設置済み、村長(pref_leaders 3人まで)と事務局が変更可
  - **県参加は拒否なし**（押せば入れる）だが**わらわ〜限定**（権限シート準拠。一時「誰でも無料」にして差し戻した経緯あり。無料に戻さない）
  - **拠点**は真逆で**全て申請・承認制**: 立ち上げ人3人(village_seeds)→事務局が事務局ページで認定(promote_seed)→villages。県は必須（無いと認定が落ちる）。公式拠点の自己申請ボタンは廃止（認定制になったため）。**拠点オーナー=created_by**、**立ち上げ人=leaders[]**（呼称「村長」は県ページ専用に転用したので拠点側で使わない）
- **ツキヨガ** — キャッチ「月を想う。女性のための」。`public/tsukiyoga-v7/index.html` の**静的アプリ**（Reactと二重管理。メニュー・旧暦計算など共通化できない。React側を変えたらツキヨガ側の手動追随を忘れない）
- **楽市楽座** — **楽市=無料**（0円ゆずり・🔰これが初挑戦・【お試し版】=一部無料お試し）、**楽座=有料**（pay_url=BASE/PayPay等の外部決済リンク。**決済サイトはiframe不可**＝X-Frame-Options。「購入はこちら」は別タブ+戻り先にTalK連絡案内パネル、iframe案は実装して却下済み）。物々交換: barter_slots で数量制（梅5人分等）、決定は「本当に本人とTALKで完了しましたか？」ダイアログ→決ハンコ→枠満了でSOLD OUT。「お試し」自動ラベルは全廃済み
- **コトヅテ** — キャッチ「幸せの波紋を拡げよう」。混合フィードは**コピーを持たずソーステーブル（posts/village_posts/moai_posts/shops）をライブ参照**。だから「元で消せばコトヅテからも消える」。過去に消えなかった事件はRLS不足で元の削除が silent fail していたのが原因
- **TalK** — 通話は**電話(音声)で開始→双方が「ビデオ通話にする」を押すと映像**（renegotiation方式）。P2P+STUNのみでサーバー代ゼロ。メッセージ内URLは生のまま表示（「こちらです→」置換は却下済み）
- **MoAI** — キャッチ「シュミサークル部活道」。**県別コンセプト**（サークルは同県が取り組みやすい）。県プルダウンは田んぼ式（地方optgroup+件数+0件disabled+自県デフォルト）。OYA複数制・創設者は脱退不可。アイコンはOneSeaの卵（「集」漢字案・テント絵文字案は却下済み）
- **マイページ** — /u/[username]。他人のページは毎回まず名刺(MeishiModal)。**名刺交換=QR**: 読み取りは**アプリ内カメラ推奨**（端末カメラだとPWAと別ブラウザで未ログイン画面に落ちる。iOSはカメラ→PWA起動が不可能という仕様上の制約）。交換=meishi_exchange RPC（相互フォロー+chat開通+通知）。見せた側もポーリングで相手の名刺が自動表示
- **手帳** — **local-first**（localStorageのみ。サーバーに予定を置かない設計。だからGoogleカレンダー自動同期は不可、個別「Googleに追加」リンク方式=案Aが妥当と結論済み・未実装）。予定シェアだけ shared_plans 経由
- **人物検索** — 「わらわ〜名鑑」/meikan。わらわ〜会員だけが載る（warawa_untilでフィルタ）

### ナビの統一ルール（2026-08-11に全サービス統一）
- **右上アバターメニュー**: 全サービス共通1コンポーネント(AvatarMenu)。並び: お知らせ/MMM/セカイムラ/ツキヨガ/手帳/コトヅテ/楽市楽座/MoAI/人物検索/TalK/マイページ/問い合わせ(小)/事務局/ログアウト。**OneSea行は無し**。ツキヨガだけ静的HTMLに同内容を手書き
- **左下卵メニュー**: 3×3固定・**中央はMoAI**・OneSea無し
- **左上☰**: 「ロゴ+キャッチ → ◯◯トップ → 自サービスの下タブのみ」。**他サービスへのリンクを置かない**（置いていた時代のものは全撤去済み）
- ツキヨガの☰項目はタブ切替ボタン（下タブの該当ボタンをclick()する方式）

## 3. 通信量の設計原則（25,000人/日を想定した決定）

- **写真は全てR2**（転送料ゼロ）。表示はsrcCdn: r2.devは直、Supabase Storage産だけ/api/img経由
- **ポーリングは増分/検知式が鉄則**。全件再取得のsetIntervalを書いたら負け:
  - 1:1 TalK → fetchMessagesSince / グループ → fetchGroupMessagesSince（新着ゼロならほぼ0バイト）
  - CotoZute新着 → countFreshFeed（件数だけ・本文は「追いつく」押下時に初取得）
  - TalK一覧30秒 → 4点プローブ（最終メッセージ時刻・未読数・お知らせ・グループ最新）で変化時のみフル取得
  - どれも document.hidden 中は停止
- 重量級アセットは外部無料CDN: シューマンmp3=jsDelivr（config.tsのurl。publicのは fallback なので消さない）、海岸線land-50m/月テクスチャ=jsDelivr
- HEIC: acceptを `image/jpeg,image/png,image/webp,image/gif` に限定すると**iOSが端末側で即JPEG変換**して渡す（heic2anyのブラウザ内変換10-20秒を回避）。compressImageにheic2anyフォールバックあり。写真変更UIは必ず「バックドロップ+スナックバー(useSnackbar)」で結果を告げる（無反応が一番のクレーム源だった）

## 4. 暦・天文の計算ルール（間違えやすい）

- **旧暦は天文計算のみ**。平均朔望月29.5306日の簡易式は**禁止**（月替わりで1日ズレる実バグを2箇所で修正済み: almanac.ts と tsukiyoga index.html）。正: 「朔の瞬間が**JSTのその日のうち**にあれば、その日が旧暦1日」（瞬間と正午の比較はNG＝1日が消える）。月名は中気（太陽黄経30°倍数）で決定・中気なし=閏月
- 表示は「旧暦：文月一日（旧7月1日）」のコロン形式
- 月の聖点（つきたち/かたみに/くまなし/ありあけ）は「黄経差がその日のJST 0-24時に目標角を通過したか」で判定（月齢幅判定は2日連続になるので却下済み）
- **新月会/満月会の開催時刻**: 新月会=朔に向かう直前の13時、満月会=望に向かう直前の20時（＝天文イベントの**前日開催があり得る**のが仕様）。RSVPは同ボタン再押しで取り消しだが**取り消し時のみconfirm**（iPhone誤タップで参加が消える事故対策）。保存は「先にinsert→古い行を整理」の順（電波切れ対策）
- 潮汐: ツキヨガは public/tsukiyoga-v7/data/tide/{年}/{港2文字}.json（239港×32KB、ユーザーは最寄り1港だけ読む。ports.jsonから端末で最短距離計算）。大元の蓄積は別repo 0Lei（C:\Users\waras\0Lei、シューマン宝の山history/もここ）
- シューマン共振ダッシュボードは**別repo**（mitsulow.github.io/schumann に移転済み。0Lei/schumann.htmlはリダイレクトのみ）。太陽データも0Lei側のスクリプト群が生成

## 5. 触ると壊れる箇所・既知の制約

- `group_messages`: scope_typeの**CHECK制約とRLSの2箇所**に scope 一覧が生えている。新scope追加時は両方+lib/line.tsの型。moai/prefスコープは**わらわ〜条項入り**（読み書きとも）
- `pref_rooms`: unique(prefecture, kind)。**kouryu一覧は必ず .eq("kind","kouryu")**（忘れると95室出る）。kind='sekai'行が県ページの実体（cover_url/icon_url持ち）
- `village_posts` の3形態: village_id あり=拠点投稿 / 両方null...ではなく village_id null + pref_room_id null=事務局の全国投稿 / pref_room_id あり=県投稿。フィード・イベント欄・CotoZuteの表示分岐とjoin（villages / pref_rooms 両方）を落とさない。イベント欄は「当日0:00以降」フィルタ（現在時刻比較にすると作成直後に消える事故←実際に起きた）
- 手帳イベントの id プレフィックス（sekai- / moai- / tanbo- / share-）が「詳細」ボタンの遷移先を決める
- `barter_offers` のprofiles結合は **barter_offers_user_profile_fkey**（user_id_fkeyはauth.users向きでembed不可。過去に「?むらびと」表示バグの原因）
- ServiceMenu.tsx のexport名は **ServiceMenuButton**（moai/page.tsxが参照）
- AvatarMenuは `?inquiry=1` で問い合わせモーダル自動オープン（ツキヨガ静的メニューからの連携）
- 事務局ページの拠点審査は `.in("status", ["open","applied"])`。**eq("open")に戻すと申請が事務局から見えなくなる**（実際に起きたバグ）
- promote_seed は prefecture null を '未設定' に逃がすが、フォーム側で県必須にしてあるので基本発生しない
- OtohikariGlobe: 海岸線は**1つのLineSegmentsに統合済み**（リング毎LineLoopに戻すとSafariが死ぬ。ドローコール1400回問題）。spots変化検知はrefフラグ（毎フレームJSON.stringifyは禁止）
- ツキヨガ静的appの oneseaSvcMenu / tyBurgerMenu / getLunarDate はReact側と**手動同期**が必要
- Vercel env: RESEND_API_KEY / RESEND_FROM(=OneSea米部 <info@warawer.com>) 設定済み。envはデプロイし直すまで反映されない
- 通知(notifications)は**タップした分だけ既読**（一覧を開いた瞬間の全既読は却下済み・戻さない）
- **schumann1（シューマン共振観測所）** = public/schumann1/index.html の静的ページ（旧 mitsulow.github.io/schumann は移設済みでrepo削除済み）。折りたたみの表示順は**CSSの `order`**（DOM順でない）。観測グラフF1〜F4の schumann_series_3d.json には**画像の未来枠（現在カーソルより右）を誤読した平坦ゴミ(~7.8Hz)が常に混じる** → 描画側 drawModeGraphs で「schumann_data.json のtimestamp(=本物の最新観測時刻)より先のキーを捨てる」処理が必須（消すと"グラフが7.8で止まってる"見た目が再発）。seriesの時間軸は実時刻より10〜20分先行するので「時計の今」でのカットでは残像が残る（実際に残った）。0Lei側の全幅読み取りは宝の山の自己修復仕様なので直さない。データ収集は GitHub Actions schumann-update（15分毎・0Lei repo）

## 6. 未解決の課題と次にやるべきこと

1. **TURNサーバー導入** — 通話がSTUNのみで、日本のキャリアCGNAT同士は15-30%繋がらない。月$5-10のcoturn/VPSかCloudflare TURN。25,000人前の必須項目
2. **地球儀③（光柱120スプライト→Points統合）** — ①②実施済み。iPhone Safariでの体感確認待ち。まだ重ければ実施
3. **わらわ〜ゲート未配線の残り** — 講座の動画視聴 / ニューラ(仲間・ガイド・チャット) / ツキヨガ静的アプリ内の登録系（月ナビ・占い・ハナサカリ写真）
4. **Googleカレンダー案A** — 予定ごとの「Googleカレンダーに追加」リンク（設計合意済み・未実装。案B=ICS購読は手帳のクラウドバックアップが前提、案C=API同期はGoogle審査が重く却下方針）
5. **手帳のクラウドバックアップ** — local-firstゆえ端末を失うと予定も消える。案B(ICS)の前提でもある
6. **R2画像のバックアップ** — 毎晩の自動バックアップ(タスクスケジューラ3:00, scripts/backup_onesea.ps1)にR2は含まれていない
7. **楽座出品の編集範囲** — 修正は「軽微な文章と写真のみ」方針（値段等はトラブル防止で不可）。pay_url後付けは再出品が必要なまま
8. **手帳朝いちコンテンツパック**（潮/今日生まれ/何の日/気圧/検証済み占い）— 提案済み・GO待ち。データはC:\Users\waras\data_harvest\night2\ に収集済み
9. **帝王暦術** — 検定完了（職業シグナルなし・実装しない合意）。実在周期(月・潮・気圧・シューマン)は「予報」、暦術は「文化」として扱う方針
10. スケール時の課金順序: 5,000人超えたら Supabase Pro + Vercel Pro（現状無料枠で足りる。写真R2化と増分ポーリング済みなので25,000人でも月8千円前後の試算）
