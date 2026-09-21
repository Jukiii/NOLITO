# 講師・教育の語録(teaching)

このファイルが、語録の**管理元**です。公開する `public/data/vocabulary/teaching.json` は、`npm run build:vocabulary` が、ここから作ります(JSON を手で書き換えません)。書き方は `docs/04_templates/vocabulary-template.md`。

- 新しい語は、`draft: true` で足します。下書きは、公開されません。人間が確認したら、`draft` の行を消します。
- `review` は、人間の確認の状況です(`pending` = まだ、`confirmed` = 済み)。
- `note` は、確認してほしい点のメモです(公開されません)。
- `romaji` は、書かなければ、読みから作ります。書くときは、先頭が画面に表示する書き方です。
- 語の `id` は、消さない・つけ替えない(記録・復習リストが、`id` で語を指します)。

```yaml
job_id: teaching
job_name: 講師・教育
version: 0.4.0
updated_at: 2026-09-21
items:
  - id: teaching-001
    japanese: 板書
    reading: ばんしょ
    romaji: [bansho]
    category: 授業
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 黒板やホワイトボードに書くこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-002
    japanese: 授業
    reading: じゅぎょう
    romaji: [jugyou, zyugyou]
    category: 授業
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 先生が生徒に教える時間のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-003
    japanese: 宿題
    reading: しゅくだい
    romaji: [shukudai]
    category: 授業
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 家庭などで取り組むように出される課題のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-004
    japanese: 評価
    reading: ひょうか
    romaji: [hyouka]
    category: 指導
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 学習の成果や達成度をみて判断すること。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-005
    japanese: 復習
    reading: ふくしゅう
    romaji: [fukushuu]
    category: 授業
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 学んだことをもう一度学び直すこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-006
    japanese: 面談
    reading: めんだん
    romaji: [mendann]
    category: 指導
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 本人や保護者と、直接会って話すこと。
    related_terms: [保護者]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-007
    japanese: 保護者
    reading: ほごしゃ
    romaji: [hogosha, hogosya]
    category: 指導
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 子どもを保護し、養育する立場の人のこと。
    related_terms: [面談]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 「子どもを保護し、養育する立場の人」としています。法律上の定義(親権者など)とは、厳密には一致しません。さまざまな立場の人を含む書き方にしています。
  - id: teaching-008
    japanese: 指導案
    reading: しどうあん
    romaji: [shidouann]
    category: 授業
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 授業の目標や進め方をまとめた計画書のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-009
    japanese: 時間割
    reading: じかんわり
    romaji: [jikanwari, zikanwari]
    category: 授業
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 授業などの時間の割り当てを示した表のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-010
    japanese: 出席簿
    reading: しゅっせきぼ
    romaji: [shussekibo]
    category: 指導
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 出欠を記録する帳簿のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-011
    japanese: 教科書
    reading: きょうかしょ
    romaji: [kyoukasho, kyoukasyo]
    category: 授業
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 授業で使う、学習内容がまとめられた本のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-012
    japanese: 小テスト
    reading: しょうてすと
    romaji: [shoutesuto, syoutesuto]
    category: 授業
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 短い時間で行う、簡単なテストのこと。
    related_terms: [評価]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-013
    japanese: 成績
    reading: せいせき
    romaji: [seiseki]
    category: 指導
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 学習の結果や達成度を表したもののこと。
    related_terms: [評価]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-014
    japanese: 欠席
    reading: けっせき
    romaji: [kesseki]
    category: 指導
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 学校や授業などを休むこと。
    related_terms: [出席簿]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-015
    japanese: 進路
    reading: しんろ
    romaji: [shinro, sinro]
    category: 指導
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 卒業後に進む道のこと。
    related_terms: [面談]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-016
    japanese: 指導
    reading: しどう
    romaji: [shidou, sidou]
    category: 指導
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 目標に向かうように、教え導くこと。
    related_terms: [指導案]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-017
    japanese: 児童
    reading: じどう
    romaji: [jidou, zidou]
    category: 指導
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 小学校で学ぶ子どものこと。
    related_terms: [学級]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 法令では、年齢で「児童」を定める場合があります(この説明は、学校教育での一般的な意味です)。
  - id: teaching-018
    japanese: 補習
    reading: ほしゅう
    romaji: [hoshuu, hosyuu]
    category: 授業
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 授業でわからなかったところなどを、追加で教えること。
    related_terms: [復習]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-019
    japanese: 担任
    reading: たんにん
    romaji: [tanninn]
    category: 指導
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 学級や学年を受け持つ、教員のこと。
    related_terms: [保護者]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 学校の種類・地域によって、担任の役割や呼び方が違います。説明は、一般的な形にしています。
  - id: teaching-020
    japanese: 教室
    reading: きょうしつ
    romaji: [kyoushitsu, kyousitu]
    category: 授業
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 授業を行う、部屋のこと。
    related_terms: [授業]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-021
    japanese: 校則
    reading: こうそく
    romaji: [kousoku]
    category: 指導
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 学校が、児童生徒に守らせるために決めた決まり。
    related_terms: [指導]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 学校によって、校則の名称・内容・決め方が違います。説明は、一般的な形にしています。
  - id: teaching-022
    japanese: 学級
    reading: がっきゅう
    romaji: [gakkyuu]
    category: 学校運営
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 授業や生活の単位として、児童生徒を分けた集まり。
    related_terms: [担任]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-023
    japanese: 学年
    reading: がくねん
    romaji: [gakunenn]
    category: 学校運営
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 年齢や学習の進み具合によって分けた、学校での 1 年ごとの区分。
    related_terms: [学級]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-024
    japanese: 始業式
    reading: しぎょうしき
    romaji: [shigyoushiki, sigyousiki]
    category: 学校運営
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 新しい学期や学年のはじめに行う、式のこと。
    related_terms: [時間割]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-025
    japanese: 授業参観
    reading: じゅぎょうさんかん
    romaji: [jugyousankann, zyugyousankann]
    category: 学校運営
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 保護者などが、授業の様子を見に来ること。
    related_terms: [保護者]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-026
    japanese: 家庭訪問
    reading: かていほうもん
    romaji: [kateihoumonn]
    category: 指導
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 教員が児童生徒の家を訪ねて、様子や環境を知るために話をすること。
    related_terms: [保護者, 面談]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 実施しない学校・地域もあります。説明は、一般的な形にしています。
  - id: teaching-027
    japanese: 三者面談
    reading: さんしゃめんだん
    romaji: [sanshamendann, sansyamendann]
    category: 指導
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 教員・保護者・児童生徒の三者で行う面談。進路などを話し合う。
    related_terms: [面談, 進路]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 学校によって、名称・参加する人・進め方が違います。説明は、一般的な形にしています。
  - id: teaching-028
    japanese: 提出物
    reading: ていしゅつぶつ
    romaji: [teishutsubutsu, teisyutubutu]
    category: 授業
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 宿題やレポートなど、児童生徒が先生に出すもの。
    related_terms: [宿題]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: teaching-029
    japanese: 学習計画
    reading: がくしゅうけいかく
    romaji: [gakushuukeikaku, gakusyuukeikaku]
    category: 授業
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: いつ何をどのように学ぶかを、あらかじめ決めた計画。
    detail: 学ぶ内容を、いつまでに、どの順番で、どのくらいの時間をかけて進めるかを決めた計画です。目標(何ができるようになりたいか)を決め、そこから逆算して、日や週ごとにやることを分けます。計画どおりに進まないときは、無理をせず、見直して作り直します。
    related_terms: [指導案]
    learning_points: [先に、目標と期限を決める, やることを、日や週ごとに小さく分ける, 進み具合を確かめて、必要なら見直す]
    weak_detection:
      enabled: true
    review: pending
    note: 詳細説明(detail)と学習ポイントを、新しく足しました(AI の下書き)。一般的な意味に合っているか、確認してください。
  - id: teaching-030
    japanese: 成績処理
    reading: せいせきしょり
    romaji: [seisekishori, seisekisyori]
    category: 学校運営
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: テストなどの結果を集計し、成績としてまとめる事務作業。
    related_terms: [成績]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 学校によって、成績のつけ方・処理の方法・呼び名が違います。説明は、一般的な形にしています。
```
