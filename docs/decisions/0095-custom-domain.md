# 0095 独自ドメインの採用

日付: 2026-10-05 / 対象: Issue #229

## 決定

- 運営者が取得した `nolito-jukiii.com` を、NOLITO の正規URLとして使う。
- `public/data/site.json`、Google Analytics の対象ホスト、公開ページの canonical・OGP URL・サイトマップ、運用手順の本番 URL を独自ドメインにそろえる。
- `SITE_ORIGIN` と Google OAuth のリダイレクト URI も、独自ドメインに設定する。Cloudflare Pages のカスタムドメイン・DNS、Cloudflare の本番環境変数、Google OAuth クライアントの変更は、各管理画面での設定が必要。
- 独自ドメインへの変更だけでは、個人情報の取得・利用方法は変わらないため、プライバシーポリシーの版は上げない。

## テスト・未確認事項

- `npm run check` で設定・canonical・サイトマップなどを検証する。
- Cloudflare Pages のドメイン接続・DNS、本番の `SITE_ORIGIN`、Google OAuth の許可済みドメインとリダイレクト URI は、このリポジトリから状態を確認・変更できない。公開切り替え後に、独自ドメインでログインと主要ページを確認する。
