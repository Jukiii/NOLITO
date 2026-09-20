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
3. 下の「D1 に貼る SQL」の **0001** を、すべてコピーして、Console に貼り、実行する(テーブルが4つできます: `users`・`sessions`・`audit_log`・`rate_limits`)。
4. **Tables** タブに、4つのテーブルが見えれば成功。

> 以降、`migrations/` に新しいファイルが増える PR は、マージの**前**に、同じ手順で、その SQL を実行します(PR の説明に書きます)。**すでに実行した番号は、もう一度実行しません**(「already exists」と出ます)。
>
> Phase 9 の PR 2 の `0002_licenses.sql` は、`licenses` テーブルを足します(**Tables** に `licenses` が増えれば成功)。

### D1 に貼る SQL

Console は、貼った SQL の**改行を消して、1行にすることがあります**。SQL の `--` から後ろは、コメント(実行されない説明)なので、1行になると、後ろが全部コメントになり、`Requests without any query are not supported` と出ます。**下の SQL は、コメントを抜いてあります。**そのまま貼ってください。(`migrations/` のファイルと同じ内容で、テストが一致を確かめています。)

**0001**(`0001_init.sql`)

```sql 0001_init.sql
CREATE TABLE users (id TEXT PRIMARY KEY, google_sub TEXT NOT NULL UNIQUE, email TEXT NOT NULL, nickname TEXT NOT NULL, created_at INTEGER NOT NULL, last_login_at INTEGER NOT NULL);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, user_id TEXT REFERENCES users(id) ON DELETE SET NULL, event TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '');
CREATE INDEX audit_log_at ON audit_log(at);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL);
```

**0002**(`0002_licenses.sql`。Phase 9 の PR 2)

```sql 0002_licenses.sql
CREATE TABLE licenses (id TEXT PRIMARY KEY, key_hash TEXT NOT NULL UNIQUE, key_hint TEXT NOT NULL, product_id TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', issued_at INTEGER NOT NULL, user_id TEXT REFERENCES users(id) ON DELETE SET NULL, redeemed_at INTEGER, revoked_at INTEGER);
CREATE INDEX licenses_user ON licenses(user_id);
```

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

追加の画面の一番上に、**Type(種類)** を選ぶ欄があります。`GOOGLE_CLIENT_SECRET` と `SESSION_SECRET` は **Secret**、それ以外は **Text** にします(JSON は使いません。`AUTH_ENABLED` を JSON にすると、`true` が文字でなくなり、無効のままになります)。

| 名前 | Type | 値 |
| ---- | ---- | ---- |
| `GOOGLE_CLIENT_ID` | Text | 手順3のクライアント ID |
| `GOOGLE_CLIENT_SECRET` | **Secret** | 手順3のクライアントシークレット |
| `SESSION_SECRET` | **Secret** | 32文字以上のランダムな文字列(下のコマンドで作る) |
| `SITE_ORIGIN` | Text | `https://nolito.pages.dev`(末尾のスラッシュなし) |
| `SIGNUP_MODE` | Text | `invite`(招待制。省略しても `invite`) |
| `ALLOWED_EMAILS` | Text | ログインを許すメールアドレス(カンマ区切り。例: `you@gmail.com,friend@gmail.com`) |
| `AUTH_ENABLED` | Text | `true`(**最後に**入れる。これが `true` になるまで、機能は無効) |

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

Console は改行を消すことがあるので、SQL は、**1回に1文**ずつ、**コメントなし**で貼ります。

利用者の数:

```sql
SELECT COUNT(*) FROM users;
```

直近の出来事(メールアドレス・キーは入っていません):

```sql
SELECT datetime(at, 'unixepoch') AS at, event, detail FROM audit_log ORDER BY id DESC LIMIT 30;
```

利用者を、運営者が削除する(`someone@example.com` を書き換えて、上から順に、1文ずつ実行。ライセンスは、記録が残り、結びつきだけ外れます):

```sql
UPDATE licenses SET user_id = NULL, redeemed_at = NULL WHERE user_id = (SELECT id FROM users WHERE email = 'someone@example.com');
```

```sql
DELETE FROM users WHERE email = 'someone@example.com';
```

監査ログは、180日たったものが、ログイン時に、ときどき削除されます。

### ライセンスキーを発行する(運営者)

キーの発行は、あなたのパソコンで、次のコマンドで行います(サイトには、発行の入り口はありません)。

```
node scripts/issue-license.mjs <商品ID> --count 3 --note "テスターへ"
```

- 商品 ID は、`public/data/products.json` の `id` です(いまは `escape-boss`・`kii-michi`)。`--count` は 1〜50、`--note` は 100 文字までの自分用のメモです(利用者には見えません)。
- 画面に、**キー**(`NLTO-...`)と、**D1 に貼る SQL** が出ます。
  1. キーは、**この画面にしか出ません**(保存されません)。安全な場所に控えて、渡す人に伝えます。**チャットや GitHub には貼らないでください。**
  2. `INSERT INTO licenses ...` の行を、**すべてコピーして**、D1 の Console に貼って、実行します。実行するまで、キーは使えません。
- D1 に入るのは、キーの**ハッシュ**と、末尾 4 文字だけです。

確認・無効化(`ここにID` は、下の一覧で調べた `id`):

```sql
SELECT id, product_id, key_hint, note, datetime(issued_at, 'unixepoch') AS issued, user_id IS NOT NULL AS used, revoked_at IS NOT NULL AS revoked FROM licenses ORDER BY issued_at DESC;
```

```sql
UPDATE licenses SET revoked_at = strftime('%s', 'now') WHERE id = 'ここにID';
```

無効にしたキーは、登録済みの人の一覧にも、「無効」と出ます(登録し直しはできません)。有効に戻すには、`revoked_at = NULL` にします。

- 登録には、1人あたり **5回 / 10分**、送信元ごとに **20回 / 10分** の回数の制限があります。
- アカウントを削除すると、ライセンスの記録は残り、結びつきだけが外れます(同じキーを、また登録できます)。
- **有料機能を使えるかどうかの制御は、まだありません**(有料の配布も始まっていません)。いまのライセンスは、登録と一覧だけです。

## ローカルでの開発

- **テスト**(`npm run test`): 偽の Google と、SQLite(`node:sqlite`)で、ログインから削除までを検査します。外部には通信しません。
- **動かして確認する**: `npx wrangler pages dev public`(`wrangler` は devDependency)。`.dev.vars`(Git に入れません)に、環境変数を書きます。ローカルの D1 は、`npx wrangler d1 migrations apply nolito --local` で作ります。
  - 本物の Google で試すには、**開発用の、別の OAuth クライアント**を作り、リダイレクト URI に `http://localhost:8788/auth/google/callback` を入れて、`SITE_ORIGIN=http://localhost:8788` にします(本番のクライアントには、localhost を入れません)。
  - `SITE_ORIGIN` が `http://localhost...` のときだけ、`GOOGLE_AUTH_URL`・`GOOGLE_TOKEN_URL`・`GOOGLE_JWKS_URL`・`GOOGLE_ISSUER` で、偽の Google に差し替えられます(本番では、無視されます)。

## 一般公開の前に(Issue #19)

いまは、招待制の限定公開です。誰でもログインできるようにする前に、Issue #19 の項目(連絡先・プライバシーポリシーの改訂(版を上げる)・利用規約・Google の公開審査とドメインの確認)が要ります。その後、`SIGNUP_MODE=open` にし、フッターに「アカウント」のリンクを足します。
