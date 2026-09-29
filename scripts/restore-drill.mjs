// バックアップの復元練習(運営者用。Phase 27 PR4)。使い捨てのD1をCloudflareに作り、
// 見本(既定)または実際のバックアップを読み込んで、テーブルごとの件数を、実際のCloudflare D1で
// 確認してから、使い捨てのD1を削除する。**本番のD1には、いっさい触れない**(新しく作って、消すだけ)。
//   npm run backup:restore-drill                        … 見本のデータ(tests/fixtures/d1-export-sample.sql)で練習
//   npm run backup:restore-drill -- --file <SQLファイル>  … 実際のバックアップで、あらためて確認したいとき
// 事前: npx wrangler login(初回だけ)。docs/backup.md §5「復元の練習」を、この1コマンドで行える。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { migrationTables } from "./lib/backup.mjs";
import { verifyDump } from "./lib/backup-verify.mjs";
import {
  captureWranglerAccountLevel,
  captureWranglerD1,
  runWranglerD1,
} from "./lib/wrangler-remote.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

function parseArgs(argv) {
  const options = { file: `${root}tests/fixtures/d1-export-sample.sql` };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--file") options.file = argv[++i];
    else throw new Error(`知らないオプションです: ${argv[i]}`);
  }
  return options;
}

/** `wrangler d1 create` の出力から、作った D1 の ID を取り出す。 */
function parseDatabaseId(stdout) {
  const match = stdout.match(/database_id\s*=\s*"([0-9a-f-]{36})"/i);
  if (!match) throw new Error("wrangler の出力から、作った D1 の ID を読み取れませんでした。");
  return match[1];
}

/** `wrangler d1 execute ... --json` の、SELECT COUNT(*) の結果を取り出す。 */
function parseCount(stdout) {
  const start = stdout.indexOf("[");
  const end = stdout.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error("wrangler の出力を読めませんでした。");
  const [entry] = JSON.parse(stdout.slice(start, end + 1));
  return entry?.results?.[0]?.n ?? null;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const sql = readFileSync(options.file, "utf8");
  const tables = migrationTables(`${root}migrations`);

  // 先に、メモリ上で読み込めるかを確かめる(壊れたファイルのために、使い捨てのD1を作らない)
  const { problems } = verifyDump(sql, tables);
  if (problems.length > 0) {
    console.error("このファイルは、復元できません(使い捨てのD1は作りません):");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  const name = `nolito-restore-drill-${Date.now()}`;
  console.log(`使い捨てのD1「${name}」を、Cloudflareに作ります…`);
  const created = captureWranglerAccountLevel(["create", name]);
  if (created.status !== 0) throw new Error("D1の作成に失敗しました。");
  const databaseId = parseDatabaseId(created.stdout);
  console.log(`作成しました(id: ${databaseId})。バックアップを読み込みます…`);

  try {
    const loadStatus = runWranglerD1(
      ["execute", name, "--remote", "--file", options.file, "--yes"],
      databaseId,
      name,
    );
    if (loadStatus !== 0) throw new Error("バックアップの読み込みに失敗しました。");

    console.log("\n件数の確認(見本上の想定ではなく、実際のCloudflare D1に問い合わせて確認):");
    let failed = false;
    for (const table of tables) {
      const result = captureWranglerD1(
        [
          "execute",
          name,
          "--remote",
          "--command",
          `SELECT COUNT(*) AS n FROM "${table}"`,
          "--json",
        ],
        databaseId,
        name,
      );
      if (result.status !== 0) {
        failed = true;
        console.error(`  ${table}: 確認できませんでした`);
        continue;
      }
      console.log(`  ${table}: ${parseCount(result.stdout)} 件`);
    }
    if (failed) throw new Error("一部のテーブルを確認できませんでした。");
    console.log("\n復元の練習に、成功しました(実際のCloudflare D1への読み込みで確認済み)。");
  } finally {
    console.log(`\n使い捨てのD1「${name}」を削除します…`);
    const deleted = captureWranglerAccountLevel(["delete", name, "-y"]);
    if (deleted.status !== 0) {
      console.error(
        `削除に失敗しました。Cloudflareのダッシュボードから、手動で「${name}」を削除してください。`,
      );
    } else {
      console.log("削除しました。");
    }
  }
} catch (cause) {
  console.error(`エラー: ${cause.message}`);
  process.exit(1);
}
