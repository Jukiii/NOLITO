# CLAUDE.md

NOLITO(ノリト)個人開発プロダクトポータルサイト。仕様は `docs/` にある。実装前に該当Phaseと関連仕様を確認すること。

## 作業ルール(`docs/04_templates/claude-code-instructions.md` より)

1. 既存ファイルと仕様書を確認する。
2. 変更前に実装方針・変更ファイル・テスト方法を提示する。
3. フェーズ単位で実装し、無関係な変更をしない。仕様書にない機能を勝手に追加しない。
4. 秘密情報をコードやGitHubへ含めない。
5. 仕様・アクセシビリティ・モバイル対応を確認する。
6. 実装後にテスト結果、未対応事項、変更ファイルを報告する。
7. 外部サービスや有料APIは規約・費用・セキュリティを確認してから導入する。
8. GitHubではブランチをすべて残す(マージ後も削除しない)。

## ブランチ・PR

- `main` へ直接コミットしない。`phase-NN-<name>` ブランチで作業し、PRで取り込む(テンプレート: `.github/`)。
- 仕様変更時は変更理由・影響範囲・テスト内容を `docs/decisions/` に記録する。未確定事項は実装前にIssue化する。

## 構成

- `public/` … 公開ルート(Cloudflare Pages の出力ディレクトリ)。ビルド工程なし。パスは `/` 始まりの絶対パス。
- `docs/` … 仕様書(公開しない)。
- HTML / 通常CSS / Vanilla JS(ES Modules)。フレームワーク・バンドラは使わない。
- CSS: `tokens.css`(色・余白などのトークン)→ `base.css` → `layout.css` → `components.css` を各HTMLから `<link>`。色は必ずトークン経由で指定する(ダークテーマ対応のため)。クラス名は kebab-case か BEM。
- JS: Header / Footer は `assets/js/components/` が描画する。ナビ項目は `assets/js/config/nav.js` だけを編集する。
- ゲーム「上司から逃げろ」: `public/assets/js/games/escape-boss/`。ロジック(`romaji.js` `engine.js` `vocabulary.js`)は DOM に依存させず、`view.js` / `input.js` / `main.js` だけが DOM に触れる。
- 記録(結果・ランキング・実績・プロフィール)は LocalStorage の `nolito:escape-boss:v1` に保存する(`storage.js` `records.js`)。保存形式を変えるときは `DATA_VERSION` を上げて、`normalizeData` で**古いバージョンを読める**ようにする(既存の記録を消さない。移行前の元データは退避し、移行のテストを書く)。キー名の `v1` は変えない。
- 打鍵の集計(`keystats.js`)・成績の集計(`stats.js`)・グラフ(`chart.js`)は DOM に依存しない純粋な計算と描画を分ける。グラフを作る・変えるときは `dataviz` スキルの指針に従う(単位の違う指標は重ねない、値の表を併記、色だけに頼らない、ホバー領域は24px以上)。成績ページは `stats-page.js`。表示する文字列は必ず `textContent`(ニックネームなどは利用者が書き換えられる)。
- 役職(`roles.json`)・実績(`achievements.json`)はデータで定義する。役職は進むほど難しくなること(初期距離は減り、減少速度・倍率は上がる)をテストで検証している。
- ゲームのデータは `public/data/`(`jobs.json` `roles.json` `vocabulary/<職種ID>.json`)。バランス値は `roles.json` の `stage`。語録を追加・変更したら `npm run test` で形式と入力可否が検証される。語録はAIの下書きを人間が確認してから公開する。
- `/styleguide/` は共通コンポーネントの確認用(noindex)。コンポーネントを追加・変更したらここも更新する。

## コマンド

- `npm run check` … lint(ESLint / Stylelint / html-validate)、Prettier のチェック、単体テスト。PR前に必ず通す。
- `npm run test` … 単体テストのみ(Node 標準の `node --test`。`tests/` 配下)。ロジック(`romaji.js` `engine.js` など)を変えたらテストも書く。
- `npm run format` … Prettier で整形。
- ローカル表示は VS Code の Live Server(`public/` をルートにする)。詳細は `docs/dev-setup.md`。

## 記事・計測・広告(Phase 5)

- 記事は `content/articles/*.md` が管理元。`npm run build:articles` で `public/articles/` と `public/data/articles.json` を生成し、**生成物もコミットする**(`npm run check` が最新かを検査する)。生成物を手で書き換えない。手順は `docs/dev-setup.md`。
- 記事の本文の生の HTML は実行せず文字にする。危険なリンク・使えない画像はビルドを失敗させる。この安全側の挙動を緩めない(将来、管理画面などからも書かれる)。
- Google Analytics は、**同意するまで Google に何も要求しない**。測定 ID が空・本番以外のホストでは何も動かない(`config/analytics.js`)。計測に関わる変更で、この性質を変えない(テストで検証している)。ポリシーを変えたら版を上げる。
- 広告の枠(`data-ad-slot`)は、ゲームの外のページ・記事・結果画面にだけ置く。プレイ画面には置かない。広告事業者のスクリプトは Phase 29 まで入れない。

## プロダクト(Phase 6)

- プロダクトは `public/data/products.json`(version 4)、カテゴリは `categories.json` で定義する。カテゴリは、データを足すだけで増やせる。検証は `public/assets/js/products/schema.js`(DOM 非依存)、表示用の文字列は `format.js`、カードの描画は `components/product-list.js`。
- 形式を変えるときは、`schema.js` の検証と `tests/products.test.js` を一緒に更新し、`PRODUCT_DATA_VERSION` を上げる。
- **URL は、`/` 始まりのサイト内パスか `https://` だけ**(`isSafeUrl`)。画像には alt が必須。表示は必ず `textContent`(`el()`)。不正な項目は、テストで失敗させ、実行時は「その項目だけ外して、他は表示」する。この安全側の挙動を緩めない(将来、管理画面からも書かれる)。
- `public/data/` は誰でも読める。**下書き(未公開)の項目を入れない**。公開前は `coming-soon`。
- カードを変えたら `/styleguide/` の見本も更新する。

## プロダクトの詳細ページ(Phase 7)

- 詳細ページは、`products.json` の `detail_path` があるものを、`npm run build:products` が **静的な HTML として生成**する(`public/games/escape-boss/about/` など)。**生成物もコミットする**(`npm run check` が最新かを検査する)。生成物を手で書き換えない(ページ先頭の印で、手書きと区別している)。`npm run build` は、記事と詳細ページの両方を作る。
- 生成のコードは `scripts/lib/product-pages.mjs`(HTML)と `product-build.mjs`(整形・書き出し・検査)。生成した HTML は Prettier で整形する。値は必ずエスケープする。
- 配布は GitHub Releases などの**外部の URL へのリンクだけ**。ページの表示時に、GitHub や販売サービスへ**通信しない**(プライバシー・レート制限のため)。リンクには `rel="noopener noreferrer"` と、移動先の注意書きを付ける。
- 外部販売(`purchase`)は、有料(paid)で準備中でないものだけ。**有料のソフトを公開する前に、販売サービスの選定・特定商取引法の表記・利用規約が要る**(Issue #12)。
- ソフトの `url` は、詳細ページ(`/software/<id>/`)にする。ゲームは、遊ぶ先(`url`)と詳細ページ(`detail_path`)が別。
- 画像(`screenshots`)には alt と width・height が要る。ゲームの画面を変えたら、`public/assets/img/products/escape-boss/` の画面も撮り直す。
- `/software/` の一覧ページはあるが、ナビの「ソフト」は、最初のソフトを公開するまで「準備中」(`config/nav.js` の `available`)。

## ツール(Phase 8)

- ツールの中身(何を作るか)は、まだ決まっていない(Issue #15)。Phase 8 は**基盤だけ**。`/tools/` の一覧ページはあるが、ナビの「ツール」は、最初のツールを公開するまで「準備中」。
- プロダクトの `storage`(保存方式: `none` / `browser` / `file`。`none` は単独)と `plan`(無料で使える範囲と、将来の有料機能の予定。無料の範囲は必ず示す)は、詳細ページの「データの保存」「料金」の節に出る。**実際の課金・使えるかどうかの制御は、Phase 9(ライセンス)以降**。将来の有料機能は「予定」で、内容や時期が変わることを添える。
- **ツールの利用者のデータは、`public/assets/js/tools/store.js`(`createToolStore`)で保存する**。キーは `nolito:tool:<ツールID>:<ワークスペース>:v1`(`v1` は変えない。ワークスペースの既定は `personal`。将来のチームは、別のワークスペース)。データの形を変えるときは `version` を上げ、`migrations` に移行の関数を足す。`normalize` で必ず整える(取り込むファイルは、利用者が書き換えられる)。
- ストアの決まり: 壊れたデータは上書きせず `:corrupt` に退避する。このコードより新しい版のデータは、読み込まず・上書きもしない。保存できない環境ではメモリに残して落ちない。取り込みは、置き換える前のデータを `:before-import` に退避する。JSON の書き出し・読み込みは、形式・ツールID・版・サイズ(1MB)を検査する。この挙動を緩めない。
- ゲームの `storage.js` は別の実装のまま(統合は Phase 19 で検討)。
