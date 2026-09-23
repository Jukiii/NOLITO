// 語録・職種・役職データの読み込みと、出題の選び方。

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} を読み込めませんでした (${response.status})`);
  return response.json();
}

export const loadJobs = () => loadJson("/data/jobs.json");
export const loadRoles = () => loadJson("/data/roles.json");
export const loadDifficulties = () => loadJson("/data/difficulties.json");
export const loadVocabulary = (jobId) => loadJson(`/data/vocabulary/${jobId}.json`);

// Fisher-Yates。random は 0以上1未満を返す関数(テストで差し替える)
export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const weightOf = (weights, item) => {
  const weight = weights.get(item.id);
  return Number.isFinite(weight) && weight > 0 ? weight : 1;
};

/**
 * 出す順に並べた袋を作る。weights(id → 重み)がなければ、ただのシャッフル。
 * 重みがあれば、重みつきの抽出(語ごとに random^(1/重み) を作り、大きい順)。重みが大きい語ほど、先に出やすい。
 */
function orderedBag(pool, random, weights) {
  if (!weights || weights.size === 0) return shuffle(pool, random);
  return pool
    .map((item) => ({ item, key: random() ** (1 / weightOf(weights, item)) }))
    .sort((a, b) => b.key - a.key)
    .map(({ item }) => item);
}

/**
 * 役職の対象語から count 語を選ぶ。同一ゲーム内は重複させない。
 * weights(id → 重み。weak.js の weakWeights)を渡すと、重みの大きい語(苦手な語)が、出やすくなる。
 * 語が足りない場合だけ、全語を出し切った後にもう一度並べ直して使う(直前と同じ語は避ける)。
 */
export function pickWords(items, roleId, count, random = Math.random, { weights = null } = {}) {
  const pool = items.filter((item) => item.roles.includes(roleId));
  if (pool.length === 0) throw new Error(`役職 ${roleId} の対象語がありません`);

  const picked = [];
  let bag = [];
  while (picked.length < count) {
    if (bag.length === 0) {
      bag = orderedBag(pool, random, weights);
      const last = picked[picked.length - 1];
      if (bag.length > 1 && bag[0].id === last?.id) [bag[0], bag[1]] = [bag[1], bag[0]];
    }
    picked.push(bag.shift());
  }
  return picked;
}
