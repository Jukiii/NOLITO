# アカウント機能(Phase 9)の設定手順

運営者(あなた)が、Cloudflare と Google の管理画面で行う設定です。コードは、設定がそろうまで、何もしません(`/account/` は「準備中」と表示されます)。

> **最重要**: Google の**クライアントシークレット**と `SESSION_SECRET` は、**GitHub にも、チャット(Claude Code を含む)にも、貼らないでください**。管理画面の「シークレット」欄にだけ入力します。もし貼ってしまったら、Google Cloud でシークレットを作り直してください。

## 全体像

| 部品 | 役割 | 費用(2026年9月に確認) |
| ---- | ---- | ---- |
| Cloudflare Pages Functions(`functions/`) | ログイン・API のサーバー処理。静的ページの配信は、これまでどおり、無制限 | 無料枠: 1日10万リクエスト |
| Cloudflare D1(`migrations/`) | 利用者・セッション・監査ログの保存(SQLite) | 無料枠: 読み取り500万行/日・書き込み10万行/日・5GB |
| Google Cloud の OAuth クライアント | 「Google でログイン」 | 無料 |

限定公開(招待制)では、無料枠を超えることは、まずありません。超えたときは、ログインなどが、一時的に失敗します(静的なページは、影響を受けません)。

## 1. D1 データベースを作る

1. Cloudflare のダッシュボード → **Storage & Databases** → **D1 SQL database** → **Create database**。名前は `nolito`。
2. 作ったデータベースの **Console** タブを開く。
3. リポジトリの `migrations/0001_init.sql` の中身を、すべて貼り付けて、実行する(テーブルが4つできます: `users`・`sessions`・`audit_log`・`rate_limits`)。
4. **Tables** タブに、4つのテーブルが見えれば成功。

> 以降、`migrations/` に新しいファイルが増える PR(Phase 9 の PR 2 など)は、マージの**前**に、同じ手順で、その SQL を実行します(PR の説明に書きます)。

## 2. Pages に D1 をつなぐ(本番だけ)

1. Cloudflare → **Workers & Pages** → プロジェクト `nolito` → **Settings** → **Bindings** → **Add** → **D1 database**。
2. 変数名 `DB`、データベース `nolito`。**環境は「Production」だけ**にする。

**プレビュー(ブランチごとの URL)には、つながない**でください。プレビューでは、Google のログイン後の戻り先(リダイレクト URI)が合わないので、ログインできません。つながなければ、プレビューの `/account/` は「準備中」になり、本番のデータにも触れません。

## 3. Google のログインを用意する

1. [Google Cloud Console](https://console.cloud.google.com/) で、新しいプロジェクトを作る(名前: `NOLITO`)。
2. **Google Auth Platform**(旧: OAuth 同意画面)を開く。
   - **ブランディング**: アプリ名 `NOLITO`、ユーザーサポートメール(あなたのアドレス)、デベロッパーの連絡先メール。
   - **対象(Audience)**: ユーザーの種類は **外部**、公開ステータスは **テスト**のまま。**テストユーザー**に、ログインさせたい人の Google アカウント(あなた自身を含む)を追加する(最大100人)。
   - **データアクセス**: スコープは `openid` と `.../auth/userinfo.email` **だけ**(名前・写真は要らない)。
3. **クライアント** → **クライアントを作成** → 種類 **ウェブ アプリケーション**、名前 `NOLITO`。
   - **承認済みのリダイレクト URI**: `https://nolito.pages.dev/auth/google/callback`(**1文字も違わずに**。末尾のスラッシュなし)
   - 「承認済みの JavaScript 生成元」は、空のままでよい(ブラウザに Google のスクリプトを読み込まないため)。
4. 作成後に出る **クライアント ID** と **クライアントシークレット** を控える(シークレットは、次の手順の入力欄にだけ貼る)。

「テスト」の間は、テストユーザー以外はログインできません。これが、限定公開(招待制)の、Google 側の仕組みです。サイト側でも、`ALLOWED_EMAILS` で、二重に絞ります。

## 4. Pages の環境変数を入れる(本番)

**Settings** → **Variables and Secrets** → **Production** に、次を追加する。

| 名前 | 種類 | 値 |
| ---- | ---- | ---- |
| `GOOGLE_CLIENT_ID` | プレーンテキスト | 手順3のクライアント ID |
| `GOOGLE_CLIENT_SECRET` | **シークレット** | 手順3のクライアントシークレット |
| `SESSION_SECRET` | **シークレット** | 32文字以上のランダムな文字列(下のコマンドで作る) |
| `SITE_ORIGIN` | プレーンテキスト | `https://nolito.pages.dev`(末尾のスラッシュなし) |
| `SIGNUP_MODE` | プレーンテキスト | `invite`(招待制。省略しても `invite`) |
| `ALLOWED_EMAILS` | プレーンテキスト | ログインを許すメールアドレス(カンマ区切り。例: `you@gmail.com,friend@gmail.com`) |
| `AUTH_ENABLED` | プレーンテキスト | `true`(**最後に**入れる。これが `true` になるまで、機能は無効) |

`SESSION_SECRET` の作り方(PowerShell か、ターミナルで。出力を、そのまま入力欄に貼る):

```
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> `SESSION_SECRET` を変えると、ログイン途中の人が、やり直しになります(ログイン済みの人は、影響を受けません)。

環境変数の変更は、**次のデプロイから**反映されます。入力したら、**Deployments** → 最新の本番デプロイ → **Retry deployment**(または、何かを `main` にマージ)。

## 5. 動作確認

1. `https://nolito.pages.dev/api/me` を開く → `{"enabled":true,"user":null}` と出る(`{"enabled":false}` なら、手順2・4のどれかが足りない)。
2. `https://nolito.pages.dev/account/` を開く → 「Google でログイン」 → 自分の Google アカウントを選ぶ → `/account/` に戻り、メールアドレスが出る。
3. ニックネームを変えて、再読み込みしても残ることを確認する。ログアウトして、ログイン画面に戻ることを確認する。
4. 招待していない Google アカウント(または `ALLOWED_EMAILS` から外した自分)で、「まだ利用できません」と出ることを確認する。

うまくいかないとき:

| 症状 | 原因の候補 |
| ---- | ---- |
| Google の画面で `redirect_uri_mismatch` | 手順3のリダイレクト URI が、`SITE_ORIGIN` + `/auth/google/callback` と1文字でも違う |
| Google の画面で `access_denied`(403) | そのアカウントが、テストユーザーに入っていない |
| `/account/?error=failed` に戻る | クライアントシークレットが違う・`SESSION_SECRET` が短い。詳しい理由は、D1 の `audit_log` の `detail`(下のSQL) |
| `/account/?error=not-invited` | `ALLOWED_EMAILS` にない(大文字小文字は区別しない) |
| `{"enabled":false}` のまま | `DB` のバインディング(本番)・環境変数・`AUTH_ENABLED=true` のどれかが足りない、または再デプロイをしていない |

## 運用

### 招待する人を増やす・外す

1. Google Cloud の**テストユーザー**に、その人を追加(外す)。
2. `ALLOWED_EMAILS` に、そのメールアドレスを足す(消す)。
3. 再デプロイ。外した人は、**次のリクエストから**、ログインしていない扱いになります(セッションが残っていても)。

### 緊急停止

`AUTH_ENABLED` を `false` にして再デプロイ。ログイン・API が止まります(静的ページは、そのまま)。DB のデータは、残ります。

### データの確認・削除(D1 の Console)

```sql
-- 利用者の数
SELECT COUNT(*) FROM users;
-- 直近の出来事(メールアドレスは入っていません)
SELECT datetime(at, 'unixepoch') AS at, event, detail FROM audit_log ORDER BY id DESC LIMIT 30;
-- 利用者を、運営者が削除する(セッションも消え、監査ログは匿名になる)
DELETE FROM users WHERE email = 'someone@example.com';
```

監査ログは、180日たったものが、ログイン時に、ときどき削除されます。

## ローカルでの開発

- **テスト**(`npm run test`): 偽の Google と、SQLite(`node:sqlite`)で、ログインから削除までを検査します。外部には通信しません。
- **動かして確認する**: `npx wrangler pages dev public`(`wrangler` は devDependency)。`.dev.vars`(Git に入れません)に、環境変数を書きます。ローカルの D1 は、`npx wrangler d1 migrations apply nolito --local` で作ります。
  - 本物の Google で試すには、**開発用の、別の OAuth クライアント**を作り、リダイレクト URI に `http://localhost:8788/auth/google/callback` を入れて、`SITE_ORIGIN=http://localhost:8788` にします(本番のクライアントには、localhost を入れません)。
  - `SITE_ORIGIN` が `http://localhost...` のときだけ、`GOOGLE_AUTH_URL`・`GOOGLE_TOKEN_URL`・`GOOGLE_JWKS_URL`・`GOOGLE_ISSUER` で、偽の Google に差し替えられます(本番では、無視されます)。

## 一般公開の前に(Issue #19)

いまは、招待制の限定公開です。誰でもログインできるようにする前に、Issue #19 の項目(連絡先・プライバシーポリシーの改訂(版を上げる)・利用規約・Google の公開審査とドメインの確認)が要ります。その後、`SIGNUP_MODE=open` にし、フッターに「アカウント」のリンクを足します。
