// 語録の原稿(content/vocabulary/*.md)の点検と、AI チェックの支え(運営者・開発者用)。
//   npm run vocab:check                  … 検証(エラー・警告)と、人間に見てほしい点の一覧
//   npm run vocab:check -- --for-ai      … AI チェックに渡す文(指示 + 下書きの語 + 機械の確認結果)を出す
//   npm run vocab:check -- --for-ai --all … 下書きだけでなく、未確認の語も含める
//   npm run vocab:check -- --improve      … 公開済みの語(関連用語がまだない)への、AI改善提案に渡す文
// AI の結果は、最終判断にしない。人間の確認(review: confirmed)が、必ず要る(docs/06_ai/content-check-prompt.md)。
// エラー(直さないといけない点)があると、終了コード 1。
import { readFileSync } from "node:fs";
import { stringifyVocabularyYaml } from "./lib/vocab-md.mjs";
import { loadSourceVocabularies, paths } from "./lib/vocab-io.mjs";
import {
  expectedDifficulty,
  findIssues,
  improvementCandidates,
  publishedOf,
  readingUnits,
  reviewCounts,
} from "./lib/vocab-stats.mjs";

const args = new Set(process.argv.slice(2));

try {
  const source = loadSourceVocabularies();
  const published = publishedOf(source);
  const { errors, warnings } = findIssues(published);
  const counts = reviewCounts(source);

  // 下書きの語の、難易度のずれ(公開の語は、findIssues が見ている)
  const draftWarnings = source.flatMap((data) =>
    data.items
      .filter((item) => item.draft)
      .filter((item) => item.difficulty !== expectedDifficulty(readingUnits(item.reading)))
      .map(
        (item) =>
          `${data.job_id}: ${item.id}(${item.japanese}): 難易度 ${item.difficulty} は、読みの長さの決めでは ${expectedDifficulty(readingUnits(item.reading))} です(下書き)`,
      ),
  );
  const allWarnings = [...warnings, ...draftWarnings];

  const notes = source.flatMap((data) =>
    data.items
      .filter((item) => item.note)
      .map((item) => `${item.id}(${item.japanese}): ${item.note}`),
  );
  const drafts = source.flatMap((data) => data.items.filter((item) => item.draft));
  const targets = source.map((data) => ({
    ...data,
    items: data.items.filter(
      (item) => item.draft || (args.has("--all") && item.review === "pending"),
    ),
  }));

  if (args.has("--improve")) {
    const prompt = readFileSync(`${paths.root}docs/06_ai/content-improve-prompt.md`, "utf8")
      .replaceAll("\r\n", "\n")
      .trim();
    console.log(prompt, "\n");
    const candidates = improvementCandidates(source);
    const total = candidates.reduce((sum, data) => sum + data.items.length, 0);
    console.log(`## 改善の候補(公開済み・関連用語が、まだない語): ${total} 件\n`);
    if (candidates.length === 0) {
      console.log("(改善の候補が、ありません)");
    }
    for (const data of candidates) {
      console.log(
        `### ${data.job_name}(${data.job_id})\n\n\`\`\`yaml\n${stringifyVocabularyYaml(data)}\n\`\`\`\n`,
      );
    }
    console.log(
      "AI の提案は、参考です。最終判断は、人間が行います。原稿は、AIが直接書き換えません。",
    );
  } else if (args.has("--for-ai")) {
    const prompt = readFileSync(`${paths.root}docs/06_ai/content-check-prompt.md`, "utf8")
      .replaceAll("\r\n", "\n")
      .trim();
    console.log(prompt, "\n");
    console.log("## 機械の確認結果(形式・重複・ローマ字の入力可否は、すでに通っています)\n");
    console.log(`- 形式のエラー: ${errors.length} 件`);
    console.log(`- 警告: ${allWarnings.length} 件`);
    for (const warning of allWarnings) console.log(`  - ${warning}`);
    console.log("\n## 確認する語(語録の Markdown。```yaml の中身)\n");
    const selected = targets.filter((data) => data.items.length > 0);
    if (selected.length === 0) {
      console.log(
        "(確認する語が、ありません。下書きがないときは、--all で、未確認の語も含められます)",
      );
    }
    for (const data of selected) {
      console.log(
        `### ${data.job_name}(${data.job_id})\n\n\`\`\`yaml\n${stringifyVocabularyYaml(data)}\n\`\`\`\n`,
      );
    }
    console.log("AI の指摘は、参考です。最終判断は、人間が行います。");
  } else {
    console.log(`語録の原稿(content/vocabulary/*.md): ${source.length} 職種`);
    console.log(
      `  公開 ${counts.published} 語(確認済み ${counts.confirmed} 語・未確認 ${counts.pending} 語)/ 下書き ${counts.draft} 語(公開しません)`,
    );
    console.log("  形式の検証(項目・型・長さ・重複・ローマ字の入力可否・関連用語): 通りました");
    if (drafts.length > 0) {
      console.log(`\n下書き(人間の確認の前。公開されません): ${drafts.length} 語`);
      for (const item of drafts)
        console.log(`  - ${item.id}(${item.japanese}): ${item.explanation}`);
    }
    if (notes.length > 0) {
      console.log(`\n人間に見てほしい点(note): ${notes.length} 件`);
      for (const note of notes) console.log(`  - ${note}`);
    }
    if (allWarnings.length > 0) {
      console.log(`\n警告(直したほうがよい点): ${allWarnings.length} 件`);
      for (const warning of allWarnings) console.log(`  - ${warning}`);
    }
    if (errors.length > 0) {
      console.error(`\nエラー(直さないといけない点): ${errors.length} 件`);
      for (const error of errors) console.error(`  - ${error}`);
      process.exit(1);
    }
    console.log(
      "\n次: 下書きの語は、人間が確認して、draft の行を消します。全部の語は、確認したら review: confirmed にします。",
    );
  }
  if (errors.length > 0 && (args.has("--for-ai") || args.has("--improve"))) process.exit(1);
} catch (error) {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
}
