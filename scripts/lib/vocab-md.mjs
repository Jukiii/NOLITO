// 語録の原稿(Markdown)の読み取りと書き出し。ファイルの読み書きはしない純粋な処理。
//
// 原稿は、Markdown の中に「```yaml で囲んだ語録の YAML」を 1 つだけ持つ(docs/04_templates/vocabulary-template.md)。
// YAML の外の文章(見出し・作成メモ・AI への指示など)は、自由に書ける。読み取りは、記事と同じ `yaml` パッケージを、
// 厳しい設定(YAML 1.2 の core スキーマ・同じ名前のキーの重複はエラー・別名(アンカー)・型の指定(!!)は使えない)で使う。
// 形(項目の名前・型・長さ)の検査は、vocab-validate.mjs。
import { parseDocument } from "yaml";

// 先頭の BOM(バイト順マーク)。ソースに、見えない文字を直接書かないため、文字コードから作る
const BOM = String.fromCodePoint(0xfeff);
const FENCE = /^```yaml[ \t]*\n([\s\S]*?)\n```[ \t]*$/gm;

/** Markdown から、```yaml で囲んだ部分の中身を取り出す。ちょうど 1 つ、必要。 */
export function extractYaml(markdown) {
  const text = String(markdown)
    .replace(new RegExp(`^${BOM}`), "")
    .replaceAll("\r\n", "\n");
  const blocks = [...text.matchAll(FENCE)];
  if (blocks.length === 0) throw new Error("```yaml で囲んだ語録の YAML が、ありません");
  if (blocks.length > 1) {
    throw new Error(
      `\`\`\`yaml で囲んだ部分が ${blocks.length} 個あります(1 つだけにしてください)`,
    );
  }
  return blocks[0][1];
}

/** 語録の YAML を、オブジェクトに読み取る。書き方の間違いは、日本語のエラーにする。 */
export function parseVocabularyMarkdown(markdown) {
  const source = extractYaml(markdown);
  const doc = parseDocument(source, {
    schema: "core",
    version: "1.2",
    uniqueKeys: true,
    merge: false,
    prettyErrors: false,
  });
  const first = (list) => String(list[0].message).split("\n")[0];
  if (doc.errors.length > 0) throw new Error(`YAML を読み取れません: ${first(doc.errors)}`);
  if (doc.warnings.length > 0)
    throw new Error(`YAML に、使えない書き方があります: ${first(doc.warnings)}`);
  let data;
  try {
    // 別名(アンカー)は使えない(maxAliasCount: 0)
    data = doc.toJS({ maxAliasCount: 0 });
  } catch (error) {
    throw new Error(
      `YAML に、使えない書き方があります(別名など): ${String(error.message).split("\n")[0]}`,
      {
        cause: error,
      },
    );
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("語録の YAML は、項目名と値の組で書いてください");
  }
  return data;
}

// ---- 書き出し(既存の語録を Markdown にする移行・テスト用) ----

const RESERVED =
  /^(?:true|false|null|yes|no|on|off|y|n|~|[-+]?(?:\d[\d_]*\.?\d*|\.\d+)(?:e[-+]?\d+)?|0x[\da-f]+|0o[0-7]+|\.inf|\.nan)$/i;

// 引用符なしで書ける文字列か(YAML の特別な文字で始まらず、": " や " #" を含まない)
function isPlain(text, { flow = false } = {}) {
  if (text === "" || text !== text.trim()) return false;
  if (RESERVED.test(text)) return false;
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(text)) return false;
  if (/: |:$| #|\p{Cc}|\p{Cf}/u.test(text)) return false;
  if (flow && /[,[\]{}]/.test(text)) return false;
  return true;
}

// 二重引用符の中の、見えない文字(向きを変える文字・幅のない文字など)は、原稿に直接書かず、エスケープで書く。
// バックスラッシュも、ソースに「\u」と書かず、文字コードから作る(ソースに、見えない文字を生む書き方を、残さないため)
const BACKSLASH = String.fromCharCode(0x5c);
const escapeHidden = (json) =>
  json.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, (char) => {
    const hex = char.codePointAt(0).toString(16).toUpperCase();
    return hex.length <= 4
      ? `${BACKSLASH}u${hex.padStart(4, "0")}`
      : `${BACKSLASH}U${hex.padStart(8, "0")}`;
  });

// 文字列を YAML の値として書く。書けないものは、二重引用符で書く(JSON の文字列は、YAML でも正しい)
const scalar = (text, options) =>
  isPlain(text, options) ? text : escapeHidden(JSON.stringify(text));
const flowList = (list) => `[${list.map((value) => scalar(value, { flow: true })).join(", ")}]`;

/**
 * 語録(vocab-validate.mjs の正規化した形)を、YAML の文字列にする。
 * items の各項目は、id・japanese・reading・romaji・category・difficulty・roles・explanation・(detail)・related_terms・
 * learning_points・weak_detection と、原稿だけの review・draft・note を持てる。
 * 読み取り(parseVocabularyMarkdown)と検証を通すと、同じ値に戻る。
 */
export function stringifyVocabularyYaml(data) {
  const lines = [
    `job_id: ${scalar(data.job_id)}`,
    `job_name: ${scalar(data.job_name)}`,
    `version: ${scalar(data.version)}`,
    `updated_at: ${scalar(data.updated_at)}`,
    "items:",
  ];
  for (const item of data.items) {
    lines.push(
      `  - id: ${scalar(item.id)}`,
      `    japanese: ${scalar(item.japanese)}`,
      `    reading: ${scalar(item.reading)}`,
      `    romaji: ${flowList(item.romaji)}`,
      `    category: ${scalar(item.category)}`,
      `    difficulty: ${item.difficulty}`,
      `    roles: ${flowList(item.roles)}`,
      `    explanation: ${scalar(item.explanation)}`,
      ...(item.detail === undefined ? [] : [`    detail: ${scalar(item.detail)}`]),
      `    related_terms: ${flowList(item.related_terms)}`,
      `    learning_points: ${flowList(item.learning_points)}`,
      "    weak_detection:",
      `      enabled: ${item.weak_detection.enabled}`,
    );
    if (item.review !== undefined) lines.push(`    review: ${scalar(item.review)}`);
    if (item.draft === true) lines.push("    draft: true");
    if (item.note) lines.push(`    note: ${scalar(item.note)}`);
  }
  return lines.join("\n");
}

/** 原稿(Markdown)の全体。intro は、YAML の前に置く文章(見出し・書き方の説明)。 */
export function stringifyVocabularyMarkdown(data, { intro = "" } = {}) {
  const head = intro.trim() === "" ? "" : `${intro.trim()}\n\n`;
  return `${head}\`\`\`yaml\n${stringifyVocabularyYaml(data)}\n\`\`\`\n`;
}
