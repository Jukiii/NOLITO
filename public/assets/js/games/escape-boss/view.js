import { el } from "../../components/dom.js";

// 画面の描画。HTML は index.html に静的に書き、ここでは data 属性を目印に中身だけを更新する。
// 文字列は textContent で入れる(語録データを HTML として解釈しない)。
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
  const setText = (selector, value) => {
    $(selector).textContent = String(value);
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

  return {
    input,
    $,

    announce(message) {
      setText("[data-announce]", message);
    },

    showError(message) {
      const error = $("[data-error]");
      error.textContent = message;
      error.hidden = !message;
    },

    renderDashboard(jobs, { onStart }) {
      const list = $("[data-job-list]");
      list.replaceChildren(
        ...jobs.map((job, index) =>
          el(
            "label",
            { class: "job-option" },
            el("input", {
              class: "job-option__input",
              type: "radio",
              name: "job",
              value: job.id,
              checked: index === 0,
            }),
            el("span", { class: "job-option__label" }, job.name),
          ),
        ),
      );
      const start = $("[data-start]");
      start.disabled = false;
      $("[data-setup]").addEventListener("submit", (event) => {
        event.preventDefault();
        const jobId = new FormData(event.currentTarget).get("job");
        if (jobId) onStart(String(jobId));
      });
    },

    showDashboard() {
      showView("dashboard");
      input.value = "";
      const title = $("[data-title]");
      title.focus();
    },

    showPlay({ jobName, roleName, goal }) {
      showView("play");
      setText('[data-stat="job"]', jobName);
      setText('[data-stat="role"]', roleName);
      setText('[data-stat="goal"]', goal);
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

    showResult({ state, stage, jobName, roleName }) {
      showView("result");
      const cleared = state.status === "cleared";
      setText("[data-result-title]", cleared ? "逃げ切った!" : "つかまった…");
      setText(
        "[data-result-message]",
        cleared
          ? `${roleName}から逃げ切りました。ステージクリア!`
          : `${roleName}に追いつかれました。もう一度挑戦しよう。`,
      );
      setText('[data-result-stat="job"]', jobName);
      setText('[data-result-stat="correct"]', `${state.correct} / ${stage.goal_words}語`);
      setText('[data-result-stat="miss"]', `${state.miss}回`);
      setText('[data-result-stat="distance"]', `${Math.max(0, Math.ceil(state.distance))}m`);
      setText('[data-result-stat="time"]', `${state.elapsed.toFixed(1)}秒`);
      $("[data-result-title]").focus();
    },

    onRetry(handler) {
      $("[data-retry]").addEventListener("click", handler);
    },
    onBack(handler) {
      $("[data-back]").addEventListener("click", handler);
    },
    onQuit(handler) {
      $("[data-quit]").addEventListener("click", handler);
    },
  };
}
