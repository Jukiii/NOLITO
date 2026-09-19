# 0001 Phase 0 基盤の決定事項

日付: 2026-09-19 / 対象Phase: 0

## 決定

| # | 項目 | 決定 | 理由 |
| - | ---- | ---- | ---- |
| 1 | 公開ルート | `public/`。仕様書 `docs/` は公開しない | サイト構成の `/docs/` と仕様書フォルダの衝突を避ける。仕様書の意図しない公開を防ぐ |
| 2 | 品質チェック | ESLint + Stylelint + Prettier + html-validate、GitHub Actions で PR ごとに実行 | 依存は devDependencies のみで、公開物に含めない。自動テスト基盤は語録・ゲームロジックのPhaseで導入 |
| 3 | ビルド工程 | Phase 0 ではなし | Static + Vanilla の方針どおり。語録のMarkdown→JSON変換は該当Phaseで軽量スクリプトを検討 |
| 4 | ブランチ | `phase-NN-<name>`、PR必須、マージ後もブランチを削除しない | 指示書8 |
| 5 | パス | `/` 始まりの絶対パス | 本番(Cloudflare Pages)と Live Server(root=`/public`)で同一に解決するため |
| 6 | `CLAUDE.md` | 指示書を反映して作成 | Phase 0 の「Claude Code」利用整備 |

## Phase 0 の範囲外(意図的に作らないもの)

- ヘッダー・フッター等の共通コンポーネント(Phase 1)
- `/games/` 等のセクションディレクトリ(該当Phase)
- セキュリティヘッダー(`_headers`)、Analytics、ダークテーマ(該当Phase)

## 未確定(要回答)

- LICENSE の有無とコード・語録それぞれのライセンス
- マージ方式(Squash / 通常マージ)。ブランチ履歴を残す方針から通常マージを仮置き
- Cloudflare のプロジェクト種別(Pages / Workers Static Assets)と独自ドメイン
- GitHub のブランチ保護をユーザーが設定するか、`gh` で実行するか

## 影響範囲・テスト

- 影響範囲: 新規ファイルのみ。既存の `docs/` 仕様書は変更なし。
- テスト: `npm run check`、Live Server 表示、幅 375 / 768 / 1280px で横スクロールなし、CI、Cloudflare プレビュー。
