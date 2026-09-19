// 追跡シーンの位置。逃走距離が減るほど、追ってくる人がこちらに近づく。
// 返すのは 0(遠い)〜1(すぐ後ろ)。CSS 変数 --closeness に渡し、位置の計算は CSS が行う。
// 動きの軽減設定でも位置は距離に応じて変わる(アニメーションに頼らず、距離を伝える)。
export function closenessOf(distance, maxDistance) {
  const ratio = Math.min(1, Math.max(0, distance / maxDistance));
  return 1 - ratio;
}
