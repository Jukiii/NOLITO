// タブの切り替えの計算。DOM に触れない(矢印キー・Home・End での移動先と、アドレスの ?tab= の解釈)。

// 押したキーから、移動先の番号を返す。タブの移動に関係ないキーは null
export function nextTabIndex(key, current, count) {
  if (!Number.isInteger(current) || !Number.isInteger(count) || count < 1) return null;
  switch (key) {
    case "ArrowRight":
      return (current + 1) % count;
    case "ArrowLeft":
      return (current + count - 1) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

// ?tab=<id> の値を、タブの id に直す。一覧にない値(壊れた・書き換えられた値)は、先頭のタブ
export function resolveTab(requested, ids) {
  return ids.includes(requested) ? requested : ids[0];
}
