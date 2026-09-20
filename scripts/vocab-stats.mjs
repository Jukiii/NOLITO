// 語録の統計と点検を表示する(運営者用)。
//   npm run vocab:stats            … 職種ごとの統計と、点検の結果(警告)
// 直さないといけないもの(エラー)があると、終了コード 1。警告だけなら、0。
import { findIssues, formatStats } from "./lib/vocab-stats.mjs";
import { loadVocabularies } from "./lib/vocab-io.mjs";

try {
  const vocabularies = loadVocabularies();
  console.log(formatStats(vocabularies));
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
