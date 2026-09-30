# アーキテクチャ

初期は Static Site(HTML / 通常 CSS / Vanilla JS + ES Modules)。データは Markdown を管理元とし、必要に応じてビルド時に構造化データへ変換する。Cloudflare Workers(Pages Functions)・認証・DB(D1)・ライセンス API は、静的サイトから分離した構造で追加してある。決済は、外部販売サービスへのリンクだけ(自サイト決済はない)。

最終更新: Phase 30(2026-09-30)。実装との対応は、各節の参照先(`CLAUDE.md`・`docs/decisions/`)が、いちばん詳しい。

## 構成

| 層 | 場所 | 中身 |
| -- | ---- | ---- |
| 公開ページ | `public/`(Cloudflare Pages の出力ディレクトリ。ビルド工程なし) | HTML・CSS(`tokens.css` → `base.css` → `layout.css` → `components.css`)・JS(`assets/js/`。フレームワーク・バンドラなし) |
| 静的データ | `public/data/` | `products.json`・`categories.json`・`articles.json`・`jobs.json`・`roles.json`・`difficulties.json`・`vocabulary/<職種ID>.json`・`affiliates.json`。誰でも読める。**下書きを入れない** |
| 管理元(原稿) | `content/` | 記事(`articles/*.md`)・語録(`vocabulary/*.md`)。`npm run build` が、公開の JSON・HTML を生成する(生成物もコミットする) |
| サーバー処理 | `functions/`(Pages Functions) | `/api/*`・`/auth/*` だけ。共通部品は `functions/_lib/` |
| データベース | Cloudflare D1(`migrations/`) | 利用者・セッション・ライセンス・問い合わせ・ゲーム記録の要約・ランキング・設定・プロダクト・広告リンク・管理の監査ログ |
| 端末内の保存 | LocalStorage | ゲームの記録・設定・ツールのデータ・サイトの表示設定(`data-model.md`) |
| 運用の道具 | `scripts/` | ビルド・バックアップ・復元練習・問い合わせの閲覧・ライセンス発行・スモークテスト・語録の点検 |

## 主なページ(`public/`)

`/`(トップ)・`/games/`(`escape-boss/`)・`/tools/`(`kii-michi/`)・`/software/`・`/articles/`・`/search/`・`/updates/`・`/support/`(問い合わせ `#contact`)・`/about/`・`/privacy/`・`/terms/`・`/ads-policy/`・`/account/`(`noindex`。`admin/products/`・`admin/affiliates/` は管理者だけ)・`/styleguide/`(`noindex`)。

## 主な API(`functions/`)

- 公開(ログイン不要): `GET /api/products`・`GET /api/affiliates`(どちらも D1。なければ静的ファイルにフォールバック)・`GET /api/games/escape-boss/ranking`・`POST /api/contact`・`GET /api/me`。
- ログイン後: ゲームの記録の同期(`/api/games/escape-boss/sync`)・表示設定の同期(`/api/settings/sync`)・ランキング(`POST`・参加の切り替え)・プロフィール・ライセンス登録・アカウント削除。
- 管理者だけ: `/api/admin/products`・`/api/admin/affiliates`(作成・更新・削除。削除は直近 10 分のログインが要る)。
- ログイン: `/auth/google/*`(認可コード + PKCE)。詳細は `docs/auth-setup.md`・決定 0013。

## 設定を持たない環境(プレビュー等)でも壊れない

アカウント・問い合わせは、`AUTH_ENABLED`・`CONTACT_ENABLED` と DB などがそろうまで何もしない(`/api/me` は `{enabled:false}`、ほかは 503)。Google アクセス解析は、同意するまで何も要求しない。広告は `config/ads.js` の `enabled: false` の間は、何も出ない。この性質は、テストで守っている。

## 環境変数(シークレットは Cloudflare にだけ置く)

`AUTH_ENABLED`・`CONTACT_ENABLED`・`SITE_ORIGIN`・`SIGNUP_MODE`・`ALLOWED_EMAILS`・`ADMIN_EMAILS`・`GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET`・`SESSION_SECRET`(D1 は `DB` バインディング)。`GOOGLE_*_URL`・`GOOGLE_ISSUER` は、テスト用の差し替え。**コード・GitHub に、値を書かない。** 設定の手順は `docs/auth-setup.md`・`docs/contact-setup.md`。

## 設計の原則

- 仕様と設計の決定は、`docs/decisions/` に残す(変更理由・影響範囲・テスト内容)。
- 生成物(記事・プロダクト詳細・語録の JSON)は、手で書き換えない。`npm run check` が、最新かを検査する。
- 記録の形を変えるときは、版を上げ、古い版を読めるようにする(記録を消さない)。
- ゲームのロジック(`romaji.js`・`engine.js` など)は、DOM に依存させない。DOM に触れるのは、`view.js`・`input.js`・`main.js` など決まったファイルだけ。
