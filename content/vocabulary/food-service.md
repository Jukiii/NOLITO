# 飲食の語録(food-service)

このファイルが、語録の**管理元**です。公開する `public/data/vocabulary/food-service.json` は、`npm run build:vocabulary` が、ここから作ります(JSON を手で書き換えません)。書き方は `docs/04_templates/vocabulary-template.md`。

- 新しい語は、`draft: true` で足します。下書きは、公開されません。人間が確認したら、`draft` の行を消します。
- `review` は、人間の確認の状況です(`pending` = まだ、`confirmed` = 済み)。
- `note` は、確認してほしい点のメモです(公開されません)。
- `romaji` は、書かなければ、読みから作ります。書くときは、先頭が画面に表示する書き方です。
- 語の `id` は、消さない・つけ替えない(記録・復習リストが、`id` で語を指します)。

```yaml
job_id: food-service
job_name: 飲食
version: 0.3.0
updated_at: 2026-09-21
items:
  - id: food-service-001
    japanese: 予約
    reading: よやく
    romaji: [yoyaku]
    category: 店舗運営
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: あらかじめ席や日時を約束しておくこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-002
    japanese: 在庫
    reading: ざいこ
    romaji: [zaiko]
    category: 店舗運営
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 店に保管されている材料や商品のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-003
    japanese: 会計
    reading: かいけい
    romaji: [kaikei]
    category: 店舗運営
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 客が飲食代金を支払う手続きのこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-004
    japanese: 厨房
    reading: ちゅうぼう
    romaji: [chuubou, tyuubou]
    category: 調理
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 料理を作る場所のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-005
    japanese: 注文
    reading: ちゅうもん
    romaji: [chuumonn, tyuumonn]
    category: 接客
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 客が料理や飲み物を頼むこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-006
    japanese: 配膳
    reading: はいぜん
    romaji: [haizenn]
    category: 接客
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: できあがった料理を客の席へ運ぶこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-007
    japanese: 仕込み
    reading: しこみ
    romaji: [shikomi, sikomi]
    category: 調理
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 営業の前に、材料を下ごしらえして準備しておくこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-008
    japanese: 接客
    reading: せっきゃく
    romaji: [sekkyaku]
    category: 接客
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 客に対応して、もてなすこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-009
    japanese: 賞味期限
    reading: しょうみきげん
    romaji: [shoumikigenn]
    category: 衛生
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: おいしく食べられる目安の期限のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 「消費期限」(安全に食べられる期限)とは、別のものです。説明は「おいしく食べられる目安の期限」だけで、消費期限との違いは書いていません。
  - id: food-service-010
    japanese: 衛生管理
    reading: えいせいかんり
    romaji: [eiseikanri]
    category: 衛生
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 食中毒などを防ぐために、清潔と安全を保つこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 食品衛生の法令(HACCP など)の細かい内容は、書いていません。一般的な説明だけです。
  - id: food-service-011
    japanese: 盛り付け
    reading: もりつけ
    romaji: [moritsuke, morituke]
    category: 調理
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: できあがった料理を、器に並べること。
    related_terms: [配膳]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-012
    japanese: 下ごしらえ
    reading: したごしらえ
    romaji: [shitagoshirae, sitagosirae]
    category: 調理
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 調理の前に、材料を洗ったり切ったりして準備しておくこと。
    related_terms: [仕込み]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-013
    japanese: 分量
    reading: ぶんりょう
    romaji: [bunryou]
    category: 調理
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 材料などの量のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-014
    japanese: 洗い場
    reading: あらいば
    romaji: [araiba]
    category: 店舗運営
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 食器や調理器具を洗う場所のこと。
    related_terms: [厨房]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-015
    japanese: 客席
    reading: きゃくせき
    romaji: [kyakuseki]
    category: 接客
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 客が座る席のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-016
    japanese: 定食
    reading: ていしょく
    romaji: [teishoku, teisyoku]
    category: 接客
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 主食・主菜・汁物などを組み合わせて出す食事のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-017
    japanese: 出汁
    reading: だし
    romaji: [dashi, dasi]
    category: 調理
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: かつお節や昆布などから取る、うま味のある汁。和食の味のもとになる。
    related_terms: [調味料]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-018
    japanese: 出前
    reading: でまえ
    romaji: [demae]
    category: 接客
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 注文を受けて、料理を客の家や職場などへ届けること。
    related_terms: [注文]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-019
    japanese: 仕入れ
    reading: しいれ
    romaji: [shiire, siire]
    category: 店舗運営
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 料理に使う食材や、売る商品を、業者などから買い入れること。
    related_terms: [在庫]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-020
    japanese: 献立
    reading: こんだて
    romaji: [kondate]
    category: 調理
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 出す料理の組み合わせや内容を、あらかじめ決めたもの。
    related_terms: [食材]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-021
    japanese: 調味料
    reading: ちょうみりょう
    romaji: [choumiryou, tyoumiryou]
    category: 調理
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 塩・しょうゆ・砂糖など、料理に味をつけるために使うもの。
    related_terms: [出汁]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-022
    japanese: 消毒
    reading: しょうどく
    romaji: [shoudoku, syoudoku]
    category: 衛生
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 薬品や熱などで、細菌やウイルスを減らして、清潔にすること。
    related_terms: [衛生管理]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 「殺菌」「除菌」との使い分けは、書いていません。法令や店の基準で定められた方法(薬剤・温度など)にも触れていません。
  - id: food-service-023
    japanese: 手洗い
    reading: てあらい
    romaji: [tearai]
    category: 衛生
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 食べ物を扱う前や作業の合間に、手を洗って清潔にすること。
    related_terms: [衛生管理]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-024
    japanese: アレルギー
    reading: あれるぎー
    romaji: [arerugi-]
    category: 衛生
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 特定の食べ物などに、体が過敏に反応すること。飲食店では、確認と表示が大切。
    related_terms: [注文]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 医学的な定義は、簡略にしています。原因になる食べ物の一覧や、表示の義務(法令)には、触れていません。
  - id: food-service-025
    japanese: 食材
    reading: しょくざい
    romaji: [shokuzai, syokuzai]
    category: 調理
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 料理の材料になる、食べ物のこと。
    related_terms: [仕入れ]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-026
    japanese: 満席
    reading: まんせき
    romaji: [manseki]
    category: 接客
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 客席がすべて埋まっていて、新しい客を案内できない状態のこと。
    related_terms: [予約, 客席]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-027
    japanese: 食中毒
    reading: しょくちゅうどく
    romaji: [shokuchuudoku, syokutyuudoku]
    category: 衛生
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 細菌やウイルス、毒などが付いた食べ物を食べて起こる、体の不調のこと。
    related_terms: [衛生管理]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 原因の細かい分類や、法令上の扱いは、書いていません。一般的な説明だけです。
  - id: food-service-028
    japanese: 温度管理
    reading: おんどかんり
    romaji: [ondokanri]
    category: 衛生
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 食品を安全に保つため、冷蔵や加熱などの温度を決めて守ること。
    related_terms: [賞味期限]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 具体的な温度は、書いていません。食品ごと・店ごとに、決まりが違うためです。
  - id: food-service-029
    japanese: 先入れ先出し
    reading: さきいれさきだし
    romaji: [sakiiresakidashi, sakiiresakidasi]
    category: 店舗運営
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 先に仕入れた物から先に使う、在庫の管理の方法。
    related_terms: [在庫, 仕入れ]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: food-service-030
    japanese: 食品衛生
    reading: しょくひんえいせい
    romaji: [shokuhinneisei, syokuhinneisei]
    category: 衛生
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 食べ物による事故を防ぐために、取り扱いを清潔で安全に保つこと。
    related_terms: [衛生管理]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
```
