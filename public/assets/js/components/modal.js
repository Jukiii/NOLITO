// <dialog class="modal"> の開閉。data-modal-open="<id>" で開き、data-modal-close で閉じる。
// フォーカストラップ・Esc・閉じた後のフォーカス復帰はブラウザ標準の <dialog> が行う。
export function initModals() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const opener = target.closest("[data-modal-open]");
    if (opener) {
      const dialog = document.getElementById(opener.dataset.modalOpen);
      if (dialog instanceof HTMLDialogElement) dialog.showModal();
      return;
    }

    if (target.closest("[data-modal-close]")) {
      target.closest("dialog")?.close();
      return;
    }

    // ::backdrop のクリックは dialog 自身へのクリックとして届く(内側は .modal__body が埋める)
    if (target instanceof HTMLDialogElement && target.classList.contains("modal")) {
      target.close();
    }
  });
}
