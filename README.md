# 個人開発プロダクトポータルサイト 仕様書

本リポジトリは、タイピングゲームを初期プロダクトとし、将来的にゲーム・デスクトップソフト・業務効率化ツール・記事を追加できる個人開発プロダクトポータルサイトの仕様書を管理する。

## 方針
- Static Siteを基本とする
- Vanilla JavaScript + ES Modules + 通常CSS
- GitHub管理、Pull Request必須
- Cloudflare Pagesを利用
- PC・スマホ・タブレット対応
- AIは補助利用とし、AIなしでも運用可能にする
- 無料利用を基本とし、広告・アフィリエイト・将来の有料販売に対応

## ドキュメント
- `00_overview`: 全体像・ロードマップ
- `01_phases`: Phase 0〜30
- `02_design`: デザイン・UI
- `03_technical`: 技術・データ・セキュリティ
- `04_templates`: 語録・Issue・PR等のテンプレート
- `05_checklists`: 品質・公開・受け入れチェック
- `06_ai`: AI生成用プロンプト

## 開発
- 公開ルートは `public/`(Cloudflare Pagesの出力ディレクトリ)。`docs/` は公開しない
- `npm install` の後、`npm run check` で品質チェック
- セットアップ・ブランチ運用・Cloudflare設定は `docs/dev-setup.md`、決定事項は `docs/decisions/` を参照

## ライセンス
Copyright (c) 2026 NOLITO (Jukiii). All rights reserved.

本リポジトリのソースコード・語録・画像・文書は公開されていますが、明示的な許諾なく複製・改変・再配布・商用利用することはできません。ライセンスは収益化方針の確定後に見直します(`docs/decisions/0001-phase-00-foundation.md` 参照)。

[仕様書](.claude/PROJECT_STATUS.md)