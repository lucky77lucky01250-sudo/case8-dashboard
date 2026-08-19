# アカウント準備チェックリスト（ryuさん作業）

私（Claude）が代われない作業だけを集めたもの。上から順にやると待ち時間が最小になる。
**キーやパスワードはチャットに貼らないこと。** ファイルに直接書き込む手順にしてある。

---

## 1. Anthropic APIキー（最優先・5分）

AI分析コメントの実装に必要。これが一番長く止まるので最初に。

1. https://console.anthropic.com/ にログイン
2. 左メニュー **API Keys** → **Create Key**
3. 名前は `case8-dashboard` など
4. 表示されたキー（`sk-ant-` で始まる）をコピー
5. **Billing** で残高が0でないか確認（0だと呼び出しが失敗する。$5程度で足りる）

キーの置き場所は下の「5. 環境変数ファイル」を参照。

> 費用の目安: 提案書で月500円と計上済み。開発中の試行を含めても数百円の想定。

---

## 2. Supabase（10分）

売上データと分析結果の保存先。

1. https://supabase.com/ で **Start your project**（GitHubアカウントでログイン可）
2. **New project** を作成
   - Name: `case8-dashboard`
   - Database Password: 自動生成をコピーして手元に保管（後で使う可能性がある）
   - **Region: `Northeast Asia (Tokyo)` を選ぶ**（提案書第8項で「東京リージョン」と明記しているため）
   - Plan: Free
3. 作成完了まで2分ほど待つ
4. 左下の **Project Settings** → **API** を開き、次の2つを控える
   - Project URL（`https://xxxxx.supabase.co`）
   - `anon` `public` キー
   - `service_role` キー（**これは絶対に外部へ出さない**）

> 注意: Free プランは1週間アクセスがないと自動停止する。対策の Vercel Cron は私が実装する。

---

## 3. GitHub（5分）

CI/CD の置き場所。

1. https://github.com/new でリポジトリを作成
   - Name: `case8-dashboard`
   - **Private を選ぶ**（クライアント案件のため）
   - README・.gitignore・ライセンスは**追加しない**（こちらで作成済み）
2. 作成後に表示される URL（`https://github.com/<あなた>/case8-dashboard.git`）を控える

私が push する際に認証が必要になったら、その時点でお知らせします。

---

## 4. Vercel（10分）

本番の公開先。

1. https://vercel.com/ に GitHub アカウントでログイン
2. **Pro プランに加入**（$20/月）
   - 提案書の確定仕様。Hobby は非商用限定で、受託案件に使うと規約違反になる
3. まだ **プロジェクトの Import はしない**
   - GitHub 連携で自動デプロイが有効になると、GitHub Actions 経由のデプロイと二重になり、
     テストを通っていないコードが本番に出てしまう（decisions.md D-4）
   - 連携の設定は私が手順をお伝えしてから行う

---

## 5. 環境変数ファイル（私が用意した空欄を埋めるだけ）

プロジェクト直下の `.env.local` を開き、`ここに貼る` の部分を置き換える。
このファイルは git に含まれないので、外部に出ることはない。

```
ANTHROPIC_API_KEY=ここに貼る
NEXT_PUBLIC_SUPABASE_URL=ここに貼る
NEXT_PUBLIC_SUPABASE_ANON_KEY=ここに貼る
SUPABASE_SERVICE_ROLE_KEY=ここに貼る
```

埋め終わったら「環境変数を入れました」とだけ教えてください。中身は見せなくて大丈夫です。

---

## 6. UptimeRobot（あとで・5分）

障害検知の外部監視。**デプロイが終わってからで良い**ので、今はやらなくてよい。
カード登録不要・無料。CLAUDE.md の「通知経路の実測」の手順で私が案内します。

---

## いまの優先順位

**1 →（2, 3, 4 は順不同）→ 5** の順。
1 が終わった時点で教えていただければ、AI分析の実装を実データで検証できます。
