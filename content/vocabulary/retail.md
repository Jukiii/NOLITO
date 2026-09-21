# 接客販売の語録(retail)

このファイルが、語録の**管理元**です。公開する `public/data/vocabulary/retail.json` は、`npm run build:vocabulary` が、ここから作ります(JSON を手で書き換えません)。書き方は `docs/04_templates/vocabulary-template.md`。

- 新しい語は、`draft: true` で足します。下書きは、公開されません。人間が確認したら、`draft` の行を消します。
- `review` は、人間の確認の状況です(`pending` = まだ、`confirmed` = 済み)。
- `note` は、確認してほしい点のメモです(公開されません)。
- `romaji` は、書かなければ、読みから作ります。書くときは、先頭が画面に表示する書き方です。
- 語の `id` は、消さない・つけ替えない(記録・復習リストが、`id` で語を指します)。

```yaml
job_id: retail
job_name: 接客販売
version: 0.3.0
updated_at: 2026-09-21
items:
  - id: retail-001
    japanese: レジ
    reading: れじ
    romaji: [reji]
    category: 店頭業務
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商品の代金を受け取り、精算する場所や機械のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-002
    japanese: 値札
    reading: ねふだ
    romaji: [nefuda]
    category: 店頭業務
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商品に付けて価格を示す札のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-003
    japanese: 割引
    reading: わりびき
    romaji: [waribiki]
    category: 店頭業務
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 定価から金額を引くこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-004
    japanese: 返品
    reading: へんぴん
    romaji: [henpinn]
    category: 店頭業務
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 購入した商品を返すこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-005
    japanese: 陳列
    reading: ちんれつ
    romaji: [chinretsu, tinretu]
    category: 売り場づくり
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商品を見やすく並べて見せること。
    related_terms: [品出し]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-006
    japanese: 品出し
    reading: しなだし
    romaji: [shinadashi, sinadasi]
    category: 売り場づくり
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商品を売り場に並べること。
    related_terms: [陳列]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-007
    japanese: 包装
    reading: ほうそう
    romaji: [housou]
    category: 店頭業務
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商品を包んだり箱に入れたりすること。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-008
    japanese: 棚卸し
    reading: たなおろし
    romaji: [tanaoroshi, tanaorosi]
    category: 売り場づくり
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 店にある商品の数や在庫を実際に数えて調べること。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-009
    japanese: 会員カード
    reading: かいいんかーど
    romaji: [kaiinka-do]
    category: 店頭業務
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 会員であることを示すカードのこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-010
    japanese: いらっしゃいませ
    reading: いらっしゃいませ
    romaji: [irasshaimase, irassyaimase]
    category: 接客
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 来店した客を迎えるときのあいさつの言葉。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-011
    japanese: 在庫確認
    reading: ざいこかくにん
    romaji: [zaikokakuninn]
    category: 売り場づくり
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商品の在庫がどれだけあるかを調べること。
    related_terms: [棚卸し]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-012
    japanese: 発注
    reading: はっちゅう
    romaji: [hacchuu, hatchuu]
    category: 売り場づくり
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商品や材料を、取引先に注文すること。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-013
    japanese: 特売
    reading: とくばい
    romaji: [tokubai]
    category: 店頭業務
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 期間などを決めて、商品を安く売ること。
    related_terms: [割引]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-014
    japanese: ポイント
    reading: ぽいんと
    romaji: [pointo]
    category: 店頭業務
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 購入金額などに応じて付与され、次の買い物で使える点数のこと。
    related_terms: [会員カード]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: お店によって、付与のルール・有効期限が違います。説明は、一般的な形にしています。
  - id: retail-015
    japanese: 接客マナー
    reading: せっきゃくまなー
    romaji: [sekkyakumana-]
    category: 接客
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 客に接するときの、礼儀や心づかいのこと。
    related_terms: [いらっしゃいませ]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-016
    japanese: 開店準備
    reading: かいてんじゅんび
    romaji: [kaitenjunbi, kaitenzyunbi]
    category: 店頭業務
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 店を開ける前に、掃除や商品の補充などを済ませておくこと。
    related_terms: [品出し]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-017
    japanese: 試着
    reading: しちゃく
    romaji: [shichaku, sityaku]
    category: 接客
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 買う前に、服などを実際に着てみること。
    related_terms: [接客マナー]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-018
    japanese: 袋
    reading: ふくろ
    romaji: [fukuro, hukuro]
    category: 店頭業務
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 買った商品を入れて、持ち帰れるようにするもの。
    related_terms: [包装]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-019
    japanese: 棚
    reading: たな
    romaji: [tana]
    category: 売り場づくり
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商品を並べて置くための、板をわたした台。
    related_terms: [陳列]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-020
    japanese: 見本
    reading: みほん
    romaji: [mihonn]
    category: 売り場づくり
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商品の内容や品質を、実物で示すために見せる品。
    related_terms: [陳列]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 業種によって、「見本」「サンプル」「展示品」などの使い分けが違います。説明は、一般的な形にしています。
  - id: retail-021
    japanese: 釣り銭
    reading: つりせん
    romaji: [tsurisenn, turisenn]
    category: 店頭業務
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 客が払った金額が代金より多いときに、返すお金。
    related_terms: [レジ]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-022
    japanese: 欠品
    reading: けっぴん
    romaji: [keppinn]
    category: 売り場づくり
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: そろえておくはずの商品が、在庫がなくて売り場にない状態のこと。
    related_terms: [在庫確認]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-023
    japanese: レシート
    reading: れしーと
    romaji: [reshi-to, resi-to]
    category: 店頭業務
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 買い物の代金や内容を記して、店が客に渡す紙。
    related_terms: [レジ]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-024
    japanese: お客様
    reading: おきゃくさま
    romaji: [okyakusama]
    category: 接客
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 店を訪れて、商品やサービスを利用する人を、敬って呼ぶ言い方。
    related_terms: [いらっしゃいませ]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-025
    japanese: 声かけ
    reading: こえかけ
    romaji: [koekake]
    category: 接客
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 客に近づいて、話しかけること。
    related_terms: [いらっしゃいませ]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-026
    japanese: 案内
    reading: あんない
    romaji: [annai]
    category: 接客
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 客の求めに応じて、商品の場所などを教えたり、連れて行ったりすること。
    related_terms: [接客マナー]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-027
    japanese: 目玉商品
    reading: めだましょうひん
    romaji: [medamashouhinn, medamasyouhinn]
    category: 売り場づくり
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 客を引きつけるために、特に目立たせて売る商品。
    related_terms: [特売]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-028
    japanese: クレジットカード
    reading: くれじっとかーど
    romaji: [kurejittoka-do, kurezittoka-do]
    category: 店頭業務
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 代金を後でまとめて支払う約束で、買い物に使えるカード。
    related_terms: [レジ]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 「デビットカード」「プリペイドカード」とは、別のものです。説明は、後払いのカードだけを指しています。
  - id: retail-029
    japanese: 商品知識
    reading: しょうひんちしき
    romaji: [shouhinchishiki, syouhintisiki]
    category: 接客
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 扱う商品の特徴や使い方などの知識。客に説明するために必要。
    related_terms: [接客マナー]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: retail-030
    japanese: 商品券
    reading: しょうひんけん
    romaji: [shouhinkenn, syouhinkenn]
    category: 店頭業務
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商品やサービスの代金の代わりに使える、券のこと。
    related_terms: [ポイント]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 使える店・期限・おつりの扱いは、発行元によって違います。説明は、一般的な形にしています。
```
