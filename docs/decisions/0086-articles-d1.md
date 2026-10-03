# 0086: 記事を D1 に保存し、管理画面で書けるようにする(Issue #195・#162)

日付: 2026-10-03

## 経緯

Jさんが、Issue #162 で「記事の管理は管理画面がいい」と答えた。いまの記事は、`content/articles/*.md` を管理元にして、`npm run build:articles` が静的な HTML と `articles.json` を作る(Phase 5)。管理画面から書くには、保存元を D1 に移す必要がある。Issue #195 で案を出し、Jさんが「A」(D1 に移す)を選んだ。進め方は 3 つの PR に分ける。

1. **PR 1(この決定)**: D1 の `articles` テーブル・公開の読み取り API・管理 API。
2. PR 2: 管理画面(入力フォーム・本文のプレビュー)。
3. PR 3: 公開の記事ページ・一覧・検索・更新履歴を D1 から出す。既存の 7 記事を D1 へ移す。`content/articles/*.md` を残すか消すかは、そのときにJさんと決める。

## 変えたこと(PR 1)

- `migrations/0010_articles.sql`: テーブル `articles`(`slug` 主キー・`title`・`description`・`date`・`updated`・`tags`(JSON)・`draft`・`body`(Markdown のまま)・`created_at`・`updated_at`)。本番の D1 へは、Jさんが `docs/auth-setup.md` の SQL を実行する(最初は空)。
- 公開 API `GET /api/articles`(ログイン不要): 公開(`draft = 0`)の記事だけを、新しい順に返す。形は `articles.json` と同じ `{ articles: [...] }`(本文は含めない)。`env.DB` がない環境は、静的な `/data/articles.json` にフォールバックする(プロダクト・広告と同じ形)。どちらもなければ 503。**下書きは公開の API に出さない**。
- 管理 API `/api/admin/articles`・`/api/admin/articles/:slug`: すべて `requireAdmin`。書き込みは CSRF つき。**削除だけ `recent: true`**(直近 10 分のログイン)。スラッグは URL の識別子のため、更新では変えられない(`400 article-slug-mismatch`)。
- 検証は、**原稿のビルドと同じ規則を共有**する。先頭情報(題名・説明・日付・タグ・スラッグ)は `scripts/lib/article-fields.mjs`(`frontmatter.mjs` から再エクスポート。`yaml` に依存しない)、本文は `scripts/lib/markdown.mjs` の安全な変換(生の HTML は文字にする・危険なリンク・alt のない画像・見出し 1 はエラー)。サーバー用の別の検証は作らない。本文は 50,000 文字まで。
- 監査ログ(`admin_audit_log`)の `before`/`after` には、**本文を入れず、文字数(`bodyChars`)だけ**を入れる(本文は長く、監査ログの上限を超える。個人情報の自動マスクはこれまでどおり働く)。

## 変えないこと

- いまの記事ページ・一覧・検索・更新履歴・`npm run build:articles` は、PR 3 まで、そのまま(静的ファイルが元)。この PR を入れても、公開の見た目は変わらない。
- プライバシーポリシーの版(記事の内容は、個人情報ではない)・計測・広告。

## 注意(PR 3 で確認すること)

- **Functions が npm の依存を取り込めない**(PR 1 の最初のプレビューのデプロイで、Cloudflare Pages のビルドが失敗した。ビルドコマンドなしの Pages は、依存を入れないため)。そこで、`marked` の ESM(MIT)を `scripts/lib/vendor/marked.esm.js`(+ `marked.LICENSE.md`)に同梱し、`markdown.mjs` はそれを読む。`marked` は devDependency に残し(Dependabot の更新の合図)、`tests/vendor-marked.test.js` が、同梱の写しとインストール版の一致を検査する(上がったら、コピーし直す)。同梱のファイルは、ESLint・Prettier の対象外。
- 静的な `public/articles/<スラッグ>/index.html` があるあいだは、同じ URL を Functions が処理しない(静的ファイルが先)。PR 3 で、静的な記事ページを D1 から出す方式に替えるときに扱う。

## テスト

- `tests/articles-admin-api.test.js`: 公開 API(D1・フォールバック・503・下書きが出ない)、管理 API(401/403・CSRF・作成・409・不正な内容・更新・スラッグの不一致・削除の再ログイン・監査ログに本文が入らない)、エラーの文。`tests/migrations-doc.test.js` が、SQL の手順書との一致を検査する。
