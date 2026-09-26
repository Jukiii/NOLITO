// 語録の原稿(content/vocabulary/*.md)から、公開する語録(public/data/vocabulary/*.json)を作る。
// 原稿の読み取り・検証(vocab-md.mjs・vocab-validate.mjs)と、書き出し・最新かの検査。
// 下書き(draft: true)は、公開の JSON に入れない。原稿だけの項目(review・draft・note)も、入れない。
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { format } from "prettier";
import { parseVocabularyMarkdown } from "./vocab-md.mjs";
import {
  EXTENSION_META_KEYS,
  toPublished,
  validateAcross,
  validateVocabulary,
} from "./vocab-validate.mjs";

export const SOURCE_DIR = "content/vocabulary";
export const OUTPUT_DIR = "public/data/vocabulary";

// Windows の作業コピーは、改行が CRLF になる(git の設定による)。LF にそろえて読む
const readText = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");

// 拡張ファイル(Phase 24)のファイル名: <職種ID>.ext-<任意の名前>.md。ベースの原稿(<職種ID>.md)とは別に、
// 同じ職種へ、語を追加できる(job_id と items だけを持つ。軽い形は vocab-validate.mjs の EXTENSION_META_KEYS)
const EXT_FILE_PATTERN = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.ext-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

/**
 * 原稿の一覧: [{ name(職種 id), file(相対パス), text, kind("base" | "ext") }]。
 * ベースのファイル名は、職種の id.md。拡張ファイルは、<職種ID>.ext-<名前>.md(1 職種に何個でも)。
 */
export function loadSources(root) {
  const dir = join(root, SOURCE_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => {
      const ext = name.match(EXT_FILE_PATTERN);
      return {
        name: ext ? ext[1] : name.slice(0, -".md".length),
        file: `${SOURCE_DIR}/${name}`,
        text: readText(join(dir, name)),
        kind: ext ? "ext" : "base",
      };
    });
}

/**
 * 原稿を、すべて読み取って、検証する(下書きも含める)。
 * context: { jobs, roleIds, difficultyIds }。戻り値: { files: [{ name, file, data }], errors }。
 * 問題は、ファイルごとにまとめて、すべて集める。1 職種につき、ベースの原稿(<職種ID>.md)は 1 つ必須。
 * 拡張ファイル(<職種ID>.ext-<名前>.md)は、何個でもよく、job_id と items だけを持つ(Phase 24)。
 * ベース + すべての拡張ファイルの items をマージしてから、既存の validateVocabulary に、まとめて通す
 * (id・日本語・読みの重複、関連用語の参照は、ベース・拡張ファイルをまたいで検査される)。
 */
export function readSources(sources, context) {
  const files = [];
  const errors = [];

  // 個別に YAML を読み取る(壊れていれば、その原稿の分だけ諦め、ほかは続ける)
  const parsed = [];
  for (const source of sources) {
    try {
      parsed.push({ source, raw: parseVocabularyMarkdown(source.text) });
    } catch (error) {
      errors.push(`${source.file}: ${error.message}`);
    }
  }

  // 職種(name)ごとに、ベースと拡張ファイルへ分ける
  const byJob = new Map();
  for (const entry of parsed) {
    const bucket = byJob.get(entry.source.name) ?? { base: null, exts: [] };
    if (entry.source.kind === "ext") bucket.exts.push(entry);
    else bucket.base = entry;
    byJob.set(entry.source.name, bucket);
  }

  for (const [name, { base, exts }] of byJob) {
    if (!base) {
      // ベースの原稿がない(拡張ファイルだけがある)。それぞれ、単独では検証できない
      for (const ext of exts) {
        errors.push(
          `${ext.source.file}: 対応するベースの原稿(${SOURCE_DIR}/${name}.md)がありません`,
        );
      }
      continue;
    }

    // 拡張ファイルは、job_id と items だけ(それ以外を書いていないか・items が語の一覧か)を確かめてから、
    // ベースの items に追加する
    const mergedItems = Array.isArray(base.raw?.items) ? [...base.raw.items] : [];
    for (const ext of exts) {
      const raw = ext.raw;
      const extraKeys = Object.keys(raw ?? {}).filter((key) => !EXTENSION_META_KEYS.includes(key));
      if (extraKeys.length > 0) {
        errors.push(
          `${ext.source.file}: 拡張ファイルには job_id と items だけを書いてください(version 等は、ベースの原稿にだけ書きます。未知の項目: ${extraKeys.join(", ")})`,
        );
      }
      if (raw?.job_id !== name) {
        errors.push(
          `${ext.source.file}: job_id は、ファイル名に対応するベースの原稿と同じ "${name}" にしてください`,
        );
      }
      if (!Array.isArray(raw?.items) || raw.items.length === 0) {
        errors.push(`${ext.source.file}: items は、語の一覧(1 語以上)にしてください`);
      } else {
        mergedItems.push(...raw.items);
      }
    }

    const mergedRaw = { ...base.raw, items: mergedItems };
    const { errors: problems, data } = validateVocabulary(mergedRaw, context);
    const allFiles = [base.source.file, ...exts.map((ext) => ext.source.file)].join(" + ");
    for (const message of problems) errors.push(`${allFiles}: ${message}`);
    if (data && data.job_id !== name) {
      errors.push(
        `${allFiles}: ファイル名(${name}.md)と job_id(${data.job_id})を、そろえてください`,
      );
    }
    files.push({ name, file: base.source.file, data });
  }

  errors.push(...validateAcross(files.map(({ file, data }) => ({ name: file, data }))));
  // jobs.json にある職種の、ベースの原稿が、そろっているか
  const baseSources = sources.filter((source) => source.kind !== "ext");
  for (const job of context.jobs) {
    if (!baseSources.some((source) => source.name === job.id)) {
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

/** jobs.json・roles.json・difficulties.json から、検証の文脈を作る。 */
export function loadContext(root) {
  const jobs = JSON.parse(readText(join(root, "public/data/jobs.json")));
  const roles = JSON.parse(readText(join(root, "public/data/roles.json")));
  const difficulties = JSON.parse(readText(join(root, "public/data/difficulties.json")));
  return {
    jobs,
    roleIds: roles.map((role) => role.id),
    difficultyIds: difficulties.map((difficulty) => difficulty.id),
  };
}
