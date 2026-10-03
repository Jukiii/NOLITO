# 0082 全ページにセキュリティ用のヘッダーを足す(Issue #189 の案 A・Issue #191)

日付: 2026-10-03

## 理由

Issue #189(セキュリティ対策の質問)で、ページ(HTML)にセキュリティ用のヘッダーがないことがわかった(API の応答には `nosniff` などが付いている)。Jさんが案 A(CSP 以外のヘッダーを足す)を選んだ(2026-10-03)。

## 変更

- `public/_headers` に、全ページ(`/*`)の規則を足した。
  - `X-Content-Type-Options: nosniff`(ブラウザが、種類を推測して実行しない)
  - `X-Frame-Options: DENY`(ほかのサイトの iframe に入れられない。クリックジャッキングの対策。サイトの中に iframe はない)
  - `Referrer-Policy: strict-origin-when-cross-origin`(別のサイトへは、ドメインだけを送る)
  - `Permissions-Policy`(カメラ・マイク・位置情報・USB・シリアル・Bluetooth を、だれにも許さない。サイトは、どれも使わない)
- 画像のキャッシュの規則(Phase 28)は、そのまま。同じパスには、両方の規則が合わさって付く。
- `npm run smoke` の `/` のチェックに、`nosniff` と `DENY` の確認を足した(公開後に、実際に付いているかを見る)。

## 入れなかったもの

- **CSP(Content-Security-Policy)**: 広告事業者のスクリプト・ドメインを許可する形になるため、事業者を決めてから、同意の仕組みとあわせて入れる(Issue #122・#123)。先に入れると、あとで広げる作業が要る。
- `/.well-known/security.txt`: 任意。連絡先(メールアドレス)を公開する判断が要るため、見送り。

## 影響範囲

- 画面・機能は変わらない。Google のログインはリダイレクト方式(iframe を使わない)なので、`X-Frame-Options: DENY` の影響はない。Pages Functions(`/api/*`・`/auth/*`)の応答には、`_headers` は効かない(API 側は、すでに `nosniff` を付けている)。
- 戻し方: `public/_headers` の `/*` の規則を消す。

## テスト

- `tests/cache-headers.test.js`: `/*` の 4 つのヘッダーと値・サイトに iframe がないこと。`tests/smoke.test.js`: `/` のヘッダーの検査。`npm run check`・`npm run audit`。
