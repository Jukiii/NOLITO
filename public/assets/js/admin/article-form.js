// 記事の入力フォームの、DOM に依存しない部品(tests/admin-articles-page.test.js が検査する)。

/** 「、」「,」「,(全角)」区切りの文字列 → タグの配列(前後の空白・空の項目を除く)。 */
export const parseTags = (text) =>
  String(text)
    .split(/[、,，]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");
