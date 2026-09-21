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
- ゲームのデータは `public/data/`(`jobs.json` `roles.json` `vocabulary/<職種ID>.json`)。バランス値は `roles.json` の `stage`。**語録の JSON は、原稿 `content/vocabulary/<職種ID>.md` から `npm run build:vocabulary` が生成する(手で書き換えない。生成物もコミットする。下の「語録の原稿(Phase 14)」)**。語録を追加・変更したら `npm run check` で形式と入力可否が検証される。語録はAIの下書きを人間が確認してから公開する。
- 語録は職種ごと30語(計180語。決定ログ 0021)。**語の id は、消さない・つけ替えない**(記録・復習リストが id で語を引く)。難易度は**読みの長さの決め**(単位数 ≤3 → 1、4〜5 → 2、≥6 → 3。小さい ゃゅょぁぃぅぇぉ は前の字と合わせて 1)で、`npm run vocab:stats` の警告が 0 であることを、テストが検査する。語を足す・変えたら `npm run vocab:review` で確認シートを作り直し、語の長さが変わって、クリア率が動きそうなときは、シミュレーションで `roles.json` を見直す(0006・0021)。
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

## 更新履歴(Phase 10)

- `/updates/` は、**新しいデータの形を持たない**。`products.json` の `changelog` と `articles.json` から、ブラウザで組み立てる(`public/assets/js/updates/updates.js`。DOM に依存しない。表示は `main.js` で、`el()` だけ)。プロダクトを更新したら、`version` を上げて、`changelog` の先頭に足す(`npm run build` を実行)。それだけで、詳細ページと `/updates/` に出る。
- 不正なプロダクト・記事は、その項目だけ外して、ほかは表示する(警告を出す)。記事の URL は、サイト内のページ(`/` 始まり)だけ。この安全側の挙動を緩めない。種類は、色だけでなく文字(バッジ)でも示す。
- 進め方(小機能単位のテスト公開・戻し方)は `docs/release-process.md`、決定は `docs/decisions/0016-updates.md`。
- フッターのリンクは、ページができたものだけ(`config/nav.js`)。部品を足したら、`/styleguide/` の見本も更新する。

## 問い合わせ(Phase 10)

- フォームは `/support/` の `#contact`。`POST /api/contact` が、内容を D1 の `inquiries` に保存する(**メールは送らない**。運営者が `npm run inquiries` で読む)。手順は `docs/contact-setup.md`、決定は `docs/decisions/0017-contact.md`。`CONTACT_ENABLED=true` と DB などがそろうまで、何もしない(プレビューが壊れないこの性質を変えない)。
- **問い合わせの内容(本文・メールアドレス)を、応答・ログ・監査ログに出さない**。ファイルに書き出さない・外へ送らない(運営者用のコマンドも)。表示は `el()`(textContent)だけ。端末に表示するときは、制御文字を無害化する(`safeText`)。
- 画面(`public/assets/js/contact/rules.js`)とサーバー(`functions/_lib/contact.js`)の規則は、同じ値・同じ判断にする(`tests/contact-page.test.js` が検査する)。サーバーの検査を、緩めない。サーバーに新しいエラーの種類を足したら、`contact/messages.js` にも文を足す。
- ボット対策(罠の欄・最短 3 秒・回数制限)は、ボットには成功に見せて保存しない。罠の欄は、`display: none` にしない。Turnstile などの外部のスクリプトは、入れない(入れるときは、ポリシーの版を上げる)。
- `inquiries` に `user_id` を足さない(ログインと結びつけない)。保存は、対応済みから約 180 日で削除(`--purge`)。バックアップも直近 6 か月まで。この約束を変えるときは、ポリシーの版を上げる。
- **ソースに、制御文字・双方向制御文字を、直接書かない**(文字コードから作る。`tests/contact-page.test.js` が、ソース全体を検査する)。
- **プライバシーポリシーは、版 2**(`analytics.js` の `policyVersion`・ページの `data-policy-version`・本文の版は、そろえる)。個人情報の取り扱いを変えたら、版を上げて、改定の履歴(§8)に足す。

## 語録の確認(Phase 11)

- 語録は、AI の下書き。**人間の確認を受けてから、増やす・直す**。確認は `docs/vocabulary-review.md`(`npm run vocab:review` で、**原稿から生成**する。手で書き換えない。語録を変えたら、作り直す。最新かはテストが検査する)。私の確認メモは、原稿の各語の `note`(Phase 14 から。以前の `docs/vocabulary-review-notes.json` は、原稿に移した)。
- `npm run vocab:stats` で、職種ごとの語数・難易度・カテゴリと、点検(警告)を見る。エラー(重複)は直す。警告は、増やさない(テストが検査する)。難易度は、読みの単位数の決め(0006・0018)に合わせる。
- 説明は、一般に確立した意味だけ。会社・地域・ツールで違うもの、法律上の定義と厳密には違うものは、確認メモに書いて、運営者に見てもらう。意味を推測で作らない。
- 語録のデータを変えたら、`roles.json` のバランス(クリア率)を、シミュレーションで再確認する(0006 の方法)。語録の版(`version`)と、ゲームの更新履歴(`products.json` の `changelog`)も更新する。決定は `docs/decisions/0018-vocabulary-review.md`。

## ゲームの 2 つのモード(Phase 12)

- モードは、**連続タイピング**(従来のゲーム。追ってくる人・時間制限・ランキングあり)と、**用語確認**(追いかけなし・時間制限なし・罰なし・10 語。日本語・読み・説明を見ながら練習)。決定は `docs/decisions/0019-phase-12-check-mode.md`。
- 用語確認の進行・「ミスした語」の集計は `check.js`(DOM に依存しない純粋なロジック)。**用語確認の結果は保存しない**(`store` を呼ばない。ランキング・成績・記録・実績に入れない)。この性質を変えない(テストで検証している)。保存するように変えるときは、記録の版(`DATA_VERSION`)を上げて、移行のテストを書く。
- 用語確認は、プレイ画面を共用する(`data-mode="check"`)。追いかけ専用の部品には `data-chase-only` を付ける(用語確認で隠す)。**view.js・main.js が探す `data-...` の目印は、HTML にあること**(`tests/game-page.test.js` が検査する)。
- 語の説明は、用語確認では常に表示し、連続タイピングでは設定(既定オフ)。設定は `settings.js`(キー `nolito:escape-boss:settings:v1`。**記録のキーとは別**。壊れた値は既定に戻す)。説明などの語録の内容は、`textContent`(`el()`・`setText`)だけで表示する。
- ゲームの画面を変えたら、`public/assets/img/products/escape-boss/` の画面(スタート・プレイ中・用語確認・結果)も撮り直す。

### 復習リスト(Phase 12 PR 2)

- 復習リスト = 直近 20 プレイ(連続タイピング。役職は問わない)でミスした語を、ミスの多い順に、最大 20 語(`review.js`。DOM に依存しない純粋な関数)。元データは、各プレイの結果に保存済みの `wordMisses`。**新しく保存するものはなく、記録の版・形は変えない**。決定は `docs/decisions/0020-phase-12-review-list.md`。
- 語録に見つからない語(id が消えた)・不正なミスの数は、無視する(落ちない)。**語の id を、消さない・つけ替えない**(記録の `wordMisses` が、id で語を指すため)。
- 成績ページの「復習リスト」は、期間・役職の絞り込みの影響を受けない。「復習リストで用語確認をする」は、`/games/escape-boss/?review=1` で、その場で用語確認が始まる(記録は保存しない)。一覧の 1 件の描画は `review-item.js`(textContent だけ)。


### 距離の計算(Phase 12 PR 3)

- 正解で増える距離 = `base_gain` + `gain_per_char × 標準の表記の長さ` + **難易度の分**(`difficulty_gain × (難易度 − 1)`)+ **速さの分**(`speed_gain × 0〜1`。1 語の最初の正しい打鍵から最後の打鍵までの打鍵/秒を、`speed_min_cps`〜`speed_max_cps` の間で割合にする)。**加算だけ**で、速さで距離は減らない。最大値で頭打ち。式は `engine.js`(DOM・時計・乱数に触れない)、決定は `docs/decisions/0022-phase-12-distance.md`。
- 秒は**ゲーム内の経過秒**(`state.elapsed`)。`main.js` が、語ごとに最初の打鍵の時刻を持ち(`wordStartedAt`)、正解のときに `difficulty`・`seconds`・実際の打鍵数(`matcher.typed.length`)を渡す。時間が不正なら、速さの分は 0。用語確認には、距離がない。
- 新しい項目(`difficulty_gain`・`speed_gain`・`speed_min_cps`・`speed_max_cps`)は、`roles.json` の各 `stage` に必要(`tests/data.test.js`)。**式・`roles.json`・語録を変えたら、`tests/balance.test.js`(実際のデータの決まった乱数のシミュレーション)で、クリア率の階段(0006・0022)を確認する**。ずれたら、シミュレーションで `base_gain` などを探し直す。
- スコアには「残り距離 × 5」が入っているので、距離の式を変えると、スコアの尺度も動く。式の変更は、決定ログに、その影響を書く。

## 出題(Phase 13)

- 出題は、職種の語から、役職の対象語を、**重複なしのランダム**で選ぶ(`vocabulary.js` の `pickWords`。語が足りないときだけ再利用。直前と同じ語は続けない)。決定は `docs/decisions/0023-phase-13-weak-words.md`。
- **苦手な語の出やすさ**(`weak.js`。DOM・保存に依存しない純粋な関数): 直近 20 プレイ(復習リストと同じ範囲・同じ数え方 `totalWordMisses`)の `wordMisses` から、ミスした語の重み(`1 + 強さ × min(ミス数, 上限)`)を作り、`pickWords` の `weights` に渡す。**新しく保存するものはない**。段階は なし / ふつう(最大 2 倍)/ 多め(最大 3 倍)で、既定は ふつう。設定は `settings.js`(`weakBoost`。記録とは別のキー)。連続タイピングだけで、用語確認には使わない。
- 語録の `weak_detection.enabled` が `false` の語は、重みを付けない。**強さを上げるとクリア率が下がる**(苦手な語が多い人ほど)。強さ・上限を変えるときは、シミュレーションで影響を見て、決定ログに書く(0023)。
- テストで、重みなしのとき、従来と同じ出題(同じ乱数で同じ結果)であることを検査している。バランスのテスト(`tests/balance.test.js`)は、重みなしの出題で、階段を確認する。

### 入力方式(Phase 13 PR 2)

- 設定「ローマ字の書き方」(`input-style.js`。`settings.js` の `inputStyle`): **標準**(ヘボン式で表示。ほかの書き方も受け付ける。既定)/ **訓令式で表示** / **表示どおりだけ**(ほかの書き方は、ミス)。決定は `docs/decisions/0024-phase-13-input-style.md`。連続タイピングにも用語確認にも効く。
- 受け付ける書き方は `createMatcher(読み, { style, strict })`(`romaji.js`)。**表示する(先頭の)書き方と、受け付ける範囲は別**。標準・訓令式は、si/shi・n/nn・xtu・小さい文字を分けて打つ書き方(kixya など)も受け付ける。語録の `romaji` の全候補が、標準・訓令式で入力できることを、テストが検査する。
- **距離の「文字数の分」は、設定に関係なく、標準の長さ**(`main.js` の `createMatcher(word.reading).canonicalLength`)。`session.matcher.canonicalLength` を使わない(訓令式・表示どおりで、距離が変わるため)。マッチャーは、必ず `newMatcher`(設定の方式)で作る(`tests/game-page.test.js` が検査)。

### 成績の項目と記録の版 3(Phase 13 PR 3)

- 記録の版は **3**(`DATA_VERSION`。版 1・2 も読める)。各結果に `streak`(ミスなしで打ち終えた語の連続の最高)・`wordsByDifficulty`(難易度ごとの打ち終えた語数)がある。**以前のプレイは `null`(記録なし)で、0 とは区別する**。集計(`stats.js` の `summarizeDetails`・`difficultyBreakdown`)は、`null` を対象から除き、表示は「-」。0 として平均しない。決定は `docs/decisions/0025-phase-13-stats.md`。
- 連続・難易度の集計は `engine.js`(`streak`・`bestStreak`・`byDifficulty`。**ミスした時点で連続は 0 に戻る**)。**スコアの式・ランキング・実績には入れない**(成績だけ)。
- 版を上げたので、`storage.js` の移行(版 2 → 3 は `:backup-v2` に一度だけ退避。読み込んだだけでは書き換えない)を保つ。**次に記録の形を変えるときは、`DATA_VERSION` を 4 にして、`normalizeData` で版 1〜3 を読めるようにし、移行のテストを書く**。更新前のタブを開きっぱなしにしている利用者が、記録を「壊れている」と扱う既知のリスクがある(0005・0025)。

## 語録の原稿(Phase 14)

- **語録の管理元は Markdown**: `content/vocabulary/<職種ID>.md`(職種ごとに 1 ファイル。```yaml で囲んだ YAML を、ちょうど 1 つ持つ。形式は `docs/04_templates/vocabulary-template.md`)。公開の `public/data/vocabulary/*.json` は、**`npm run build:vocabulary` が生成する(手で書き換えない。生成物もコミットする。`npm run check` が最新かを検査する)**。`npm run build` は、記事・詳細ページ・語録の 3 つを作る。決定は `docs/decisions/0026-vocabulary-markdown.md`。
- 読み取りは `scripts/lib/vocab-md.mjs`(記事と同じ `yaml` パッケージを、厳しい設定で使う。別名・型の指定・同じキーの重複は、エラー)、検証・正規化は `scripts/lib/vocab-validate.mjs`(DOM・ファイルに触れない。**将来の管理画面(Phase 26)も、同じ検証を使う**)、生成は `scripts/lib/vocab-build.mjs`。エラー(必須の欠け・型・長さ・重複・ローマ字が入力できない・説明が「。」で終わらない・関連用語が同じ職種にない・見えない文字)は、ビルドを失敗させる。この厳しさを、緩めない。
- **下書き(`draft: true`)は、公開の JSON に入れない**。AI が書いた語は、必ず `draft: true` から始める。人間が確認したら、`draft` の行を消す。`review`(`pending` = 確認はまだ・`confirmed` = 済み)と `note`(確認してほしい点)は、原稿だけの項目で、公開の JSON には入れない。**人間の確認を、AI・私の判断で、済みにしない**(運営者が「OK」と言った語だけを、`confirmed` にする)。
- `romaji` は、省略すると、読みから作る(標準の表記 + 訓令式の表記)。書くときは、先頭が画面に表示する書き方で、すべて入力できること。`id` は、消さない・つけ替えない。
- `npm run vocab:check`(検証・確認の状況・確認メモ)・`npm run vocab:check -- --for-ai`(AI チェックに渡す文: 指示 + 機械の確認結果 + 下書きの語)・`npm run vocab:stats`・`npm run vocab:review`。AI の結果は、最終判断にしない(`docs/06_ai/`)。管理画面・AI の API との連携は、作らない(Phase 26・有料の AI に依存しない方針)。
- **ソースに、見えない文字(BOM・向きを変える文字など)を、直接書かない**(文字コードから作る。`\p{Cc}` などの Unicode プロパティは、使ってよい)。

### 詳細説明・学習ポイント・関連用語の表示(Phase 14 PR 2)

- 語の項目の **`detail`**(難語の詳細説明。「。」で終わる 1 行・300 字まで。任意)と、`learning_points`(5 個まで各 60 字)・`related_terms` は、**共通の部品 `review-item.js`** が出す(結果の画面の「今回ミスした語」・用語確認の結果・成績ページの復習リスト)。短い説明(`explanation`)は、いつも見える。詳細説明・学習ポイントは、開閉できる「くわしく」(`<details>`)の中。**詳細説明も学習ポイントもない語には、出さない**。決定は `docs/decisions/0027-vocabulary-detail.md`。
- **プレイ中の画面(入力欄のある画面)には、開閉の部品を置かない**(押すと入力欄のフォーカスが外れる)。語録の文字列は、`el()`(textContent 相当)だけで入れる。`detail` は、書いた語だけ、公開の JSON に入る(ない語には、項目を作らない)。
- **CSS で使うトークン(`var(--…)`)は、`tokens.css` に定義されているものだけ**(`tests/game-page.test.js` が、未定義を検出する)。
- 詳細説明のある語は、いまは 6 語(AI の下書きで、運営者の確認待ち)。増やすときは、0026 の流れ(下書き → 検証 → 人間の確認)を守る。
