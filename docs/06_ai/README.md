# AI活用の流れ(語録)

語録(`content/vocabulary/*.md`)に、AI をどう使うかを、1 つにまとめた文書。個々の手順・プロンプトは、下の各文書にある。**この文書は、流れの案内だけ**(内容は増やさない)。

## 全体の流れ

```text
1. 生成(AI。任意)
   docs/06_ai/vocabulary-generation-prompt.md の指示で、AI に下書き(draft: true)を作らせる
        ↓
2. 機械チェック(必須。npm run vocab:check)
   形式・重複(id・日本語・読みの完全一致)・ローマ字の入力可否・難易度の決めとのずれ・
   類似語(表記は違うが、説明が近い組。目安)を、決まった計算だけで検査する
        ↓
3. AIチェック(任意。npm run vocab:check -- --for-ai)
   docs/06_ai/content-check-prompt.md を使い、AI に、誤り・不整合の可能性を指摘させる
        ↓
4. 人間の最終確認(必須。npm run vocab:review の確認シート)
   docs/vocabulary-review.md で、正確性・表記・難易度・適切さを、人間が確認する
        ↓
5. 確認済みにする
   draft: true の行を消し、review: confirmed にする(直すところは、原稿を直す)
        ↓
6. 公開(npm run build。語録は npm run build:vocabulary)
   public/data/vocabulary/*.json を生成し、生成物もコミットする
        ↓
(公開後・任意)
7. 改善提案(AI。npm run vocab:check -- --improve)
   docs/06_ai/content-improve-prompt.md を使い、すでに公開している語(関連用語がまだない語)へ、
   関連用語・学習ポイント・詳細説明の追加案を、AI に提案させる → 人間が、原稿を手で直す → 2 に戻る
```

**AI を使わずに、1・3・7 を飛ばしても、運用できる**(2・4・5・6 だけで、語を足す・直すことができる)。AI の結果(生成・チェック・改善提案)は、どれも**最終判断にしない**。人間の確認(4)を、必ず経る。

## それぞれの文書・コマンド

| 段階 | 文書・コマンド |
| ---- | -------------- |
| 生成 | `docs/06_ai/vocabulary-generation-prompt.md` |
| 機械チェック | `npm run vocab:check`(形式・重複)/ `npm run vocab:stats`(統計・点検) |
| AIチェック | `docs/06_ai/content-check-prompt.md` / `npm run vocab:check -- --for-ai`(`--all` で未確認の語も) |
| 人間の最終確認 | `npm run vocab:review` → `docs/vocabulary-review.md` |
| 公開 | `npm run build:vocabulary`(`npm run build` に含まれる) |
| 改善提案 | `docs/06_ai/content-improve-prompt.md` / `npm run vocab:check -- --improve` |
| 検証項目の一覧 | `docs/05_checklists/vocabulary-validation.md` |
| 原稿の形式 | `docs/04_templates/vocabulary-template.md`(拡張ファイル・`difficulties` を含む) |

## この方針を、緩めない性質

- **有料APIとの自動連携は、作らない**。無料・環境を選ばない方法(プロンプトを、人が AI に渡す)を基本にする。有料の AI が必要な作業(生成・チェック・改善提案)は、**人が手で行う**(スクリプトから、AI の API を呼ばない)。
- **管理画面からのアップロードは、この文書の範囲外**(Phase 26。管理画面ができてから、この流れに組み込む)。
- AI の結果を、人間の確認なしに、`review: confirmed` にしない・公開の語録に、そのまま反映しない。
