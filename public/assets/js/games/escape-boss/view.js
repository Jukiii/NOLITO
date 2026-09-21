import { el } from "../../components/dom.js";
import { reviewItem } from "./review-item.js";
import { activeCues, cueLabel, describeRules, rulesOf } from "./rules.js";
import { isSkipKey } from "./staging.js";
import { EVENT_MS, SCENE_EVENTS, backgroundOf, closenessOf, isDanger, motionOf } from "./scene.js";

// 画面の描画。HTML は index.html に静的に書き、ここでは data 属性を目印に中身だけを更新する。
// 文字列(語録・ニックネームなど)は textContent で入れる。HTML として解釈しない。

const formatDate = (ms) => new Date(ms).toLocaleDateString("ja-JP");
const formatNumber = (n) => Math.round(n).toLocaleString("ja-JP");

const STORAGE_NOTICES = {
  unavailable:
    "この端末(ブラウザ)では記録を保存できません。ゲームは遊べますが、ページを閉じると記録は消えます。",
  corrupt:
    "保存されていたデータが壊れていたため、記録を初期化しました。(元のデータは、ブラウザ内の別の場所に退避してあります)",
  failed: "記録を保存できませんでした。ブラウザの保存容量や設定を確認してください。",
};

// モード。連続タイピング(追ってくる人から逃げる)と、用語確認(追いかけなし・時間制限なしの練習)
const MODES = [
  { value: "chase", label: "連続タイピング", sub: "追ってくる人から逃げる" },
  { value: "check", label: "用語確認", sub: "説明を見ながら練習" },
];

export function createView(root) {
  const $ = (selector) => root.querySelector(selector);
  const views = {
    dashboard: $('[data-view="dashboard"]'),
    play: $('[data-view="play"]'),
    result: $('[data-view="result"]'),
    checkResult: $('[data-view="check-result"]'),
  };
  const input = $("[data-input]");
  const inputBox = $("[data-input-box]");
  const gauge = $("[data-gauge]");
  const scene = $("[data-scene]");
  const setText = (selector, value) => {
    $(selector).textContent = String(value);
  };
  const showNotice = (selector, kind) => {
    const notice = $(selector);
    notice.textContent = STORAGE_NOTICES[kind] ?? "";
    notice.hidden = !STORAGE_NOTICES[kind];
  };

  let missTimer = 0;
  let sceneTimer = 0;
  let bubbleTimer = 0;
  // ルールの合図(ダッシュ注意・ダッシュ中・ミスで加速中・追い詰め中)を、いま出している一覧
  let cues = [];
  const cueBox = $("[data-rule-cues]");
  // 合図を、文字(ゲージの横。読み上げ対象)と、場面の見た目(data-cues。CSS)で出す。
  // 変わらない合図の文字は、作り直さない(読み上げが、くり返されないように)
  function renderCues(tokens) {
    if (tokens.length === cues.length && tokens.every((token, i) => token === cues[i])) return;
    cues = tokens;
    scene.dataset.cues = tokens.join(" ");
    const shown = new Map([...cueBox.children].map((node) => [node.dataset.cue, node]));
    for (const [token, node] of shown) if (!tokens.includes(token)) node.remove();
    // 順番(CUE_ORDER)どおりに置く。すでにあって、正しい位置にある文字は、動かさない
    tokens.forEach((token, index) => {
      const node =
        shown.get(token) ?? el("span", { class: "gauge__cue", "data-cue": token }, cueLabel(token));
      if (cueBox.children[index] !== node)
        cueBox.insertBefore(node, cueBox.children[index] ?? null);
    });
  }
  const banner = $("[data-banner]");
  const bubble = $("[data-bubble]");

  // 開始・終わりの演出(バナー)を、出している間か
  const staging = () => !banner.hidden;
  // 演出を消す(場面の演出・バナー・吹き出し)。画面が替わるたびに呼ぶ
  function clearStaging() {
    banner.hidden = true;
    renderCues([]);
    scene.dataset.stage = "";
    scene.dataset.outro = "";
    clearTimeout(bubbleTimer);
    bubble.hidden = true;
  }

  input.addEventListener("focus", () => {
    $("[data-focus-hint]").hidden = true;
  });
  input.addEventListener("blur", () => {
    if (!views.play.hidden) $("[data-focus-hint]").hidden = false;
  });

  function showView(name) {
    clearStaging();
    for (const [key, section] of Object.entries(views)) section.hidden = key !== name;
  }

  const checkedValue = (name) => root.querySelector(`input[name="${name}"]:checked`)?.value;
  const currentMode = () => (checkedValue("mode") === "check" ? "check" : "chase");

  // 用語確認では、追ってくる人の選択・説明の設定(いつも表示する)を隠し、開始のボタンの文言を変える
  function applyMode() {
    const check = currentMode() === "check";
    $("[data-role-fieldset]").hidden = check;
    $("[data-explanation-option]").hidden = check;
    $("[data-weak-option]").hidden = check;
    $("[data-start]").textContent = check ? "用語確認を始める" : "スタート";
  }

  function option(name, { value, label, sub, checked, disabled, badge }) {
    return el(
      "label",
      { class: "job-option" },
      el("input", {
        class: "job-option__input",
        type: "radio",
        name,
        value,
        checked,
        disabled,
      }),
      el(
        "span",
        { class: "job-option__label" },
        el("span", { class: "job-option__name" }, label),
        sub ? el("span", { class: "job-option__sub" }, sub) : "",
        badge ? el("span", { class: "badge badge--soon" }, badge) : "",
      ),
    );
  }

  // 選んだ役職の、特殊ルールの説明(ルールがなければ、その旨)。役職を選び直すたびに、更新する
  let setupRoles = [];
  function updateRoleRules() {
    const role = setupRoles.find((item) => item.id === checkedValue("role"));
    const box = $("[data-role-rules]");
    box.hidden = !role;
    if (!role) return;
    const rules = describeRules(role.stage);
    setText("[data-role-rules-name]", role.name);
    $("[data-role-rules-list]").replaceChildren(
      ...(rules.length > 0 ? rules : ["特殊ルールはありません。基本の追いかけっこです。"]).map(
        (text) => el("li", {}, text),
      ),
    );
  }

  function renderSetup({ jobs, roles, isUnlocked }) {
    setupRoles = roles;
    const jobId = checkedValue("job");
    let roleId = checkedValue("role");
    const selectedJob = jobs.some((job) => job.id === jobId) ? jobId : jobs[0].id;
    const selectableRole = roles.find((role) => role.id === roleId && isUnlocked(role));
    roleId = selectableRole ? roleId : roles.find((role) => isUnlocked(role)).id;

    const mode = currentMode();
    $("[data-mode-list]").replaceChildren(
      ...MODES.map((item) => option("mode", { ...item, checked: item.value === mode })),
    );
    $("[data-job-list]").replaceChildren(
      ...jobs.map((job) =>
        option("job", { value: job.id, label: job.name, checked: job.id === selectedJob }),
      ),
    );
    $("[data-role-list]").replaceChildren(
      ...roles.map((role) => {
        const unlocked = isUnlocked(role);
        return option("role", {
          value: role.id,
          label: role.name,
          sub: role.vehicle,
          checked: unlocked && role.id === roleId,
          disabled: !unlocked,
          badge: unlocked ? "" : "ロック中",
        });
      }),
    );
    const locked = roles.filter((role) => !isUnlocked(role));
    const hint = $("[data-role-hint]");
    hint.textContent = locked.map((role) => `${role.name}: ${role.unlock.hint}`).join(" / ");
    hint.hidden = locked.length === 0;
    updateRoleRules();
    $("[data-start]").disabled = false;
    applyMode();
  }

  function renderProfile({ profile, titles }) {
    $("[data-nickname]").value = profile.nickname;
    const select = $("[data-title-select]");
    select.replaceChildren(
      ...titles.map((title) =>
        el("option", { value: title.id, selected: title.id === profile.titleId }, title.name),
      ),
    );
  }

  function renderRanking({ entries, jobsById }) {
    $("[data-ranking-empty]").hidden = entries.length > 0;
    $("[data-ranking-table]").hidden = entries.length === 0;
    $("[data-ranking-body]").replaceChildren(
      ...entries.map((entry, index) =>
        el(
          "tr",
          {},
          el("th", { scope: "row", class: "ranking__rank" }, `${index + 1}位`),
          el(
            "td",
            {},
            el("span", { class: "ranking__name" }, entry.nickname),
            entry.title ? el("span", { class: "ranking__title" }, entry.title) : "",
          ),
          el(
            "td",
            { class: "ranking__score" },
            el("span", { class: "ranking__points" }, formatNumber(entry.score)),
            el(
              "span",
              { class: "ranking__meta" },
              `${jobsById[entry.jobId] ?? entry.jobId} ・ ${formatDate(entry.playedAt)}`,
            ),
          ),
        ),
      ),
    );
  }

  function achievementItem(definition, unlockedAt) {
    const unlocked = unlockedAt !== undefined;
    return el(
      "li",
      { class: `achievement ${unlocked ? "is-unlocked" : "is-locked"}` },
      el(
        "p",
        { class: "achievement__name" },
        definition.name,
        el(
          "span",
          { class: `badge ${unlocked ? "badge--live" : "badge--soon"}` },
          unlocked ? "解放済み" : "未解放",
        ),
      ),
      el("p", { class: "achievement__text" }, definition.description),
      definition.title || unlocked
        ? el(
            "p",
            { class: "achievement__meta" },
            [
              definition.title ? `称号「${definition.title}」` : "",
              unlocked ? formatDate(unlockedAt) : "",
            ]
              .filter(Boolean)
              .join(" ・ "),
          )
        : "",
    );
  }

  // 今回のミス分析。キー名は a-z・0-9・- だけだが、他の文字列と同じく textContent で入れる。
  const keyBadge = (key) => el("kbd", { class: "key" }, key);

  function renderAnalysis({ misses, keys, confusions }) {
    $("[data-analysis-empty]").hidden = misses > 0;
    $("[data-analysis-body]").hidden = misses === 0;
    $("[data-analysis-keys]").replaceChildren(
      ...keys.map(({ key, misses: count, attempts }) =>
        el("li", {}, keyBadge(key), ` を ${count}回ミス(このキーを打つ場面 ${attempts}回のうち)`),
      ),
    );
    $("[data-analysis-confusions]").replaceChildren(
      ...confusions.map(({ expected, typed, count }) =>
        el("li", {}, keyBadge(expected), " のところで ", keyBadge(typed), ` を打った ${count}回`),
      ),
    );
  }

  const renderReviewList = (selector, entries) => {
    $(selector).replaceChildren(...entries.map(reviewItem));
  };

  function renderAchievements({ definitions, unlocked }) {
    const done = definitions.filter((definition) => definition.id in unlocked).length;
    setText("[data-achievement-summary]", `解放済み ${done} / ${definitions.length}`);
    $("[data-achievement-list]").replaceChildren(
      ...definitions.map((definition) => achievementItem(definition, unlocked[definition.id])),
    );
  }

  return {
    input,
    $,

    // イベントの登録(1回だけ呼ぶ)
    bind({
      onStart,
      onExplanationChange,
      onWeakBoostChange,
      onInputStyleChange,
      onSoundModeChange,
      onSoundVolumeInput,
      onSoundVolumeChange,
      onSoundTest,
      onSoundToggle,
      onProfileChange,
      onRankingRoleChange,
      onRetry,
      onBack,
      onQuit,
      onCheckRetry,
    }) {
      $("[data-setup]").addEventListener("submit", (event) => {
        event.preventDefault();
        const mode = currentMode();
        const jobId = checkedValue("job");
        const roleId = checkedValue("role");
        if (jobId && (mode === "check" || roleId)) onStart({ mode, jobId, roleId });
      });
      $("[data-mode-list]").addEventListener("change", applyMode);
      $("[data-role-list]").addEventListener("change", updateRoleRules);
      $("[data-show-explanation]").addEventListener("change", (event) =>
        onExplanationChange(event.target.checked),
      );
      $("[data-weak-boost]").addEventListener("change", (event) =>
        onWeakBoostChange(event.target.value),
      );
      $("[data-input-style]").addEventListener("change", (event) =>
        onInputStyleChange(event.target.value),
      );
      $("[data-sound-mode]").addEventListener("change", (event) =>
        onSoundModeChange(event.target.value),
      );
      // スライダーは、動かしている間(input)は、音量と表示だけ変え、離したとき(change)に保存する
      $("[data-sound-volume]").addEventListener("input", (event) =>
        onSoundVolumeInput(Number(event.target.value)),
      );
      $("[data-sound-volume]").addEventListener("change", (event) =>
        onSoundVolumeChange(Number(event.target.value)),
      );
      $("[data-sound-test]").addEventListener("click", onSoundTest);
      // プレイ中の「音」ボタン。押したあとも、入力欄で、続けて打てるように、フォーカスを戻す
      $("[data-sound-toggle]").addEventListener("click", () => {
        onSoundToggle();
        input.focus();
      });
      $("[data-check-retry]").addEventListener("click", onCheckRetry);
      $("[data-check-back]").addEventListener("click", onBack);
      const profileChanged = () =>
        onProfileChange({
          nickname: $("[data-nickname]").value,
          titleId: $("[data-title-select]").value,
        });
      $("[data-nickname]").addEventListener("change", profileChanged);
      $("[data-title-select]").addEventListener("change", profileChanged);
      $("[data-profile]").addEventListener("submit", (event) => {
        event.preventDefault();
        profileChanged();
      });
      $("[data-ranking-role]").addEventListener("change", (event) =>
        onRankingRoleChange(event.target.value),
      );
      $("[data-retry]").addEventListener("click", onRetry);
      $("[data-back]").addEventListener("click", onBack);
      $("[data-quit]").addEventListener("click", onQuit);
    },

    announce(message) {
      setText("[data-announce]", message);
    },

    showError(message) {
      const error = $("[data-error]");
      error.textContent = message;
      error.hidden = !message;
    },

    // ダッシュボード全体を描画する。選択中の職種・役職は、可能なら保持する。
    renderDashboard({
      jobs,
      roles,
      isUnlocked,
      profile,
      titles,
      rankingRoleId,
      ranking,
      jobsById,
      achievements,
      unlocked,
      storageNotice,
    }) {
      renderSetup({ jobs, roles, isUnlocked });
      renderProfile({ profile, titles });
      $("[data-ranking-role]").replaceChildren(
        ...roles.map((role) =>
          el("option", { value: role.id, selected: role.id === rankingRoleId }, role.name),
        ),
      );
      renderRanking({ entries: ranking, jobsById });
      renderAchievements({ definitions: achievements, unlocked });
      showNotice("[data-storage-notice]", storageNotice);
    },

    renderRanking,

    // 「プレイ中に、用語の説明も表示する」のチェック(保存されていた設定を反映する)
    setExplanationSetting(checked) {
      $("[data-show-explanation]").checked = checked;
    },

    // 「苦手な語の出やすさ」の選択(保存されていた設定を反映する)
    setWeakBoostSetting(level) {
      $("[data-weak-boost]").value = level;
    },

    // 「ローマ字の書き方」の選択(保存されていた設定を反映する)
    setInputStyleSetting(name) {
      $("[data-input-style]").value = name;
    },

    // 音の設定(選択・音量・プレイ中の「音」ボタンの状態)を反映する
    setSoundSettings({ soundMode, volume }) {
      $("[data-sound-mode]").value = soundMode;
      $("[data-sound-volume]").value = String(volume);
      setText("[data-sound-volume-value]", volume);
      const on = soundMode !== "off";
      const toggle = $("[data-sound-toggle]");
      toggle.setAttribute("aria-pressed", String(on));
      setText("[data-sound-state]", on ? "あり" : "なし");
    },

    setNickname(nickname) {
      $("[data-nickname]").value = nickname;
    },

    showDashboard() {
      showView("dashboard");
      input.value = "";
      $("[data-title]").focus();
    },

    // mode: "chase"(連続タイピング)か "check"(用語確認)。用語確認では、説明を、いつも表示する
    showPlay({ mode = "chase", job, jobName, role, goal, showExplanation = false }) {
      const check = mode === "check";
      showView("play");
      views.play.dataset.mode = mode;
      views.play.setAttribute("aria-label", check ? "用語確認中" : "プレイ中");
      for (const node of root.querySelectorAll("[data-chase-only]")) node.hidden = check;
      $("[data-check-note]").hidden = !check;
      $("[data-word-explanation]").hidden = !(check || showExplanation);
      setText('[data-stat-label="correct"]', check ? "確認済み" : "正解");
      setText('[data-stat="job"]', jobName);
      setText('[data-stat="goal"]', goal);
      if (!check) {
        setText('[data-stat="role"]', role.name);
        $("[data-chaser]").setAttribute("src", role.image);
        // 追ってくる人の動きは、役職ごとに決まっている(roles.json の scene.motion)
        scene.dataset.motion = motionOf(role);
        // 職種の背景は、その職種の絵だけを読み込む(決まった場所の SVG でなければ、背景なし)
        const background = backgroundOf(job);
        if (background) scene.style.setProperty("--scene-bg", `url("${background}")`);
        else scene.style.removeProperty("--scene-bg");
        scene.classList.remove("is-danger");
        scene.dataset.event = "";
      }
      $("[data-ime-hint]").hidden = true;
      $("[data-focus-hint]").hidden = true;
      input.value = "";
      input.focus();
    },

    renderWord(word, matcher) {
      setText("[data-word-japanese]", word.japanese);
      setText("[data-word-reading]", word.reading);
      setText("[data-word-explanation]", word.explanation ?? "");
      setText("[data-word-typed]", matcher.typed);
      setText("[data-word-rest]", matcher.remaining);
    },

    renderStats(state, stage) {
      const distance = Math.max(0, Math.ceil(state.distance));
      const ratio = Math.min(1, Math.max(0, state.distance / stage.max_distance));
      $("[data-gauge-fill]").style.width = `${(ratio * 100).toFixed(1)}%`;
      gauge.setAttribute("aria-valuenow", String(distance));
      gauge.setAttribute("aria-valuetext", `残り距離 ${distance}メートル`);
      const danger = isDanger(state.distance, stage.max_distance);
      gauge.classList.toggle("is-danger", danger);
      scene.classList.toggle("is-danger", danger);
      $("[data-danger]").hidden = !danger;
      scene.style.setProperty(
        "--closeness",
        closenessOf(state.distance, stage.max_distance).toFixed(3),
      );
      setText('[data-stat="distance"]', distance);
      setText('[data-stat="correct"]', state.correct);
      setText('[data-stat="miss"]', state.miss);
      // 特殊ルールの合図(遊んでいる間だけ。終わったら消す)
      renderCues(
        state.status === "playing" ? activeCues(rulesOf(stage), state, stage.max_distance) : [],
      );
    },

    // 開始・終わりの演出を出す(kind: intro / clear / over)。文字は、いつも textContent で入れる
    showStaging(kind, text, outroStyle = null) {
      // 一瞬の演出(ミス・正解)が残っていれば消す(終わりの演出を、最初から動かすため)
      clearTimeout(sceneTimer);
      scene.dataset.event = "";
      scene.dataset.stage = kind;
      // 終わりの演出(clear・over)の、役職ごとの見せ方(なければ、全役職共通の演出)
      scene.dataset.outro = (kind === "clear" || kind === "over") && outroStyle ? outroStyle : "";
      $("[data-banner-text]").textContent = text;
      banner.hidden = false;
    },

    clearStaging,

    // 演出を飛ばす操作(場面のクリック・入力欄にフォーカスがあるときの Enter・スペース・Esc)。
    // 演出を出している間だけ効く。文字のキーでは飛ばさない。ボタン・リンク・選択欄のキーは、奪わない
    bindSkip(onSkip) {
      scene.addEventListener("click", () => {
        if (staging()) onSkip();
      });
      document.addEventListener("keydown", (event) => {
        if (!staging() || !isSkipKey(event.key)) return;
        if (event.target !== input && event.target !== document.body) return;
        event.preventDefault();
        onSkip();
      });
    },

    // 追ってくる人の吹き出し(飾り。場面の中なので、読み上げない)。ms たつと消える
    showBubble(name, text, ms) {
      $("[data-bubble-name]").textContent = name;
      $("[data-bubble-text]").textContent = text;
      bubble.hidden = false;
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => {
        bubble.hidden = true;
      }, ms);
    },

    // 場面の一瞬の演出(miss = 追ってくる人が飛び出す / gain = 引き離す)。一定時間で、元に戻る
    pulseScene(kind) {
      if (!SCENE_EVENTS.includes(kind)) return;
      clearTimeout(sceneTimer);
      // 同じ演出が続けて起きても、最初から動かし直す
      scene.dataset.event = "";
      void scene.offsetWidth;
      scene.dataset.event = kind;
      sceneTimer = setTimeout(() => {
        scene.dataset.event = "";
      }, EVENT_MS);
    },

    // 用語確認の進み具合(確認済みの語数・ミス)
    renderCheckProgress(state) {
      setText('[data-stat="correct"]', state.index);
      setText('[data-stat="miss"]', state.miss);
    },

    // ミスは色だけでなく、文字と枠線の変化でも示す
    flashMiss() {
      inputBox.classList.add("is-miss");
      $("[data-miss]").textContent = "ミス!";
      clearTimeout(missTimer);
      missTimer = setTimeout(() => {
        inputBox.classList.remove("is-miss");
        $("[data-miss]").textContent = "";
      }, 400);
    },

    showImeWarning(visible) {
      $("[data-ime-hint]").hidden = !visible;
    },

    // 用語確認の結果(保存しない)。ミスした語と、今回の用語(説明つき)を出す
    showCheckResult({ jobName, summary, words, elapsed }) {
      showView("checkResult");
      const perfect = summary.miss === 0;
      setText(
        "[data-check-message]",
        perfect
          ? `${summary.total}語を、ミスなく確認できました。`
          : `${summary.total}語を確認しました。ミスした語は、下で説明を読み返せます。`,
      );
      setText('[data-check-stat="job"]', jobName);
      setText('[data-check-stat="total"]', `${summary.total}語`);
      setText('[data-check-stat="miss"]', `${summary.miss}回`);
      setText('[data-check-stat="accuracy"]', `${Math.round(summary.accuracy * 100)}%`);
      setText('[data-check-stat="time"]', `${elapsed.toFixed(1)}秒`);
      $("[data-check-missed]").hidden = summary.missed.length === 0;
      renderReviewList("[data-check-missed-list]", summary.missed);
      renderReviewList(
        "[data-check-words-list]",
        words.map((word) => ({ word, misses: 0 })),
      );
      $("[data-check-title]").focus();
    },

    showResult({
      state,
      stage,
      jobName,
      roleName,
      score,
      accuracy,
      cps = 0,
      averageDifficulty = null,
      rank,
      newAchievements,
      kaichoUnlocked,
      notice,
      analysis,
      missed = [],
      quote = "",
    }) {
      showView("result");
      renderAnalysis(analysis);
      $("[data-result-missed]").hidden = missed.length === 0;
      renderReviewList("[data-result-missed-list]", missed);
      const cleared = state.status === "cleared";
      setText("[data-result-title]", cleared ? "逃げ切った!" : "つかまった…");
      setText(
        "[data-result-message]",
        cleared
          ? `${roleName}から逃げ切りました。ステージクリア!`
          : `${roleName}に追いつかれました。もう一度挑戦しよう。`,
      );
      // 追ってくる人の最後のセリフ(演出で言ったもの)
      const quoteNode = $("[data-result-quote]");
      quoteNode.textContent = quote ? `${roleName}「${quote}」` : "";
      quoteNode.hidden = !quote;
      setText("[data-result-score]", formatNumber(score));
      const rankBadge = $("[data-result-rank]");
      if (cleared) {
        rankBadge.textContent = rank ? `ランキング ${rank}位` : "ランキング圏外";
      }
      rankBadge.hidden = !cleared;
      setText('[data-result-stat="job"]', jobName);
      setText('[data-result-stat="role"]', roleName);
      setText('[data-result-stat="correct"]', `${state.correct} / ${stage.goal_words}語`);
      setText('[data-result-stat="miss"]', `${state.miss}回`);
      setText('[data-result-stat="accuracy"]', `${Math.round(accuracy * 100)}%`);
      setText('[data-result-stat="speed"]', `${Math.round(cps * 60)}打/分`);
      setText('[data-result-stat="streak"]', `${state.bestStreak ?? 0}語`);
      setText(
        '[data-result-stat="difficulty"]',
        averageDifficulty === null ? "-" : averageDifficulty.toFixed(1),
      );
      setText('[data-result-stat="distance"]', `${Math.max(0, Math.ceil(state.distance))}m`);
      setText('[data-result-stat="time"]', `${state.elapsed.toFixed(1)}秒`);
      showNotice("[data-result-notice]", notice);

      const section = $("[data-result-new]");
      section.hidden = newAchievements.length === 0;
      $("[data-result-new-list]").replaceChildren(
        ...newAchievements.map((definition) => achievementItem(definition, Date.now())),
      );
      if (kaichoUnlocked) {
        $("[data-result-new-list]").append(
          el(
            "li",
            { class: "achievement is-unlocked" },
            el("p", { class: "achievement__name" }, "会長に挑戦できるようになりました!"),
          ),
        );
        section.hidden = false;
      }
      $("[data-result-title]").focus();
    },
  };
}
