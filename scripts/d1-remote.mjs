// 本物の D1 に、wrangler d1 のコマンドを、そのまま渡す(運営者用)。ID は、--id か、環境変数から(--id が優先)。
//   node scripts/d1-remote.mjs time-travel info nolito
//   node scripts/d1-remote.mjs time-travel restore nolito --timestamp=2026-09-20T12:00:00Z
//   node scripts/d1-remote.mjs execute nolito --remote --file backup.sql --id <新しい D1 の ID>
// 事前: npx wrangler login、環境変数 NOLITO_D1_DATABASE_ID。詳細: docs/backup.md
import { splitIdOption, validateDatabaseId } from "./lib/backup.mjs";
import { runWranglerD1 } from "./lib/wrangler-remote.mjs";

try {
  const { args, id } = splitIdOption(process.argv.slice(2), process.env.NOLITO_D1_DATABASE_ID);
  if (args.length === 0) {
    throw new Error("wrangler d1 に渡すコマンドを指定してください。例: time-travel info nolito");
  }
  process.exit(runWranglerD1(args, validateDatabaseId(id)));
} catch (cause) {
  console.error(`エラー: ${cause.message}`);
  process.exit(1);
}
