// 語録の確認シート(docs/vocabulary-review.md)を作る(運営者用)。
//   npm run vocab:review            … 書き出す
//   npm run vocab:review -- --check … 書き出さず、いまの語録と一致しているか検査する
// 元は、語録の原稿(content/vocabulary/*.md)。確認メモ(note)・確認の状況(review)・下書き(draft)も、原稿に書く。語録を変えたら、作り直す。
import { writeFileSync } from "node:fs";
import { reviewSheet } from "./lib/vocab-stats.mjs";
import { loadSourceVocabularies, paths, readSheet } from "./lib/vocab-io.mjs";

try {
  const vocabularies = loadSourceVocabularies();
  const notes = Object.fromEntries(
    vocabularies.flatMap((data) =>
      data.items.filter((item) => item.note).map((item) => [item.id, item.note]),
    ),
  );
  const sheet = reviewSheet(vocabularies, notes);
  if (process.argv.includes("--check")) {
    if (readSheet() !== sheet) {
      console.error(
        "確認シートが、語録と一致していません。npm run vocab:review を実行してください。",
      );
      process.exit(1);
    }
    console.log("確認シートは、最新です。");
  } else {
    writeFileSync(paths.sheet, sheet);
    console.log(`書き出しました: docs/vocabulary-review.md(${sheet.split("\n").length} 行)`);
  }
} catch (cause) {
  console.error(`エラー: ${cause.message}`);
  process.exit(1);
}
