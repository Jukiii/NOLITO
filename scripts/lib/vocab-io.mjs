// 語録・確認メモのファイルの読み込み(運営者用のスクリプトと、テストが使う)。
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
export const paths = {
  vocabulary: `${root}public/data/vocabulary/`,
  jobs: `${root}public/data/jobs.json`,
  notes: `${root}docs/vocabulary-review-notes.json`,
  sheet: `${root}docs/vocabulary-review.md`,
};

// Windows の作業コピーは、改行が CRLF になる(git の設定による)。LF にそろえて読む
const readText = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");

/** jobs.json の順に、すべての職種の語録を読む。 */
export function loadVocabularies() {
  const jobs = JSON.parse(readText(paths.jobs));
  const files = new Set(readdirSync(paths.vocabulary));
  return jobs.map((job) => {
    const file = `${job.id}.json`;
    if (!files.has(file)) throw new Error(`語録がありません: ${file}`);
    return JSON.parse(readText(`${paths.vocabulary}${file}`));
  });
}

export const loadNotes = () => JSON.parse(readText(paths.notes));
export const readSheet = () => readText(paths.sheet);
