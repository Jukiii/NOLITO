// ライセンスキーを発行する(運営者用)。
//   node scripts/issue-license.mjs <商品ID> [--count 数] [--note メモ]
// 例: node scripts/issue-license.mjs kii-michi --count 3 --note "テスターへ"
// 表示された SQL を、Cloudflare の D1 の Console に貼って実行すると、キーが使えるようになる。
// キーは、この画面にしか出ない(保存しない)。安全な場所に控えて、渡す。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { issueLicenses } from "./lib/license-issue.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

function parseArgs(argv) {
  const options = { productId: undefined, count: 1, note: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--count") options.count = Number(argv[++i]);
    else if (arg === "--note") options.note = argv[++i] ?? "";
    else if (arg.startsWith("--")) throw new Error(`知らないオプションです: ${arg}`);
    else if (options.productId === undefined) options.productId = arg;
    else throw new Error(`引数が多すぎます: ${arg}`);
  }
  return options;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const products = JSON.parse(readFileSync(`${root}public/data/products.json`, "utf8")).products;
  const { keys, sql } = await issueLicenses({
    ...options,
    now: Math.floor(Date.now() / 1000),
    productIds: products.map((product) => product.id),
  });

  console.log("ライセンスキー(この画面にしか出ません。安全な場所に控えて、渡してください):");
  for (const key of keys) console.log(`  ${key}`);
  console.log("\nD1 の Console に貼る SQL(1 行に 1 文。コメントなし。全部まとめて貼れます):");
  for (const line of sql) console.log(line);
  console.log("\n貼って実行するまで、キーは使えません。");
} catch (cause) {
  console.error(`エラー: ${cause.message}`);
  console.error("使い方: node scripts/issue-license.mjs <商品ID> [--count 数] [--note メモ]");
  process.exit(1);
}
