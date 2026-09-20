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
- Google Analytics は、**同意するまで Google に何も要求しない**。測定 ID が空・本番以外のホストでは何も動かない(`config/analytics.js`)。計測に関わる変更で、この性質を変えない(テストで検証している)。ポリシーの**同意に関わる内容**(計測の内容・外部への送信・保存期間・第三者への提供)を変えたら、版を上げる(同意を取り直す)。端末内の保存の記載の追加や、連絡先の更新だけなら、版は上げない(判断の理由を決定ログに書く)。
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

- Phase 8 の基盤の上に、最初のツール「キーみち」(`/tools/kii-michi/`。下の節)を公開した。ナビの「ツール」は有効。
- プロダクトの `storage`(保存方式: `none` / `browser` / `file`。`none` は単独)と `plan`(無料で使える範囲と、将来の有料機能の予定。無料の範囲は必ず示す)は、詳細ページの「データの保存」「料金」の節に出る。**実際の課金・使えるかどうかの制御は、Phase 9(ライセンス)以降**。将来の有料機能は「予定」で、内容や時期が変わることを添える。
- **ツールの利用者のデータは、`public/assets/js/tools/store.js`(`createToolStore`)で保存する**。キーは `nolito:tool:<ツールID>:<ワークスペース>:v1`(`v1` は変えない。ワークスペースの既定は `personal`。将来のチームは、別のワークスペース)。データの形を変えるときは `version` を上げ、`migrations` に移行の関数を足す。`normalize` で必ず整える(取り込むファイルは、利用者が書き換えられる)。
- ストアの決まり: 壊れたデータは上書きせず `:corrupt` に退避する。このコードより新しい版のデータは、読み込まず・上書きもしない。保存できない環境ではメモリに残して落ちない。取り込みは、置き換える前のデータを `:before-import` に退避する。JSON の書き出し・読み込みは、形式・ツールID・版・サイズ(1MB)を検査する。この挙動を緩めない。
- ゲームの `storage.js` は別の実装のまま(統合は Phase 19 で検討)。

## キーみち(最初のツール。`/tools/kii-michi/`)

- 「キーボード操作ルート設計」。アプリ・操作(キー)を登録し、自分の作業手順に合わせて「ルート」に並べる。一覧・チートシート(印刷・Markdown)・JSON の書き出し/読み込み。**ショートカットの辞書は同梱しない**(OS・バージョンで違い、正確さを保てないため)。練習モード(次の節)もある。
- コードは `public/assets/js/tools/kii-michi/`。DOM に依存しない `keys.js`(キーの解析・表記・判定)・`model.js`(データの検査と変更)・`cheatsheet.js`(チートシート・Markdown)と、DOM に触れる `view.js`・`main.js`。データは `createToolStore` で `nolito:tool:kii-michi:personal:v1` に保存する(`version` を上げるときは `migrations` を足す)。
- **キーは「位置」(`event.code`)で読み、ラベルは US 配列**(JIS では、記号の印字が違う)。押したキーを `key` で読まない(Shift や配列で変わるため)。表記は OS の設定(Windows / macOS)で変わるだけで、データは変わらない。
- 「キーを押して入力」は、1回の操作で、押した1つ分を足す。**Esc・ほかのクリックで必ず抜けられる**(キーボードトラップにしない)。日本語入力(IME)の変換中は判定しない。ブラウザ・OS が先に処理するキー(Ctrl+W など)は記録できないので、文字での入力を案内する(`reservedReason`。一覧は目安)。
- チートシートの Markdown は、利用者が入力した名前・メモを、打ち消し(エスケープ)して出す(`escapeMarkdown`)。画面は `textContent` だけを使う。この安全側の挙動を緩めない。
- 画面(スクリーンショット)は `public/assets/img/products/kii-michi/`。画面を変えたら撮り直す。

### キーみちの練習モード

- 練習(`practice.js`。DOM に依存しない)は、開始時のルートの手順の**写し**で進む。結果は**保存しない**(保存の形・版は変えない)。手順の答え方は `press`(キーを押して判定)か `self`(答えを見て自己確認)。
- **自己確認になる手順**: 練習の方法の選択、ブラウザ・OS が先に処理するキー(`reservedReason`)、単独の Tab・Shift+Tab、利用者が練習中に「押しても反応しない」で切り替えたもの。`reservedReason` の一覧は目安で、外れても、練習が止まらない(この切り替えのため)。
- **キーを受け取るのは、答えの枠(`#practice-answer`)だけ**。`document` 全体では聞かない。枠にフォーカスがあるときだけ判定し、**Tab・Shift+Tab は、判定も抑止もせず、移動に使う**(キーボードトラップにしない)。Esc は答えとして判定する。中断は「やめる」ボタン(Tab で行ける)。この性質を変えない。
- 押したキーの既定の動作(F5・Ctrl+S など)は、枠の中では止める。IME の変換中・修飾キーだけ・押しっぱなし(repeat)は、判定しない(間違いに数えない)。
- 画面の更新: 合っている・違うだけのときは、枠を作り直さず、文だけを更新する(フォーカス・読み上げを乱さないため)。

## アカウント(Phase 9)

- サーバー処理は `functions/`(Cloudflare Pages Functions。ルートは `/api/*`・`/auth/*` だけ)、データは D1(`migrations/`。**既存のファイルは書き換えず、新しい番号のファイルを足す**)。設定・手順は `docs/auth-setup.md`、決定は `docs/decisions/0013-auth.md`。
- 秘密(`GOOGLE_CLIENT_SECRET`・`SESSION_SECRET`)は、Cloudflare の環境変数(シークレット)だけに置く。**コード・GitHub・チャットに書かない**。`.dev.vars` は Git に入れない。
- 必要な設定と `AUTH_ENABLED=true` がそろうまで、何もしない(`/api/me` は `{enabled:false}`、ほかは 503)。**プレビューが壊れないこの性質を変えない**(テストで検証している)。
- ログインは、認可コード + PKCE + state + nonce のリダイレクト方式。**ブラウザに Google のスクリプトを読み込まない**。ID トークンは RS256 だけを受け、署名・`iss`・`aud`・`exp`・`nonce`・`email_verified` を検証する(`functions/_lib/google.js`)。緩めない。スコープは `openid email` だけ(名前・写真は取得しない)。
- セッションのトークンは、DB には SHA-256 のハッシュだけを置く。Cookie は `__Host-` つき・`Secure`・`HttpOnly`・`SameSite=Lax`。JavaScript から Cookie を読まない・LocalStorage にアカウントの情報を置かない。
- 状態を変える API(POST・DELETE)は、`guard.js` の `checkCsrf`(Origin が `SITE_ORIGIN` と一致 + `X-NOLITO-CSRF: 1` + JSON)を通す。新しい API も、`requireUser(context, { write: true })` を使う。GET で状態を変えない。
- **招待制(`SIGNUP_MODE=invite`。既定)**: 許可リスト(`ALLOWED_EMAILS`)にないメールアドレスは、アカウントも作らない。リクエストのたびに再確認する。一般公開(`open`)にする前に、Issue #19(連絡先・ポリシー v2・規約・Google の公開審査)を終える。
- 監査ログ・回数の制限のキーに、メールアドレス・IP をそのまま入れない。アカウントの削除は、直近 10 分以内にログインしたセッションだけ(`reauth-required`)。
- サーバーが返すエラーの種類を足したら、`public/assets/js/account/messages.js` の文も足す(`tests/account-page.test.js` が検査する)。表示は `textContent` だけ。
- `wrangler.toml` はローカル専用。**`pages_build_output_dir` を書かない**(書くと、Cloudflare のダッシュボードの設定が読み取り専用になる)。
- フッター・ナビに「アカウント」を出すのは、一般公開のとき(いまは `/account/` は `noindex` で、リンクなし)。ゲームの記録・ランキングのアカウント連携は Phase 19。
- プライバシーポリシーの版は、個人情報の取り扱いの変更(一般公開・第三者への提供など)で上げる。限定公開の間の取り扱いは、`/account/` に書いてある。

### ライセンス(Phase 9 PR 2)

- 決定は `docs/decisions/0014-licenses.md`。**登録・一覧・発行(運営者)だけ**。購入履歴・有料機能の制御は、まだない(有料のソフトも販売サービスもない。Issue #12)。
- キーは `NLTO-XXXXX-XXXXX-XXXXX-XXXXX`(100 ビットの乱数)。**DB には、ハッシュと末尾 4 文字だけ**。キーそのものを、DB・監査ログ・ログ・画面・API の応答に出さない(一覧にも、ヒントだけ)。この性質を変えない(テストで検証している)。
- 発行は `node scripts/issue-license.mjs <商品ID> ...`(運営者のパソコンで実行。画面に出すだけで、保存も送信もしない)。サイトに、発行の API・画面を作らない(管理画面は Phase 26 以降)。
- 登録は、1 つの条件つき `UPDATE`(同時に 2 人でも 1 人だけ)。存在しない・他人が使用済み・無効は、**同じ応答**(`license-invalid`)にして、キーの存在を探れなくする。回数を制限する(1 人 5 回 / 10 分、IP ごと 20 回 / 10 分)。
- アカウントの削除では、ライセンスの記録を残し、結びつき(`user_id`・`redeemed_at`)だけを外す(`deleteUser`)。
- **D1 の Console に貼る SQL は、コメント(`--`)を入れず、1 回に 1 文にする**(Console は改行を消すことがある)。`migrations/` に新しいファイルを足したら、`docs/auth-setup.md` の「D1 に貼る SQL」にも、コメントを抜いた同じ内容を載せる(`tests/migrations-doc.test.js` が一致を検査する)。マージの前に、本番の D1 に実行する(PR の説明に書く)。

## バックアップ(Phase 10)

- 本番の D1 には個人情報が入っている。**DB のバックアップ(SQL)を、GitHub・チャット・リポジトリの中に置かない**(公開のリポジトリ)。`npm run backup:d1` は、リポジトリの中への保存を断る。`.gitignore` の `nolito-d1-*.sql`・`backups/` を外さない。
- 手順・復元は `docs/backup.md`、決定は `docs/decisions/0015-backup.md`。D1 Time Travel(自動・7 日)+ 月に 1 回の手元の書き出し(運営者)。保管は直近 6 か月まで(削除したアカウントの情報を、いつまでも残さない)。
- 本物の D1 の ID は、コミットしない(`wrangler.toml` はダミーのまま)。環境変数 `NOLITO_D1_DATABASE_ID` か `--id` で渡す。本番の DB を読める秘密のトークンを、GitHub Actions などに置かない(自動化しない理由は、`docs/backup.md`)。
- スクリプトは、バックアップの中身(メールアドレスなど)を表示しない(テーブル名と件数だけ)。この性質を変えない(テストで検証している)。
- `tests/fixtures/d1-export-sample.sql` は、本物の `wrangler d1 export` の出力(作り物のデータ)。テーブルを足したら、`migrations/` と合わせて、見本を作り直す。
