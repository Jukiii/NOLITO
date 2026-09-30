// バックアップの世代管理(backup:prune)のテスト。一時フォルダの中だけで動かし、本物のバックアップには触れない。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { cutoffDate, parseBackupName, planPrune } from "../scripts/lib/backup-retention.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const NOW = new Date("2026-09-30T12:00:00Z");

describe("バックアップ名の日時", () => {
  it("backup:d1 の名前から、UTC の時刻を取り出す", () => {
    assert.equal(
      parseBackupName("nolito-d1-20260920T153000Z.sql").toISOString(),
      "2026-09-20T15:30:00.000Z",
    );
  });

  it("名前の形でないもの・存在しない日時は null", () => {
    for (const name of [
      "notes.txt",
      "nolito-d1-20260920T153000Z.sql.bak",
      "x-nolito-d1-20260920T153000Z.sql",
      "nolito-d1-20261320T153000Z.sql",
      "nolito-d1-20260231T000000Z.sql",
      "nolito-d1-20260920T253000Z.sql",
    ]) {
      assert.equal(parseBackupName(name), null, name);
    }
  });
});

describe("期限(6か月前)", () => {
  it("6か月前の同じ日", () => {
    assert.equal(cutoffDate(NOW).toISOString(), "2026-03-30T12:00:00.000Z");
  });

  it("月末は、その月の末日にそろえる(8/31 の 6か月前は 2/28)", () => {
    assert.equal(
      cutoffDate(new Date("2026-08-31T00:00:00Z")).toISOString(),
      "2026-02-28T00:00:00.000Z",
    );
  });

  it("年をまたぐ", () => {
    assert.equal(
      cutoffDate(new Date("2027-03-15T00:00:00Z")).toISOString(),
      "2026-09-15T00:00:00.000Z",
    );
  });
});

describe("planPrune", () => {
  it("期限より古いものだけを消す候補にする。新しいものは、残す(新しい順)", () => {
    const plan = planPrune(
      [
        "nolito-d1-20260101T000000Z.sql",
        "nolito-d1-20260320T000000Z.sql",
        "nolito-d1-20260330T120000Z.sql",
        "nolito-d1-20260901T000000Z.sql",
      ],
      NOW,
    );
    assert.deepEqual(plan.remove, [
      "nolito-d1-20260320T000000Z.sql",
      "nolito-d1-20260101T000000Z.sql",
    ]);
    assert.deepEqual(plan.keep, [
      "nolito-d1-20260901T000000Z.sql",
      "nolito-d1-20260330T120000Z.sql",
    ]);
  });

  it("バックアップの名前でないものは、対象外(消す候補にも、残す一覧にも入れない)", () => {
    const plan = planPrune(["memo.txt", "nolito-d1-20250101T000000Z.sql.bak"], NOW);
    assert.deepEqual(plan.remove, []);
    assert.deepEqual(plan.keep, []);
    assert.deepEqual(plan.ignored.sort(), ["memo.txt", "nolito-d1-20250101T000000Z.sql.bak"]);
  });

  it("すべてが期限切れでも、いちばん新しい1つは残す", () => {
    const plan = planPrune(
      ["nolito-d1-20250101T000000Z.sql", "nolito-d1-20250201T000000Z.sql"],
      NOW,
    );
    assert.deepEqual(plan.keep, ["nolito-d1-20250201T000000Z.sql"]);
    assert.deepEqual(plan.remove, ["nolito-d1-20250101T000000Z.sql"]);
  });

  it("空でも落ちない", () => {
    assert.deepEqual(planPrune([], NOW).remove, []);
  });
});

describe("コマンド backup:prune", () => {
  const run = (args) =>
    spawnSync(process.execPath, [`${root}scripts/prune-backups.mjs`, ...args], {
      encoding: "utf8",
    });

  function makeDir() {
    const dir = mkdtempSync(path.join(tmpdir(), "nolito-prune-"));
    const write = (name, body = "-- dump") => writeFileSync(path.join(dir, name), body);
    write("nolito-d1-20250101T000000Z.sql");
    write("nolito-d1-20250601T000000Z.sql");
    write("nolito-d1-20260920T000000Z.sql");
    write("memo.txt", "大事なメモ");
    mkdirSync(path.join(dir, "nolito-d1-20240101T000000Z.sql.d"));
    return dir;
  }

  it("既定では、何も消さない(候補を表示するだけ)", () => {
    const dir = makeDir();
    try {
      const result = run(["--out", dir]);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /候補: nolito-d1-20250101T000000Z\.sql/);
      assert.match(result.stdout, /何も消していません/);
      assert.ok(existsSync(path.join(dir, "nolito-d1-20250101T000000Z.sql")));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("--delete で、期限切れのバックアップだけを消す。ほかのファイル・フォルダは、残る", () => {
    const dir = makeDir();
    try {
      const result = run(["--out", dir, "--delete"]);
      assert.equal(result.status, 0, result.stderr);
      assert.ok(!existsSync(path.join(dir, "nolito-d1-20250101T000000Z.sql")));
      assert.ok(!existsSync(path.join(dir, "nolito-d1-20250601T000000Z.sql")));
      assert.ok(existsSync(path.join(dir, "nolito-d1-20260920T000000Z.sql")));
      assert.equal(readFileSync(path.join(dir, "memo.txt"), "utf8"), "大事なメモ");
      assert.ok(existsSync(path.join(dir, "nolito-d1-20240101T000000Z.sql.d")));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ファイルの中身は、表示しない", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "nolito-prune-"));
    try {
      writeFileSync(path.join(dir, "nolito-d1-20250101T000000Z.sql"), "secret@example.com");
      writeFileSync(path.join(dir, "nolito-d1-20260920T000000Z.sql"), "secret@example.com");
      const result = run(["--out", dir, "--delete"]);
      assert.ok(!(result.stdout + result.stderr).includes("secret@example.com"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("リポジトリの中・保存先なし・知らないオプションは、エラー終了", () => {
    assert.equal(run(["--out", root]).status, 1);
    assert.equal(run(["--out", path.join(root, "backups")]).status, 1);
    assert.equal(run(["--out", path.join(tmpdir(), "nolito-no-such-dir-xyz")]).status, 1);
    assert.equal(run(["--bogus"]).status, 1);
  });

  it("npm のスクリプトが、登録されている。外へ通信しない", () => {
    const scripts = JSON.parse(readFileSync(`${root}package.json`, "utf8")).scripts;
    assert.equal(scripts["backup:prune"], "node scripts/prune-backups.mjs");
    const sources = ["prune-backups.mjs", "lib/backup-retention.mjs"]
      .map((name) =>
        readFileSync(`${root}scripts/${name}`, "utf8")
          .replaceAll("\r\n", "\n")
          .replace(/\/\/.*$/gm, ""),
      )
      .join("\n");
    assert.ok(!/fetch\(|https?:\/\/|XMLHttpRequest|net\.connect|WebSocket/.test(sources));
  });
});
