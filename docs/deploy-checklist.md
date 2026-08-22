# 本番デプロイ手順

ローカルでの動作確認が完了した状態から、Vercel へ公開するまでの手順。
**ryuさんの作業**と**こちらの作業**を分けて書いている。

---

## 前提：Vercel の Git 連携は使わない

Vercel には「GitHubと連携して push で自動デプロイ」する機能があるが、**使わない。**

理由は、その方式だと**テストを通っていないコードが本番に出るため。**
Vercel の Git 連携は push を検知して即ビルド・デプロイする。GitHub Actions の
型チェック・Lint・テストの結果を待たない。両方を有効にすると、同じコミットが
二重にデプロイされ、片方はテスト未通過のまま本番に反映される。

本案件は `.github/workflows/ci.yml` で
**型チェック → Lint → テスト → 全部通ったらデプロイ**という順序を担保している。
デプロイは GitHub Actions からのみ行う。

そのため Vercel プロジェクトは **CLI で作る**（Git連携なしで作成される）。
ダッシュボードの「Import Git Repository」からは作らないこと。

---

## Phase 1: GitHub リポジトリ（ryuさん・5分）

1. https://github.com/new
2. Repository name: `case8-dashboard`
3. **Private を選ぶ**（クライアント案件のため）
4. README・.gitignore・ライセンスは**追加しない**（作成済みのため衝突する）
5. 作成後に表示される URL を伝える

→ こちらでリモート登録と push を行う。

---

## Phase 2: Vercel プロジェクト（ryuさん）

### 2-1. プランの選択

**本案件は学習用の模擬案件のため Hobby（無料）で実行する。**
https://vercel.com/ に GitHub アカウントでログインするだけでよい。

**提案書の「Vercel Pro $20/月」という記載は変更しない。** 提案書は
「実際にこの案件を受注した場合の構成」を示す設計文書であり、その内容は正しい。
Hobby は個人・非商用利用に限られるため、実在のクライアントから報酬を得る受託案件では
規約違反になる。LUMINA は架空企業であり、本件は学習用途なので Hobby で問題ない。

実案件として稼働させる段階になったら Pro へ移行する。

**Hobby プランの制約として、Vercel Cron の実行頻度に上限がある（1日1回）。**
本案件の keep-alive は日次なので収まる見込みだが、デプロイ後に
Vercel ダッシュボードの Cron Jobs に登録されているか必ず確認すること。

### 2-2. CLI でログインしてプロジェクトを作る

プロジェクトのディレクトリで実行する。

```bash
cd ~/Projects/case8-dashboard
pnpm dlx vercel login
pnpm dlx vercel link
```

`vercel link` の質問には次のように答える。

| 質問 | 回答 |
|---|---|
| Set up ...? | `y` |
| Which scope? | 自分のアカウント |
| Link to existing project? | `n`（新規作成） |
| What's your project's name? | `case8-lumina-dashboard` |
| In which directory is your code located? | `./` |

完了すると `.vercel/project.json` が作られる。**このファイルは git に入れない**
（`.gitignore` 済み）。中の `orgId` と `projectId` を Phase 4 で使う。

### 2-3. Git連携を必ず切る（重要）

**`vercel link` は git remote を検出すると、GitHubリポジトリを自動的に連携する。**
実行ログに次の行が出る。

```
> Connecting GitHub repository: https://github.com/.../case8-dashboard
> Connected
```

ダッシュボードの Import を避けても、CLI 経由で連携されてしまう。
このままだと push のたびに Vercel が独自にビルドし、
**GitHub Actions のテストを待たずに本番へ反映される。**

必ず切断する。

```bash
pnpm dlx vercel git disconnect --yes
```

`Your Vercel project will no longer create deployments when you push to this repository.`
と出れば成功。

### 2-4. `.env.local` への追記について

`vercel link` は `.env.local` の末尾に `VERCEL_OIDC_TOKEN` を追記する。
既存の値は保持されるが、実行後に4つのキーが残っているか確認すること。

---

## Phase 3: Vercel の環境変数（ryuさん）

Vercel ダッシュボード → プロジェクト → Settings → Environment Variables に
以下を **Production** 環境で登録する。値は `.env.local` と同じもの。

| 変数 | Sensitive | 備考 |
|---|---|---|
| `ANTHROPIC_API_KEY` | する | |
| `NEXT_PUBLIC_SUPABASE_URL` | **しない** | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **しない** | |
| `SUPABASE_SERVICE_ROLE_KEY` | する | **絶対に `NEXT_PUBLIC_` を付けない** |
| `CRON_SECRET` | する | 任意の長い文字列。Vercel Cron の認証に使う |

`HEALTH_FORCE_FAIL` は**登録しない**。検収で障害を実演するときだけ一時的に追加する。

### `NEXT_PUBLIC_*` を Sensitive にしてはいけない（重要）

Sensitive な変数は**あとから値を読み出せない。** `vercel pull` は実際の値ではなく
プレースホルダを返す。CI は `vercel pull` → `vercel build` の順でビルドするため、
**ビルド時にコードへ埋め込まれる `NEXT_PUBLIC_*` はプレースホルダのまま焼き込まれる。**

このとき**ビルドは成功し、テストも通り、本番だけが全ページ500を返す。**
実際に発生した（D-16）。原因が Supabase 側に見えるため、切り分けに時間がかかる。

`NEXT_PUBLIC_*` はそもそもブラウザに配信される前提の値なので、隠す意味がない。
CLI で登録する場合は明示する。

```bash
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_URL production --no-sensitive
```

登録後、必ず `vercel env ls production` で `Non-sensitive` になっているか確認する。

---

## Phase 4: GitHub Secrets（ryuさん）

GitHub リポジトリ → Settings → Secrets and variables → Actions → New repository secret

| Secret 名 | 取得先 |
|---|---|
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens → Create |
| `VERCEL_ORG_ID` | `.vercel/project.json` の `orgId` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` の `projectId` |

これが揃うと、main への push でテスト通過後に自動デプロイされる。

---

## Phase 5: デプロイ後の設定

### 5-1. Supabase の URL を本番向けに変更（ryuさん）

Authentication → URL Configuration

- **Site URL**: `https://<Vercelのドメイン>`
- **Redirect URLs**: `https://<Vercelのドメイン>/**` を追加

開発用の `http://localhost:3100` は残しておいてよい（開発を続けるため）。

**これを忘れると、本番でパスワード再設定のリンクが localhost に飛ぶ。**

### 5-2. 独自SMTP の設定（ryuさん）

Supabase の組み込みメール送信は**1時間に数通**の制限があり、実運用に耐えない。
読み手7名がパスワード再設定を使うため、Authentication → Emails → SMTP Settings で
独自のSMTP（Resend、SendGrid、Amazon SES など）を設定する。

### 5-3. 動作確認（こちらで実施）

- `https://<ドメイン>/api/health` が 200 を返すか
- 未ログインで `/` にアクセスするとログイン画面へ飛ぶか
- ログイン → CSVアップロード → 保存 → 再読み込みで数字が残るか
- AI分析が生成できるか
- `pnpm verify:supabase` が全項目パスするか

### 5-4. Vercel Cron の確認（こちらで実施）

`vercel.json` の設定により毎日 03:00（日本時間）に `/api/cron/keep-alive` が叩かれる。
Vercel ダッシュボードの Cron Jobs に登録されているかを確認する。

Supabase Free は1週間アクセスがないと自動停止するため、この仕組みが動いていないと
**保守契約が切れた後に静かに止まる。**

---

## Phase 6: UptimeRobot（デプロイ完了後）

CLAUDE.md「通知経路の実測」の手順で行う。

1. UptimeRobot に登録（無料・カード不要）
2. `https://<ドメイン>/api/health` を5分間隔のHTTP(s)監視に設定
3. 通知先メールアドレスを設定（1〜2名分）
4. **`HEALTH_FORCE_FAIL=1` を Vercel の環境変数に一時的に追加して再デプロイ**
5. **メールが届くまでの実時間を測る**
6. 提案書には「10分程度が目安」と書いた。**実測が大きくずれたら提案書側を直す**
7. 測定後、`HEALTH_FORCE_FAIL` を削除して再デプロイ

---

## 順番の理由

Phase 1〜2 を先にやるのは、**GitHub Actions のデプロイに Vercel のIDが必要**なため。
Phase 5-1 をデプロイ後にするのは、**Vercelのドメインがデプロイするまで分からない**ため。
