# docs の案内

仕様書と、開発・運用の文書の入り口。公開はしない(Cloudflare Pages の出力は `public/` だけ)。実装を進めるときの決まりは、リポジトリ直下の `CLAUDE.md`。

## 仕様

| 文書 | 中身 |
| ---- | ---- |
| `00_overview/overall-specification.md` | 全体仕様(目的・初期プロダクト・サイト構成・アカウント・将来拡張) |
| `00_overview/phase-roadmap.md` | Phase 0〜30 の区分 |
| `01_phases/phase-00.md` 〜 `phase-30.md` | Phase ごとの仕様。**仕様書が最優先**。仕様を変えるときは、変更理由・影響範囲・テスト内容を `decisions/` に残す |
| `decisions/` | 決定ログ(連番。Phase ごとの計画・テスト結果・仕様との差・変更理由) |

## 設計・技術

| 文書 | 中身 |
| ---- | ---- |
| `02_design/design-system.md`・`ui-guidelines.md` | デザインの原則・UI の決まり |
| `03_technical/architecture.md` | 構成・ページ・API・環境変数 |
| `03_technical/data-model.md` | D1 のテーブル・静的データ・LocalStorage のキー |
| `03_technical/security.md` | 方針と、実際の対応・未対応 |

## 運用

| 文書 | いつ使うか |
| ---- | ---------- |
| `dev-setup.md` | ローカルでの開発・確認 |
| `auth-setup.md` | アカウント(Google ログイン・D1・環境変数)の設定。**D1 に貼る SQL** |
| `contact-setup.md` | 問い合わせの設定 |
| `release-process.md` | 小機能単位の公開の流れ・戻し方 |
| `05_checklists/release-checklist.md` | 公開の前後の確認 |
| `05_checklists/acceptance-test.md` | 受け入れテスト(人が確かめる項目) |
| `operations.md` | 障害時(止める → 戻す → 確認 → 記録)・公開後の簡易チェック |
| `backup.md` | バックアップ・復元・世代管理 |
| `vocabulary-review.md` | 語録の確認シート(**`npm run vocab:review` が生成。手で書き換えない**) |

## テンプレート・AI

| 文書 | 中身 |
| ---- | ---- |
| `04_templates/claude-code-instructions.md` | Claude Code への指示 |
| `04_templates/issue-template.md`・`pull-request-template.md` | Issue・PR の書き方 |
| `04_templates/vocabulary-template.md` | 語録の原稿の形式 |
| `05_checklists/vocabulary-validation.md` | 語録の確認の観点 |
| `06_ai/README.md` | AI 活用の全体の流れ(生成 → 機械チェック → AI チェック → 人間の確認 → 公開)と、各プロンプト |

## 変更履歴・版

- 仕様・実装の変更の理由と影響範囲は、`decisions/` の連番(0001〜)。1 つの Phase が、複数の PR にまたがるときも、同じ計画の文書に、PR ごとの決定とテスト結果を足していく。
- プロダクトの版・更新履歴は、`public/data/products.json` の `version`・`changelog`(公開の `/updates/` に出る)。プライバシーポリシーの版は、`/privacy/` の改定の履歴。記録(LocalStorage)の版は `DATA_VERSION`(`docs/03_technical/data-model.md`)。
- 進捗は `.claude/PROJECT_STATUS.md`。
