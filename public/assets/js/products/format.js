// プロダクトの表示用の文字列を作る(DOM に依存しない)。

export const PLATFORM_LABELS = {
  web: "Web",
  windows: "Windows",
  mac: "macOS",
  linux: "Linux",
  ios: "iOS",
  android: "Android",
};

export function platformLabels(platforms) {
  return platforms.map((platform) => PLATFORM_LABELS[platform] ?? platform);
}

// 無料 / ¥1,200 / 価格未定
export function priceLabel(price) {
  if (price.type === "free") return "無料";
  if (price.type === "paid")
    return `¥${String(price.amount).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  return "価格未定";
}

export const versionLabel = (version) => `v${version}`;

// 2026-09-20 → 2026年9月20日
export function formatDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}
