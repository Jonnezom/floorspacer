'use strict';

//  TOOLBAR BUTTONS
// ═══════════════════════════════════════════════════════════
function setMode(mode, drawRole) {
  const wasDrawing = state.mode === 'draw' || state.mode === 'drawwall' || state.mode === 'extend';
  const stillDrawing = mode === 'draw' || mode === 'drawwall' || mode === 'extend';
  if (!stillDrawing) { state.drawPoints = []; state.extendRoomId = null; }
  if (mode === 'select' || mode === 'pan' || mode === 'selectpan') state.lastSelectPanMode = mode;
  state.mode = mode;
  state.drawRole = (mode === 'draw' || mode === 'drawwall') ? (drawRole || null) : null;
  // Select mode now also pans on empty-canvas drag, so both buttons read as
  // active together — they're two entry points into the same mode.
  document.getElementById('btn-move').classList.toggle('active', mode === 'select' || mode === 'selectpan');
  document.getElementById('btn-pan').classList.toggle('active', mode === 'pan' || mode === 'selectpan');
  document.getElementById('btn-draw-wall').classList.toggle('active', mode === 'drawwall');
  const isRoomMode = mode === 'draw';
  document.getElementById('btn-room').classList.toggle('active', isRoomMode);
  const roomModeKey = isRoomMode ? (state.drawRole || 'room') : null;
  const roomLabels = { room: 'Room', building: 'Building', balcony: 'Balcony', callroom: 'Call Room' };
  document.getElementById('btn-room-label').textContent = isRoomMode ? roomLabels[roomModeKey] : 'Room';
  document.querySelectorAll('#room-menu .opening-menu-item').forEach(el => el.classList.remove('active'));
  if (isRoomMode) {
    const el = document.getElementById(`room-menu-${roomModeKey}`);
    if (el) el.classList.add('active');
  }
  const isOpeningMode = mode === 'door' || mode === 'window' || mode === 'gateway';
  document.getElementById('btn-opening').classList.toggle('active', isOpeningMode);
  const openingLabels = { door: 'Door', window: 'Window', gateway: 'Gateway' };
  document.getElementById('btn-opening-label').textContent = isOpeningMode ? openingLabels[mode] : 'Opening';
  document.querySelectorAll('.opening-menu-item').forEach(el => el.classList.remove('active'));
  if (isOpeningMode) {
    const el = document.getElementById(`opening-menu-${mode}`);
    if (el) el.classList.add('active');
  }
  const isDrawMode = mode === 'draw' || mode === 'drawwall' || mode === 'extend' || mode === 'door' || mode === 'window' || mode === 'gateway';
  canvas.className = isDrawMode ? 'draw-mode' : (mode === 'select' || mode === 'pan' || mode === 'selectpan' ? 'drag-mode' : '');
  const modeNames = { select: 'Select', pan: 'Pan', selectpan: 'Select / Pan', idle: 'Idle', draw: 'Draw Room', drawwall: 'Draw Wall', extend: 'Continue Wall', door: 'Door', window: 'Window', gateway: 'Gateway' };
  const roleNames = { building: 'Draw Building', balcony: 'Draw Balcony', callroom: 'Call Room' };
  document.getElementById('sb-mode').textContent = `Mode: ${(state.drawRole && roleNames[state.drawRole]) || modeNames[mode] || mode}`;
  if (!stillDrawing) closeDimPopup();
  render();
}

// Returns to whichever select/pan combination was active before a modal
// action (drawing, placing furniture/openings, etc.) started, instead of
// always collapsing to plain 'select' and silently dropping Pan's active state.
function returnToSelectMode() {
  setMode(state.lastSelectPanMode);
}

// Select and Pan are independent toggles that combine: either alone gives a
// pure mode (select-only: click to select anything, no click-drag panning;
// pan-only: drag from anywhere pans, nothing is ever selected), and having
// both on at once gives 'selectpan' (today's original behavior: click
// selects, click-drag on empty canvas pans). Toggling either off from the
// combined state drops back to just the other; both off goes 'idle'.
function toggleSelectMode() {
  const wantSelect = !(state.mode === 'select' || state.mode === 'selectpan');
  const hasPan = state.mode === 'pan' || state.mode === 'selectpan';
  setMode(wantSelect ? (hasPan ? 'selectpan' : 'select') : (hasPan ? 'pan' : 'idle'));
}
function togglePanMode() {
  const wantPan = !(state.mode === 'pan' || state.mode === 'selectpan');
  const hasSelect = state.mode === 'select' || state.mode === 'selectpan';
  setMode(wantPan ? (hasSelect ? 'selectpan' : 'pan') : (hasSelect ? 'select' : 'idle'));
}
document.getElementById('btn-move').addEventListener('click', toggleSelectMode);
document.getElementById('btn-pan').addEventListener('click', togglePanMode);
document.getElementById('btn-draw-wall').addEventListener('click', () => setMode('drawwall'));
const roomMenu = document.getElementById('room-menu');
document.getElementById('btn-room').addEventListener('click', e => {
  e.stopPropagation();
  roomMenu.classList.toggle('show');
});
document.getElementById('room-menu-room').addEventListener('click', () => { setMode('draw'); roomMenu.classList.remove('show'); });
document.getElementById('room-menu-building').addEventListener('click', () => { setMode('draw', 'building'); roomMenu.classList.remove('show'); });
document.getElementById('room-menu-balcony').addEventListener('click', () => { setMode('draw', 'balcony'); roomMenu.classList.remove('show'); });
document.getElementById('room-menu-callroom').addEventListener('click', () => { setMode('draw', 'callroom'); roomMenu.classList.remove('show'); });
const openingMenu = document.getElementById('opening-menu');
document.getElementById('btn-opening').addEventListener('click', e => {
  e.stopPropagation();
  openingMenu.classList.toggle('show');
});
document.getElementById('opening-menu-gateway').addEventListener('click', () => { setMode('gateway'); openingMenu.classList.remove('show'); });
document.getElementById('opening-menu-door').addEventListener('click', () => { setMode('door'); openingMenu.classList.remove('show'); });
document.getElementById('opening-menu-window').addEventListener('click', () => { setMode('window'); openingMenu.classList.remove('show'); });
const viewMenu = document.getElementById('view-menu');
document.getElementById('btn-view').addEventListener('click', e => {
  e.stopPropagation();
  viewMenu.classList.toggle('show');
});
// View menu rows are checkboxes and stay open on click (independent toggles)
document.querySelectorAll('#view-menu .opening-menu-item').forEach(row => row.addEventListener('click', e => e.stopPropagation()));
document.addEventListener('click', () => {
  openingMenu.classList.remove('show');
  roomMenu.classList.remove('show');
  viewMenu.classList.remove('show');
  saveMenu.classList.remove('show');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    openingMenu.classList.remove('show');
    roomMenu.classList.remove('show');
    viewMenu.classList.remove('show');
    saveMenu.classList.remove('show');
  }
});
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);
document.getElementById('btn-clear').addEventListener('click', () => {
  if (!confirm('Clear all rooms and furniture?')) return;
  saveSnapshot();
  state.rooms = []; state.items = []; state.selectedId = null;
  currentDesignId = null;
  updateRightPanel(); render(); saveToLocal();
});

function toggleGrid() {
  state.showGrid = !state.showGrid;
  document.getElementById('view-grid-checkbox').checked = state.showGrid;
  render();
}
function toggleSnap() {
  state.snapToGrid = !state.snapToGrid;
  document.getElementById('view-snap-checkbox').checked = state.snapToGrid;
}
function toggleEditOpenings() {
  state.editOpenings = !state.editOpenings;
  document.getElementById('view-edit-openings-checkbox').checked = state.editOpenings;
  if (!state.editOpenings) {
    // deselect any opening so its drag handles/panel don't linger
    state.selectedDoor = null; state.selectedGateway = null; state.selectedWindow = null;
    updateRightPanel(); render();
  }
}

// Checkbox change already reflects the new checked state (native label
// toggle) — sync state from it directly rather than re-toggling.
document.getElementById('view-grid-checkbox').addEventListener('change', e => { state.showGrid = e.target.checked; render(); });
document.getElementById('view-snap-checkbox').addEventListener('change', e => { state.snapToGrid = e.target.checked; });
document.getElementById('view-edit-openings-checkbox').addEventListener('change', e => {
  state.editOpenings = e.target.checked;
  if (!state.editOpenings) {
    state.selectedDoor = null; state.selectedGateway = null; state.selectedWindow = null;
    updateRightPanel(); render();
  }
});
document.getElementById('view-drag-rooms-checkbox').addEventListener('change', e => {
  state.dragRooms = e.target.checked;
});
document.getElementById('btn-zoom-in').addEventListener('click', () => { state.zoom = Math.min(5, state.zoom * 1.2); updateZoomLabel(); render(); });
document.getElementById('btn-zoom-out').addEventListener('click', () => { state.zoom = Math.max(0.1, state.zoom / 1.2); updateZoomLabel(); render(); });
document.getElementById('zoom-label').addEventListener('change', e => {
  setZoomPercent(parseSmartNumber(e.target.value.replace('%', '')));
  e.target.blur();
});
document.getElementById('zoom-label').addEventListener('keydown', e => {
  if (e.key === 'Enter') e.target.blur();
  if (e.key === 'Escape') { updateZoomLabel(); e.target.blur(); }
});
document.getElementById('zoom-label').addEventListener('focus', e => e.target.select());
document.getElementById('btn-zoom-fit').addEventListener('click', fitView);

function updateUnitsButton() {
  document.getElementById('btn-units').textContent = state.units === 'imperial' ? 'Units: ft' : 'Units: m';
}
updateUnitsButton();
document.getElementById('btn-units').addEventListener('click', () => {
  setUnits(state.units === 'imperial' ? 'metric' : 'imperial');
  updateUnitsButton();
});

function fitView() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  state.rooms.forEach(r => r.points.forEach(p => {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }));
  state.items.forEach(it => {
    const def = FURNITURE_DEFS.find(d => d.id === it.defId);
    if (!def) return;
    minX = Math.min(minX, it.x); minY = Math.min(minY, it.y);
    maxX = Math.max(maxX, it.x + def.w); maxY = Math.max(maxY, it.y + def.h);
  });
  if (!isFinite(minX)) { state.panX = 40; state.panY = 40; state.zoom = 1; }
  else {
    const pad = 60;
    const W = canvas.width, H = canvas.height;
    state.zoom = Math.min(5, Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxY - minY)));
    state.panX = (W - (maxX - minX) * state.zoom) / 2 - minX * state.zoom;
    state.panY = (H - (maxY - minY) * state.zoom) / 2 - minY * state.zoom;
  }
  updateZoomLabel();
  render();
}

// ═══════════════════════════════════════════════════════════
//  RIGHT PANEL
// ═══════════════════════════════════════════════════════════
function updateRightPanel() {
  const panel = document.getElementById('right-panel');
  const furnSection = document.getElementById('rp-furniture');
  const roomSection = document.getElementById('rp-room');

  const item = getSelectedItem();
  const room = state.rooms.find(r => r.id === state.selectedRoomId) || null;
  const gwSel = state.selectedGateway;
  const doorSel = state.selectedDoor;
  const windowSel = state.selectedWindow;

  if (!item && !room && !gwSel && !doorSel && !windowSel) { panel.classList.add('hidden'); updateMobileOverlayBackdrop(); return; }
  panel.classList.remove('hidden');
  updateMobileOverlayBackdrop();

  if (doorSel) {
    furnSection.style.display = 'none';
    roomSection.style.display = 'none';
    const gwPanel = document.getElementById('rp-gateway');
    if (gwPanel) gwPanel.style.display = 'none';
    const winPanel = document.getElementById('rp-window');
    if (winPanel) winPanel.style.display = 'none';
    let doorPanel = document.getElementById('rp-door');
    if (!doorPanel) {
      doorPanel = document.createElement('div');
      doorPanel.id = 'rp-door';
      doorPanel.innerHTML = `
        <h3>Door</h3>
        <div class="prop-row"><span class="prop-label">Width</span>
          <div style="display:flex;gap:6px;align-items:center;margin-top:3px">
            <input type="text" inputmode="decimal" id="rp-door-width" style="width:70px;padding:4px 6px;background:#252525;border:1px solid #3a3a3a;border-radius:3px;color:#fff;font-size:12px;outline:none;">
            <span style="color:#666;font-size:11px" class="rp-unit-label">${unitLabel()}</span>
          </div>
        </div>
        <div class="prop-row" style="margin-top:6px">
          <span class="prop-label">Type</span>
          <select id="rp-door-type" style="width:100%;padding:4px 6px;background:#252525;border:1px solid #3a3a3a;border-radius:3px;color:#fff;font-size:12px;outline:none;margin-top:3px;">
            <option value="hinged">Hinged</option>
            <option value="sliding">Sliding</option>
          </select>
        </div>
        <div class="prop-row" style="margin-top:6px">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="checkbox" id="rp-door-swing" style="accent-color:#fff;">
            <span class="prop-label" style="margin:0" id="rp-door-swing-label">Show swing icon</span>
          </label>
        </div>
        <div style="display:flex;gap:6px;margin-top:6px" id="rp-door-hinged-btns">
          <button class="prop-btn" id="rp-door-flip" style="flex:1" title="Flip which way the door swings open.">⇅ Flip arc</button>
          <button class="prop-btn" id="rp-door-mirror" style="flex:1" title="Move the hinge to the opposite side.">⇄ Mirror hinge</button>
        </div>
        <button class="prop-btn danger" id="rp-door-delete" style="margin-top:6px" title="Remove this door from the wall.">✕ Delete door</button>
      `;
      panel.appendChild(doorPanel);
      document.getElementById('rp-door-width').addEventListener('change', e => {
        const d = state.selectedDoor; if (!d) return;
        const v = parseSmartNumber(e.target.value);
        if (isFinite(v) && v > 0) { d.door.width = inputValueToLength(v); e.target.value = v; render(); saveToLocal(); }
      });
      document.getElementById('rp-door-type').addEventListener('change', e => {
        const d = state.selectedDoor; if (!d) return;
        saveSnapshot();
        d.door.doorType = e.target.value === 'sliding' ? 'sliding' : 'hinged';
        render(); saveToLocal(); updateRightPanel();
      });
      document.getElementById('rp-door-swing').addEventListener('change', e => {
        const d = state.selectedDoor; if (!d) return;
        saveSnapshot();
        d.door.showSwing = e.target.checked;
        render(); saveToLocal();
      });
      document.getElementById('rp-door-flip').addEventListener('click', () => {
        const d = state.selectedDoor; if (!d) return;
        saveSnapshot();
        d.door.flipped = !d.door.flipped;
        render(); saveToLocal();
      });
      document.getElementById('rp-door-mirror').addEventListener('click', () => {
        const d = state.selectedDoor; if (!d) return;
        saveSnapshot();
        d.door.mirrored = !d.door.mirrored;
        render(); saveToLocal();
      });
      document.getElementById('rp-door-delete').addEventListener('click', () => {
        const d = state.selectedDoor; if (!d) return;
        saveSnapshot();
        d.wall.doors = d.wall.doors.filter(x => x !== d.door);
        state.selectedDoor = null;
        updateRightPanel(); render(); saveToLocal();
      });
    }
    doorPanel.style.display = '';
    document.getElementById('rp-door-width').value = lengthToInputValue(doorSel.door.width ?? DEFAULT_OPENING_PX);
    const doorUnitLbl = document.querySelector('#rp-door .rp-unit-label');
    if (doorUnitLbl) doorUnitLbl.textContent = unitLabel();
    const isSliding = doorSel.door.doorType === 'sliding';
    document.getElementById('rp-door-type').value = isSliding ? 'sliding' : 'hinged';
    document.getElementById('rp-door-swing').checked = doorSel.door.showSwing !== false;
    document.getElementById('rp-door-swing-label').textContent = isSliding ? 'Show panel icon' : 'Show swing icon';
    document.getElementById('rp-door-hinged-btns').style.display = isSliding ? 'none' : 'flex';
    return;
  }

  const doorPanel = document.getElementById('rp-door');
  if (doorPanel) doorPanel.style.display = 'none';

  if (gwSel) {
    furnSection.style.display = 'none';
    roomSection.style.display = 'none';
    const winPanel2 = document.getElementById('rp-window');
    if (winPanel2) winPanel2.style.display = 'none';
    // show gateway panel
    let gwPanel = document.getElementById('rp-gateway');
    if (!gwPanel) {
      gwPanel = document.createElement('div');
      gwPanel.id = 'rp-gateway';
      gwPanel.innerHTML = `
        <h3>Gateway</h3>
        <div class="prop-row"><span class="prop-label">Width</span>
          <div style="display:flex;gap:6px;align-items:center;margin-top:3px">
            <input type="text" inputmode="decimal" id="rp-gw-width" style="width:70px;padding:4px 6px;background:#252525;border:1px solid #3a3a3a;border-radius:3px;color:#fff;font-size:12px;outline:none;">
            <span style="color:#666;font-size:11px" class="rp-unit-label">${unitLabel()}</span>
          </div>
        </div>
        <button class="prop-btn danger" id="rp-gw-delete" style="margin-top:8px" title="Remove this gateway from the wall.">✕ Delete gateway</button>
      `;
      panel.appendChild(gwPanel);
      document.getElementById('rp-gw-width').addEventListener('change', e => {
        const g = state.selectedGateway; if (!g) return;
        const v = parseSmartNumber(e.target.value);
        if (isFinite(v) && v > 0) { g.gw.width = inputValueToLength(v); e.target.value = v; render(); saveToLocal(); }
      });
      document.getElementById('rp-gw-delete').addEventListener('click', () => {
        const g = state.selectedGateway; if (!g) return;
        saveSnapshot();
        g.wall.gateways = g.wall.gateways.filter(x => x !== g.gw);
        state.selectedGateway = null;
        updateRightPanel(); render(); saveToLocal();
      });
    }
    gwPanel.style.display = '';
    document.getElementById('rp-gw-width').value = lengthToInputValue(gwSel.gw.width ?? DEFAULT_OPENING_PX);
    const gwUnitLbl = document.querySelector('#rp-gateway .rp-unit-label');
    if (gwUnitLbl) gwUnitLbl.textContent = unitLabel();
    return;
  }

  const gwPanel2 = document.getElementById('rp-gateway');
  if (gwPanel2) gwPanel2.style.display = 'none';

  if (windowSel) {
    furnSection.style.display = 'none';
    roomSection.style.display = 'none';
    let winPanel = document.getElementById('rp-window');
    if (!winPanel) {
      winPanel = document.createElement('div');
      winPanel.id = 'rp-window';
      winPanel.innerHTML = `
        <h3>Window</h3>
        <div class="prop-row"><span class="prop-label">Width</span>
          <div style="display:flex;gap:6px;align-items:center;margin-top:3px">
            <input type="text" inputmode="decimal" id="rp-window-width" style="width:70px;padding:4px 6px;background:#252525;border:1px solid #3a3a3a;border-radius:3px;color:#fff;font-size:12px;outline:none;">
            <span style="color:#666;font-size:11px" class="rp-unit-label">${unitLabel()}</span>
          </div>
        </div>
        <div class="prop-row" style="margin-top:6px">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="checkbox" id="rp-window-sash" style="accent-color:#fff;">
            <span class="prop-label" style="margin:0">Show sash icon</span>
          </label>
        </div>
        <button class="prop-btn danger" id="rp-window-delete" style="margin-top:8px" title="Remove this window from the wall.">✕ Delete window</button>
      `;
      panel.appendChild(winPanel);
      document.getElementById('rp-window-width').addEventListener('change', e => {
        const w = state.selectedWindow; if (!w) return;
        const v = parseSmartNumber(e.target.value);
        if (isFinite(v) && v > 0) { w.window.width = inputValueToLength(v); e.target.value = v; render(); saveToLocal(); }
      });
      document.getElementById('rp-window-sash').addEventListener('change', e => {
        const w = state.selectedWindow; if (!w) return;
        saveSnapshot();
        w.window.showSash = e.target.checked;
        render(); saveToLocal();
      });
      document.getElementById('rp-window-delete').addEventListener('click', () => {
        const w = state.selectedWindow; if (!w) return;
        saveSnapshot();
        w.wall.windows = w.wall.windows.filter(x => x !== w.window);
        state.selectedWindow = null;
        updateRightPanel(); render(); saveToLocal();
      });
    }
    winPanel.style.display = '';
    document.getElementById('rp-window-width').value = lengthToInputValue(windowSel.window.width ?? DEFAULT_OPENING_PX);
    const winUnitLbl = document.querySelector('#rp-window .rp-unit-label');
    if (winUnitLbl) winUnitLbl.textContent = unitLabel();
    document.getElementById('rp-window-sash').checked = windowSel.window.showSash !== false;
    return;
  }

  const winPanel3 = document.getElementById('rp-window');
  if (winPanel3) winPanel3.style.display = 'none';

  if (item) {
    furnSection.style.display = '';
    roomSection.style.display = 'none';
    const def = FURNITURE_DEFS.find(d => d.id === item.defId);
    if (!def) return;
    const dispW = item.customW ?? def.w;
    const dispH = item.customH ?? def.h;
    document.getElementById('rp-name').textContent = def.name;
    document.getElementById('rp-dims').textContent = `${formatLength(dispW)} × ${formatLength(dispH)}`;
    document.getElementById('rp-pos').textContent = `${formatLength(item.x)}, ${formatLength(item.y)}`;
    document.getElementById('rp-rot').textContent = `${Math.round(item.rot * 180 / Math.PI)}°`;
    document.getElementById('rp-color').value = rgbToHex(item.color || '#888');
    const isImageItem = !!item.imageDataUrl;
    document.getElementById('rp-color-row').style.display = isImageItem ? 'none' : '';
    document.getElementById('rp-image-replace').style.display = isImageItem ? '' : 'none';
  } else if (room) {
    furnSection.style.display = 'none';
    roomSection.style.display = '';
    const ci = room.colorIndex ?? 0;
    const col = ROOM_COLORS[ci % ROOM_COLORS.length];
    document.getElementById('rp-room-name').value = room.name || '';
    document.getElementById('rp-room-showname').checked = room.showName !== false;
    document.getElementById('rp-room-color').value = rgbToHex(room.customStroke || col.stroke);
    document.getElementById('rp-room-opacity').value = room.customOpacity ?? 8;
    document.getElementById('rp-room-open').checked = !!room.open;
    document.getElementById('rp-room-extend').style.display = room.open ? '' : 'none';
    const areaM2 = room.open ? 0 : polygonAreaM2(room.points);
    document.getElementById('rp-room-area').textContent = room.open ? '—' : formatArea(areaM2);
    document.getElementById('rp-room-showarea-row').style.display = room.open ? 'none' : '';
    document.getElementById('rp-room-showarea').checked = !!room.showArea;
    buildWallRows(room);
  }
}

// Per-wall length + angle editor. Editing either field moves that wall's far
// vertex; the immediately-adjacent wall absorbs the change to keep the room
// closed. Works on any room (perpendicular or not) — angle editing subsumes
// "only meaningful once perpendicular" since a user can dial in exactly 90°
// or a deliberate off-angle as they like.
function buildWallRows(room) {
  const container = document.getElementById('rp-room-walls');
  container.innerHTML = '';
  if (room.callRoom) return; // no real walls to edit — just a traced/labeled area
  const pts = room.points;
  const wallCount = room.open ? pts.length - 1 : pts.length;
  for (let i = 0; i < wallCount; i++) {
    const ref = room.wallRefs?.[i];
    if (ref && getWallById(ref.wallId)?.virtual) continue; // fill-only closing edge, not a real editable wall
    const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
    const len = dist(p1, p2);
    if (len < 1) continue;
    const angleDeg = ((Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI) + 360) % 360;
    const row = document.createElement('div');
    row.className = 'prop-row';
    row.style.marginTop = '4px';
    row.innerHTML = `
      <span class="prop-label">Wall ${i + 1}</span>
      <div style="display:flex;gap:6px;align-items:center;margin-top:2px">
        <input type="text" inputmode="decimal" class="wall-len-input" data-wall-idx="${i}" value="${lengthToInputValue(len)}"
          style="width:64px;padding:4px 6px;background:#252525;border:1px solid #3a3a3a;border-radius:3px;color:#fff;font-size:12px;outline:none;">
        <span style="color:#666;font-size:11px">${unitLabel()}</span>
        <input type="text" inputmode="decimal" class="wall-angle-input" data-wall-idx="${i}" value="${angleDeg.toFixed(0)}"
          style="width:56px;padding:4px 6px;background:#252525;border:1px solid #3a3a3a;border-radius:3px;color:#fff;font-size:12px;outline:none;margin-left:4px;">
        <span style="color:#666;font-size:11px">°</span>
      </div>
    `;
    container.appendChild(row);
  }
  container.querySelectorAll('.wall-len-input').forEach(inp => {
    inp.addEventListener('change', e => applyWallEdit(room, parseInt(e.target.dataset.wallIdx), 'length', parseSmartNumber(e.target.value)));
  });
  container.querySelectorAll('.wall-angle-input').forEach(inp => {
    inp.addEventListener('change', e => applyWallEdit(room, parseInt(e.target.dataset.wallIdx), 'angle', parseSmartNumber(e.target.value)));
  });
}

// Editing wall i's far vertex (v_{i+1}) moves it; wall i+1 (from v_{i+1} to
// v_{i+2}) shifts bodily so it keeps ITS OWN length/angle relative to the
// new start point — a local, single-hop propagation. Only the edited wall
// and its immediate downstream neighbor visibly move.
function applyWallEdit(room, wallIdx, field, value) {
  if (!isFinite(value) || value <= 0 && field === 'length') return;
  const pts = room.points;
  const n = pts.length;
  const p1 = pts[wallIdx];
  const p2 = pts[(wallIdx + 1) % n];
  const oldLen = dist(p1, p2);
  const oldAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const newLen = field === 'length' ? inputValueToLength(value) : oldLen;
  const newAngle = field === 'angle' ? value * Math.PI / 180 : oldAngle;
  const newP2 = { x: p1.x + Math.cos(newAngle) * newLen, y: p1.y + Math.sin(newAngle) * newLen };

  const nextIdx = (wallIdx + 1) % n;
  const nextNextIdx = (wallIdx + 2) % n;
  // Only propagate one hop if there IS a distinct next wall (skip on a
  // 2-point open wall, where wallIdx+1 wraps back to wallIdx).
  const hasNextWall = !(room.open && nextIdx === n - 1 && nextNextIdx === 0) && nextNextIdx !== wallIdx;

  saveSnapshot();
  if (hasNextWall) {
    const oldP2 = pts[nextIdx];
    const oldP3 = pts[nextNextIdx];
    const nextLen = dist(oldP2, oldP3);
    const nextAngle = Math.atan2(oldP3.y - oldP2.y, oldP3.x - oldP2.x);
    pts[nextIdx] = newP2;
    pts[nextNextIdx] = { x: newP2.x + Math.cos(nextAngle) * nextLen, y: newP2.y + Math.sin(nextAngle) * nextLen };
  } else {
    pts[nextIdx] = newP2;
  }
  pushRoomPointsToWalls(room);
  render(); saveToLocal();
  buildWallRows(room);
}

function rgbToHex(color) {
  if (color.startsWith('#')) return color;
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = 1;
  const tc = tmp.getContext('2d'); tc.fillStyle = color; tc.fillRect(0,0,1,1);
  const d = tc.getImageData(0,0,1,1).data;
  return '#' + [d[0],d[1],d[2]].map(v => v.toString(16).padStart(2,'0')).join('');
}

document.getElementById('rp-resize').addEventListener('click', () => {
  const item = getSelectedItem();
  if (!item) return;
  const def = FURNITURE_DEFS.find(d => d.id === item.defId);
  const btn = document.getElementById('rp-resize');
  const r = btn.getBoundingClientRect();
  showFurniturePopup(item, def, r.right + 8, r.top);
});
document.getElementById('rp-rotate').addEventListener('click', rotateSelected);
document.getElementById('rp-flip').addEventListener('click', flipSelected);
document.getElementById('rp-duplicate').addEventListener('click', duplicateSelected);
document.getElementById('rp-delete').addEventListener('click', deleteSelected);
document.getElementById('rp-color').addEventListener('input', e => {
  const item = getSelectedItem();
  if (!item) return;
  item.color = e.target.value;
  furnitureCache.clear();
  render(); saveToLocal();
});
document.getElementById('rp-image-replace').addEventListener('click', () => {
  const item = getSelectedItem();
  if (!item) return;
  pickCustomImage((dataUrl) => {
    item.imageDataUrl = dataUrl;
    furnitureImageCache.delete(`${item.id}_${dataUrl.length}`);
    render(); saveToLocal();
    trackEvent('custom_image_furniture_replaced');
  });
});

// ── Room panel controls ──
function getSelectedRoom() {
  return state.rooms.find(r => r.id === state.selectedRoomId) || null;
}
document.getElementById('rp-room-name').addEventListener('input', e => {
  const room = getSelectedRoom(); if (!room) return;
  room.name = e.target.value; render(); saveToLocal();
});
document.getElementById('rp-room-showname').addEventListener('change', e => {
  const room = getSelectedRoom(); if (!room) return;
  room.showName = e.target.checked; render(); saveToLocal();
});
document.getElementById('rp-room-showarea').addEventListener('change', e => {
  const room = getSelectedRoom(); if (!room) return;
  room.showArea = e.target.checked; render(); saveToLocal();
});
document.getElementById('rp-room-color').addEventListener('input', e => {
  const room = getSelectedRoom(); if (!room) return;
  room.customStroke = e.target.value; render(); saveToLocal();
});
document.getElementById('rp-room-opacity').addEventListener('input', e => {
  const room = getSelectedRoom(); if (!room) return;
  room.customOpacity = parseInt(e.target.value); render(); saveToLocal();
});
document.getElementById('rp-room-open').addEventListener('change', e => {
  const room = getSelectedRoom(); if (!room) return;
  room.open = e.target.checked;
  render(); saveToLocal();
});
document.getElementById('rp-room-edit-pts').addEventListener('click', () => {
  // Already shows handles when room is selected; this just highlights the tip
  const room = getSelectedRoom(); if (!room) return;
  showToast('Drag the white dots to move wall points');
});
document.getElementById('rp-room-perp').addEventListener('click', makeSelectedRoomPerpendicular);
document.getElementById('rp-room-extend-start').addEventListener('click', () => {
  const room = getSelectedRoom(); if (!room) return;
  startExtendRoom(room, true);
});
document.getElementById('rp-room-extend-end').addEventListener('click', () => {
  const room = getSelectedRoom(); if (!room) return;
  startExtendRoom(room, false);
});
document.getElementById('rp-room-delete').addEventListener('click', deleteSelectedRoom);
document.getElementById('rp-close').addEventListener('click', () => { deselectAll(); updateRightPanel(); render(); });

// ═══════════════════════════════════════════════════════════
//  STATUS BAR
// ═══════════════════════════════════════════════════════════
function updateStatus() {
  document.getElementById('sb-items').textContent = `Items: ${state.items.length}`;
  document.getElementById('sb-rooms').textContent = `Rooms: ${state.rooms.length}`;
}

// ═══════════════════════════════════════════════════════════
