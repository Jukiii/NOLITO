// プロダクトの詳細ページの HTML を作る(ファイルの読み書きはしない純粋な処理)。
// データの形と安全性の検証は、実行時の一覧と同じ public/assets/js/products/schema.js を使う。
// 値は必ずエスケープしてから埋め込む。URL は、検証を通った(サイト内のパスか https の)ものだけが入る。
import {
  PRODUCT_STATUS,
  downloadNote,
  formatDate,
  platformLabels,
  priceLabel,
  purchaseNote,
  versionLabel,
} from "../../public/assets/js/products/format.js";
import { validateProducts } from "../../public/assets/js/products/schema.js";
import { escapeHtml } from "./html.mjs";
import { renderDocument } from "./render.mjs";

// 生成したページに入れる印。手書きのページを上書きしない・古い生成物を見つけるために使う。
// 探すときは、コメント全文ではなくキーワードで探す(整形で改行位置が変わっても見つけられるように)
export const GENERATED_KEYWORD = "scripts/build-products.mjs が生成します";
export const GENERATED_MARKER = `<!-- このページは ${GENERATED_KEYWORD}。直接編集せず、public/data/products.json を編集してください。 -->`;

const STYLESHEETS = ["tokens", "base", "layout", "components", "products"];
const externalRel = (url) => (url.startsWith("/") ? "" : ' rel="noopener noreferrer"');
const timeTag = (isoDate) =>
  `<time datetime="${escapeHtml(isoDate)}">${escapeHtml(formatDate(isoDate))}</time>`;
const paragraphs = (text) =>
  text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");

function metaRows(product) {
  const rows = [
    ["対応", platformLabels(product.platforms).join(" / ")],
    ["価格", priceLabel(product.price)],
  ];
  if (product.version) rows.push(["バージョン", versionLabel(product.version)]);
  const cells = rows.map(
    ([term, value]) =>
      `<div class="product__meta-row"><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd></div>`,
  );
  if (product.released_at) {
    cells.push(
      `<div class="product__meta-row"><dt>公開</dt><dd>${timeTag(product.released_at)}</dd></div>`,
    );
  }
  cells.push(
    `<div class="product__meta-row"><dt>更新</dt><dd>${timeTag(product.updated_at)}</dd></div>`,
  );
  return cells.join("\n            ");
}

// 使う・ダウンロード・購入のボタンと、移動先の注意書き
function actions(product) {
  const buttons = [];
  const notes = [];
  // 詳細ページ自身が「使う先」のとき(ソフト)は、自分へのリンクになるので出さない
  if (product.status !== "coming-soon" && product.url !== product.detail_path) {
    buttons.push(
      `<a class="button button--primary" href="${escapeHtml(product.url)}"${externalRel(product.url)}>${escapeHtml(product.cta ?? "見る")}</a>`,
    );
  }
  if (product.download) {
    const { label, url } = product.download;
    buttons.push(
      `<a class="button button--secondary" href="${escapeHtml(url)}"${externalRel(url)}>${escapeHtml(label)}</a>`,
    );
    if (downloadNote(url)) notes.push(downloadNote(url));
  }
  if (product.purchase) {
    const { label, url } = product.purchase;
    buttons.push(
      `<a class="button button--secondary" href="${escapeHtml(url)}"${externalRel(url)}>${escapeHtml(label)}</a>`,
    );
    notes.push(purchaseNote(url));
  }
  return [
    buttons.length > 0 ? `<div class="product__actions">${buttons.join("")}</div>` : "",
    ...notes.map((note) => `<p class="product__note">${escapeHtml(note)}</p>`),
  ]
    .filter(Boolean)
    .join("\n          ");
}

function section(id, heading, body) {
  return `        <section class="product__section" id="${id}" aria-labelledby="${id}-title">
          <h2 id="${id}-title">${escapeHtml(heading)}</h2>
${body}
        </section>`;
}

function sections(product) {
  const parts = [];
  if (product.details.length > 0) {
    parts.push(
      section(
        "about",
        "詳しい説明",
        product.details.map((text) => `          ${paragraphs(text)}`).join("\n"),
      ),
    );
  }
  if (product.screenshots.length > 0) {
    const items = product.screenshots
      .map(
        (shot) =>
          `            <li class="shots__item"><img src="${escapeHtml(shot.src)}" alt="${escapeHtml(shot.alt)}" width="${shot.width}" height="${shot.height}" loading="lazy" /></li>`,
      )
      .join("\n");
    parts.push(
      section("screenshots", "画像", `          <ul class="shots">\n${items}\n          </ul>`),
    );
  }
  if (product.requirements.length > 0) {
    const rows = product.requirements
      .map(
        ({ label, value }) =>
          `            <div class="spec__row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
      )
      .join("\n");
    parts.push(
      section("requirements", "動作環境", `          <dl class="spec">\n${rows}\n          </dl>`),
    );
  }
  if (product.faq.length > 0) {
    const items = product.faq
      .map(
        ({ question, answer }) =>
          `            <details class="faq__item"><summary class="faq__question">${escapeHtml(question)}</summary><div class="faq__answer">${paragraphs(answer)}</div></details>`,
      )
      .join("\n");
    parts.push(
      section("faq", "よくある質問", `          <div class="faq">\n${items}\n          </div>`),
    );
  }
  if (product.changelog.length > 0) {
    const items = product.changelog
      .map(
        (entry) => `            <li class="changelog__item">
              <h3 class="changelog__version">${escapeHtml(versionLabel(entry.version))} <span class="changelog__date">${timeTag(entry.date)}</span></h3>
              <ul>${entry.changes.map((change) => `<li>${escapeHtml(change)}</li>`).join("")}</ul>
            </li>`,
      )
      .join("\n");
    parts.push(
      section(
        "changelog",
        "更新履歴",
        `          <ol class="changelog">\n${items}\n          </ol>`,
      ),
    );
  }
  parts.push(
    section(
      "support",
      "サポート",
      `          <p>使い方や不具合で困ったときは、<a href="/support/">サポート</a>のページをご覧ください。</p>`,
    ),
  );
  return parts.join("\n");
}

/** 1つのプロダクトの詳細ページ。category は、その商品のカテゴリ({ name, path })。 */
export function renderProductPage(product, category, site) {
  const status = PRODUCT_STATUS[product.status];
  const hero = product.image
    ? `        <div class="product__hero"><img src="${escapeHtml(product.image.src)}" alt="${escapeHtml(product.image.alt)}" /></div>\n`
    : "";
  const main = `      <article class="product">
        <header class="product__header">
          <p class="product__category"><a href="${escapeHtml(category.path)}">${escapeHtml(category.name)}</a></p>
          <h1 class="product__title">${escapeHtml(product.title)}</h1>
          <p><span class="badge ${status.badge}">${escapeHtml(status.label)}</span></p>
          <p class="product__lead">${escapeHtml(product.description)}</p>
          <dl class="product__meta">
            ${metaRows(product)}
          </dl>
          ${actions(product)}
        </header>
${hero}${sections(product)}
        <aside class="ad-slot" data-ad-slot="page" aria-label="広告" hidden></aside>
        <nav class="product__nav" aria-label="ページのナビゲーション">
          <a href="${escapeHtml(category.path)}">← ${escapeHtml(category.name)}の一覧へ</a>
        </nav>
      </article>`;
  const html = renderDocument({
    site,
    title: `${product.title}の詳細`,
    description: product.description,
    canonicalPath: product.detail_path,
    ogType: "website",
    main,
    stylesheets: STYLESHEETS,
  });
  return html.replace("<!doctype html>\n", `<!doctype html>\n${GENERATED_MARKER}\n`);
}

/**
 * データ全体から、詳細ページ(detail_path があるもの)をすべて作る。
 * 戻り値: Map<公開ディレクトリからの相対パス, HTML>。データに問題があれば、まとめて Error にして投げる。
 */
export function buildProductPages({ productData, categoryData, site }) {
  const problems = validateProducts(productData, categoryData.categories);
  if (problems.length > 0) throw new Error(problems.map((line) => `  - ${line}`).join("\n"));
  const files = new Map();
  for (const product of productData.products) {
    if (product.detail_path === null) continue;
    const category = categoryData.categories.find((item) => item.id === product.category);
    files.set(
      `${product.detail_path.slice(1)}index.html`,
      renderProductPage(product, category, site),
    );
  }
  return files;
}
