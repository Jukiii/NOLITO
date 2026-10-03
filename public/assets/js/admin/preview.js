// 本文のプレビュー(管理画面)。サーバー(/api/admin/article-preview)が返した、安全な変換の結果の HTML を、
// さらに、許可した要素・属性だけで作り直して、DocumentFragment にする(HTML を解釈して差し込む方法は使わない)。
// 判定の部分(isSafeHref・isSafeImageSrc・ALLOWED)は、DOM に触れない(tests/admin-articles-page.test.js が検査する)。

export const ALLOWED = Object.freeze({
  p: [],
  h2: [],
  h3: [],
  h4: [],
  h5: [],
  h6: [],
  ul: [],
  ol: ["start"],
  li: [],
  a: ["href", "title", "rel"],
  img: ["src", "alt", "title", "loading", "decoding"],
  strong: [],
  em: [],
  del: [],
  code: ["class"],
  pre: [],
  blockquote: [],
  hr: [],
  br: [],
  table: [],
  thead: [],
  tbody: [],
  tr: [],
  th: ["align"],
  td: ["align"],
});

const SAFE_PROTOCOLS = ["http:", "https:", "mailto:"];

/** リンクの行き先: サイト内の相対パス・#見出し・http・https・mailto だけ。 */
export function isSafeHref(value) {
  const text = String(value).trim();
  if (text === "" || text.startsWith("//")) return false;
  if (text.startsWith("#") || text.startsWith("/") || text.startsWith("./")) return true;
  try {
    return SAFE_PROTOCOLS.includes(new URL(text).protocol);
  } catch {
    return !/^[a-z][a-z0-9+.-]*:/i.test(text);
  }
}

/** 画像の場所: サイト内の相対パスか https だけ。 */
export function isSafeImageSrc(value) {
  const text = String(value).trim();
  if (text === "" || text.startsWith("//")) return false;
  if (text.startsWith("/") || text.startsWith("./")) return true;
  try {
    return new URL(text).protocol === "https:";
  } catch {
    return !/^[a-z][a-z0-9+.-]*:/i.test(text);
  }
}

const CODE_CLASS = /^language-[a-z0-9_+-]{1,20}$/i;
const ALIGN = ["left", "right", "center"];

function attributeAllowed(tag, name, value) {
  if (tag === "a" && name === "href") return isSafeHref(value);
  if (tag === "img" && name === "src") return isSafeImageSrc(value);
  if (name === "class") return CODE_CLASS.test(value);
  if (name === "align") return ALIGN.includes(value);
  if (name === "start") return /^\d{1,6}$/.test(value);
  if (name === "loading") return value === "lazy";
  if (name === "decoding") return value === "async";
  if (name === "rel") return value === "noopener noreferrer";
  return true;
}

const DROPPED = new Set(["script", "style", "iframe", "object", "embed", "template", "noscript"]);

function rebuild(node, doc) {
  if (node.nodeType === 3) return doc.createTextNode(node.textContent);
  if (node.nodeType !== 1) return null;
  const tag = node.tagName.toLowerCase();
  if (DROPPED.has(tag)) return null;
  const allowed = Object.hasOwn(ALLOWED, tag) ? ALLOWED[tag] : null;
  const container = allowed ? doc.createElement(tag) : doc.createDocumentFragment();
  if (allowed) {
    for (const name of allowed) {
      const value = node.getAttribute(name);
      if (value !== null && attributeAllowed(tag, name, value)) container.setAttribute(name, value);
    }
  }
  if (tag === "img" || tag === "hr" || tag === "br") return container;
  for (const child of node.childNodes) {
    const built = rebuild(child, doc);
    if (built) container.append(built);
  }
  return container;
}

/** サーバーが返した HTML の文字列 → 安全な DocumentFragment。 */
export function buildPreview(html, doc = document) {
  const parsed = new DOMParser().parseFromString(String(html), "text/html");
  const fragment = doc.createDocumentFragment();
  for (const child of parsed.body.childNodes) {
    const built = rebuild(child, doc);
    if (built) fragment.append(built);
  }
  return fragment;
}
