// 要素を組み立てる小さなヘルパー。文字列は textContent 相当で扱うため、HTMLとして解釈されない。
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    node.setAttribute(name, value === true ? "" : String(value));
  }
  node.append(...children);
  return node;
}
