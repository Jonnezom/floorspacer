'use strict';

//  CONSTANTS
// ═══════════════════════════════════════════════════════════
const GRID = 20;            // px per visual grid cell (0.5m)
const SCALE = 0.5 / GRID;  // meters per px  →  1px = 0.025m, 20px = 0.5m
const SNAP_GRID = 2;        // px per snap unit (0.05m) — finer than visual grid
const CLOSE_DIST = 16;      // px to close polygon
const OPENING_WIDTH_M = 0.8;              // default door/gateway width in meters
const DEFAULT_OPENING_PX = OPENING_WIDTH_M / SCALE;  // = 32px
const VERTEX_SNAP_DIST = 10;  // px threshold to snap onto existing room vertices/edges while drawing
const NOTCH_PX = 6;    // px nibbled off an adjacent wall's corner when an opening sits right at the joint (cosmetic only)
const NOTCH_T = 0.08;  // fraction of a wall's own length within which a gap counts as "touching" that wall's corner
const ROTATE_HANDLE_DIST = 20; // px above a selected furniture item's top edge where the rotate handle sits
const ROTATE_SNAP_DEG = 15;    // free-rotation snaps to this many degrees unless Alt is held

// ═══════════════════════════════════════════════════════════
