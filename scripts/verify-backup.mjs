// バックアップ(SQL ファイル)が、復元できるかを、確かめる(メモリ上。ファイルには、何も書かない)。
//   npm run backup:verify -- <バックアップのファイル>
// 表示するのは、テーブル名と件数だけ(中身は、出さない)。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { migrationTables } from "./lib/backup.mjs";
import { verifyDump } from "./lib/backup-verify.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

try {
  const file = process.argv[2];
  if (!file)
    throw new Error(
      "ファイルを指定してください。使い方: npm run backup:verify -- <バックアップのファイル>",
    );
  const { tables, problems } = verifyDump(
    readFileSync(file, "utf8"),
    migrationTables(`${root}migrations`),
  );
  for (const [name, count] of Object.entries(tables)) console.log(`${name}: ${count} 件`);
  if (problems.length > 0) {
    console.error("問題があります:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log("問題は見つかりませんでした(復元できます)。");
} catch (cause) {
  console.error(`エラー: ${cause.message}`);
  process.exit(1);
}
