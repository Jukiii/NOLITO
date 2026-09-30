// アフィリエイト・広告のリンクを、広告枠(data-ad-slot)に描く(Phase 29 PR 2)。
// リンク情報は GET /api/affiliates(D1。なければ public/data/affiliates.json)。検証・選び方は affiliates/schema.js。
// 「PR」「広告」の文字・報酬の説明・外部サイトへの注意は、必ず一緒に出す(/ads-policy/ の「必要な表示」)。
import { AFFILIATE_KINDS, linksForPlacement } from "../affiliates/schema.js";
import { el } from "./dom.js";

// 報酬が発生するリンクであることを示す(sponsored)。開いた先に、このページの情報を渡さない
const LINK_REL = "sponsored noopener noreferrer";

export function affiliateCard(link) {
  return el(
    "article",
    { class: "affiliate-card" },
    el(
      "p",
      { class: "affiliate-card__label" },
      el("span", { class: "badge affiliate-card__badge" }, AFFILIATE_KINDS[link.kind]),
      el("span", {}, `提供: ${link.advertiser}`),
    ),
    el(
      "h3",
      { class: "affiliate-card__title" },
      el("a", { href: link.url, rel: LINK_REL }, link.title),
    ),
    el("p", { class: "affiliate-card__text" }, link.description),
    el("p", { class: "affiliate-card__note" }, "外部サイトへ移動します。"),
  );
}

// 枠の中の、報酬についての説明(リンクが 1 つでもあるときだけ出す)
export function affiliateDisclosure() {
  return el(
    "p",
    { class: "affiliate-disclosure" },
    "この枠には、広告・アフィリエイトのリンクを含みます。リンク先で購入・契約すると、運営者に報酬が入ることがあります。掲載の基準は、",
    el("a", { href: "/ads-policy/" }, "広告・収益化について"),
    "をご覧ください。",
  );
}

/** 枠に描く要素の一覧(リンクがなければ空)。 */
export function affiliateNodes(data, placement) {
  const links = linksForPlacement(data, placement);
  if (links.length === 0) return [];
  return [...links.map(affiliateCard), affiliateDisclosure()];
}

/**
 * initAdSlots の render に渡す。表示するリンクがない・読み込めないときは、枠を非表示に戻す
 * (空の枠が「広告」の名前だけ残らないように)。
 */
export async function renderAffiliateSlot(slot, placement, { fetchJson = defaultFetch } = {}) {
  let nodes;
  try {
    nodes = affiliateNodes(await fetchJson("/api/affiliates"), placement);
  } catch {
    nodes = [];
  }
  if (nodes.length === 0) {
    slot.hidden = true;
    return 0;
  }
  slot.replaceChildren(...nodes);
  return nodes.length - 1;
}

async function defaultFetch(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
