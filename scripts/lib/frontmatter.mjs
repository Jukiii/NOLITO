// 記事の原稿(先頭に YAML の情報を持つ Markdown)の読み取りと検証。
import { parse } from "yaml";

export { LIMITS, isValidDate, validateArticle } from "./article-fields.mjs";

/**
 * "---\n<YAML>\n---\n<本文>" を、{ data, body } に分ける。先頭情報がなければエラー。
 * YAML の日付(2026-09-20)は Date にならないよう、文字列のまま受け取る。
 */
export function splitFrontmatter(text) {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(normalized);
  if (!match) throw new Error("先頭に --- で囲んだ記事の情報(YAML)がありません");
  let data;
  try {
    data = parse(match[1], { schema: "core" });
  } catch (error) {
    throw new Error(`記事の情報(YAML)を読み取れません: ${error.message.split("\n")[0]}`, {
      cause: error,
    });
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("記事の情報(YAML)は、項目名と値の組で書いてください");
  }
  return { data, body: match[2] };
}
