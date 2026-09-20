// 問い合わせフォーム(/support/ の #contact)。DOM に触れるのは、このファイルだけ。
// 表示する文字列は、必ず textContent(el())で入れる。送信する前に、内容(と添付する環境の情報)を、利用者に見せる。
import { el } from "../components/dom.js";
import { fetchContactEnabled, fetchProductOptions, sendInquiry } from "./client.js";
import { contactErrorMessage } from "./messages.js";
import {
  CATEGORIES,
  MESSAGE_MAX,
  buildPayload,
  collectEnv,
  countChars,
  envSummary,
  validateForm,
} from "./rules.js";

const root = document.querySelector("[data-contact]");
if (root) init(root);

// 画面に出す順(エラーのとき、いちばん上の項目に、フォーカスを移す)
const FIELDS = ["category", "message", "email"];

async function init(root) {
  const $ = (selector) => root.querySelector(selector);
  const form = $("[data-contact-form]");
  const status = $("[data-contact-status]");
  const done = $("[data-contact-done]");
  const submit = $("[data-contact-submit]");
  const category = $("#contact-category");
  const product = $("#contact-product");
  const message = $("#contact-message");
  const email = $("#contact-email");
  const includeEnv = $("#contact-env");
  const envPreview = $("[data-contact-env-preview]");
  const count = $("[data-contact-count]");
  const inputs = { category, message, email };

  const enabled = await fetchContactEnabled();
  $("[data-contact-loading]").hidden = true;
  if (!enabled) {
    $("[data-contact-unavailable]").hidden = false;
    return;
  }

  // 選択肢(種類は、規則から。対象のプロダクトは、公開の products.json から)
  category.append(
    el("option", { value: "" }, "選んでください"),
    ...CATEGORIES.map((item) => el("option", { value: item.value }, item.label)),
  );
  product.append(el("option", { value: "" }, "サイト全体・そのほか"));
  const versions = new Map();
  for (const item of await fetchProductOptions()) {
    versions.set(item.id, item.version);
    product.append(el("option", { value: item.id }, item.title));
  }

  let openedAt = performance.now();
  let submitting = false;
  form.hidden = false;

  const say = (text, isError = false) => {
    status.textContent = text ? `${isError ? "エラー: " : ""}${text}` : "";
    status.classList.toggle("contact__status--error", isError && Boolean(text));
  };

  function showError(field, code) {
    const box = $(`#contact-${field}-error`);
    const input = inputs[field];
    const describedBy = (input.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .filter((id) => id && id !== box.id);
    if (code) {
      box.textContent = `エラー: ${contactErrorMessage(code)}`;
      box.hidden = false;
      input.setAttribute("aria-invalid", "true");
      describedBy.push(box.id);
    } else {
      box.textContent = "";
      box.hidden = true;
      input.removeAttribute("aria-invalid");
    }
    input.setAttribute("aria-describedby", describedBy.join(" "));
  }

  const currentEnv = () =>
    collectEnv({
      width: window.innerWidth,
      height: window.innerHeight,
      language: navigator.language,
      version: versions.get(product.value),
    });

  function updateEnvPreview() {
    envPreview.hidden = !includeEnv.checked;
    if (includeEnv.checked) envPreview.textContent = `添付する内容: ${envSummary(currentEnv())}`;
  }

  function updateCount() {
    const length = countChars(message.value);
    count.textContent = `${length} / ${MESSAGE_MAX} 文字${length > MESSAGE_MAX ? "(超えています)" : ""}`;
    count.classList.toggle("contact__count--over", length > MESSAGE_MAX);
  }

  message.addEventListener("input", updateCount);
  includeEnv.addEventListener("change", updateEnvPreview);
  product.addEventListener("change", updateEnvPreview);
  updateCount();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting) return;

    const values = {
      category: category.value,
      message: message.value,
      email: email.value,
    };
    const errors = validateForm(values);
    for (const field of FIELDS) showError(field, errors[field]);
    const invalid = FIELDS.filter((field) => errors[field]);
    if (invalid.length > 0) {
      say(`入力に誤りがあります(${invalid.length} 件)。`, true);
      inputs[invalid[0]].focus();
      return;
    }

    submitting = true;
    submit.disabled = true;
    say("送信しています…");
    const result = await sendInquiry(
      buildPayload({
        ...values,
        product: product.value,
        includeEnv: includeEnv.checked,
        env: currentEnv(),
        website: form.elements.website.value,
        elapsed: Math.round(performance.now() - openedAt),
      }),
    );
    submitting = false;
    submit.disabled = false;

    if (result.ok) {
      form.reset();
      updateCount();
      updateEnvPreview();
      say("");
      form.hidden = true;
      done.hidden = false;
      done.focus();
      return;
    }
    // 入力の誤りは、その項目に、示す(送った内容は、残す)
    const field =
      { "contact-category": "category", "contact-email": "email" }[result.code] ??
      (result.code?.startsWith("contact-message") ? "message" : null);
    if (field) {
      showError(field, result.code);
      inputs[field].focus();
    }
    say(result.message, true);
  });

  // 続けて、別の内容を送る(フォームを開き直す)
  $("[data-contact-again]").addEventListener("click", () => {
    done.hidden = true;
    form.hidden = false;
    openedAt = performance.now();
    category.focus();
  });
}
