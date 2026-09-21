// 語録のファイルの読み込み(運営者用のスクリプトと、テストが使う)。
//   loadVocabularies()       … 公開している語録(public/data/vocabulary/*.json)。ゲームが読むもの
//   loadSourceVocabularies() … 語録の原稿(content/vocabulary/*.md)。下書き・確認の状況・確認メモを含む
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadContext, loadSources, readSources } from "./vocab-build.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
export const paths = {
  root,
  vocabulary: `${root}public/data/vocabulary/`,
  jobs: `${root}public/data/jobs.json`,
  sheet: `${root}docs/vocabulary-review.md`,
};

// Windows の作業コピーは、改行が CRLF になる(git の設定による)。LF にそろえて読む
const readText = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");

/** jobs.json の順に、すべての職種の(公開している)語録を読む。 */
export function loadVocabularies() {
  const jobs = JSON.parse(readText(paths.jobs));
  const files = new Set(readdirSync(paths.vocabulary));
  return jobs.map((job) => {
    const file = `${job.id}.json`;
    if (!files.has(file)) throw new Error(`語録がありません: ${file}`);
    return JSON.parse(readText(`${paths.vocabulary}${file}`));
  });
}

/**
 * jobs.json の順に、すべての職種の語録の原稿を、読み取って検証したものを返す(下書きも含む)。
 * 各項目は、公開の項目に、review・draft・note を加えた形。原稿に問題があれば、Error(すべての問題をまとめる)。
 */
export function loadSourceVocabularies() {
  const context = loadContext(root);
  const { files, errors } = readSources(loadSources(root), context);
  if (errors.length > 0)
    throw new Error(
      `語録の原稿に問題があります:\n${errors.map((line) => `  - ${line}`).join("\n")}`,
    );
  return context.jobs.map((job) => files.find((file) => file.name === job.id).data);
}

/** 確認メモ: { 語の id: 「確認してほしい点」 }。原稿の note から作る。 */
export const loadNotes = () =>
  Object.fromEntries(
    loadSourceVocabularies().flatMap((data) =>
      data.items.filter((item) => item.note).map((item) => [item.id, item.note]),
    ),
  );

export const readSheet = () => readText(paths.sheet);
