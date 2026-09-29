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

## Phase 26 PR2a: プロダクトをD1に移す・公開の一覧を動的化

チャットで、最初の編集対象を**プロダクト(products.json)**に決めた。実装を進める中で、products.json は、詳細ページの静的生成(`npm run build:products`)・`issue-license.mjs`・多数のテストからも読まれており、**丸ごとD1に移すと、CI(`npm run check`。D1ネットワークなしで動く必要がある)を壊す**ことが分かった。3回チャットで確認し、次の方針に決めた。

### 決定(PR2a)

| # | 項目 | 決定 | 理由 |
| - | ---- | ---- | ---- |
| 1 | データの保存先 | 新しいテーブル **`products`**(`migrations/0008_products.sql`。`id`・`sort_order`・`data`=プロダクト1件のJSON全体・`updated_at`)。移行時点(2026-09-26)の `public/data/products.json` の2件(`escape-boss`・`kii-michi`)を、そのままINSERT(round-trip一致を確認済み) | 既存の `schema.js` の検証・形式を、まったく変えずに使える(JSONをそのまま持つ) |
| 2 | 公開の一覧の配信 | **新しいエンドポイント `GET /api/products`**(`functions/api/products.js`。ログイン不要)を追加し、D1からその場で組み立てる。**既存の静的ファイル `public/data/products.json` は、削除しない**(そのまま残す) | Cloudflare Pages は、静的ファイルがある経路では、Functionsを呼ばない。同じURL(`/data/products.json`)を動的化しようとすると、静的ファイルを消す必要があり、それに依存する他のスクリプト・テストが壊れる。**新しいURLにする**ことで、この問題を避けた |
| 3 | 静的ファイルの今後の役割 | `public/data/products.json` は、(a) 詳細ページ生成(`build-products.mjs`)・`issue-license.mjs`・実データテストの入力、(b) D1がない環境(プレビュー等)への `/api/products` のフォールバック元、として**残す**。管理画面での編集は、D1にだけ反映され、この静的ファイルには、当面反映されない(**既知の制限**。詳細ページ・ライセンス発行は、後日、再生成の仕組みを別PRで用意するまで、静的ファイルの内容のまま) | 一覧(home・search・カテゴリ・お問い合わせの選択肢)は、管理画面での変更が、**すぐ反映される**ことを優先。詳細ページ・ライセンス発行は、変更頻度が低く、多少のタイムラグが許容できると判断した |
| 4 | フォールバック | `env.DB` がない環境(プレビュー)では、`env.ASSETS.fetch()` で、静的な `public/data/products.json` を返す(壊れたページにしない) | プレビュー環境には、D1をつながない(既存方針。Googleログインのリダイレクト URI の制約)。プロダクト一覧という、アカウント機能と無関係な core な内容が、プレビューで表示できなくなるのを防ぐ |
| 5 | クライアント側の変更 | `product-list.js`・`account/client.js`・`contact/client.js`・`home/main.js`・`search/main.js`・`updates/main.js` の6箇所を、`/data/products.json` → `/api/products` に変更 | 一覧を使うすべての画面が、動的なデータを見るようにする |

### 除外(この PRではやらないこと)

- 詳細ページの動的化(候補として検討したが、サイト全体に影響するcatch-all Functionが必要になり、リスクが大きいため、別PRに切り出した)
- 実際の管理画面(編集UI)・管理APIでの変更(create/update/delete)。この PR は、公開の一覧の配信元をD1にするところまで
- `public/data/products.json` を最新に保つ自動的な仕組み(後日、別PRで検討)

### テスト結果(この PR(2a)完了時点)

- `npm run check`: **全 2019 件、成功**
- 実データでのD1移行が、`public/data/products.json` と完全に一致することを、実装時にスクリプトで確認済み(round-trip)
- `tests/products-api.test.js`(新規5件): D1からの組み立て・Cache-Control・ASSETSフォールバック・DB/ASSETSともにない場合の503・メソッド制限
- ローカルの `wrangler pages dev`(本物のSQLと同じnode:sqlite。実際にマイグレーションを適用)+ headless Edge で、ホーム・検索ページが、`/api/products` から実際に2件のプロダクトを表示することを確認(コンソールエラーなし)

## Phase 26 PR2b: プロダクトの管理API・管理画面UI

PR2a で用意した `products` テーブル・`GET /api/products` の上に、PR1 の管理者ゲート(`requireAdmin`)・監査ログ(`recordAdminChange`)を使って、実際の作成・更新・削除ができるようにした。新しいD1マイグレーションは不要(PR1・PR2aのテーブルをそのまま使う)。

### 実装した内容

- **管理API**(`functions/api/admin/products/`。すべて `requireAdmin` で入り口を確認):
  - `index.js`: `GET`(一覧。`{ products: [...] }`)・`POST`(新規作成。body は `{ product }`)
  - `[id].js`: `GET`(1件。なければ404)・`PUT`(更新。URLとbodyのidが違えば400)・`DELETE`(削除)
  - `_shared.js`(ルーティングされない内部部品。`_lib` と同じ考え方): `loadCategories`(ASSETS経由でcategories.jsonを読む。検証に使う)・`MAX_PRODUCT_BYTES`
  - 検証は、既存の `public/assets/js/products/schema.js` の `validateProducts` を、そのまま使う(サーバー用の別の検証関数を作らない。`PRODUCT_DATA_VERSION` も、そこから import する)
  - 変更(create/update/delete)は、すべて `recordAdminChange` で `admin_audit_log` に記録する(before/after つき)
  - `functions/_lib/products-db.js` に `updateProductData(db, { id, data, now })` を追加(既存の `upsertProduct` は sort_order の指定が要るが、更新では sort_order を変えないため、専用の関数にした)
- **エラー文**(`account/messages.js`): `invalid-product`・`product-id-exists`・`product-not-found`・`product-id-mismatch` を追加
- **管理画面のUI**(`/account/admin/products/`。`noindex`): 一覧(編集・削除ボタン)・新規作成・編集(モーダル)・削除確認(モーダル)。プロダクト1件分を、生のJSON(`public/data/products.json` の項目と同じ形)として、textareaで編集する(専用の入力フォームは作らない。検証は `schema.js` を使うため、サーバーと同じ判断になる)
  - `assets/js/account/client.js`: `fetchAdminProducts`・`fetchAdminProduct`・`createAdminProduct`・`updateAdminProduct`・`deleteAdminProduct`(既存の `call()` をそのまま使う)。`call()` は、サーバーが返す `details`(検証エラーの一覧)があれば、結果にそのまま含めるよう拡張した(既存の呼び出し・テストへの影響はない)
  - `assets/js/admin/products-page.js`(このページだけで使う、DOM に触れるスクリプト。`search/main.js`・`updates/main.js` と同じ、ページ固有の1ファイル構成)。`fetchMe()` の `isAdmin` で、画面を出し分ける(未ログイン・非管理者は、案内だけを表示。**実際のアクセス制御は、サーバー側の `requireAdmin` が担う**)
  - `/account/`(`public/account/index.html`)に、管理者にだけ見える「プロダクト管理」へのリンクを追加(`data-admin-link`。`main.js` が `user.isAdmin` で出し分け)
  - `assets/css/admin.css`(新規。管理画面共通の小さな部品。既存の `account.css` のクラス=`.account__form`・`.account__input` 等と、`.modal` を流用し、一覧の見た目だけを追加)
- **レート制限は追加していない**(理由は下の表)

### 決定・判断

| 項目 | 決定 | 理由 |
| ---- | ---- | ---- |
| 検証 | クライアント(将来のUI)・サーバーとも、`schema.js` の `validateProduct`/`validateProducts` を共有 | 既存の「公開一覧・詳細ページ・管理画面で、検証の実装を重複させない」方針(Phase 6・26 PR1 の踏襲) |
| id の変更 | 更新(PUT)で、body の id が URL と違えば `400 product-id-mismatch` として拒否 | id は、詳細ページ・ライセンス発行・検索などから参照される安定な識別子のため、更新経路での変更は許可しない(変更したい場合は削除+新規作成) |
| レート制限 | 追加していない | 管理API は `ADMIN_EMAILS` の少数の運営者だけが呼べる(招待制よりさらに狭い)。既存の contact・license-redeem・game-sync 等のレート制限は、不特定多数からの濫用を防ぐためのものであり、性質が異なると判断した。将来、複数運営者体制になった際に再検討する |
| 詳細ページ・products.json への反映 | この PR でも、まだ行わない(PR2a の既知の制限のまま) | PR2a の決定を踏襲。管理画面での編集は、当面 D1(`/api/products`)側だけに反映される |

### テスト結果(この時点)

- `npm run check`: **全 2039 件、成功**(lint・Prettier・html-validate・単体テスト)
- `tests/products-admin-api.test.js`(新規20件): 一覧・作成・1件取得・更新・削除の、それぞれで、未ログイン401・非管理者403・CSRF・404・409(id重複)・400(形式不正・idの一致)・監査ログへの記録・sort_orderが変わらないこと、を確認
- 実際の `public/data/categories.json` を ASSETS 経由のフェイクで読ませ、実在のカテゴリ(`tool` 等)で検証が通ることを確認
- ローカルの `wrangler pages dev`(実際にマイグレーションを適用したD1・`ADMIN_EMAILS` 等を設定)+ curl で、`GET /api/admin/products`・`GET /api/admin/products/:id` が、未ログインで正しく401を返すこと、`/account/admin/products/`(静的ページ)・`assets/js/admin/products-page.js`・`assets/css/admin.css` が200で配信されること、`GET /api/products`(公開の一覧)が引き続き正しく動くこと(回帰なし)を確認
  - **ローカルE2Eでの既知のハマりどころ**: `wrangler pages dev` の `--d1 DB=<値>` には、`wrangler.toml` の `database_name`(`nolito`)ではなく、**`database_id` の値**(ダミーID)を渡す必要がある。名前を渡すと、`wrangler d1 migrations apply` が作った永続化データ(同じ `--persist-to`)とは別のD1インスタンスが作られ、「no such table: products」になる(データの問題ではなく、コマンドの引数の問題)
  - 本物のGoogleログインを要する画面(管理者としてのログイン後の動作)は、実際のGoogle認証情報がないため、ブラウザでは確認していない。`tests/products-admin-api.test.js`・`tests/auth-flow.test.js` が、暗号学的に本物と同じ(偽のGoogleを使う)ログインの流れで、`requireAdmin` を通しでテストしている(このプロジェクトの、認証つきエンドポイントの標準的なテスト方法)

### 未実装(次の作業)

- `public/data/products.json`・詳細ページ・ライセンス発行への反映(PR2aからの既知の制限のまま。別PRで検討)
- 語録・記事・ゲーム設定・ユーザー・ランキング・問い合わせ・更新履歴など、プロダクト以外の管理対象(Phase 26のスコープを、このままプロダクトだけで完了とするかは、別途チャットで確認する)
