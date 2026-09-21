# エンジニアの語録(engineer)

このファイルが、語録の**管理元**です。公開する `public/data/vocabulary/engineer.json` は、`npm run build:vocabulary` が、ここから作ります(JSON を手で書き換えません)。書き方は `docs/04_templates/vocabulary-template.md`。

- 新しい語は、`draft: true` で足します。下書きは、公開されません。人間が確認したら、`draft` の行を消します。
- `review` は、人間の確認の状況です(`pending` = まだ、`confirmed` = 済み)。
- `note` は、確認してほしい点のメモです(公開されません)。
- `romaji` は、書かなければ、読みから作ります。書くときは、先頭が画面に表示する書き方です。
- 語の `id` は、消さない・つけ替えない(記録・復習リストが、`id` で語を指します)。

```yaml
job_id: engineer
job_name: エンジニア
version: 0.3.0
updated_at: 2026-09-21
items:
  - id: engineer-001
    japanese: バグ
    reading: ばぐ
    romaji: [bagu]
    category: 開発
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: プログラムの不具合や誤りのこと。
    related_terms: [デバッグ]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-002
    japanese: コード
    reading: こーど
    romaji: [ko-do]
    category: 開発
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: プログラムの命令を書いた文字列のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-003
    japanese: サーバー
    reading: さーばー
    romaji: [sa-ba-]
    category: インフラ
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: ほかの機器の求めに応じて、データや機能を提供するコンピューターのこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-004
    japanese: デバッグ
    reading: でばっぐ
    romaji: [debaggu]
    category: 開発
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: プログラムの不具合(バグ)を見つけて直すこと。
    related_terms: [バグ]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-005
    japanese: コミット
    reading: こみっと
    romaji: [komitto]
    category: 開発
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 変更内容をバージョン管理システムに記録すること。
    related_terms: [バージョン]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-006
    japanese: レビュー
    reading: れびゅー
    romaji: [rebyu-]
    category: 開発
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 書いた成果物を他の人が確認し、問題点や改善点を指摘すること。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-007
    japanese: バージョン
    reading: ばーじょん
    romaji: [ba-jonn]
    category: 開発
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: ソフトウェアの版を区別する番号のこと。
    related_terms: [コミット]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-008
    japanese: データベース
    reading: でーたべーす
    romaji: [de-tabe-su]
    category: インフラ
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: データを整理して保存し、検索や更新をしやすくした仕組みのこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-009
    japanese: プルリクエスト
    reading: ぷるりくえすと
    romaji: [pururikuesuto]
    category: 開発
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 変更内容を取り込んでもらうために、確認を依頼する仕組みのこと。
    related_terms: [レビュー]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: ツール(GitHub など)によって呼び名が違います(GitLab では「マージリクエスト」)。説明は、特定のツールに寄せない書き方にしています。
  - id: engineer-010
    japanese: リファクタリング
    reading: りふぁくたりんぐ
    romaji: [rifakutaringu]
    category: 開発
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 動作を変えずに、コードの構造を整理して読みやすくすること。
    related_terms: [コード]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-011
    japanese: テスト
    reading: てすと
    romaji: [tesuto]
    category: 開発
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: プログラムが期待どおりに動くかを確かめること。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-012
    japanese: ログ
    reading: ろぐ
    romaji: [rogu]
    category: インフラ
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: システムやソフトウェアの動作の記録のこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-013
    japanese: ブランチ
    reading: ぶらんち
    romaji: [buranchi, buranti]
    category: 開発
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: バージョン管理で、作業の流れを枝分かれさせたもののこと。
    related_terms: [コミット, バージョン]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-014
    japanese: リリース
    reading: りりーす
    romaji: [riri-su]
    category: 開発
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 完成したソフトウェアを、利用者が使えるように公開すること。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-015
    japanese: フレームワーク
    reading: ふれーむわーく
    romaji: [fure-muwa-ku, hure-muwa-ku]
    category: 開発
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: プログラムを作るための、土台となる枠組みのこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-016
    japanese: ネットワーク
    reading: ねっとわーく
    romaji: [nettowa-ku]
    category: インフラ
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: コンピューターなどをつないで、データをやり取りできるようにした仕組みのこと。
    related_terms: [サーバー]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-017
    japanese: エラー
    reading: えらー
    romaji: [era-]
    category: 開発
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: プログラムが正しく動かないときに出る、問題を知らせる表示や状態のこと。
    related_terms: [バグ, デバッグ]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-018
    japanese: ファイル
    reading: ふぁいる
    romaji: [fairu]
    category: 開発
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 名前をつけて保存する、データのまとまりのこと。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-019
    japanese: メモリ
    reading: めもり
    romaji: [memori]
    category: インフラ
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: プログラムが動くときに、データを一時的に置いておく場所。
    related_terms: []
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-020
    japanese: クラウド
    reading: くらうど
    romaji: [kuraudo]
    category: インフラ
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 自分の機器ではなく、インターネット越しに借りて使う、サーバーや保存場所のこと。
    related_terms: [サーバー]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 「クラウド」は、サービスの形(保存・計算・アプリなど)がさまざまです。説明は「借りて使うサーバーや保存場所」という、一般的な形にしています。
  - id: engineer-021
    japanese: バックアップ
    reading: ばっくあっぷ
    romaji: [bakkuappu]
    category: インフラ
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 故障や誤操作に備えて、データの複製を別の場所に取っておくこと。
    related_terms: [データベース]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-022
    japanese: パスワード
    reading: ぱすわーど
    romaji: [pasuwa-do]
    category: セキュリティ
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 本人であることを確かめるための、秘密の文字列。他人に教えない。
    related_terms: [認証]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-023
    japanese: 暗号化
    reading: あんごうか
    romaji: [angouka]
    category: セキュリティ
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: データを、鍵がないと読めない形に変えること。盗み見られても、中身を守れる。
    related_terms: [パスワード]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-024
    japanese: 認証
    reading: にんしょう
    romaji: [ninshou, ninsyou]
    category: セキュリティ
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 利用者が本人かどうかを確かめること。ログインのときに行う。
    related_terms: [パスワード]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-025
    japanese: 脆弱性
    reading: ぜいじゃくせい
    romaji: [zeijakusei, zeizyakusei]
    category: セキュリティ
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: ソフトウェアの弱点や欠陥のこと。悪用されると被害が出るので、修正が必要。
    related_terms: [アップデート]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-026
    japanese: アップデート
    reading: あっぷでーと
    romaji: [appude-to]
    category: 開発
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: ソフトウェアを新しい版に更新すること。不具合の修正や、機能の追加を行う。
    related_terms: [バージョン, リリース]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-027
    japanese: 仕様書
    reading: しようしょ
    romaji: [shiyousho, siyousyo]
    category: 開発
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 作るものの機能や動きを、文章で決めた資料。
    related_terms: [要件定義]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-028
    japanese: 要件定義
    reading: ようけんていぎ
    romaji: [youkenteigi]
    category: 開発
    difficulty: 3
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: システムに必要な機能や条件を、開発の前に整理して決めること。
    related_terms: [仕様書]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 会社・進め方によって、「要件定義」の範囲や呼び名(要求定義・基本設計など)が違います。説明は、一般的な形にしています。
  - id: engineer-029
    japanese: 障害
    reading: しょうがい
    romaji: [shougai, syougai]
    category: インフラ
    difficulty: 2
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: システムが止まる、正しく動かないなど、サービスに起きる問題のこと。
    related_terms: [ログ]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
  - id: engineer-030
    japanese: 保守
    reading: ほしゅ
    romaji: [hoshu, hosyu]
    category: インフラ
    difficulty: 1
    roles: [senpai, kakaricho, buchou, shachou, kaicho]
    explanation: 完成したシステムを使い続けられるように、直したり改善したりすること。
    related_terms: [障害]
    learning_points: []
    weak_detection:
      enabled: true
    review: pending
    note: 「保守」は、「運用」と分けて呼ぶ会社と、まとめて呼ぶ会社があります。説明は、「直したり改善したりする」ことに絞っています。
```
