// アクセス解析(Google Analytics 4)の設定。
//
// measurementId が空のあいだ(または本番以外のホストでは)、計測もバナーも一切動かない(何も送信しない)。
// GA4 でプロパティを作ると発行される「測定 ID」(G-XXXXXXXXXX)を入れると有効になる。測定 ID は、公開されても問題のない値。
export const analyticsConfig = {
  measurementId: "G-5T8P9H748P",
  // 計測するホスト(本番のみ)。プレビュー(*.pages.dev の別名)やローカルは計測しない。
  // 独自ドメインにしたら、そのホストに変える(public/data/site.json の url と合わせる)。
  hosts: ["nolito.pages.dev"],
  // プライバシーポリシーの版。ポリシーの内容を変えて版を上げると、同意をもう一度確認する。
  policyVersion: 4,
};
