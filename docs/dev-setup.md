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

## 記事の書き方(公開の流れ)

1. `content/articles/<スラッグ>.md` を作る。スラッグは英小文字・数字・ハイフンだけ(URL になる: `/articles/<スラッグ>/`)。
2. 先頭に、YAML で `title`(100字まで)・`description`(10〜160字)・`date`(`"2026-09-20"` のように引用符で囲む)を書く。任意で `updated`・`tags`(5個まで)・`draft: true`(公開しない)。
3. 本文は `##` から始める(題名は `title`。本文に見出し1は使えない)。画像には代替テキストが必須: `![代替テキスト](/assets/img/xxx.png)`。
4. `npm run build:articles` で、公開用の HTML とデータを生成する。**生成物もコミットする**(`npm run check` が、生成物が最新かを検査する)。
5. PR を作る。**PR のマージが公開**になる(内容の確認は、PR のレビューで行う)。

## アクセス解析(Google Analytics)の設定

計測は、`public/assets/js/config/analytics.js` の `measurementId` が空のあいだは、何も動かない(バナーも出ない)。

1. GA4 のプロパティを作り、データストリーム(ウェブ)の**測定 ID**(`G-XXXXXXXXXX`)を控える。
2. GA4 の管理画面で、**Google シグナル**と、広告向けのデータ共有を**オフ**にする(プライバシーポリシーの記載と合わせる)。
3. 測定 ID を `measurementId` に入れる。本番のホスト(`hosts`)でだけ、同意した人のページビューが計測される(プレビュー・ローカルは対象外)。
4. ポリシーの内容を変えたら、`public/privacy/index.html` の `data-policy-version` と `policyVersion` の版を上げる(同意を取り直す)。

## プロダクト・カテゴリの追加(公開の流れ)

管理画面(Phase 26)ができるまでは、`public/data/` の JSON を編集する PR が、公開の流れになる(PR のレビューが「公開前の人間の確認」)。

- カテゴリの追加: `categories.json` の `categories` に `{ id, name, description, path }` を足す。一覧のページがまだなければ `path` は `null`。
- プロダクトの追加: `products.json` の `products` に足す。項目の意味と制約は `public/assets/js/products/schema.js`(検証の実装)が定義で、`tests/products.test.js` が守っている。
  - 公開前のものは `status: "coming-soon"`(準備中)にする。**`public/data/` の JSON は誰でも読める**ので、まだ見せたくないものは、JSON に入れず、ブランチの中だけに置く。
  - 画像は `image: { src, alt }`(alt は必須)。ダウンロードは `download: { label, url }`(https かサイト内のパスだけ)。
  - `changelog` は新しい順。先頭の `version` は、プロダクトの `version` と同じにする。
- `npm run check` が、形式・URL・日付・並び順を検査する。間違いがあると、ここで失敗する。
