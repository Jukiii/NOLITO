// 依存の脆弱性チェック(npm run audit)。`npm audit` の high 以上で止める。
// ただし、scripts/lib/audit-allow.mjs の ALLOWED_ADVISORIES にある勧告は、期限まで除外する(決定ログ 0077)。
import { spawnSync } from "node:child_process";
import { evaluateAudit } from "./lib/audit-allow.mjs";

const result = spawnSync("npm audit --json", {
  encoding: "utf8",
  shell: true,
  maxBuffer: 64 * 1024 * 1024,
});

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error("エラー: npm audit の結果を読めませんでした(ネットワークなど)。");
  console.error(result.stderr || result.stdout);
  process.exit(1);
}
if (report.error) {
  console.error(`エラー: npm audit が失敗しました: ${report.error.summary ?? report.error.code}`);
  process.exit(1);
}

const { blocking, ignored, expired, ok } = evaluateAudit(report);
for (const item of ignored) {
  console.log(`除外中(${item.until} まで): ${item.id} ${item.name} - ${item.reason}`);
}
for (const item of expired) {
  console.error(`除外の期限切れ(${item.until}): ${item.id} ${item.name} - ${item.title}`);
}
for (const item of blocking) {
  console.error(`${item.severity}: ${item.id} ${item.name} - ${item.title}`);
}
if (!ok) {
  console.error("\n依存に、除外されていない high 以上の脆弱性があります。");
  process.exit(1);
}
console.log("依存の脆弱性チェック: 問題なし(high 以上で、除外されていないものはありません)。");
