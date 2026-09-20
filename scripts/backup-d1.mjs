// 本番の D1 を、SQL ファイルに書き出す(運営者用。あなたのパソコンで実行する)。
//   npm run backup:d1                       … ホームフォルダの nolito-backups/ に保存
//   npm run backup:d1 -- --out D:/backups   … 保存先を指定(リポジトリの外だけ)
//   npm run backup:d1 -- --id <Database ID> … ID を、環境変数の代わりに渡す
// 事前: 1) npx wrangler login(初回だけ)  2) 環境変数 NOLITO_D1_DATABASE_ID(Cloudflare の D1 → nolito の Database ID)
// 書き出したあと、SQL として復元できるかを、メモリ上で確かめる(中身は、表示しない)。
// バックアップには、メールアドレスなどの個人情報が入る。GitHub に置かない。詳細: docs/backup.md
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertOutsideRepo,
  backupFileName,
  migrationTables,
  validateDatabaseId,
  DATABASE_NAME,
} from "./lib/backup.mjs";
import { verifyDump } from "./lib/backup-verify.mjs";
import { runWranglerD1 } from "./lib/wrangler-remote.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

function parseArgs(argv) {
  const options = {
    out: path.join(homedir(), "nolito-backups"),
    id: process.env.NOLITO_D1_DATABASE_ID,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") options.out = argv[++i] ?? "";
    else if (argv[i] === "--id") options.id = argv[++i];
    else throw new Error(`知らないオプションです: ${argv[i]}`);
  }
  return options;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const databaseId = validateDatabaseId(options.id);
  assertOutsideRepo(options.out, root);

  mkdirSync(options.out, { recursive: true });
  const file = path.join(path.resolve(options.out), backupFileName());
  console.log(`D1(${DATABASE_NAME})を書き出します: ${file}`);

  const status = runWranglerD1(
    ["export", DATABASE_NAME, "--remote", "--output", file, "--skip-confirmation"],
    databaseId,
  );
  if (status !== 0 || !existsSync(file)) {
    throw new Error(
      `wrangler の書き出しに失敗しました(終了コード ${status})。ログイン(npx wrangler login)と ID を確認してください。`,
    );
  }
  try {
    chmodSync(file, 0o600); // 自分だけが読める(Windows では、効かない)
  } catch {
    // 権限を変えられない環境でも、書き出しは、成功として扱う
  }

  const { tables, problems } = verifyDump(
    readFileSync(file, "utf8"),
    migrationTables(`${root}migrations`),
  );
  console.log(`\n保存しました: ${file}(${statSync(file).size} バイト)`);
  console.log("復元の確認(メモリ上で読み込み。件数だけ表示):");
  for (const [name, count] of Object.entries(tables)) console.log(`  ${name}: ${count} 件`);
  if (problems.length > 0) {
    console.error("\n問題があります。このバックアップは、復元できない可能性があります:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log("\n問題は見つかりませんでした。");
  console.log(
    "注意: このファイルには、メールアドレスなどの個人情報が入っています。GitHub・チャットに置かず、安全な場所に保管してください。古いものは、削除してください。",
  );
} catch (cause) {
  console.error(`エラー: ${cause.message}`);
  process.exit(1);
}
