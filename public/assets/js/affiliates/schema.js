// アフィリエイト・広告のリンク情報(public/data/affiliates.json)の検証と選び方(DOM に依存しない)。
// 表示の文字(「PR」「広告」)は、kind から決める。データで自由に書き換えられないようにして、必ず表示する。
import { AD_PLACEMENTS } from "../components/ad-slot.js";
import { isExternalUrl } from "../products/schema.js";

export const AFFILIATE_DATA_VERSION = 1;
// 報酬が発生するリンク(アフィリエイト)は「PR」、掲載料を受け取る広告は「広告」
export const AFFILIATE_KINDS = { affiliate: "PR", ad: "広告" };
// 1つの枠に並べる最大数(広告で、本来の内容が埋もれないように)
export const MAX_LINKS_PER_SLOT = 3;

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KEYS = ["id", "kind", "title", "description", "advertiser", "url", "placements"];

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
// 制御文字・見えない文字(向きを変える文字など)を含まない、1行の文字
const isText = (value, max) =>
  typeof value === "string" &&
  value.trim() !== "" &&
  value.length <= max &&
  !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value) &&
  !/[<>]/.test(value);

/** 1件のリンクを検証して、問題の一覧(なければ空)を返す。 */
export function validateAffiliateLink(link) {
  if (!isObject(link)) return ["リンクはオブジェクトにしてください"];
  const errors = [];
  const add = (message) => errors.push(message);
  for (const key of Object.keys(link)) if (!KEYS.includes(key)) add(`知らない項目です: ${key}`);
  if (typeof link.id !== "string" || !ID_PATTERN.test(link.id)) {
    add("id は英小文字・数字・ハイフンだけにしてください");
  }
  if (!Object.hasOwn(AFFILIATE_KINDS, link.kind)) {
    add(`kind は ${Object.keys(AFFILIATE_KINDS).join(" か ")} にしてください`);
  }
  if (!isText(link.title, 60)) add("title は、1〜60字(< > は不可)にしてください");
  if (!isText(link.description, 120)) add("description は、1〜120字(< > は不可)にしてください");
  if (!isText(link.advertiser, 40)) add("advertiser(提供元の名前)は、1〜40字にしてください");
  if (!isExternalUrl(link.url)) add("url は、https の URL にしてください");
  const placementsOk =
    Array.isArray(link.placements) &&
    link.placements.length > 0 &&
    new Set(link.placements).size === link.placements.length &&
    link.placements.every((placement) => AD_PLACEMENTS.includes(placement));
  if (!placementsOk) {
    add(`placements は、重複のない ${AD_PLACEMENTS.join("・")} のうち 1 つ以上にしてください`);
  }
  return errors;
}

/** ファイル全体を検証して、問題の一覧(なければ空)を返す。テスト・ビルド用。 */
export function validateAffiliates(data) {
  if (!isObject(data) || data.version !== AFFILIATE_DATA_VERSION || !Array.isArray(data.links)) {
    return [
      `affiliates.json は { version: ${AFFILIATE_DATA_VERSION}, links: [...] } の形にしてください`,
    ];
  }
  const errors = [];
  const ids = new Set();
  data.links.forEach((link, index) => {
    const known = isObject(link) && typeof link.id === "string";
    const name = known ? link.id : `#${index}`;
    for (const message of validateAffiliateLink(link)) errors.push(`${name}: ${message}`);
    if (known) {
      if (ids.has(link.id)) errors.push(`${name}: id が重複しています`);
      ids.add(link.id);
    }
  });
  return errors;
}

/**
 * 表示に使うリンク。不正な項目は外して(安全側)、その枠(placement)のものを、最大数まで返す。
 * 実行時は、ファイルが不正でも、ほかは表示する(products と同じ考え方)。
 */
export function linksForPlacement(data, placement) {
  if (!isObject(data) || data.version !== AFFILIATE_DATA_VERSION || !Array.isArray(data.links)) {
    return [];
  }
  if (!AD_PLACEMENTS.includes(placement)) return [];
  const seen = new Set();
  const links = [];
  for (const link of data.links) {
    if (validateAffiliateLink(link).length > 0 || seen.has(link.id)) continue;
    seen.add(link.id);
    if (link.placements.includes(placement)) links.push(link);
  }
  return links.slice(0, MAX_LINKS_PER_SLOT);
}
