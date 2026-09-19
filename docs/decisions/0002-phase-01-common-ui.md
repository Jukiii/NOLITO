# 0002 Phase 1 共通UIの決定事項

日付: 2026-09-19 / 対象Phase: 1

## 決定

| # | 項目 | 決定 | 理由 |
| - | ---- | ---- | ---- |
| 1 | Header / Footer の方式 | JS(ES Modules)で1か所の定義(`config/nav.js`)から描画。JS無効時は `<noscript>` でロゴのみ表示 | 「HTMLとJavaScriptを併用」。Phase 20 の拡張可能なヘッダーメニューに備え、ページごとの複製を避ける。本文は静的HTML |
| 2 | ナビ項目 | ホーム / ゲーム / ソフト / ツール / 記事。ホーム以外は未作成のため「準備中」(非リンク) | 404へのリンクを作らない。ページができたPhaseで `available` を外す |
| 3 | Footer | サイト名・キャッチコピー・著作権のみ | 法務ページ等は存在するようになってからリンクを追加する |
| 4 | styleguide | `/styleguide/` を追加。`noindex`・ナビ非掲載 | Modal・Card・ProductCard の確認場所。仕様書にはないが検証用として承認済み |
| 5 | 配色 | bg `#fffaf0` / surface `#fff` / text `#1b2033` / text-muted `#4a5068` / primary `#4b3fe0` / accent `#ffd23f` / soft `#fff1b8` | ポップ・カジュアル。ブランドカラーは仕様書にないため案を採用(トークン集約で変更容易) |
| 6 | コントラスト | 本文・リンク・ボタン・バッジの全組み合わせで WCAG AA(4.5:1)以上(text/bg 15.5、muted/bg 7.65、白/primary 6.80、text/accent 11.18) | design-system「視認性の高いコントラスト」 |
| 7 | フォント・ロゴ | システムフォント、文字ロゴ「NOLITO」 | 外部フォントは Phase 28 で再検討 |
| 8 | ブレークポイント | 48rem(768px)以上で横並び、未満でハンバーガー | Phase 1 |
| 9 | Modal | ネイティブ `<dialog>`。`data-modal-open` / `data-modal-close` で開閉 | フォーカス管理・Esc・背面の inert をブラウザ標準に任せる |
| 10 | CSS構成 | `tokens` / `base` / `layout` / `components` を各HTMLから `<link>`(`@import` 不使用)。`styleguide.css` は styleguide ページ専用 | ビルドなしでの読み込み直列化を避ける |
| 11 | Stylelint | `selector-class-pattern` を kebab-case + BEM(`block__element--modifier`)に緩和 | 標準設定は BEM の `__` `--` を拒否するため |

## 実装しないもの(該当Phaseへ)

- ダークテーマ、文字サイズ設定、アニメーション切替UI(Phase 21)。色は意味のあるトークン名にしてあり、上書きで対応できる
- モバイル下部固定バー、検索、トップの構成(Phase 20)
- ProductCard のデータ連携(Phase 6)。Phase 1 は見た目のみ
- 各セクションのページ、法務ページ

## テスト結果

`npm run check` 成功。ブラウザ操作(headless Edge)で55項目を確認し、すべて成功。

- 375 / 768 / 1280px × `/`・`/404.html`・`/styleguide/`: 横スクロールなし、768px で横並び/ハンバーガー切替、コンソールエラーなし
- ハンバーガー: 開閉、Esc で閉じてフォーカスがトグルへ戻る、PC幅へ広げると閉状態に戻る
- キーボード: 最初の Tab でスキップリンク、Enter で本文へ、フォーカス中の要素に 3px の枠線
- Modal: 開閉(ボタン・Esc・背景クリック)、閉じた後にフォーカス復帰、表示中は背面がスクロール不可、背面要素にフォーカスが移らない
- JS無効: 本文とロゴリンクが表示され、横スクロールなし
- `prefers-reduced-motion: reduce` で transition が実質0、`no-preference` では 0.1s(検証環境のOSは「動きを減らす」が有効だったため、両方を明示的にエミュレートして確認)
- 未存在パスは 404 ステータスで、共通UI付きの 404 ページを返す

## 未確認・既知事項

- 確認したのは Chromium 系(Edge)のみ(ユーザーが Windows の Chrome と iPhone の Safari で表示を確認済み。2026-09-20)。Firefox は未確認(`<dialog>` と `:has()` を使用)
- スクリーンリーダーでの読み上げは未確認

## 追記(2026-09-20)

- favicon: ユーザー承認のうえ `public/favicon.svg`(NOLITO の頭文字「N」、primary 背景・accent 文字)を追加し、3ページの `<head>` にリンクした。`/favicon.ico` の 404 はこれで解消する(`<link rel="icon">` があるとブラウザは `favicon.ico` を要求しない)
- JS 描画のヘッダーは html-validate の対象外(DOM はブラウザ操作で確認)
