# PROJECT STATUS

> このファイルは、Claude Codeがプロジェクトの進捗・現在地・人間による対応事項を復元するための管理ファイルです。
>
> Claude Codeは作業開始時・フェーズ完了時・作業中断時に、このファイルを確認・更新してください。

---

# 1. プロジェクト情報

| 項目           | 内容                                       |
| -------------- | ------------------------------------------ |
| プロジェクト名 | NOLITO(個人開発プロダクトポータルサイト)   |
| 開発方式       | Claude Codeによる自律開発                  |
| リポジトリ     | https://github.com/Jukiii/NOLITO(public)   |
| 本番           | https://nolito.pages.dev(Cloudflare Pages) |
| 開発開始日     | 2026-09-19頃(PR #1)                        |
| 最終更新日時   | 2026-09-30                                 |
| 現在のフェーズ | Phase 27(セキュリティ強化・監査ログ・MFA)  |
| 現在の状態     | IN_PROGRESS                                |

---

# 2. ステータス定義

| Status          | 意味                   |
| --------------- | ---------------------- |
| `NOT_STARTED`   | まだ開始していない     |
| `IN_PROGRESS`   | Claude Codeが作業中    |
| `WAITING_HUMAN` | 人間による対応待ち     |
| `BLOCKED`       | 問題により作業継続不可 |
| `COMPLETED`     | フェーズ完了           |

---

# 3. 全体進捗

| Phase    | 内容                                                                     | Status        | PR                                                            | Issue                                          | 備考                                                                                                                                                                                                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 00 | プロジェクト基盤(Static/Vanilla JS/Cloudflare Pages)                     | COMPLETED     | #1                                                            | -                                              |                                                                                                                                                                                                                                                                                                                                                                  |
| Phase 01 | 共通UI(ヘッダー・フッター・テーマ)・favicon・ライセンス表記              | COMPLETED     | #2, #3                                                        | -                                              |                                                                                                                                                                                                                                                                                                                                                                  |
| Phase 02 | ゲーム MVP(上司から逃げろ。ダッシュボード・タイピング)                   | COMPLETED     | #4                                                            | -                                              |                                                                                                                                                                                                                                                                                                                                                                  |
| Phase 03 | 役職(先輩〜会長)・キャラ・ランキング・称号・実績                         | COMPLETED     | #5                                                            | -                                              |                                                                                                                                                                                                                                                                                                                                                                  |
| Phase 04 | 成績・入力分析・語録の初期形                                             | COMPLETED     | #6, #7                                                        | -                                              |                                                                                                                                                                                                                                                                                                                                                                  |
| Phase 05 | 記事・Google Analytics(同意ベース)                                       | COMPLETED     | #8, #9, #10                                                   | -                                              |                                                                                                                                                                                                                                                                                                                                                                  |
| Phase 06 | プロダクト一覧(products.json/categories.json)                            | COMPLETED     | #11                                                           | -                                              |                                                                                                                                                                                                                                                                                                                                                                  |
| Phase 07 | プロダクト詳細ページ(静的生成)                                           | COMPLETED     | #14                                                           | #12(公開前提。未着手・WAITING_HUMAN)           | 有料ソフト公開前に、販売サービス選定・特定商取引法の表記が必要                                                                                                                                                                                                                                                                                                   |
| Phase 08 | ツール基盤 + 最初のツール「キーみち」                                    | COMPLETED     | #16, #17, #18                                                 | #15(解決済み・クローズ)                        |                                                                                                                                                                                                                                                                                                                                                                  |
| Phase 09 | アカウント(Google ログイン)・ライセンス                                  | COMPLETED     | #20, #21                                                      | #19(一般公開の前提。未着手・WAITING_HUMAN)     | いまは招待制(SIGNUP_MODE=invite)                                                                                                                                                                                                                                                                                                                                 |
| Phase 10 | バックアップ・更新履歴・問い合わせ                                       | COMPLETED     | #22, #23, #24                                                 | #13(問い合わせ先の決定。未着手・WAITING_HUMAN) | CONTACT_ENABLED はまだ未設定の可能性                                                                                                                                                                                                                                                                                                                             |
| Phase 11 | 語録の確認フロー・語録拡充                                               | COMPLETED     | #25, #28                                                      | -                                              |                                                                                                                                                                                                                                                                                                                                                                  |
| Phase 12 | 用語確認モード・復習リスト・距離の計算式                                 | COMPLETED     | #26, #27, #29                                                 | -                                              |                                                                                                                                                                                                                                                                                                                                                                  |
| Phase 13 | 出題(苦手語の重み)・入力方式・成績項目(版3)                              | COMPLETED     | #30, #31, #32                                                 | -                                              |                                                                                                                                                                                                                                                                                                                                                                  |
| Phase 14 | 語録の原稿管理(Markdown)・詳細説明表示                                   | COMPLETED     | #33, #34                                                      | -                                              |                                                                                                                                                                                                                                                                                                                                                                  |
| Phase 15 | ゲーム画面の場面・職種別背景                                             | COMPLETED     | #35, #36                                                      | -                                              |                                                                                                                                                                                                                                                                                                                                                                  |
| Phase 16 | キャラクターの絵・演出とセリフ・音                                       | COMPLETED     | #37, #38, #39                                                 | -                                              |                                                                                                                                                                                                                                                                                                                                                                  |
| Phase 17 | 役職ごとの文字数・特殊ルール・ルール演出・役職別演出                     | COMPLETED     | #40, #41, #42                                                 | -                                              |                                                                                                                                                                                                                                                                                                                                                                  |
| Phase 18 | 難易度個別選択・開始前の確認欄・経験値/レベル/熟練度・隠し実績・改善記録 | **COMPLETED** | PR1=#43, PR2=#44, PR3=#47, PR4=#49                            | -                                              | 4 PR すべて完了・マージ・本番確認済み(0036〜0039決定ログ)                                                                                                                                                                                                                                                                                                        |
| Phase 19 | 未登録プレイ+アカウント移行・公開範囲設定・オンラインランキング          | **COMPLETED** | PR1=#56, PR2=#58, PR3=#61(すべて本番マイグレーション適用済み) | -                                              | 3 PR すべて完了・マージ・本番確認済み(0042〜0044決定ログ)                                                                                                                                                                                                                                                                                                        |
| Phase 20 | ナビ拡張・トップページ・検索                                             | **COMPLETED** | PR1=#63, PR2=#64, PR3=#65                                     | -                                              | 3 PR すべて完了・マージ・本番確認済み(0045決定ログ)。静的サイトのみの変更のため、本番マイグレーションなし                                                                                                                                                                                                                                                        |
| Phase 21 | テーマ(ライト/ダーク)・アクセシビリティ強化                              | **COMPLETED** | PR1=#67, PR2=#69, PR3=#71(本番マイグレーション適用済み)       | -                                              | 3 PR すべて完了・マージ・本番確認済み(0046決定ログ)                                                                                                                                                                                                                                                                                                              |
| Phase 22 | キーボード/タッチ操作・端末最適化                                        | **COMPLETED** | PR1=#73, PR2=#75, PR3=#77                                     | -                                              | 3 PR すべて完了・マージ・本番確認済み(0047決定ログ)                                                                                                                                                                                                                                                                                                              |
| Phase 23 | BGM/効果音の役職別拡張・演出設定                                         | **COMPLETED** | PR1=#79, PR2=#81, PR3=#83                                     | -                                              | 3 PR すべて完了・マージ・本番確認済み(0048決定ログ)                                                                                                                                                                                                                                                                                                              |
| Phase 24 | 語録の拡張ファイル・役職/難易度専用語のしくみ                            | **COMPLETED** | #87                                                           | #85(解決・クローズ)                            | 運営者が候補Bを選択。0049決定ログ。実際の専用語の追加(下書き→確認→公開)は、別の作業として継続中                                                                                                                                                                                                                                                                  |
| Phase 25 | AI活用(改善提案・類似語チェック・流れの文書化)                           | **COMPLETED** | PR1=#89, PR2=#90, PR3=#91                                     | -                                              | 3 PR すべて完了・マージ済み(0050決定ログ)。管理画面アップロードはPhase26待ち                                                                                                                                                                                                                                                                                     |
| Phase 26 | 管理画面・RBAC                                                           | **COMPLETED** | PR1=#93, PR2a=#95, PR2b=#97                                   | -                                              | ユーザーがチャットで確認: プロダクトの管理画面(PR1・PR2a・PR2b)でPhase 26を完了とし、他の管理対象(語録・記事等)は着手しない。本番D1マイグレーションはPR1・PR2aまで適用済み(PR2bは新規マイグレーションなし)                                                                                                                                                       |
| Phase 27 | セキュリティ強化・監査ログ・MFA                                          | **COMPLETED** | PR1=#99, PR2=#101, PR3=#103, PR4=#109, PR5=#111, PR6=#113     | -                                              | PR1(依存の脆弱性チェック)・PR2(管理APIの削除に再認証を要求)・PR3(依存の自動更新=Dependabot)・PR4(バックアップの復元テストを自動化)・PR5(監査ログの個人情報を自動でマスク)・PR6(バックアップの世代管理=backup:prune)完了・マージ済み。将来MFA・暗号化は、対象が具体化していないため、複数運営者体制・外部保管を始めるときに改めて範囲を決める(0052・0053決定ログ) |
| Phase 28 | パフォーマンス・監視・CI/CD強化                                          | COMPLETED     | PR1=#115、PR2=#117                                            | -                                              |                                                                                                                                                                                                                                                                                                                                                                  |
| Phase 29 | 広告・アフィリエイト・収益化                                             | IN_PROGRESS   | PR1=#120, PR2=#124                                            | -                                              | Phase 29 まで広告事業者スクリプトを入れない方針(CLAUDE.md)                                                                                                                                                                                                                                                                                                       |
| Phase 30 | 全体仕様の統合ドキュメント                                               | NOT_STARTED   | -                                                             | -                                              |                                                                                                                                                                                                                                                                                                                                                                  |

---

# 4. 現在の作業

## Current Phase

```text
Phase 26(管理画面・RBAC)は、プロダクトの管理画面(PR1・PR2a・PR2b)で完了と、ユーザーがチャットで
確認した。Phase 27(セキュリティ強化)PR1(依存の脆弱性チェック)・PR2(管理APIの削除に再認証を
要求)・PR3(依存の自動更新=Dependabot)・PR4(バックアップの復元テストを自動化)も完了・
マージ済み。次のPhase 27 PR(監査ログの個人情報対策など)は、着手前にチャットで範囲を確認する。
```

## Current Status

```text
IN_PROGRESS(Phase 29 PR2 完了=アフィリエイト・広告のリンク情報のデータ化と「PR」「広告」表示の部品。表示はまだ無効)
```

## Current Branch

```text
main(Phase 27 PR4=#109 でマージ済み。あわせて、npm audit が検出したundiciの深刻度悪化=high を
package-lock.jsonの更新=npm audit fixで解消済み)
```

## Current Task

```text
Phase 27 の次のPR(監査ログの個人情報対策・世代管理・暗号化・MFA のいずれか)の範囲を、
次回チャットで確認してから着手する。
```

## Current Step

```text
Phase 27 PR4(バックアップの復元テストを自動化)のマージまで完了。実際にCloudflareアカウントに
使い捨てのD1を作り、見本データを読み込んで、実際のD1に問い合わせて件数を確認し、削除する一連の
流れを、このセッション内で実際に確認済み(scripts/restore-drill.mjs)。作業中、npm run audit が
undiciの深刻度悪化(moderate→high)を検出し、npm audit fix(forceなし)で解消(package-lock.json
のみ更新。wranglerは既存のsemver範囲内で4.144.0に上がっただけ)。PR1の監査ゲートが、実際に機能した
実例として記録した(決定ログ0052)。
次回セッションの最初に、次のPhase 27 PRの範囲をAskUserQuestionで確認してから、実装に着手する。
```

---

# 5. 現在のフェーズ詳細

## Phase 18(完了)

### 仕様書

```text
docs/01_phases/phase-18.md
docs/decisions/0036-phase-18-levels.md(PR1)
docs/decisions/0037-phase-18-difficulty.md(PR2)
docs/decisions/0038-phase-18-achievements.md(PR3)
docs/decisions/0039-phase-18-stats.md(PR4)
```

### フェーズ状態

```text
COMPLETED(PR1〜PR4 すべて完了。マージ・本番確認済み)
```

### 作業チェックリスト(PR4 = 完了分。Phase 18 の最後)

- [x] 仕様書を確認
- [x] 前PR(PR3)の状態を確認
- [x] Gitの状態を確認
- [x] GitHub Issueを確認
- [x] GitHub PRを確認
- [x] 既存コードを確認
- [x] 実装計画を作成
- [x] 実装開始
- [x] 実装完了
- [x] テスト実施(単体1674件・実ブラウザ10/10)
- [x] Build確認
- [x] 問題修正(あわせて、既知の flaky テストを別PR #48 で修正)
- [x] 最終確認
- [x] コミット
- [x] Push
- [x] Pull Request作成(#49)
- [x] PR内容確認(CI green)
- [x] フェーズ完了(PR4はマージ・本番0.23.0で確認済み)
- [x] **Phase 18 全体が完了**

## Phase 19(進行中)

### 仕様書

```text
docs/01_phases/phase-19.md
docs/decisions/0042-phase-19-plan.md(全体の計画。PR1〜PR3の内訳)
```

### PR の内訳

- **PR 1(完了)**: 記録のJSON書き出し・読み込み。プライバシーへの影響なし
- **PR 2(次)**: アカウント移行(ログイン時に記録をサーバーに保存)・初回アクセス時の登録案内。**着手前に、プライバシーポリシーの改定内容を、運営者に確認する**
- **PR 3**: プロフィール公開範囲の設定・オンラインランキング。同じく、着手前にポリシー改定を確認する

### 作業チェックリスト(PR1 = 完了分)

- [x] 仕様書を確認・実装計画(docs/decisions/0042)を作成
- [x] 実装(storage.js の exportJson/parseImport/importJson・画面)
- [x] テスト実施(単体1696件・実ブラウザ9/9)
- [x] コミット・Push・Pull Request作成(#56)・マージ・本番0.24.0で確認済み
- [x] **PR 1 完了**

---

# 6. 現在の作業内容

### 今何をしているか

```text
Phase 26のスコープをチャットで確認し(プロダクトだけで完了)、Phase 27(セキュリティ強化)へ進んだ。
Phase 27 PR1(依存の脆弱性チェック)・PR2(管理APIの削除に再認証を要求)・PR3(依存の自動更新
=Dependabot)・PR4(バックアップの復元テストを自動化)を、いずれもチャットで範囲を確認したうえで
実装・テスト・マージまで完了した。次は、Phase 27の次のPRの範囲を確認する。
```

### 次に行う作業

```text
1. Phase 29 PR3: リンク情報の管理画面での管理(Phase 26 のプロダクト管理と同じ形。D1・監査ログ)
2. 運営者の確認待ち: /ads-policy/ の文言(Issue #122)、広告事業者の契約・ポリシー版5(Issue #123)
```

### 最後に完了した作業

```text
Phase 28 PR2: 運用の手順書と公開後の簡易チェック(PR #117、マージ済み)。
docs/operations.md(気づく・止める・戻す・確認・記録)と、npm run smoke -- <URL>(主要ページ・404・APIのJSON・
画像キャッシュ・同意前にGoogleを読み込まないことを、読むだけで確認)。本番で13件すべて合格。テスト8件追加
(全2075件成功)。外部の監視・通知サービスは入れていない(規約・費用・送信の確認が要るため)。決定は0053。

(以下、Phase 28 PR1 の記録。参考として残す)
Phase 28 PR1: キャッシュ制御(PR #115、マージ済み)。
public/_headers で、画像(/assets/img/*・/favicon.svg)だけ 1 日キャッシュ。JS・CSS・HTML・data は
再検証のまま(ファイル名に版がないため)。プレビューで応答ヘッダーを確認済み。テスト4件追加(全2067件成功)。
決定は0053、CLAUDE.md に追記。Phase 27 は、MFA・暗号化を保留として区切り、COMPLETED にした。

(以下、Phase 27 PR6 の記録。参考として残す)
Phase 27 PR6: バックアップの世代管理(PR #113、マージ済み)。
npm run backup:prune(scripts/prune-backups.mjs・scripts/lib/backup-retention.mjs)。直近6か月より古い
手元のバックアップを、既定は候補表示のみ・--delete で削除。名前の日時(UTC)で判断し、最新1つは残す。
テスト14件追加(全2063件成功)。決定は0052、CLAUDE.md・docs/backup.md に追記。

(以下、Phase 27 PR4 の記録。参考として残す)
Phase 27 PR4: バックアップの復元テストを自動化(PR #109、マージ済み)。

実装内容:
- scripts/restore-drill.mjs(新規)。npm run backup:restore-drill。
  - 使い捨てのD1を、実際にCloudflareへ作り、見本(既定。tests/fixtures/d1-export-sample.sql)
    または実際のバックアップ(--file)を読み込む
  - テーブルごとの件数を、実際のCloudflare D1に問い合わせて表示する
  - 最後に、使い捨てのD1を必ず削除する(finally。削除に失敗しても、手動削除の案内を出す)
  - 本番のD1(nolito)には、いっさい触れない(新しく作って、消すだけ)
  - 壊れたファイルは、使い捨てのD1を作る前に(メモリ上の検査で)断る
- scripts/lib/backup.mjsのwranglerConfig・scripts/lib/wrangler-remote.mjsのrunWranglerD1/
  captureWranglerD1に、databaseName引数を追加(既定"nolito"。後方互換)。同ファイルに、
  captureWranglerAccountLevel(D1の作成・削除・一覧)を追加
- docs/backup.md §5「復元の練習」を、この1コマンドの説明に置き換えた

**このセッション内で、実際にCloudflareアカウントに対して1回実行し、確認した**: 使い捨てのD1を
作成→見本データ(11テーブル)を読み込み→実際のD1に問い合わせて件数が見本どおりであることを確認→
削除→wrangler d1 listで本番のnolitoだけが残っていることを確認。壊れたファイルでは、D1を作らずに
断ることも確認した。

npm run check(全2043件、成功。新規3件)。

**副産物**: 作業中、npm run audit(PR1)が、undici(wranglerの間接依存)の深刻度悪化
(moderate→high。GHSAアドバイザリDBの更新による)を検出した。npm audit fix(forceなし)で解消
(package-lock.jsonのみ更新。wranglerは既存のsemver範囲=^4.141.0内で4.144.0に上がっただけ。
破壊的変更なし)。npm run auditがfound 0 vulnerabilitiesになることを確認し、このPRに含めた。

決定・テスト結果はdocs/decisions/0052-phase-27-plan.md(PR4の節)。CLAUDE.mdに
「バックアップの復元テスト(Phase 27 PR 4)」節を追加。

**Phase 27 PR3(依存の自動更新をDependabotで設定。PR #103)・PR2(管理APIの削除操作に再認証を
要求。PR #101)・PR1(依存の脆弱性チェックをCIに追加。PR #99)は、この前に完了した**。

**Phase 27 PR2(管理APIの削除操作に再認証を要求。PR #101)・PR1(依存の脆弱性チェックをCIに
追加。PR #99)は、この前に完了した**。

---
(以下、Phase 27 PR1・PR2 の記録。参考として残す)

Phase 27 PR1: 依存の脆弱性チェックをCIに追加(PR #99、マージ済み)。

実装内容:
- package.jsonに "audit": "npm audit --audit-level=high" を追加
- CI(.github/workflows/ci.yml)のcheckジョブに、npm run checkのあとの手順として npm run audit
  を追加
- しきい値はhigh(moderate以下ではCIを止めない)。理由: wrangler(devDependency。配信物には
  含まれない)が依存するundiciに、moderateの既知の脆弱性(WebSocketのpermessage-deflate展開での
  DoS)があるが、最新のwranglerでも直っておらず(Cloudflare側の対応待ち)、moderateでCIを止めると
  恒久的に赤くなるため
- 対象はdevDependenciesを含む全ての依存(--omit=devは使わない。本プロジェクトにdependencies=
  本番用の依存はないため)

この PR でやらないこと(次のPR以降): 依存の自動更新(Dependabot等)・再認証の拡張・バックアップの
復元テスト・監査ログの個人情報対策の強化・世代管理・暗号化・MFA。

npm run check(全2039件、変更なし)・npm run audit(moderateが表示されるが終了コード0)を確認。
決定・テスト結果はdocs/decisions/0052-phase-27-plan.md。CLAUDE.mdに「セキュリティ強化(Phase 27)」
節・「依存の脆弱性チェック(Phase 27 PR 1)」節を追加。

**この前に、Phase 26(管理画面・RBAC)を、プロダクトの管理画面(PR1=#93・PR2a=#95・PR2b=#97)で
完了とすることを、ユーザーがチャットで確認した**(他の管理対象=語録・記事等には広げない)。

---
(以下、Phase 26 PR2b の記録。参考として残す)

Phase 26 PR2b: プロダクトの管理API・管理画面UI(PR #97、マージ済み)。

実装内容:
- 管理API(functions/api/admin/products/。すべて requireAdmin で入り口を確認)
  - index.js: GET(一覧)・POST(新規作成)
  - [id].js: GET(1件)・PUT(更新。URLとbodyのidが違えば400)・DELETE(削除)
  - 検証は、既存の schema.js の validateProducts・PRODUCT_DATA_VERSION をそのまま使う
  - 変更は、すべて recordAdminChange で admin_audit_log に記録(before/after つき。
    PR1の監査ログを、初めて実際に使った)
  - products-db.js に updateProductData(sort_order を変えない更新)を追加
- 管理画面UI(/account/admin/products/。noindex)
  - 一覧(編集・削除ボタン)・新規作成・編集(モーダル)・削除確認(モーダル)
  - プロダクト1件分を、生のJSONとしてtextareaで編集(検証はサーバーと同じschema.js)
  - fetchMe()のisAdminで画面を出し分け(実際のアクセス制御はサーバー側のrequireAdmin)
  - /account/ に、管理者にだけ見える「プロダクト管理」へのリンクを追加
- 新しいエラー文: invalid-product・product-id-exists・product-not-found・product-id-mismatch
- レート制限は追加していない(ADMIN_EMAILSの少数の運営者だけが呼べるため。理由は決定ログに記載)

**新しいD1マイグレーションは不要**(PR1のadmin_audit_log・PR2aのproductsテーブルをそのまま使う)。
本番のADMIN_EMAILSは、まだ運営者が設定していない(設定されるまで、管理APIは全員に403を返す。
これは想定どおりの安全側の挙動)。

単体テスト2039件、すべて成功(新規tests/products-admin-api.test.js 20件)。ローカルのwrangler pages
devで、実際にマイグレーションを適用したD1・ADMIN_EMAILS等を設定し、管理APIの401応答・静的ページ/JS/
CSSの配信・GET /api/products(公開の一覧)の回帰なしをcurlで確認した。本物のGoogleログインを要する
画面の動作は、確認環境がないためブラウザでは未確認(requireAdminの通しの動作は、偽のGoogleを使う
既存の方式=tests/auth-flow.test.jsと同じでテスト済み)。

決定・テスト結果はdocs/decisions/0051-phase-26-plan.md(PR2bの節)。CLAUDE.mdに
「プロダクトの管理API・管理画面UI」節を追記。

**Phase 26 PR2a(プロダクトをD1に移す・公開の一覧を動的化。PR #95)・PR1(管理者ゲート・監査ログの
基盤。PR #93)は、この前に完了した**。
```

### 最後に変更したファイル

```text
.claude/PROJECT_STATUS.md(このファイル)
```

### 最後のコミット

```text
(このPROJECT_STATUS.md更新のコミット。git log --oneline -1 で確認)
```

---

# 7. 人間による対応事項

## 現在のHuman Tasks

```text
なし(いま作業をブロックしているものはない)
```

## 対応待ちIssue

| Issue | 内容                                                                         | 状態                | 作業再開条件                                                           |
| ----- | ---------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------- |
| #12   | 外部販売サービスの選定・特定商取引法の表記(有料ソフト公開前)                 | OPEN(WAITING_HUMAN) | 有料ソフトを実際に公開するタイミングで、運営者の判断が必要             |
| #13   | お問い合わせ先の決定(サイト紹介・プライバシーポリシー・サポート)             | 実質解決(下記）     | お問い合わせフォームを、正式な連絡先として本番で稼働中                 |
| #19   | アカウントの一般公開の前提(連絡先・ポリシー改定・規約・Google審査・ドメイン) | OPEN(WAITING_HUMAN) | 独自ドメインの判断が変わるか、Google同意画面の公開化の指示があれば再開 |
| #85   | Phase 24「語録の拡張ファイル」の仕様の解釈(候補A〜D)                         | 解決・クローズ済み  | 運営者が候補Bを選択(チャット上)。PR #87 でマージ済み                   |

**#19 の対応状況(2026-09-24)**:

- 完了: プライバシーポリシーの補足(PR #51）/ 利用規約 `/terms/` の新設（PR #54）/ お問い合わせフォームの本番有効化(D1マイグレーション適用・`CONTACT_ENABLED=true`。PR #54のマージで実施。**Claude Codeが、運営者ログイン済みのwranglerで、本番D1・環境変数を直接操作した**)
- 運営者の指示: **独自ドメインは一旦見送り**。Google同意画面の「公開済み」化も、それに伴い保留
- 残り: アカウントの一般公開(`SIGNUP_MODE=open`)自体は、独自ドメインの判断が変わらない限り、保留のまま。お問い合わせフォームの実送信テスト(`docs/contact-setup.md` 4-3）は、安全のため運営者が実施

これらは、いずれも今後のフェーズの一部(有料ソフト公開・アカウント一般公開)をブロックする。**Phase 19(オンラインランキング・アカウント移行)は、#19 と関係が深いため、着手時に、どこまで実装してどこで止めるか(WAITING_HUMAN にするか)を、最初に見極める**。

---

# 8. ブロックされている作業

## 現在のBlocker

```text
なし
```

## Blocker詳細

```text
なし
```

## 解決に必要なこと

```text
なし
```

---

# 9. Git / GitHub 状態

## Current Branch

```text
main
```

## Last Commit

```text
(PR #109 のマージコミット。git log --oneline -1 で確認)
```

## Pull Request

```text
直近マージ: #109(Phase 27 PR4。バックアップの復元テストを自動化。あわせて、npm audit fixで
undiciの深刻度悪化=highを解消)、
#105(dependabot。actions/setup-node 4→7)、#106(dependabot。npm-minor-patch
グループ=marked・prettier・wrangler)、#104(dependabot。actions/checkout 4→7)
(この3件は、Phase 27 PR3=#103 で設定したDependabotが、マージ直後に自動で開いた最初のバッチ。
いずれもCI green・`npm run check`/`npm run audit`確認のうえマージ)、
#107(chore。PROJECT_STATUS.mdにPhase 27 PR3完了を反映)、
#103(Phase 27 PR3。依存の自動更新をDependabotで設定)、
#102(chore。PROJECT_STATUS.mdにPhase 27 PR2完了を反映)、
#101(Phase 27 PR2。管理APIの削除操作に再認証を要求)、
#100(chore。PROJECT_STATUS.mdにPhase 26完了・Phase 27 PR1完了を反映)、
#99(Phase 27 PR1。依存の脆弱性チェックをCIに追加。npm audit --audit-level=high)、
#97(Phase 26 PR2b。プロダクトの管理API・管理画面UI。新規D1マイグレーションなし)、
#93(Phase 26 PR1。管理者ゲート・監査ログの基盤。本番D1マイグレーション適用済み)
オープン中: なし
```

## Open Issues

```text
#12, #13, #19(上の表のとおり。いずれも WAITING_HUMAN、いまの作業のブロッカーではない)
#85 は、解決してクローズした
```

## Uncommitted Changes

```text
.claude/PROJECT_STATUS.md(このファイル。次のコミットで反映)・.vscode/(意図的に未コミット)
```

---

# 10. フェーズ完了履歴

| Phase         | 完了日時       | PR             | 主な実装内容                                                                                                         |
| ------------- | -------------- | -------------- | -------------------------------------------------------------------------------------------------------------------- |
| Phase 00      | 2026-09-19頃   | #1             | プロジェクト基盤                                                                                                     |
| Phase 01      | 2026-09-19頃   | #2, #3         | 共通UI・favicon・ライセンス表記                                                                                      |
| Phase 02      | 2026-09-19頃   | #4             | ゲーム MVP                                                                                                           |
| Phase 03      | 2026-09-19頃   | #5             | 役職・ランキング・称号・実績                                                                                         |
| Phase 04      | 2026-09-19頃   | #6, #7         | 成績・語録初期形                                                                                                     |
| Phase 05      | 2026-09-19頃   | #8, #9, #10    | 記事・Analytics                                                                                                      |
| Phase 06      | 2026-09-19頃   | #11            | プロダクト一覧                                                                                                       |
| Phase 07      | 2026-09-19頃   | #14            | プロダクト詳細ページ                                                                                                 |
| Phase 08      | 2026-09-19〜20 | #16, #17, #18  | ツール基盤・キーみち                                                                                                 |
| Phase 09      | 2026-09-20頃   | #20, #21       | アカウント・ライセンス                                                                                               |
| Phase 10      | 2026-09-20頃   | #22, #23, #24  | バックアップ・更新履歴・問い合わせ                                                                                   |
| Phase 11      | 2026-09-20頃   | #25, #28       | 語録の確認フロー・拡充                                                                                               |
| Phase 12      | 2026-09-20〜21 | #26, #27, #29  | 用語確認・復習リスト・距離式                                                                                         |
| Phase 13      | 2026-09-21頃   | #30, #31, #32  | 出題・入力方式・成績版3                                                                                              |
| Phase 14      | 2026-09-21頃   | #33, #34       | 語録原稿管理・詳細説明                                                                                               |
| Phase 15      | 2026-09-21頃   | #35, #36       | 場面・職種別背景                                                                                                     |
| Phase 16      | 2026-09-21頃   | #37, #38, #39  | 絵・演出とセリフ・音                                                                                                 |
| Phase 17      | 2026-09-21〜22 | #40, #41, #42  | 文字数・特殊ルール・演出                                                                                             |
| Phase 18 PR1  | 2026-09-23     | #43            | 経験値・レベル・職種別熟練度(記録版4)                                                                                |
| Phase 18 PR2  | 2026-09-24     | #44            | 難易度の選択・開始前の確認欄(記録版5)                                                                                |
| (chore)       | 2026-09-24     | #45            | 進捗管理ファイル(.claude/)の整備                                                                                     |
| (fix)         | 2026-09-24     | #46            | license-issue.mjs の flaky テスト修正                                                                                |
| Phase 18 PR3  | 2026-09-24     | #47            | 隠し実績・実績の種類の追加                                                                                           |
| (fix)         | 2026-09-24     | #48            | auth-flow.test.js の flaky テスト修正                                                                                |
| Phase 18 PR4  | 2026-09-24     | #49            | 成績ページの改善記録・ハイスコア表(**Phase 18 完了**）                                                               |
| (chore/fix)   | 2026-09-24     | #50, #51       | 進捗ファイル整備・プライバシーポリシー補足                                                                           |
| (chore/fix)   | 2026-09-24     | #54, #55       | 利用規約新設・お問い合わせフォーム本番有効化                                                                         |
| Phase 19 PR1  | 2026-09-24     | #56            | 記録のJSON書き出し・読み込み                                                                                         |
| (chore)       | 2026-09-24     | #57            | 進捗ファイル整備(Phase 19 PR1 完了の反映)                                                                            |
| Phase 19 PR2  | 2026-09-24     | #58            | ゲームの記録のアカウント移行(同期。本番マイグレーション適用済み)                                                     |
| (chore)       | 2026-09-24     | #59, #60       | 進捗ファイル整備(Phase 19 PR2 完了・本番適用の反映)                                                                  |
| Phase 19 PR3  | 2026-09-24     | #61            | プロフィール公開範囲・オンラインランキング(**Phase 19 完了**）                                                       |
| (chore)       | 2026-09-24     | #62            | 進捗ファイル整備(Phase 19 完了の反映)                                                                                |
| Phase 20 PR1  | 2026-09-24     | #63            | ヘッダーメニュー拡張・モバイル下部固定バー                                                                           |
| Phase 20 PR2  | 2026-09-24     | #64            | トップページ(おすすめ・カテゴリ別・最新情報)                                                                         |
| Phase 20 PR3  | 2026-09-24     | #65            | 検索(プロダクト・記事・用語+カテゴリ・タグ・職種。**Phase 20 完了**）                                                |
| (chore)       | 2026-09-24     | #66            | 進捗ファイル整備(Phase 20 完了の反映)                                                                                |
| Phase 21 PR1  | 2026-09-24     | #67            | ライト・ダーク・システムテーマ                                                                                       |
| (chore)       | 2026-09-24     | #68            | 進捗ファイル整備(Phase 21 PR1 完了の反映)                                                                            |
| Phase 21 PR2  | 2026-09-24     | #69            | 文字サイズ・アニメーション軽減の切替、キーボード/コントラスト点検                                                    |
| Phase 21 PR3  | 2026-09-24     | #71            | テーマ・文字サイズ・アニメーション軽減のアカウント同期(**Phase 21 完了**。本番マイグレーション適用済み)              |
| (chore)       | 2026-09-24     | #72            | 進捗ファイル整備(Phase 21 完了の反映)                                                                                |
| Phase 22 PR1  | 2026-09-25     | #73            | モバイル・ソフトウェアキーボード対応・縦横自動調整・回転対応                                                         |
| Phase 22 PR2  | 2026-09-25     | #75            | タッチ操作の点検(既存実装が基準を満たすことを確認。コード修正なし)                                                   |
| Phase 22 PR3  | 2026-09-25     | #77            | 低性能端末向け設定「グラフィックを抑える」・最適化点検(**Phase 22 完了**)                                            |
| (chore)       | 2026-09-25     | #78            | 進捗ファイル整備(Phase 22 完了の反映)                                                                                |
| Phase 23 PR1  | 2026-09-25     | #79            | 役職ごとのBGM・効果音(職種・役職・状況による変化)                                                                    |
| Phase 23 PR2  | 2026-09-25     | #81            | 演出の全スキップ設定・セリフの速さ/表示時間の設定                                                                    |
| Phase 23 PR3  | 2026-09-25     | #83            | 音量・品質・アニメーション軽減の点検。BGMを簡略化する設定(**Phase 23 完了**)                                         |
| Phase 24      | 2026-09-26     | #87            | 語録の拡張ファイル・役職/難易度専用語のしくみ(**Phase 24 完了**。Issue #85 解決)                                     |
| Phase 25 PR1  | 2026-09-26     | #89            | 公開済みの語への改善提案(vocab:check --improve)                                                                      |
| Phase 25 PR2  | 2026-09-26     | #90            | 類似語チェック(explanationの文字2-gramのDice係数)                                                                    |
| Phase 25 PR3  | 2026-09-26     | #91            | AI活用の流れの文書化(docs/06_ai/README.md。**Phase 25 完了**)                                                        |
| Phase 26 PR1  | 2026-09-26     | #93            | 管理者ゲート・監査ログの基盤(本番D1マイグレーション適用済み)                                                         |
| Phase 26 PR2a | 2026-09-26     | #95            | プロダクトをD1に移行・公開一覧を動的化(GET /api/products。本番D1マイグレーション適用済み)                            |
| Phase 26 PR2b | 2026-09-29     | #97            | プロダクトの管理API・管理画面UI(/api/admin/products、/account/admin/products/。新規マイグレーションなし)             |
| (chore)       | 2026-09-29     | #98            | 進捗ファイル整備(Phase 26 PR2b 完了の反映)                                                                           |
| Phase 26      | 2026-09-29     | -              | **完了**(プロダクトの管理画面で完了とすることを、ユーザーがチャットで確認)                                           |
| Phase 27 PR1  | 2026-09-29     | #99            | 依存の脆弱性チェックをCIに追加(npm audit --audit-level=high。新規マイグレーションなし)                               |
| (chore)       | 2026-09-29     | #100           | 進捗ファイル整備(Phase 26完了・Phase 27 PR1完了の反映)                                                               |
| Phase 27 PR2  | 2026-09-29     | #101           | 管理APIの削除操作に再認証を要求(requireUserのrecentオプション。新規マイグレーションなし)                             |
| (chore)       | 2026-09-29     | #102           | 進捗ファイル整備(Phase 27 PR2完了の反映)                                                                             |
| Phase 27 PR3  | 2026-09-29     | #103           | 依存の自動更新をDependabotで設定(.github/dependabot.yml。リポジトリのvulnerability alertsも有効化)                   |
| (chore)       | 2026-09-29     | #107           | 進捗ファイル整備(Phase 27 PR3完了の反映)                                                                             |
| (deps)        | 2026-09-29     | #104,#105,#106 | Dependabotが開いた最初のバッチをマージ(actions/checkout・actions/setup-node のメジャー更新、npm minor/patchグループ) |
| Phase 27 PR4  | 2026-09-30     | #109           | バックアップの復元テストを自動化(scripts/restore-drill.mjs。あわせてnpm audit fixでundiciの深刻度悪化=highを解消)    |
| Phase 27 PR5  | 2026-09-30     | #111           | 監査ログ(admin_audit_log)の before/after から、メールアドレス・IPを書き込み前に自動でマスク(redactPersonalInfo)      |

---

# 11. 中断・再開履歴

| 日時       | Phase        | 状態               | 中断理由                                                                                                                                                                                                                                                     | 再開時の作業                                                                                                |
| ---------- | ------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 2026-09-24 | Phase 18 PR2 | 再開               | コンテキスト圧縮による会話の要約                                                                                                                                                                                                                             | 要約から状態を復元し、tests/storage.test.js の移行テスト修正から再開・完了させた                            |
| 2026-09-24 | -            | 運用変更           | .claude/CLAUDE.md(自律開発指示書)を確認し、完全自律運用(マージ・フェーズ移行も自分で判断)への切り替えを、ユーザーに確認・承認を得た                                                                                                                          | 本ファイルを実態に合わせて整備し、Phase 18 PR3 から自律運用を開始。PR3・PR4 を完了                          |
| 2026-09-26 | Phase 24     | Issue回答待ち→再開 | Phase 24 の仕様の解釈が複数あり、Issue #85 を作成して運営者の判断を待った(WAITING_HUMAN)。GitHub Issue には回答がつかなかったが、ユーザーがチャットで直接「続けて」と発話し続けたため、AskUserQuestion でチャット上から同じ選択肢を提示し、候補Bの回答を得た | 回答をもとに 0049 決定ログを書き、Phase 24 を実装・テスト・PR化・マージ・Issue #85 のクローズまで完了させた |

---

# 12. 重要な決定事項

| 日付                                            | 内容                                                                                                                                                                                                                                                                                                                                                     | 決定理由                                                                                                                                   | 関連Issue |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| 2026-09-24                                      | .claude/CLAUDE.md の自律開発指示に従い、実装からPRマージ・フェーズ移行まで、確認なしで自律的に進める運用に切り替えた                                                                                                                                                                                                                                     | ユーザーが AskUserQuestion で明示的に選択(「.claude/CLAUDE.md のとおり、完全自律」）                                                       | -         |
| 2026-09-24                                      | Phase 18 PR2 のむずかしいの倍率を、最初の見積もり(drain 1.3/gain 0.82/initial 0.85)から、シミュレーションで再調整した                                                                                                                                                                                                                                    | ふつうの速さの人が、ほぼクリアできなかったため(0037決定ログ）                                                                              | -         |
| 2026-09-24                                      | 既知の flaky テスト2件(license-issue.test.js・auth-flow.test.js)を、原因を特定して修正した                                                                                                                                                                                                                                                               | 「単純なテスト失敗を人間へ丸投げしない」方針(.claude/CLAUDE.md 12）。どちらもテストだけ・実装の原因を切り分けて対応                        | -         |
| 2026-09-26                                      | Phase 24 の仕様確認は、GitHub Issue(#85)を作っても運営者からの回答が来ず、チャットでの「続けて」が続いた。実際には、AskUserQuestion でチャット上から同じ選択肢を提示したところ、即座に回答を得られた。**今後、人間の判断が必要な確認は、Issue作成に加えて(または代わりに)、チャットで AskUserQuestion を使うほうが、実際の運用に合っている**可能性が高い | ユーザーは GitHub を都度確認する運用ではなく、チャットで直接やり取りする運用のようだった(観察に基づく推測。次回以降も踏まえて判断すること) | #85       |
| 2026-09-26                                      | Phase 25 でも、仕様の解釈が複数あったため、Issueを作らず、最初からチャットの AskUserQuestion で確認した。即座に回答(改善提案・類似語チェック・流れの文書化の3点、すべて)を得られ、Phase24の気づきが再現・確認された。**この運用(GitHubより先にチャットで確認)を、今後の標準の手順にする**                                                                | 2回連続で同じ結果になったため、次回以降も、まずチャットで確認することを、既定の動きにする                                                  | -         |
| (各PRの決定は docs/decisions/0000〜0050 を参照) |                                                                                                                                                                                                                                                                                                                                                          |                                                                                                                                            |           |

---

# 13. 注意事項

```text
- 記録(LocalStorage: nolito:escape-boss:v1)の保存形式(DATA_VERSION)は、現在 5。
  次に形式を変えるときは 6 にして、版1〜5を読める移行と移行テストを書くこと(CLAUDE.md参照)。
- 秘密情報(GOOGLE_CLIENT_SECRET・SESSION_SECRET・D1のID等)は、コード・GitHubに書かない。
- 本番マージ後は、Cloudflare Pages の本番反映(数十秒〜数分)を待って、curlで確認すること。
- .vscode/ は意図的に常に未コミット。
- npm run check(lint・format・単体テスト)を、コミット・PR前に必ず通すこと。
- 実ブラウザ確認(headless Edge + wrangler pages dev)は、メモリに余裕がないと、wrangler/workerd の
  プロセスが増え続けて固まることがある。実行前に空きメモリを確認し、実行後は workerd.exe・
  wrangler を確実に落とすこと(タスクの終了処理を、必ず行う)。
- Phase 19 は、招待制アカウント(#19)・オンラインランキングに関わるため、どこまで実装して
  どこを WAITING_HUMAN にするか、着手時に最初に見極めること。
- **重要**: このマシンの wrangler は、本番のCloudflareアカウントにログイン済みで、本番のD1・
  環境変数を直接操作できる(2026-09-24に判明。それまで「操作できない」と誤って案内していた)。
  **この権限は強力なので、本番D1への書き込み・環境変数の変更は、運営者の明示的な指示があるときだけ
  行うこと**。実データを作る操作(問い合わせフォームの実送信など)は、運営者に委ねる。
  使い捨てのD1(`nolito-restore-drill-*`等)を作って消すような、本番に触れない account-level の
  操作(`wrangler d1 create/delete/list`)は、この制約の対象外(実際に、Phase 27 PR4で実施済み)。
- **git のリモートは HTTPS**(`https://github.com/Jukiii/NOLITO.git`。2026-09-30に、SSHから変更)。
  このマシンのSSH鍵・エージェントが、セッションの途中で認証エラーになったため(原因不明。
  `git@github.com: Permission denied (publickey)`)。`gh auth status` は、常に `Git operations
  protocol: https` だったので、リモートURLをHTTPSに揃えたところ、`gh`のcredential helper経由で
  push/pullとも正常に動いた。**もしSSHの認証エラーが再発したら、この変更を思い出すこと**(リモートを
  SSHに戻す必要はない。HTTPSのままで問題ない)。
```

---

# 14. 次回起動時の復旧手順

Claude Codeを再起動した場合、以下の順番で状態を確認してください。

1. このPROJECT_STATUS.mdを読む
2. Current Phaseを確認する
3. Current Statusを確認する
4. Current Branchを確認する
5. Current Taskを確認する
6. 最後に完了した作業を確認する
7. Git statusを確認する
8. 最新のコミットを確認する
9. GitHubのIssueを確認する
10. GitHubのPRを確認する
11. 現在のフェーズ仕様書を読む
12. 未完了の作業から再開する

---

# 15. 再開ルール

## `IN_PROGRESS` の場合

前回の作業が途中で中断された可能性があります。

既存の変更を確認してから、未完了の作業を再開してください。

作業済みの内容を最初からやり直さないでください。

## `WAITING_HUMAN` の場合

人間による対応が必要です。

関連Issueを確認してください。

Issueが解決されている場合は、作業を再開してください。

Issueが解決されていない場合は、依存する作業を開始しないでください。

## `BLOCKED` の場合

Blockerの原因を確認してください。

解決可能な問題であれば、自律的に解決してください。

仕様変更・外部サービス設定・人間の判断などが必要な場合はIssueを作成または確認し、人間の対応を待ってください。

## `COMPLETED` の場合

現在のフェーズは完了しています。

次のフェーズ仕様書を確認し、次のフェーズを開始してください。

---

# 16. フェーズ完了時の更新ルール

フェーズが完了した場合、以下を必ず更新してください。

1. Phase Status
2. 全体進捗
3. Current Phase
4. Current Status
5. Current Branch
6. Current Task
7. Current Step
8. 最後に完了した作業
9. Last Commit
10. Pull Request
11. フェーズ完了履歴
12. 次のフェーズ

フェーズ完了後は次のフェーズへ移行してください。

---

# 17. 最重要ルール

このファイルは、Claude Codeのチャット履歴だけに依存せず、現在の作業状態を復元するために使用します。

Claude Codeは、

- 作業開始時
- 大きな作業完了時
- Issue作成時
- PR作成時
- フェーズ完了時
- 作業中断時

に、このファイルを必要に応じて更新してください。

使用量制限などによって作業が突然終了しても、このファイルとGit/GitHubの情報から作業状態を復元できるようにしてください。

---

# 18. 現在の再開ポイント

```text
==================================================
再開ポイント
==================================================

Phase:
Phase 27(セキュリティ強化・監査ログ・MFA)。PR1〜PR5完了(PR5=#111。監査ログの個人情報を自動でマスク)。**Phase 26(管理画面・RBAC)は完了**

Status:
COMPLETED(Phase 28 完了)

Branch:
main(Phase 27 PR4=#109 でマージ済み。進捗反映=#107・#108、Dependabotの初回バッチ=#104〜#106・
npm audit fix によるundici修正=#109の一部、まで、すべてマージ済み)

Task:
Phase 27 の次のPR(監査ログの個人情報対策・世代管理・暗号化・MFA のいずれか)の範囲を確認する

Last Completed:
**Phase 27 PR4(バックアップの復元テストを自動化)を、完了した**(PR #109、マージ済み)。

実装内容:
- `scripts/restore-drill.mjs`(新規)。`npm run backup:restore-drill`。
  - 使い捨てのD1を、実際にCloudflareへ作り、見本(既定。`tests/fixtures/d1-export-sample.sql`)
    または実際のバックアップ(`--file`)を読み込む
  - テーブルごとの件数を、実際のCloudflare D1に問い合わせて表示する
  - 最後に、使い捨てのD1を必ず削除する(`finally`。削除に失敗しても、手動削除の案内を出す)
  - **本番のD1(`nolito`)には、いっさい触れない**(新しく作って、消すだけ)
  - 壊れたファイルは、使い捨てのD1を作る前に(メモリ上の検査で)断る
- `scripts/lib/backup.mjs`の`wranglerConfig`・`scripts/lib/wrangler-remote.mjs`の
  `runWranglerD1`/`captureWranglerD1`に、`databaseName`引数を追加(既定`"nolito"`。後方互換)。
  同ファイルに、`captureWranglerAccountLevel`(D1の作成・削除・一覧)を追加
- `docs/backup.md` §5「復元の練習」を、この1コマンドの説明に置き換えた

**このセッション内で、実際にCloudflareアカウントに対して1回実行し、確認した**: 使い捨てのD1を
作成 → 見本データ(11テーブル)を読み込み → 実際のD1に問い合わせて件数が見本どおりであることを
確認 → 削除 → `wrangler d1 list`で本番の`nolito`だけが残っていることを確認。壊れたファイルでは、
D1を作らずに断ることも確認した。

`npm run check`(全2043件、成功。新規3件)。

**副産物**: 作業中、`npm run audit`(PR1)が、`undici`(`wrangler`の間接依存)の深刻度悪化
(moderate→high。GHSAアドバイザリDBの更新による)を検出した。`npm audit fix`(forceなし)で解消
(`package-lock.json`のみ更新。`wrangler`は既存のsemver範囲=`^4.141.0`内で4.144.0に上がっただけ。
破壊的変更なし)。`npm run audit`が`found 0 vulnerabilities`になることを確認し、このPRに含めた。

決定・テスト結果は`docs/decisions/0052-phase-27-plan.md`(PR4の節)。CLAUDE.mdに
「バックアップの復元テスト(Phase 27 PR 4)」節を追加。

**Phase 27 PR3(依存の自動更新をDependabotで設定。PR #103)・PR2(管理APIの削除操作に再認証を
要求。PR #101)・PR1(依存の脆弱性チェックをCIに追加。PR #99)・Phase 26 PR2b(PR #97)・
PR2a(PR #95)・PR1(PR #93)は、この前に完了した**。

Next Action:
Phase 27の次のPRの範囲を、AskUserQuestionでユーザーに確認する(候補: 監査ログの個人情報対策の
強化・世代管理・暗号化・MFA)。回答に応じて実装する。

Human Task:
なし。Issue #12・#13・#19 は WAITING_HUMAN のまま残っている(いまの作業のブロッカーではない)。
Phase 21 PR3のプライバシーポリシーの版を上げない判断について、運営者の確認待ち(PR #71 に記載)。
本番の`ADMIN_EMAILS`環境変数は、運営者が未設定(設定されるまで、Phase 26の管理画面は誰も使えない)。
Dependabotが今後開くPRは、CIを確認してから、通常のPRと同じ手順でマージすること(**最初のバッチ
=PR #104・#105・#106〈actions/checkout・actions/setup-node のメジャー更新、npm minor/patch
グループ〉は、いずれもCI green(npm run check・npm run audit含む)を確認して、このセッション内で
マージ済み**)。**このマシンの git のリモートURLは、SSH(git@github.com:...)から
HTTPS(https://github.com/...)に変更した**(SSHの鍵・エージェントが、このセッションの途中で
認証エラーになったため。`gh`のcredential helper=HTTPSで、push/pullとも正常に動くことを確認済み)。

Blocker:
なし

==================================================
```
