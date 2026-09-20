// 広告の枠。Phase 5 では枠(常に非表示)と配置のルールだけを用意し、広告事業者のスクリプトは入れない(導入は Phase 29)。
//
// 配置のルール:
//   - 広告を置けるのは、ゲームの外のページ("page")、記事("article")、ゲームの終了(結果)画面("game-result")だけ
//   - プレイ中の画面(data-view="play")の中には置かない
//   - 枠は、広告が有効で、広告を描く処理が渡されたときだけ表示する。それ以外は非表示のまま(場所も占めない)
export const AD_PLACEMENTS = ["page", "article", "game-result"];

/**
 * 枠を整える。許可されていない配置の枠は取り除く。
 * enabled が true で render(slot, placement) が渡されたときだけ、枠を表示して render を呼ぶ。
 * 戻り値は、表示した枠の数。
 */
export function initAdSlots(root = document, { enabled = false, render = null } = {}) {
  let shown = 0;
  for (const slot of root.querySelectorAll("[data-ad-slot]")) {
    const placement = slot.dataset.adSlot;
    if (!AD_PLACEMENTS.includes(placement) || slot.closest('[data-view="play"]')) {
      slot.remove();
      continue;
    }
    if (enabled && typeof render === "function") {
      slot.hidden = false;
      render(slot, placement);
      shown += 1;
    }
  }
  return shown;
}
