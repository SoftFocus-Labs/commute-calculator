// Generic confirmation modal.
//   open  -> fade + slide up        (300ms, ease-in-out)
//   close -> fade + scale-down      (300ms, ease-in-out)
// Usage:
//   const ok = await TripDialog.confirmDialog({ title, message, confirmText, danger });

(function () {
  const DURATION = 300;
  let activeResolve = null;
  let modal, titleEl, messageEl, okBtn, cancelBtn;

  function init() {
    modal = document.getElementById('confirm-modal');
    if (!modal) return;
    titleEl = document.getElementById('confirm-title');
    messageEl = document.getElementById('confirm-message');
    okBtn = document.getElementById('confirm-ok');
    cancelBtn = document.getElementById('confirm-cancel');

    okBtn.addEventListener('click', () => resolveActive(true));
    cancelBtn.addEventListener('click', () => resolveActive(false));
    modal.addEventListener('click', (e) => {
      // Clicks on the backdrop (the modal itself, not the card) cancel.
      if (e.target === modal) resolveActive(false);
    });
  }

  function resolveActive(value) {
    if (!activeResolve) return;
    const r = activeResolve;
    activeResolve = null;
    closeInternal();
    r(value);
  }

  function closeInternal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.classList.add('is-closing');
    modal.setAttribute('aria-hidden', 'true');
    setTimeout(() => modal.classList.remove('is-closing'), DURATION);
  }

  function confirmDialog({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) {
    if (!modal) init();
    // If a dialog is somehow already open, dismiss it before opening a new one.
    if (activeResolve) resolveActive(false);

    titleEl.textContent = title;
    messageEl.textContent = message;
    okBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    okBtn.classList.toggle('danger', !!danger);

    return new Promise((resolve) => {
      activeResolve = resolve;
      modal.classList.remove('is-closing');
      modal.setAttribute('aria-hidden', 'false');
      // Force reflow so a quick close/reopen replays the animation cleanly.
      void modal.offsetWidth;
      modal.classList.add('is-open');
    });
  }

  function isOpen() {
    return !!modal && modal.classList.contains('is-open');
  }

  function dismiss() {
    if (activeResolve) resolveActive(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.TripDialog = { confirmDialog, isOpen, dismiss };
})();
