'use strict';

//  TUTORIAL WALKTHROUGH
// ═══════════════════════════════════════════════════════════
const tutorialSeen = localStorage.getItem('floorspacer_tutorial_seen') === '1';
function markTutorialSeen() {
  try { localStorage.setItem('floorspacer_tutorial_seen', '1'); } catch(e) {}
}

let tutorialBaseline = { roomCount: 0, doorCount: 0, saved: false, shiftJoined: false };
function countAllDoors() {
  return state.walls.reduce((n, w) => n + w.doors.length, 0);
}

const TUTORIAL_STEPS = [
  {
    target: '#btn-room',
    text: 'Click here to start drawing a room.',
    complete: () => state.mode === 'draw' && state.drawRole == null,
  },
  {
    target: '#main-canvas',
    text: 'Click to place corners. Click back on your first point (or press Enter / double-click) to finish the room.',
    complete: () => state.rooms.length > tutorialBaseline.roomCount,
  },
  {
    target: '#dim-popup',
    text: "After each corner, this popup lets you type an exact wall length and direction instead of eyeballing it. Adjust a value or click outside to accept, then keep going.",
    manualAdvance: true,
  },
  {
    target: '#right-panel',
    text: "With a room selected, this panel lets you rename it, toggle its name/area labels, change wall color, and fine-tune each wall's length and angle precisely.",
    manualAdvance: true,
  },
  {
    target: '#btn-opening',
    text: 'Now add a door. Pick Door from this menu.',
    complete: () => state.mode === 'door',
  },
  {
    target: '#main-canvas',
    text: "Click on one of your room's walls to place the door.",
    complete: () => countAllDoors() > tutorialBaseline.doorCount,
  },
  {
    target: '#right-panel',
    text: 'Selecting a door, window, or gateway opens its own panel here. Adjust its width, type, or swing direction.',
    manualAdvance: true,
  },
  {
    target: '#main-canvas',
    text: 'Power tip: hold Shift while clicking on an existing wall to join it without finishing your room. This lets you keep drawing past it.',
    complete: () => tutorialBaseline.shiftJoined,
    manualAdvance: true,
  },
  {
    target: '#room-menu-callroom',
    text: 'Power tip: Call Room traces an area as a label only. It creates no new walls, just a name and area.',
    complete: () => state.drawRole === 'callroom',
    manualAdvance: true,
  },
  {
    target: '#btn-save',
    text: 'Save your work any time with this button.',
    complete: () => tutorialBaseline.saved,
  },
  {
    target: '#btn-load',
    text: 'Load brings back any saved design later, from this device, whenever you return.',
    manualAdvance: true,
  },
  {
    target: '#btn-export',
    text: 'Export renders your design as a PNG image, ready to share or print.',
    manualAdvance: true,
  },
];

function tutorialCheckAdvance() {
  if (!state.tutorialActive) return;
  const step = TUTORIAL_STEPS[state.tutorialStep];
  if (step && step.complete && step.complete()) tutorialAdvance();
}

function tutorialAdvance() {
  state.tutorialStep++;
  if (state.tutorialStep >= TUTORIAL_STEPS.length) { trackEvent('tutorial_completed'); endTutorial(); return; }
  renderTutorialStep();
}

function startTutorial() {
  state.tutorialActive = true;
  state.tutorialStep = 0;
  tutorialBaseline = {
    roomCount: state.rooms.length,
    doorCount: countAllDoors(),
    saved: false,
    shiftJoined: false,
  };
  trackEvent('tutorial_started');
  renderTutorialStep();
}

function endTutorial(skipped) {
  if (skipped && state.tutorialActive) trackEvent('tutorial_skipped', { atStep: state.tutorialStep });
  state.tutorialActive = false;
  document.getElementById('tutorial-highlight-ring').classList.remove('show');
  document.getElementById('tutorial-tooltip').classList.remove('show');
  markTutorialSeen();
}

function renderTutorialStep() {
  if (!state.tutorialActive) return;
  const step = TUTORIAL_STEPS[state.tutorialStep];
  if (!step) { endTutorial(); return; }
  let target = document.querySelector(step.target);
  if (target && target.getBoundingClientRect().width === 0 && target.getBoundingClientRect().height === 0) target = null;
  const ring = document.getElementById('tutorial-highlight-ring');
  const tooltip = document.getElementById('tutorial-tooltip');
  if (!target) {
    ring.classList.remove('show');
    tooltip.style.left = `${(window.innerWidth - 280) / 2}px`;
    tooltip.style.top = `${window.innerHeight / 2 - 80}px`;
  } else {
    const r = target.getBoundingClientRect();
    ring.style.top = `${r.top - 4}px`;
    ring.style.left = `${r.left - 4}px`;
    ring.style.width = `${r.width + 8}px`;
    ring.style.height = `${r.height + 8}px`;
    ring.classList.add('show');

    const tw = 280, gap = 12;
    let left = r.right + gap;
    if (left + tw > window.innerWidth - 10) left = Math.max(10, r.left - tw - gap);
    let top = Math.min(Math.max(10, r.top), window.innerHeight - 160);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }
  document.getElementById('tutorial-progress').textContent = `Step ${state.tutorialStep + 1} of ${TUTORIAL_STEPS.length}`;
  document.getElementById('tutorial-tooltip-text').textContent = step.text;
  document.getElementById('tutorial-next').textContent = step.manualAdvance ? 'Got it' : 'Skip this step';
  tooltip.classList.add('show');
}

document.getElementById('tutorial-skip').addEventListener('click', () => endTutorial(true));
document.getElementById('tutorial-next').addEventListener('click', tutorialAdvance);
document.getElementById('btn-tutorial').addEventListener('click', startTutorial);
window.addEventListener('resize', () => { if (state.tutorialActive) renderTutorialStep(); });
document.getElementById('canvas-wrap').addEventListener('scroll', () => { if (state.tutorialActive) renderTutorialStep(); });

(function installTutorialHooks() {
  const _setMode = setMode;
  setMode = function(...args) { _setMode.apply(this, args); tutorialCheckAdvance(); };

  const _finishDrawing = finishDrawing;
  finishDrawing = function(...args) { _finishDrawing.apply(this, args); tutorialCheckAdvance(); };

  const _finishExtendRoom = finishExtendRoom;
  finishExtendRoom = function(...args) { _finishExtendRoom.apply(this, args); tutorialCheckAdvance(); };

  const _saveToLocal = saveToLocal;
  saveToLocal = function(...args) {
    _saveToLocal.apply(this, args);
    if (state.tutorialActive) tutorialBaseline.saved = true;
    tutorialCheckAdvance();
  };

  const _handleDrawClick = handleDrawClick;
  handleDrawClick = function(wp, e) {
    if (state.tutorialActive && e && e.shiftKey) tutorialBaseline.shiftJoined = true;
    _handleDrawClick.call(this, wp, e);
    tutorialCheckAdvance();
  };
})();

// ═══════════════════════════════════════════════════════════
//  TOOLBAR STATE INIT
// ═══════════════════════════════════════════════════════════
document.getElementById('view-grid-checkbox').checked = state.showGrid;
document.getElementById('view-snap-checkbox').checked = state.snapToGrid;
document.getElementById('view-edit-openings-checkbox').checked = state.editOpenings;
document.getElementById('view-drag-rooms-checkbox').checked = state.dragRooms;

// ═══════════════════════════════════════════════════════════
