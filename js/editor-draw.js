'use strict';

//  DRAW MODE
// ═══════════════════════════════════════════════════════════
let _lastClickTime = 0;

// Ensures a real, addressable vertex exists at the join target, splitting
// the target wall first if the hit landed mid-edge (so a later
// findOrCreateWall call for the new segment ending there can match it by
// coincident coordinates, the same way any other room-to-room wall sharing
// already works). Returns the exact {x, y} to use as the new segment's
// endpoint — nothing about the NEW segment's own wall identity is
// determined here; that's left to findOrCreateWall like any other segment,
// which is what actually keeps the newly-drawn points intact instead of
// being overwritten by the existing wall's own coordinates.
function resolveJoinTarget(target) {
  if (target.needsSplit) {
    const { mid } = splitWallAt(target.wall, target.t);
    return { x: mid.x, y: mid.y };
  }
  return { x: target.x, y: target.y };
}

function handleDrawClick(wp, e) {
  let snapped = snapToExisting(wp);
  const pts = state.drawPoints;
  if (!_lastSnapWasVertex && pts.length > 0) {
    snapped = applyAngleSnap(snapped, pts[pts.length - 1], e && e.altKey);
  }
  const now = Date.now();
  const isDblClick = (now - _lastClickTime) < 350;
  _lastClickTime = now;

  // Double-click: finish drawing. In Room mode, close the polygon (using
  // the point just placed on this double-click's first click — do NOT pop
  // it, that would silently discard the corner the user just placed and
  // close the shape one point short). Wall/extend mode has no interior to
  // close, so those finish open.
  if (isDblClick && pts.length >= 2) {
    if (state.mode === 'extend') finishExtendRoom();
    else finishDrawing(state.mode === 'draw' && pts.length >= 3);
    return;
  }

  // In room mode: close polygon if clicking back onto ANY already-placed
  // point of the shape being drawn — not just the very first one. Clicking
  // an earlier corner (e.g. point 3 of a 5-point path) discards everything
  // placed after it and closes the loop there, treating that corner as the
  // new "start" the shape has looped back around to. Only point indices
  // 2+ qualify (i.e. at least 3 points survive the trim) — points 0/1
  // can't form a valid closed polygon on their own.
  if (state.mode === 'draw' && pts.length >= 3) {
    const closeThreshold = CLOSE_DIST * 2 / state.zoom;
    for (let i = 2; i < pts.length - 1; i++) {
      if (dist(snapped, pts[i]) < closeThreshold) {
        pts.length = i + 1;
        // Clicking directly on a real corner is an explicit "draw a wall
        // here" gesture — the closing edge should be a real wall, not the
        // fill-only virtual edge used for Enter/double-click finishes.
        finishDrawing(true, undefined, false);
        return;
      }
    }
    // Clicking back onto the true start point (pts[0]) is the common case —
    // check it last so an earlier-corner match (a more specific/intentional
    // click) takes priority when a click happens to be ambiguous between
    // the two (rare, but the start point is always checked as a fallback).
    if (dist(snapped, pts[0]) < closeThreshold) {
      finishDrawing(true, undefined, false);
      return;
    }
  }

  // In extend mode: landing on another room's existing vertex or wall joins
  // the structure there and finishes immediately — the new wall becomes
  // part of the overall layout rather than needing a separate double-click.
  if (state.mode === 'extend') {
    const target = findWallJoinTargetAt(snapped.x, snapped.y, state.extendRoomId);
    if (target) {
      pts.push(resolveJoinTarget(target));
      finishExtendRoom();
      return;
    }
  }

  // The very first point of a brand-new shape needs the same real, permanent
  // join as every later point gets (see the pts.length >= 1 block below) —
  // otherwise a start point that visually lands on an existing wall is only
  // a coincidental coordinate match, not an actual shared vertex, and later
  // edits (wall length/angle, snap-to-grid, dragging) can silently move it
  // away from that wall since nothing ever recorded the link.
  if (state.drawRole !== 'callroom' && (state.mode === 'draw' || state.mode === 'drawwall') && pts.length === 0) {
    const startTarget = findWallJoinTargetAt(snapped.x, snapped.y, null);
    if (startTarget) snapped = resolveJoinTarget(startTarget);
  }

  // In room/wall mode: reaching an EXISTING room's corner or wall (not the
  // shape currently being drawn) means this new shape has joined onto the
  // rest of the structure — finish it there rather than requiring the user
  // to circle back to their own start point or double-click. If the room's
  // OWN START POINT also touches existing structure, the shape is actually
  // enclosed — trace a path through the existing wall network connecting
  // the two touch points and close the loop for real (fill + area). If
  // only the end touches (or no path connects the two touch points), fall
  // back to the original open finish — never a synthetic/guessed closure.
  // Call Room is excluded entirely — it traces an area as a plain labeled
  // overlay and must never create/merge/join real walls.
  if (state.drawRole !== 'callroom' && (state.mode === 'draw' || state.mode === 'drawwall') && pts.length >= 1) {
    const target = findWallJoinTargetAt(snapped.x, snapped.y, null);
    if (target) {
      // resolveJoinTarget performs a real, permanent wall split (if the
      // touch landed mid-edge) regardless of what happens next — this is
      // the actual "create a shared vertex" step, independent of whether
      // the shape finishes here or keeps going.
      const touchPt = resolveJoinTarget(target);
      if (e && e.shiftKey) {
        // Touch-and-continue: the point is a real shared vertex (already
        // established above), but the user wants to keep drawing past it
        // instead of finishing — e.g. routing a new room's edge through a
        // tight space between two existing structures. Treated exactly
        // like any other placed point from here on.
        pts.push(touchPt);
        render();
        if (state.drawRole !== 'callroom') showWallPopup(touchPt, pts.length - 1);
        return;
      }
      pts.push(touchPt);
      if (state.mode === 'draw' && pts.length >= 3) {
        const startTarget = findWallJoinTargetAt(pts[0].x, pts[0].y, null);
        if (startTarget) {
          const startPt = resolveJoinTarget(startTarget); // may split the wall at pts[0]
          pts[0] = startPt;
          const hops = traceClosingPath(touchPt, startPt);
          if (hops) {
            finishDrawing(true, hopsToWallRefs(hops));
            return;
          }
        }
      }
      finishDrawing(false);
      return;
    }
  }

  pts.push(snapped);
  render();
  // Call Room is tracing an already-built area, not creating new walls —
  // corners should snap onto existing geometry (still active above via
  // snapToExisting), but there's nothing to "confirm" a length/angle for.
  if (state.drawRole !== 'callroom') showWallPopup(snapped, pts.length - 1);
}

// Builds wallRefs for a closed/open sequence of points, reusing existing
// walls via findOrCreateWall (so touching an existing room's wall shares
// it instead of drawing an independent overlapping copy). Every segment —
// including one whose endpoint came from joining onto existing structure —
// goes through the same findOrCreateWall coordinate-matching; a join's
// endpoint coordinates already exactly match the existing wall/vertex it
// was resolved against (see resolveJoinTarget), so the new segment's far
// end naturally coincides and shares that vertex without needing to reuse
// the existing wall's own identity for the whole segment (which would
// silently discard the segment's actual drawn shape/points).
//
// The final wrap-around segment (pts[last] -> pts[0]) when `closed` is
// true is the self-close edge. Whether it's a REAL wall depends on how the
// user actually finished the shape: clicking directly onto a real point/
// corner (their own start, or an earlier corner of the same shape) is an
// explicit "draw a wall here" gesture, so that edge is real. Finishing via
// Enter or double-click (with no such click) never asked for a wall there
// — it exists purely to complete the polygon for fill/area purposes, so
// it's marked virtual (fill-only, not stroked/selectable/clickable),
// unless findOrCreateWall reuses an existing REAL wall there (e.g. the
// room closes exactly onto another room's shared edge).
function buildWallRefsForRoom(pts, closed, ownerRoomId, closingEdgeIsVirtual) {
  const segCount = closed ? pts.length : pts.length - 1;
  const wallRefs = [];
  for (let i = 0; i < segCount; i++) {
    const pA = pts[i], pB = pts[(i + 1) % pts.length];
    const isClosingEdge = closed && i === segCount - 1 && closingEdgeIsVirtual;
    const { wall, reversed } = findOrCreateWall(pA, pB, ownerRoomId, isClosingEdge);
    wallRefs.push({ wallId: wall.id, reversed });
  }
  return wallRefs;
}

// closingEdgeIsVirtual: true (the default) means the self-close edge is
// fill-only, used when the room finishes WITHOUT the user clicking on a
// real point (Enter key, double-click). Pass false when the user
// explicitly clicked back onto a real point/corner to close the loop —
// that's a deliberate "draw a wall here" gesture, so the closing edge
// should be a real, visible, clickable wall like any other.
function finishDrawing(closed, extraWallRefs, closingEdgeIsVirtual = true) {
  const pts = state.drawPoints;
  if (pts.length < 2) { state.drawPoints = []; render(); return; }

  saveSnapshot();
  const isWallMode = state.mode === 'drawwall';
  const role = state.drawRole || null; // 'building' | 'balcony' | 'callroom' | null
  // extraWallRefs (a path traced through the existing wall network — see
  // traceClosingPath) supplies the closing edge itself, so the room is
  // always closed when present, and buildWallRefsForRoom must NOT also add
  // its own wrap-around segment (closed:false) — that would duplicate the
  // closure with a phantom straight line back to pts[0].
  const isCallRoom = role === 'callroom';
  const open = extraWallRefs ? false : (!closed || isWallMode);
  const id = nextId++;
  const room = {
    id,
    name: role === 'building' ? 'Building' : role === 'balcony' ? 'Balcony' : '',
    showName: role === 'building' || role === 'balcony',
    open,
    colorIndex: state.rooms.length % ROOM_COLORS.length,
    customStroke: null,
    customOpacity: isWallMode ? 0 : (role === 'building' ? 0 : role === 'balcony' ? 4 : 8),
    role: (role === 'building' || role === 'balcony') ? role : null,
    // Call Room traces an already-built area as a plain labeled/filled
    // overlay — it must never create, reuse, or merge with real walls, so
    // it gets a direct points[] array and no wallRefs at all, bypassing
    // the shared-wall system entirely (computeRoomPoints/drawRoom etc. all
    // already fall back to treating room.points as authoritative when
    // wallRefs is absent). Also explicitly flagged (rather than inferred
    // from "no wallRefs") so drawRoom can suppress the wall STROKE too —
    // it should look like a plain filled/labeled polygon, not a room with
    // real-looking walls that just happen to have no underlying data.
    callRoom: isCallRoom || undefined,
    points: isCallRoom ? [...pts] : undefined,
    wallRefs: isCallRoom ? undefined : (extraWallRefs
      ? [...buildWallRefsForRoom(pts, false, id), ...extraWallRefs]
      : buildWallRefsForRoom(pts, !open, id, closingEdgeIsVirtual)),
  };
  // The traced path borrows existing walls to complete this room's
  // boundary — give this room ownership too, same as findOrCreateWall
  // already does whenever a room's boundary reuses existing geometry by
  // coordinate match. This keeps the wall alive if the room that first
  // drew it is later deleted (deleteSelectedRoom prunes zero-owner walls).
  if (extraWallRefs) {
    for (const ref of extraWallRefs) {
      const w = getWallById(ref.wallId);
      if (w && !w.ownerRoomIds.includes(id)) w.ownerRoomIds.push(id);
    }
  }
  if (!isCallRoom) syncRoomPointsFromWalls(room);
  // Building outlines render behind everything else
  if (role === 'building') state.rooms.unshift(room); else state.rooms.push(room);
  if (!isWallMode && !role && closed) trackEvent('room_drawn');
  state.drawPoints = [];
  state.selectedRoomId = room.id;
  state.selectedId = null;
  returnToSelectMode();
  render();
  saveToLocal();
  updateRightPanel();
}

// Re-enters draw mode seeded at one free end of an open room, so the user
// can keep adding points to that SAME room's points[] instead of starting a
// brand-new shape. Only meaningful for open rooms — a closed polygon has no
// unambiguous "outward" direction from an arbitrary corner.
function startExtendRoom(room, fromStart) {
  if (!room || !room.open) return;
  state.extendRoomId = room.id;
  state.extendFromStart = fromStart;
  const anchor = fromStart ? room.points[0] : room.points[room.points.length - 1];
  state.drawPoints = [{ x: anchor.x, y: anchor.y }];
  setMode('extend');
}

function finishExtendRoom() {
  const room = state.rooms.find(r => r.id === state.extendRoomId);
  const newPts = state.drawPoints.slice(1); // drop the seeded anchor point itself
  if (!room || newPts.length === 0) {
    state.drawPoints = [];
    state.extendRoomId = null;
    returnToSelectMode();
    render();
    return;
  }
  saveSnapshot();
  const anchor = state.extendFromStart ? room.points[0] : room.points[room.points.length - 1];
  const chain = [anchor, ...newPts];
  const newRefs = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const { wall, reversed } = findOrCreateWall(chain[i], chain[i + 1], room.id);
    newRefs.push({ wallId: wall.id, reversed });
  }
  if (state.extendFromStart) {
    room.wallRefs.unshift(...newRefs.slice().reverse().map(r => ({ wallId: r.wallId, reversed: !r.reversed })));
  } else {
    room.wallRefs.push(...newRefs);
  }
  syncRoomPointsFromWalls(room);
  state.extendRoomId = null;
  state.drawPoints = [];
  state.selectedRoomId = room.id;
  returnToSelectMode();
  render();
  saveToLocal();
  updateRightPanel();
}

// ═══════════════════════════════════════════════════════════
//  DIMENSION POPUP
// ═══════════════════════════════════════════════════════════
const dimPopup = document.getElementById('dim-popup');
const dimFurnFields = document.getElementById('dim-furniture-fields');
const dimWallFields = document.getElementById('dim-wall-fields');
let _dimCallback = null;

// Docks the popup in the top-right corner, to the left of the right panel
// when it's visible, so it never sits on top of the canvas/drawing area —
// previously it appeared next to whichever point was just placed, which
// meant it could easily cover the very corner the user needed to click
// next to finish the shape. cx/cy are no longer used for positioning (kept
// as parameters since callers still pass a screen point) but nothing about
// the confirm/cancel behavior changes.
function positionPopup(cx, cy) {
  const popup = dimPopup;
  popup.classList.add('show');
  const margin = 10;
  const panel = document.getElementById('right-panel');
  const panelVisible = panel && !panel.classList.contains('hidden');
  const panelWidth = panelVisible ? panel.getBoundingClientRect().width : 0;
  const toolbarHeight = document.getElementById('toolbar')?.getBoundingClientRect().height || 0;
  popup.style.left = 'auto';
  popup.style.right = (panelWidth + margin) + 'px';
  popup.style.top = (toolbarHeight + margin) + 'px';
}

function closeDimPopup() {
  dimPopup.classList.remove('show');
  _dimCallback = null;
}

document.getElementById('dim-ok').addEventListener('click', () => {
  if (_dimCallback) _dimCallback(true);
  closeDimPopup();
});
document.getElementById('dim-skip').addEventListener('click', () => {
  if (_dimCallback) _dimCallback(false);
  closeDimPopup();
});
// Enter key submits
dimPopup.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); if (_dimCallback) _dimCallback(true); closeDimPopup(); }
  if (e.key === 'Escape') { if (_dimCallback) _dimCallback(false); closeDimPopup(); }
});
// Clicking anywhere outside the popup and outside the right panel (e.g. the
// toolbar, or empty page chrome) applies the popup's current value, same as
// its OK button — canvas clicks are handled separately in the mousedown
// handler itself, since they also need to go on and place the next point.
document.addEventListener('pointerdown', e => {
  if (!dimPopup.classList.contains('show')) return;
  if (dimPopup.contains(e.target)) return;
  const panel = document.getElementById('right-panel');
  if (panel && panel.contains(e.target)) return;
  if (canvas.contains(e.target)) return; // handled in canvas's own pointerdown
  if (_dimCallback) _dimCallback(true);
  closeDimPopup();
}, { capture: true });

function showFurniturePopup(item, def, cx, cy) {
  document.getElementById('dim-title').textContent = `Resize: ${def.name}`;
  dimFurnFields.style.display = '';
  dimWallFields.style.display = 'none';

  const wInput = document.getElementById('dim-w');
  const hInput = document.getElementById('dim-h');
  wInput.value = lengthToInputValue(item.customW ?? def.w);
  hInput.value = lengthToInputValue(item.customH ?? def.h);
  document.querySelectorAll('#dim-popup .dim-unit[data-kind="length"]').forEach(el => el.textContent = unitLabel());

  positionPopup(cx, cy);
  setTimeout(() => wInput.focus(), 30);

  _dimCallback = (apply) => {
    if (!apply) return;
    const newW = parseSmartNumber(wInput.value);
    const newH = parseSmartNumber(hInput.value);
    if (!isFinite(newW) || newW <= 0 || !isFinite(newH) || newH <= 0) return;
    // Store custom dimensions in pixels on the item
    item.customW = Math.round(inputValueToLength(newW) / SNAP_GRID) * SNAP_GRID || SNAP_GRID;
    item.customH = Math.round(inputValueToLength(newH) / SNAP_GRID) * SNAP_GRID || SNAP_GRID;
    furnitureCache.clear();
    updateRightPanel();
    render();
    saveToLocal();
  };
}

function showWallPopup(fromPt, ptIndex) {
  // Only show for points after the first (otherwise no "previous wall" to measure)
  if (ptIndex < 1) return;
  const prevPt = state.drawPoints[ptIndex - 1];
  if (!prevPt) return;

  document.getElementById('dim-title').textContent = `Wall ${ptIndex} length & direction`;
  dimFurnFields.style.display = 'none';
  dimWallFields.style.display = '';

  const lenInput = document.getElementById('dim-wall-len');
  const angleInput = document.getElementById('dim-wall-angle');
  document.querySelectorAll('#dim-popup .dim-unit[data-kind="length"]').forEach(el => el.textContent = unitLabel());

  // Pre-fill with the current wall stats
  const currentDist = dist(prevPt, fromPt);
  const currentAngle = Math.round(Math.atan2(fromPt.y - prevPt.y, fromPt.x - prevPt.x) * 180 / Math.PI);
  lenInput.value = lengthToInputValue(currentDist);
  angleInput.value = currentAngle;

  // Position near the midpoint of the wall on screen
  const mid = worldToScreen((prevPt.x + fromPt.x) / 2, (prevPt.y + fromPt.y) / 2);
  positionPopup(mid.x, mid.y);
  // Deliberately NOT auto-focusing lenInput here (unlike showFurniturePopup,
  // which is a modal-style action the user explicitly opened). This popup
  // reappears after EVERY point placed while drawing, so auto-focusing it
  // would permanently steal keyboard focus for the entire drawing session —
  // every keystroke (including Enter/Escape to finish, and single-letter
  // shortcuts like G for grid) would type into this field instead of
  // reaching the app. Click into the field manually to type an exact value.

  _dimCallback = (apply) => {
    if (!apply) return;
    const lenM = parseSmartNumber(lenInput.value);
    const angleDeg = parseSmartNumber(angleInput.value);
    if (!isFinite(lenM) || lenM <= 0 || !isFinite(angleDeg)) return;

    const lenPx = inputValueToLength(lenM);
    const rad = angleDeg * Math.PI / 180;
    const newPt = snapPt({
      x: prevPt.x + Math.cos(rad) * lenPx,
      y: prevPt.y + Math.sin(rad) * lenPx,
    });
    // Replace the last added point
    state.drawPoints[ptIndex] = newPt;
    render();
  };
}

// ═══════════════════════════════════════════════════════════
//  ITEM OPERATIONS
// ═══════════════════════════════════════════════════════════
function getSelectedItem() {
  return state.items.find(it => it.id === state.selectedId) || null;
}

function rotateSelected() {
  const item = getSelectedItem();
  if (!item) return;
  saveSnapshot();
  item.rot = (item.rot + Math.PI / 2) % (Math.PI * 2);
  furnitureCache.clear();
  updateRightPanel(); render(); saveToLocal();
}

function flipSelected() {
  const item = getSelectedItem();
  if (!item) return;
  saveSnapshot();
  item.flipped = !item.flipped;
  updateRightPanel(); render(); saveToLocal();
}

function deleteSelected() {
  if (!state.selectedId) return;
  saveSnapshot();
  state.items = state.items.filter(it => it.id !== state.selectedId);
  state.selectedId = null;
  updateRightPanel(); render(); saveToLocal();
}

function deselectAll() {
  state.selectedId = null;
  state.selectedRoomId = null;
  state.selectedGateway = null;
  state.selectedDoor = null;
  state.selectedWindow = null;
}

function deleteSelectedRoom() {
  const room = getSelectedRoom();
  if (!room) return;
  saveSnapshot();
  state.rooms = state.rooms.filter(r => r.id !== room.id);
  // Drop this room from any wall's ownership, and remove walls left with no
  // owner at all (not shared with any remaining room) so state.walls
  // doesn't silently accumulate orphaned entries.
  if (room.wallRefs) {
    for (const ref of room.wallRefs) {
      const w = getWallById(ref.wallId);
      if (w) w.ownerRoomIds = w.ownerRoomIds.filter(id => id !== room.id);
    }
    state.walls = state.walls.filter(w => w.ownerRoomIds.length > 0);
    // The deleted room may have been the reason a surviving room's wall got
    // split (splitWallAt) in the first place — e.g. to give this room a
    // shared vertex mid-span. That split has no purpose now, so re-merge
    // any fragments left collinear-and-solely-owned by each surviving room.
    for (const r of state.rooms) mergeCollinearWallPairs(r);
  }
  state.selectedRoomId = null;
  updateRightPanel(); render(); saveToLocal();
}

// One-click best-effort fix: re-walk the polygon from a fixed anchor
// (points[0]), snapping every edge EXCEPT THE LAST to the nearest cardinal
// direction (0/90/180/270°) while preserving that edge's original length.
// The final edge (out[last] -> anchor) is never independently snapped —
// instead it's forced to close the loop exactly by moving only ITS single
// free coordinate to match the anchor (whichever axis it's already closer
// to becomes the "closed" axis). This guarantees every edge in the result
// is perfectly axis-aligned: snapping the last edge's direction separately
// (an earlier version of this function did that, and separately tried to
// patch a "residual" into an edge endpoint after the fact) could leave one
// of the last edge's two endpoints uncorrected, tilting that edge instead
// of fixing it. Returns the new points array, or null if the shape isn't
// close enough to rectilinear to fix without unrecognizable distortion.
function computePerpendicularPoints(pts) {
  const n = pts.length;
  if (n < 3) return null;
  const anchor = pts[0];
  const out = [anchor];
  let cur = anchor;
  for (let i = 0; i < n - 1; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % n];
    const len = dist(p1, p2);
    if (len < 1) continue;
    const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const snappedAng = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2);
    cur = { x: cur.x + Math.cos(snappedAng) * len, y: cur.y + Math.sin(snappedAng) * len };
    out.push(cur);
  }
  if (out.length < 3) return null; // degenerate — all but one edge collapsed

  const last = out[out.length - 1];
  // The closing edge is only "noise-corrected" (not distorted) if the axis
  // being eliminated is small relative to wall lengths — otherwise this
  // shape isn't actually rectilinear along that edge and forcing it would
  // produce an unrecognizable result rather than a cleanup.
  const dxToAnchor = Math.abs(anchor.x - last.x), dyToAnchor = Math.abs(anchor.y - last.y);
  const residual = Math.min(dxToAnchor, dyToAnchor);
  const avgWallLen = pts.reduce((s, p, i) => s + dist(p, pts[(i + 1) % n]), 0) / n;
  if (residual > avgWallLen * 0.3) return null; // not rectilinear enough to fix safely

  // Snap the closing edge by eliminating whichever axis is smaller (the
  // "noise" from imperfect drawing), moving only out[last]'s free
  // coordinate — anchor itself never moves.
  if (dxToAnchor < dyToAnchor) {
    out[out.length - 1] = { x: anchor.x, y: last.y };
  } else {
    out[out.length - 1] = { x: last.x, y: anchor.y };
  }
  return out;
}

function makeSelectedRoomPerpendicular() {
  const room = getSelectedRoom();
  if (!room) return;
  const newPts = computePerpendicularPoints(room.points);
  if (!newPts) { showToast("Room shape can't be made perpendicular"); return; }
  saveSnapshot();
  room.points = newPts;
  pushRoomPointsToWalls(room);
  render(); saveToLocal(); updateRightPanel();
}

function duplicateSelected() {
  const item = getSelectedItem();
  if (!item) return;
  saveSnapshot();
  const copy = { ...item, id: nextId++, x: item.x + GRID * 2, y: item.y + GRID * 2 };
  state.items.push(copy);
  state.selectedId = copy.id;
  updateRightPanel(); render(); saveToLocal();
}

// ═══════════════════════════════════════════════════════════
//  KEYBOARD
// ═══════════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  // Enter/Escape while drawing must take priority over the wall length/
  // angle popup's own input focus — that popup auto-focuses its length
  // field after every point placed, so without this check here, e.target
  // would be that <input> and the guard right below would swallow the
  // keypress into the popup's own confirm/cancel logic instead of
  // finishing/cancelling the room.
  if (e.key === 'Enter' && (state.mode === 'draw' || state.mode === 'drawwall' || state.mode === 'extend')) {
    e.preventDefault();
    if (_dimCallback) { _dimCallback(true); closeDimPopup(); }
    if (state.mode === 'extend') {
      if (state.drawPoints.length >= 2) finishExtendRoom();
    } else if (state.mode === 'draw' && state.drawPoints.length >= 3) {
      finishDrawing(true);
    } else if (state.drawPoints.length >= 2) {
      finishDrawing(false);
    }
    return;
  }
  if (e.key === 'Escape' && (state.mode === 'draw' || state.mode === 'drawwall' || state.mode === 'extend')) {
    if (_dimCallback) { _dimCallback(false); closeDimPopup(); }
    state.drawPoints = []; state.extendRoomId = null; returnToSelectMode(); render();
    return;
  }
  // Same rationale as the draw-mode Escape above: an unrelated focused
  // <input> elsewhere on the page (e.g. the furniture-size popup that
  // auto-focuses right after a tap-to-place) must not swallow Escape before
  // it can disarm a pending tap-to-place.
  if (e.key === 'Escape' && state.pendingPlacementDefId != null) {
    state.pendingPlacementDefId = null; updateArmedFurnitureRow();
    return;
  }

  if (e.target !== document.body && e.target.tagName === 'INPUT') return;

  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (e.key === 'y') { e.preventDefault(); redo(); return; }
    if (e.key === 's') { e.preventDefault(); saveToLocal(); showSaveToast(); return; }
    if (e.key === 'd') { e.preventDefault(); duplicateSelected(); return; }
  }

  if (e.key === 'v' || e.key === 'V') toggleSelectMode();
  if (e.key === 'h' || e.key === 'H') togglePanMode();
  if (e.key === 'd' || e.key === 'D') setMode('draw');
  if (e.key === 'w' || e.key === 'W') setMode('drawwall');
  if (e.key === ' ' && !mouseState.spaceDown) {
    e.preventDefault();
    mouseState.spaceDown = true;
    canvas.style.cursor = 'grab';
  }
  if (e.key === 'g' || e.key === 'G') toggleGrid();
  if (e.key === 's' || e.key === 'S') toggleSnap();

  if (e.key === 'r' || e.key === 'R') rotateSelected();
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    if (state.selectedDoor) {
      const { wall, door } = state.selectedDoor;
      saveSnapshot();
      wall.doors = wall.doors.filter(d => d !== door);
      state.selectedDoor = null;
      updateRightPanel(); render(); saveToLocal();
    } else if (state.selectedGateway) {
      const { wall, gw } = state.selectedGateway;
      saveSnapshot();
      wall.gateways = wall.gateways.filter(g => g !== gw);
      state.selectedGateway = null;
      updateRightPanel(); render(); saveToLocal();
    } else if (state.selectedWindow) {
      const { wall, window: win } = state.selectedWindow;
      saveSnapshot();
      wall.windows = wall.windows.filter(w => w !== win);
      state.selectedWindow = null;
      updateRightPanel(); render(); saveToLocal();
    } else if (state.selectedRoomId != null) {
      deleteSelectedRoom();
    } else {
      deleteSelected();
    }
  }
  // Draw-mode Escape is handled earlier (with priority over the wall
  // popup's focus) and returns before reaching here — this only fires
  // outside any draw mode, to deselect whatever's currently selected.
  if (e.key === 'Escape') {
    deselectAll(); updateRightPanel(); render();
  }

  // arrow nudge (selected furniture item) / arrow pan (no selection)
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
    e.preventDefault();
    const item = getSelectedItem();
    if (item) {
      saveSnapshot();
      const step = e.shiftKey ? GRID * 4 : SNAP_GRID;
      if (e.key === 'ArrowLeft') item.x -= step;
      if (e.key === 'ArrowRight') item.x += step;
      if (e.key === 'ArrowUp') item.y -= step;
      if (e.key === 'ArrowDown') item.y += step;
      updateRightPanel(); render(); saveToLocal();
    } else {
      const panStep = (e.shiftKey ? 120 : 40) * state.zoom;
      if (e.key === 'ArrowLeft') state.panX += panStep;
      if (e.key === 'ArrowRight') state.panX -= panStep;
      if (e.key === 'ArrowUp') state.panY += panStep;
      if (e.key === 'ArrowDown') state.panY -= panStep;
      render();
    }
  }
});

document.addEventListener('keyup', e => {
  if (e.key === ' ') {
    mouseState.spaceDown = false;
    canvas.style.cursor = '';
  }
});

// ═══════════════════════════════════════════════════════════
