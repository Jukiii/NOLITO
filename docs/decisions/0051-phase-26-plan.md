# 0051 Phase 26 の計画(管理画面・RBAC)

日付: 2026-09-26 / 対象: Phase 26「管理者アカウント＋RBAC。語録・記事・ゲーム設定・プロダクト・ユーザー・ランキング・問い合わせ・更新履歴を管理。下書き→バリデーション→人間確認→公開。全端末対応。変更前後比較可能な監査ログ。」

Phase 26 は、対象が8種類(語録・記事・ゲーム設定・プロダクト・ユーザー・ランキング・問い合わせ・更新履歴)と多く、RBAC・監査ログを含む、この案件で最も大きいフェーズの1つ。着手前に、チャットで運営者に、最初のPRの範囲と、RBACの粒度を確認した。

## 運営者が決めたこと(チャットでの確認)

- **最初のPRは、基盤(管理者ゲート + 監査ログ)だけ**。実際の管理画面(語録・記事などの編集画面)は、まだ作らない
- **RBACは、単一の「管理者」フラグだけ**(いまは運営者が1人だけのため)。役職(vocab-editor 等)の細かい権限分けは、実際に複数の管理者が必要になってから作る

## 決定

| # | 項目 | 決定 | 理由 |
| - | ---- | ---- | ---- |
| 1 | 管理者の判定 | 環境変数 **`ADMIN_EMAILS`**(カンマ区切り)。既存の招待制(`ALLOWED_EMAILS`・`isInvited`)と、まったく同じパターンで、`functions/_lib/config.js` に `adminEmails(env)`・`isAdmin(env, email)` を追加する。**DB にフラグを持たせない**(環境変数の変更だけで、即座に有効/無効にできる。招待制と同じ運用上の利点) | 既存のパターンの再利用(重複させない)。招待制と同じく、環境変数だけで完結し、D1のマイグレーション・書き込みが要らない |
| 2 | 管理者かどうかの確認 | `functions/_lib/guard.js` に `requireAdmin(context, options)`(`requireUser` を呼んだあと、`isAdmin` を確認。管理者でなければ `403 not-admin`)を追加。`/api/me` の応答に `isAdmin`(真偽値)を追加する | 将来の管理画面のAPIが、共通で使える入り口を、先に用意する。`/api/me` は、既存の「いまのログイン状態」を返す入り口なので、ここに載せるのが自然(新しいエンドポイントを増やさない) |
| 3 | 監査ログ(変更前後比較可能) | 新しいテーブル **`admin_audit_log`**(`migrations/0007_admin_audit.sql`)。既存の `audit_log`(ログイン等の出来事だけ。`detail` は200字までの短い文字列)とは、**別のテーブル**にする。列: `id`・`at`・`user_id`・`resource_type`・`resource_id`・`action`・`before_json`・`after_json`。`functions/_lib/admin-audit.js` に `recordAdminChange`(書き込み。失敗しても、本来の処理は止めない=既存の`audit`と同じ考え方)・`pruneAdminAudit`(古いログを消す)を用意する | 既存の `audit_log` は、短い一行の出来事ログで、変更前後の内容を持てる形になっていない。管理画面での変更(語録・記事などの内容そのもの)は、既存のログより大きく・構造化された記録が要るため、目的の違うテーブルに分ける |
| 4 | 監査ログの保存期間 | 既存の `audit_log` と同じ **180日**(`RETENTION_SECONDS`)。バックアップの保管期間(直近6か月)とも、そろえる | 管理対象(ユーザーの管理を含む)の変更前後の記録には、個人情報(メールアドレス等)が入りうる。既存のプライバシーの約束(180日で削除)を、そのまま適用する |
| 5 | before/after の中身への制約 | **将来、実際の管理画面(ユーザー管理など)を作るときに守ること**として明記: `before_json`/`after_json` に、メールアドレスなどの個人情報を、そのまま書き込まない(必要なら、ニックネーム等の表示用の情報だけにする)。サイズの上限(1件あたり 20,000 文字)を設ける | この PR では、実際に個人情報を書き込む管理画面がまだないため、いまは強制できない。将来の実装者(自分自身を含む)への注意として、コード・決定ログに残す |
| 6 | 管理画面(UI)そのもの | **この PR では作らない**(基盤だけ)。実際の管理対象(語録・記事・ゲーム設定・プロダクト・ユーザー・ランキング・問い合わせ・更新履歴)の編集画面・下書き→バリデーション→人間確認→公開の流れ・全端末対応は、次以降のPRで、対象ごとに分けて実装する | 8種類の管理対象を、1つのPRで作ると、レビュー範囲が大きくなりすぎる。基盤(だれが管理者か・変更をどう記録するか)を、先に固める |

### 除外(この PR ではやらないこと)

- 実際の管理画面(編集UI)。語録・記事・ゲーム設定・プロダクト・ユーザー・ランキング・問い合わせ・更新履歴の、いずれも
- 下書き→バリデーション→人間確認→公開の流れの実装(対象ごとに、既存の仕組み=語録はvocab-build等が違うため、対象ごとのPRで設計する)
- 役職ベースの、細かい権限分け(将来、複数の管理者が必要になってから)

## 次のPR以降の見通し(仮)

管理対象ごとに、既存の公開のしくみ(語録=Markdown原稿+ビルド、記事=Markdown原稿+ビルド、プロダクト=products.json手動編集、等)が、それぞれ違うため、**対象ごとに1PR以上**を想定する。優先順位は、次のPR着手前に、あらためて確認する。

### テスト結果(この PR(1)完了時点)

- `npm run check`(lint・Prettier・単体テスト): **全 2014 件、成功**
- **実装した内容**:
  - `migrations/0007_admin_audit.sql`(新規): `admin_audit_log`(`id`・`at`・`user_id`・`resource_type`・`resource_id`・`action`・`before_json`・`after_json`)。`docs/auth-setup.md` の「D1 に貼る SQL」にも、同じ内容を追記(`tests/migrations-doc.test.js` が一致を検査)
  - `functions/_lib/config.js`: `adminEmails(env)`・`isAdmin(env, email)`(`ADMIN_EMAILS` 環境変数。既存の `allowedEmails`/`isInvited` と同じパターン)
  - `functions/_lib/guard.js`: `requireAdmin(context, options)`(`requireUser` を呼んだあと、管理者を確認。管理者でなければ `403 not-admin`)
  - `functions/_lib/admin-audit.js`(新規): `recordAdminChange`(書き込み失敗で本来の処理を止めない。JSON化できない値・大きすぎる値=20,000字超は、安全側に倒す)・`pruneAdminAudit`(180日で削除)
  - `functions/api/me.js`: 応答の `user` に `isAdmin`(真偽値)を追加
  - `public/assets/js/account/messages.js`: `not-admin` のエラー文を追加
- **実際の管理画面(編集UI)・実際の管理者による変更(recordAdminChangeを呼ぶ具体的なAPI)は、まだない**。この PR は、基盤(だれが管理者か・変更をどう記録する仕組みがあるか)だけ
- 新規・更新したテスト: `tests/auth-flow.test.js`(`requireAdmin`・`adminEmails`・`isAdmin`・`/api/me` の `isAdmin` を検証する9件を追加)。`tests/admin-audit.test.js`(新規8件。書き込み・削除・サイズ上限・JSON化できない値・外部キー・失敗時に落ちないこと)。`tests/backup.test.js`・`tests/fixtures/d1-export-sample.sql`(新しいテーブルを、バックアップの検査の見本に反映)
