'use strict';

//  CANVAS SETUP
// ═══════════════════════════════════════════════════════════
const canvasWrap = document.getElementById('canvas-wrap');
const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
const mmCanvas = document.getElementById('minimap-canvas');
const mmCtx = mmCanvas.getContext('2d');

function resizeCanvas() {
  canvas.width = canvasWrap.offsetWidth;
  canvas.height = canvasWrap.offsetHeight;
  render();
}

// The .observe() call itself lives in js/tooltips-init.js (right before
// INIT), not here — its callback (via resizeCanvas) calls render(), which
// isn't defined until js/rendering.js loads. Registering it this early was
// safe in the old single-inline-script version (no network gap between
// files), but with separate <script src> files there's now real time before
// later files finish, so the observer starts only once everything has
// loaded, avoiding a load-order race on its immediate initial-fire callback.

// ═══════════════════════════════════════════════════════════
//  COORDINATE HELPERS
// ═══════════════════════════════════════════════════════════
function screenToWorld(sx, sy) {
  return { x: (sx - state.panX) / state.zoom, y: (sy - state.panY) / state.zoom };
}
function worldToScreen(wx, wy) {
  return { x: wx * state.zoom + state.panX, y: wy * state.zoom + state.panY };
}
function snapPt(pt) {
  if (!state.snapToGrid) return pt;
  return { x: Math.round(pt.x / SNAP_GRID) * SNAP_GRID, y: Math.round(pt.y / SNAP_GRID) * SNAP_GRID };
}

// Snaps onto an existing room's vertex or edge (any room, drawing aid only —
// does not link the two rooms' data). Falls back to grid snapping.
// Sets _lastSnapWasVertex ONLY for a true vertex hit — landing near an
// edge's interior is common while drawing close to any wall and shouldn't
// by itself override the user's angle intent (that used to suppress
// 90°/45° snapping any time the cursor passed near another room, since a
// wide edge-proximity match was treated the same as an exact corner).
let _lastSnapWasVertex = false;
// excludeRoomId/excludePtIdx let a room-vertex drag skip its own two
// adjacent edges and its own position, so it doesn't just snap back onto
// itself instead of onto genuinely different geometry.
function snapToExisting(pt, excludeRoomId, excludePtIdx) {
  const threshold = VERTEX_SNAP_DIST / state.zoom;
  let best = null, bestDist = threshold, bestIsVertex = false;
  for (const room of state.rooms) {
    const pts = room.points;
    const isSelf = room.id === excludeRoomId;
    for (let vi = 0; vi < pts.length; vi++) {
      if (isSelf && vi === excludePtIdx) continue;
      const p = pts[vi];
      const d = dist(pt, p);
      if (d < bestDist) { bestDist = d; best = { x: p.x, y: p.y }; bestIsVertex = true; }
    }
    const segCount = room.open ? pts.length - 1 : pts.length;
    for (let i = 0; i < segCount; i++) {
      if (isSelf && (i === excludePtIdx || (i + 1) % pts.length === excludePtIdx)) continue;
      const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
      const d = pointToSegmentDist(pt.x, pt.y, p1.x, p1.y, p2.x, p2.y);
      if (d < bestDist) {
        const t = projectOnSegment(pt.x, pt.y, p1.x, p1.y, p2.x, p2.y);
        bestDist = d;
        best = { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
        bestIsVertex = false;
      }
    }
  }
  _lastSnapWasVertex = bestIsVertex;
  return best || snapPt(pt);
}

// Snaps a furniture item's top-left position so one of its edges/corners
// aligns with a nearby wall or another item's edge — same "closest
// candidate within a threshold, else fall back to grid" shape as
// snapToExisting, just comparing axis-aligned edges instead of arbitrary
// segments (furniture items are always axis-aligned bounding boxes in
// local space, so only their unrotated x/y extents need to line up).
function snapItemToNearby(item, iw, ih, pt) {
  const threshold = VERTEX_SNAP_DIST / state.zoom;
  const left = pt.x, right = pt.x + iw, top = pt.y, bottom = pt.y + ih;
  let bestDx = null, bestDxDist = threshold;
  let bestDy = null, bestDyDist = threshold;

  const considerX = x => {
    for (const edge of [left, right]) {
      const d = Math.abs(x - edge);
      if (d < bestDxDist) { bestDxDist = d; bestDx = x - edge; }
    }
  };
  const considerY = y => {
    for (const edge of [top, bottom]) {
      const d = Math.abs(y - edge);
      if (d < bestDyDist) { bestDyDist = d; bestDy = y - edge; }
    }
  };

  for (const w of state.walls) {
    considerX(w.a.x); considerX(w.b.x);
    considerY(w.a.y); considerY(w.b.y);
  }
  for (const other of state.items) {
    if (other === item) continue;
    const oDef = FURNITURE_DEFS.find(d => d.id === other.defId);
    if (!oDef) continue;
    const ow = other.customW ?? oDef.w, oh = other.customH ?? oDef.h;
    considerX(other.x); considerX(other.x + ow);
    considerY(other.y); considerY(other.y + oh);
  }

  if (bestDx === null && bestDy === null) return snapPt(pt);
  return {
    x: bestDx !== null ? pt.x + bestDx : snapPt(pt).x,
    y: bestDy !== null ? pt.y + bestDy : snapPt(pt).y,
  };
}

// Ortho-snap: while drawing, a segment nearly horizontal/vertical/45° snaps
// exactly onto that angle (preserving the current length), unless bypassed
// (Alt key) or a real vertex/edge snap already took priority.
const ANGLE_SNAP_DEG = 6;
function applyAngleSnap(pt, fromPt, altBypass) {
  if (altBypass || !fromPt) return pt;
  const dx = pt.x - fromPt.x, dy = pt.y - fromPt.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return pt;
  const step = Math.PI / 4; // 45° increments: 0/45/90/135/180/225/270/315
  const ang = Math.atan2(dy, dx);
  const snappedAng = Math.round(ang / step) * step;
  const diff = Math.abs(((ang - snappedAng + Math.PI) % (2 * Math.PI)) - Math.PI);
  if (diff <= ANGLE_SNAP_DEG * Math.PI / 180) {
    return { x: fromPt.x + Math.cos(snappedAng) * len, y: fromPt.y + Math.sin(snappedAng) * len };
  }
  return pt;
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function pxToMeters(px) { return (px * SCALE).toFixed(2); }

// True area-weighted polygon centroid — unlike averaging vertex positions,
// this stays visually centered for irregular/non-rectangular room shapes.
// Falls back to the vertex average for degenerate (near-zero-area) polygons.
function polygonCentroid(pts) {
  let area = 0, cx = 0, cy = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % n];
    const cross = p1.x * p2.y - p2.x * p1.y;
    area += cross;
    cx += (p1.x + p2.x) * cross;
    cy += (p1.y + p2.y) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-6) {
    return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

// Shoelace-formula area in m². Open (unclosed) rooms have no enclosed area.
function polygonAreaM2(pts) {
  if (!pts || pts.length < 3) return 0;
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % n];
    area += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(area) / 2 * SCALE * SCALE;
}

// Accepts plain numbers or simple arithmetic expressions typed into a
// numeric field (e.g. "14,85+2,1" or "3.2*2"), with either comma or dot as
// the decimal separator. Returns a finite number, or NaN if the input can't
// be safely parsed/evaluated. Never runs eval() on unvalidated input — the
// string is restricted to digits/operators/parens/decimal point first.
function parseSmartNumber(str) {
  if (typeof str !== 'string') return NaN;
  const normalized = str.trim().replace(/,/g, '.');
  if (normalized === '') return NaN;
  if (/^-?\d+(\.\d+)?$/.test(normalized)) return parseFloat(normalized);
  if (!/^[0-9.+\-*/()\s]+$/.test(normalized)) return NaN;
  try {
    const result = Function(`"use strict"; return (${normalized});`)();
    return typeof result === 'number' && isFinite(result) ? result : NaN;
  } catch (e) {
    return NaN;
  }
}

// ═══════════════════════════════════════════════════════════
//  WALL REGISTRY (shared walls — Phase 0: data model + migration only)
// ═══════════════════════════════════════════════════════════
// A room no longer owns its geometry directly. It walks an ordered list of
// wall references (state.walls entries), and room.points is a read-only
// cache recomputed from those walls — every existing consumer of
// room.points (fill, hit-testing, centroid, labels, handles) keeps working
// unmodified. Two rooms sharing a wall reference the SAME wall id, which is
// what lets one door/window/gateway (living on the wall, not the room —
// added in a later phase) affect both sides.
function getWallById(id) {
  return state.walls.find(w => w.id === id) || null;
}

// Returns [{wall, end}] for every wall whose 'a' or 'b' endpoint lies within
// tolerance of pt. Used to detect coincident-vertex sharing at merge time.
function findWallsAtPoint(pt, excludeWallId, tolerance) {
  if (tolerance === undefined) tolerance = VERTEX_SNAP_DIST / state.zoom;
  const hits = [];
  for (const w of state.walls) {
    if (w.id === excludeWallId) continue;
    if (dist(w.a, pt) < tolerance) hits.push({ wall: w, end: 'a' });
    else if (dist(w.b, pt) < tolerance) hits.push({ wall: w, end: 'b' });
  }
  return hits;
}

// Rebuilds room.points from room.wallRefs. room.points must be treated as
// derived/read-only from this point on — all geometry writes go through
// walls, then this cache is refreshed. A closed room's N wallRefs produce N
// points (the last wall's end point IS the first wall's start point, so
// it's implicitly covered by wrap-around); an OPEN room's N wallRefs
// produce N+1 points (each wall's start point, plus the final wall's own
// end point, which nothing else covers).
function computeRoomPoints(room) {
  if (!room.wallRefs) return room.points; // not yet migrated / no wallRefs
  const starts = room.wallRefs.map(ref => {
    const w = getWallById(ref.wallId);
    return ref.reversed ? { x: w.b.x, y: w.b.y } : { x: w.a.x, y: w.a.y };
  });
  if (!room.open || room.wallRefs.length === 0) return starts;
  const lastRef = room.wallRefs[room.wallRefs.length - 1];
  const lastWall = getWallById(lastRef.wallId);
  const end = lastRef.reversed ? { x: lastWall.a.x, y: lastWall.a.y } : { x: lastWall.b.x, y: lastWall.b.y };
  return [...starts, end];
}

function refreshRoomPointsCache() {
  for (const room of state.rooms) {
    if (room.wallRefs) room.points = computeRoomPoints(room);
  }
}

// Recomputes a single room's points cache from its walls. Call after any
// mutation that touches wall geometry for this room's walls.
function syncRoomPointsFromWalls(room) {
  if (room.wallRefs) room.points = computeRoomPoints(room);
}

// The inverse of syncRoomPointsFromWalls: pushes room.points back onto the
// wall endpoints room.wallRefs references, so a direct points[] edit
// (vertex drag, whole-room drag, precision wall-length/angle editing,
// "make perpendicular") doesn't get silently reverted the next time this
// room is extended/joined and syncRoomPointsFromWalls recomputes points
// from its (otherwise stale) walls. NOTE: if any of these walls are shared
// with another room, that room's own view of the wall is NOT updated here
// — propagating a drag/edit to every owning room is Phase 2 (dragging
// through walls) work; this is only the minimum needed to stop a room's
// own edits from reverting on itself.
function pushRoomPointsToWalls(room) {
  if (!room.wallRefs) return;
  const n = room.wallRefs.length;
  const setEnd = (ref, isStart, p) => {
    const w = getWallById(ref.wallId);
    if (!w || !p) return;
    const endKey = (ref.reversed ? !isStart : isStart) ? 'a' : 'b';
    w[endKey].x = p.x; w[endKey].y = p.y;
  };
  // Vertex i is the START of wallRefs[i] AND the END of wallRefs[i-1]
  // (wrapping to the last wallRef for i===0 on a closed room) — both must
  // be updated, since they're the same physical corner.
  for (let i = 0; i < n; i++) {
    setEnd(room.wallRefs[i], true, room.points[i]);
    const prevIdx = (i - 1 + n) % n;
    if (room.open ? i > 0 : true) setEnd(room.wallRefs[prevIdx], false, room.points[i]);
  }
  // Open rooms have one more point than wallRefs (the final wall's own far
  // end, with no "next" wallRef to also share it).
  if (room.open && n > 0) setEnd(room.wallRefs[n - 1], false, room.points[n]);
}

// Finds an existing wall whose endpoints coincide with (pA, pB) in either
// order, owned by some room OTHER than ownerRoomId (a room's own boundary
// can never be legitimately adjacent to itself — see the same exclusion in
// migrateToSharedWalls, needed for thin/corridor-shaped rooms), or creates
// a new wall owned by ownerRoomId. This is the live, mutating counterpart
// to migrateToSharedWalls's migration-only findExistingWall — the actual
// mechanism that makes two rooms drawn touching each other share one wall
// instead of drawing two independent overlapping ones.
// virtual: true marks the implicit closing edge of a self-closed polygon
// (e.g. from double-click/Enter finish) — a synthetic segment the user never
// explicitly drew, existing purely so the shape has a complete boundary to
// fill/measure area with. For this edge, reuse-matching is skipped entirely
// (always creates a fresh wall) rather than searching for a nearby existing
// wall to attach to: the closing edge's endpoints often coincide with a
// vertex freshly created by joining onto another room's wall (see
// handleDrawClick's first-point join), and matching a SYNTHETIC edge against
// that vertex's neighboring wall-halves risked silently importing an
// unrelated far endpoint as this room's corner. A real, intentional
// wall-join (the user actually clicking back onto existing structure) is a
// non-virtual segment and still goes through normal reuse-matching below.
function findOrCreateWall(pA, pB, ownerRoomId, virtual) {
  if (virtual) {
    const wall = { id: wallNextId++, a: { x: pA.x, y: pA.y }, b: { x: pB.x, y: pB.y }, doors: [], windows: [], gateways: [], ownerRoomIds: [ownerRoomId], virtual: true };
    state.walls.push(wall);
    return { wall, reversed: false };
  }

  // Zoom-scaled like every other live-drawing distance check (findWallVertexAt/
  // findWallEdgeAt/getRoomPointAt) — a raw world-unit TOL previously let two
  // unrelated points at high zoom spuriously match.
  const TOL = VERTEX_SNAP_DIST / state.zoom;
  let wall = state.walls.find(w =>
    !w.ownerRoomIds.every(id => id === ownerRoomId) &&
    ((dist(w.a, pA) < TOL && dist(w.b, pB) < TOL) ||
     (dist(w.a, pB) < TOL && dist(w.b, pA) < TOL))
  );
  let reversed;
  if (wall) {
    reversed = dist(wall.a, pB) < TOL;
    if (!wall.ownerRoomIds.includes(ownerRoomId)) wall.ownerRoomIds.push(ownerRoomId);
  } else {
    reversed = false;
    wall = { id: wallNextId++, a: { x: pA.x, y: pA.y }, b: { x: pB.x, y: pB.y }, doors: [], windows: [], gateways: [], ownerRoomIds: [ownerRoomId] };
    state.walls.push(wall);
  }
  return { wall, reversed };
}

// Quantizes a coordinate to a stable string key for graph-node identity.
// This is finer than VERTEX_SNAP_DIST (which is a zoom-dependent screen-
// space click tolerance) — real vertex identity was already established by
// findOrCreateWall's distance matching when the walls were created; this
// key only needs to collapse floating-point jitter between wall endpoints
// that are the "same" point in world space.
function vertexKey(pt) {
  const q = VERTEX_SNAP_DIST / 4;
  return `${Math.round(pt.x / q) * q},${Math.round(pt.y / q) * q}`;
}

// Builds { vertexKey -> [{wall, end}] } over every wall in state.walls,
// fresh per call (walls change too often during drawing/splitting to
// justify a persistent cache with invalidation logic).
function buildWallAdjacency() {
  const adj = new Map();
  for (const w of state.walls) {
    for (const end of ['a', 'b']) {
      const key = vertexKey(w[end]);
      if (!adj.has(key)) adj.set(key, []);
      adj.get(key).push({ wall: w, end });
    }
  }
  return adj;
}

// BFS from fromPt to toPt over the existing wall graph (walls as edges,
// endpoints as nodes). Returns an array of {wall, end} hops (end = the
// ENTRY-side end of that wall for that hop), or null if no path exists.
// Unweighted BFS naturally finds the shortest path by hop count, which
// resolves "which way around" ambiguity (e.g. clockwise vs counter-
// clockwise around a rectangular room) by preferring the smaller, more
// plausible enclosed area.
function traceClosingPath(fromPt, toPt) {
  const startKey = vertexKey(fromPt);
  const endKey = vertexKey(toPt);
  if (startKey === endKey) return []; // trivial: same vertex, nothing to trace

  const adj = buildWallAdjacency();
  if (!adj.has(startKey) || !adj.has(endKey)) return null;

  const visited = new Set([startKey]);
  const cameFrom = new Map();
  const queue = [startKey];
  while (queue.length) {
    const currentKey = queue.shift();
    if (currentKey === endKey) break;
    for (const { wall, end } of (adj.get(currentKey) || [])) {
      const otherEnd = end === 'a' ? 'b' : 'a';
      const nextKey = vertexKey(wall[otherEnd]);
      if (visited.has(nextKey)) continue;
      visited.add(nextKey);
      cameFrom.set(nextKey, { wall, end, fromKey: currentKey });
      queue.push(nextKey);
    }
  }
  if (!visited.has(endKey)) return null; // disconnected — caller falls back to open

  const hops = [];
  let k = endKey;
  while (k !== startKey) {
    const step = cameFrom.get(k);
    hops.push(step);
    k = step.fromKey;
  }
  hops.reverse();
  return hops;
}

// Converts traceClosingPath's hops into wallRefs. Entering a wall at end
// 'a' means walking it a->b (reversed:false, matching computeRoomPoints's
// convention that reversed:false means the effective start is wall.a);
// entering at 'b' means walking b->a (reversed:true).
function hopsToWallRefs(hops) {
  return hops.map(({ wall, end }) => ({ wallId: wall.id, reversed: end === 'b' }));
}

// One-time migration from the old flat-points format (no `version` field,
// or version < 2) to the shared-wall format. Old rooms store their own
// independent points[]/doors[]/windows[]/gateways[]; this walks each room's
// Furniture item.rot used to be an integer quarter-turn count (0-3); it's
// now stored as a raw radians angle so free rotation is possible. Old saves
// have small integers here — convert them once. Safe/idempotent: an
// already-migrated item's rot is a radians float that only coincides with
// an integer 0-3 at the trivial rot=0 case, where the conversion is a no-op
// anyway (0 * anything = 0).
function migrateItemRotations(items) {
  for (const item of items || []) {
    if (Number.isInteger(item.rot) && item.rot >= 0 && item.rot <= 3) {
      item.rot = item.rot * Math.PI / 2;
    }
  }
  return items;
}

// Repairs walls saved by an earlier build of migrateToSharedWalls that
// predated the ownerRoomIds field (that version wrote version:2 without
// it, so the normal version-gated migration never re-runs for this data —
// it thinks it's already up to date). Every write path to state.walls
// requires ownerRoomIds to exist (findOrCreateWall, splitWallAt,
// deleteSelectedRoom all call array methods on it directly), so a wall
// missing it crashes the instant a room referencing it is drawn/extended.
// Derives correct ownership from wallRefs (the actual source of truth for
// "which rooms use this wall") rather than guessing. Safe/idempotent to
// run on every load — a no-op when every wall already has the field.
function repairMissingWallOwnership(rooms, walls) {
  const ownersByWallId = new Map();
  for (const room of rooms || []) {
    for (const ref of room.wallRefs || []) {
      if (!ownersByWallId.has(ref.wallId)) ownersByWallId.set(ref.wallId, []);
      ownersByWallId.get(ref.wallId).push(room.id);
    }
  }
  for (const wall of walls || []) {
    if (!Array.isArray(wall.ownerRoomIds)) {
      wall.ownerRoomIds = ownersByWallId.get(wall.id) || [];
    }
  }
  return walls;
}

// edges and reuses an existing wall when its endpoints coincide (within
// VERTEX_SNAP_DIST) with an already-created wall's endpoints, else creates
// a new wall. This is the first field-transforming migration in this
// codebase (seedDesignsFromLegacySave only ever wrapped an old blob
// unchanged) — future migrations should follow the same version-gated
// pattern rather than inventing a new one.
function migrateToSharedWalls(data) {
  if (!data || !data.rooms) return data;
  const walls = [];
  let nextWallId = 1;
  const TOL = VERTEX_SNAP_DIST;

  // Only reuse a wall created by a DIFFERENT room's loop — a room's own
  // boundary can never be legitimately adjacent to itself, so matching
  // against walls pushed earlier in the same room's iteration (e.g. two
  // opposite edges of a thin/corridor-shaped room sitting within TOL of
  // each other) would falsely collapse them and drop one side's openings.
  function findExistingWall(pA, pB, excludeOwnerRoomId) {
    return walls.find(w =>
      w.ownerRoomId !== excludeOwnerRoomId &&
      ((dist(w.a, pA) < TOL && dist(w.b, pB) < TOL) ||
       (dist(w.a, pB) < TOL && dist(w.b, pA) < TOL))
    );
  }

  for (const room of data.rooms) {
    const pts = room.points || [];
    const segCount = room.open ? pts.length - 1 : pts.length;
    const wallRefs = [];
    const oldDoors = room.doors || [], oldWindows = room.windows || [], oldGateways = room.gateways || [];

    for (let i = 0; i < segCount; i++) {
      const pA = pts[i], pB = pts[(i + 1) % pts.length];
      let wall = findExistingWall(pA, pB, room.id);
      let reversed;
      if (wall) {
        reversed = dist(wall.a, pB) < TOL;
      } else {
        reversed = false;
        wall = { id: nextWallId++, a: { x: pA.x, y: pA.y }, b: { x: pB.x, y: pB.y }, doors: [], windows: [], gateways: [], ownerRoomId: room.id };
        walls.push(wall);
      }
      wallRefs.push({ wallId: wall.id, reversed });

      const reparent = (list, o) => {
        const t = reversed ? 1 - o.t : o.t;
        const { wallIdx, ...rest } = o;
        list.push({ ...rest, t });
      };
      for (const d of oldDoors.filter(o => o.wallIdx === i)) {
        if (wall.doors.length) { console.warn('merged wall had doors from both sides, kept the first'); continue; }
        reparent(wall.doors, d);
      }
      for (const w2 of oldWindows.filter(o => o.wallIdx === i)) {
        if (wall.windows.length) { console.warn('merged wall had windows from both sides, kept the first'); continue; }
        reparent(wall.windows, w2);
      }
      for (const g of oldGateways.filter(o => o.wallIdx === i)) {
        if (wall.gateways.length) { console.warn('merged wall had gateways from both sides, kept the first'); continue; }
        reparent(wall.gateways, g);
      }
    }

    room.wallRefs = wallRefs;
    delete room.doors; delete room.windows; delete room.gateways;
    // computeRoomPoints() looks walls up via state.walls, which isn't
    // populated yet during migration — recompute inline against the local
    // `walls` array instead. A closed room's N wallRefs give N points
    // (wrap-around covers the last->first edge); an OPEN room's N wallRefs
    // give N+1 points (each wall's start, plus the final wall's own end,
    // which nothing else covers) — same logic as the live computeRoomPoints.
    const starts = wallRefs.map(ref => {
      const w = walls.find(x => x.id === ref.wallId);
      return ref.reversed ? { x: w.b.x, y: w.b.y } : { x: w.a.x, y: w.a.y };
    });
    if (!room.open || wallRefs.length === 0) {
      room.points = starts;
    } else {
      const lastRef = wallRefs[wallRefs.length - 1];
      const lastWall = walls.find(x => x.id === lastRef.wallId);
      const end = lastRef.reversed ? { x: lastWall.a.x, y: lastWall.a.y } : { x: lastWall.b.x, y: lastWall.b.y };
      room.points = [...starts, end];
    }
  }

  const cleanWalls = walls.map(({ ownerRoomId, ...w }) => ({ ...w, ownerRoomIds: [ownerRoomId] }));
  return { ...data, rooms: data.rooms, walls: cleanWalls, wallNextId: nextWallId, version: 2 };
}

// ═══════════════════════════════════════════════════════════
//  UNDO / REDO
// ═══════════════════════════════════════════════════════════
function saveSnapshot() {
  undoStack.push(JSON.stringify({ rooms: state.rooms, walls: state.walls, items: state.items, nextId, wallNextId }));
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify({ rooms: state.rooms, walls: state.walls, items: state.items, nextId, wallNextId }));
  const snap = JSON.parse(undoStack.pop());
  state.rooms = snap.rooms; state.walls = snap.walls || []; state.items = snap.items;
  nextId = snap.nextId; wallNextId = snap.wallNextId || 1;
  state.selectedId = null;
  updateRightPanel(); render(); updateStatus();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify({ rooms: state.rooms, walls: state.walls, items: state.items, nextId, wallNextId }));
  const snap = JSON.parse(redoStack.pop());
  state.rooms = snap.rooms; state.walls = snap.walls || []; state.items = snap.items;
  nextId = snap.nextId; wallNextId = snap.wallNextId || 1;
  state.selectedId = null;
  updateRightPanel(); render(); updateStatus();
}

// ═══════════════════════════════════════════════════════════
