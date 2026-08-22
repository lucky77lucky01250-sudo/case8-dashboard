# LUMINA 売上分析ダッシュボード

アパレルEC「LUMINA」向けの月次売上分析ダッシュボード。
売上CSVをアップロードすると、KPI・グラフ・AI分析コメントを表示します。

読み手は7名（社長・マーケティング部長・営業5名）。期間軸は月次のみです。

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
pnpm test             # テスト（CSVパース・集計・AI入力・ヘルスチェック）
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
docs/
  proposal-final.md         提案書（MVPスコープと検収基準の正本）
  decisions.md              実装判断の記録
  setup-checklist.md        アカウント準備手順
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

## Supabase の設定で必ず守ること

**公開サインアップを無効にしてください**（Authentication → Sign In / Providers → Email →
「Allow new users to sign up」を OFF）。

RLSポリシーは「認証済みユーザーは全データを読める」設計です。読み手が7名に固定されており、
アカウントは管理者が Authentication → Users から作成する運用を前提にしています。
サインアップが有効なままだと、**第三者が自分でアカウントを作って売上データを閲覧できます。**
