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
