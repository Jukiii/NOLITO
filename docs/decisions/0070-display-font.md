# 0070 ゲームの数字・英字の見出しに、自前の字体を使う(Issue #166 PR 4)

## 理由

Issue #166 の「もっと現代のゲーム感を出して欲しい」への対応(PR 4)。結果画面のスコア・「RESULT」・開始の「PRESS SPACE KEY TO START」を、現代的なゲームらしい太い字体にする。

## 決めたこと

- 字体は **Orbitron**(SIL Open Font License 1.1)。Basic Latin(U+0020〜007E)だけを切り出し、太さ 700〜900 の可変のまま、woff2(約 8KB)にした。ファイル: `public/assets/fonts/nolito-display.woff2`、ライセンス: `public/assets/fonts/OFL-Orbitron.txt`。
- 原本に予約された字体名(Reserved Font Name「Orbitron」)があるため、切り出した版の字体名は **「NOLITO Display」** に変えた(OFL の、改変版の名前の決まりに合わせる)。
- **自前の配信だけ**(`@font-face` は同じサイトの woff2 を指す。Google Fonts など外部へ通信しない)。プライバシーポリシーの版は上げない。`font-display: swap`、読めないときは等幅の字体(`--font-display` のフォールバック)。
- 使う場所は、数字・英字の飾りだけ(結果のスコア・ラベル・開始の点滅の文)。日本語・打つ語(ローマ字)・用語の説明は、読みやすさのため、これまでの字体のまま。日本語の太い字体は、字数が多く、語録が増えるたびに切り出し直しが要るため、見送った。

## 影響範囲

- CSS と字体のファイルだけ。HTML・記録・ロジックは変えない。ゲームのページだけが `game.css` 経由で読む(ほかのページは読まない)。
- 字体の切り出しは、手元で fonttools を使って行った(リポジトリには入れていない)。再現手順: 原本を可変のまま `wght` 700〜900 に絞り、Basic Latin に切り出し、woff2 で保存し、名前を付け替える。

## テスト

- `tests/fonts.test.js`: `@font-face` が同じサイトの woff2 だけを指す・外部の URL がない・20KB 以内・woff2・ライセンス同梱・フォールバックの等幅。
- Edge で、結果画面・開始画面(1000px・360px)を確認。字体が読み込まれ(`loaded`)、横にはみ出さず、エラーなし。製品画面 `result.webp` を撮り直した。

## 未対応

- 日本語の見出しの字体は、変えていない。
