# 語録Markdownテンプレート

語録の**管理元**は、`content/vocabulary/<職種ID>.md`(職種ごとに 1 ファイル)です。公開する `public/data/vocabulary/<職種ID>.json` は、`npm run build:vocabulary` が、ここから**生成**します(JSON を手で書き換えません)。

原稿は、Markdown の中に、**` ```yaml ` で囲んだ語録の YAML を、ちょうど 1 つ**書きます。YAML の外の文章(見出し・作成メモ・AI への指示など)は、自由に書けます。

```yaml
job_id: engineer
job_name: エンジニア
version: 1.0.0
updated_at: 2026-09-21
items:
  - id: engineer-001
    japanese: 例
    reading: れい
    romaji: [rei]
    category: 基本
    difficulty: 1
    roles: [senpai]
    explanation: 基本的な説明。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    draft: true
    note: 確認してほしい点(公開されません)
```

## 職種の項目

| 項目 | 内容 |
| ---- | ---- |
| `job_id` | 職種の id(`public/data/jobs.json` にあるもの。ファイル名と同じ) |
| `job_name` | 職種の名前(`jobs.json` の名前と同じ) |
| `version` | `1.2.3` の形。語を足す・直したら、上げる |
| `updated_at` | `YYYY-MM-DD`(実在する日付) |
| `items` | 語の一覧(1 語以上) |

## 語の項目

| 項目 | 必須 | 内容 |
| ---- | ---- | ---- |
| `id` | ○ | `<職種ID>-001` の形。重複しない。**消さない・つけ替えない**(記録・復習リストが、`id` で語を指すため) |
| `japanese` | ○ | 表示する日本語。30 字まで。空白を入れない。全職種で重複しない |
| `reading` | ○ | 読み。ひらがなと長音(ー)だけ。40 字まで。職種の中で重複しない |
| `romaji` | | ローマ字の候補の一覧(8 個まで)。**書かなければ、読みから作ります**(標準の表記 + 訓令式の表記)。書くときは、**先頭が画面に表示する書き方**で、すべて、読みの入力として、最後まで打てること |
| `category` | ○ | カテゴリ。20 字まで |
| `difficulty` | ○ | 1〜5 の整数。読みの長さの決め(単位数 3 以下 = 1、4〜5 = 2、6 以上 = 3。決定ログ 0006)に合わせる |
| `roles` | ○ | 出題する役職の id の一覧(`roles.json` にあるもの) |
| `explanation` | ○ | **短文の説明**。「。」で終わる 1 行、80 字まで。一般に確立した意味だけを書く |
| `related_terms` | | 関連用語の一覧。**同じ職種の、ほかの語の `japanese`**を書く(10 個まで) |
| `learning_points` | | 学習ポイントの一覧(5 個まで、各 60 字まで) |
| `weak_detection` | | `enabled: true` か `false`。苦手な語の出題の重みを付けるか(既定は `true`) |
| `review` | | 人間の確認の状況。`pending`(まだ。既定)か `confirmed`(済み)。公開の JSON には入りません |
| `draft` | | `true` なら**下書き**。公開の JSON に入りません。人間が確認したら、この行を消します |
| `note` | | 確認してほしい点のメモ(200 字まで)。確認シートに載ります。公開の JSON には入りません |

## 新しい語を足す流れ

1. **AI が書く場合**: `docs/06_ai/vocabulary-generation-prompt.md` の指示で、この形式の YAML を出させる。**必ず `draft: true` を付ける**。意味に自信がない語は、`note` に書く(推測で意味を作らない)。
2. 原稿(`content/vocabulary/<職種ID>.md`)に、語を足す。`npm run vocab:check` で、形式・重複・ローマ字・難易度を検査する。
3. **AI チェック**: `npm run vocab:check -- --for-ai` が、AI に渡す文(指示 + 下書きの語 + 機械の確認結果)を出す。AI の結果は、**最終判断にしない**。
4. **人間の最終確認**: `npm run vocab:review` で確認シートを作り、正確性・表記・難易度・適切さを、人間が確認する。直すところは、原稿を直す。
5. 確認できたら、`draft: true` の行を消す(`review: confirmed` にする)。`version`・`updated_at` を更新する。
6. `npm run build`(語録の JSON を生成)と `npm run vocab:review`(確認シート)を実行して、生成物もコミットする。`npm run check` が、生成物が最新かを検査する。
