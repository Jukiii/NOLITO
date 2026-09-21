# 営業の語録(sales)

このファイルが、語録の**管理元**です。公開する `public/data/vocabulary/sales.json` は、`npm run build:vocabulary` が、ここから作ります(JSON を手で書き換えません)。書き方は `docs/04_templates/vocabulary-template.md`。

- 新しい語は、`draft: true` で足します。下書きは、公開されません。人間が確認したら、`draft` の行を消します。
- `review` は、人間の確認の状況です(`pending` = まだ、`confirmed` = 済み)。
- `note` は、確認してほしい点のメモです(公開されません)。
- `romaji` は、書かなければ、読みから作ります。書くときは、先頭が画面に表示する書き方です。
- 語の `id` は、消さない・つけ替えない(記録・復習リストが、`id` で語を指します)。

```yaml
job_id: sales
job_name: 営業
version: 0.4.0
updated_at: 2026-09-21
items:
  - id: sales-001
    japanese: 顧客
    reading: こきゃく
    romaji: [kokyaku]
    category: 営業活動
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商品やサービスを購入する相手のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-002
    japanese: 売上
    reading: うりあげ
    romaji: [uriage]
    category: 営業活動
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商品やサービスを売って得た金額のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-003
    japanese: 納期
    reading: のうき
    romaji: [nouki]
    category: 営業活動
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商品やサービスを届ける期限のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-004
    japanese: 契約
    reading: けいやく
    romaji: [keiyaku]
    category: 営業活動
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 当事者どうしの合意によって、約束を取り決めること。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 法律上の「契約」を、やさしく言い換えた説明です。厳密な法的な定義ではありません。
  - id: sales-005
    japanese: 見積もり
    reading: みつもり
    romaji: [mitsumori, mitumori]
    category: 営業活動
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 費用や金額を前もって計算して示すこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-006
    japanese: 商談
    reading: しょうだん
    romaji: [shoudann]
    category: 営業活動
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 購入や契約について、相手と話し合うこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-007
    japanese: 提案
    reading: ていあん
    romaji: [teiann]
    category: 営業活動
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 相手の課題に対して、解決策を示すこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-008
    japanese: 訪問
    reading: ほうもん
    romaji: [houmonn]
    category: 営業活動
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 相手のところへ出向くこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-009
    japanese: アポイント
    reading: あぽいんと
    romaji: [apointo]
    category: 営業活動
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 会う日時をあらかじめ約束すること。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 「アポイントメント」の略した形です。入力は「あぽいんと」で、「あぽいんとめんと」は、受け付けません。
  - id: sales-010
    japanese: 新規開拓
    reading: しんきかいたく
    romaji: [shinkikaitaku]
    category: 営業活動
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: これまで取引のない相手に、新たに取引を働きかけること。
    detail: これまで取引のなかった相手に、自社の商品やサービスを紹介して、新しい取引先を見つけることです。電話・訪問・紹介・問い合わせなど、方法はいろいろあります。相手のことを調べてから連絡すると、話を聞いてもらいやすくなります。
    related_terms: []
    learning_points: [連絡の前に、相手のことを調べる, 一度で決めようとせず、まず関係をつくる, 断られた理由を記録して、次に生かす]
    weak_detection:
      enabled: true
    review: pending
    note: 詳細説明(detail)と学習ポイントを、新しく足しました(AI の下書き)。一般的な意味に合っているか、確認してください。
  - id: sales-011
    japanese: 見込み客
    reading: みこみきゃく
    romaji: [mikomikyaku]
    category: 営業活動
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: これから購入してくれる可能性のある相手のこと。
    related_terms: [顧客]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-012
    japanese: 値引き
    reading: ねびき
    romaji: [nebiki]
    category: 営業活動
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商品の価格を下げること。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-013
    japanese: 受注
    reading: じゅちゅう
    romaji: [juchuu, zyutyuu]
    category: 営業活動
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 注文を受けること。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-014
    japanese: 請求
    reading: せいきゅう
    romaji: [seikyuu]
    category: 営業活動
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 代金などの支払いを、相手に求めること。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-015
    japanese: 競合
    reading: きょうごう
    romaji: [kyougou]
    category: 営業活動
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 同じ市場で、顧客や売上を争う相手のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-016
    japanese: 目標達成
    reading: もくひょうたっせい
    romaji: [mokuhyoutassei]
    category: 営業活動
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 決めた数値などの目標に届くこと。
    related_terms: [売上]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-017
    japanese: 単価
    reading: たんか
    romaji: [tanka]
    category: 営業管理
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商品やサービス 1 つあたりの値段のこと。
    related_terms: [見積もり]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-018
    japanese: 粗利
    reading: あらり
    romaji: [arari]
    category: 営業管理
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 売上から、仕入れなどにかかった原価を引いた、利益のこと。
    related_terms: [売上]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 会社によって、何を「原価」に含めるかが違います。会計上の「売上総利益」とも、厳密には一致しません。やさしく言い換えた説明です。
  - id: sales-019
    japanese: 原価
    reading: げんか
    romaji: [genka]
    category: 営業管理
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商品を作ったり仕入れたりするのに、かかったお金のこと。
    related_terms: [粗利]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 会社・業種によって、原価に含める費用の範囲が違います。説明は、一般的な形にしています。
  - id: sales-020
    japanese: 苦情
    reading: くじょう
    romaji: [kujou, kuzyou]
    category: 顧客対応
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商品やサービスへの不満を、客が伝えること。
    related_terms: [顧客]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-021
    japanese: 成約
    reading: せいやく
    romaji: [seiyaku]
    category: 営業活動
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商談がまとまり、契約が結ばれること。
    related_terms: [契約]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-022
    japanese: 要望
    reading: ようぼう
    romaji: [youbou]
    category: 顧客対応
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 客が望んでいることや、してほしいという希望。
    related_terms: [顧客]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-023
    japanese: 問い合わせ
    reading: といあわせ
    romaji: [toiawase]
    category: 顧客対応
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 客が、商品やサービスについて、質問や確認をすること。
    related_terms: [顧客]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-024
    japanese: 進捗
    reading: しんちょく
    romaji: [shinchoku, sintyoku]
    category: 営業管理
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 物事が進んでいる度合い。営業では、案件の進み具合のこと。
    related_terms: [目標達成]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-025
    japanese: 実績
    reading: じっせき
    romaji: [jisseki, zisseki]
    category: 営業管理
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: これまでに実際に上げた、成果や数字のこと。
    related_terms: [売上]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-026
    japanese: 顧客満足
    reading: こきゃくまんぞく
    romaji: [kokyakumanzoku]
    category: 顧客対応
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商品やサービスを使った客が、どれだけ満足しているかということ。
    related_terms: [顧客]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-027
    japanese: クロージング
    reading: くろーじんぐ
    romaji: [kuro-jingu, kuro-zingu]
    category: 営業活動
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商談の最後に、相手に契約や購入の決断を促すこと。
    related_terms: [商談]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 相手に決断を「促す」ことだけを書いています。無理に売り込むことをすすめる意味では、ありません。
  - id: sales-028
    japanese: フォローアップ
    reading: ふぉろーあっぷ
    romaji: [foro-appu]
    category: 顧客対応
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 商談や契約のあとも連絡を取り、相手の状況を確かめて支えること。
    related_terms: [顧客]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-029
    japanese: 営業日報
    reading: えいぎょうにっぽう
    romaji: [eigyounippou]
    category: 営業管理
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: その日の営業の活動や成果を、記録して報告する書類。
    related_terms: [訪問]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: sales-030
    japanese: 契約更新
    reading: けいやくこうしん
    romaji: [keiyakukoushinn, keiyakukousinn]
    category: 顧客対応
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 期間が決まっている契約を続けるために、改めて結ぶこと。
    related_terms: [契約]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 自動で更新される契約かどうか・手続きの方法は、契約ごとに違います。説明は、一般的な形にしています。
```
