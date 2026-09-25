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

- プロダクトは `public/data/products.json`(version 5)、カテゴリは `categories.json` で定義する。カテゴリは、データを足すだけで増やせる。検証は `public/assets/js/products/schema.js`(DOM 非依存)、表示用の文字列は `format.js`、カードの描画は `components/product-list.js`。
- 形式を変えるときは、`schema.js` の検証と `tests/products.test.js` を一緒に更新し、`PRODUCT_DATA_VERSION` を上げる。
- `tags`(重複なし・20字以内・10件まで。検索(Phase 20 PR 3)の絞り込みに使う予定)と `featured`(真偽値。トップページの「おすすめ」に出すか)は、Phase 20 PR 2 で追加した(version 5)。
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

- フォームは `/support/` の `#contact`。`POST /api/contact` が、内容を D1 の `inquiries` に保存する(**メールは送らない**。運営者が `npm run inquiries` で読む)。手順は `docs/contact-setup.md`、決定は `docs/decisions/0017-contact.md`。`CONTACT_ENABLED=true` と DB などがそろうまで、何もしない(プレビューが壊れないこの性質を変えない)。**本番は、2026-09-24 に有効化した**(`docs/decisions/0041-terms-and-contact-enabled.md`)。
- **問い合わせの内容(本文・メールアドレス)を、応答・ログ・監査ログに出さない**。ファイルに書き出さない・外へ送らない(運営者用のコマンドも)。表示は `el()`(textContent)だけ。端末に表示するときは、制御文字を無害化する(`safeText`)。
- 画面(`public/assets/js/contact/rules.js`)とサーバー(`functions/_lib/contact.js`)の規則は、同じ値・同じ判断にする(`tests/contact-page.test.js` が検査する)。サーバーの検査を、緩めない。サーバーに新しいエラーの種類を足したら、`contact/messages.js` にも文を足す。
- ボット対策(罠の欄・最短 3 秒・回数制限)は、ボットには成功に見せて保存しない。罠の欄は、`display: none` にしない。Turnstile などの外部のスクリプトは、入れない(入れるときは、ポリシーの版を上げる)。
- `inquiries` に `user_id` を足さない(ログインと結びつけない)。保存は、対応済みから約 180 日で削除(`--purge`)。バックアップも直近 6 か月まで。この約束を変えるときは、ポリシーの版を上げる。
- **ソースに、制御文字・双方向制御文字を、直接書かない**(文字コードから作る。`tests/contact-page.test.js` が、ソース全体を検査する)。
- **プライバシーポリシーは、版 2**(`analytics.js` の `policyVersion`・ページの `data-policy-version`・本文の版は、そろえる)。個人情報の取り扱いを変えたら、版を上げて、改定の履歴(§8)に足す。アカウントを一般公開するタイミングで、版3に上げる予定(Issue #19・決定ログ0040)。
- **利用規約は `/terms/`**(2026-09-24 新設。決定は `docs/decisions/0041-terms-and-contact-enabled.md`)。フッターのリンクにある(`config/nav.js`)。プライバシーポリシーのような「版」の管理はしていない(内容を大きく変えたら、ページ上でお知らせする)。

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

## ゲーム画面の場面(Phase 15)

- プレイ画面の並びは、上から **距離ゲージ → 場面(追ってくる人)→ 単語 → 入力欄**、サイドステータスは横(狭い画面では下)。決定は `docs/decisions/0028-phase-15-scene.md`。場面は飾り(`aria-hidden`)。距離は、ゲージ(`role="progressbar"`)が伝える。
- **役職ごとの動き**は `roles.json` の `scene.motion`(`run`・`pedal`・`drive`・`glide`・`aura`。`scene.js` の `SCENE_MOTIONS`)。CSS は `.scene[data-motion="…"]`。**動きを足す・変えるときは、`scene.js`・CSS・テスト(`tests/scene.test.js`)をそろえる**。絵は、そのまま(描き直しは Phase 16)。
- 追ってくる人は、外側の枠 `.scene__chaser`(位置 = `--closeness` から計算した `left`)と、中の絵 `.scene__chaser-img`(動き)に分ける。**位置は、動きを減らす設定でも、距離に応じて変わる**(この性質を変えない)。
- 危ない(距離が 25% 以下)の判断は、`isDanger`(ゲージと場面で共通)。場面の一瞬の演出は、`view.pulseScene("miss" | "gain")` が `[data-event]` を 350ms だけ付ける。**色・明るさ・影を変えるアニメーションは、1 周 0.8 秒以上**(光の点滅を避ける。テストが検査する)。CSS の `@keyframes` は、名前が定義され、使われていること(テストが検査する)。
- **ヘッドレスの Edge は、この環境では、既定で「動きを減らす」設定**。動きのブラウザ確認では、`page.emulateMediaFeatures` で `prefers-reduced-motion` を、明示する。

### 職種別の背景(Phase 15 PR 2)

- 場面の背景は、職種ごとの SVG(`public/assets/img/escape-boss/bg/<職種ID>.svg`。360×112 を、場面の中で、横に繰り返す)。`jobs.json` の `background` で決め、`scene.js` の `backgroundOf(job)` が、**決まった場所の SVG 以外は `null`**(CSS の `url()` に入れるので、引用符・かっこ・空白・`..`・外部の URL は、通さない)。`view.js` が `--scene-bg` に入れる。決定は `docs/decisions/0029-phase-15-backgrounds.md`。
- **背景は淡い色だけ**(追ってくる人・自分の絵が、埋もれないように)。色が、白・場面の地の色との明るさの比 2.2 以下、濃い輪郭との比 3 以上であることを、テスト(`tests/backgrounds.test.js`)が検査する。**絵に使ってよいのは、装飾の図形だけ**(文字・画像・スクリプト・スタイル・動き・外部の参照は、使わない)。1 枚 3KB 以内。職種を足すときは、`jobs.json` と絵を、そろえる。
- 背景は、連続タイピングで、プレイを始めたときに、その職種の絵だけ読み込む(ダッシュボード・用語確認では読み込まない)。

## キャラクターの絵(Phase 16)

- 追ってくる人(`roles.json` の `image`。5 役職)とあなた(`player.svg`・危ないとき用の `player-panic.svg`)の絵は、**ポップなデフォルメ**(頭・目が大きい・輪郭が太い)の SVG。場所・名前・大きさ(追ってくる人 120×80・あなた 64×80)は変えない。決定は `docs/decisions/0030-phase-16-art.md`(Phase 16 は、絵 → セリフと演出 → 音の 3 PR)。
- **絵に使ってよいのは、図形だけ**(文字・画像・スクリプト・スタイル・動き・フィルタ・`use`・外部の参照は、使わない)。色は、`tests/characters.test.js` の `PALETTE`(13 色)だけ。色を足すときは、テストと決定ログを直す。1 枚 4KB 以内。顔が大きいこと(直径が高さの 25% 以上)もテストが検査する。
- **危ないとき(`.scene.is-danger`)は、CSS で、あなたの絵が焦った顔に入れ替わる**(2 枚とも最初から置く。JS で `src` を書き換えない)。判断は、既存の `isDanger` を使う。
- 役職の個性は、絵(この節)・動き(`roles.json` の `scene.motion`。「ゲーム画面の場面」)・セリフ(PR 2)で出す。**乗り物の種類は、変えない**(動き・文言・記録との対応があるため)。絵を変えたら、`public/assets/img/products/escape-boss/` の画面も撮り直す。

### 開始・終わりの演出とセリフ(Phase 16 PR 2)

- ゲームの進み方は、**intro(開始の演出。「よーい…」→「スタート!」)→ play → outro(終わりの演出)→ 結果の画面**(`session.phase`)。決定は `docs/decisions/0031-phase-16-stage-lines.md`。**intro・outro の間は、入力を受け付けない(ミスにも数えない)。intro の時間は、ゲームの経過時間に入らない**(`startPlaying` で `lastFrame` を取り直す)。タブの切り替え(`visibilitychange`)も、`play` のときだけ時間を動かす。
- **結果は、終わりの演出の前に保存する**(`finish()`)。結果の画面(`view.showResult`)を出すのは、演出の `onDone` の中だけ(飛ばしても 1 回だけ)。やめる・新しいゲームでは、`stopTimeline()` で演出を止める。この順序を変えない。
- 進行は `staging.js`(DOM・時計に触れない。`createTimeline` はタイマーを引数で受ける)。飛ばすのは、演出が出ている間の **Enter・スペース・Esc(入力欄のフォーカス)か、場面のクリック**だけ(`view.bindSkip`)。ボタン・リンク・選択欄のキーは奪わない。文字のキーでは飛ばさない。動きを減らす設定では、短く(文字だけ)。
- **セリフは `roles.json` の `lines`**(役職ごとに、`start`・`near`・`miss`・`clear`・`over` を 3 個以上。1 つ 20 字まで。制御文字・見えない文字・`<>` は不可 = `lines.js` の `isValidLine`)。選び方は `lines.js`(乱数・時刻は引数)。`near`・`miss` は、前の吹き出しから 4 秒あける。**AI の下書きを、運営者が確認してから公開する**(セリフの一覧は、決定ログにある)。冗談は軽い範囲にして、パワーハラスメントを助長する言い方・実在の人物や会社を連想させる言い方は、避ける。
- 吹き出し・バナー・紙吹雪は、場面(`aria-hidden`)の中の飾り。文字は `textContent` だけ。結果の画面には、最後のセリフを文字で残す(`data-result-quote`)。終わりの演出の CSS は、最後の状態で止まる(`forwards`)ので、動きを減らす設定でも、その状態になる。用語確認には、演出もセリフもない。

### 音(Phase 16 PR 3)

- 効果音・BGM は、**ファイルを使わず、Web Audio で合成する**(音のファイル・外部の素材・通信は、なし)。決定は `docs/decisions/0032-phase-16-sound.md`。音の中身(音符・音量の計算・モード)は `sound.js`(DOM・音の出力に触れない純粋なデータ)、鳴らす係は `audio.js`(`createSound`。`AudioContext` は引数で差し替えられる)。音を足す・変えるときは、`sound.js` と `tests/sound.test.js`(範囲・凍結)をそろえる。
- **既定は「なし」**(仕事中に、突然音が出ないように)。設定は `settings.js` の `soundMode`(`off`・`se`・`all`)と `volume`(0〜100)。記録のキー・版(3)は、変えない。**「なし」の間は、`AudioContext` を作らない**。
- **音の準備(`sound.unlock()`)は、操作の中**(スタートのクリック・設定を変える・「音」ボタン・「音を試す」)で呼ぶ(ブラウザの決まり)。**設定を反映(`applySound()`)してから、準備する**(順序をテストが検査)。プレイ中の「音」ボタンは、押したあと、入力欄にフォーカスを戻す。
- BGM は、連続タイピングの遊んでいる間だけ(スタートの 0.6 秒後から)。`finish`・`quit`・新しいゲーム・用語確認の開始で、`sound.stopBgm()`。タブが見えない間は、止める(`setHidden`)。用語確認は、効果音だけ。音が使えない環境・失敗でも、落ちず、静かなままにする。
- 動きを減らす設定は、音とは別。プライバシーポリシーは、音の設定(端末内の保存)では、版を上げない(0032)。**実際の音は、自動テストでは聞けない**(偽の `AudioContext` で、鳴らす指示だけを検査する)ので、音色・音量は、人が聞いて確かめる。
- Phase 16(絵・セリフと演出・音)は、ここまで。役職ごとの BGM・役職別の効果音は、Phase 23 PR1 で対応した(下の節)。演出のスキップ設定は、Phase 23 PR2 で対応する。音声(声)は、将来対応。

## 役職ごとの文字数と特殊ルール(Phase 17)

- 決定は `docs/decisions/0033-phase-17-rules.md`(Phase 17 は、ルールの中身 → ルールの演出 → 役職別のクリア・ゲームオーバー演出の 3 PR)。**0022 の「コンボなどのルールは足さない」は、この Phase の特殊ルールで置き換わった**。バランスの階段(0006・0022)は、そのまま守る。
- **ステージは、1 役職 = 1 ステージ(`stage`)のまま**。ステージを増やす・選ぶのは Phase 18。増やすときは、結果に `stageId` を足し、`DATA_VERSION` を 4 にして、版 1〜3 を読める移行とテストを書く。ルール・語の重みは `stage` の中に置く(将来の各ステージに、そのまま入る)。
- **役職ごとの文字数**は `stage.word_weights`(難易度 `"1"`〜`"5"` → 出やすさの重み。0.1〜10)。難易度は読みの長さの決めなので、難易度の重み = 文字数の出やすさ。**語は削らない**(180 語すべてが、どの役職でも出うる)。`word-weights.js`(DOM・保存・乱数に触れない)の `roleWordWeights` で語ごとの重みにし、苦手な語の重み(`weak.js`)と `mergeWeights` でかけ合わせて、`pickWords` に渡す(`main.js`)。
- **特殊ルール**は `stage.rules`(種類 + 数値の配列)。`rules.js`(DOM・時計・乱数に触れない純粋な計算)が、検証・倍率・説明の文を持つ。種類は `surge`(ダッシュ。時間だけで決まる。予告つき)・`shock`(ミスで加速)・`closing`(追い詰め)。**追ってくる人が距離を縮める速さ(`drain_per_second`)にかける倍率だけ**で、加算・減算はしない。重なっても 3 倍まで。範囲(`RULE_LIMITS`)を外れたルール・同じ種類の 2 つ目は無視される。**新しい種類を足すときは、`rules.js`・`engine.js`・テスト・説明の文をそろえる**。
- `engine.js` の `tick` は、ルールがあるとき、時間を 0.05 秒の刻みに分けて倍率をかける(ルールがなければ従来の計算)。`state.shockUntil` にミスで加速の終わる時刻を持つ。**ルール・重み・`base_gain`・語録を変えたら、`tests/balance.test.js` と、打鍵ごとに時間を進めるシミュレーションで、クリア率の階段(先輩 86〜87 / 係長 89 / 部長 67 / 社長 48〜50 / 会長 75〜76)を確認する**。ルールは値をあとから直せる(`roles.json` だけ)が、直したら、階段を、シミュレーションで探し直す。
- 役職を選ぶと、その役職のルールの説明が出る(`view.js` の `updateRoleRules`。説明は `describeRules`。`textContent` だけ)。プレイ中の予告・演出は PR 2、専用のクリア・ゲームオーバー演出は PR 3。**ルールは、遅く打つ人に厳しい**ので、先輩は「ルールなし」の入門のまま。

### ルールの合図と見せ場(Phase 17 PR 2)

- 決定は `docs/decisions/0034-phase-17-cues.md`。遊んでいる間、ルールが働くことを、**文字**(ゲージの横。`role="status"`。「ダッシュ注意!」「ダッシュ中!」「ミスで加速中!」「追い詰め中!」)と、**場面の飾り**(`data-cues`。頭の「!」・速さの線・追ってくる人が大きくなる)で伝える。
- 合図は `rules.js` の `activeCues`(純粋。`drainMultiplier` と**同じ判断**。予告だけは倍率 1)が決め、`view.renderStats` が、**遊んでいる間だけ**出す(`view.renderCues`)。`main.js` は、ルールの判断に触れない。変わらない合図の文字は、作り直さない(読み上げをくり返さないため)。**合図を足すときは、`CUE_ORDER`・`CUE_LABELS`・CSS・テストをそろえる**。
- 見せ場のアニメーションは、**位置・大きさだけ**(色・明るさ・影・不透明度は変えない)。追ってくる人の大きさは、動き(`transform` のアニメーション)を上書きしないよう、**`scale`**(個別のプロパティ)で変える。動きを減らす設定でも、文字と静止した見せ場は残る。
- 追い詰めの境目(`from`)は、**役職の初期距離(最大距離に対する割合)より低く**する(境目 = 初期距離だと、始まってすぐに働き続ける)。社長の初期距離は 50% なので、40%。

### 役職別のクリア・ゲームオーバー演出(Phase 17 PR 3)

- 決定は `docs/decisions/0035-phase-17-outro.md`。終わりの演出(0031)の見せ方を、役職ごとに 10 種類にした。**`roles.json` の `scene.outro`(`clear` と `over`)**に、見せ方の名前を書く(`scene.js` の `OUTRO_STYLES` にある名前だけ。`outroStyleOf` が検証し、無効・別の種類の値は `null` = 全役職共通の演出)。場面の `data-outro` に入り、CSS の `.scene[data-stage="clear"|"over"][data-outro="…"]` が動かす。
- クリア: `collapse`(先輩)・`tumble`(係長)・`stall`(部長)・`depart`(社長。金の紙吹雪)・`ascend`(会長)。ゲームオーバー: `grab`(先輩)・`pass`(係長)・`skid`(部長)・`shine`(社長)・`engulf`(会長)。**見せ方を足す・変えるときは、`scene.js`・CSS・`roles.json`・テスト(`tests/outro-styles.test.js`)をそろえる**。
- **変えない**: 演出の長さ(約 1.2 秒。動きは 0.5〜1.1 秒)・文字・**結果を演出の前に保存する順序**・飛ばせる操作。専用の動きは、すべて `forwards`(最後の状態で止まる。動きを減らす設定では、最初からその状態)。動くのは位置・大きさ・傾きと、0.8 秒以上の不透明度だけ(色・明るさ・影は変えない。輝き `.scene__glow` は、1.1 秒かけて 1 回だけ現れる)。専用の規則は、属性を 2 つ持ち、共通の規則より強い。共通の規則は、フォールバックとして残す。
- Phase 17(文字数・ルール・ルールの演出・役職別の演出)は、ここまで。

## 経験値・レベル・職種別熟練度(Phase 18 PR 1)

- 決定は `docs/decisions/0036-phase-18-levels.md`(Phase 18 は、経験値・レベル・熟練度 → 難易度の選択 → 隠し実績 → 改善記録の 4 PR)。**記録は版 4**(`DATA_VERSION`。版 1〜3 も読める。移行前の元データは `:backup-v3` に退避)。各結果に `difficulty`(PR 1 の間は「ふつう」だけ。PR 2 で選択できるようにした)、進行状況に `exp`(累計の経験値)・`jobs`(職種ごとの `plays`・`clears`・`words`・`hits`・`miss`)・`difficultyClears`(名前 `役職:難易度`。`storage.js` の `clearKey`)・`bests`(自己ベスト。名前 `職種:役職:難易度`。`bestKey`)を追加した。記録の形は、PR 2 で版 5 に進んだ(下)。
- 経験値・レベルは `levels.js`(DOM・保存・時計に触れない純粋な計算)。1 プレイの経験値は `expForResult`(正解語数 × 10 + クリア 100 + 新しく解放した実績 × 50。難易度の倍率は PR 2 から)。レベルは 1〜50、`expForLevel` の曲線(なだらかに増える)。`records.js` の `grantExp` が、**`recordResult` → 実績の判定(`evaluateAchievements`)のあとに**、進行状況へ加える(`main.js` の `finish()`)。この順序を変えない(新しい実績の数を、経験値の計算に使うため)。
- 職種別の熟練度は `mastery.js`(純粋)。6 段階(見習い〜マスター)は、**語数とクリア数の、両方**が条件を満たして上がる。職種の選択欄(`sub`)・成績ページの「職種別の熟練度」(`stats-page.js` の `renderMastery`。**期間・役職の絞り込みの影響を受けない**。復習リストと同じ考え)に出す。
- 結果画面の獲得経験値・レベルアップの表示は、**保存の警告(`.game__notice`)とは別のクラス(`.result-exp`)**を使う(前向きな知らせに、警告の見た目を使わない)。

### 難易度の選択と、開始前の確認欄(Phase 18 PR 2)

- 決定は `docs/decisions/0037-phase-18-difficulty.md`。難易度は 3 つ: **やさしい**(練習。ランキング・役職クリアの実績・会長の解放には数えない。経験値は少なめ)・**ふつう**(既定。これまでどおり)・**むずかしい**(役職をふつうでクリアすると挑戦できる。経験値は多め)。中身は `public/data/difficulties.json`(`id`・`name`・`description`・`rankable`・`unlock`・`exp_multiplier`・`modifiers`。`roles.json` と同じ、データで決める形)。
- **記録は版 5**(`DATA_VERSION`。版 1〜4 も読める。移行前の元データは `:backup-v4` に退避)。`rankings` のキーを、役職 ID だけ(`"senpai"`)から `役職:難易度`(`storage.js` の `clearKey`。例 `"senpai:normal"`)に変えた。版 1〜4 のランキングは、読み込み時に、すべて「役職:normal」として扱う。**次に記録の形を変えるときは、`DATA_VERSION` を 6 にして、版 1〜5 を読める移行と、移行のテストを書く**。
- 難易度の倍率は `difficulty.js` の `applyDifficulty(stage, difficulty)`(純粋関数)が、役職の `stage` から**新しい stage**を作ってかける。変わるのは **`base_gain`・`gain_per_char`・`drain_per_second`・`initial_distance`(最大距離を超えない)だけ**。`engine.js` は変えない(`main.js` の `beginGame` で、選んだ難易度を stage に反映してから、ゲームを始める)。**ふつうの倍率は 1(変化なし)**。むずかしいの倍率は、シミュレーションで調整した(`tests/balance.test.js`。決定ログに、最初の見積もりが厳しすぎた経緯を記載)。
- `records.js` の `recordResult`: **やさしいは**、累計クリア数・総語数・職種ごとの合計には数えるが、**役職のクリア数(`progress.clears`)・クリア済み職種(`clearedJobs`。実績・会長の解放に使う)には数えない**。ランキングにも載らない。**難易度ごとのクリア数(`difficultyClears`)・自己ベスト(`bests`)は、どの難易度でも記録する**(むずかしいの解放判定・確認欄の自己ベストに使うため)。`PRACTICE_DIFFICULTY`(`difficulty.js` の `"easy"`)で判定する。
- 難易度の解放は `isDifficultyUnlocked(difficulty, { difficultyClears, roleId, clearKey })`(純粋関数。**役職ごとに判定**。`clearKey` は呼び出し側が渡す依存注入。`difficulty.js` を `storage.js` に依存させないため)。
- 画面: 役職の選択の下に、難易度のフィールドセット(役職と同じラジオボタン・ロック中バッジ)。**役職を選び直すたびに、ロック状態を作り直す**(`view.js` の `renderDifficultyList`)。選んだ難易度の説明・経験値の倍率・自己ベスト(あれば)を確認欄に表示(`updateDifficultyInfo`。職種・役職・難易度がそろったとき)。ランキングは、役職の選択欄の下に、難易度の選択欄を追加(やさしいは選択肢に出さない。`rankable` で絞る)。
- Phase 18(経験値・レベル・熟練度 → 難易度の選択)は、ここまで。隠し実績・実績の種類の追加は PR 3(下)。成績ページの改善記録・ハイスコア表は PR 4(下)。

### 隠し実績・実績の種類の追加(Phase 18 PR 3)

- 決定は `docs/decisions/0038-phase-18-achievements.md`。`achievements.json` の各項目に、任意の `hidden: true` を持たせられる。未解放の間、`view.js` の `achievementItem` は、名前・説明・称号を隠す(「??? (隠し実績)」)。**解放した瞬間(結果画面の「新しい実績」)は、hidden の有無に関係なく、必ず全部見える**。解放済み/合計の数には、隠し実績も含める(内容だけを隠す)。
- 実績の判定(`achievements.js`)に、4つの種類を足した: `difficulty_clear`(指定の難易度でクリア)・`all_roles_clear_difficulty`(先輩〜社長を、すべて指定の難易度でクリア。`storage.js` の `clearKey` を使う)・`best_streak`(1プレイの連続正解が、しきい値以上。`result.streak`)・`job_mastery`(いずれかの職種が、指定の熟練度に到達。`mastery.js` の `masteryOf`)。**いずれも、既存の `result`・`progress` の項目だけで判定し、新しい保存項目は増やさない**。`achievements.js` は、`clearKey`・`masteryOf`(どちらも純粋関数)を import してよいが、DOM・保存・時計には触れない性質を保つ。
- 新しい種類の実績を足すときは、`CHECKS`(`achievements.js`)・`ACHIEVEMENT_KINDS`(自動で増える)・`tests/achievements.test.js`・`tests/roles-data.test.js`(パラメータの検証)をそろえる。

### 成績ページの改善記録・ハイスコア表(Phase 18 PR 4)

- 決定は `docs/decisions/0039-phase-18-stats.md`。**Phase 18(経験値・レベル・熟練度・難易度の選択・隠し実績・改善記録とハイスコア表)は、この PR で完了**。
- ハイスコア表は `stats.js` の `bestScoreTable(bests, { jobIds, roleIds, difficultyIds, bestKey })`(純粋関数)。`progress.bests`(職種 × 役職 × 難易度の自己ベスト)から、**役職 × 難易度ごとに 1 行**(職種をまたいだ最高。役職の並び × 難易度の並びの順)にする。改善記録は `bestScoreHistory(results, bestKey, { limit = 10 })`(純粋関数)。保存されている `results` を古い順にたどり、**組ごとに自己ベストが更新された瞬間**(クリアだけ)を、新しい順に最大 `limit` 件返す。どちらも、`bestKey` は `storage.js` のものを、呼び出し側(`stats-page.js`)が渡す(`stats.js` を `storage.js` に依存させないため)。
- **ハイスコア表・改善記録は、期間・役職の絞り込みの影響を受けない**(職種別の熟練度・復習リストと同じ考え)。`stats-page.js` の `init()` から 1 回だけ呼ぶ(`render()` からは呼ばない)。表示の位置も、「職種別の熟練度」の直後・絞り込みの前(`data-scoped` の外)。
- 旧来の役職だけの「ベストスコア」表・`bestScoresByRole`(期間・役職の絞り込みの対象だった)は、削除した(新しいハイスコア表に置き換え)。

## 未登録プレイ・オンラインランキング(Phase 19)

Phase 19 は、複数の PR に分ける(計画は `docs/decisions/0042-phase-19-plan.md`)。PR2・PR3(アカウント移行・オンラインランキング)は、ゲームの記録を初めて運営者のサーバーに送る、privacy-sensitive な変更のため、慎重に進めた(PR2 の決定は `docs/decisions/0043-phase-19-account-sync.md`、PR3 は `docs/decisions/0044-phase-19-online-ranking.md`)。

### 記録の書き出し・読み込み(Phase 19 PR 1)

- `storage.js` の `createStore(backend, { now })` が返す `exportJson()`/`parseImport(text)`/`importJson(text)`(キーみちの `tools/store.js` と同じ考え方)。**移行のしくみを重複させず、既存の `normalizeData`(版1〜5の移行)を、取り込みの検証にそのまま使う**。`EXPORT_FORMAT`・`MAX_IMPORT_BYTES` は `storage.js` からエクスポートする(画面側の事前チェックと、値を共有するため)。
- **取り込みは、いまの記録を、まるごと置き換える**(合わせない)。置き換える前のデータは、`:before-import` に退避する。壊れている記録は、書き出せない(`exportJson()` が `null`)。
- 画面は、ダッシュボード(`/games/escape-boss/`)の「記録の書き出し・読み込み」の節。読み込みは、ファイルを選ぶと、確認のダイアログ(`#backup-import-dialog`。共通の `components/modal.js` を使う)を経由し、**押すまでは置き換えない**。ファイル名は `escape-boss-<日付>.json`。

### アカウント移行(同期。Phase 19 PR 2)

- 決定は `docs/decisions/0043-phase-19-account-sync.md`。ログインすると、アカウントのページ(`/account/`)の「ゲームの記録」の節から、**任意で**、この端末の記録の要約を、アカウント(D1 の `game_progress`。`migrations/0004_game_sync.sql`)に保存できる。**送るのは要約だけ**(ニックネーム・称号・経験値・職種ごとの合計・難易度ごとのクリア数・自己ベスト・実績の解放状況)。**1プレイごとの詳細な記録(`results`)は、送らない**(端末にとどめる。詳細な履歴の引き継ぎは、PR1 の JSON 書き出し・読み込みを使う)。
- 検証は、`storage.js` の `normalizeSyncProgress`(既存の `normalizeData` をそのまま使う。検証・移行のしくみを重複させない)。サーバー側の `functions/_lib/game-sync.js` も、同じ関数を import して使う。API は `GET`/`POST /api/games/escape-boss/sync`(`requireUser`・`checkCsrf`・レート制限 30 回/10分・`audit.js` の `gameSyncSave`)。
- **アップロード(端末→アカウント)は、押すと、その場で送る**。**ダウンロード(アカウント→端末)は、確認ダイアログを経由し、この端末の記録を、まるごと置き換える**(PR1 の取り込みと同じ考え方。結果の履歴・ランキングは、要約に含まれないので、そのまま残る)。アカウントの削除では、`game_progress` の行も消える(端末のブラウザの記録は、消えない)。
- ダッシュボード(`/games/escape-boss/`)に、未ログインの人だけへの、控えめな案内(`data-account-banner`)を追加。「閉じる」で、以後は出さない(`nolito:escape-boss:account-banner-dismissed:v1`。記録の版付きデータとは別の、単純な印)。ログイン状態の確認は、アカウントの API クライアント(`account/client.js` の `fetchMe`)を再利用する。
- **ゲームの記録をサーバーに送る、新しい種類の個人情報の取得のため、プライバシーポリシーは版 3**(6-2-1)。`analyticsConfig.policyVersion` も 3(既存の同意は無効になり、同意のバナーが、もう一度出る)。

### プロフィール公開範囲の設定・オンラインランキング(Phase 19 PR 3)

- 決定は `docs/decisions/0044-phase-19-online-ranking.md`。アカウントのページの「オンラインランキング」から、**任意で**(既定は不参加)参加を切り替えられる(`users.ranking_opt_in`)。参加すると、役職・難易度ごとにクリアしたときの記録(ニックネーム・称号・スコア・職種)が、**ログインしていない人を含む、だれでも見られる**形で公開される。1プレイごとの詳細な記録は、送らない。
- データは `ranking_entries`(`migrations/0005_ranking.sql`)。**1 利用者 × 役職 × 難易度で 1 行**(職種をまたいだ自己ベスト。成績ページの「ハイスコア」= Phase 18 PR4 と同じ考え方)。自己ベストを上回ってクリアしたときだけ、自動で送る(main.js の `submitOnlineRanking`。押すボタンはない)。
- **サーバー側の検証(0004決定ログの約束)**: `functions/_lib/ranking-limits.js` の `isPlausibleScore` が、送られてきたスコアが、その役職の理論上の最大値(目標語数・最大距離・正確率100%・あり得ないほど速い打鍵から計算)を超えていないかを検査する。**スコアの式は、公開の `score.js` の `SCORE_RULES` を、そのまま使う**(重複させない)。役職の構造(目標語数・最大距離・倍率)だけ小さく複製し、`tests/ranking-limits.test.js` で、実際の `roles.json` と値がそろっているかを検査する。
- API は `GET`(ログイン不要。だれでも見られる。IPごとにレート制限)/`POST`(ログイン必須) `/api/games/escape-boss/ranking`、参加の切り替えは `POST /api/ranking-opt-in`。応答に、個人を特定する情報(メールアドレス・アカウントID)は含めない。不参加への切り替え・アカウント削除は、どちらも `ranking_entries` を即座に消す。
- ダッシュボードに、端末内の「ランキング」とは別の「オンラインランキング」の節(役職・難易度を、自分で選べる)。**ゲームの記録をほかの利用者にも公開する、新しい性質の変更のため、プライバシーポリシーは版 4**(6-2-2。「だれでも見られる」ことを明記)。`analyticsConfig.policyVersion` も 4。


## ヘッダーメニュー・トップページ(Phase 20)

Phase 20 は、複数の PR に分ける(計画は `docs/decisions/0045-phase-20-plan.md`)。

### ヘッダーメニューの拡張・モバイルの下部固定バー(Phase 20 PR 1)

- `config/nav.js` の `mainNav` の各項目に、任意の `children: [{ label, href }]`(サブメニュー)を持たせられる。「ゲーム」「ツール」に、実在するページへのリンクを付けた。`available: false`(準備中)の項目には、`children` を付けない。
- **PC**: `children` を持つ項目はボタンになり(`aria-expanded`・`aria-haspopup="true"`・`aria-controls`)、クリックでドロップダウンを開閉する。Esc・外側クリック・別項目を開くと閉じる(`components/nav.js`)。
- **モバイル**: ハンバーガーのパネルでは、サブメニューを**常に展開した状態**で、親子をそのまま並べる(パネルの中に、もう1段の開閉を作らない)。
- モバイル専用の下部固定バー(`bottomNav`。ホーム・ゲーム・ツール・記事)を追加(`components/bottom-nav.js`)。幅 48rem 未満だけに表示し、`main` に、バーの高さぶんの余白を付けて、本文が隠れないようにする。

### トップページ(Phase 20 PR 2)

- トップページ(`/`)は、「おすすめ」「カテゴリから探す」「最新情報」の3節。**新しいデータの形は作らない**(既存のしくみを再利用する)。
- 「おすすめ」: プロダクトの `featured: true` だけを、既存の `components/product-list.js`(`renderProductList`)で描く(`data-featured` 属性。カテゴリ絞り込みの代わり)。
- 「カテゴリから探す」: `categories.json` の、一覧ページ(`path`)があるカテゴリを、新しい部品 `components/category-list.js` でカードにする。データを足すだけで増える。
- 「最新情報」: `/updates/` と**同じ組み立て**(`updates.js` の `buildUpdates`)を再利用し、新しい順に最大5件(`home/main.js`。ページ固有の DOM 処理)。
- プロダクトに `tags`(重複なし・20字以内・10件まで)を追加した(`PRODUCT_DATA_VERSION` を 5 に)。検索(PR3)の絞り込みに使う予定で、この PR では表示にまだ使わない。

### 検索(Phase 20 PR 3)

- 検索(`/search/`)は、プロダクト・記事・「上司から逃げろ」の用語を、まとめて検索する。**索引は、実行時に、公開の JSON(products.json・articles.json・vocabulary/*.json の6職種分)を読んでまとめる**(`search/search.js` の `buildIndex`。DOM に依存しない)。ビルド時に生成する専用の索引ファイルは作らない(`/updates/` と同じ、実行時マージの考え方)。
- キーワードは、種類ごとの対象の文字に、単純な部分一致(大文字小文字を区別しない)。**用語(語録)は、1プレイごとの詳細な記録などの個人情報を、いっさい扱わない**(公開データの語録だけが対象)。遊ぶ先(`/games/escape-boss/`)へリンクする(語1つに対応するページはないため)。
- 絞り込み(カテゴリ・タグ・職種)は、**その性質を持たない種類には、絞り込みで除かれる**(職種で絞ると、用語だけが残る、など)。かけ合わせ(かつ条件)。検索語・絞り込みは `?q=&category=&tag=&job=` に反映する(`history.replaceState`。共有・ブックマークできるように)。
- ヘッダーのナビ(`config/nav.js`)に「検索」を追加(サブメニューなし)。モバイルの下部固定バーには追加しない。
- Phase 20(ヘッダーメニュー拡張・トップページ・検索)は、この PR で完了。

## アクセシビリティ強化(Phase 21)

Phase 21 は、複数の PR に分ける(計画は `docs/decisions/0046-phase-21-plan.md`)。

### ライト・ダーク・システムテーマ(Phase 21 PR 1)

- 選べる項目は「ライト」「ダーク」「システム(既定)」の3つ。保存は `public/assets/js/components/theme.js`(DOM に依存しない純粋な関数)が、`localStorage` の**新しいキー** `nolito:theme:v1`(値は `"light"` / `"dark"` / `"system"`)に行う。ゲーム・ツールの記録・設定のキーとは別(サイト全体の見た目の設定のため)。
- 反映は `<html data-theme="light|dark|system">`。CSS は `tokens.css` の3段階: `:root`(ライトが既定)→ `@media (prefers-color-scheme: dark)` かつ `:not([data-theme="light"])` でダークへ(**システム**選択時、OSの設定に追従)→ `:root[data-theme="dark"]` で、OSの設定に関係なく強制的にダークへ。**「ライト」を明示すると、OSがダークでも、ライトのまま**。**色はすべてトークン(`var(--color-...)`)経由**という既存ルールを守り、ダークの上書きも、同じトークン名の値を変えるだけ(新しいトークンを増やさない)。
- **アクセント色(`--color-accent`・`--color-on-accent`)は、ライト・ダーク共通**(意図的に上書きしない。暗い背景でも明るい背景でも、はっきり見えるため)。**配色は、すべて WCAG AA(通常文字 4.5:1・UI部品 3:1)以上のコントラスト比になるよう計算して決めた**(`tests/theme.test.js` が、実際の `tokens.css` の値から比率を検査する)。新しいトークンを足す・ダークの値を変えるときは、この検査を通すこと。
- **ちらつき防止(FOUC)**: `<head>` の、スタイルシートの `<link>` より前に、小さい同期実行のインラインスクリプト(`type="module"` ではない)を置き、`localStorage` の `nolito:theme:v1` を読んで、CSS 読み込み前に `data-theme` を設定する(読めなくても、落ちない・既定=システムのまま)。**新しいページ(手書き HTML)を作るときは、このスクリプトを、既存のページと同じ内容・同じ位置(viewport の meta の直後)にコピーすること**。生成ページ(記事・プロダクト詳細)は、共通テンプレート `scripts/lib/render.mjs` の `renderDocument()` に、すでに入っている(個別に足す必要はない)。
- 切り替えの UI は、フッターの「テーマ」`<select>`(`data-theme-select`。`components/footer.js` が描画、`main.js` の `initTheme()` が初期化・変更を監視)。**モーダルの背景幕**(`.modal::backdrop`)は、唯一トークン化されていなかった色を `--color-backdrop`(ライト・ダーク共通の暗い半透明)に切り出した。
- **既知の制限(この PR では対応しない)**: ゲームの場面の背景 SVG(Phase 15 PR2)・キャラクターの絵(Phase 16)は、ライトテーマ向けの配色のまま作り直していない(`aria-hidden` の装飾要素で、操作には影響しない)。問題が見つかれば、別 Issue で検討する。

### サイト内文字サイズ・アニメーション軽減の切替(Phase 21 PR 2)

- **文字サイズ**は「標準」「大きめ」「特大」の3つ(既定=標準)。保存は `components/font-size.js`(theme.js と同じ形)が `localStorage` の `nolito:font-size:v1` に行う。反映は `<html data-font-size="large|xlarge">`(標準は属性なし)。`tokens.css` の `:root[data-font-size="large"|"xlarge"] { font-size: ...% }` で、**ルートのフォントサイズだけ**を変える。`--font-size-*` トークンはすべて `rem` のままなので、個別のトークンを増やさず、サイト全体が連動して拡大する(ブラウザの拡大表示と同じ仕組みに乗る)。
- **アニメーション軽減**は「システムの設定に合わせる(既定)」「アニメーションを減らす」の**2つだけ**(**「常に動かす」は選べない**。OSが「動きを減らす」を指定している利用者に、サイト側が動きを強制的に戻す選択肢は作らない。前庭障害等への配慮)。保存は `components/motion.js` が `localStorage` の `nolito:motion:v1` に行う。反映は `<html data-reduced-motion="reduce">`(既定=属性なし)。`base.css` の既存の `@media (prefers-reduced-motion: reduce)` ブロックに加え、`:root[data-reduced-motion="reduce"]` でも同じ抑制ルール(`animation-duration: 0.01ms !important` 等)を適用する(OSの設定に、サイト内切替を上乗せする形。CSSのルール自体は複製しない)。
- **JSで動きの軽減を判定したいとき**(ゲームの開始・終わりの演出の長さなど)は、`components/motion.js` の `prefersReducedMotion()` を使う(サイト設定 or OSの `matchMedia` の、どちらかが `reduce` なら `true`)。**直接 `matchMedia("(prefers-reduced-motion: reduce)")` を呼ばない**(ゲームの `games/escape-boss/main.js` は、この関数経由に変更済み)。
- FOUC防止のインラインスクリプト(PR1で全ページに追加済み)に、`nolito:font-size:v1`・`nolito:motion:v1` の読み取りも、同じスクリプトの中に追加した(スクリプトを3つ並べない)。**新しいページを作るときは、この拡張済みの内容をコピーすること**(3つの設定を、まとめて1つのスクリプトで読む)。
- UIは、フッターの「テーマ」の隣に「文字サイズ」「アニメーション」の `<select>`(`data-font-size-select`・`data-motion-select`)。
- **サイト全体のキーボード操作の点検・コントラスト/色以外の表現の点検**(仕様が求める横断的な確認)を、この PR で実施した(結果は `docs/decisions/0046-phase-21-plan.md` のテスト結果に記載)。**どちらも、既存の実装(スキップリンク・モーダルのEsc・ハンバーガーメニュー・バッジの文字表示等)が、点検の基準を満たしていることを確認しただけで、この点検を理由にしたコードの修正はしていない**。

### テーマ・文字サイズ・アニメーション軽減のアカウント同期(Phase 21 PR 3)

- Phase 19 PR2(`game_progress`)と**同じ形**: 新しいテーブル `site_settings`(`migrations/0006_site_settings.sql`。`user_id` 主キー。1行だけ・まるごと上書き)、`functions/_lib/settings-sync.js`(検証は `components/theme.js`・`font-size.js`・`motion.js` の `isTheme`・`isFontSize`・`isMotion` を、そのまま import。サーバー用の別の検証関数を作らない)、`GET`/`POST /api/settings/sync`(`requireUser`・`checkCsrf`・レート制限30回/10分・`audit.js` の `settingsSyncSave`)。
- UI は、アカウントページの「ゲームの記録」の節の下の「表示設定」。**アップロードは、押すと即時**。**ダウンロードは、確認ダイアログ経由**で、この端末の3つのキー(`nolito:theme:v1`・`nolito:font-size:v1`・`nolito:motion:v1`)を、まるごと置き換え、`applyTheme`・`applyFontSize`・`applyMotion` で即座に見た目にも反映し、フッターの3つの `select` の表示値も合わせる。
- **プライバシーポリシーの版は、上げていない**(いまの版4のまま)。テーマ・文字サイズ・アニメーションの好みは、氏名・行動履歴・成績のような、利用者を特徴づける情報ではないと判断した(Phase 19 PR2・PR3 が版を上げたのは、行動・実力を特徴づける情報を初めて送ったため。今回は性質が異なる)。判断の理由は `docs/decisions/0046-phase-21-plan.md` に記載。
- アカウント削除では、`site_settings` の行も消える(`deleteUser`。端末のブラウザの設定は、消えない)。ゲームの記録の同期(`game_progress`)とは、**完全に別のテーブル・別のAPI**(疎結合。ゲームをしない利用者も、テーマだけ同期できる)。
- Phase 21(ライト・ダーク・システムテーマ・文字サイズ・アニメーション軽減・キーボード操作点検・コントラスト点検・アカウント同期)は、この PR で完了。

## ソフトウェアキーボード・外付けキーボード・縦横自動調整(Phase 22)

Phase 22 は、複数の PR に分ける(計画は `docs/decisions/0047-phase-22-plan.md`)。

### モバイル・ソフトウェアキーボード対応・縦横自動調整・回転対応(Phase 22 PR 1)

- ゲームの文字入力(`input.js`)は、**すでに** `keydown` ではなく `input` イベントで読む設計(Phase 8)。ソフトウェアキーボード・外付けキーボード、どちらでも、同じしくみで動く(この PR で変更していない)。
- **プレイ中(入力欄がある間)は、モバイルの下部固定バー(`bottom-nav`)を隠す**(`view.js` の `showView("play")` が `document.body` に `data-hide-bottom-nav` を付け、それ以外の画面では外す。`layout.css` の `body[data-hide-bottom-nav] .bottom-nav { display: none; }`)。ソフトウェアキーボードと、縦の領域を取り合わないようにするため。
- **ソフトウェアキーボードが開いたとき**(`window.visualViewport` の `resize`。物理キーボード・デスクトップでは、ほぼ発生しない)、**入力欄にフォーカスがある間だけ**、`inputBox.scrollIntoView({ block: "nearest" })` する。**`input` の `focus` イベント自体では、スクロールしない**(ゲーム開始時の自動フォーカス等のたびに、デスクトップで意図せず画面が動くのを防ぐため)。
- **ゲームの `input.focus()` の呼び出しは、すべて `{ preventScroll: true }` を付ける**(ブラウザの既定の自動スクロールも止める。新しく `input.focus()` を呼ぶ処理を足すときも、これに合わせること)。
- **横向き(landscape)の低い画面**: `game.css` の末尾(カスケードの都合で、他の `.scene` 等のルールより、あとに書く必要がある)に `@media (orientation: landscape) and (height <= 32rem)` を置き、ヘッダーの高さ(`--header-height` トークンを、この場面だけ `--tap-size` に上書き)・`.main` の余白・ゲージ/場面/単語カードの余白と文字サイズを詰める。**並び順(距離ゲージ→場面→単語→入力欄。Phase 15)は変えない**。画面の回転そのものは、`screen.orientation.lock` 等で固定しない(CSSのメディアクエリだけで対応する)。
- **既知の制限(対応しない)**: kii-michi の「キーを押して入力」(`event.code`。物理的な位置で読む設計。Phase 8)は、タッチ画面の仮想キーボードでは、意味のある `event.code` が得られないため、機能しない。ツールの目的(実在するキーボードショートカットの登録)自体が、物理キーボードを前提にしているため、Phase 22 では対応しない。

### タッチ操作の点検(Phase 22 PR 2)

- **新機能ではなく、既存実装の点検**(実ブラウザで、タッチをエミュレートして、実際にタップして確認)。結果、**問題は見つからず、コードの修正はしていない**(Phase 21 PR2 のキーボード/コントラスト点検と、同じ考え方)。
- 確認できた設計: 職種・役職の選択(`job-option`)は、透明な `<input>` が、見た目のラベル全体(`inset: 0`)を覆い、ラベルのどこをタップしても選べる。チャート(`chart.js`)は、`pointerdown` でも値を出す(なぞらず、タップだけで値が出るよう、あらかじめ作られていた)。`:hover` は、色の変化だけで、機能をホバーの裏に隠していない(タッチでは `:hover` が働かないため重要)。`--tap-size`(44px)は、チェックボックス・ボタン・ヘッダー等、主要な操作対象で、すでに使われている。
- **これらの設計は、`tests/touch-operation.test.js`(静的な検査)で、退行しないよう守っている**(実ブラウザのタッチE2Eは、CIに含まれないため)。新しく、タップで操作する部品を作るときは、この点検の観点(全面タップ可能・`--tap-size`・ホバー非依存)を守ること。
- Puppeteer の `touchscreen.tap(x, y)` は、ビューポート座標を使う(ページ全体の座標ではない)。タッチのE2Eを書くときは、対象を `scrollIntoView` してから、座標を取り直すこと。

### 画像・アニメーション・音声の最適化点検・低性能端末向け設定(Phase 22 PR 3)

- **画像・アニメーション・音声は、点検の結果、コードの変更はしていない**: 画像は SVG 中心・スクリーンショットは既に `loading="lazy"`。アニメーションは Phase 21 で対応済み。音声は Web Audio 合成のみで、そもそも最適化が要らない設計(Phase 16 PR3)。
- **低性能端末向けの新しい設定「グラフィックを抑える」**(`settings.js` の `simpleGraphics`。既定 false。ゲームの設定=`nolito:escape-boss:settings:v1` に追加。サイト全体の`nolito:motion:v1`=Phase21とは**別軸**)。ONのとき: (a) 場面の背景SVG(`--scene-bg`)を読み込まない(`view.js` の `showPlay`)。(b) 終わりの演出の紙吹雪・輝き(`.scene__confetti`・`.scene__glow`)を、CSS(`.scene[data-simple-graphics]`)で消す。**「動きを減らす」(アニメーションの速さを止める)とは別に、描画される要素の数を減らす**、という役割分担。
- UI は、ダッシュボードの「プレイ中に、用語の説明も表示する」の直後に、同じ形のチェックボックス(`data-simple-graphics`。`data-graphics-option` で囲み、用語確認では隠す。場面がそもそもないため)。
- **CSSの詳細度に注意**: 紙吹雪・輝きの通常の表示ルール(役職ごとの `outro`。属性2つ)は、詳細度が高い。輝きは `display: block` を上書きするため、抑える側は `!important` が必要(Phase 21 の「動きを減らす」設定の `animation-duration` 上書きと同じ考え方)。紙吹雪は、`depart` 用のルールが `display` を触らないため、`!important` なしで、詳細度の低いほうを**先に**書くだけで足りる(stylelint の `no-descending-specificity` に従う)。新しく `.scene__confetti`・`.scene__glow` 関連のCSSを足すときは、この順序に注意すること。
- **Phase 22(ソフトウェアキーボード・外付けキーボード・縦横自動調整・タッチ操作・回転対応・画像/アニメーション/音声最適化・低性能端末設定)は、この PR で完了**。

## 役職ごとのBGM・効果音・演出設定(Phase 23)

Phase 23 は、複数の PR に分ける(計画は `docs/decisions/0048-phase-23-plan.md`)。

### 役職ごとのBGM・効果音(職種・役職・状況による変化。Phase 23 PR 1)

- `roles.json` の各役職に `sound: { tempo, pitch }`(倍率。既定に近い値)を追加。**役職が進むほど、わずかに速く(tempo)・高く(pitch)なる**(先輩 1.0/1.0 → 会長 1.2/1.1。0006決定ログの「役職が進むほど難しくなる」に、音でも寄り添う)。検証・既定値は `role-sound.js` の `roleSoundOf(role)`(DOM・音に触れない純粋関数。壊れた値は、`tempo`・`pitch` それぞれ独立に、既定=1へ戻す)。
- **職種による音の変化は、対応していない**(既知の制限)。職種ごとに別の旋律を作ることは、6職種分の作曲という、この案件のデータ駆動(数値の調整)という設計方針を超える大きなコンテンツ制作になるため。職種の個性は、背景の絵(Phase 15)で出している。
- **「状況」による変化 = 「危ない」状態(`isDanger`)の間、BGM が少し速くなる**(`role-sound.js` の `DANGER_TEMPO_BOOST`。役職の tempo に、さらに掛け算する)。危なくなくなったら、元に戻す。効果音の高さは変えない。既存の `isDanger` 判定(ゲージ・場面・合図と共通)を再利用する(新しい判定を増やさない)。
- 実装は、`sound.js`(`bgmStepNotes(step, pitch)`・`effectNotes(name, pitch)`。**音の高さ(hz・to)だけを倍率でずらす。音色・長さ・大きさは変えない**)と、`audio.js`(`createSound()` が返す `setRoleSound({ tempo, pitch })`・`setDanger(active)`。BGM の拍の間隔=`BGM_STEP_SEC / (tempo × danger倍率)`で、速さを表す)。
- `main.js` の `beginGame` で、ゲーム開始のたびに `sound.setRoleSound(roleSoundOf(role))` を呼ぶ(危ない状況の倍率もリセットされる)。`tick` で、危ない状態が**変わったときだけ**(毎フレームではない)`sound.setDanger(danger)` を呼ぶ。`quit`(ダッシュボードに戻る)で、`sound.setRoleSound()`(既定)に戻す。
- **実際の音は、自動テストでは聞けない**ので、`tests/role-sound.test.js` は、偽の `AudioContext`(`tests/audio.test.js` と同じ考え方)で、鳴らす指示(周波数・拍の間隔)を検査する。人による音の確認(音色・不快でない範囲か)も、別途行う。
