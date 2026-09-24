// サイト共通の定義。ナビ項目を増やすときはここだけを変更する。
export const siteName = "NOLITO";
export const tagline = "ノリよく、楽しく使えるものを作る。";

// available: false は「準備中」として非リンクで表示する。該当ページができたPhaseで true にする。
// children(任意): サブメニュー([{ label, href }])。PCはドロップダウン、モバイルのパネルでは
// 親子をそのまま並べて出す(決定は docs/decisions/0045-phase-20-plan.md)。
export const mainNav = [
  { label: "ホーム", href: "/" },
  {
    label: "ゲーム",
    href: "/games/",
    children: [
      { label: "ゲーム一覧", href: "/games/" },
      { label: "上司から逃げろで遊ぶ", href: "/games/escape-boss/" },
      { label: "成績・実績を見る", href: "/games/escape-boss/stats/" },
    ],
  },
  { label: "ソフト", href: "/software/", available: false },
  {
    label: "ツール",
    href: "/tools/",
    children: [
      { label: "ツール一覧", href: "/tools/" },
      { label: "キーみち", href: "/tools/kii-michi/" },
    ],
  },
  { label: "記事", href: "/articles/" },
];

// モバイルの下部固定バー(重要機能)。href は、mainNav の中から選ぶ(available: false は出さない)
export const bottomNav = [
  { label: "ホーム", href: "/" },
  { label: "ゲーム", href: "/games/" },
  { label: "ツール", href: "/tools/" },
  { label: "記事", href: "/articles/" },
];

// フッターのリンク。ページができたものだけを並べる(存在しないページへのリンクは張らない)
export const footerLinks = [
  { label: "サイト紹介", href: "/about/" },
  { label: "更新履歴", href: "/updates/" },
  { label: "サポート", href: "/support/" },
  { label: "プライバシーポリシー", href: "/privacy/" },
  { label: "利用規約", href: "/terms/" },
];
