// 公開したサイトの簡易チェック(デプロイ後・ロールバック後の確認)。
//   npm run smoke -- https://nolito.pages.dev
// 主要なページが開けること、API が JSON を返すこと、アクセス解析が同意の前に読み込まれないことなどを見る。
import { runSmoke } from "./lib/smoke.mjs";

try {
  const target = process.argv[2];
  if (!target)
    throw new Error("URL を指定してください。使い方: npm run smoke -- https://nolito.pages.dev");
  const results = await runSmoke(target);
  for (const result of results) {
    const mark = result.ok ? "OK " : "NG ";
    const slow = result.slow ? "(遅い)" : "";
    console.log(`${mark} ${result.path}  ${result.ms}ms${slow}`);
    for (const problem of result.problems) console.log(`      - ${problem}`);
  }
  const failed = results.filter((result) => !result.ok).length;
  if (failed > 0) {
    console.error(`${failed} 件に問題があります。`);
    process.exit(1);
  }
  console.log("問題は見つかりませんでした。");
} catch (cause) {
  console.error(`エラー: ${cause.message}`);
  process.exit(1);
}
