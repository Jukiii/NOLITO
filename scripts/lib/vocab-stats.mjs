// 語録(public/data/vocabulary/*.json)の統計・点検・確認シートの生成。DOM・ネットワークには触れない。
// 語録は、AI の下書きを、人間が確認してから公開する(CLAUDE.md)。ここは、その確認を助ける道具。

// 小さい「ゃゅょぁぃぅぇぉ」は、前の文字と合わせて 1 つと数える(っ・ー・ん は 1 つと数える)
const SMALL = new Set("ゃゅょぁぃぅぇぉ");

/** 読みの単位数(語の長さの目安)。 */
export const readingUnits = (reading) => [...reading].filter((char) => !SMALL.has(char)).length;

/** 難易度の決め(決定ログ 0006): 読みの単位数が 3 以下 = 1、4〜5 = 2、6 以上 = 3。 */
export const expectedDifficulty = (units) => (units <= 3 ? 1 : units <= 5 ? 2 : 3);

// 拡充の目標(警告として示す。満たしていなくても、エラーにはしない)
export const TARGETS = {
  minWordsPerJob: 24,
  minWordsPerDifficulty: 4,
  minCategories: 3,
};

const count = (values) => {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
};

/** 1 つの職種の統計。 */
export function jobStats(data) {
  const lengths = data.items.map((item) => readingUnits(item.reading));
  return {
    jobId: data.job_id,
    jobName: data.job_name,
    version: data.version,
    words: data.items.length,
    byDifficulty: { 1: 0, 2: 0, 3: 0, ...count(data.items.map((item) => item.difficulty)) },
    byCategory: count(data.items.map((item) => item.category)),
    readingUnits: {
      min: Math.min(...lengths),
      max: Math.max(...lengths),
      average: lengths.reduce((sum, value) => sum + value, 0) / lengths.length,
    },
  };
}

/**
 * 点検。
 *   errors   … 直さないと、いけないもの(重複・欠けている値)
 *   warnings … 直したほうがよいもの(難易度の決めとのずれ・語数やカテゴリの少なさ・職種をまたぐ同じ語)
 */
export function findIssues(vocabularies) {
  const errors = [];
  const warnings = [];
  const seenJapanese = new Map();

  for (const data of vocabularies) {
    const ids = new Set();
    const japanese = new Set();
    const readings = new Set();
    for (const item of data.items) {
      const where = `${data.job_id}: ${item.id}(${item.japanese})`;
      if (ids.has(item.id)) errors.push(`${where}: id が重複しています`);
      if (japanese.has(item.japanese)) errors.push(`${where}: 日本語表記が重複しています`);
      if (readings.has(item.reading)) errors.push(`${where}: 読みが重複しています`);
      ids.add(item.id);
      japanese.add(item.japanese);
      readings.add(item.reading);

      const expected = expectedDifficulty(readingUnits(item.reading));
      if (item.difficulty !== expected) {
        warnings.push(
          `${where}: 難易度 ${item.difficulty} は、読みの長さ(${readingUnits(item.reading)})の決めと違います(決めでは ${expected})`,
        );
      }
      if (seenJapanese.has(item.japanese) && seenJapanese.get(item.japanese) !== data.job_id) {
        warnings.push(
          `${where}: 同じ語が、ほかの職種(${seenJapanese.get(item.japanese)})にもあります`,
        );
      }
      if (!seenJapanese.has(item.japanese)) seenJapanese.set(item.japanese, data.job_id);
    }

    const stats = jobStats(data);
    if (stats.words < TARGETS.minWordsPerJob) {
      warnings.push(
        `${data.job_id}: 語数が ${stats.words} 語です(目標 ${TARGETS.minWordsPerJob} 語以上)`,
      );
    }
    for (const level of [1, 2, 3]) {
      if (stats.byDifficulty[level] < TARGETS.minWordsPerDifficulty) {
        warnings.push(
          `${data.job_id}: 難易度 ${level} が ${stats.byDifficulty[level]} 語です(目標 ${TARGETS.minWordsPerDifficulty} 語以上)`,
        );
      }
    }
    if (Object.keys(stats.byCategory).length < TARGETS.minCategories) {
      warnings.push(
        `${data.job_id}: カテゴリが ${Object.keys(stats.byCategory).length} 種類です(目標 ${TARGETS.minCategories} 種類以上)`,
      );
    }
  }
  return { errors, warnings };
}

/** 公開している語だけ(下書きを除いた語録)。原稿を渡すと、公開する語録になる。 */
export const publishedOf = (vocabularies) =>
  vocabularies.map((data) => ({
    ...data,
    items: data.items.filter((item) => item.draft !== true),
  }));

/**
 * 改善提案の候補(Phase 25)。公開済み(下書きでない)で、関連用語(related_terms)が、まだない語。
 * 確認済み(review: confirmed)かどうかは、問わない(内容の正確性の確認とは、別の関心ごとのため)。
 * 原稿(review・draft を持つ形)を渡す。戻り値も、同じ形(職種ごと)。
 */
export const improvementCandidates = (vocabularies) =>
  vocabularies
    .map((data) => ({
      ...data,
      items: data.items.filter(
        (item) => item.draft !== true && (item.related_terms?.length ?? 0) === 0,
      ),
    }))
    .filter((data) => data.items.length > 0);

/**
 * 人間の確認の状況。原稿の項目(review・draft を持つ)から数える。
 *   published … 公開する語 / confirmed … 確認済み(公開する語のうち) / pending … 未確認(公開する語のうち)
 *   draft … 下書き(公開しない語)
 * review を持たない項目(公開の JSON の形)は、未確認に数える。
 */
export function reviewCounts(vocabularies) {
  const counts = { published: 0, confirmed: 0, pending: 0, draft: 0 };
  for (const data of vocabularies) {
    for (const item of data.items) {
      if (item.draft === true) counts.draft += 1;
      else {
        counts.published += 1;
        counts[item.review === "confirmed" ? "confirmed" : "pending"] += 1;
      }
    }
  }
  return counts;
}

const pad = (text, width) => String(text).padEnd(width, " ");

/** 端末に出す、統計の表。 */
export function formatStats(vocabularies) {
  const lines = [
    `${pad("職種", 10)}${pad("語数", 6)}${pad("難易度1/2/3", 14)}${pad("カテゴリ", 9)}${pad("読みの長さ(最小-最大 / 平均)", 26)}版`,
  ];
  for (const data of vocabularies) {
    const stats = jobStats(data);
    lines.push(
      `${pad(stats.jobName, 10)}${pad(stats.words, 6)}${pad(`${stats.byDifficulty[1]}/${stats.byDifficulty[2]}/${stats.byDifficulty[3]}`, 14)}${pad(Object.keys(stats.byCategory).length, 9)}${pad(`${stats.readingUnits.min}-${stats.readingUnits.max} / ${stats.readingUnits.average.toFixed(1)}`, 26)}${stats.version}`,
    );
  }
  return lines.join("\n");
}

const cell = (value) =>
  String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");

// 確認の状況の表示(項目に review・draft がなければ、空欄)
const statusOf = (item) => {
  if (item.draft === true) return "下書き";
  if (item.review === "confirmed") return "確認済み";
  return item.review === "pending" ? "未確認" : "";
};

/**
 * 確認シート(Markdown)。人間が、語を1つずつ読んで確認するための表。
 * vocabularies は、語録の原稿(下書き・review を含む)か、公開の語録。notes は { 語の id: 「確認してほしい点」 }。
 */
export function reviewSheet(vocabularies, notes = {}) {
  const total = vocabularies.reduce((sum, data) => sum + data.items.length, 0);
  const published = publishedOf(vocabularies);
  const { warnings } = findIssues(published);
  const counts = reviewCounts(vocabularies);
  const lines = [
    "# 語録の確認シート",
    "",
    "> このファイルは、`npm run vocab:review` が、語録の原稿(`content/vocabulary/*.md`)から作ります。**手で書き換えません**。確認の状況(`review`)・確認のメモ(`note`)・下書き(`draft`)は、原稿に書きます。",
    "",
    `語録は、AI(私)が書いた**下書き**です。公開する前に、人間の確認が要ります(\`docs/05_checklists/vocabulary-validation.md\`)。**全 ${total} 語**を、次の観点で確認してください。`,
    "",
    "| 観点 | 見ること |",
    "| ---- | ---- |",
    "| 正確性 | 説明が、一般に確立した意味と合っているか。会社・地域・道具で使い方が違うものは、ないか |",
    "| 表記 | 日本語の表記・読み・ローマ字が、正しいか |",
    "| 難易度 | 数字(1 やさしい〜3 むずかしい)が、自然か |",
    "| 適切さ | 不適切・差別的・誤解を招く表現が、ないか。職種の人が読んで、嫌な気持ちにならないか |",
    "",
    "**返信のしかた**: 全部よければ「OK」。直したい語だけ、ID と直し方を書いてください(例: `engineer-009 の説明を「…」に直す` / `sales-004 を削除`)。「私の確認メモ」の欄は、私が、特に見てほしいと思った点です。",
    "",
    "## 全体の点検",
    "",
    `- 職種: ${vocabularies.length} 種類 / 語: ${total} 語(公開 ${counts.published} 語・下書き ${counts.draft} 語)`,
    `- 人間の確認: 確認済み ${counts.confirmed} 語 / 未確認 ${counts.pending} 語(公開している語のうち)`,
    `- 詳細説明のある語: ${vocabularies.reduce((sum, data) => sum + data.items.filter((item) => item.detail).length, 0)} 語(難語のための、少し長い説明。学習ポイント・関連する語と一緒に、ゲームの「くわしく」に出ます)`,
    `- 警告: ${warnings.length} 件${warnings.length === 0 ? "" : "(下の一覧。直したほうがよい点)"}`,
    "",
  ];
  if (warnings.length > 0) lines.push(...warnings.map((warning) => `  - ${warning}`), "");

  lines.push("## 職種ごとの統計", "", "```", formatStats(published), "```", "");

  for (const data of vocabularies) {
    lines.push(
      `## ${data.job_name}(${data.job_id}。版 ${data.version}。${data.items.length} 語)`,
      "",
      "| ID | 日本語 | 読み | ローマ字 | カテゴリ | 難易度 | 説明 | 詳細説明 | 学習ポイント | 関連する語 | 確認 | 私の確認メモ |",
      "| ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |",
    );
    for (const item of data.items) {
      lines.push(
        `| ${cell(item.id)} | ${cell(item.japanese)} | ${cell(item.reading)} | ${cell(item.romaji.join(" / "))} | ${cell(item.category)} | ${item.difficulty} | ${cell(item.explanation)} | ${cell(item.detail)} | ${cell((item.learning_points ?? []).join(" / "))} | ${cell(item.related_terms.join("、"))} | ${statusOf(item)} | ${cell(notes[item.id])} |`,
      );
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
