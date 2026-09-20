// プロダクトの表示用の文字列を作る(DOM に依存しない)。
import { isGithubReleaseUrl } from "./schema.js";

// 状態の表示。状態は色だけでなく、必ず文字でも示す
export const PRODUCT_STATUS = {
  released: { label: "公開中", badge: "badge--live" },
  beta: { label: "テスト版", badge: "badge--soon" },
  "coming-soon": { label: "準備中", badge: "badge--soon" },
};

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

// ダウンロードのボタンの注意書き。サイト内のファイルなら不要(空)。移動先を、押す前にわかるようにする
export function downloadNote(url) {
  if (url.startsWith("/")) return "";
  if (isGithubReleaseUrl(url)) return "配布ページ(GitHub Releases・外部サイト)へ移動します。";
  return `外部サイト(${new URL(url).hostname})へ移動します。`;
}

// 購入のボタンの注意書き。購入・支払いは、外部の販売サービスで行う
export function purchaseNote(url) {
  return `購入の手続きは、外部の販売サービス(${new URL(url).hostname})のページで行います。`;
}
