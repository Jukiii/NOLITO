// 用語一覧ページ(/games/escape-boss/glossary/)の、絞り込み。DOM・保存に触れない純粋な関数。
// 元データは、公開の語録(public/data/vocabulary/*.json。下書きは入っていない)。新しい保存はない。

const isText = (value) => typeof value === "string" && value.trim() !== "";

// 検索の対象の文字(語・読み・ローマ字・英語のつづり・カテゴリ・説明・関連語)
function haystackOf(word) {
  const list = (value) => (Array.isArray(value) ? value.filter(isText) : []);
  return [
    word.japanese,
    word.reading,
    ...list(word.romaji),
    word.typing,
    word.category,
    word.explanation,
    ...list(word.related_terms),
  ]
    .filter(isText)
    .join(" ")
    .toLowerCase();
}

/**
 * 職種ごとにまとめた用語の一覧を返す(入力は書き換えない)。
 * vocabularies: 語録(`{ job_id, job_name, items }`)の配列。壊れた職種・語は、飛ばす(落ちない)。
 * 絞り込み: query = 部分一致(大文字小文字を区別しない。空白で区切ると、すべてを含むもの)、jobId = その職種だけ。
 * 戻り値: [{ jobId, jobName, total, words }](words は絞り込み後。0 件の職種も、total つきで返す)
 */
export function glossaryGroups(vocabularies, { query = "", jobId = "" } = {}) {
  const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  const groups = [];
  for (const vocabulary of Array.isArray(vocabularies) ? vocabularies : []) {
    if (!isText(vocabulary?.job_id) || !Array.isArray(vocabulary.items)) continue;
    if (jobId && vocabulary.job_id !== jobId) continue;
    const items = vocabulary.items.filter((word) => isText(word?.japanese) && isText(word?.id));
    const words = items.filter((word) => {
      const haystack = haystackOf(word);
      return terms.every((term) => haystack.includes(term));
    });
    groups.push({
      jobId: vocabulary.job_id,
      jobName: isText(vocabulary.job_name) ? vocabulary.job_name : vocabulary.job_id,
      total: items.length,
      words,
    });
  }
  return groups;
}

/** 絞り込み後の語の合計 */
export function countWords(groups) {
  return groups.reduce((sum, group) => sum + group.words.length, 0);
}
