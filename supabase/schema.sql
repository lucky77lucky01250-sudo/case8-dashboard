-- 案件8 売上分析ダッシュボード スキーマ
-- Supabase の SQL Editor に貼り付けて実行する。東京リージョンのプロジェクトで行うこと。

-- ============================================================
-- アップロード単位
-- ============================================================
create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  -- 「◯行成功 / ×行スキップ」をそのまま保持する（無効行を捨てない要件）
  valid_row_count integer not null,
  invalid_row_count integer not null,
  uploaded_at timestamptz not null default now()
);

-- ============================================================
-- 売上明細
-- 金額は円なので integer で持つ。numeric/float にすると丸め誤差で
-- 「数字が一致すること」（提案書 第9項(1)）を満たせなくなる。
-- 返品・キャンセルはマイナス値で入るため CHECK で正数に縛らない（D-3 #3）
-- ============================================================
create table if not exists sales_data (
  id bigserial primary key,
  upload_id uuid not null references uploads(id) on delete cascade,
  -- date 型で持つ。文字列の月境界がタイムゾーンで揺れないよう、
  -- 月次集計は date_trunc ではなく to_char(order_date, 'YYYY-MM') を使う
  order_date date not null,
  customer_id text not null,
  product_name text not null,
  category text not null,
  sku text not null,
  quantity integer not null,
  revenue integer not null,
  cost integer not null
);

create index if not exists sales_data_upload_id_idx on sales_data (upload_id);
create index if not exists sales_data_month_idx on sales_data (upload_id, order_date);

-- ============================================================
-- スキップした行（クライアントへ返す内訳）
-- ============================================================
create table if not exists skipped_rows (
  id bigserial primary key,
  upload_id uuid not null references uploads(id) on delete cascade,
  -- ヘッダーを1行目とした実CSVの行番号（D-3 #4）
  line_number integer not null,
  reason text not null,
  raw_row jsonb not null
);

create index if not exists skipped_rows_upload_id_idx on skipped_rows (upload_id);

-- ============================================================
-- AI分析コメント
-- ============================================================
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references uploads(id) on delete cascade,
  model text not null,
  summary text not null,
  highlights jsonb not null,
  action_items jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists reports_upload_id_idx on reports (upload_id);

-- ============================================================
-- Row Level Security
-- 読み手は認証済みの7名のみ。anon キーでの読み書きは許可しない
--
-- ★重要: Supabase の「公開サインアップ」を必ず無効にすること。
--   下のポリシーは「認証済みなら全データを読める」という設計。
--   サインアップが有効なままだと、第三者が自分でアカウントを作って
--   ログインし、クライアントの売上データを全て閲覧できてしまう。
--   Authentication → Sign In / Providers → Email →
--   「Allow new users to sign up」を OFF にする。
--   アカウントは管理者が Authentication → Users から作成する。
-- ============================================================
alter table uploads enable row level security;
alter table sales_data enable row level security;
alter table skipped_rows enable row level security;
alter table reports enable row level security;

create policy "authenticated read uploads" on uploads
  for select to authenticated using (true);
create policy "authenticated read sales_data" on sales_data
  for select to authenticated using (true);
create policy "authenticated read skipped_rows" on skipped_rows
  for select to authenticated using (true);
create policy "authenticated read reports" on reports
  for select to authenticated using (true);

-- 書き込みはサーバー側（service_role キー）からのみ行う。
-- service_role は RLS を迂回するため、insert 用のポリシーは作らない。

-- ============================================================
-- 稼働確認用（Supabase Free の自動停止対策で日次アクセスする先）
-- ============================================================
create table if not exists health_pings (
  id bigserial primary key,
  pinged_at timestamptz not null default now()
);

alter table health_pings enable row level security;
