# 事務の語録(office)

このファイルが、語録の**管理元**です。公開する `public/data/vocabulary/office.json` は、`npm run build:vocabulary` が、ここから作ります(JSON を手で書き換えません)。書き方は `docs/04_templates/vocabulary-template.md`。

- 新しい語は、`draft: true` で足します。下書きは、公開されません。人間が確認したら、`draft` の行を消します。
- `review` は、人間の確認の状況です(`pending` = まだ、`confirmed` = 済み)。
- `note` は、確認してほしい点のメモです(公開されません)。
- `romaji` は、書かなければ、読みから作ります。書くときは、先頭が画面に表示する書き方です。
- 語の `id` は、消さない・つけ替えない(記録・復習リストが、`id` で語を指します)。

```yaml
job_id: office
job_name: 事務
version: 0.4.0
updated_at: 2026-09-21
items:
  - id: office-001
    japanese: 備品
    reading: びひん
    romaji: [bihinn]
    category: 事務
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 事務所などに備え付けて、業務で使う物品のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-002
    japanese: 押印
    reading: おういん
    romaji: [ouinn]
    category: 事務
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 書類に印鑑を押すこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 押印を減らす(電子署名にする)会社も増えています。説明は「書類に印鑑を押すこと」だけで、その流れには触れていません。
  - id: office-003
    japanese: 報告
    reading: ほうこく
    romaji: [houkoku]
    category: 事務
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 仕事の状況や結果を、上の人などに伝えること。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-004
    japanese: 稟議
    reading: りんぎ
    romaji: [ringi]
    category: 事務
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 担当者が案を作り、関係者の承認を順に得る手続きのこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 会社によって、手続きの進め方や呼び名(承認・決裁など)が違います。説明は、一般的な形にしています。
  - id: office-005
    japanese: 出張
    reading: しゅっちょう
    romaji: [shucchou, shuttyou]
    category: 事務
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 仕事のために、いつもの勤務地以外へ出かけること。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-006
    japanese: 議事録
    reading: ぎじろく
    romaji: [gijiroku]
    category: 事務
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 会議の内容や決定事項を記録した文書のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-007
    japanese: 請求書
    reading: せいきゅうしょ
    romaji: [seikyuusho]
    category: 事務
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 代金の支払いを求める書類のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-008
    japanese: 書類整理
    reading: しょるいせいり
    romaji: [shoruiseiri]
    category: 事務
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 書類を種類や順序に分けて片付けること。
    detail: 書類を、使うもの・保管するもの・捨てるものに分けて、あとから探しやすい形に並べることです。種類・日付・取引先などの決まった基準でまとめ、ファイル名や見出しを付けておくと、必要なときにすぐ取り出せます。保管する期間は、書類の種類や会社の決まりによって違います。
    related_terms: []
    learning_points: [まず、使う書類と保管する書類を分ける, 種類・日付など、決まった基準で並べる, 保管する期間は、会社の決まりを確認する]
    weak_detection:
      enabled: true
    review: pending
    note: 詳細説明(detail)と学習ポイントを、新しく足しました(AI の下書き)。一般的な意味に合っているか、確認してください。
  - id: office-009
    japanese: 経費精算
    reading: けいひせいさん
    romaji: [keihiseisann]
    category: 事務
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 立て替えた業務上の費用を、会社に申請して払い戻してもらうこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-010
    japanese: 来客対応
    reading: らいきゃくたいおう
    romaji: [raikyakutaiou]
    category: 事務
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 訪れた客を迎え、用件を取り次ぐなどの対応をすること。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-011
    japanese: 電話対応
    reading: でんわたいおう
    romaji: [denwataiou]
    category: 事務
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: かかってきた電話を受けて、用件を聞いたり取り次いだりすること。
    related_terms: [来客対応]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-012
    japanese: 郵送
    reading: ゆうそう
    romaji: [yuusou]
    category: 事務
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 郵便で送ること。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-013
    japanese: 契約書
    reading: けいやくしょ
    romaji: [keiyakusho, keiyakusyo]
    category: 事務
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 契約の内容を書いた文書のこと。
    related_terms: [押印]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-014
    japanese: 承認
    reading: しょうにん
    romaji: [shouninn]
    category: 事務
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 内容を確認して、認めること。
    related_terms: [稟議]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-015
    japanese: 納品
    reading: のうひん
    romaji: [nouhinn]
    category: 事務
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 注文された品物を、相手に届けること。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-016
    japanese: 会議室
    reading: かいぎしつ
    romaji: [kaigishitsu, kaigisitu]
    category: 事務
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 会議をするための部屋のこと。
    related_terms: [議事録]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-017
    japanese: 名刺
    reading: めいし
    romaji: [meishi, meisi]
    category: 事務
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 自分の氏名・会社名・連絡先などを書いた、小さな紙。
    related_terms: [来客対応]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-018
    japanese: 資料
    reading: しりょう
    romaji: [shiryou, siryou]
    category: 事務
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 会議や説明のために用意する、情報をまとめた紙やデータ。
    related_terms: [会議]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-019
    japanese: 予算
    reading: よさん
    romaji: [yosann]
    category: 経理
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: ある期間に使う予定の、お金の見積もりや上限のこと。
    related_terms: [経費精算]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-020
    japanese: 会議
    reading: かいぎ
    romaji: [kaigi]
    category: 事務
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 人が集まって、話し合って物事を決めたり、情報を共有したりする場。
    related_terms: [議事録, 会議室]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-021
    japanese: 領収書
    reading: りょうしゅうしょ
    romaji: [ryoushuusho, ryousyuusyo]
    category: 経理
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: お金を受け取ったことを示すために、受け取った側が出す書類。
    related_terms: [経費精算, 請求書]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 「レシート」との違いや、法的に必要な記載事項は、書いていません。
  - id: office-022
    japanese: 伝票
    reading: でんぴょう
    romaji: [denpyou]
    category: 経理
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: お金や品物の出入りを記録するための、紙や書式のこと。
    related_terms: [領収書]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-023
    japanese: 決算
    reading: けっさん
    romaji: [kessann]
    category: 経理
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 一定の期間のお金の出入りをまとめて、成績や財産の状況を明らかにすること。
    related_terms: [予算]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 会社の種類・制度によって、決算の中身や時期が違います。説明は、ごく一般的な形にしています。
  - id: office-024
    japanese: 勤怠
    reading: きんたい
    romaji: [kintai]
    category: 総務
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 出勤・退勤・休みなど、働く人の勤務の状況のこと。
    related_terms: [就業規則]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-025
    japanese: 内線
    reading: ないせん
    romaji: [naisenn]
    category: 総務
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 同じ建物や会社の中で、電話機どうしをつなぐ電話のこと。
    related_terms: [電話対応]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-026
    japanese: 社内報
    reading: しゃないほう
    romaji: [shanaihou, syanaihou]
    category: 総務
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 会社の中の出来事やお知らせを、社員に伝える冊子や配信物。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: office-027
    japanese: 源泉徴収
    reading: げんせんちょうしゅう
    romaji: [gensenchoushuu, gensentyousyuu]
    category: 経理
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 給与などを払う側が、税金を先に差し引いて、国に納めること。
    related_terms: [年末調整]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 税の制度は、改正されます。対象や計算の方法には触れず、「先に差し引いて、国に納める」という大きな流れだけを書いています。
  - id: office-028
    japanese: 年末調整
    reading: ねんまつちょうせい
    romaji: [nenmatsuchousei, nenmatutyousei]
    category: 経理
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 毎年の終わりに、給与から引かれた所得税を、正しい金額に精算する手続き。
    related_terms: [源泉徴収]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 税の制度は、改正されます。対象者や計算の方法には触れず、「正しい金額に精算する」という大きな流れだけを書いています。
  - id: office-029
    japanese: 個人情報
    reading: こじんじょうほう
    romaji: [kojinjouhou, kozinzyouhou]
    category: 総務
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 氏名・住所など、特定の個人を見分けられる情報。取り扱いに注意が必要。
    related_terms: [書類整理]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 法律(個人情報保護法)上の定義とは、厳密には一致しません。やさしく言い換えた説明です。
  - id: office-030
    japanese: 就業規則
    reading: しゅうぎょうきそく
    romaji: [shuugyoukisoku, syuugyoukisoku]
    category: 総務
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 働く時間・休み・守る決まりなどを定めた、会社の規則。
    related_terms: [勤怠]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 作成の義務がある条件や、書く内容の細かい決まりは、書いていません。
```
