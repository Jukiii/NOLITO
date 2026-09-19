// 距離・クリア判定のゲームロジック。DOM に依存せず、状態は不変(毎回新しいオブジェクトを返す)。
// stage は roles.json の stage(max_distance / initial_distance / drain_per_second /
// base_gain / gain_per_char / miss_penalty / goal_words)。

export function createGameState(stage) {
  return {
    status: "playing",
    distance: stage.initial_distance,
    correct: 0,
    miss: 0,
    hits: 0,
    elapsed: 0,
  };
}

// クリア判定を優先する(最後の1語を打ち終えた瞬間は、距離が 0 でも逃げ切りとする)
function settle(state, stage) {
  if (state.correct >= stage.goal_words) return { ...state, status: "cleared" };
  if (state.distance <= 0) return { ...state, status: "gameover", distance: 0 };
  return state;
}

// 時間経過。追跡者が近づくため距離が減る。
export function tick(state, stage, seconds) {
  if (state.status !== "playing") return state;
  return settle(
    {
      ...state,
      distance: state.distance - stage.drain_per_second * seconds,
      elapsed: state.elapsed + seconds,
    },
    stage,
  );
}

// 1語の正解で増える距離。長い語ほど多く増える。
export function wordGain(stage, charCount) {
  return stage.base_gain + stage.gain_per_char * charCount;
}

export function applyCorrect(state, stage, charCount) {
  if (state.status !== "playing") return state;
  const distance = Math.min(stage.max_distance, state.distance + wordGain(stage, charCount));
  return settle({ ...state, distance, correct: state.correct + 1 }, stage);
}

// 正しい打鍵1回。正確率・打鍵速度の計算に使う。
export function applyHit(state) {
  if (state.status !== "playing") return state;
  return { ...state, hits: state.hits + 1 };
}

export function applyMiss(state, stage) {
  if (state.status !== "playing") return state;
  return settle(
    { ...state, distance: state.distance - stage.miss_penalty, miss: state.miss + 1 },
    stage,
  );
}
