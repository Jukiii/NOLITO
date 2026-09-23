# 0037 Phase 18 PR 2: 難易度の選択と、開始前の確認欄

日付: 2026-09-24 / 対象: Phase 18「職種・役職・難易度を個別選択。開始前に報酬・特殊ルール等を表示」の、難易度の部分(役職の個別選択・特殊ルールの表示は、Phase 13・17 で済み)。

Phase 18 は 4 つの PR([[0036-phase-18-levels|0036]] のとおり)。**この PR(2)**: 難易度の選択と、開始前の確認欄(難易度の説明・経験値の倍率・自己ベスト)。PR 3: 隠し実績・実績の種類の追加。PR 4: 成績ページの改善記録・ハイスコア表。

## 仕様と、現状の突き合わせ

| 仕様 | 状態 |
| ---- | ---- |
| 難易度の個別選択 | **この PR で追加**(やさしい・ふつう・むずかしいの 3 段階) |
| 開始前の確認欄(報酬・自己ベストなど) | 役職の特殊ルールの表示は [[0033-phase-17-rules]] で済み。**この PR で、難易度の説明・経験値の倍率・自己ベストを追加**(スコープを絞った。理由は下の「決定」8) |
| ハイスコア(役職 × 難易度) | 自己ベストの記録は [[0036-phase-18-levels]] で済み。**この PR で、ランキングも役職 × 難易度に分ける** |

## 決定

| # | 項目 | 決定 | 理由 |
| - | ---- | ---- | ---- |
| 1 | 難易度 | 3 つ: **やさしい**(練習。ランキング・役職クリアの実績・会長の解放には数えない。経験値は少なめ)・**ふつう**(既定。これまでどおり)・**むずかしい**(役職をふつうでクリアすると挑戦できる。経験値は多め) | 「実質、練習モードが要る」「上級者にも、やり込みの余地が要る」の両方 |
| 2 | データの置き場所 | `public/data/difficulties.json`(`roles.json`・`achievements.json` と同じ、データで決める形)。項目: `id`・`name`・`description`・`rankable`・`unlock`(`null` か `role_clear_normal`)・`exp_multiplier`・`modifiers`(`drain`・`gain`・`initial`) | 難易度を増やす・値を調整するときに、コードを変えずに済む |
| 3 | 倍率のかけ方 | `difficulty.js` の `applyDifficulty(stage, difficulty)`(純粋関数)が、役職の `stage` に、`modifiers` をかけた**新しい stage**を作る。変わるのは、**正解で増える距離の分**(`base_gain`・`gain_per_char`)・**時間で縮む速さ**(`drain_per_second`)・**初期距離**(`initial_distance`。最大距離を超えない)だけ。難易度の分・速さの分・特殊ルール・語の重み・目標語数は、変わらない。`engine.js` は変えない(stage を作る側で吸収する) | [[0022-phase-12-distance]] の式・`engine.js` の純粋性を保つ |
| 4 | 倍率の値 | やさしい: `drain 0.75 / gain 1.25 / initial 1.15`。むずかしい: `drain 1.06 / gain 0.945 / initial 1`。**ふつうは `1 / 1 / 1`(変化なし)** | シミュレーションで調整(下の「バランスの確認」) |
| 5 | 経験値の倍率 | やさしい `×0.5`・ふつう `×1`・むずかしい `×1.6`。`grantExp` の `multiplier` に、選んだ難易度の `exp_multiplier` を渡す([[0036-phase-18-levels]] の項目 3 で「PR 2 で使う」としていたもの) | 難しい方を多く稼げるようにする一方、やさしいでも「0」にはしない |
| 6 | 役職クリア・ランキングの扱い | `records.js` の `recordResult`: **やさしいは**、`progress.totalClears`・`totalWords`・職種ごとの合計(`jobs`)には**数える**(活動量として)が、`progress.clears`・`clearedJobs`(役職クリアの実績・会長の解放の判定に使う)には**数えない**。`progress.difficultyClears`・`bests`(自己ベスト)は、**どの難易度でも記録する**(むずかしいの解放判定・確認欄の自己ベストに使うため)。ランキングも、やさしいは載らない | 「やさしいで実績・解放を回避できない」「けれど遊んだ記録は残る」の両立 |
| 7 | ランキングの鍵 | 記録の版を **5** に上げる(`DATA_VERSION`。版 1〜4 も読める)。`rankings` のキーを、役職 ID だけ(`"senpai"`)から、`役職:難易度`(`"senpai:normal"`。`clearKey` と同じ形)に変える。版 1〜4 のランキングは、読み込み時に、すべて「役職:normal」として扱う(それまでのプレイは、すべてふつうだったため) | ランキングを役職 × 難易度で分けるため |
| 8 | 開始前の確認欄のスコープ | 当初の計画にあった「報酬」の広い意味づけは、**この PR では、難易度の説明・経験値の倍率・自己ベストに絞る**(役職の特殊ルールの表示は、既存のまま)。称号・実績の詳しい一覧は、確認欄には出さない(結果の画面・実績の一覧で、すでに見られるため) | 1 PR の変更を、フェーズの手順(小機能単位)に収める |
| 9 | 難易度の解放 | `isDifficultyUnlocked(difficulty, { difficultyClears, roleId, clearKey })`(純粋関数)。**役職ごと**に判定する(会長だけ「ふつう」でクリア済みでも、先輩の「むずかしい」は最初から挑戦できる、のように、役職と難易度の解放は独立) | むずかしいの説明にある「この役職をふつうでクリアすると」と一致させる |
| 10 | 画面 | 役職の選択の下に、難易度のフィールドセット(役職と同じラジオボタン・ロック中バッジ)。役職を選び直すたびに、ロック状態を作り直す。選んだ難易度の説明・経験値の倍率・自己ベスト(あれば)を、確認欄に表示(職種・役職・難易度がそろったとき)。ランキングは、役職の選択欄の下に、難易度の選択欄を追加(やさしいは選択肢に出さない) | 役職の確認欄([[0033-phase-17-rules]])と同じ操作感 |
| 11 | 影響 | **ふつうの倍率は 1 なので、既存のバランス([[0006]]・[[0022-phase-12-distance]]・[[0033-phase-17-rules]])は、まったく変わらない**(`tests/balance.test.js` に、そのことを検証するテストを追加した) | 既存のプレイヤーの体験を変えない |

## バランスの確認(シミュレーション。0006 と同じ方法)

`tests/balance.test.js` の乱数モデル(打鍵の速さ・反応・ミス率)で、各 1000 回。むずかしいの倍率は、`drain 1.3 / gain 0.82 / initial 0.85` から出発したが、係長・部長・社長・会長の**ふつうの人でのクリア率が、ほぼ 0%(実質「速い人」専用)** になったため、シミュレーションで調整し、`drain 1.06 / gain 0.945 / initial 1` に決めた。

| 役職 | やさしい(ふつうの人) | ふつう(ふつうの人) | むずかしい(ふつうの人) | むずかしい(速い人) |
| ---- | ---- | ---- | ---- | ---- |
| 先輩 | 100% | 100% | 100% | 100% |
| 係長 | 100% | 89% | 62% | 100% |
| 部長 | 100% | 68% | 38% | 100% |
| 社長 | 100% | 47% | 16% | 100% |
| 会長 | 39%(ふつうの人)/ 100%(速い人) | 0%(ふつうの人)/ 75%(速い人) | 0%(ふつうの人)/ 52%(速い人) | - |

## テスト

- 新規: `tests/difficulty-wiring.test.js`(15 件。HTML・`view.js`・`main.js` のつなぎ)
- 更新: `tests/difficulty.test.js`(`normalizeDifficulty`・`normalizeDifficulties`・`applyDifficulty`・`isDifficultyUnlocked`。20 件)・`tests/storage.test.js`(**版 4 → 5 の移行**を新規に追加。既存のランキングの鍵のテストを、`役職:難易度` の形に更新)・`tests/records.test.js`(やさしいの役職クリア・ランキングの除外、`clearKey`・`bestKey` の記録)・`tests/balance.test.js`(難易度の倍率のバランス。ふつうは変化なし・やさしいはふつう以上・むずかしいはふつう以下、を検証)・`tests/game-page.test.js`・`tests/review.test.js`・`tests/sound-wiring.test.js`・`tests/rules.test.js`・`tests/levels-wiring.test.js`(版・つなぎの文言の更新)
- ブラウザ(headless Edge + `wrangler pages dev`、実際のキー入力): PR の説明に記載

## 見つけたこと

- むずかしいの最初の倍率案(`drain 1.3 / gain 0.82 / initial 0.85`)は、既存の役職ごとの難しさの階段と重なって、**ふつうの人には実質クリア不能**になっていた。シミュレーションなしで倍率だけを見積もると、こうしたズレに気づけない(決定ログ 0022・0033 と同じ教訓)

## 変更したもの

- 新規: `public/data/difficulties.json`、`tests/difficulty-wiring.test.js`、`docs/decisions/0037-phase-18-difficulty.md`
- 変更: `difficulty.js`(`applyDifficulty`・`isDifficultyUnlocked` を追加)・`vocabulary.js`(`loadDifficulties`)・`storage.js`(版 5・ランキングの鍵の移行)・`records.js`(やさしいの除外・ランキングの鍵)・`main.js`・`view.js`、`public/games/escape-boss/index.html`(生成される about は別)、`public/data/products.json`・詳細ページ(生成)、`tests/difficulty.test.js`・`tests/storage.test.js`・`tests/records.test.js`・`tests/balance.test.js`・`tests/game-page.test.js`・`tests/review.test.js`・`tests/sound-wiring.test.js`・`tests/rules.test.js`・`tests/levels-wiring.test.js`、`CLAUDE.md`
- 変えていない: `engine.js`(距離の式そのもの)・語録・役職の基本データ(`roles.json` の `stage`)・記録のキー名(`nolito:escape-boss:v1`)

## 未確認・既知事項

- **むずかしいの倍率は、シミュレーションと私の見積もりによる調整**。遊んで、あなたの感覚で調整してください(`difficulties.json` の `modifiers` だけで、直せる)
- 開始前の確認欄は、難易度の説明・経験値の倍率・自己ベストに絞った(決定 8)。称号・実績の一覧を確認欄に出す案は、見送った
- スクリーンリーダー・スマートフォン実機の確認は未実施。Microsoft Edge(Windows・headless)だけで確認
