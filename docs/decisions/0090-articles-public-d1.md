# 0090: 公開の記事ページ・一覧・検索・更新履歴を D1 から出す(Issue #195 PR 3)

日付: 2026-10-03

## 経緯

Issue #195(決定 0086)の最後の PR。PR 1 で D1 の `articles`・API、PR 2 で管理画面の入力フォームができた。ただし、公開の記事ページは静的ファイルのままで、管理画面で保存した記事は、公開に出なかった。この PR で、公開の元を D1 に替え、既存の 7 記事を D1 へ移す。

## 変えたこと

- **公開ページ**: `/articles/`(一覧)と `/articles/<スラッグ>/` を、Functions(`functions/articles/index.js`・`[slug].js`)が、D1 からその場で組み立てる(HTML は `functions/_lib/article-pages.js`。本文の変換は、ビルド・プレビューと同じ `markdown.mjs`)。本文の生の HTML は実行せず文字にする(これまでと同じ)。下書き・ない記事・形の悪いスラッグは 404(`no-store`)。GET 以外は 405。
- **一覧・検索・更新履歴・トップ**: `/data/articles.json` ではなく `/api/articles` を読む(`home`・`search`・`updates` の `main.js`)。
- **静的な写しの移動**: Cloudflare Pages は、静的ファイルがあると、同じ URL の Functions を呼ばない。そこで、`npm run build:articles` の出力先を `public/articles/` から **`public/articles-static/`** へ替え、`public/articles/` には何も置かない。`public/_headers` で `/articles-static/*` に `X-Robots-Tag: noindex` を付ける(同じ内容の重複を検索に出さない)。
- **D1 のない環境(プレビュー等)**: Functions が `env.ASSETS` から `/articles-static/…` を返す(`/api/articles` も、これまでどおり `articles.json` にフォールバック)。D1 のない環境でも、記事が見られる。ただし、形の悪いスラッグは、写しに渡さず 404。
- **原稿の扱い**: `content/articles/*.md` は残す(D1 への取り込み元と、フォールバックの原稿)。`npm run build:articles`・`articles.json` も残す。管理画面で直した内容は、原稿には戻らない(原稿が元に戻るのは、フォールバックの環境だけ)。
- **取り込みスクリプト**: `npm run articles:import`(`scripts/import-articles.mjs`・`scripts/lib/article-import.mjs`)。運営者のパソコンで実行する(`wrangler` ログイン済み + 環境変数 `NOLITO_D1_DATABASE_ID`)。**既定は確認だけ**(取り込む/飛ばすスラッグを表示)。`-- --yes` で、`INSERT … ON CONFLICT(slug) DO NOTHING` を、一時ファイル(リポジトリの外。実行後に削除)から `wrangler d1 execute --remote --file` で流す。**すでにあるスラッグは上書きしない**(管理画面で直した内容を消さない)。原稿は、ビルドと同じ検証を通し、1 本でも問題があれば、まとめて断る。本文は、1 つの値として、引用符を二重にして入れる。

## 変えないこと

- 記事の URL(`/articles/<スラッグ>/`)・見た目・構造化データ・タグ・日付の扱い。
- Claude が、本番の D1 を直接書き換えること(取り込みは、運営者が実行する)。
- プライバシーポリシーの版(個人情報・同意に関わらない)・計測・広告(`enabled: false`)。
- 管理 API・検証・監査ログ(PR 1・2 のまま)。

## マージの順序(重要)

本番の D1 は、取り込みの前は、`articles` が空。**先にマージすると、本番の記事ページ・一覧が 404/空になる**。そのため、(1) Jさんが取り込みを実行して、終わりを伝える → (2) CI の `check` が通ったら、マージ、の順にする。取り込みは、何度実行しても安全(すでにあるものは飛ばす)。

## 既知の制限

- フォールバックの写し(`articles-static/`)は、管理画面の編集を反映しない。本番(D1 あり)には影響しない。
- 記事ページは、表示のたびに D1 を 1 回読む(記事は少数で、問題にならない規模)。

## テスト

- `tests/articles-pages.test.js`: D1 からのページ・一覧(新しい順・下書きは出ない・0 本でも落ちない)・404・405・503・D1 の更新が即反映・D1 がない環境のフォールバック・形の悪いスラッグを写しに渡さない・`public/articles/` に静的ファイルがない。
- `tests/article-import.test.js`: 引用符・改行・下書き・SQL の書き込みの安全・上書きしない・問題のある原稿は 1 本も入れない・実際の原稿がすべて取り込める・書き込みは `--yes` のときだけ。
- `tests/cache-headers.test.js`(写しの `noindex`)・`tests/articles-build.test.js`・`tests/updates.test.js`・`tests/theme.test.js`(新しいパス・読み先)。
