# 0080 スタートの前は、最初の語のカードを出さない(Issue #173)

日付: 2026-10-03

## 理由

Jさんが、Issue #173 に、「スペースキーを押すとスタート」の準備の画面のスクリーンショットを付けて、語のカード(`debug` とそのよみ・説明・つづり)を、スタートする前は消してほしい、とコメントした(2026-10-03)。始める前に、最初の語が見えると、打つ準備の前から語がわかってしまう。

## 変更

- 準備の間(`view.showReady()` から `hideReady()` まで)は、語のカード(`.game-word`。`data-word-card`)を `hidden` にする。スペースキー(か「スタート」ボタン)で始めると、`leaveReady()` が `hideReady()`(`clearStaging`)を呼び、カードが出る。
- `hidden` 属性を、クラスの `display` より優先する規則(`.game-word[hidden]`)を `game.css` に足した。
- 準備の枠の案内(スペースキーで始める・全角スペースの知らせ・スタートのボタン)・入力欄・ゲームの進み方(ready → intro → play → outro。0059)は、変えない。
- ゲームの更新履歴(`products.json`)を 0.33.0 に。

## 影響範囲

- 準備の画面の見た目だけ。連続タイピングの進行・記録・ランキング・用語確認(準備がない)は、変えていない。
- プレイ中の画面の見た目は変わらないので、`public/assets/img/products/escape-boss/` の画面は、撮り直していない。

## テスト

- `tests/game-ready.test.js` に、HTML の `data-word-card`・`showReady` で隠す・`hideReady` で出す・CSS の `[hidden]` の規則の検査を足した。`npm run check`。
