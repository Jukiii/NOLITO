// 追跡シーンの決まり。DOM に依存しない純粋なロジック。見た目(位置・動き)は、CSS が行う。

// 追ってくる人の位置。逃走距離が減るほど、追ってくる人がこちらに近づく。
// 返すのは 0(遠い)〜1(すぐ後ろ)。CSS 変数 --closeness に渡し、位置の計算は CSS が行う。
// 動きの軽減設定でも位置は距離に応じて変わる(アニメーションに頼らず、距離を伝える)。
export function closenessOf(distance, maxDistance) {
  const ratio = Math.min(1, Math.max(0, distance / maxDistance));
  return 1 - ratio;
}

// 危ない(距離が最大の 25% 以下)か。ゲージと場面が、同じ判断を使う
export const DANGER_RATIO = 0.25;
export function isDanger(distance, maxDistance) {
  const ratio = Math.min(1, Math.max(0, distance / maxDistance));
  return ratio <= DANGER_RATIO;
}

// 役職ごとの動き(roles.json の scene.motion)。CSS の [data-motion="…"] と対応する
//   run … 走る(徒歩)/ pedal … こぐ(自転車)/ drive … 振動と煙(車)/ glide … 滑らかに進み、つやが光る(リムジン)/ aura … 浮かんで、オーラ(裏ボス)
export const SCENE_MOTIONS = Object.freeze(["run", "pedal", "drive", "glide", "aura"]);
export const DEFAULT_MOTION = "run";

/** 役職の動き。知らない値・ない場合は、既定(run)。 */
export const motionOf = (role) =>
  SCENE_MOTIONS.includes(role?.scene?.motion) ? role.scene.motion : DEFAULT_MOTION;

// 場面の一瞬の演出(miss = ミスで追ってくる人が飛び出す / gain = 正解で引き離す)。CSS の [data-event="…"] と対応する
export const SCENE_EVENTS = Object.freeze(["miss", "gain"]);
export const EVENT_MS = 350;
