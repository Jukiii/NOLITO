// 語録の原稿(content/vocabulary/*.md)から、公開する語録(public/data/vocabulary/*.json)を作る。
//   node scripts/build-vocabulary.mjs           … 検証して、書き出す
//   node scripts/build-vocabulary.mjs --check   … 書き出さず、生成物が原稿と一致しているか検査する
// 生成物はコミットする(Cloudflare Pages のビルドは使わない)。下書き(draft: true)は、公開しない。
import { fileURLToPath } from "node:url";
import {
  buildOutputs,
  checkOutputs,
  loadContext,
  loadSources,
  writeOutputs,
} from "./lib/vocab-build.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const check = process.argv.includes("--check");

try {
  const { outputs, files, errors } = await buildOutputs(loadSources(root), loadContext(root));
  if (errors.length > 0) {
    console.error(`語録の原稿に問題があります(${errors.length} 件)。\n`);
    console.error(errors.map((line) => `  - ${line}`).join("\n"));
    process.exit(1);
  }
  const published = files.reduce(
    (sum, { data }) => sum + data.items.filter((item) => !item.draft).length,
    0,
  );
  const drafts = files.reduce(
    (sum, { data }) => sum + data.items.filter((item) => item.draft).length,
    0,
  );
  const summary = `${files.length} 職種・公開 ${published} 語(下書き ${drafts} 語は、公開しません)`;

  if (check) {
    const problems = checkOutputs(root, outputs);
    if (problems.length > 0) {
      console.error(
        "語録の生成物が最新ではありません。npm run build:vocabulary を実行してください。\n",
      );
      console.error(problems.map((line) => `  - ${line}`).join("\n"));
      process.exit(1);
    }
    console.log(`語録の生成物は最新です(${summary})`);
  } else {
    writeOutputs(root, outputs);
    console.log(`語録を書き出しました(${summary})`);
  }
} catch (error) {
  console.error(`語録のビルドに失敗しました。\n\n${error.message}`);
  process.exit(1);
}
