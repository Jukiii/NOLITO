// 語録の原稿(content/vocabulary/*.md)から、公開する語録(public/data/vocabulary/*.json)を作る。
// 原稿の読み取り・検証(vocab-md.mjs・vocab-validate.mjs)と、書き出し・最新かの検査。
// 下書き(draft: true)は、公開の JSON に入れない。原稿だけの項目(review・draft・note)も、入れない。
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { format } from "prettier";
import { parseVocabularyMarkdown } from "./vocab-md.mjs";
import { toPublished, validateAcross, validateVocabulary } from "./vocab-validate.mjs";

export const SOURCE_DIR = "content/vocabulary";
export const OUTPUT_DIR = "public/data/vocabulary";

// Windows の作業コピーは、改行が CRLF になる(git の設定による)。LF にそろえて読む
const readText = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");

/** 原稿の一覧: [{ name(職種 id), file(相対パス), text }]。ファイル名は、職種の id.md。 */
export function loadSources(root) {
  const dir = join(root, SOURCE_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => ({
      name: name.slice(0, -".md".length),
      file: `${SOURCE_DIR}/${name}`,
      text: readText(join(dir, name)),
    }));
}

/**
 * 原稿を、すべて読み取って、検証する(下書きも含める)。
 * context: { jobs, roleIds }。戻り値: { files: [{ name, file, data }], errors }。
 * 問題は、ファイルごとにまとめて、すべて集める。
 */
export function readSources(sources, context) {
  const files = [];
  const errors = [];
  for (const source of sources) {
    let raw;
    try {
      raw = parseVocabularyMarkdown(source.text);
    } catch (error) {
      errors.push(`${source.file}: ${error.message}`);
      continue;
    }
    const { errors: problems, data } = validateVocabulary(raw, context);
    for (const message of problems) errors.push(`${source.file}: ${message}`);
    if (data && data.job_id !== source.name) {
      errors.push(
        `${source.file}: ファイル名(${source.name}.md)と job_id(${data.job_id})を、そろえてください`,
      );
    }
    files.push({ name: source.name, file: source.file, data });
  }
  errors.push(...validateAcross(files.map(({ file, data }) => ({ name: file, data }))));
  // jobs.json にある職種の原稿が、そろっているか
  for (const job of context.jobs) {
    if (!sources.some((source) => source.name === job.id)) {
      errors.push(`${SOURCE_DIR}/${job.id}.md: 職種 ${job.id} の原稿がありません`);
    }
  }
  return { files, errors };
}

/** 公開の JSON の文字列(Prettier で整える)。 */
export async function renderPublished(data) {
  return format(`${JSON.stringify(toPublished(data), null, 2)}\n`, {
    parser: "json",
    printWidth: 100,
    endOfLine: "lf",
  });
}

/**
 * 公開する語録を作る(書き出しはしない)。戻り値: { outputs: Map<公開ディレクトリからの相対パス, 中身>, files, errors }
 * 問題があれば、outputs は空。
 */
export async function buildOutputs(sources, context) {
  const { files, errors } = readSources(sources, context);
  const outputs = new Map();
  if (errors.length > 0) return { outputs, files, errors };
  for (const { name, data } of files) {
    outputs.set(`${OUTPUT_DIR}/${name}.json`, await renderPublished(data));
  }
  return { outputs, files, errors };
}

/** 生成物(公開のディレクトリにあるもの)が、原稿から作ったものと一致しているか。違いの一覧を返す。 */
export function checkOutputs(root, outputs) {
  const problems = [];
  for (const [path, expected] of outputs) {
    const file = join(root, path);
    if (!existsSync(file)) problems.push(`${path} がありません`);
    else if (readText(file) !== expected) problems.push(`${path} が、原稿と違います`);
  }
  // 原稿にない職種の JSON が、残っていないか
  const dir = join(root, OUTPUT_DIR);
  if (existsSync(dir)) {
    for (const name of readdirSync(dir).filter((entry) => entry.endsWith(".json"))) {
      if (!outputs.has(`${OUTPUT_DIR}/${name}`))
        problems.push(`${OUTPUT_DIR}/${name} に、対応する原稿がありません`);
    }
  }
  return problems;
}

export function writeOutputs(root, outputs) {
  for (const [path, text] of outputs) writeFileSync(join(root, path), text);
}

/** jobs.json と roles.json から、検証の文脈を作る。 */
export function loadContext(root) {
  const jobs = JSON.parse(readText(join(root, "public/data/jobs.json")));
  const roles = JSON.parse(readText(join(root, "public/data/roles.json")));
  return { jobs, roleIds: roles.map((role) => role.id) };
}
