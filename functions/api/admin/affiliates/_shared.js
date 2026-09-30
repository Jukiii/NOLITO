// index.js・[id].js で共通に使う小さな部品(Phase 29 PR 3)。_ で始まるファイルは、ルーティングされない。
import {
  AFFILIATE_DATA_VERSION,
  validateAffiliates,
} from "../../../../public/assets/js/affiliates/schema.js";

export const MAX_AFFILIATE_BYTES = 10_000;

export const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** リンクの一覧全体(重複・形)を検査する。エラーの一覧を返す(空なら問題なし)。 */
export const validateLinks = (links) =>
  validateAffiliates({ version: AFFILIATE_DATA_VERSION, links });
