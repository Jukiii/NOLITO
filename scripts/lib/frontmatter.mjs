// 記事の原稿(先頭に YAML の情報を持つ Markdown)の読み取りと検証。
import { parse } from "yaml";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const LIMITS = {
  title: 100,
  descriptionMin: 10,
  descriptionMax: 160,
  tags: 5,
  tagLength: 20,
};

// 実在する日付か(2026-02-30 などを弾く)
export function isValidDate(text) {
  if (typeof text !== "string" || !DATE_PATTERN.test(text)) return false;
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

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

/**
 * 記事の情報を検証して、正規化した値を返す。問題はすべて集めて、1つのエラーにまとめて投げる。
 * 必須: title・description・date。任意: updated・tags・draft。
 */
export function validateArticle(data, slug) {
  const problems = [];
  const text = (value) => (typeof value === "string" ? value.trim() : "");

  if (!SLUG_PATTERN.test(slug)) {
    problems.push(`ファイル名(スラッグ)は、英小文字・数字・ハイフンだけにしてください: "${slug}"`);
  }
  const title = text(data.title);
  if (!title) problems.push("title(題名)は必須です");
  else if (title.length > LIMITS.title) problems.push(`title は${LIMITS.title}文字までです`);

  const description = text(data.description);
  if (!description) problems.push("description(説明)は必須です");
  else if (
    description.length < LIMITS.descriptionMin ||
    description.length > LIMITS.descriptionMax
  ) {
    problems.push(
      `description は${LIMITS.descriptionMin}〜${LIMITS.descriptionMax}文字にしてください(現在${description.length}文字)`,
    );
  }

  const date = typeof data.date === "string" ? data.date : "";
  if (!isValidDate(date)) problems.push("date は実在する日付を YYYY-MM-DD の形で書いてください");

  let updated = null;
  if (data.updated !== undefined) {
    if (!isValidDate(data.updated)) {
      problems.push("updated は実在する日付を YYYY-MM-DD の形で書いてください");
    } else if (isValidDate(date) && data.updated < date) {
      problems.push("updated は date より前にできません");
    } else {
      updated = data.updated;
    }
  }

  let tags = [];
  if (data.tags !== undefined) {
    if (!Array.isArray(data.tags) || data.tags.some((tag) => typeof tag !== "string")) {
      problems.push("tags は文字列のリストで書いてください");
    } else {
      tags = data.tags.map((tag) => tag.trim());
      if (tags.some((tag) => !tag || tag.length > LIMITS.tagLength)) {
        problems.push(`tags の各項目は1〜${LIMITS.tagLength}文字にしてください`);
      }
      if (tags.length > LIMITS.tags) problems.push(`tags は${LIMITS.tags}個までです`);
      if (new Set(tags).size !== tags.length) problems.push("tags に重複があります");
    }
  }

  if (data.draft !== undefined && typeof data.draft !== "boolean") {
    problems.push("draft は true か false で書いてください");
  }

  if (problems.length > 0) throw new Error(problems.join("\n"));
  return { slug, title, description, date, updated, tags, draft: data.draft === true };
}
