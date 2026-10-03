// 記事の原稿(content/articles/*.md)を、本番の D1 の articles に取り込む(運営者用。あなたのパソコンで実行する)。
//   npm run articles:import                  … 取り込む記事の一覧を表示するだけ(書き込まない)
//   npm run articles:import -- --yes         … D1 に書き込む(すでにある記事は、上書きしない)
//   npm run articles:import -- --id <Database ID>  … ID を、環境変数の代わりに渡す
// 事前: npx wrangler login、環境変数 NOLITO_D1_DATABASE_ID。何度実行しても、安全(同じスラッグは、飛ばす)。
// 取り込む SQL は、リポジトリの外の一時フォルダに作り、終わったら消す。
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importSql, parseSources, planImport } from "./lib/article-import.mjs";
import { validateDatabaseId } from "./lib/backup.mjs";
import { loadSources } from "./lib/build.mjs";
import { parseExecuteJson } from "./lib/inquiries.mjs";
import { captureWranglerD1, runWranglerD1 } from "./lib/wrangler-remote.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

function parseArgs(argv) {
  const options = { yes: false, id: process.env.NOLITO_D1_DATABASE_ID };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--yes") options.yes = true;
    else if (arg === "--id") options.id = argv[++i];
    else throw new Error(`知らないオプションです: ${arg}`);
  }
  return options;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const databaseId = validateDatabaseId(options.id);
  const articles = parseSources(loadSources(`${root}content/articles`));

  const { status, stdout } = captureWranglerD1(
    ["execute", "nolito", "--remote", "--command", "SELECT slug FROM articles", "--json"],
    databaseId,
  );
  if (status !== 0) {
    throw new Error(
      "wrangler の実行に失敗しました。ログイン(npx wrangler login)と ID、0010 の実行を確認してください。",
    );
  }
  const { toInsert, skipped } = planImport(
    articles,
    parseExecuteJson(stdout).map((row) => row.slug),
  );

  for (const article of toInsert) {
    console.log(`取り込む: ${article.slug}${article.draft ? "(下書き)" : ""}`);
  }
  for (const article of skipped) console.log(`飛ばす(すでにある): ${article.slug}`);
  console.log(`\n取り込む ${toInsert.length} 本 / 飛ばす ${skipped.length} 本`);

  if (toInsert.length === 0) {
    console.log("取り込むものは、ありません。");
  } else if (!options.yes) {
    console.log("書き込むには、--yes を付けて、もう一度実行してください。");
  } else {
    const dir = mkdtempSync(path.join(tmpdir(), "nolito-articles-"));
    try {
      const file = path.join(dir, "import.sql");
      writeFileSync(file, importSql(toInsert, Math.floor(Date.now() / 1000)));
      const code = runWranglerD1(["execute", "nolito", "--remote", "--file", file], databaseId);
      if (code !== 0) throw new Error("取り込みに失敗しました。");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    console.log("取り込みました。本番の /articles/ で、記事が表示されるか確認してください。");
  }
} catch (cause) {
  console.error(`エラー: ${cause.message}`);
  process.exit(1);
}
