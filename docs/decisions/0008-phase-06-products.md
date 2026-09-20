# 0008 Phase 6 プロダクト管理(データ構造・検証・一覧カード)の決定事項

日付: 2026-09-20 / 対象Phase: 6

## 仕様

`docs/01_phases/phase-06.md`: 自由にカテゴリ追加可能。タイトル・画像・説明・OS・価格・ステータス・DL・詳細・更新履歴・バージョン等を保持。管理画面を想定したデータ構造。

## スコープ

含めるもの: カテゴリのデータ化(`categories.json`)、プロダクトのデータ構造の拡張(`products.json` version 2)、検証(`products/schema.js`)、`/games/` のカードの拡張(OS・価格・バージョン・更新日・画像・ダウンロード)、テスト、手順書。

含めないもの(該当Phase): 詳細ページ・FAQ・サポート・GitHub Releases との連携(P7)、`/software/` `/tools/` のページとナビの有効化(P7・P8)、販売・購入(P8〜9)、更新履歴の表示(P7・P10)、検索・カテゴリ絞り込み・カスタムページ(P20)、管理画面(P26)。

## 決定

| # | 項目 | 決定 | 理由 |
| - | ---- | ---- | ---- |
| 1 | カテゴリ | `public/data/categories.json`(`{ id, name, description, path }`)。初期は game(ゲーム)・software(ソフト)・tool(ツール)。`path` は一覧ページ(できるまで `null`)。プロダクトの `category` は、ここにある id でなければならない | 「自由にカテゴリ追加可能」= データを足すだけで増える。ページは P7・P8・P20 で作るため、ナビは「準備中」のまま |
| 2 | プロダクトの項目 | id・category・title・description(カード用)・details(長い説明。段落の配列。表示はP7)・image(`{src, alt}` か null)・platforms(web/windows/mac/linux/ios/android)・price(`free`/`paid`+円/`undecided`)・status(released/beta/coming-soon)・url・cta・download(`{label, url}` か null)・version・released_at・updated_at・changelog(新しい順) | 仕様の列挙を、そのまま項目にした。「詳細」は意味が読み取れないため、短い説明と長い説明に分けた |
| 3 | 形式の版 | `products.json` は `{ version: 2, products }`。旧形式(version なし)は検証で落とす | 管理画面(P26)・DBへの移行で、形式の版を見分けられるように |
| 4 | 検証 | `products/schema.js`(DOM 非依存)。テスト(データが正しいか)と、描画(不正な項目だけ外す)で同じ検証を使う | 1件の間違いでページ全体を壊さず、テストでは必ず失敗させる |
| 5 | 安全性 | URL は、サイト内パス(`/` 始まり、`//` 不可)か `https://` だけ。`javascript:` `data:` `http:` `https:example.com` は不可。画像は alt 必須。表示は `textContent` | 将来、管理画面など他の経路から書かれる前提で、記事(P5)と同じく安全側に倒す |
| 6 | 下書きは持たない | `draft` の項目は作らない。公開前は `coming-soon`(準備中)。下書きは、ブランチの中だけに置く | `public/data/` は誰でも読める。JSON に入れた未公開の情報は、公開と同じになる。下書き→確認→公開の流れは、DB を持つ P26 |
| 7 | 整合の検査 | download は準備中には付けられない。version・released_at は、準備中だけ null 可。changelog は新しい順で、先頭の version は product の version と同じ。released_at ≤ updated_at。価格は、無料・未定は金額なし、有料は1以上の整数の円 | 管理画面から入力されるときの、よくある食い違いを、保存前に止めるため |
| 8 | 表示 | カードに、状態バッジ・題名・説明・対応OS・価格・バージョン・更新日(`<time>`)・「遊ぶ/見る」ボタン・ダウンロードのボタン。項目は色だけでなく文字のラベルで示す。外部URLには `rel="noopener noreferrer"`。画像は16:9の枠に収める(`object-fit: contain`)。画像がなければ、色の面(装飾扱い) | 状態・価格をひと目で。画像の縦横比が枠を広げる不具合は、`overflow: hidden` で防ぐ |
| 9 | 更新履歴の表示 | データと検証だけ。表示は詳細ページ(P7)・更新履歴(P10) | 表示する場所が、仕様のうえで後のPhaseにある |
| 10 | 「上司から逃げろ」の値 | 無料・Web・version 0.3.0・公開日 2026-09-20・画像は既存の主人公のイラスト。更新履歴(0.1.0〜0.3.0)は、git の履歴から起こした | 実際の変更に基づく。版の付け方(x.y.z)は、以後この製品で継続する |

## 変更したもの

- 新規: `public/data/categories.json`、`public/assets/js/products/{schema,format}.js`、`tests/products.test.js`
- 変更: `public/data/products.json`(拡張)、`components/product-list.js`、`components.css`、`/styleguide/`、`tests/site.test.js`(旧 products.json のテストを `tests/products.test.js` へ移して強化)、`CLAUDE.md`、`docs/dev-setup.md`

## 影響範囲

- `/games/` のカードの見た目が変わる(メタ情報・画像が加わる)。ゲーム本体・記録・計測・広告の枠には影響なし。
- 旧形式の `products.json`(version なし)は、読み込めなくなる(検証で落ちる)。今回で置き換え済みで、他に読む箇所はない。
- `products.json` を編集するPRは、`npm run check` の検証を通らなければマージできない。

## テスト結果

- `npm run check`(lint・フォーマット・単体テスト342件)成功。新規40件(`tests/products.test.js`。`site.test.js` にあった旧テスト3件を置き換えたので、差し引き +37):
  実データの形式・実在するURLや画像・状態ラベルとOS表示名の網羅、必須項目・型・列挙値・id・カテゴリ・文字数・画像のalt・OS・価格・状態・URLの安全性(20以上の危険な例)・ダウンロード・バージョンと日付(実在する日付・10以上の桁の比較)・更新履歴の並び・一覧全体(旧形式・重複)・表示用の除外・カテゴリ・表示用の文字列
- ブラウザ操作(headless Edge)35項目成功:
  - 実データのカード(バッジ・題名・OS・価格・バージョン・更新日・画像のalt・ボタン・16:9の枠・エラー/警告なし)
  - 375/768/1280px で横スクロールなし
  - 有料・準備中・ダウンロード付き(外部/サイト内)・長い文字
  - 不正な項目(危険なURL・画像・重複・不明なカテゴリ)だけ外して他は表示、警告を出す
  - HTMLを含む文字が実行されない
  - 該当なし・404・壊れたJSON・旧形式でも、ページは落ちず案内が出る
  - 他のページ・スタイルガイドに回帰なし
- Phase 2〜5 のブラウザ確認(99・89・84・71・15項目)も、引き続き成功

## 確認中に見つけて直した不具合

- 画像を入れたカードで、画像の縦横比(縦長)が 16:9 の枠を押し広げ、カードが極端に縦長になった(`aspect-ratio` は、内容による最小の高さに負ける)。枠に `overflow: hidden` を付けて解消。Phase 5 までは画像を使わなかったため、表に出ていなかった

## 未確認・既知事項

- ダウンロードのボタンは、実際の商品がまだないため、テスト用のデータでだけ確認した(本物のファイル・GitHub Releases は P7)
- 更新履歴・詳細(details)は、データにあるが、まだ画面に出ない(P7・P10)
- 画像のサイズ(幅・高さ)は持たない。読み込み中のレイアウトのずれは、16:9の枠で防いでいる。写真など大きな画像を使うときは、P7 で最適化を検討する
- カテゴリの一覧ページは `/games/` だけ。`/software/` `/tools/` は、ナビで「準備中」のまま
