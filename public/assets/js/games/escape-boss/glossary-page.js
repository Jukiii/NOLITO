// 用語一覧ページ(/games/escape-boss/glossary/)。DOM に触れるのは、このファイルだけ。
// 表示する文字列は、すべて el()(textContent 相当)で入れる。データは、公開の語録の JSON だけ(通信は同じサイトだけ)。
import { el } from "../../components/dom.js";
import { countWords, glossaryGroups } from "./glossary.js";
import { reviewItem } from "./review-item.js";

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} (${response.status})`);
  return response.json();
}

async function init(root) {
  const $ = (selector) => root.querySelector(selector);
  const form = $("[data-glossary-form]");
  const input = $("[data-glossary-input]");
  const jobSelect = $("[data-glossary-job]");
  const status = $("[data-glossary-status]");
  const jump = $("[data-glossary-jump]");
  const list = $("[data-glossary-list]");

  let vocabularies;
  try {
    const jobs = await loadJson("/data/jobs.json");
    vocabularies = await Promise.all(
      jobs.map((job) => loadJson(`/data/vocabulary/${job.id}.json`)),
    );
    jobSelect.replaceChildren(
      el("option", { value: "" }, "すべての職種"),
      ...vocabularies.map((vocabulary) =>
        el("option", { value: vocabulary.job_id }, vocabulary.job_name),
      ),
    );
  } catch {
    status.textContent = "用語を読み込めませんでした。ページを再読み込みしてください。";
    return;
  }

  // アドレスの ?q=...&job=... から、初期状態を復元する(共有・ブックマークできる)。存在しない職種は、すべてに戻す
  const params = new URLSearchParams(location.search);
  input.value = params.get("q") ?? "";
  jobSelect.value = params.get("job") ?? "";

  function render() {
    const query = input.value.trim();
    const jobId = jobSelect.value;

    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (jobId) next.set("job", jobId);
    const search = next.toString();
    history.replaceState(null, "", search ? `?${search}` : location.pathname);

    const groups = glossaryGroups(vocabularies, { query, jobId });
    const shown = groups.filter((group) => group.words.length > 0);
    const total = countWords(groups);
    status.textContent =
      total > 0 ? `${total}語を表示しています。` : "見つかりませんでした。条件を変えてください。";

    jump.replaceChildren(
      ...shown.map((group) =>
        el("a", { href: `#job-${group.jobId}` }, `${group.jobName}(${group.words.length})`),
      ),
    );
    jump.hidden = shown.length < 2;

    list.replaceChildren(
      ...shown.map((group) =>
        el(
          "section",
          {
            class: "glossary__group",
            id: `job-${group.jobId}`,
            "aria-labelledby": `job-title-${group.jobId}`,
          },
          el(
            "h2",
            { class: "glossary__group-title", id: `job-title-${group.jobId}` },
            group.jobName,
            el("span", { class: "glossary__count" }, `${group.words.length}語`),
          ),
          el("ul", { class: "review-list" }, ...group.words.map((word) => reviewItem({ word }))),
        ),
      ),
    );
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    render();
  });
  input.addEventListener("input", render);
  jobSelect.addEventListener("change", render);
  render();
}

const root = document.querySelector("[data-glossary]");
if (root) init(root);
