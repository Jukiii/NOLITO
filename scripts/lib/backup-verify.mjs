// バックアップ(SQL)が、本当に復元できるかを、メモリ上の SQLite(node:sqlite)に、読み込んで確かめる。
// 本物の D1 も SQLite。ファイルには、何も書かない。表示するのは、テーブル名と件数だけ(中身は出さない)。
import { DatabaseSync } from "node:sqlite";

/**
 * 結果: { tables: { 名前: 件数 }, problems: [理由] }。問題がなければ、problems は空。
 * requiredTables: バックアップにあるべきテーブル(足りなければ、問題)。
 */
export function verifyDump(sql, requiredTables = []) {
  const problems = [];
  const tables = {};
  if (typeof sql !== "string" || sql.trim() === "") {
    return { tables, problems: ["バックアップが、空です。"] };
  }

  const db = new DatabaseSync(":memory:");
  try {
    // D1 に読み込むときと同じように、1 つの取引として実行する(外部キーの検査は、最後にまとめて行われる)
    db.exec("BEGIN");
    try {
      db.exec(sql);
      db.exec("COMMIT");
    } catch (cause) {
      db.exec("ROLLBACK");
      return {
        tables,
        problems: [`SQL として実行できません(途切れている・壊れている可能性): ${cause.message}`],
      };
    }

    const names = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all()
      .map((row) => row.name);
    for (const name of names) {
      tables[name] = db
        .prepare(`SELECT COUNT(*) AS n FROM "${name.replaceAll('"', '""')}"`)
        .get().n;
    }
    for (const required of requiredTables) {
      if (!(required in tables)) problems.push(`テーブルが、ありません: ${required}`);
    }
    const integrity = db.prepare("PRAGMA integrity_check").all();
    if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") {
      problems.push("データベースの整合性の検査(integrity_check)に、失敗しました。");
    }
    if (db.prepare("PRAGMA foreign_key_check").all().length > 0) {
      problems.push("外部キーの整合性の検査に、失敗しました(参照先のない行があります)。");
    }
    return { tables, problems };
  } finally {
    db.close();
  }
}
