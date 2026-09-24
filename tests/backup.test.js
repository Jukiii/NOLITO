// D1 のバックアップ(運営者用スクリプト)のテスト。本物の D1 には、通信しない。
// 見本(tests/fixtures/d1-export-sample.sql)は、本物の `wrangler d1 export` の出力(作り物のデータ)。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  PLACEHOLDER_ID,
  assertOutsideRepo,
  backupFileName,
  isInside,
  migrationTables,
  splitIdOption,
  validateDatabaseId,
  wranglerConfig,
} from "../scripts/lib/backup.mjs";
import { verifyDump } from "../scripts/lib/backup-verify.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
// Windows の作業コピーは、改行が CRLF になる(git の設定による)。LF にそろえて読む
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const sample = read(`${root}tests/fixtures/d1-export-sample.sql`);
const REAL_ID = "0b1c2d3e-4f50-4162-8394-a5b6c7d8e9f0";
const required = migrationTables(`${root}migrations`);

const run = (script, args = [], env = {}) =>
  spawnSync(process.execPath, [`${root}scripts/${script}`, ...args], {
    encoding: "utf8",
    env: { ...process.env, NOLITO_D1_DATABASE_ID: "", ...env },
  });

describe("D1 の ID", () => {
  it("正しい UUID を通し、小文字にそろえる", () => {
    assert.equal(validateDatabaseId(REAL_ID), REAL_ID);
    assert.equal(validateDatabaseId(` ${REAL_ID.toUpperCase()} `), REAL_ID);
  });

  it("ない・形が違う・ダミー(wrangler.toml のもの)は、断る", () => {
    for (const bad of [undefined, null, "", "abc", REAL_ID.slice(1), `${REAL_ID}0`, 123]) {
      assert.throws(() => validateDatabaseId(bad), /Database ID/, String(bad));
    }
    assert.throws(() => validateDatabaseId(PLACEHOLDER_ID), /ダミー/);
  });

  it("wrangler.toml の ID は、ダミーのまま(本物の ID は、コミットしていない)", () => {
    assert.match(readFileSync(`${root}wrangler.toml`, "utf8"), new RegExp(PLACEHOLDER_ID));
  });
});

describe("--id オプション", () => {
  const OTHER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

  it("--id を取り出し、wrangler に渡す引数からは除く", () => {
    assert.deepEqual(
      splitIdOption(
        ["execute", "nolito", "--remote", "--id", OTHER_ID, "--file", "b.sql"],
        REAL_ID,
      ),
      { args: ["execute", "nolito", "--remote", "--file", "b.sql"], id: OTHER_ID },
    );
  });

  it("--id は、環境変数の ID より優先される(本番への誤った読み込みを防ぐ)。なければ、環境変数", () => {
    assert.equal(splitIdOption(["--id", OTHER_ID], REAL_ID).id, OTHER_ID);
    assert.equal(splitIdOption(["time-travel", "info", "nolito"], REAL_ID).id, REAL_ID);
    assert.equal(splitIdOption([], undefined).id, undefined);
  });

  it("--id の値がなければ、ID なしとして扱い、検査で断る", () => {
    assert.throws(
      () => validateDatabaseId(splitIdOption(["info", "--id"], REAL_ID).id),
      /Database ID/,
    );
  });
});

describe("一時的な wrangler の設定", () => {
  it("D1 の名前・バインディング・ID を含む", () => {
    const config = wranglerConfig(REAL_ID);
    assert.match(config, /database_name = "nolito"/);
    assert.match(config, /binding = "DB"/);
    assert.match(config, new RegExp(`database_id = "${REAL_ID}"`));
  });

  it("pages_build_output_dir を含まない(Cloudflare の設定を、上書きしない)。ダミーの ID では作れない", () => {
    assert.ok(!wranglerConfig(REAL_ID).includes("pages_build_output_dir"));
    assert.throws(() => wranglerConfig(PLACEHOLDER_ID));
    assert.throws(() => wranglerConfig('x"; malicious = "1'));
  });
});

describe("ファイル名・保存先", () => {
  it("ファイル名は UTC の時刻で、並べると時間順になる", () => {
    const name = backupFileName(new Date("2026-09-20T15:30:05.123Z"));
    assert.equal(name, "nolito-d1-20260920T153005Z.sql");
    assert.ok(backupFileName(new Date("2026-09-21T00:00:00Z")) > name);
    assert.match(backupFileName(), /^nolito-d1-\d{8}T\d{6}Z\.sql$/);
  });

  it("リポジトリの中は断る(個人情報のコミットを防ぐ)。外は通す", () => {
    for (const inside of [
      root,
      `${root}backups`,
      `${root}docs/../public`,
      path.join(root, "a", "b"),
    ]) {
      assert.throws(() => assertOutsideRepo(inside, root), /リポジトリの中/, inside);
    }
    const parent = path.dirname(path.resolve(root));
    for (const outside of [
      parent,
      `${path.resolve(root)}-backups`, // 名前が、同じ文字で始まるだけの、別の場所
      path.join(parent, "elsewhere"),
      path.join(homedir(), "nolito-backups"),
    ]) {
      assert.doesNotThrow(() => assertOutsideRepo(outside, root), outside);
    }
  });

  it("isInside は、パスの区切りで判定する(接頭辞の一致だけでは、中とみなさない)", () => {
    assert.equal(isInside("/a/b/c", "/a/b"), true);
    assert.equal(isInside("/a/b", "/a/b"), true);
    assert.equal(isInside("/a/bc", "/a/b"), false);
    assert.equal(isInside("/a", "/a/b"), false);
  });

  it("保存先を、Git の対象外にしている(うっかり置いたときの保険)", () => {
    const ignore = read(`${root}.gitignore`);
    assert.match(ignore, /^nolito-d1-\*\.sql$/m);
    assert.match(ignore, /^backups\/$/m);
    // 検査用の見本は、対象外にしない(コミットする)
    assert.ok(!"tests/fixtures/d1-export-sample.sql".match(/nolito-d1-.*\.sql/));
  });
});

describe("バックアップの検査(メモリ上の SQLite に読み込む)", () => {
  it("本物の wrangler の出力を、読み込める。件数が合う", () => {
    const { tables, problems } = verifyDump(sample, required);
    assert.deepEqual(problems, []);
    assert.deepEqual(tables, {
      audit_log: 2,
      d1_migrations: 5,
      game_progress: 1,
      inquiries: 2,
      licenses: 2,
      ranking_entries: 1,
      rate_limits: 0,
      sessions: 1,
      users: 2,
    });
  });

  it("migrations/ のすべてのテーブルが、バックアップにある", () => {
    assert.deepEqual([...required].sort(), [
      "audit_log",
      "game_progress",
      "inquiries",
      "licenses",
      "ranking_entries",
      "rate_limits",
      "sessions",
      "users",
    ]);
  });

  it("引用符・日本語・NULL・文中のセミコロンを含む値も、そのまま復元される", async () => {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(":memory:");
    db.exec(`BEGIN;${sample}COMMIT;`);
    assert.equal(
      db.prepare("SELECT nickname FROM users WHERE id = 'u1'").get().nickname,
      "たろう's",
    );
    assert.equal(
      db.prepare("SELECT detail FROM audit_log WHERE id = 2").get().detail,
      "line1 with ; semicolon",
    );
    assert.equal(db.prepare("SELECT user_id FROM audit_log WHERE id = 2").get().user_id, null);
    assert.equal(
      db.prepare("SELECT redeemed_at FROM licenses WHERE id = 'l2'").get().redeemed_at,
      null,
    );
    db.close();
  });

  it("空・空白だけは、問題", () => {
    for (const empty of ["", "  \n ", undefined, null]) {
      assert.match(verifyDump(empty, required).problems[0], /空/);
    }
  });

  it("途中で途切れたバックアップは、問題(復元できるように、見せかけない)", () => {
    const truncated = sample.slice(0, sample.indexOf('INSERT INTO "licenses"') + 40);
    const { problems } = verifyDump(truncated, required);
    assert.ok(problems.length > 0);
    assert.match(problems[0], /実行できません/);
  });

  it("テーブルが欠けていたら、問題", () => {
    const without = sample
      .replace(/CREATE TABLE licenses \([\s\S]*?\);\n/, "") // 定義(複数行)を、丸ごと除く
      .split("\n")
      .filter((line) => !line.includes("licenses"))
      .join("\n");
    assert.ok(!without.includes("CREATE TABLE licenses"));
    const { problems } = verifyDump(without, required);
    assert.deepEqual(problems, ["テーブルが、ありません: licenses"]);
  });

  it("参照先のない行(外部キー違反)は、問題", () => {
    const broken = sample.replace(
      "VALUES('hash1','u1',1000,2000);",
      "VALUES('hash1','no-such-user',1000,2000);",
    );
    const { problems } = verifyDump(broken, required);
    assert.ok(problems.length > 0);
  });

  it("外部キーは、最後にまとめて検査される(参照される行より前に、参照する行があっても、通る)", () => {
    const sql = [
      "PRAGMA defer_foreign_keys=TRUE;",
      "CREATE TABLE users (id TEXT PRIMARY KEY);",
      "CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id));",
      "INSERT INTO sessions VALUES('s1','u1');",
      "INSERT INTO users VALUES('u1');",
    ].join("\n");
    assert.deepEqual(verifyDump(sql).problems, []);
    // 最後まで、参照先がなければ、問題
    const orphan = sql.replace("INSERT INTO users VALUES('u1');", "");
    assert.ok(verifyDump(orphan).problems.length > 0);
  });
});

describe("コマンド", () => {
  it("backup:verify: 見本を検査して、件数だけを表示する(中身は、出さない)", () => {
    const result = run("verify-backup.mjs", [`${root}tests/fixtures/d1-export-sample.sql`]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /users: 2 件/);
    assert.match(result.stdout, /licenses: 2 件/);
    assert.match(result.stdout, /復元できます/);
    for (const secret of [
      "alice@example.com",
      "bob@example.com",
      "reporter@example.com",
      "sample message",
      "kh1",
      "hash1",
      "たろう",
    ]) {
      assert.ok(!result.stdout.includes(secret), secret);
      assert.ok(!result.stderr.includes(secret), secret);
    }
  });

  it("backup:verify: ファイルなし・壊れたファイルは、エラー終了", () => {
    assert.equal(run("verify-backup.mjs").status, 1);
    assert.equal(run("verify-backup.mjs", [`${root}no-such-file.sql`]).status, 1);
    assert.equal(run("verify-backup.mjs", [`${root}package.json`]).status, 1);
  });

  it("backup:d1: D1 の ID がなければ、wrangler を呼ぶ前に、エラー終了", () => {
    const result = run("backup-d1.mjs");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /NOLITO_D1_DATABASE_ID/);
  });

  it("backup:d1: ダミーの ID・リポジトリの中の保存先・知らないオプションは、断る", () => {
    assert.match(run("backup-d1.mjs", ["--id", PLACEHOLDER_ID]).stderr, /ダミー/);
    const inside = run("backup-d1.mjs", ["--id", REAL_ID, "--out", `${root}backups`]);
    assert.equal(inside.status, 1);
    assert.match(inside.stderr, /リポジトリの中/);
    assert.equal(run("backup-d1.mjs", ["--bogus"]).status, 1);
  });

  it("d1:remote: 引数・ID がなければ、エラー終了", () => {
    assert.equal(run("d1-remote.mjs").status, 1);
    assert.match(
      run("d1-remote.mjs", ["time-travel", "info", "nolito"]).stderr,
      /NOLITO_D1_DATABASE_ID/,
    );
  });

  it("npm のスクリプトが、登録されている", () => {
    const scripts = JSON.parse(readFileSync(`${root}package.json`, "utf8")).scripts;
    assert.equal(scripts["backup:d1"], "node scripts/backup-d1.mjs");
    assert.equal(scripts["backup:verify"], "node scripts/verify-backup.mjs");
    assert.equal(scripts["d1:remote"], "node scripts/d1-remote.mjs");
  });

  it("スクリプトは、バックアップを外へ送らない(wrangler の書き出しと、ローカルの検査だけ)", () => {
    const sources = [
      "backup-d1.mjs",
      "verify-backup.mjs",
      "d1-remote.mjs",
      "lib/backup.mjs",
      "lib/backup-verify.mjs",
      "lib/wrangler-remote.mjs",
    ]
      .map((name) => read(`${root}scripts/${name}`).replace(/\/\/.*$/gm, ""))
      .join("\n");
    assert.ok(!/fetch\(|https?:\/\/|XMLHttpRequest|net\.connect|WebSocket/.test(sources));
  });
});
