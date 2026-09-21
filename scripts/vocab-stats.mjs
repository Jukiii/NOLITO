// 語録の統計と点検を表示する(運営者用)。
//   npm run vocab:stats            … 職種ごとの統計と、点検の結果(警告)
// 直さないといけないもの(エラー)があると、終了コード 1。警告だけなら、0。
import { findIssues, formatStats, publishedOf, reviewCounts } from "./lib/vocab-stats.mjs";
import { loadSourceVocabularies } from "./lib/vocab-io.mjs";

try {
  // 統計・点検は、公開する語で行う(下書きは、除く)。確認の状況は、原稿から数える
  const source = loadSourceVocabularies();
  const vocabularies = publishedOf(source);
  console.log(formatStats(vocabularies));
  const counts = reviewCounts(source);
  console.log(
    `
人間の確認: 確認済み ${counts.confirmed} 語 / 未確認 ${counts.pending} 語(公開 ${counts.published} 語)。下書き ${counts.draft} 語(公開しません)`,
  );
  const { errors, warnings } = findIssues(vocabularies);
  if (warnings.length > 0) {
    console.log(`\n警告(直したほうがよい点): ${warnings.length} 件`);
    for (const warning of warnings) console.log(`  - ${warning}`);
  }
  if (errors.length > 0) {
    console.error(`\nエラー(直さないといけない点): ${errors.length} 件`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`\nエラーは、ありません。${warnings.length === 0 ? "警告も、ありません。" : ""}`);
} catch (cause) {
  console.error(`エラー: ${cause.message}`);
  process.exit(1);
}
