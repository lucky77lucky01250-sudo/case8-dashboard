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

### 5-0. 本番URL（2026-08-22 確定）

| 用途 | URL |
|---|---|
| **固定URL（これを使う）** | `https://case8-lumina-dashboard-chi.vercel.app` |
| デプロイ個別URL | `https://case8-lumina-dashboard-<ハッシュ>.vercel.app` |

デプロイ個別URLは**デプロイのたびに変わる。** 監視設定やSupabaseのリダイレクト先には
必ず固定URLのほうを使う。個別URLを登録すると、次のデプロイで静かに壊れる。

`case8-lumina-dashboard.vercel.app`（`-chi` なし）は**存在しない**（404）。

### 5-1. Supabase の URL を本番向けに変更（ryuさん）

Authentication → URL Configuration

- **Site URL**: `https://case8-lumina-dashboard-chi.vercel.app`
- **Redirect URLs**: `https://case8-lumina-dashboard-chi.vercel.app/**` を追加

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

## Phase 6: UptimeRobot（2026-08-22 設定完了）

CLAUDE.md「通知経路の実測」の手順で行う。

### 設定内容

| 項目 | 値 |
|---|---|
| Monitor Type | HTTP(s) |
| 監視URL | `https://case8-lumina-dashboard-chi.vercel.app/api/health` |
| Monitoring Interval | **5 分**（無料プランの最短） |
| 通知先 | `lucky77lucky01250@gmail.com` |
| プラン | Free（50監視まで・カード不要） |

### 設定時に判断したこと

**トップページ `/` ではなく `/api/health` を監視する。**
`/` はページが表示できた時点で「正常」になるが、`/api/health` は
Supabase へ実際にクエリを投げて成否を確かめるため、DBだけが落ちた状態を検知できる。

**公開ステータスページは作らない。**
オンボーディングの Step 3 は既定でONになっており、そのまま進むと
`stats.uptimerobot.com/<ID>` が誰でも見られる状態になる。
監視対象URLと障害履歴が外から見えるため、OFFにした。
本案件は架空企業なので実害はないが、実案件で既定のまま通すと
クライアントの障害履歴を許可なく公開したことになる。

**実測の前にテスト通知を1回送る。**
オンボーディング Step 2 の「Send test e-mail notification」を実行し、
迷惑メールフォルダに入らないことまで確認した。
これをやらずに実測に入ると、メールが来なかったときに
「検知に失敗した」のか「配送に失敗した」のか切り分けられない。

### 実測の手順

1. `HEALTH_FORCE_FAIL=1` を Vercel の環境変数に追加
2. **再デプロイする**（環境変数の変更は既存のデプロイには反映されない）
3. `/api/health` が 500 を返し始めた時刻を記録
4. 障害メールが届いた時刻を記録
5. 差を実測値とし、提案書の「10分程度が目安」と照合する
6. `HEALTH_FORCE_FAIL` を削除して再デプロイし、Up に戻ることを確認

---

## 順番の理由

Phase 1〜2 を先にやるのは、**GitHub Actions のデプロイに Vercel のIDが必要**なため。
Phase 5-1 をデプロイ後にするのは、**Vercelのドメインがデプロイするまで分からない**ため。

### 実測結果（2026-08-23）

| 時刻(JST) | 出来事 |
|---|---|
| 07:33:14 | 再デプロイ完了。`/api/health` が 500 を返し始める（T0） |
| 07:33:21 | curl で 500 を確認 `{"status":"error","reason":"forced_failure"}` |
| **07:39** | UptimeRobot から障害メール受信（受信トレイ・迷惑メール振り分けなし） |

**実測値: 約6分**（メールの表示が分単位のため、正確には5分46秒〜6分45秒の範囲）

件名は `Monitor is DOWN: case8-lumina-dashboard-chi.vercel.app/api/health`、
本文に `down in N. Virginia, USA` と検知地点が記載される。

### 提案書の「10分程度が目安」は修正しない

実測6分に合わせて提案書を「6分」に書き換えるべきか検討したが、**書き換えない。**

理由は、6分という数字が**たまたま有利なタイミングで測った1回分**でしかないため。
所要時間は構造的に次の合計になる。

```
巡回待ち（0〜5分・落ちたタイミング次第）＋ 再確認と送信（1〜2分）
```

今回は巡回待ちが約4.5分だったが、**障害が巡回の直後に発生すれば待ちは5分に近づく。**
そのうえ再確認の所要は負荷状況で変わる。最悪ケースは7分前後まで伸びうる。

**提案書は「最悪でもこの範囲に収まる」という約束として読まれる。**
実測の最短値をそのまま約束に書き換えると、余裕がなくなり、
1回でも超えたときに「約束と違う」と言われる。
10分は巡回間隔5分＋再確認を見込んだ数字で、実測はその範囲に収まった。
**提案書の見積もりは実測によって否定されたのではなく、裏づけられた。**

CLAUDE.md の方針は「実測が大きくずれたら提案書側を直す」であり、
今回は大きくずれていない（かつ安全側にずれている）ため、修正不要と判断した。

### 復旧の確認（2026-08-23 実施済み）

| 時刻(JST) | 出来事 |
|---|---|
| 07:47:46 | `HEALTH_FORCE_FAIL` 削除・再デプロイ後、`/api/health` が 200 に復帰 |
| **07:49** | UptimeRobot から復旧メール受信（`Monitor is UP`） |

**復旧通知は約1〜2分**と、障害通知（約6分）より速い。
復旧時は誤検知を防ぐための多地点での再確認が不要なため。

検収では「落ちたら分かる」だけでなく**「直ったことも分かる」**まで実演できる。
障害通知しか出ないと、復旧したかどうかを人が手で確かめに行くことになる。

### 実測後の状態

- `HEALTH_FORCE_FAIL` は削除済み。本番の環境変数は5件（実測前と同じ）
- `/api/health` 200 / `/` 307→login / `/login` 200 / `/api/cron/keep-alive` 401（秘密なし）
