// テスト用の、D1 互換のデータベース(Node 標準の node:sqlite。メモリ上)。
// サーバー処理が使う範囲(prepare / bind / run / first / all / batch)だけを実装している。
// 本物の D1 も SQLite なので、SQL は同じように動く。
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const MIGRATIONS = new URL("../../migrations/", import.meta.url);

class Statement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    return new Statement(this.db, this.sql, params);
  }

  async run() {
    const result = this.db.prepare(this.sql).run(...this.params);
    return { success: true, meta: { changes: Number(result.changes) } };
  }

  async first() {
    const row = this.db.prepare(this.sql).get(...this.params);
    return row ? { ...row } : null;
  }

  async all() {
    const rows = this.db.prepare(this.sql).all(...this.params);
    return { success: true, results: rows.map((row) => ({ ...row })) };
  }
}

export class FakeD1 {
  constructor() {
    this.raw = new DatabaseSync(":memory:");
  }

  prepare(sql) {
    return new Statement(this.raw, sql);
  }

  /** D1 の batch と同じく、1 つの取引として実行する(途中で失敗したら、すべて戻す)。 */
  async batch(statements) {
    const results = [];
    this.raw.exec("BEGIN");
    try {
      for (const statement of statements) results.push(await statement.run());
      this.raw.exec("COMMIT");
    } catch (cause) {
      this.raw.exec("ROLLBACK");
      throw cause;
    }
    return results;
  }

  exec(sql) {
    this.raw.exec(sql);
  }
}

/** migrations/ のファイルを、番号順にすべて適用した、空のデータベース。 */
export function createDb() {
  const db = new FakeD1();
  const files = readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of files) db.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  return db;
}
