// 本番の D1 の問い合わせを読む・対応済みにする・古いものを消す(運営者用。あなたのパソコンで実行する)。
//   npm run inquiries                        … 未対応の問い合わせを、新しい順に表示
//   npm run inquiries -- --all               … 対応済みも、表示
//   npm run inquiries -- --done <ID>         … その問い合わせを、対応済みにする
//   npm run inquiries -- --purge             … 消せるもの(対応済みで、180 日たったもの)の件数を表示(消さない)
//   npm run inquiries -- --purge --yes       … それらを、削除する
//   npm run inquiries -- --id <Database ID>  … ID を、環境変数の代わりに渡す
// 事前: npx wrangler login、環境変数 NOLITO_D1_DATABASE_ID。詳細: docs/contact-setup.md
// 問い合わせには、個人情報が入っている。ファイルに書き出さず、端末に表示するだけ。表示の前に、制御文字を無害化する。
import { validateDatabaseId } from "./lib/backup.mjs";
import {
  RETENTION_DAYS,
  formatInquiry,
  listSql,
  markDoneSql,
  parseExecuteJson,
  purgeCountSql,
  purgeSql,
  validateId,
} from "./lib/inquiries.mjs";
import { captureWranglerD1 } from "./lib/wrangler-remote.mjs";

function parseArgs(argv) {
  const options = {
    all: false,
    done: undefined,
    purge: false,
    yes: false,
    id: process.env.NOLITO_D1_DATABASE_ID,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--all") options.all = true;
    else if (arg === "--done") options.done = argv[++i];
    else if (arg === "--purge") options.purge = true;
    else if (arg === "--yes") options.yes = true;
    else if (arg === "--id") options.id = argv[++i];
    else throw new Error(`知らないオプションです: ${arg}`);
  }
  if (options.yes && !options.purge) throw new Error("--yes は、--purge と一緒に使います。");
  if (options.purge && (options.done !== undefined || options.all)) {
    throw new Error("--purge は、ほかのオプションと一緒には使えません。");
  }
  return options;
}

function run(sql, databaseId) {
  const { status, stdout } = captureWranglerD1(
    ["execute", "nolito", "--remote", "--command", sql, "--json"],
    databaseId,
  );
  if (status !== 0) {
    throw new Error(
      "wrangler の実行に失敗しました。ログイン(npx wrangler login)と ID を確認してください。",
    );
  }
  return parseExecuteJson(stdout);
}

try {
  const options = parseArgs(process.argv.slice(2));
  const databaseId = validateDatabaseId(options.id);
  const now = Math.floor(Date.now() / 1000);

  if (options.done !== undefined) {
    validateId(options.done);
    run(markDoneSql(options.done, now), databaseId);
    console.log(
      `対応済みにしました: ${options.done}(すでに対応済みの ID・存在しない ID なら、何も変わりません)`,
    );
  } else if (options.purge) {
    const [{ n }] = run(purgeCountSql(now), databaseId);
    console.log(`削除の対象(対応済みで、${RETENTION_DAYS} 日以上たったもの): ${n} 件`);
    if (n > 0 && options.yes) {
      run(purgeSql(now), databaseId);
      console.log("削除しました。");
    } else if (n > 0) {
      console.log("削除するには、--yes を付けて、もう一度実行してください。");
    }
  } else {
    const rows = run(listSql({ all: options.all }), databaseId);
    if (rows.length === 0)
      console.log(
        options.all ? "問い合わせは、ありません。" : "未対応の問い合わせは、ありません。",
      );
    for (const row of rows) console.log(`\n${formatInquiry(row)}`);
    if (rows.length > 0) {
      console.log(`\n${rows.length} 件。対応が終わったら: npm run inquiries -- --done <ID>`);
    }
  }
} catch (cause) {
  console.error(`エラー: ${cause.message}`);
  process.exit(1);
}
