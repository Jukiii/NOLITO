import { el } from "../../components/dom.js";
import { closenessOf } from "./scene.js";

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

export function createView(root) {
  const $ = (selector) => root.querySelector(selector);
  const views = {
    dashboard: $('[data-view="dashboard"]'),
    play: $('[data-view="play"]'),
    result: $('[data-view="result"]'),
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

  input.addEventListener("focus", () => {
    $("[data-focus-hint]").hidden = true;
  });
  input.addEventListener("blur", () => {
    if (!views.play.hidden) $("[data-focus-hint]").hidden = false;
  });

  function showView(name) {
    for (const [key, section] of Object.entries(views)) section.hidden = key !== name;
  }

  const checkedValue = (name) => root.querySelector(`input[name="${name}"]:checked`)?.value;

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

  function renderSetup({ jobs, roles, isUnlocked }) {
    const jobId = checkedValue("job");
    let roleId = checkedValue("role");
    const selectedJob = jobs.some((job) => job.id === jobId) ? jobId : jobs[0].id;
    const selectableRole = roles.find((role) => role.id === roleId && isUnlocked(role));
    roleId = selectableRole ? roleId : roles.find((role) => isUnlocked(role)).id;

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
    $("[data-start]").disabled = false;
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
    bind({ onStart, onProfileChange, onRankingRoleChange, onRetry, onBack, onQuit }) {
      $("[data-setup]").addEventListener("submit", (event) => {
        event.preventDefault();
        const jobId = checkedValue("job");
        const roleId = checkedValue("role");
        if (jobId && roleId) onStart({ jobId, roleId });
      });
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

    setNickname(nickname) {
      $("[data-nickname]").value = nickname;
    },

    showDashboard() {
      showView("dashboard");
      input.value = "";
      $("[data-title]").focus();
    },

    showPlay({ jobName, role, goal }) {
      showView("play");
      setText('[data-stat="job"]', jobName);
      setText('[data-stat="role"]', role.name);
      setText('[data-stat="goal"]', goal);
      $("[data-chaser]").setAttribute("src", role.image);
      $("[data-ime-hint]").hidden = true;
      $("[data-focus-hint]").hidden = true;
      input.value = "";
      input.focus();
    },

    renderWord(word, matcher) {
      setText("[data-word-japanese]", word.japanese);
      setText("[data-word-reading]", word.reading);
      setText("[data-word-typed]", matcher.typed);
      setText("[data-word-rest]", matcher.remaining);
    },

    renderStats(state, stage) {
      const distance = Math.max(0, Math.ceil(state.distance));
      const ratio = Math.min(1, Math.max(0, state.distance / stage.max_distance));
      $("[data-gauge-fill]").style.width = `${(ratio * 100).toFixed(1)}%`;
      gauge.setAttribute("aria-valuenow", String(distance));
      gauge.setAttribute("aria-valuetext", `残り距離 ${distance}メートル`);
      const danger = ratio <= 0.25;
      gauge.classList.toggle("is-danger", danger);
      $("[data-danger]").hidden = !danger;
      scene.style.setProperty(
        "--closeness",
        closenessOf(state.distance, stage.max_distance).toFixed(3),
      );
      setText('[data-stat="distance"]', distance);
      setText('[data-stat="correct"]', state.correct);
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

    showResult({
      state,
      stage,
      jobName,
      roleName,
      score,
      accuracy,
      rank,
      newAchievements,
      kaichoUnlocked,
      notice,
      analysis,
    }) {
      showView("result");
      renderAnalysis(analysis);
      const cleared = state.status === "cleared";
      setText("[data-result-title]", cleared ? "逃げ切った!" : "つかまった…");
      setText(
        "[data-result-message]",
        cleared
          ? `${roleName}から逃げ切りました。ステージクリア!`
          : `${roleName}に追いつかれました。もう一度挑戦しよう。`,
      );
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
