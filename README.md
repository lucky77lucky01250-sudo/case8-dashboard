# LUMINA 売上分析ダッシュボード

アパレルEC「LUMINA」向けの月次売上分析ダッシュボード。
売上CSVをアップロードすると、KPI・グラフ・AI分析コメントを表示します。

読み手は7名（社長・マーケティング部長・営業5名）。期間軸は月次のみです。

## 本番

| 用途 | URL |
|---|---|
| ダッシュボード | https://case8-lumina-dashboard-chi.vercel.app |
| ヘルスチェック（UptimeRobot の監視先） | https://case8-lumina-dashboard-chi.vercel.app/api/health |

**固定URLはこの1つだけです。** デプロイごとに発行される
`case8-lumina-dashboard-<ハッシュ>.vercel.app` は毎回変わるため、
監視設定や Supabase のリダイレクト先に使うと次のデプロイで静かに壊れます。
`case8-lumina-dashboard.vercel.app`（`-chi` なし）は存在しません。

デプロイは GitHub Actions からのみ行います。Vercel の Git 連携は切ってあります
（有効だとテスト未通過のコードが本番に出るため。`docs/deploy-checklist.md`）。

## ドキュメント

| 資料 | 読み手 | 内容 |
|---|---|---|
| `docs/proposal-final.md` | — | 提案書。**MVPスコープと検収基準の正本** |
| `docs/operation-manual.md` | **クライアント** | 毎月の手順・画面の見方・困ったとき |
| `docs/csv-format.md` | **クライアント** | 取り込めるCSVの形式 |
| `docs/roi-report.md` | **クライアント** | 投資回収の試算 |
| `docs/handover.md` | **クライアント** | 申し送り事項・未確定事項・未実施の項目 |
| `docs/decisions.md` | 開発者 | 実装判断の記録。**変更前に必ず読む** |
| `docs/deploy-checklist.md` | 開発者 | デプロイ手順と外部サービスの設定 |
| `docs/setup-checklist.md` | 開発者 | アカウント準備手順 |

障害対応の手順は、この README の「**運用手順（インシデント対応）**」にあります。
クライアント側から見た対応の分担は `docs/operation-manual.md` 第6項です。

迷ったときの優先順位は **提案書 → decisions.md → コード** です。
提案書に書いた約束を満たすことが実装のゴールで、
decisions.md はそこから外れた判断の理由を記録しています。

## 動かす

```bash
pnpm install
pnpm dev
```

http://localhost:3000 を開き、売上CSVをドラッグ&ドロップします。
動作確認用のサンプルは `sample-data/case8-sales-sample.csv`（40件・2025年9〜11月）。

APIキーやSupabaseが未設定でも起動します。AI分析は集計値から作った仮コメントを表示し、
画面上に仮である旨が出ます。

## 環境変数

`.env.example` を `.env.local` にコピーして値を入れます。取得手順は
`docs/setup-checklist.md` を参照。

| 変数 | 用途 | 未設定時 |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI分析コメントの生成 | 仮コメントを表示 |
| `NEXT_PUBLIC_SUPABASE_URL` | データの保存先 | 保存せずメモリ上で動作 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 画面からの読み取り | 同上 |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバーからの書き込み | 同上 |
| `CRON_SECRET` | Vercel Cron の認証（任意） | 認証なしで実行 |
| `HEALTH_FORCE_FAIL` | `1` で `/api/health` が500を返す | 通常動作 |

## コマンド

```bash
pnpm test             # テスト（CSVパース・文字コード・集計・AI入力・ヘルスチェック）
pnpm type-check       # 型チェック
pnpm lint             # Lint
pnpm build            # 本番ビルド
pnpm verify:supabase  # Supabase の設定検証（RLS・サインアップ拒否・テーブル）
pnpm test:integration # 実Supabaseに2,500行を往復させる結合テスト
```

`test:integration` は実際のDBに接続するため、CI（`pnpm test`）からは除外しています。
提案書 第9項(1)の「本番と同じ件数のデータでも数字が一致すること」を確認するものです。

`verify:supabase` は「第三者が読めない・書けない・アカウントを作れない」ことを
実際に試行して確認します。検収の場で実行して見せられます。
Supabase の設定を変えたあとは必ず実行してください。

CIは push と PR で `type-check` → `lint` → `test` を実行し、
すべて通過したときだけ本番へデプロイします。

## 構成

```
app/
  page.tsx                  ダッシュボード画面
  actions/analyze.ts        AI分析のサーバーアクション
  api/health/               UptimeRobot の監視先
  api/cron/keep-alive/      Supabase の自動停止対策（Vercel Cron から日次）
components/
  upload/                   CSVアップロードと取り込み結果
  dashboard/                KPIカード・グラフ・SKU表・AI分析
lib/
  csv/parser.ts             CSVパースとバリデーション
  aggregate.ts              KPI集計（月次・前月比・リピート率・カテゴリ・SKU）
  ai/                       プロンプト・スキーマ・API呼び出し
supabase/schema.sql         テーブル定義（Supabase の SQL Editor で実行）
tests/                      正解値との照合を含むテスト
docs/                       ↑「ドキュメント」の表を参照
```

## 数字の扱いで気をつけていること

このシステムは**数字が合っていることが最優先**です。以下は意図的な設計なので、
変更する場合は `docs/decisions.md` を読んでから行ってください。

- **月次集計は日付を文字列のまま扱う。** `new Date()` に変換すると、文字列の形式によって
  UTC解釈とローカル解釈が切り替わり、月境界がタイムゾーン依存になります
- **金額は整数（円）で持つ。** 小数で持つと丸め誤差で既存Excelと一致しなくなります
- **無効行は捨てずに数える。** 「◯行成功 / ×行スキップ」を必ず表示し、
  スキップ行はCSVで持ち帰れるようにしています
- **リピート率は月次と期間累計の2種類がある。** 定義が異なるため、画面上でも区別しています
- **AIへ送るのは集計後の数値のみ。** 顧客IDや注文明細は送信しません（テストで固定）
- **DBからの読み出しは必ずページングする。** PostgREST は1回のクエリで最大1,000行しか
  返さず、超えた分は警告なく切り捨てられます（`lib/supabase/paginate.ts`）
- **UTF-8 として読めなかった行は無効行にする。** Excel の「CSV(カンマ区切り)」は既定が
  Shift_JIS で、金額と日付は ASCII なので素通りし、商品名だけが文字化けしたまま
  集計されます（D-21）。文字コードの自動判定はしません
- **画面に出るのは最新のアップロード1件分だけ。** `loadLatestUpload()` は最新の
  `upload_id` に紐づく明細のみを読みます。過去のアップロードと合算はしません

## 運用手順（インシデント対応）

障害が起きたときに、**誰が・何を確認し・どこまで直し・いつクライアントへ連絡するか**の手順です。
保守を担当する人が、この節だけを見て動けるようにしています。

### 0. この手順が適用される条件

**保守契約（月額20,000円）を結んでいるか、納品後30日間の無償期間中であること。**

保守契約がない場合、**監視と通知は動き続けますが、一次対応は行いません。**
通知を受けた時点でお見積もりを提示し、承認後に着手します（提案書 第12項）。

| | 通知は届くか | 一次対応 |
|---|---|---|
| 無償期間中（納品〜30日） | 届く | **行う** |
| 保守契約あり | 届く | **行う** |
| 保守契約なし（31日目以降） | 届く | **行わない。** 都度見積もり |

**「通知が届くこと」と「誰かが直すこと」は別です。**
この区別はクライアントへ必ず明示してください。
契約を結ばない選択をされた場合、障害時に何が起きるかを ご理解いただかないまま
31日目を迎えると、最初の障害で認識の齟齬になります。

### 1. どうやって異常を検知するか

UptimeRobot が `https://case8-lumina-dashboard-chi.vercel.app/api/health` を
**5分間隔**で叩きます。このURLは Supabase へ実際にクエリを投げるため、
画面が表示できてもDBだけが落ちている状態を検知できます。

誤検知を避けるため、UptimeRobot は複数地点から再確認してから通知します。

| | 実測 |
|---|---|
| 障害発生 → メール受信 | 約6分 |
| 復旧 → メール受信 | 約1〜2分 |

### 2. 誰に通知されるか

| 宛先 | 状態 |
|---|---|
| 開発者（保守担当） | 登録済み |
| クライアントのご担当者様 1〜2名 | **未登録。納品時にアドレスをご指定いただき次第、追加**（`docs/handover.md` 4-4） |

件名は `Monitor is DOWN: case8-lumina-dashboard-chi.vercel.app/api/health`、
復旧時は `Monitor is UP` です。

**一次対応は開発者（保守担当）が行います。** クライアント側に操作を求めることはありません。

### 3. 最初にどこを確認するか

**`/api/health` のレスポンス本文を見ます。** どこが壊れているかを本文が名指しします。

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://case8-lumina-dashboard-chi.vercel.app/api/health
curl -s https://case8-lumina-dashboard-chi.vercel.app/api/health
```

| 本文 | 意味 | 次に見る場所 |
|---|---|---|
| `{"status":"ok","database":"reachable"}` | 正常。監視側の誤検知かネットワーク断 | UptimeRobot のログ。復旧していれば対応不要 |
| `{"status":"ok","database":"not_configured"}` | **環境変数が消えている**（本来ここには入らない） | Vercel の Environment Variables |
| `{"status":"error","database":"query_failed",...}` | Supabaseは応答したがクエリが失敗 | 本文の `httpStatus` と `reason`。テーブル・RLS・プロジェクト停止を疑う |
| `{"status":"error","database":"unreachable"}` | Supabase に到達できない | Supabase のステータスページとプロジェクトの状態 |
| `{"status":"error","reason":"forced_failure"}` | **`HEALTH_FORCE_FAIL` が残っている**（検証後の消し忘れ） | Vercel の環境変数から削除して再デプロイ |
| 応答なし / 5xx がHTMLで返る | Vercel 側の障害かデプロイ失敗 | Vercel のデプロイ履歴と Status |

切り分けの順番は **health の本文 → Vercel → Supabase** です。
`/api/health` は Vercel 上で動くので、これが応答している時点で Vercel は生きています。

### 3-1. 復旧作業に入る前に記録すること

**復旧作業を始める前に、必ず現在の数字を控えます。**
復旧後に「データが欠けていないか」を判定する基準がこれしかありません。

画面が開く状態なら、次を記録します。

- 最新アップロードの ファイル名 / 取り込み行数 / 最終更新日時
- 売上合計・粗利合計
- 画面のスクリーンショット1枚

画面が開かない場合は、Supabase の Table Editor で
`uploads` の最新行と `sales_data` の件数を控えます。

**この記録を飛ばして復旧作業に入らないこと。**
復旧してから欠損に気づいても、いつ消えたのかを特定できなくなります。

### 4. どこまでを保守側で復旧できるか

| 事象 | 対応 | 目安 |
|---|---|---|
| `HEALTH_FORCE_FAIL` の消し忘れ | 環境変数を削除して再デプロイ | 5分 |
| 環境変数の消失・誤設定 | 再設定して再デプロイ（`NEXT_PUBLIC_*` は `--no-sensitive`） | 15分 |
| 直前のデプロイによる不具合 | Vercel で直前の正常なデプロイへロールバック | 10分 |
| Supabase の自動停止 | ダッシュボードから再開し、Cron が動いていたか確認 | 15分 |
| RLS・テーブル定義の破損 | `supabase/schema.sql` から復旧し `pnpm verify:supabase` | 30分〜 |
| **Vercel 自体の障害** | **復旧できない。** 提供元の復旧を待つ | 提供元次第 |
| **Supabase 自体の障害** | **復旧できない。** 同上 | 提供元次第 |
| **データの消失** | **バックアップからの復旧が必要。範囲の確認が先** | 要調査 |

下3つは保守の裁量では直せません。**待つしかない事象と、直せる事象を混同しないこと。**
提供元の障害はステータスページのリンクを添えてクライアントへ報告します。

### 5. クライアントへ連絡する条件

**起点は「保守担当が障害を認知した時点」です。** UptimeRobot の検知時刻ではありません。
検知からメール受信まで約6分あり、担当者がメールを見るまでの時間も読めないためです。

**対応時間帯は平日 9:00〜18:00。** 時間外に発生した障害は、
翌営業日の 9:00 を認知時点として扱います。
ただし**データの消失・欠損の可能性がある場合のみ、時間帯を問わず即対応・即連絡**とします。

（この時間帯は契約時にクライアントと合意した値へ差し替えること。
書かないまま運用すると、24時間対応と読まれます。）

**次のいずれかに当てはまれば、復旧を待たずに連絡します。**

- 認知から **30分以内に復旧の見込みが立たない**
- **データの消失・欠損の可能性がある**（時間の長短を問わない）
- **月初5営業日以内**（月次レポートの作成期間にあたるため、短時間でも影響が出る）
- 提供元（Vercel / Supabase）の障害で、**復旧時刻がこちらで読めない**

30分以内に復旧し、データにも影響がない場合は、**事後報告のみ**とします。
復旧済みの障害を都度連絡すると、通知そのものが読まれなくなるためです。

連絡には次を含めます。

- いつから いつまで 使えなかったか
- 原因（技術的な用語を使わない）
- データへの影響の有無（**これを必ず明記する**）
- 再発防止のために行ったこと

なお通知先にクライアントを登録した後は、**先方にも DOWN メールが届きます。**
こちらから連絡する前に先方が気づく場合があるため、**検知から30分は連絡不要でも、
問い合わせが来たら即答できる状態にしておきます。**

### 6. 復旧後に確認すること

上から順に、すべて確認します。

```bash
curl -s https://case8-lumina-dashboard-chi.vercel.app/api/health   # {"status":"ok","database":"reachable"}
pnpm verify:supabase                                               # RLS・サインアップ拒否
```

1. `/api/health` が 200 と `database: reachable` を返す
2. UptimeRobot から `Monitor is UP` が届いている
3. **未ログインで `/` を開くとログイン画面へ飛ぶ**（RLSや認証が壊れていないか）
4. ログインして**最新のアップロードの数字が復旧前と一致する**（データ欠損の確認）
5. 最終更新日時が正しい日本時間で出ている
6. Vercel の Cron Jobs に `/api/cron/keep-alive` が残っている
7. `pnpm verify:supabase` が全項目パスする
8. 環境変数が5件あり、`HEALTH_FORCE_FAIL` が**無い**こと

**4 を飛ばさないこと。** 画面が開くようになったことと、数字が壊れていないことは別です。

最後に、**何が起きて何をしたかを `docs/decisions.md` に記録します。**
同じ障害を2回目に踏んだとき、記録がなければ同じ時間をかけ直すことになります。

## 変更してはいけない設定

保守を引き継ぐ場合の申し送りです。**いずれも、変更するとエラーを出さずに壊れます。**

### Supabase の公開サインアップは無効のまま

Authentication → Sign In / Providers → Email →「Allow new users to sign up」を OFF。
同じ画面の「Allow anonymous sign-ins」も OFF であることを確認してください。

RLSポリシーは「認証済みユーザーは全データを読める」設計です。読み手が7名に固定されており、
アカウントは管理者が Authentication → Users から作成する運用を前提にしています。
サインアップが有効なままだと、**第三者が自分でアカウントを作って売上データを閲覧できます**
（D-9）。

設定は画面の表示を信じず、`pnpm verify:supabase` で実際に試行して確認してください。
**設定を変えたあとは必ず実行します。**

### `NEXT_PUBLIC_` の付け外しをしない

`SUPABASE_SERVICE_ROLE_KEY` に `NEXT_PUBLIC_` を付けると、
**RLSを迂回できる鍵がブラウザへ配信されます。**

逆に `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を
Vercel の Sensitive 環境変数にすると、ビルドが壊れて本番が全ページ500になります（D-16）。

**公開してよい値だけが `NEXT_PUBLIC_` を名乗れて、`NEXT_PUBLIC_` を名乗る値は隠せません。**

### Vercel の Git 連携は切ったまま

有効にすると GitHub Actions のテスト結果を待たずにデプロイされ、
同じコミットが二重にデプロイされて片方はテスト未通過のまま本番に出ます（D-15）。
**Vercel プロジェクトを作り直した場合は、毎回切断し直してください。**

```bash
pnpm dlx vercel git disconnect --yes
```

## 困ったとき（開発者向け）

クライアント側の操作でお困りの場合は `docs/operation-manual.md` 第4〜6項が対応表です。
ここは開発・保守で踏みやすいものだけを挙げています。

### 本番だけが 500 を返す。ビルドもテストも通っている

`NEXT_PUBLIC_*` が Vercel の Sensitive 環境変数になっていないか確認してください。

```bash
pnpm dlx vercel env ls production
```

Sensitive な変数は `vercel pull` で**11文字のプレースホルダ**が返り、
`NEXT_PUBLIC_*` はビルド時にバンドルへ焼き込まれるため、
不正なURLで Supabase クライアントが生成されます。ビルドは成功します（D-16）。

```bash
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_URL production --no-sensitive
```

### CI だけ型チェックが落ちる（`Cannot find name 'LayoutProps'`）

`.next/types` は Next.js が自動生成するため、clone 直後の CI には存在しません。
`pnpm type-check` は `next typegen` を含んでいます（D-14）。
手元で再現するには `rm -rf .next` してから実行してください。

### `/api/health` が Supabase 障害中でも 200 を返す

`select(..., { head: true })` を使っていないか確認してください。
HEAD リクエストは本文を返さないため、supabase-js がエラー本文を読めず
`error: null` を返します。`select("id").limit(1)` を使い、
`error` だけでなく HTTP ステータスも見ます（D-8）。

### 表示時刻が9時間ずれる

`toLocaleString("ja-JP")` を直接呼んでいないか確認してください。
`"ja-JP"` は書式の指定であってタイムゾーンの指定ではないため、
サーバー描画（UTC）とクライアント描画（JST）で結果が変わります。
`lib/format.ts` の `formatDateTime()` を使ってください（D-17）。
`next dev` はサーバーもブラウザも JST なので**ローカルでは再現しません。**

### push しても本番に反映されない / 二重にデプロイされる

Vercel の Git 連携が復活していないか確認してください。
`vercel link` はプロジェクトを作り直すたびに git remote を検出して自動接続します（D-15）。

```bash
pnpm dlx vercel git disconnect --yes
```

### パスワード再設定のリンクが localhost に飛ぶ

Supabase → Authentication → URL Configuration の Site URL と Redirect URLs に
本番URLが登録されているか確認してください（D-12・`docs/deploy-checklist.md` 5-1）。
エラーは出ないため気づきにくい箇所です。

### 障害通知の検証をしたい

`HEALTH_FORCE_FAIL=1` を Vercel の環境変数に追加し、**再デプロイ**してください。
環境変数の変更は既存のデプロイには反映されません。
検証後は削除して再デプロイし、Up に戻ることまで確認します。
実測は障害通知 約6分・復旧通知 約1〜2分です。
