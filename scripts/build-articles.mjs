// 記事の原稿(content/articles/*.md)から、公開する HTML とデータ(public/articles/, public/data/articles.json)を作る。
//   node scripts/build-articles.mjs           … 書き出す
//   node scripts/build-articles.mjs --check   … 書き出さず、生成物が原稿と一致しているか検査する
// 生成物はコミットする(Cloudflare Pages のビルドは使わない)。
import { fileURLToPath } from "node:url";
import { buildOutputs, checkOutputs, loadSite, loadSources, writeOutputs } from "./lib/build.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const publicDir = `${root}public`;
const check = process.argv.includes("--check");

try {
  const site = loadSite(publicDir);
  const { files, articles } = buildOutputs(loadSources(`${root}content/articles`), site);

  if (check) {
    const problems = checkOutputs(publicDir, files);
    if (problems.length > 0) {
      console.error(
        `記事の生成物が最新ではありません。npm run build:articles を実行してください。\n`,
      );
      console.error(problems.map((line) => `  - ${line}`).join("\n"));
      process.exit(1);
    }
    console.log(`記事の生成物は最新です(${articles.length}本)`);
  } else {
    writeOutputs(publicDir, files);
    console.log(`記事を${articles.length}本、書き出しました`);
  }
} catch (error) {
  console.error(`記事のビルドに失敗しました。\n\n${error.message}`);
  process.exit(1);
}
