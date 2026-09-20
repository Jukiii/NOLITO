// HTML を組み立てるときの共通の部品。値は必ずエスケープしてから埋め込む。

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

// 日付(YYYY-MM-DD)を「2026年9月20日」の形にする
export function formatDateJa(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}
