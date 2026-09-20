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
  - 画像は `image: { src, alt }`(カード用。alt は必須)。ダウンロードは `download: { label, url }`(https かサイト内のパスだけ)。
  - `changelog` は新しい順。先頭の `version` は、プロダクトの `version` と同じにする。
- `npm run check` が、形式・URL・日付・並び順を検査する。間違いがあると、ここで失敗する。

### 詳細ページを作る(ソフトなど)

1. `products.json` に、`detail_path`(例: `"/software/sample-app/"`。カテゴリの一覧ページの下)を書く。ソフトは `url` も同じにする。
2. 詳細ページに出す内容を書く: `details`(説明の段落)、`screenshots`(画像。alt と width・height が必須。最大6枚)、`requirements`(動作環境。項目名と値)、`faq`(質問と答え)、`changelog`(更新履歴)。
   また、`storage`(利用者のデータの保存方式。`none` 保存しない / `browser` ブラウザ / `file` ファイルの書き出し・読み込み。`none` は単独)は必須。`plan`(`{ free: [無料で使える範囲], paid: [将来の有料機能(予定)] }`)は、料金の節を出すときだけ書く(出さないなら `null`)。無料の範囲は必ず示す。有料機能は、まだ提供していないことが添えられる。
3. **配布は GitHub Releases**: リリースを作り、`download` に、そのページの URL(例: `https://github.com/<ユーザー>/<リポジトリ>/releases/latest`)を書く。ページを表示するときに GitHub へは通信しない。バージョンや更新履歴の自動反映は、まだない(手で書く)。
4. **有料の場合**: `price` を `paid` にして、`purchase: { label, url }` に外部の販売サービスの URL を書く。**販売サービスの選定・特定商取引法の表記・利用規約を決めてから**にする(Issue #12)。
5. `npm run build:products` で詳細ページを生成し、**生成物もコミットする**(`npm run check` が、最新かを検査する)。
6. 最初のソフトを公開するときは、`config/nav.js` の「ソフト」の `available: false` を外す。

## ツールを作る(Phase 8 の基盤の使い方)

最初のツールは「キーみち」(`/tools/kii-michi/`)。次のツールを作るときの流れ(キーみちが実例):

1. ツールのページを `public/tools/<ツールID>/` に置く(`url`)。詳細ページは、`detail_path` を `/tools/<ツールID>/about/` にして、`products.json` の `tool` カテゴリに足す。`storage` と、必要なら `plan` を書く。
2. 利用者のデータを保存するときは、`public/assets/js/tools/store.js` の `createToolStore` を使う(保存方式が `browser` か `file` のとき)。`toolId` はツールの ID、`version` はデータの形の版、`initial` は最初のデータ、`normalize` は読み込み・保存・取り込みのたびに通す検査と整形(不正なら例外)。形を変えたら、`version` を上げて `migrations` に移行の関数を足す。
3. 画面には、`load()` の `status`(`unavailable`・`corrupt`・`newer` など)に応じた案内を出す。`save()` の結果(`saved: false` の理由)も、利用者に伝える。
4. `file` の場合は、`exportJson()` で書き出した文字列をファイルにして保存させ、`importJson(text)` で取り込む。取り込みの前に、利用者に確認する(置き換わる)。
5. 最初のツールを公開するときは、`config/nav.js` の「ツール」の `available: false` を外す。
6. 保存するデータの内容を増やす・外部に送るようになるときは、プライバシーポリシーの版を上げる(同意を取り直す)。

## アカウント機能(Phase 9)を動かす

- 設定(Cloudflare の D1・環境変数・Google の OAuth クライアント)は、`docs/auth-setup.md`。設定がなければ、機能は、何もしない(ページは「準備中」)。
- テストは、`npm run test` だけで足りる(偽の Google と、SQLite で、外部には通信しない)。
- 動かして確認するには、`npx wrangler pages dev public`(`wrangler` は devDependency)。環境変数は、`.dev.vars`(Git に入れない)か、`--binding KEY=VALUE` で渡す。ローカルの D1 は、`npx wrangler d1 migrations apply nolito --local`。
- `functions/` を変えたら、`tests/auth-*.test.js` も更新する。`migrations/` に新しいファイルを足す PR は、本番の D1 にも、マージの**前**に、同じ SQL を適用する(PR の説明に書く)。
- ライセンスキーの発行: `node scripts/issue-license.mjs <商品ID> --count 3 --note "メモ"`(運営者用。手順は `docs/auth-setup.md` の「ライセンスキーを発行する」)。

## DB のバックアップ(Phase 10)

- 月に 1 回、`npm run backup:d1`(運営者用。手順・復元・練習は `docs/backup.md`)。事前に `npx wrangler login` と、環境変数 `NOLITO_D1_DATABASE_ID`。
- 書き出したファイルの確認は `npm run backup:verify -- <ファイル>`。本物の D1 への `wrangler d1` は `npm run d1:remote -- <コマンド>`。
