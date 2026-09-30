# データモデル

最終更新: Phase 30(2026-09-30)。保存の場所は、性質で 3 つに分かれる。

## 1. D1(サーバー。`migrations/` が正)

| テーブル | 中身 | 追加 |
| -------- | ---- | ---- |
| `users` | 利用者(メールアドレス・ニックネーム・ランキング参加の有無など) | 0001 |
| `sessions` | ログインのセッション(トークンは SHA-256 のハッシュだけ) | 0001 |
| `audit_log` | ログインなどの短い出来事ログ(180 日) | 0001 |
| `rate_limits` | 回数の制限(キーにメールアドレス・IP をそのまま入れない) | 0001 |
| `licenses` | ライセンス(キーのハッシュと末尾 4 文字だけ。キー本体は保存しない) | 0002 |
| `inquiries` | 問い合わせ(ログインと結びつけない。対応済みから約 180 日で削除) | 0003 |
| `game_progress` | ゲームの記録の**要約**(1 プレイごとの詳細は送らない) | 0004 |
| `ranking_entries` | オンラインランキング(1 利用者 × 役職 × 難易度で 1 行。参加した人だけ) | 0005 |
| `site_settings` | テーマ・文字サイズ・アニメーションの設定(1 利用者 1 行) | 0006 |
| `admin_audit_log` | 管理画面の変更の前後(個人情報は自動で伏せる。180 日) | 0007 |
| `products` | プロダクトの管理元(1 件の JSON) | 0008 |
| `affiliate_links` | アフィリエイト・広告のリンク(1 件の JSON。最初は空) | 0009 |

- **既存のマイグレーションのファイルは書き換えない。** 新しい番号のファイルを足し、同じ SQL(コメントなし・1 回に 1 文)を `docs/auth-setup.md` にも載せる。本番の D1 には、マージの前に実行する。
- 本番の D1 には個人情報が入っている。バックアップは `docs/backup.md`(リポジトリの中に置かない)。

## 2. 静的データ(`public/data/`。誰でも読める)

- プロダクト(`products.json`・`categories.json`)・記事(`articles.json`)・ゲームの職種・役職・難易度(`jobs.json`・`roles.json`・`difficulties.json`)・語録(`vocabulary/<職種ID>.json`)・広告リンク(`affiliates.json`)。
- 語録は、職種 ID・難易度・役職対象・表示日本語・読み・ローマ字候補・説明・関連用語・学習ポイント・苦手判定情報・版を持つ。管理元は Markdown の原稿(`content/vocabulary/*.md`。下書き・確認の状況・確認メモを持つ)で、公開の JSON は検証を通して生成する(`docs/04_templates/vocabulary-template.md`)。**語の id は、消さない・つけ替えない。**
- `products.json`・`affiliates.json` は、D1 が保存元になったあとも、D1 のない環境のフォールバック・詳細ページの生成に使う(管理画面の編集は D1 にだけ反映される)。

## 3. 端末内の保存(LocalStorage)

| キー | 中身 | 版・注意 |
| ---- | ---- | -------- |
| `nolito:escape-boss:v1` | ゲームの結果・ランキング・実績・プロフィール・経験値 | データの版は `DATA_VERSION`(いま 5。版 1〜4 も読める)。キー名の `v1` は変えない |
| `nolito:escape-boss:settings:v1` | ゲームの設定(音・語の説明・入力方式など) | 記録とは別のキー。壊れた値は既定に戻す |
| `nolito:tool:<ツールID>:<ワークスペース>:v1` | ツールの利用者のデータ(キーみち) | `createToolStore` が保存。壊れたデータは `:corrupt` に退避 |
| `nolito:theme:v1`・`nolito:font-size:v1`・`nolito:motion:v1` | サイトの表示設定 | アカウントに同期できる(任意) |
| `nolito:escape-boss:account-banner-dismissed:v1` | 登録案内を閉じた印 | 単純な印 |

## 主なエンティティと保存先の対応

| エンティティ | 保存先 |
| ------------ | ------ |
| User・Profile | D1(`users`)・ニックネーム等はゲームの記録にも |
| GameResult・Achievement | 端末(LocalStorage)が正。要約だけ、任意で `game_progress` |
| Vocabulary・Job・Role | `content/`(原稿)→ `public/data/`(生成) |
| Product | D1(`products`)・`public/data/products.json` |
| Article | `content/articles/*.md` → `public/data/articles.json` |
| License | D1(`licenses`。発行は運営者のパソコンの `issue-license.mjs`) |
| SupportRequest | D1(`inquiries`) |
| AuditLog | D1(`audit_log`・`admin_audit_log`) |
| Purchase | **まだない**(有料のソフト・販売サービスの選定が先。Issue #12) |
