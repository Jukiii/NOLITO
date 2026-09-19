# 開発環境セットアップ

## 必要なもの

- Node.js 22 以上(品質チェック・テスト用。サイト本体の実行には不要)
- VS Code + 拡張機能 Live Server
- Claude Code

## 手順

```sh
npm install
npm run check   # lint + フォーマットチェック + 単体テスト
npm run test    # 単体テストのみ(tests/ 配下、Node 標準の node --test)
```

## ローカル表示

`es modules` は `file://` では動かないため、HTTPサーバー経由で表示する。ルートは `public/` にすること。

1. VS Code で `public/index.html` を開く。
2. 右クリック →「Open with Live Server」。
3. `public/` をルートにするため、ワークスペース設定 `liveServer.settings.root` を `/public` にする。
   (`/assets/...` の絶対パスが本番と同じように解決される)

## ブランチ運用

- `main` からPhaseごとに `phase-NN-<name>` ブランチを作成し、PRで取り込む。
- ブランチはマージ後も削除しない。

## Cloudflare Pages

| 項目                   | 値                        |
| ---------------------- | ------------------------- |
| ビルドコマンド         | なし(空)                |
| ビルド出力ディレクトリ | `public`                  |
| 本番ブランチ           | `main`                    |
| プレビュー             | ブランチ・PRごとに自動生成 |

## GitHub 設定(手動)

`main` のブランチ保護(Settings → Branches)

- Require a pull request before merging
- Require status checks to pass(`check`)
- Settings → General → 「Automatically delete head branches」は **OFF** にする
