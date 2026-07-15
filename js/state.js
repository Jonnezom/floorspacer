'use strict';

//  STATE
// ═══════════════════════════════════════════════════════════
let state = {
  rooms: [],
  walls: [],
  items: [],
  selectedId: null,
  selectedRoomId: null,
  selectedGateway: null,   // { wall, gw } when a gateway is selected
  selectedDoor: null,      // { wall, door } when a door is selected
  selectedWindow: null,    // { wall, window } when a window is selected
  editOpenings: false,     // must be true for doors/windows/gateways to be selectable/draggable
  dragRooms: false,        // must be true to drag a whole room's body (avoids accidental moves)
  mode: 'selectpan',
  lastSelectPanMode: 'selectpan', // remembers select/pan/selectpan combo across modal actions (draw/place/etc.)
  drawPoints: [],
  drawRole: null,   // 'building' | 'balcony' | 'callroom' | null — variant of 'draw' mode
  extendRoomId: null,    // room being extended in 'extend' mode
  extendFromStart: false, // true = prepending to points[0], false = appending after the end
  showGrid: true,
  snapToGrid: true,
  zoom: 1,
  panX: 40,
  panY: 40,
  licenseUnlocked: false,
  sidebarHidden: false,
  tutorialActive: false,
  tutorialStep: 0,
  units: localStorage.getItem('floorspacer_units') || 'metric', // 'metric' | 'imperial'
};

let undoStack = [];
let redoStack = [];
let nextId = 1;
let wallNextId = 1;

// ═══════════════════════════════════════════════════════════
//  ANALYTICS (Umami — usage-signal events only, never PII)
// ═══════════════════════════════════════════════════════════
function trackEvent(name, data) {
  try { window.umami?.track(name, data); } catch(e) { /* analytics must never break the app */ }
}

// ═══════════════════════════════════════════════════════════
