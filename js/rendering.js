'use strict';

//  ROOM COLORS
// ═══════════════════════════════════════════════════════════
const ROOM_COLORS = [
  { fill: 'rgba(74,158,255,0.08)', stroke: '#4a9eff' },
  { fill: 'rgba(80,250,123,0.08)', stroke: '#50fa7b' },
  { fill: 'rgba(255,121,198,0.08)', stroke: '#ff79c6' },
  { fill: 'rgba(189,147,249,0.08)', stroke: '#bd93f9' },
  { fill: 'rgba(255,184,108,0.08)', stroke: '#ffb86c' },
  { fill: 'rgba(241,250,140,0.08)', stroke: '#f1fa8c' },
];
const ROOM_TYPES = ['Living Room','Bedroom','Bathroom','Kitchen','Office','Hallway','Dining Room'];

// ═══════════════════════════════════════════════════════════
//  RENDERING
// ═══════════════════════════════════════════════════════════
function render() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // background
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, W, H);

  // grid drawn in screen space (no transform), so it covers full canvas
  if (state.showGrid) drawGrid();

  // Empty-state hint — a fresh/cleared design otherwise shows nothing but
  // grid+ruler, which looks identical to "broken" once the one-time tutorial
  // has already been seen/skipped. Purely a function of current content, no
  // separate dismiss flag needed: it vanishes the instant a room exists.
  if (state.rooms.length === 0 && state.items.length === 0) drawEmptyStateHint(W, H);

  ctx.save();
  ctx.translate(state.panX, state.panY);
  ctx.scale(state.zoom, state.zoom);

  // scale ruler
  drawRuler(W, H);

  // rooms — one malformed room (e.g. missing/dangling wall data) must not
  // abort the loop mid-way, since that would skip the matching ctx.restore()
  // below and leave the canvas transform stacked/doubled on every
  // subsequent render.
  // labeledWallIds resets every frame: when two rooms share a physical wall
  // (each with their own wallRefs entry pointing at the same wall object),
  // each room's independent label-drawing pass would otherwise stamp its own
  // length label at the same midpoint, overlapping. Only the first room to
  // draw a given wall's label gets to — good enough since both rooms report
  // the same physical length anyway.
  const labeledWallIds = new Set();
  state.rooms.forEach(room => {
    try { drawRoom(room, ctx, labeledWallIds); } catch (e) { console.warn('Failed to draw room', room.id, e); }
  });

  // in-progress draw
  if ((state.mode === 'draw' || state.mode === 'drawwall' || state.mode === 'extend') && state.drawPoints.length > 0) {
    drawInProgress();
  }

  // furniture items
  state.items.forEach(item => {
    const def = FURNITURE_DEFS.find(d => d.id === item.defId);
    if (def) drawFurnitureItem(item, def);
  });

  ctx.restore();

  renderMinimap();
  updateStatus();
}

function drawEmptyStateHint(W, H) {
  const cx = W / 2, cy = H / 2 - 20;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('Draw your first room to get started', cx, cy);
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillText('Click "Room" in the toolbar above, then click to place corners', cx, cy + 24);

  // small upward-pointing arrow toward the toolbar
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 20);
  ctx.lineTo(cx, cy - 48);
  ctx.moveTo(cx - 6, cy - 42);
  ctx.lineTo(cx, cy - 48);
  ctx.lineTo(cx + 6, cy - 42);
  ctx.stroke();
  ctx.restore();
}

function drawGrid(c = ctx, w = canvas.width, h = canvas.height, dark = true) {
  const W = w, H = h;
  const step = GRID * state.zoom;
  const ox = ((state.panX % step) + step) % step;
  const oy = ((state.panY % step) + step) % step;
  const majorStep = step * 4;
  const mox = ((state.panX % majorStep) + majorStep) % majorStep;
  const moy = ((state.panY % majorStep) + majorStep) % majorStep;
  const minorColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
  const majorColor = dark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.16)';

  c.lineWidth = 0.5;
  c.strokeStyle = minorColor;
  c.beginPath();
  for (let x = ox - step; x <= W; x += step) { c.moveTo(x, 0); c.lineTo(x, H); }
  for (let y = oy - step; y <= H; y += step) { c.moveTo(0, y); c.lineTo(W, y); }
  c.stroke();

  c.strokeStyle = majorColor;
  c.beginPath();
  for (let x = mox - majorStep; x <= W; x += majorStep) { c.moveTo(x, 0); c.lineTo(x, H); }
  for (let y = moy - majorStep; y <= H; y += majorStep) { c.moveTo(0, y); c.lineTo(W, y); }
  c.stroke();
}

function drawRuler(W, H, c = ctx, dark = true) {
  // horizontal ruler
  const rulerH = 20;
  const rulerBg = dark ? 'rgba(20,20,20,0.9)' : 'rgba(255,255,255,0.9)';
  const textColor = dark ? '#666' : '#555';
  const tickColor = dark ? 'rgba(100,100,100,0.4)' : 'rgba(0,0,0,0.35)';
  const scaleBarColor = dark ? '#888' : '#555';
  c.fillStyle = rulerBg;
  c.fillRect(-state.panX / state.zoom, -state.panY / state.zoom, W / state.zoom, rulerH / state.zoom);

  c.fillStyle = textColor;
  c.font = `${9 / state.zoom}px sans-serif`;
  c.textAlign = 'center';

  const startX = -state.panX / state.zoom;
  const endX = (W - state.panX) / state.zoom;
  const step = GRID * 4;
  const x0 = Math.floor(startX / step) * step;

  for (let x = x0; x < endX; x += step) {
    c.fillStyle = textColor;
    c.fillText(`${(x * SCALE).toFixed(1)}m`, x, -state.panY / state.zoom + 12 / state.zoom);
    c.strokeStyle = tickColor;
    c.lineWidth = 0.5 / state.zoom;
    c.beginPath();
    c.moveTo(x, -state.panY / state.zoom);
    c.lineTo(x, -state.panY / state.zoom + rulerH / state.zoom);
    c.stroke();
  }

  // scale bar
  const sbX = (-state.panX / state.zoom) + 10;
  const sbY = (-state.panY / state.zoom) + (H - 40) / state.zoom;
  const sbW = GRID * 4; // = 2m
  c.strokeStyle = scaleBarColor;
  c.lineWidth = 2 / state.zoom;
  c.beginPath();
  c.moveTo(sbX, sbY); c.lineTo(sbX + sbW, sbY);
  c.moveTo(sbX, sbY - 4 / state.zoom); c.lineTo(sbX, sbY + 4 / state.zoom);
  c.moveTo(sbX + sbW, sbY - 4 / state.zoom); c.lineTo(sbX + sbW, sbY + 4 / state.zoom);
  c.stroke();
  c.fillStyle = scaleBarColor;
  c.font = `${10 / state.zoom}px sans-serif`;
  c.textAlign = 'center';
  c.fillText('2m', sbX + sbW / 2, sbY - 6 / state.zoom);
}

function drawRoom(room, c = ctx, labeledWallIds = null) {
  if (room.points.length < 2) return;
  const interactive = c === ctx;
  const ci = room.colorIndex ?? 0;
  const col = ROOM_COLORS[ci % ROOM_COLORS.length];
  const strokeColor = room.customStroke || col.stroke;
  const opacity = (room.customOpacity ?? 8) / 100;
  const isSelected = interactive && room.id === state.selectedRoomId;
  const isOpen = room.open;
  const pts = room.points;
  const wallCount = isOpen ? pts.length - 1 : pts.length;

  if (!isOpen) {
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    c.closePath();
    c.fillStyle = strokeColor.startsWith('#')
      ? hexToRgba(strokeColor, opacity)
      : `rgba(200,200,200,${opacity})`;
    c.fill();
  }

  // wall stroke — skip spans covered by gateways so the wall visually opens up
  c.strokeStyle = isSelected ? '#fff' : strokeColor;
  const baseLineWidth = room.role === 'building' ? 4 : 2;
  c.lineWidth = (isSelected ? baseLineWidth + 0.5 : baseLineWidth) / state.zoom;
  const roomDash = room.role === 'balcony' ? [6 / state.zoom, 4 / state.zoom] : [];
  const virtualDash = [4 / state.zoom, 4 / state.zoom];
  c.setLineDash(roomDash);
  // Pass 1: compute each wall's drawn (non-gap) spans in isolation.
  // wallRefs[i] and edge i correspond 1:1 by construction — every opening
  // on that wall belongs to this span, no wallIdx filter needed. When the
  // room walks the wall in reverse (ref.reversed), the wall's own gap t
  // values (stored in the wall's canonical a→b orientation) are mirrored
  // to match the direction being stroked here.
  const wallSpans = [];
  for (let i = 0; i < wallCount; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
    const ref = room.wallRefs?.[i];
    const wallObj = ref ? getWallById(ref.wallId) : null;
    const gaps = wallObj
      ? [...wallObj.gateways, ...wallObj.doors, ...wallObj.windows]
        .map(o => getOpeningGeom(wallObj, o))
        .filter(Boolean)
        .map(g => ref.reversed ? { ...g, t1: 1 - g.t2, t2: 1 - g.t1 } : g)
        .sort((a, b) => a.t1 - b.t1)
      : [];
    const spans = [];
    // A virtual wall (the implicit self-close edge from an Enter/double-click
    // finish, see buildWallRefsForRoom) is still stroked like any other wall —
    // otherwise a closed room visually looks "open" on that edge. `virtual`
    // only means it's non-interactive: not selectable/editable, no doors or
    // windows placeable on it, not a joinable structural wall for other rooms.
    // A Call Room has no wallRefs at all (wallObj is always null for it) —
    // it must render as a plain filled/labeled polygon with NO stroke,
    // never real-looking walls, since it has no underlying wall data.
    if (!room.callRoom) {
      let t = 0;
      for (const gap of gaps) {
        if (gap.t1 > t) spans.push([t, gap.t1]);
        t = Math.max(t, gap.t2);
      }
      if (t < 1) spans.push([t, 1]);
    }
    wallSpans.push({ p1, p2, spans, isVirtual: !!wallObj?.virtual, touchesStart: gaps.length > 0 && gaps[0].t1 < NOTCH_T, touchesEnd: gaps.length > 0 && gaps[gaps.length - 1].t2 > 1 - NOTCH_T });
  }
  // Pass 2: purely cosmetic — if an opening sits right at a wall's corner,
  // nibble a small notch off the START of the span of the wall that meets
  // it there too, so the cut doesn't look like it stops abruptly at the
  // joint. Does not touch hit-testing, labels, or wallIdx/t data anywhere.
  for (let i = 0; i < wallCount; i++) {
    const wall = wallSpans[i];
    const len = dist(wall.p1, wall.p2);
    if (len < 1) continue;
    const notchT = Math.min(0.4, NOTCH_PX / len);
    const prev = wallSpans[(i - 1 + wallCount) % wallCount];
    const next = wallSpans[(i + 1) % wallCount];
    if (wall.touchesStart && prev && prev !== wall && prev.spans.length) {
      const last = prev.spans[prev.spans.length - 1];
      if (last[1] > 1 - 1e-6) last[1] = Math.max(last[0], 1 - notchT);
    }
    if (wall.touchesEnd && next && next !== wall && next.spans.length) {
      const first = next.spans[0];
      if (first[0] < 1e-6) first[0] = Math.min(first[1], notchT);
    }
  }
  for (const wall of wallSpans) {
    // Dashed so an auto-generated closing edge (from Enter/double-click
    // finish) is visually distinguishable from a wall the user actually
    // drew, even though both are stroked the same otherwise (see the
    // "virtual only means non-interactive" note above).
    c.setLineDash(wall.isVirtual ? virtualDash : roomDash);
    for (const [t1, t2] of wall.spans) drawWallSpan(c, wall.p1, wall.p2, t1, t2);
  }
  c.setLineDash([]);

  // doors, windows, gateways — draw a shared wall's openings only once,
  // from its first owning room, so a wall shared by two rooms doesn't get
  // its doors/windows/gateways drawn twice.
  room.wallRefs?.forEach(ref => {
    const w = getWallById(ref.wallId);
    if (!w || w.ownerRoomIds[0] !== room.id) return;
    w.doors.forEach(d => drawOpeningOnWall(w, d, 'door', c));
    w.windows.forEach(win => drawOpeningOnWall(w, win, 'window', c));
    w.gateways.forEach(g => drawGateway(w, g, c));
  });

  // wall dimension labels — skip the virtual self-close edge (not a real
  // wall the user drew) and skip entirely for Call Room (no real walls at
  // all, just a traced/labeled area).
  for (let i = 0; i < wallCount && !room.callRoom; i++) {
    const ref = room.wallRefs?.[i];
    if (ref && getWallById(ref.wallId)?.virtual) continue;
    // A wall shared between two rooms (each with their own wallRefs entry
    // pointing at the same wall object) would otherwise get labeled twice,
    // once per room, both landing on the same physical midpoint.
    if (ref && labeledWallIds) {
      if (labeledWallIds.has(ref.wallId)) continue;
      labeledWallIds.add(ref.wallId);
    }
    const p = pts[i], next = pts[(i + 1) % pts.length];
    const mx = (p.x + next.x) / 2, my = (p.y + next.y) / 2;
    const d = dist(p, next);
    if (d < 10) continue;
    const meters = (d * SCALE).toFixed(2);
    const angle = Math.atan2(next.y - p.y, next.x - p.x);
    c.save();
    c.translate(mx, my);
    c.rotate(angle);
    c.fillStyle = isSelected ? '#fff' : strokeColor;
    c.font = `${10 / state.zoom}px sans-serif`;
    c.textAlign = 'center';
    c.globalAlpha = isSelected ? 1 : 0.8;
    c.fillText(`${meters}m`, 0, -5 / state.zoom);
    c.globalAlpha = 1;
    c.restore();
  }

  // room name + surface area labels — true polygon centroid so they stay
  // centered even on irregular (non-rectangular) room shapes, not just an
  // average of corners. Area only applies to closed rooms (open polylines
  // have no enclosed area).
  const showName = (room.showName !== false) && room.name;
  const showArea = room.showArea && !isOpen;
  if ((showName || showArea) && pts.length >= 2) {
    const centroid = pts.length >= 3 ? polygonCentroid(pts) : { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    const cx = centroid.x, cy = centroid.y;
    c.fillStyle = isSelected ? '#fff' : strokeColor;
    c.textAlign = 'center';
    c.globalAlpha = isSelected ? 0.9 : 0.6;
    if (showName) {
      c.font = `bold ${13 / state.zoom}px sans-serif`;
      c.fillText(room.name, cx, cy);
    }
    if (showArea) {
      c.font = `${11 / state.zoom}px sans-serif`;
      const areaY = showName ? cy + 14 / state.zoom : cy;
      c.fillText(`${polygonAreaM2(pts).toFixed(2)} m²`, cx, areaY);
    }
    c.globalAlpha = 1;
  }

  // point handles when selected (interactive only)
  if (isSelected) {
    pts.forEach((p, i) => {
      c.fillStyle = '#fff';
      c.strokeStyle = '#555';
      c.lineWidth = 1 / state.zoom;
      c.beginPath();
      c.arc(p.x, p.y, 6 / state.zoom, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    });
  }
}

function drawWallSpan(c, p1, p2, t1, t2) {
  const ax = p1.x + (p2.x - p1.x) * t1, ay = p1.y + (p2.y - p1.y) * t1;
  const bx = p1.x + (p2.x - p1.x) * t2, by = p1.y + (p2.y - p1.y) * t2;
  c.beginPath();
  c.moveTo(ax, ay);
  c.lineTo(bx, by);
  c.stroke();
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

// Shared geometry for any opening type (door/window/gateway) — all live on
// a wall's own doors/windows/gateways array and store {t, width}, positioned
// identically along that wall (in the wall's canonical a->b orientation).
function getOpeningGeom(wall, o) {
  const p1 = wall.a, p2 = wall.b;
  const wallLen = dist(p1, p2);
  if (wallLen < 1) return null;
  const width = o.width ?? DEFAULT_OPENING_PX;
  const halfT = (width / 2) / wallLen;
  const t = o.t ?? 0.5;
  const t1 = Math.max(0, t - halfT), t2 = Math.min(1, t + halfT);
  const ax = p1.x + (p2.x - p1.x) * t1, ay = p1.y + (p2.y - p1.y) * t1;
  const bx = p1.x + (p2.x - p1.x) * t2, by = p1.y + (p2.y - p1.y) * t2;
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  return { p1, p2, wallLen, t1, t2, ax, ay, bx, by, angle, width };
}

function getDoorGeom(wall, d) { return getOpeningGeom(wall, d); }

// Iterates state.walls (not state.rooms) so a door on a wall shared by two
// rooms is found/hit-testable regardless of which room "owns" the click.
function getDoorAt(wx, wy) {
  const HIT = 12 / state.zoom;
  for (const wall of state.walls) {
    for (const d of wall.doors) {
      const g = getOpeningGeom(wall, d);
      if (!g) continue;
      const mx = (g.ax + g.bx) / 2, my = (g.ay + g.by) / 2;
      if (dist({x:wx,y:wy},{x:mx,y:my}) < HIT) return { wall, door: d, part: 'center' };
      if (dist({x:wx,y:wy},{x:g.ax,y:g.ay}) < HIT) return { wall, door: d, part: 'left' };
      if (dist({x:wx,y:wy},{x:g.bx,y:g.by}) < HIT) return { wall, door: d, part: 'right' };
    }
  }
  return null;
}

function getWindowAt(wx, wy) {
  const HIT = 12 / state.zoom;
  for (const wall of state.walls) {
    for (const w of wall.windows) {
      const g = getOpeningGeom(wall, w);
      if (!g) continue;
      const mx = (g.ax + g.bx) / 2, my = (g.ay + g.by) / 2;
      if (dist({x:wx,y:wy},{x:mx,y:my}) < HIT) return { wall, window: w, part: 'center' };
      if (dist({x:wx,y:wy},{x:g.ax,y:g.ay}) < HIT) return { wall, window: w, part: 'left' };
      if (dist({x:wx,y:wy},{x:g.bx,y:g.by}) < HIT) return { wall, window: w, part: 'right' };
    }
  }
  return null;
}

// Shared selection affordances (edge ticks, center/edge drag handles, width
// label) for any opening type — the wall-line gap itself is already drawn by
// drawRoom/drawWallSpan, this only adds the interactive chrome + optional leaf.
function drawOpeningSelectionChrome(c, g, isSel, tickColor) {
  const { ax, ay, bx, by, angle } = g;
  const tickLen = 8 / state.zoom;
  c.strokeStyle = isSel ? '#fff' : tickColor;
  c.lineWidth = (isSel ? 2 : 1.5) / state.zoom;
  [[ax, ay], [bx, by]].forEach(([x, y]) => {
    c.save();
    c.translate(x, y);
    c.rotate(angle + Math.PI / 2);
    c.beginPath();
    c.moveTo(-tickLen, 0);
    c.lineTo(tickLen, 0);
    c.stroke();
    c.restore();
  });

  if (!isSel) return;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  c.fillStyle = '#fff'; c.strokeStyle = '#555';
  c.lineWidth = 1 / state.zoom;
  c.beginPath(); c.arc(mx, my, 6 / state.zoom, 0, Math.PI * 2);
  c.fill(); c.stroke();
  [[ax, ay], [bx, by]].forEach(([x, y]) => {
    c.fillStyle = '#ccc';
    c.beginPath(); c.arc(x, y, 5 / state.zoom, 0, Math.PI * 2);
    c.fill(); c.stroke();
  });
  const wm = ((g.width ?? DEFAULT_OPENING_PX) * SCALE).toFixed(2);
  c.font = `bold ${10 / state.zoom}px sans-serif`;
  c.textAlign = 'center';
  const lbl = `${wm}m`;
  const tw = c.measureText(lbl).width + 6;
  c.fillStyle = 'rgba(0,0,0,0.75)';
  c.fillRect(mx - tw / 2, my + 8 / state.zoom, tw, 14 / state.zoom);
  c.fillStyle = '#fff';
  c.fillText(lbl, mx, my + 18 / state.zoom);
}

function drawOpeningOnWall(wall, opening, type, c = ctx) {
  const interactive = c === ctx;

  if (type === 'door') {
    const g = getOpeningGeom(wall, opening);
    if (!g) return;
    const len = g.width;
    const mx = (g.ax + g.bx) / 2, my = (g.ay + g.by) / 2;
    const isSel = interactive && state.selectedDoor && state.selectedDoor.door === opening;

    if (opening.showSwing !== false) {
      c.save();
      c.translate(mx, my);
      c.rotate(g.angle);
      if (opening.doorType === 'sliding') {
        // Sliding door symbol: two overlapping thin panels along the wall,
        // one recessed above/below the wall line, no swing arc.
        const panelLen = len * 0.55;
        const thick = 3 / state.zoom;
        c.strokeStyle = isSel ? '#ffd580' : '#ffb86c';
        c.fillStyle = 'rgba(255,184,108,0.25)';
        c.lineWidth = (isSel ? 2 : 1.5) / state.zoom;
        // rear panel (recessed)
        c.fillRect(-len / 2, -thick * 2, panelLen, thick);
        c.strokeRect(-len / 2, -thick * 2, panelLen, thick);
        // front panel (overlapping, slid partway open)
        c.fillRect(-panelLen * 0.45, thick, panelLen, thick);
        c.strokeRect(-panelLen * 0.45, thick, panelLen, thick);
      } else {
        const flipY = opening.flipped ? 1 : -1;    // arc above (-1) or below (1) the wall line
        const flipX = opening.mirrored ? -1 : 1;   // hinge at left (1) or right (-1) end
        c.save();
        c.scale(flipX, flipY);
        // door panel: hinge at left (-len/2), panel goes upward, arc sweeps 90°
        c.strokeStyle = isSel ? '#ffd580' : '#ffb86c';
        c.fillStyle = 'rgba(255,184,108,0.12)';
        c.lineWidth = (isSel ? 2.5 : 1.5) / state.zoom;
        c.beginPath();
        c.moveTo(-len / 2, 0);
        c.lineTo(-len / 2, -len);
        c.arc(-len / 2, 0, len, -Math.PI / 2, 0);
        c.fill();
        c.beginPath();
        c.moveTo(-len / 2, 0); c.lineTo(-len / 2, -len);
        c.stroke();
        c.beginPath();
        c.arc(-len / 2, 0, len, -Math.PI / 2, 0); c.stroke();
        c.restore();
      }
      c.restore();
    }

    drawOpeningSelectionChrome(c, g, isSel, '#888');
    return;
  }

  // window
  const g = getOpeningGeom(wall, opening);
  if (!g) return;
  const len = g.width;
  const isSel = interactive && state.selectedWindow && state.selectedWindow.window === opening;

  if (opening.showSash !== false) {
    // Thin overlay (like a gateway's ticks) rather than a thick filled box —
    // a single glass line along the opening plus short end ticks.
    const mx = (g.ax + g.bx) / 2, my = (g.ay + g.by) / 2;
    const tickLen = 4 / state.zoom;
    c.save();
    c.translate(mx, my);
    c.rotate(g.angle);
    c.strokeStyle = '#88aaff';
    c.lineWidth = 2 / state.zoom;
    c.beginPath(); c.moveTo(-len / 2, 0); c.lineTo(len / 2, 0); c.stroke();
    c.lineWidth = 1.5 / state.zoom;
    [-len / 2, len / 2].forEach(x => {
      c.beginPath(); c.moveTo(x, -tickLen); c.lineTo(x, tickLen); c.stroke();
    });
    c.restore();
  }

  drawOpeningSelectionChrome(c, g, isSel, '#88aaff');
}

function getGatewayGeom(wall, gw) { return getOpeningGeom(wall, gw); }

function drawGateway(wall, gw, c = ctx) {
  const interactive = c === ctx;
  const g = getGatewayGeom(wall, gw);
  if (!g) return;
  const isSel = interactive && state.selectedGateway && state.selectedGateway.gw === gw;
  // The wall stroke itself already skips this span (see drawRoom/drawWallSpan) —
  // a real break in the line, not a painted-over erase mark. Gateway has no
  // leaf visual, just the shared selection chrome.
  drawOpeningSelectionChrome(c, g, isSel, '#888');
}

function drawInProgress() {
  const pts = state.drawPoints;
  if (pts.length === 0) return;

  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.5 / state.zoom;
  ctx.setLineDash([6 / state.zoom, 4 / state.zoom]);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  pts.forEach((p, i) => { if (i > 0) ctx.lineTo(p.x, p.y); });
  if (state._mouseWorld) ctx.lineTo(state._mouseWorld.x, state._mouseWorld.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // points
  pts.forEach((p, i) => {
    ctx.fillStyle = i === 0 ? '#fff' : '#aaa';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5 / state.zoom, 0, Math.PI * 2);
    ctx.fill();
  });

  // close hint
  if (pts.length >= 3) {
    const d = dist(state._mouseWorld || pts[pts.length - 1], pts[0]);
    if (d * state.zoom < CLOSE_DIST * 2) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 / state.zoom;
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, CLOSE_DIST / state.zoom, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawFurnitureItem(item, def) {
  const isSelected = item.id === state.selectedId;
  const iw = item.customW ?? def.w;
  const ih = item.customH ?? def.h;

  ctx.save();
  ctx.translate(item.x + iw / 2, item.y + ih / 2);
  ctx.rotate(item.rot);
  if (item.flipped) ctx.scale(-1, 1);
  ctx.translate(-iw / 2, -ih / 2);

  // shadow
  if (isSelected) {
    ctx.shadowColor = 'rgba(255,255,255,0.4)';
    ctx.shadowBlur = 12 / state.zoom;
  }

  if (item.imageDataUrl) {
    const img = getFurnitureImage(item);
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, 0, 0, iw, ih);
  } else {
    // offscreen canvas for furniture
    const ofc = getFurnitureCanvas(def, item.color || '#888', iw, ih);
    ctx.drawImage(ofc, 0, 0, iw, ih);
  }

  ctx.shadowBlur = 0;

  // selection border
  if (isSelected) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5 / state.zoom;
    ctx.setLineDash([4 / state.zoom, 3 / state.zoom]);
    ctx.strokeRect(-2, -2, iw + 4, ih + 4);
    ctx.setLineDash([]);

    // corner handles (resize)
    ctx.fillStyle = '#fff';
    [[0,0],[iw,0],[iw,ih],[0,ih]].forEach(([hx,hy]) => {
      ctx.fillRect(hx - 3, hy - 3, 6, 6);
    });

    // rotate handle — a small circle above the top-center edge, connected
    // by a thin stem, following the common "drag to rotate" convention.
    const rh = ROTATE_HANDLE_DIST / state.zoom;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1 / state.zoom;
    ctx.beginPath();
    ctx.moveTo(iw / 2, 0);
    ctx.lineTo(iw / 2, -rh);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(iw / 2, -rh, 5 / state.zoom, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // dimension label
    const wm = (item.customW ? (item.customW * SCALE).toFixed(2) : (iw * SCALE).toFixed(2));
    const hm = (item.customH ? (item.customH * SCALE).toFixed(2) : (ih * SCALE).toFixed(2));
    const lbl = `${wm}×${hm}m`;
    ctx.font = `bold ${11 / state.zoom}px sans-serif`;
    const tw = ctx.measureText(lbl).width + 8;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(iw / 2 - tw / 2, ih + 5 / state.zoom, tw, 16 / state.zoom);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(lbl, iw / 2, ih + 15 / state.zoom);
  }

  ctx.restore();
}

// Cache furniture canvases
const furnitureCache = new Map();
function getFurnitureCanvas(def, color, cw, ch) {
  const w = cw ?? def.w, h = ch ?? def.h;
  const key = `${def.id}_${color}_${w}_${h}`;
  if (furnitureCache.has(key)) return furnitureCache.get(key);
  const ofc = document.createElement('canvas');
  ofc.width = w; ofc.height = h;
  const octx = ofc.getContext('2d');
  def.draw(octx, w, h, color);
  furnitureCache.set(key, ofc);
  return ofc;
}

// Cache decoded <img> elements for custom-image furniture, keyed by the
// item's own id + its data URL (so replacing an item's image invalidates
// the cache entry rather than showing the stale picture).
const furnitureImageCache = new Map();
function getFurnitureImage(item) {
  const key = `${item.id}_${item.imageDataUrl.length}`;
  let img = furnitureImageCache.get(key);
  if (img) return img;
  img = new Image();
  img.onload = () => render();
  img.src = item.imageDataUrl;
  furnitureImageCache.set(key, img);
  return img;
}

function renderMinimap() {
  const mw = 140, mh = 100;
  mmCtx.clearRect(0, 0, mw, mh);
  mmCtx.fillStyle = '#111';
  mmCtx.fillRect(0, 0, mw, mh);

  // compute bounding box of all content
  let minX = 0, minY = 0, maxX = 800, maxY = 600;
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

  const scale = Math.min(mw / (maxX - minX + 40), mh / (maxY - minY + 40));
  const ox = (mw - (maxX - minX) * scale) / 2 - minX * scale;
  const oy = (mh - (maxY - minY) * scale) / 2 - minY * scale;

  const tx = x => x * scale + ox;
  const ty = y => y * scale + oy;

  // rooms
  state.rooms.forEach(room => {
    if (room.points.length < 2) return;
    const ci = room.colorIndex ?? 0;
    const col = ROOM_COLORS[ci % ROOM_COLORS.length];
    mmCtx.beginPath();
    mmCtx.moveTo(tx(room.points[0].x), ty(room.points[0].y));
    room.points.forEach((p, i) => { if (i > 0) mmCtx.lineTo(tx(p.x), ty(p.y)); });
    if (!room.open) {
      mmCtx.closePath();
      mmCtx.fillStyle = col.fill;
      mmCtx.fill();
    }
    mmCtx.strokeStyle = col.stroke;
    mmCtx.lineWidth = 1;
    mmCtx.stroke();
  });

  // items
  state.items.forEach(item => {
    const def = FURNITURE_DEFS.find(d => d.id === item.defId);
    if (!def) return;
    mmCtx.fillStyle = item.color || '#4a9eff';
    mmCtx.globalAlpha = 0.7;
    mmCtx.fillRect(tx(item.x), ty(item.y), def.w * scale, def.h * scale);
    mmCtx.globalAlpha = 1;
  });

  // viewport indicator
  const vx = -state.panX / state.zoom * scale + ox;
  const vy = -state.panY / state.zoom * scale + oy;
  const vw = canvas.width / state.zoom * scale;
  const vh = canvas.height / state.zoom * scale;
  mmCtx.strokeStyle = '#e94560';
  mmCtx.lineWidth = 1;
  mmCtx.strokeRect(vx, vy, vw, vh);
}

// ═══════════════════════════════════════════════════════════
//  SIDEBAR
// ═══════════════════════════════════════════════════════════
function buildSidebar(filter = '') {
  const list = document.getElementById('furniture-list');
  list.innerHTML = '';
  const lower = filter.toLowerCase();

  const cats = {};
  FURNITURE_DEFS.forEach(def => {
    if (!cats[def.category]) cats[def.category] = [];
    cats[def.category].push(def);
  });

  Object.keys(cats).forEach(cat => {
    const items = cats[cat].filter(d => !lower || d.name.toLowerCase().includes(lower) || d.category.toLowerCase().includes(lower));
    if (!items.length) return;

    const header = document.createElement('div');
    header.className = 'cat-header';
    header.textContent = cat;
    header.addEventListener('click', () => {
      header.classList.toggle('collapsed');
      itemsDiv.classList.toggle('hidden');
    });
    list.appendChild(header);

    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'cat-items';

    items.forEach(def => { try {
      const locked = def.tier === 'paid' && !state.licenseUnlocked;
      const row = document.createElement('div');
      row.className = 'furn-item' + (locked ? ' locked' : '');
      row.draggable = !locked;
      row.dataset.defId = def.id;

      // thumbnail
      const thumb = document.createElement('canvas');
      const thumbSize = 36;
      thumb.width = thumbSize; thumb.height = thumbSize;
      const tc = thumb.getContext('2d');
      const aspect = def.w / def.h;
      let tw2 = thumbSize - 4, th2 = thumbSize - 4;
      if (aspect > 1) th2 = Math.round(tw2 / aspect);
      else tw2 = Math.round(th2 * aspect);
      tc.save();
      tc.translate((thumbSize - tw2) / 2, (thumbSize - th2) / 2);
      tc.scale(tw2 / def.w, th2 / def.h);
      try { def.draw(tc, def.w, def.h, '#888'); } catch(e) { console.warn('thumb error', def.name, e); }
      tc.restore();
      row.appendChild(thumb);

      const label = document.createElement('span');
      label.textContent = def.name;
      row.appendChild(label);

      if (locked) {
        const badge = document.createElement('span');
        badge.className = 'furn-lock-badge';
        badge.textContent = '🔒';
        badge.title = 'Paid feature — unlock the full catalog';
        row.appendChild(badge);
        row.addEventListener('click', () => { trackEvent('locked_furniture_clicked', { item: def.name }); openAccountModal(); });
      }

      row.addEventListener('dragstart', e => {
        if (locked) { e.preventDefault(); return; }
        e.dataTransfer.setData('defId', def.id);
        e.dataTransfer.effectAllowed = 'copy';
      });

      itemsDiv.appendChild(row);
    } catch(e) { console.warn('sidebar item error', def?.name, e); } });

    list.appendChild(itemsDiv);
  });
}

document.getElementById('search-input').addEventListener('input', e => {
  buildSidebar(e.target.value);
});

// ═══════════════════════════════════════════════════════════
//  TIER GATING (paid tier unlocks the full furniture catalog)
// ═══════════════════════════════════════════════════════════
const FREE_FURNITURE_COUNT = FURNITURE_DEFS.filter(d => d.tier === 'free').length;
const PAID_FURNITURE_COUNT = FURNITURE_DEFS.length - FREE_FURNITURE_COUNT;

function applyTierGating() {
  const lock = document.getElementById('sidebar-lock');
  const lockSub = document.getElementById('sidebar-lock-sub');
  buildSidebar(document.getElementById('search-input').value);
  if (state.licenseUnlocked) {
    lock.classList.remove('show');
  } else {
    lock.classList.add('show');
    lockSub.textContent = `${FREE_FURNITURE_COUNT}/${FURNITURE_DEFS.length} items free — unlock ${PAID_FURNITURE_COUNT} more for a one-time €10.`;
  }
  applySidebarVisibility();
}

function applySidebarVisibility() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('btn-furniture-toggle');
  sidebar.classList.toggle('hidden', state.sidebarHidden);
  toggleBtn.classList.toggle('active', !state.sidebarHidden);
}

function setSidebarHidden(hidden) {
  state.sidebarHidden = hidden;
  try { localStorage.setItem('floorspacer_sidebar_hidden', hidden ? '1' : '0'); } catch(e) {}
  applySidebarVisibility();
}

document.getElementById('btn-furniture-toggle').addEventListener('click', () => {
  setSidebarHidden(!state.sidebarHidden);
});

document.getElementById('sidebar-unlock-btn').addEventListener('click', () => {
  if (state.session) startCheckout(); else openAccountModal();
});

