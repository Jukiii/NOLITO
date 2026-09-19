// サイト共通の定義。ナビ項目を増やすときはここだけを変更する(Phase 20 で拡張予定)。
export const siteName = "NOLITO";
export const tagline = "ノリよく、楽しく使えるものを作る。";

// available: false は「準備中」として非リンクで表示する。該当ページができたPhaseで true にする。
export const mainNav = [
  { label: "ホーム", href: "/" },
  { label: "ゲーム", href: "/games/" },
  { label: "ソフト", href: "/software/", available: false },
  { label: "ツール", href: "/tools/", available: false },
  { label: "記事", href: "/articles/", available: false },
];
