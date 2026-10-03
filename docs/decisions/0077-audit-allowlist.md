# 0077: 依存の脆弱性チェックに、期限つきの除外を設ける(Issue #184)

日付: 2026-10-03

## 背景

2026-10-03 から、すべての PR で CI の `npm run audit`(`npm audit --audit-level=high`)が失敗した。原因は、`braces`(`stylelint` → `micromatch` → `braces`。開発用のみで、配信するサイトには入らない)に付いた high の勧告 GHSA-vfj7-8cjw-p6xm(深く入れ子になったパターンでのスタック枯渇による DoS)。**修正版がなく**(`braces` 最新の 3.0.3 も対象。`stylelint` 最新も同じ依存)、更新では直らない。`braces` は、自分たちのファイル名の照合にだけ使われ、外部から入力を受けない。

## 決めたこと(Jさんが案 A を選択。2026-10-03)

- `npm run audit` を、自前のスクリプト `scripts/audit.mjs`(判定は `scripts/lib/audit-allow.mjs`。純粋な計算)に替えた。`npm audit --json` の結果から high 以上の**勧告**を取り出し、除外の一覧 `ALLOWED_ADVISORIES` と突き合わせる。
- 除外は **勧告の ID + 期限 + 理由**。今回は GHSA-vfj7-8cjw-p6xm だけを、**2026-11-03 まで**除外する。**期限を過ぎると、除外は無効になり、CI が止まる**(忘れない仕組み)。期限が来たら、Jさんに確認して、延ばすか・外すかを決める(勝手に延ばさない)。
- 一覧にない別の high 以上の勧告は、これまでどおり CI を止める(0052 のしきい値 `high` は、そのまま)。`npm audit` の結果を読めない(ネットワークなど)ときも、失敗にする。
- 修正版が出たら、除外の項目を消し、`stylelint` などを更新する。

## 影響

- 配信物・実行時の動きは変わらない。CI の `audit` の手順が、`node scripts/audit.mjs` を通る。
- 除外の追加は、決定ログに理由を書く。修正版のないもの・外部の入力を受けないものだけにする。

## テスト

`tests/audit-allow.test.js`(除外・期限切れ・別の high・moderate・空の結果・一覧の形式)。
