// プロダクトの詳細ページ(products.json の detail_path があるもの)を、public/ に生成する。
//   node scripts/build-products.mjs           … 書き出す
//   node scripts/build-products.mjs --check   … 書き出さず、生成物がデータと一致しているか検査する
// 生成物はコミットする(Cloudflare Pages のビルドは使わない)。
import { fileURLToPath } from "node:url";
import { buildProductPages } from "./lib/product-pages.mjs";
import {
  checkProductPages,
  formatFiles,
  loadProductInputs,
  writeProductPages,
} from "./lib/product-build.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const publicDir = `${root}public`;
const check = process.argv.includes("--check");

try {
  const files = await formatFiles(buildProductPages(loadProductInputs(publicDir)), root);
  if (check) {
    const problems = checkProductPages(publicDir, files);
    if (problems.length > 0) {
      console.error(
        "詳細ページの生成物が最新ではありません。npm run build:products を実行してください。\n",
      );
      console.error(problems.map((line) => `  - ${line}`).join("\n"));
      process.exit(1);
    }
    console.log(`詳細ページの生成物は最新です(${files.size}ページ)`);
  } else {
    writeProductPages(publicDir, files);
    console.log(`詳細ページを${files.size}ページ、書き出しました`);
  }
} catch (error) {
  console.error(`詳細ページのビルドに失敗しました。\n\n${error.message}`);
  process.exit(1);
}
