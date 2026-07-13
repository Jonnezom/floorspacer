'use strict';

//  SAVE / LOAD / EXPORT
// ═══════════════════════════════════════════════════════════
function saveToLocal() {
  try {
    localStorage.setItem('roomdesign_v2', JSON.stringify({ rooms: state.rooms, walls: state.walls, items: state.items, nextId, wallNextId, version: 2, panX: state.panX, panY: state.panY, zoom: state.zoom }));
  } catch(e) { console.warn('Could not save:', e); }
}

function loadFromLocal() {
  try {
    const raw = localStorage.getItem('roomdesign_v2');
    if (!raw) return;
    let data = JSON.parse(raw);
    if (!data.version || data.version < 2) {
      data = migrateToSharedWalls(data);
      saveDataAsLocal(data);
    }
    data.walls = repairMissingWallOwnership(data.rooms, data.walls);
    state.rooms = data.rooms || [];
    state.walls = data.walls || [];
    state.items = migrateItemRotations(data.items || []);
    nextId = data.nextId || 1;
    wallNextId = data.wallNextId || 1;
    if (data.panX !== undefined) state.panX = data.panX;
    if (data.panY !== undefined) state.panY = data.panY;
    if (data.zoom !== undefined) state.zoom = data.zoom;
    updateZoomLabel();
  } catch(e) { console.warn('Could not load:', e); }
}

function saveDataAsLocal(data) {
  try { localStorage.setItem('roomdesign_v2', JSON.stringify({ ...data, panX: state.panX, panY: state.panY, zoom: state.zoom })); }
  catch(e) { console.warn('Could not save:', e); }
}

function showToast(msg, color) {
  const toast = document.createElement('div');
  toast.textContent = msg;
  toast.style.cssText = `position:fixed;bottom:36px;left:50%;transform:translateX(-50%);background:${color||'#fff'};color:#111;padding:6px 16px;border-radius:4px;font-size:13px;font-weight:700;z-index:9999;pointer-events:none;`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}
function showSaveToast() { showToast('Saved ✓'); }

// ═══════════════════════════════════════════════════════════
//  MULTI-SLOT DESIGN STORAGE (named designs — no accounts/backend yet)
// ═══════════════════════════════════════════════════════════
const DESIGNS_KEY = 'floorspacer_designs'; // also doubles as the logged-in cloud cache mirror
let currentDesignId = null;

function currentDesignData() {
  return { rooms: state.rooms, walls: state.walls, items: state.items, nextId, wallNextId, version: 2, panX: state.panX, panY: state.panY, zoom: state.zoom };
}

function listDesignsLocal() {
  try {
    const raw = localStorage.getItem(DESIGNS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw).designs || []).sort((a, b) => b.savedAt - a.savedAt);
  } catch(e) { console.warn('Could not read designs:', e); return []; }
}

function writeDesigns(designs) {
  try { localStorage.setItem(DESIGNS_KEY, JSON.stringify({ designs })); }
  catch(e) { console.warn('Could not write designs:', e); }
}

function upsertLocalCache(design) {
  const designs = listDesignsLocal().filter(d => d.id !== design.id);
  designs.push(design);
  writeDesigns(designs);
}

function removeFromLocalCache(id) {
  writeDesigns(listDesignsLocal().filter(d => d.id !== id));
}

// listDesigns/saveDesign/loadDesign/deleteDesign/renameDesign are cloud-aware:
// logged in -> Supabase `designs` table (RLS-scoped to auth.uid()), with every
// write also mirrored into the local DESIGNS_KEY cache so a save/load still
// works if the network is briefly down. Logged out -> pure localStorage, byte
// identical to the pre-cloud-sync behavior.
async function listDesigns() {
  if (!state.session) return listDesignsLocal();
  try {
    const { data, error } = await sb
      .from('designs')
      .select('id, name, saved_at, data')
      .eq('user_id', state.session.user.id)
      .order('saved_at', { ascending: false });
    if (error) throw error;
    const designs = data.map(r => ({ id: r.id, name: r.name, savedAt: r.saved_at, data: r.data }));
    writeDesigns(designs); // refresh local cache mirror on every successful cloud read
    return designs;
  } catch (e) {
    trackEvent('cloud_sync_failed', { op: 'list' });
    return listDesignsLocal(); // offline fallback: last-known cache
  }
}

async function saveDesign(name, id) {
  const now = Date.now();
  if (!state.session) {
    const designs = listDesignsLocal();
    if (id) {
      const existing = designs.find(d => d.id === id);
      if (existing) {
        existing.data = currentDesignData();
        existing.savedAt = now;
        writeDesigns(designs);
        return existing.id;
      }
    }
    const newId = 'd' + now + '_' + Math.random().toString(36).slice(2, 8);
    designs.push({ id: newId, name: name || 'Untitled design', savedAt: now, data: currentDesignData() });
    writeDesigns(designs);
    return newId;
  }

  const newId = id || ('d' + now + '_' + Math.random().toString(36).slice(2, 8));
  const existingLocal = listDesignsLocal().find(d => d.id === newId);
  const design = { id: newId, name: name || existingLocal?.name || 'Untitled design', savedAt: now, data: currentDesignData() };
  try {
    const { error } = await sb.from('designs').upsert({
      id: design.id, user_id: state.session.user.id, name: design.name, data: design.data, saved_at: design.savedAt,
    });
    if (error) throw error;
  } catch (e) {
    trackEvent('cloud_sync_failed', { op: 'save' });
    showToast('Saved locally — will retry sync', '#ffcc66');
  }
  upsertLocalCache(design); // write-through regardless of network outcome
  return newId;
}

async function loadDesign(id) {
  let design;
  if (state.session) {
    try {
      const { data, error } = await sb
        .from('designs')
        .select('id, name, saved_at, data')
        .eq('id', id)
        .eq('user_id', state.session.user.id)
        .single();
      if (error) throw error;
      design = { id: data.id, name: data.name, savedAt: data.saved_at, data: data.data };
    } catch (e) {
      trackEvent('cloud_sync_failed', { op: 'load' });
      design = listDesignsLocal().find(d => d.id === id);
    }
  } else {
    design = listDesignsLocal().find(d => d.id === id);
  }
  if (!design) return;
  let data = design.data;
  if (!data.version || data.version < 2) data = migrateToSharedWalls(data);
  data.walls = repairMissingWallOwnership(data.rooms, data.walls);
  state.rooms = data.rooms || [];
  state.walls = data.walls || [];
  state.items = migrateItemRotations(data.items || []);
  nextId = data.nextId || 1;
  wallNextId = data.wallNextId || 1;
  if (data.panX !== undefined) state.panX = data.panX;
  if (data.panY !== undefined) state.panY = data.panY;
  if (data.zoom !== undefined) state.zoom = data.zoom;
  updateZoomLabel();
  currentDesignId = design.id;
  state.selectedId = null; state.selectedRoomId = null;
  updateRightPanel(); render(); saveToLocal();
}

async function deleteDesign(id) {
  if (state.session) {
    try {
      const { error } = await sb.from('designs').delete().eq('id', id).eq('user_id', state.session.user.id);
      if (error) throw error;
    } catch (e) { trackEvent('cloud_sync_failed', { op: 'delete' }); }
  }
  removeFromLocalCache(id);
  if (currentDesignId === id) currentDesignId = null;
}

async function renameDesign(id, name) {
  if (state.session) {
    try {
      const { error } = await sb.from('designs').update({ name }).eq('id', id).eq('user_id', state.session.user.id);
      if (error) throw error;
    } catch (e) { trackEvent('cloud_sync_failed', { op: 'rename' }); }
  }
  const designs = listDesignsLocal();
  const d = designs.find(x => x.id === id);
  if (d) { d.name = name; writeDesigns(designs); }
}

// Purely local — migrates the pre-multi-slot legacy autosave into a first
// named design slot. Deliberately never touches the cloud: this is about
// bootstrapping old local data, not about syncing, and must not run for
// every logged-in user on every load.
function seedDesignsFromLegacySave() {
  if (listDesignsLocal().length > 0) return;
  const raw = localStorage.getItem('roomdesign_v2');
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (!data.rooms || !data.rooms.length) return;
    writeDesigns([{ id: 'd' + Date.now(), name: 'My design', savedAt: Date.now(), data }]);
  } catch(e) { /* ignore malformed legacy data */ }
}

const FREE_SAVE_SLOT_LIMIT = 3;

async function saveCurrentDesign(forceNew) {
  saveToLocal();
  if (currentDesignId && !forceNew) {
    await saveDesign(null, currentDesignId);
  } else {
    if (!state.licenseUnlocked && (await listDesigns()).length >= FREE_SAVE_SLOT_LIMIT) {
      trackEvent('save_limit_hit');
      openAccountModal(`🔒 Free plan is limited to ${FREE_SAVE_SLOT_LIMIT} saved designs. Unlock the full version to save more.`);
      return;
    }
    const name = prompt('Name this design:', 'My design');
    if (name === null) { showSaveToast(); return; } // user cancelled naming, still keep quick-save
    currentDesignId = await saveDesign(name || 'Untitled design', null);
  }
  showSaveToast();
}

const saveMenu = document.getElementById('save-menu');
document.getElementById('btn-save').addEventListener('click', e => {
  e.stopPropagation();
  saveMenu.classList.toggle('show');
});
document.getElementById('save-menu-save').addEventListener('click', async () => { saveMenu.classList.remove('show'); await saveCurrentDesign(false); });
document.getElementById('save-menu-new').addEventListener('click', async () => { saveMenu.classList.remove('show'); await saveCurrentDesign(true); });

// ═══════════════════════════════════════════════════════════
//  IMPORT / EXPORT AS JSON
// ═══════════════════════════════════════════════════════════
function currentDesignName() {
  return listDesignsLocal().find(d => d.id === currentDesignId)?.name || 'design';
}

function exportDesignAsJson() {
  const payload = { floorspacerExport: 1, name: currentDesignName(), exportedAt: Date.now(), data: currentDesignData() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${payload.name.replace(/[^\w\- ]/g, '') || 'design'}.json`;
  a.click();
  URL.revokeObjectURL(url);
  trackEvent('design_exported');
}

function isValidFloorspacerExport(obj) {
  return !!obj && typeof obj === 'object'
    && obj.floorspacerExport === 1
    && obj.data && typeof obj.data === 'object'
    && Array.isArray(obj.data.rooms)
    && Array.isArray(obj.data.walls);
}

async function importDesignFromFile(file) {
  let parsed;
  try { parsed = JSON.parse(await file.text()); }
  catch (e) {
    trackEvent('cloud_sync_failed', { op: 'import_parse' });
    showToast('Not a valid JSON file', '#ff6666');
    return;
  }
  if (!isValidFloorspacerExport(parsed)) {
    showToast('Not a Floorspacer design file', '#ff6666');
    return;
  }
  let data = parsed.data;
  if (!data.version || data.version < 2) data = migrateToSharedWalls(data);
  data.walls = repairMissingWallOwnership(data.rooms, data.walls);
  state.rooms = data.rooms || [];
  state.walls = data.walls || [];
  state.items = migrateItemRotations(data.items || []);
  nextId = data.nextId || 1;
  wallNextId = data.wallNextId || 1;
  if (data.panX !== undefined) state.panX = data.panX;
  if (data.panY !== undefined) state.panY = data.panY;
  if (data.zoom !== undefined) state.zoom = data.zoom;
  updateZoomLabel();
  // Imported design is untitled/unsaved until the user explicitly hits Save —
  // never silently overwrite an existing design slot.
  currentDesignId = null;
  state.selectedId = null; state.selectedRoomId = null;
  updateRightPanel(); render(); saveToLocal();
  trackEvent('design_imported');
  showToast('Imported ✓');
}

document.getElementById('save-menu-export').addEventListener('click', () => { saveMenu.classList.remove('show'); exportDesignAsJson(); });
document.getElementById('save-menu-import').addEventListener('click', () => {
  saveMenu.classList.remove('show');
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', () => { if (input.files[0]) importDesignFromFile(input.files[0]); });
  input.click();
});

// ═══════════════════════════════════════════════════════════
//  LOAD MODAL
// ═══════════════════════════════════════════════════════════
const loadModalBackdrop = document.getElementById('load-modal-backdrop');
async function openLoadModal() {
  const list = document.getElementById('load-modal-list');
  const empty = document.getElementById('load-modal-empty');
  list.innerHTML = '';
  empty.style.display = 'none';
  loadModalBackdrop.classList.add('show'); // open immediately, don't block on network
  if (state.session) {
    list.innerHTML = '<div style="color:#888;font-size:12px;padding:10px 0;text-align:center;">Loading designs…</div>';
  }
  const designs = await listDesigns();
  if (!loadModalBackdrop.classList.contains('show')) return; // user closed modal while awaiting

  list.innerHTML = '';
  empty.style.display = designs.length ? 'none' : '';
  designs.forEach(d => {
    const row = document.createElement('div');
    row.className = 'load-row';
    const info = document.createElement('div');
    info.className = 'load-row-info';
    const name = document.createElement('div');
    name.className = 'load-row-name';
    name.textContent = d.name;
    const date = document.createElement('div');
    date.className = 'load-row-date';
    date.textContent = new Date(d.savedAt).toLocaleString();
    info.appendChild(name); info.appendChild(date);
    row.appendChild(info);

    const loadBtn = document.createElement('button');
    loadBtn.className = 'load-row-btn';
    loadBtn.textContent = 'Load';
    loadBtn.addEventListener('click', async () => { await loadDesign(d.id); closeLoadModal(); showToast('Loaded ✓'); });
    row.appendChild(loadBtn);

    const renameBtn = document.createElement('button');
    renameBtn.className = 'load-row-btn';
    renameBtn.textContent = 'Rename';
    renameBtn.addEventListener('click', async () => {
      const newName = prompt('Rename design:', d.name);
      if (newName) { await renameDesign(d.id, newName); await openLoadModal(); }
    });
    row.appendChild(renameBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'load-row-btn danger';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', async () => {
      if (confirm(`Delete "${d.name}"?`)) { await deleteDesign(d.id); await openLoadModal(); }
    });
    row.appendChild(delBtn);

    list.appendChild(row);
  });
}
function closeLoadModal() { loadModalBackdrop.classList.remove('show'); }

document.getElementById('btn-load').addEventListener('click', openLoadModal);
document.getElementById('load-modal-close').addEventListener('click', closeLoadModal);
loadModalBackdrop.addEventListener('click', e => { if (e.target === loadModalBackdrop) closeLoadModal(); });

// background: 'white' | 'dark' | 'transparent'; includeGrid: bool (grid + ruler,
// matching the live editor's "Fit" view look)
function runExport({ background = 'white', includeGrid = false } = {}) {
  const exp = document.createElement('canvas');
  exp.width = canvas.width; exp.height = canvas.height;
  const ec = exp.getContext('2d');

  if (background === 'white') {
    ec.fillStyle = '#ffffff';
    ec.fillRect(0, 0, exp.width, exp.height);
  } else if (background === 'dark') {
    ec.fillStyle = '#111';
    ec.fillRect(0, 0, exp.width, exp.height);
  } // 'transparent' — leave canvas as-is (alpha channel preserved in PNG)

  const isDarkBg = background === 'dark';

  if (includeGrid) drawGrid(ec, exp.width, exp.height, isDarkBg);

  ec.save();
  ec.translate(state.panX, state.panY);
  ec.scale(state.zoom, state.zoom);

  if (includeGrid) drawRuler(exp.width, exp.height, ec, isDarkBg);

  // draw rooms — reuse the real renderer so open/unfinished chains, doors,
  // windows and gateways all export exactly as they render on screen
  const exportLabeledWallIds = new Set();
  const exportCornerThickenPts = new Map();
  state.rooms.forEach(room => drawRoom(room, ec, exportLabeledWallIds, exportCornerThickenPts));
  drawCornerThickening(ec, exportCornerThickenPts);

  // draw furniture
  state.items.forEach(item => {
    const def = FURNITURE_DEFS.find(d => d.id === item.defId);
    if (!def) return;
    const iw2 = item.customW ?? def.w, ih2 = item.customH ?? def.h;
    ec.save();
    ec.translate(item.x + iw2 / 2, item.y + ih2 / 2);
    ec.rotate(item.rot);
    if (item.flipped) ec.scale(-1, 1);
    ec.translate(-iw2 / 2, -ih2 / 2);
    const ofc = getFurnitureCanvas(def, item.color || '#888', iw2, ih2);
    ec.drawImage(ofc, 0, 0, iw2, ih2);
    ec.restore();
  });

  ec.restore();

  if (!state.licenseUnlocked) drawWatermark(ec, exp.width, exp.height);

  // download
  const link = document.createElement('a');
  link.download = 'floorspacer-plan.png';
  link.href = exp.toDataURL('image/png');
  link.click();
}

const exportModalBackdrop = document.getElementById('export-modal-backdrop');
function openExportModal() { exportModalBackdrop.classList.add('show'); }
function closeExportModal() { exportModalBackdrop.classList.remove('show'); }

document.getElementById('btn-export').addEventListener('click', () => {
  if (state.licenseUnlocked) {
    // Export options (background choice, grid+ruler) are a paid feature —
    // default selection matches the live editor's look (dark + grid/ruler).
    openExportModal();
  } else {
    runExport({ background: 'white', includeGrid: false });
  }
});
document.getElementById('export-modal-close').addEventListener('click', closeExportModal);
exportModalBackdrop.addEventListener('click', e => { if (e.target === exportModalBackdrop) closeExportModal(); });
document.getElementById('export-modal-go').addEventListener('click', () => {
  const background = document.getElementById('export-bg-select').value;
  const includeGrid = document.getElementById('export-grid-checkbox').checked;
  closeExportModal();
  runExport({ background, includeGrid });
});

function drawWatermark(c, w, h) {
  c.save();
  c.fillStyle = 'rgba(0,0,0,0.10)';
  c.font = 'bold 22px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.translate(w / 2, h / 2);
  c.rotate(-Math.PI / 6);
  c.translate(-w / 2, -h / 2);
  const stepX = 220, stepY = 150;
  const pad = Math.max(w, h); // over-scan so rotation leaves no bare corners
  for (let y = -pad; y < h + pad; y += stepY) {
    for (let x = -pad; x < w + pad; x += stepX) {
      c.fillText('floorspacer.com', x, y);
    }
  }
  c.restore();
}

// ═══════════════════════════════════════════════════════════
