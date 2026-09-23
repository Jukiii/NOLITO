# 0041 利用規約の新設・お問い合わせフォームの本番有効化

日付: 2026-09-24 / 対象: Issue #19(アカウントの一般公開の前提)への対応の続き。

運営者から、Issue #19 のおすすめに対して、次の指示があった。

- 独自ドメインは、一旦不要(取得しない)
- お問い合わせフォームを、本番で有効化する
- 利用規約を、用意する

## 決定

| # | 項目 | 決定 | 理由 |
| - | ---- | ---- | ---- |
| 1 | 独自ドメイン | **見送り**。`nolito.pages.dev` のまま、当面は運用する。Google の同意画面の「公開済み」化・ドメイン確認(Search Console)も、いったん保留 | 運営者の判断 |
| 2 | お問い合わせフォームの本番有効化 | `docs/contact-setup.md` の手順どおり、本番 D1 に `migrations/0003_inquiries.sql` を適用し、Cloudflare Pages の環境変数 `CONTACT_ENABLED` を設定した。次のデプロイから有効になる | すでに実装・テスト済みの機能。運営者の指示により実施 |
| 3 | 本番の操作を、誰が行ったか | **Claude Code が、ローカルの `wrangler`(運営者がログイン済みの認証情報)を使って、直接実行した**。以前「Cloudflareダッシュボードへのアクセスが必要で、実行できない」と伝えたのは誤りで、実際には、このマシンに `wrangler login` 済みの、本番アカウントへの書き込み権限があった。運営者の明示的な指示(「なんで有効化出来ない?」)を受けて、本番のD1・環境変数を直接操作した | 個人情報を含む本番DBへの直接操作は、通常は運営者自身が行う設計(`docs/contact-setup.md`・`docs/backup.md`)だったが、今回は、運営者の明示的な指示のもとで実施した |
| 4 | 利用規約 | `/terms/` を新設。禁止事項・アカウントの停止削除・サービスの変更中断終了・記録消失の免責・知的財産権・準拠法などを含む、個人開発の無料サービス向けの、一般的な内容にした。フッターに追加(`config/nav.js`) | 運営者の指示 |

## テスト

- `npm run check` 緑(1674件)。フッターリンクの一覧を検査するテスト(`tests/contact-page.test.js`)を更新
- 本番: `migrations/0003_inquiries.sql` の適用を確認(`inquiries` テーブルの作成)。デプロイ後、`/api/contact` が `{"enabled":true}` になることを確認

## 変更したもの

- 新規: `public/terms/index.html`、`docs/decisions/0041-terms-and-contact-enabled.md`
- 変更: `public/assets/js/config/nav.js`(フッターに「利用規約」を追加）、`tests/contact-page.test.js`
- 本番(コードの変更ではない): D1 マイグレーション `0003_inquiries.sql` を適用。Pages の環境変数 `CONTACT_ENABLED=true` を設定

## 未確認・既知事項

- 利用規約の内容は、AIによる下書き。法的な最終確認は、運営者が行うこと(元のIssue #19にも同じ注記がある)
- 独自ドメイン・Google同意画面の一般公開化は、保留のまま(Issue #19に残す)
- お問い合わせフォームの日々の運用(`npm run inquiries` での確認)は、`docs/contact-setup.md` のとおり、運営者が行う
