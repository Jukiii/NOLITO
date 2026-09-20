// 本物の D1 に対する wrangler の実行(運営者用)。
// wrangler.toml の ID はダミーなので、本物の ID から、一時的な設定ファイルを作って、渡す(終わったら、消す)。
// 認証は、wrangler に任せる(初回は、`npx wrangler login`。トークンは、このリポジトリに置かない)。
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wranglerConfig } from "./backup.mjs";

const wranglerJs = fileURLToPath(
  new URL("../../node_modules/wrangler/bin/wrangler.js", import.meta.url),
);

/** wrangler d1 <args...> を実行する。端末に、そのまま出力する(ログインなどの対話に、対応するため)。 */
export function runWranglerD1(args, databaseId) {
  const dir = mkdtempSync(path.join(tmpdir(), "nolito-wrangler-"));
  try {
    const config = path.join(dir, "wrangler.toml");
    writeFileSync(config, wranglerConfig(databaseId));
    const result = spawnSync(process.execPath, [wranglerJs, "d1", ...args, "--config", config], {
      stdio: "inherit",
    });
    return result.status ?? 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** wrangler d1 <args...> を実行して、標準出力を受け取る(問い合わせの読み取りなど)。エラーの表示は、そのまま端末に出す。 */
export function captureWranglerD1(args, databaseId) {
  const dir = mkdtempSync(path.join(tmpdir(), "nolito-wrangler-"));
  try {
    const config = path.join(dir, "wrangler.toml");
    writeFileSync(config, wranglerConfig(databaseId));
    const result = spawnSync(process.execPath, [wranglerJs, "d1", ...args, "--config", config], {
      stdio: ["inherit", "pipe", "inherit"],
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    return { status: result.status ?? 1, stdout: result.stdout ?? "" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
