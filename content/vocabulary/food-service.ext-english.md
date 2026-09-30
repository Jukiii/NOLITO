# 飲食の語録(拡張: 英語のまま打つ語)

`food-service.md`(ベースの原稿)に足す、ふだん英語で打つ語です(Issue #131。決定ログ 0056)。表示は英語、よみがなは日本語、入力は英字をつづりのとおりに打ちます。運営者が承認した語の表に基づく、AI の下書きです。確認して「OK」の語だけ、`draft` の行を消します。

```yaml
job_id: food-service
items:
  - id: food-service-031
    japanese: HACCP
    reading: はさっぷ
    typing: haccp
    category: 衛生
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 食品を作る各工程で、危害が起きるおそれを分析し、重点的に管理する衛生管理の手法のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    draft: true
    note: 「HACCP」の説明と、よみがな(はさっぷ)を確認してください。
  - id: food-service-032
    japanese: FIFO
    reading: ふぃふぉ
    typing: fifo
    category: 店舗運営
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 先に入れたものから、先に使う、在庫の管理の方法(先入れ先出し)のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    draft: true
    note: 「FIFO」の説明と、よみがな(ふぃふぉ)を確認してください。
  - id: food-service-033
    japanese: menu
    reading: めにゅー
    typing: menu
    category: 接客
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: お客様に出す料理や飲み物の、一覧のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    draft: true
    note: 「menu」の説明と、よみがな(めにゅー)を確認してください。
  - id: food-service-034
    japanese: takeout
    reading: ていくあうと
    typing: takeout
    category: 接客
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 店で作った料理を、持ち帰りで提供すること。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    draft: true
    note: 承認された表では POS でしたが、販売と日本語の表記が重複するためビルドが通りません。代わりの語として takeout(ていくあうと)を足しました。ほかの語がよければ知らせてください。
```
