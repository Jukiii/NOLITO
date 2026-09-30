// 手元の古い D1 バックアップを、整理する(運営者用。あなたのパソコンで実行する)。
//   npm run backup:prune                     … 消す候補を表示するだけ(何も消さない)
//   npm run backup:prune -- --delete         … 直近6か月より古いバックアップを、実際に消す
//   npm run backup:prune -- --out D:/backups … 保存先を指定(backup:d1 と同じ既定: ホームフォルダの nolito-backups)
// 対象は、保存先の直下の nolito-d1-<日時>.sql だけ(名前の日時で判断する。ほかのファイル・フォルダには触れない)。
// いちばん新しい1つは、期限を過ぎていても残す。ファイルの中身は、読まない・表示しない。詳細: docs/backup.md
import { existsSync, lstatSync, readdirSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertOutsideRepo } from "./lib/backup.mjs";
import { RETENTION_MONTHS, planPrune } from "./lib/backup-retention.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

function parseArgs(argv) {
  const options = { out: path.join(homedir(), "nolito-backups"), del: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") options.out = argv[++i] ?? "";
    else if (argv[i] === "--delete") options.del = true;
    else throw new Error(`知らないオプションです: ${argv[i]}`);
  }
  return options;
}

try {
  const options = parseArgs(process.argv.slice(2));
  assertOutsideRepo(options.out, root);
  const dir = path.resolve(options.out);
  if (!existsSync(dir)) throw new Error(`保存先がありません: ${dir}`);

  // シンボリックリンク・フォルダは、対象にしない(リンク先を消さないため)
  const names = readdirSync(dir).filter((name) => {
    const stat = lstatSync(path.join(dir, name));
    return stat.isFile() && !stat.isSymbolicLink();
  });
  const plan = planPrune(names, new Date());

  console.log(`保存先: ${dir}`);
  console.log(
    `期限: ${plan.cutoff.toISOString()} より前(直近 ${RETENTION_MONTHS} か月より古いもの)`,
  );
  console.log(`残す: ${plan.keep.length} 件 / 消す候補: ${plan.remove.length} 件`);
  if (plan.ignored.length > 0) {
    console.log(
      `対象外(バックアップの名前の形ではないので、触りません): ${plan.ignored.length} 件`,
    );
  }
  for (const name of plan.remove) console.log(`  ${options.del ? "削除" : "候補"}: ${name}`);

  if (plan.remove.length === 0) {
    console.log("\n消すものは、ありません。");
  } else if (!options.del) {
    console.log(
      "\n何も消していません。実際に消すには、--delete を付けて、もう一度実行してください。",
    );
  } else {
    for (const name of plan.remove) unlinkSync(path.join(dir, name));
    console.log(`\n${plan.remove.length} 件を削除しました。`);
    console.log(
      "外付けディスク・クラウドに写しを置いている場合は、そちらの古いものも、削除してください。",
    );
  }
} catch (cause) {
  console.error(`エラー: ${cause.message}`);
  process.exit(1);
}
