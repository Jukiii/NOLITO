// D1 のバックアップ(運営者用)の部品。DOM・ネットワークには触れない(検査と、名前・設定の組み立てだけ)。
// バックアップには、メールアドレスなどの個人情報が入る。GitHub(公開)には、置かない。
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export const DATABASE_NAME = "nolito";
// wrangler.toml のダミー。本物の ID ではないので、リモートの操作には、使えない
export const PLACEHOLDER_ID = "11111111-1111-1111-1111-111111111111";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** D1 の ID(ダッシュボードの D1 → nolito に出る)。不正・ダミーなら、例外。 */
export function validateDatabaseId(id) {
  if (typeof id !== "string" || !UUID.test(id.trim())) {
    throw new Error(
      "D1 の ID が、ありません(または、形が違います)。Cloudflare のダッシュボードの D1 → nolito に出る「Database ID」を、環境変数 NOLITO_D1_DATABASE_ID か --id で渡してください。",
    );
  }
  if (id.trim().toLowerCase() === PLACEHOLDER_ID) {
    throw new Error("wrangler.toml のダミーの ID です。本物の D1 の ID を渡してください。");
  }
  return id.trim().toLowerCase();
}

/** 引数から --id <ID> を取り出す(wrangler には、渡さない)。--id は、環境変数(envId)より優先する。 */
export function splitIdOption(argv, envId) {
  const args = [];
  let id = envId;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--id") id = argv[++i];
    else args.push(argv[i]);
  }
  return { args, id };
}

/** 一時的に使う wrangler の設定(リポジトリの wrangler.toml は、書き換えない。ID を、コミットしない)。 */
export const wranglerConfig = (databaseId) =>
  [
    'name = "nolito-backup"',
    'compatibility_date = "2026-09-01"',
    "",
    "[[d1_databases]]",
    'binding = "DB"',
    `database_name = "${DATABASE_NAME}"`,
    `database_id = "${validateDatabaseId(databaseId)}"`,
    "",
  ].join("\n");

/** nolito-d1-20260920T153000Z.sql(UTC。並べると、時間順になる) */
export function backupFileName(date = new Date()) {
  const stamp = date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return `nolito-d1-${stamp}.sql`;
}

/** child が parent の中(または同じ場所)か。接頭辞が同じだけの別の場所(NOLITO-backups)は、中ではない。 */
export function isInside(child, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/** 保存先が、リポジトリの中だと、うっかりコミットしうる。中なら、例外。 */
export function assertOutsideRepo(outDir, repoRoot) {
  if (isInside(outDir, repoRoot)) {
    throw new Error(
      `保存先がリポジトリの中です: ${path.resolve(outDir)}。バックアップには個人情報が入るので、リポジトリの外(既定: ホームフォルダの nolito-backups)にしてください。`,
    );
  }
}

/** migrations/ に定義されているテーブル名(バックアップに、すべてあるべきもの)。 */
export function migrationTables(migrationsDir) {
  const names = [];
  for (const file of readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    for (const match of sql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"?(\w+)"?/gi)) {
      names.push(match[1]);
    }
  }
  return names;
}
