// 広告の設定。広告事業者のスクリプトは入れていない(導入は Phase 29 の後の PR)。
// enabled が true で、/api/affiliates(D1。なければ public/data/affiliates.json)に表示するリンクがあるときだけ、枠が出る。
// true にする前に、/ads-policy/ の「始める前に行うこと」を終える(Issue #122・#123)。
export const adsConfig = {
  enabled: false,
};
