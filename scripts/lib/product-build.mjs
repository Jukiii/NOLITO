// プロダクトの詳細ページの、読み込み・整形・書き出し・検査(入出力)。
// 生成物は Prettier で整形してからコミットする(npm run format:check を通すため)。
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { format, resolveConfig } from "prettier";
import { GENERATED_KEYWORD } from "./product-pages.mjs";

export function loadProductInputs(publicDir) {
  const read = (path) => JSON.parse(readFileSync(join(publicDir, "data", path), "utf8"));
  return {
    productData: read("products.json"),
    categoryData: read("categories.json"),
    site: read("site.json"),
  };
}

/** 生成した HTML を、プロジェクトの Prettier の設定で整形する(結果は、いつも同じ内容になる)。 */
export async function formatFiles(files, root) {
  const formatted = new Map();
  for (const [path, html] of files) {
    const file = join(root, "public", path);
    const options = (await resolveConfig(file)) ?? {};
    formatted.set(path, await format(html, { ...options, filepath: file, parser: "html" }));
  }
  return formatted;
}

const isGenerated = (content) => content.includes(GENERATED_KEYWORD);

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

// 生成の印があるのに、いまのデータからは作られないページ(商品を消した・場所を変えた)
export function staleProductPages(publicDir, files) {
  return htmlFiles(publicDir)
    .filter((file) => isGenerated(readFileSync(file, "utf8")))
    .map((file) => relative(publicDir, file).split("\\").join("/"))
    .filter((path) => !files.has(path));
}

// 生成する場所に、手書きのページ(印がない)がすでにあるもの
function overwrittenHandwritten(publicDir, files) {
  return [...files.keys()].filter((path) => {
    const target = join(publicDir, path);
    return existsSync(target) && !isGenerated(readFileSync(target, "utf8"));
  });
}

export function writeProductPages(publicDir, files) {
  const conflicts = overwrittenHandwritten(publicDir, files);
  if (conflicts.length > 0) {
    throw new Error(
      `手書きのページがあるため、上書きしません: ${conflicts.join(", ")}\n(detail_path を変えるか、手書きのページを移してください)`,
    );
  }
  for (const [path, content] of files) {
    const target = join(publicDir, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  for (const path of staleProductPages(publicDir, files)) {
    rmSync(join(publicDir, path), { force: true });
  }
}

/** 公開ディレクトリの生成物が、データから作られるものと一致するか。問題の一覧を返す(空なら最新)。 */
export function checkProductPages(publicDir, files) {
  const problems = overwrittenHandwritten(publicDir, files).map(
    (path) => `${path}: 手書きのページがあるため、生成できません`,
  );
  for (const [path, content] of files) {
    const target = join(publicDir, path);
    if (!existsSync(target)) problems.push(`${path}: 生成されていません`);
    else if (
      isGenerated(readFileSync(target, "utf8")) &&
      readFileSync(target, "utf8") !== content
    ) {
      problems.push(`${path}: データと内容が違います`);
    }
  }
  for (const path of staleProductPages(publicDir, files)) {
    problems.push(`${path}: 対応するプロダクトがありません(削除してください)`);
  }
  return problems;
}
