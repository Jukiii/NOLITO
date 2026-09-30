# 0056: ふだん英語で打つ語は、英語で表示し、英字でそのまま打つ

## 背景

運営者の依頼: 「タイピングゲームで、英語でふだん打つもの(debug など)は、英語で表示し、よみがなは日本語、入力は英語にして」。これまでは、すべての語が「日本語の表記 + かなの読み」で、読みからローマ字を作って入力していた(`debug` → `でばっぐ` → `debaggu`)。仕事で英字のまま打つ語も、かな読みの入力になっていた。

## 決定

- 語録の語に、任意項目 **`typing`**(英小文字・数字・`-` だけ。日本語の表記の小文字と同じつづり)を足した。ある語は、`japanese` を英語の表記で出し、`reading` は日本語のよみがなのまま、入力は `typing` のつづりを、そのまま打つ。ない語は、これまでと同じ(読みからローマ字)。
- 入力は `romaji.js` の `createWordMatcher(word, options)` が選ぶ。`typing` があれば `createLiteralMatcher`(大文字小文字を区別しない。違う文字は miss で、進みは変わらない)、なければ従来の `createMatcher`。**ローマ字の書き方の設定(標準・訓令式・表示どおりだけ)は、`typing` の語には関係しない**(つづりは1通りしかないため)。
- `romaji` は、`typing` がある語では、書かないか `["<typing>"]` だけ(検証する)。公開の JSON の `romaji` は `[typing]` になる。`id`・`reading`・`difficulty`(読みの長さの決め)は変えない。**語の id は、そのまま**(記録・復習リストが引く)。
- 距離の「文字数の分」は、`typing` のつづりの長さ(`canonicalLengthOf(word)`)。設定に関係なく決まる(0024 の考えを保つ)。

## 対象の語

エンジニアの 15 語: bug・code・debug・commit・review・version・test・log・branch・release・error・file・update・password・backup。基準は「開発の仕事で、識別子・コマンドとして、英字のまま打つ」もの。カタカナ語として会話で言う語(サーバー・クラウド・ネットワーク・メモリ・データベース・フレームワーク・リファクタリング・プルリクエスト など)は、変えていない。**対象の語の範囲は、運営者の確認を待つ**(Issue に記録)。ほかの職種に、同じ基準の語があれば、あとから足せる(`typing` を書くだけ)。

## 影響範囲

- 対象の語だけ。ほかの語・記録の形(`DATA_VERSION`)・LocalStorage・設定のキーは、変えていない。
- 対象の語は、つづりが短くなる(例 `debug` 7 → 5 打鍵)。**距離の増え方・打つ時間が、エンジニアでわずかに変わる**。`tests/balance.test.js` の階段(先輩 86〜87 / 係長 89 / 部長 67 / 社長 48〜50 / 会長 75〜76)は、そのまま通った。
- 語録の版(エンジニア 0.5.0)・ゲームの版(0.27.0)と、更新履歴を更新した。プライバシーポリシーの版は、上げない(個人情報の取り扱いの変更はない)。

## テスト

- `tests/romaji.test.js`(つづりのとおりの入力・miss・語の入力の選び方)、`tests/vocab-validate.test.js`(`typing` の検証・公開の形)、`tests/input-style.test.js`(全設定で、対象の語が、つづりのとおり入力できる)、`tests/data.test.js`・`tests/game-page.test.js`・`tests/vocab-build.test.js`(実際の語録・`main.js` の呼び出し)。
- `npm run check`・`npm run audit` 通過。
