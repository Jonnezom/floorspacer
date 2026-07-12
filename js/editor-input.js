'use strict';

//  DRAG & DROP FROM SIDEBAR
// ═══════════════════════════════════════════════════════════
canvas.addEventListener('dragover', e => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

// Downscales/re-compresses an uploaded image so its data URL stays well
// under localStorage/Supabase jsonb size budgets, then hands the result to
// `onReady`. Only rejects if even a heavily downscaled version can't fit,
// which shouldn't happen in practice for a floor-plan furniture thumbnail.
const CUSTOM_IMAGE_MAX_DATA_URL_BYTES = 700 * 1024;
function loadAndDownscaleImage(file, onReady, onError) {
  const reader = new FileReader();
  reader.onerror = () => onError('Could not read that file.');
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => onError('Not a valid image file.');
    img.onload = () => {
      let maxDim = 800;
      let dataUrl;
      do {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const cw = Math.max(1, Math.round(img.width * scale));
        const ch = Math.max(1, Math.round(img.height * scale));
        const oc = document.createElement('canvas');
        oc.width = cw; oc.height = ch;
        oc.getContext('2d').drawImage(img, 0, 0, cw, ch);
        dataUrl = oc.toDataURL('image/jpeg', 0.85);
        maxDim = Math.round(maxDim * 0.7);
      } while (dataUrl.length > CUSTOM_IMAGE_MAX_DATA_URL_BYTES && maxDim > 50);
      if (dataUrl.length > CUSTOM_IMAGE_MAX_DATA_URL_BYTES) { onError('Image is too complex to downscale enough — try a simpler image.'); return; }
      onReady(dataUrl, img.width / img.height);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function pickCustomImage(onReady) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    loadAndDownscaleImage(file, onReady, msg => showToast(msg, '#ff6666'));
  });
  input.click();
}

canvas.addEventListener('drop', e => {
  e.preventDefault();
  const defId = parseInt(e.dataTransfer.getData('defId'));
  const def = FURNITURE_DEFS.find(d => d.id === defId);
  if (!def) return;
  if (def.tier === 'paid' && !state.licenseUnlocked) return;
  trackEvent('furniture_placed', { category: def.category });

  const rect = canvas.getBoundingClientRect();
  let pt = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  pt = snapPt(pt);

  if (def.isImage) {
    pickCustomImage((dataUrl, aspect) => {
      saveSnapshot();
      const w = def.w, h = Math.max(SNAP_GRID, Math.round(w / aspect));
      const item = { id: nextId++, defId, x: pt.x - w / 2, y: pt.y - h / 2, rot: 0, flipped: false, imageDataUrl: dataUrl, customW: w, customH: h };
      state.items.push(item);
      state.selectedId = item.id;
      returnToSelectMode();
      updateRightPanel();
      render();
      saveToLocal();
      trackEvent('custom_image_furniture_added');
    });
    return;
  }

  saveSnapshot();
  const item = { id: nextId++, defId, x: pt.x - def.w / 2, y: pt.y - def.h / 2, rot: 0, color: '#888', flipped: false };
  state.items.push(item);
  state.selectedId = item.id;
  returnToSelectMode();
  updateRightPanel();
  render();
  saveToLocal();

  // Show size dialog
  showFurniturePopup(item, def, e.clientX, e.clientY);
});

// ═══════════════════════════════════════════════════════════
//  CANVAS INTERACTION
// ═══════════════════════════════════════════════════════════
let mouseState = {
  down: false,
  draggingItem: null,
  dragOffX: 0, dragOffY: 0,
  resizingItem: null,  // { item, corner: 'tl'|'tr'|'br'|'bl', startW, startH, startX, startY }
  rotatingItem: null,  // { item }
  draggingRoomPt: null,
  draggingGateway: null,   // { wall, gw, part }
  draggingDoor: null,      // { wall, door, part }
  draggingWindow: null,    // { wall, window, part }
  draggingRoomBody: null,  // { room, startWx, startWy, origPoints } — moving an entire room, gated by state.dragRooms
  spaceDown: false,
  panning: false,
  panStartX: 0, panStartY: 0,
  panOriginX: 0, panOriginY: 0,
  maybePanning: false,      // mousedown hit nothing in Select mode — could become a pan or a plain deselect-click
  panCandidateStartX: 0, panCandidateStartY: 0,
};
const PAN_DRAG_THRESHOLD = 4; // px of mouse movement before an empty-canvas drag becomes a pan

function getItemAt(wx, wy) {
  // check in reverse (top items first)
  for (let i = state.items.length - 1; i >= 0; i--) {
    const item = state.items[i];
    const def = FURNITURE_DEFS.find(d => d.id === item.defId);
    if (!def) continue;
    // bounding-box test done in the item's own local (unrotated) space
    const iw = item.customW ?? def.w, ih = item.customH ?? def.h;
    const cx = item.x + iw / 2, cy = item.y + ih / 2;
    // rotate point back
    const angle = -item.rot;
    const lx = (wx - cx) * Math.cos(angle) - (wy - cy) * Math.sin(angle) + iw / 2;
    const ly = (wx - cx) * Math.sin(angle) + (wy - cy) * Math.cos(angle) + ih / 2;
    if (lx >= 0 && lx <= iw && ly >= 0 && ly <= ih) return item;
  }
  return null;
}

// Maps a world point into the selected item's LOCAL (unrotated) space,
// same transform as getItemAt, exposed separately since handle hit-testing
// needs the local coordinates themselves, not just an inside/outside test.
function worldToItemLocal(item, iw, ih, wx, wy) {
  const cx = item.x + iw / 2, cy = item.y + ih / 2;
  const angle = -item.rot;
  return {
    x: (wx - cx) * Math.cos(angle) - (wy - cy) * Math.sin(angle) + iw / 2,
    y: (wx - cx) * Math.sin(angle) + (wy - cy) * Math.cos(angle) + ih / 2,
  };
}

// Only checks the CURRENTLY SELECTED item's handles (corner resize handles
// + the rotate handle above its top edge) — handles are only drawn/usable
// once an item is already selected, matching how the handles only render
// for state.selectedId.
function getItemHandleAt(wx, wy) {
  if (state.selectedId == null) return null;
  const item = state.items.find(it => it.id === state.selectedId);
  if (!item) return null;
  const def = FURNITURE_DEFS.find(d => d.id === item.defId);
  if (!def) return null;
  const iw = item.customW ?? def.w, ih = item.customH ?? def.h;
  const local = worldToItemLocal(item, iw, ih, wx, wy);
  const threshold = 8 / state.zoom;

  const rh = ROTATE_HANDLE_DIST / state.zoom;
  if (dist(local, { x: iw / 2, y: -rh }) < threshold) return { item, corner: 'rotate' };

  const corners = { tl: { x: 0, y: 0 }, tr: { x: iw, y: 0 }, br: { x: iw, y: ih }, bl: { x: 0, y: ih } };
  for (const corner in corners) {
    if (dist(local, corners[corner]) < threshold) return { item, corner };
  }
  return null;
}

function getRoomAt(wx, wy) {
  // Check if point is inside any room polygon (reverse order = topmost first)
  for (let i = state.rooms.length - 1; i >= 0; i--) {
    const room = state.rooms[i];
    if (room.points.length < 3) continue;
    if (pointInPolygon(wx, wy, room.points)) return room;
  }
  // Also check near walls (for open/line rooms)
  for (let i = state.rooms.length - 1; i >= 0; i--) {
    const room = state.rooms[i];
    const pts = room.points;
    const len = room.open ? pts.length - 1 : pts.length;
    for (let j = 0; j < len; j++) {
      const p1 = pts[j], p2 = pts[(j + 1) % pts.length];
      if (pointToSegmentDist(wx, wy, p1.x, p1.y, p2.x, p2.y) < 10 / state.zoom) return room;
    }
  }
  return null;
}

function getGatewayAt(wx, wy) {
  const threshold = 10 / state.zoom;
  for (const wall of state.walls) {
    for (const gw of wall.gateways) {
      const g = getGatewayGeom(wall, gw);
      if (!g) continue;
      const { ax, ay, bx, by } = g;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      // hit center
      if (dist({ x: wx, y: wy }, { x: mx, y: my }) < threshold) return { wall, gw, part: 'center' };
      // hit left edge
      if (dist({ x: wx, y: wy }, { x: ax, y: ay }) < threshold) return { wall, gw, part: 'left' };
      // hit right edge
      if (dist({ x: wx, y: wy }, { x: bx, y: by }) < threshold) return { wall, gw, part: 'right' };
      // hit anywhere along the gap line
      if (pointToSegmentDist(wx, wy, ax, ay, bx, by) < threshold) return { wall, gw, part: 'center' };
    }
  }
  return null;
}

function getRoomPointAt(wx, wy) {
  const threshold = 10 / state.zoom;
  const room = state.rooms.find(r => r.id === state.selectedRoomId);
  if (!room) return null;
  for (let i = 0; i < room.points.length; i++) {
    if (dist(room.points[i], { x: wx, y: wy }) < threshold) return { room, ptIdx: i };
  }
  return null;
}

// Tier 1: exact wall-graph vertex hit. Scans state.walls directly (not
// per-room) so a shared vertex is found once regardless of which room owns
// it. excludeRoomId skips walls owned ONLY by that room (a room's own
// corner shouldn't count as "joining external structure" while it's still
// being drawn/extended).
function findWallVertexAt(wx, wy, excludeRoomId) {
  const threshold = VERTEX_SNAP_DIST / state.zoom;
  for (const w of state.walls) {
    if (excludeRoomId != null && w.ownerRoomIds.every(id => id === excludeRoomId)) continue;
    for (const end of ['a', 'b']) {
      if (dist(w[end], { x: wx, y: wy }) < threshold) return { x: w[end].x, y: w[end].y, wall: w, end };
    }
  }
  return null;
}

// Tier 2: interior-of-edge hit, for walls with no coincident vertex nearby.
// Landing here means the wall must be SPLIT at this point (see splitWallAt)
// so the join creates a real shared vertex instead of a dangling T-junction.
function findWallEdgeAt(wx, wy, excludeRoomId) {
  const threshold = VERTEX_SNAP_DIST / state.zoom;
  for (const w of state.walls) {
    if (excludeRoomId != null && w.ownerRoomIds.every(id => id === excludeRoomId)) continue;
    const d = pointToSegmentDist(wx, wy, w.a.x, w.a.y, w.b.x, w.b.y);
    if (d < threshold) {
      const t = projectOnSegment(wx, wy, w.a.x, w.a.y, w.b.x, w.b.y);
      if (t < 0.02 || t > 0.98) continue; // effectively an endpoint — tier 1 should catch it
      return { x: w.a.x + (w.b.x - w.a.x) * t, y: w.a.y + (w.b.y - w.a.y) * t, wall: w, t, needsSplit: true };
    }
  }
  return null;
}

// Combined join-target lookup used while drawing/extending: landing on
// another room's existing corner or wall joins the structure there and
// finishes immediately, instead of requiring the user to circle back to
// their own start point or double-click.
function findWallJoinTargetAt(wx, wy, excludeRoomId) {
  return findWallVertexAt(wx, wy, excludeRoomId) || findWallEdgeAt(wx, wy, excludeRoomId);
}

// Splits `wall` into two walls sharing a new vertex at parametric t. Any
// doors/windows/gateways on `wall` are redistributed to whichever half
// they now fall in, with t renormalized to that half's own length. Every
// room's wallRefs that pointed at `wall` are rewritten to reference both
// halves in sequence (preserving winding order), so the room's points
// cache still traces the same physical boundary after the split.
function splitWallAt(wall, t) {
  const mid = { x: wall.a.x + (wall.b.x - wall.a.x) * t, y: wall.a.y + (wall.b.y - wall.a.y) * t };
  const wallA = { id: wallNextId++, a: { ...wall.a }, b: mid, doors: [], windows: [], gateways: [], ownerRoomIds: [...wall.ownerRoomIds] };
  const wallB = { id: wallNextId++, a: mid, b: { ...wall.b }, doors: [], windows: [], gateways: [], ownerRoomIds: [...wall.ownerRoomIds] };

  const redistribute = (list, targetList) => {
    for (const o of list) {
      if (o.t < t) targetList.wallA.push({ ...o, t: o.t / t });
      else targetList.wallB.push({ ...o, t: (o.t - t) / (1 - t) });
    }
  };
  redistribute(wall.doors, { wallA: wallA.doors, wallB: wallB.doors });
  redistribute(wall.windows, { wallA: wallA.windows, wallB: wallB.windows });
  redistribute(wall.gateways, { wallA: wallA.gateways, wallB: wallB.gateways });

  for (const room of state.rooms) {
    if (!room.wallRefs) continue;
    room.wallRefs = room.wallRefs.flatMap(ref => {
      if (ref.wallId !== wall.id) return [ref];
      return ref.reversed
        ? [{ wallId: wallB.id, reversed: true }, { wallId: wallA.id, reversed: true }]
        : [{ wallId: wallA.id, reversed: false }, { wallId: wallB.id, reversed: false }];
    });
  }

  state.walls.splice(state.walls.indexOf(wall), 1, wallA, wallB);
  for (const room of state.rooms) syncRoomPointsFromWalls(room);
  return { wallA, wallB, mid };
}

function pointInPolygon(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Iterates state.walls directly (not per-room), so a wall shared by two
// rooms is reachable regardless of which room's polygon you're visually
// clicking "through" — fixes the structural "first room in array order
// wins" bug that existed when this walked room.points per room.
function getWallAt(wx, wy) {
  const threshold = 8 / state.zoom;
  for (const w of state.walls) {
    if (w.virtual) continue; // fill-only closing edge — not a real, clickable wall
    const d = pointToSegmentDist(wx, wy, w.a.x, w.a.y, w.b.x, w.b.y);
    if (d < threshold) {
      const t = projectOnSegment(wx, wy, w.a.x, w.a.y, w.b.x, w.b.y);
      return { wall: w, t };
    }
  }
  return null;
}

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function projectOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  return Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
}

canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  const wp = screenToWorld(sx, sy);

  if (e.button === 1 || (e.button === 0 && e.altKey) || (e.button === 0 && (state.mode === 'pan' || mouseState.spaceDown))) {
    // pan
    mouseState.panning = true;
    mouseState.panStartX = e.clientX; mouseState.panStartY = e.clientY;
    mouseState.panOriginX = state.panX; mouseState.panOriginY = state.panY;
    canvas.classList.add('dragging');
    return;
  }

  if (e.button === 0) {
    if (state.mode === 'draw' || state.mode === 'drawwall' || state.mode === 'extend') {
      // The wall length/angle popup from the PREVIOUS point stays open
      // until explicitly confirmed/skipped/clicked-away-from — it doesn't
      // auto-dismiss when the user moves on to place their next point.
      // Clicking elsewhere applies whatever value is currently in the
      // popup (same as clicking its OK button), rather than discarding it.
      if (_dimCallback) { _dimCallback(true); closeDimPopup(); }
      handleDrawClick(wp, e);
      return;
    }

    if (state.mode === 'door' || state.mode === 'window' || state.mode === 'gateway') {
      const hit = getWallAt(wp.x, wp.y);
      if (hit) {
        saveSnapshot();
        const opening = { t: hit.t };
        const createdMode = state.mode;
        if (createdMode === 'door') { opening.width = DEFAULT_OPENING_PX; opening.flipped = false; hit.wall.doors.push(opening); }
        else if (createdMode === 'window') { opening.width = DEFAULT_OPENING_PX; hit.wall.windows.push(opening); }
        else { opening.width = DEFAULT_OPENING_PX; hit.wall.gateways.push(opening); }
        // Immediately select the newly-placed opening and switch to Select
        // mode so its right-panel editor (width, swing/sash toggle, delete)
        // opens right away instead of requiring a separate click.
        deselectAll();
        if (createdMode === 'door') state.selectedDoor = { wall: hit.wall, door: opening };
        else if (createdMode === 'window') state.selectedWindow = { wall: hit.wall, window: opening };
        else state.selectedGateway = { wall: hit.wall, gw: opening };
        returnToSelectMode();
        updateRightPanel();
        saveToLocal();
      }
      return;
    }

    if (state.mode === 'idle') {
      // Select and Pan are both explicitly turned off — canvas is inert
      // until the user picks a tool again.
      return;
    }

    // select mode
    // 0. Openings (door/window/gateway) are only selectable/draggable when
    // "Edit Openings" is turned on, to avoid accidental drags while clicking
    // around a design.
    if (state.editOpenings) {
      // 0a. Try hitting a door
      const doorHit = getDoorAt(wp.x, wp.y);
      if (doorHit) {
        state.selectedDoor = doorHit;
        state.selectedGateway = null;
        state.selectedWindow = null;
        state.selectedId = null;
        state.selectedRoomId = null;
        mouseState.down = true;
        mouseState.draggingDoor = doorHit;
        canvas.classList.add('dragging');
        updateRightPanel();
        render();
        return;
      }

      // 0b. Try hitting a gateway
      const gwHit = getGatewayAt(wp.x, wp.y);
      if (gwHit) {
        state.selectedGateway = gwHit;
        state.selectedDoor = null;
        state.selectedWindow = null;
        state.selectedId = null;
        state.selectedRoomId = null;
        mouseState.down = true;
        mouseState.draggingGateway = gwHit;
        canvas.classList.add('dragging');
        updateRightPanel();
        render();
        return;
      }

      // 0c. Try hitting a window
      const winHit = getWindowAt(wp.x, wp.y);
      if (winHit) {
        state.selectedWindow = winHit;
        state.selectedDoor = null;
        state.selectedGateway = null;
        state.selectedId = null;
        state.selectedRoomId = null;
        mouseState.down = true;
        mouseState.draggingWindow = winHit;
        canvas.classList.add('dragging');
        updateRightPanel();
        render();
        return;
      }
    }

    // 1. Try dragging a room wall point (only when room is selected)
    const ptHit = getRoomPointAt(wp.x, wp.y);
    if (ptHit) {
      mouseState.down = true;
      mouseState.draggingRoomPt = ptHit;
      canvas.classList.add('dragging');
      return;
    }

    // 1b. Try hitting a resize/rotate handle on the already-selected item —
    // checked before the plain body hit below so handles win when both are
    // in range near an item's edge.
    const handleHit = getItemHandleAt(wp.x, wp.y);
    if (handleHit) {
      const { item, corner } = handleHit;
      const def = FURNITURE_DEFS.find(d => d.id === item.defId);
      saveSnapshot();
      mouseState.down = true;
      if (corner === 'rotate') {
        mouseState.rotatingItem = { item };
      } else {
        mouseState.resizingItem = {
          item, corner,
          startW: item.customW ?? def.w,
          startH: item.customH ?? def.h,
          startX: item.x, startY: item.y,
        };
      }
      canvas.classList.add('dragging');
      return;
    }

    // 2. Try hitting a furniture item
    const item = getItemAt(wp.x, wp.y);
    if (item) {
      state.selectedId = item.id;
      state.selectedRoomId = null;
      saveSnapshot();
      mouseState.down = true;
      mouseState.draggingItem = item;
      mouseState.dragOffX = wp.x - item.x;
      mouseState.dragOffY = wp.y - item.y;
      canvas.classList.add('dragging');
      updateRightPanel();
      render();
      return;
    }

    // 3. Try hitting a room
    const room = getRoomAt(wp.x, wp.y);
    if (room) {
      state.selectedRoomId = room.id;
      state.selectedId = null;
      mouseState.down = true;
      if (state.dragRooms) {
        // Whole-room dragging is gated behind this toggle so a room can't be
        // accidentally moved just by clicking around a design.
        saveSnapshot();
        mouseState.draggingRoomBody = {
          room,
          startWx: wp.x,
          startWy: wp.y,
          origPoints: room.points.map(p => ({ x: p.x, y: p.y })),
        };
        canvas.classList.add('dragging');
      }
      updateRightPanel();
      render();
      return;
    }

    // 4. Nothing hit. In pure 'select' mode, clicking empty canvas never
    // pans — just deselect immediately. In 'selectpan' (and legacy callers),
    // start tracking a possible pan: if the mouse moves past a small
    // threshold before release, mousemove promotes this into an actual pan
    // (see PAN_DRAG_THRESHOLD below); if released without moving, mouseup
    // treats it as a plain click and deselects everything.
    if (state.mode === 'select') {
      deselectAll();
      updateRightPanel();
      render();
      return;
    }
    mouseState.down = true;
    mouseState.maybePanning = true;
    mouseState.panCandidateStartX = e.clientX;
    mouseState.panCandidateStartY = e.clientY;
  }
});

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  const wp = screenToWorld(sx, sy);

  const inDrawMode = state.mode === 'draw' || state.mode === 'drawwall' || state.mode === 'extend';
  if (inDrawMode) {
    let snapped = snapToExisting(wp);
    if (!_lastSnapWasVertex && state.drawPoints.length > 0) {
      snapped = applyAngleSnap(snapped, state.drawPoints[state.drawPoints.length - 1], e.altKey);
    }
    state._mouseWorld = snapped;
  } else {
    state._mouseWorld = snapPt(wp);
  }
  document.getElementById('sb-cursor').textContent = `x: ${(wp.x * SCALE).toFixed(2)}m  y: ${(wp.y * SCALE).toFixed(2)}m`;

  if (mouseState.maybePanning) {
    const dx = e.clientX - mouseState.panCandidateStartX, dy = e.clientY - mouseState.panCandidateStartY;
    if (Math.hypot(dx, dy) >= PAN_DRAG_THRESHOLD) {
      // promote to an actual pan, anchored at the original mousedown position
      mouseState.maybePanning = false;
      mouseState.panning = true;
      mouseState.panStartX = mouseState.panCandidateStartX;
      mouseState.panStartY = mouseState.panCandidateStartY;
      mouseState.panOriginX = state.panX;
      mouseState.panOriginY = state.panY;
      canvas.classList.add('dragging');
    }
  }

  if (mouseState.panning) {
    state.panX = mouseState.panOriginX + (e.clientX - mouseState.panStartX);
    state.panY = mouseState.panOriginY + (e.clientY - mouseState.panStartY);
    render();
    return;
  }

  if (mouseState.draggingDoor && mouseState.down) {
    const { wall, door, part } = mouseState.draggingDoor;
    const p1 = wall.a, p2 = wall.b;
    const wallLen = dist(p1, p2);
    const tCursor = Math.max(0, Math.min(1, projectOnSegment(wp.x, wp.y, p1.x, p1.y, p2.x, p2.y)));
    const halfT = (door.width ?? DEFAULT_OPENING_PX) / 2 / wallLen;
    if (part === 'center') {
      door.t = Math.max(halfT, Math.min(1 - halfT, tCursor));
    } else if (part === 'left') {
      const newT1 = Math.max(0, Math.min(door.t - 0.01, tCursor));
      door.width = Math.max(8, (door.t - newT1) * 2 * wallLen);
    } else if (part === 'right') {
      const newT2 = Math.min(1, Math.max(door.t + 0.01, tCursor));
      door.width = Math.max(8, (newT2 - door.t) * 2 * wallLen);
    }
    render();
    return;
  }

  if (mouseState.draggingGateway && mouseState.down) {
    const { wall, gw, part } = mouseState.draggingGateway;
    const p1 = wall.a, p2 = wall.b;
    const wallLen = dist(p1, p2);
    // project cursor onto wall
    const tCursor = Math.max(0, Math.min(1, projectOnSegment(wp.x, wp.y, p1.x, p1.y, p2.x, p2.y)));
    const halfT = (gw.width ?? DEFAULT_OPENING_PX) / 2 / wallLen;

    if (part === 'center') {
      // slide along wall, clamped so it doesn't go off the ends
      gw.t = Math.max(halfT, Math.min(1 - halfT, tCursor));
    } else if (part === 'left') {
      // drag left edge — widens/narrows left side
      const newT1 = Math.max(0, Math.min(gw.t - 0.01, tCursor));
      gw.width = Math.max(8, (gw.t - newT1) * 2 * wallLen);
    } else if (part === 'right') {
      // drag right edge
      const newT2 = Math.min(1, Math.max(gw.t + 0.01, tCursor));
      gw.width = Math.max(8, (newT2 - gw.t) * 2 * wallLen);
    }
    render();
    return;
  }

  if (mouseState.draggingWindow && mouseState.down) {
    const { wall, window: win, part } = mouseState.draggingWindow;
    const p1 = wall.a, p2 = wall.b;
    const wallLen = dist(p1, p2);
    const tCursor = Math.max(0, Math.min(1, projectOnSegment(wp.x, wp.y, p1.x, p1.y, p2.x, p2.y)));
    const halfT = (win.width ?? DEFAULT_OPENING_PX) / 2 / wallLen;
    if (part === 'center') {
      win.t = Math.max(halfT, Math.min(1 - halfT, tCursor));
    } else if (part === 'left') {
      const newT1 = Math.max(0, Math.min(win.t - 0.01, tCursor));
      win.width = Math.max(8, (win.t - newT1) * 2 * wallLen);
    } else if (part === 'right') {
      const newT2 = Math.min(1, Math.max(win.t + 0.01, tCursor));
      win.width = Math.max(8, (newT2 - win.t) * 2 * wallLen);
    }
    render();
    return;
  }

  if (mouseState.draggingRoomPt && mouseState.down) {
    const { room, ptIdx } = mouseState.draggingRoomPt;
    const snapped = snapToExisting(wp, room.id, ptIdx);
    room.points[ptIdx] = snapped;
    // Keep this room's own walls in sync with the drag so a later
    // extend/join on this room doesn't revert it via syncRoomPointsFromWalls
    // (does not propagate to any OTHER room sharing these walls — that's
    // Phase 2 dragging-through-walls work).
    pushRoomPointsToWalls(room);
    render();
    return;
  }

  if (mouseState.draggingRoomBody && mouseState.down) {
    const { room, startWx, startWy, origPoints } = mouseState.draggingRoomBody;
    const dx = wp.x - startWx, dy = wp.y - startWy;
    const snappedDx = state.snapToGrid ? Math.round(dx / SNAP_GRID) * SNAP_GRID : dx;
    const snappedDy = state.snapToGrid ? Math.round(dy / SNAP_GRID) * SNAP_GRID : dy;
    room.points = origPoints.map(p => ({ x: p.x + snappedDx, y: p.y + snappedDy }));
    pushRoomPointsToWalls(room);
    render();
    return;
  }

  if (mouseState.draggingItem && mouseState.down) {
    const item = mouseState.draggingItem;
    const def = FURNITURE_DEFS.find(d => d.id === item.defId);
    const iw = item.customW ?? def.w, ih = item.customH ?? def.h;
    const snapped = snapItemToNearby(item, iw, ih, { x: wp.x - mouseState.dragOffX, y: wp.y - mouseState.dragOffY });
    item.x = snapped.x;
    item.y = snapped.y;
    updateRightPanel();
    render();
    return;
  }

  if (mouseState.resizingItem && mouseState.down) {
    const { item, corner, startW, startH, startX, startY } = mouseState.resizingItem;
    const def = FURNITURE_DEFS.find(d => d.id === item.defId);
    // Drag delta in the item's own local (unrotated) space, so resizing
    // behaves correctly regardless of the item's current rotation.
    const local = worldToItemLocal(item, startW, startH, wp.x, wp.y);
    const snapRound = v => Math.round(v / SNAP_GRID) * SNAP_GRID;
    const MIN_SIZE = SNAP_GRID;
    let newW = startW, newH = startH, newX = startX, newY = startY;
    if (corner === 'tl' || corner === 'bl') {
      newW = Math.max(MIN_SIZE, snapRound(startW - local.x));
    }
    if (corner === 'tr' || corner === 'br') {
      newW = Math.max(MIN_SIZE, snapRound(local.x));
    }
    if (corner === 'tl' || corner === 'tr') {
      newH = Math.max(MIN_SIZE, snapRound(startH - local.y));
    }
    if (corner === 'bl' || corner === 'br') {
      newH = Math.max(MIN_SIZE, snapRound(local.y));
    }
    // Corners on the "start" side (left/top) also move the item's origin,
    // by however much the size actually changed (post-clamp/snap), so the
    // opposite (fixed) corner stays put.
    if (corner === 'tl' || corner === 'bl') newX = startX + (startW - newW);
    if (corner === 'tl' || corner === 'tr') newY = startY + (startH - newH);
    item.customW = newW; item.customH = newH;
    item.x = newX; item.y = newY;
    furnitureCache.clear();
    updateRightPanel();
    render();
    return;
  }

  if (mouseState.rotatingItem && mouseState.down) {
    const { item } = mouseState.rotatingItem;
    const def = FURNITURE_DEFS.find(d => d.id === item.defId);
    const iw = item.customW ?? def.w, ih = item.customH ?? def.h;
    const cx = item.x + iw / 2, cy = item.y + ih / 2;
    // Angle from item center to cursor; the rotate handle sits above the
    // top edge (local -Y), which is "angle 0" in this scheme, so offset by
    // +90° (Math.PI/2) to match the handle's rest position.
    let angle = Math.atan2(wp.y - cy, wp.x - cx) + Math.PI / 2;
    if (!e.altKey) {
      const stepRad = ROTATE_SNAP_DEG * Math.PI / 180;
      angle = Math.round(angle / stepRad) * stepRad;
    }
    item.rot = angle;
    updateRightPanel();
    render();
    return;
  }

  if (state.mode === 'draw' || state.mode === 'drawwall' || state.mode === 'extend') render();
});

canvas.addEventListener('mouseup', e => {
  if (mouseState.panning) {
    mouseState.panning = false;
    canvas.classList.remove('dragging');
    return;
  }
  if (mouseState.maybePanning) {
    // released without moving past the threshold — treat as a plain click
    // on empty canvas: deselect everything (matches the old fallback)
    mouseState.maybePanning = false;
    deselectAll();
    updateRightPanel();
    render();
  }
  if (mouseState.draggingItem || mouseState.resizingItem || mouseState.rotatingItem || mouseState.draggingRoomPt || mouseState.draggingGateway || mouseState.draggingDoor || mouseState.draggingWindow || mouseState.draggingRoomBody) {
    saveToLocal();
  }
  if (mouseState.draggingRoomPt || mouseState.draggingRoomBody) {
    // refresh the right panel's per-wall length/angle inputs to reflect the
    // just-dragged vertex/room — mousemove only re-renders the canvas
    updateRightPanel();
  }
  mouseState.down = false;
  mouseState.draggingItem = null;
  mouseState.resizingItem = null;
  mouseState.rotatingItem = null;
  mouseState.draggingRoomPt = null;
  mouseState.draggingGateway = null;
  mouseState.draggingDoor = null;
  mouseState.draggingWindow = null;
  mouseState.draggingRoomBody = null;
  canvas.classList.remove('dragging');
});

function updateZoomLabel() {
  document.getElementById('zoom-label').value = `${Math.round(state.zoom * 100)}%`;
}

// Sets zoom to an exact percentage (from the editable zoom-label input),
// keeping the current view center fixed rather than zooming around a
// cursor position (there's no cursor position to anchor to for a typed value).
function setZoomPercent(pct) {
  if (!isFinite(pct) || pct <= 0) { updateZoomLabel(); return; }
  const newZoom = Math.max(0.1, Math.min(5, pct / 100));
  const cx = canvas.width / 2, cy = canvas.height / 2;
  state.panX = cx - (cx - state.panX) * (newZoom / state.zoom);
  state.panY = cy - (cy - state.panY) * (newZoom / state.zoom);
  state.zoom = newZoom;
  updateZoomLabel();
  render();
}

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  const factor = Math.exp(-e.deltaY * 0.0015);
  const newZoom = Math.max(0.1, Math.min(5, state.zoom * factor));
  // zoom around cursor
  state.panX = sx - (sx - state.panX) * (newZoom / state.zoom);
  state.panY = sy - (sy - state.panY) * (newZoom / state.zoom);
  state.zoom = newZoom;
  updateZoomLabel();
  render();
}, { passive: false });

// Context menu
canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const wp = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  const item = getItemAt(wp.x, wp.y);
  if (item) {
    state.selectedId = item.id;
    updateRightPanel(); render();
    showCtxMenu(e.clientX, e.clientY);
  }
});

function showCtxMenu(x, y) {
  const menu = document.getElementById('ctx-menu');
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
  menu.classList.add('show');
}
function hideCtxMenu() { document.getElementById('ctx-menu').classList.remove('show'); }
document.addEventListener('click', hideCtxMenu);

document.getElementById('ctx-rotate').addEventListener('click', () => rotateSelected());
document.getElementById('ctx-flip').addEventListener('click', () => flipSelected());
document.getElementById('ctx-duplicate').addEventListener('click', () => duplicateSelected());
document.getElementById('ctx-delete').addEventListener('click', () => deleteSelected());

// ═══════════════════════════════════════════════════════════
