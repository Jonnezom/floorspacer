'use strict';

//  CUSTOM TOOLTIPS (faster, smaller, more transparent than native title tooltips)
// ═══════════════════════════════════════════════════════════
(function setupCustomTooltips() {
  const TOOLTIP_DELAY = 700;
  const tooltipEl = document.getElementById('custom-tooltip');
  let hoverTarget = null;
  let showTimer = null;

  function positionTooltip(target) {
    const rect = target.getBoundingClientRect();
    const tw = tooltipEl.offsetWidth;
    let left = rect.left + rect.width / 2 - tw / 2;
    left = Math.max(4, Math.min(left, window.innerWidth - tw - 4));
    tooltipEl.style.left = left + 'px';
    tooltipEl.style.top = (rect.bottom + 6) + 'px';
  }

  function hideTooltip() {
    clearTimeout(showTimer);
    tooltipEl.classList.remove('show');
    hoverTarget = null;
  }

  document.addEventListener('mouseover', e => {
    const target = e.target.closest('[title]');
    if (!target || target === hoverTarget) return;
    hideTooltip();
    const text = target.getAttribute('title');
    if (!text) return;
    // Suppress the native browser tooltip while we own hover feedback for this element.
    target.dataset.tooltipText = text;
    target.removeAttribute('title');
    hoverTarget = target;
    showTimer = setTimeout(() => {
      tooltipEl.textContent = text;
      tooltipEl.classList.add('show');
      positionTooltip(target);
    }, TOOLTIP_DELAY);
  });

  document.addEventListener('mouseout', e => {
    const target = e.target.closest('[data-tooltip-text]');
    if (!target) return;
    if (!target.contains(e.relatedTarget)) {
      target.setAttribute('title', target.dataset.tooltipText);
      delete target.dataset.tooltipText;
      hideTooltip();
    }
  });

  document.addEventListener('mousedown', hideTooltip);
})();

// Started here (not in geometry.js) so its callback's render() call is
// guaranteed to already be defined — see the comment in geometry.js for why
// this moved during the multi-file split.
new ResizeObserver(() => resizeCanvas()).observe(canvasWrap);

// Registered here (not in account-auth.js) so every function it calls
// (applyTierGating, updateAccountUI, openAccountModal, showPasswordResetForm)
// is guaranteed to already be defined — see the comment in account-auth.js
// for why this moved during the multi-file split.
sb.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    inPasswordRecovery = true;
    openAccountModal();
    showPasswordResetForm();
    return;
  }
  refreshTierFromServer();
});

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════
loadFromLocal();
seedDesignsFromLegacySave();
applyTierGating();
returnToSelectMode();
if (!tutorialSeen) startTutorial();
