'use strict';

//  FURNITURE DEFINITIONS
// ═══════════════════════════════════════════════════════════
// Each item: { id, name, category, w, h (in px, multiples of GRID), draw(ctx,w,h,color) }

// ── draw helpers (used by furniture draw fns and standalone helpers) ──
function fill(ctx, color) { ctx.fillStyle = color; }
function stroke(ctx, color = '#333', lw = 1.5) { ctx.strokeStyle = color; ctx.lineWidth = lw; }
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const FREE_FURNITURE_NAMES = new Set([
  'Sofa 2-seat', 'Coffee Table', 'TV + Stand', 'Rug',
  'Double Bed', 'Wardrobe', 'Nightstand', 'Desk',
  'Fridge', 'Sink', 'Countertop', 'Kitchen Table', 'Base Unit',
  'Toilet', 'Sink/Vanity', 'Shower',
  'Office Desk', 'Office Chair',
  'Plant',
]);

function makeDefs() {
  const D = [];
  let idCounter = 1;
  function add(cat, name, w, h, drawFn) {
    const tier = FREE_FURNITURE_NAMES.has(name) ? 'free' : 'paid';
    D.push({ id: idCounter++, name, category: cat, w: w * GRID, h: h * GRID, draw: drawFn, tier });
  }

  // ─── LIVING ROOM ───
  add('Living Room', 'Sofa 2-seat', 4, 2, (ctx, w, h, c) => {
    stroke(ctx, '#555', 1.5); fill(ctx, c);
    roundRect(ctx, 1, 1, w - 2, h - 2, 6); ctx.fill(); ctx.stroke();
    // back
    fill(ctx, shadeColor(c, -20)); ctx.fillRect(1, 1, w - 2, h * 0.35); ctx.strokeRect(1, 1, w - 2, h * 0.35);
    // cushions
    const cw = (w - 6) / 2;
    fill(ctx, shadeColor(c, 10));
    roundRect(ctx, 3, h * 0.38, cw, h * 0.55, 4); ctx.fill(); ctx.stroke();
    roundRect(ctx, 3 + cw + 2, h * 0.38, cw, h * 0.55, 4); ctx.fill(); ctx.stroke();
    // armrests
    fill(ctx, shadeColor(c, -10)); ctx.fillRect(1, 1, 4, h - 2); ctx.fillRect(w - 5, 1, 4, h - 2);
  });

  add('Living Room', 'Sofa 3-seat', 6, 2, (ctx, w, h, c) => {
    stroke(ctx, '#555', 1.5); fill(ctx, c);
    roundRect(ctx, 1, 1, w - 2, h - 2, 6); ctx.fill(); ctx.stroke();
    fill(ctx, shadeColor(c, -20)); ctx.fillRect(1, 1, w - 2, h * 0.35); ctx.strokeRect(1, 1, w - 2, h * 0.35);
    const cw = (w - 12) / 3;
    fill(ctx, shadeColor(c, 10));
    for (let i = 0; i < 3; i++) {
      roundRect(ctx, 5 + i * (cw + 1), h * 0.38, cw, h * 0.55, 4); ctx.fill(); ctx.stroke();
    }
    fill(ctx, shadeColor(c, -10)); ctx.fillRect(1, 1, 5, h - 2); ctx.fillRect(w - 6, 1, 5, h - 2);
  });

  add('Living Room', 'Sofa L-shape', 6, 5, (ctx, w, h, c) => {
    stroke(ctx, '#555', 1.5); fill(ctx, c);
    // main part
    roundRect(ctx, 1, 1, w - 2, h * 0.4, 5); ctx.fill(); ctx.stroke();
    // side part
    roundRect(ctx, w * 0.6, 1, w * 0.38, h - 2, 5); ctx.fill(); ctx.stroke();
    // cushions
    fill(ctx, shadeColor(c, 12));
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(5 + i * ((w * 0.55) / 3), h * 0.08, (w * 0.55) / 3 - 3, h * 0.28);
    }
    ctx.fillRect(w * 0.63, h * 0.45, w * 0.32, (h - 2) * 0.25);
    ctx.fillRect(w * 0.63, h * 0.73, w * 0.32, (h - 2) * 0.22);
  });

  add('Living Room', 'Armchair', 2.5, 2.5, (ctx, w, h, c) => {
    stroke(ctx, '#555', 1.5); fill(ctx, c);
    roundRect(ctx, 1, 1, w - 2, h - 2, 6); ctx.fill(); ctx.stroke();
    fill(ctx, shadeColor(c, -20)); ctx.fillRect(1, 1, w - 2, h * 0.3); ctx.strokeRect(1, 1, w - 2, h * 0.3);
    fill(ctx, shadeColor(c, 10)); roundRect(ctx, 5, h * 0.34, w - 10, h * 0.58, 4); ctx.fill(); ctx.stroke();
    fill(ctx, shadeColor(c, -10)); ctx.fillRect(1, 1, 4, h - 2); ctx.fillRect(w - 5, 1, 4, h - 2);
  });

  add('Living Room', 'Coffee Table', 3, 2, (ctx, w, h, c) => {
    stroke(ctx, '#666', 1.5); fill(ctx, c);
    roundRect(ctx, 2, 2, w - 4, h - 4, 4); ctx.fill(); ctx.stroke();
    // legs
    fill(ctx, shadeColor(c, -25)); ctx.strokeStyle = '#555';
    [[3,3],[w-7,3],[3,h-7],[w-7,h-7]].forEach(([x,y]) => { ctx.fillRect(x, y, 4, 4); ctx.strokeRect(x, y, 4, 4); });
  });

  add('Living Room', 'TV + Stand', 5, 2, (ctx, w, h, c) => {
    // stand
    fill(ctx, '#444'); stroke(ctx, '#333');
    ctx.fillRect(w * 0.25, h * 0.55, w * 0.5, h * 0.35); ctx.strokeRect(w * 0.25, h * 0.55, w * 0.5, h * 0.35);
    // TV screen
    fill(ctx, '#1a1a2e'); stroke(ctx, '#888', 2);
    roundRect(ctx, 2, 2, w - 4, h * 0.5, 3); ctx.fill(); ctx.stroke();
    // screen glow
    fill(ctx, '#0d4a8a');
    ctx.fillRect(5, 5, w - 10, h * 0.36);
    // brand dot
    fill(ctx, '#e94560'); ctx.beginPath(); ctx.arc(w / 2, h * 0.25, 2, 0, Math.PI * 2); ctx.fill();
  });

  add('Living Room', 'Bookshelf', 2, 4, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.fillRect(1, 1, w - 2, h - 2); ctx.strokeRect(1, 1, w - 2, h - 2);
    // shelves
    const colors = ['#e94560','#4a9eff','#f6c90e','#50fa7b','#bd93f9'];
    const sh = (h - 6) / 4;
    for (let i = 0; i < 4; i++) {
      const y = 3 + i * sh;
      stroke(ctx, '#444'); ctx.beginPath(); ctx.moveTo(2, y + sh); ctx.lineTo(w - 2, y + sh); ctx.stroke();
      // books
      let bx = 3;
      while (bx < w - 5) {
        const bw = 4 + Math.floor(Math.random() * 6);
        if (bx + bw > w - 5) break;
        fill(ctx, colors[(bx + i) % colors.length]);
        ctx.fillRect(bx, y + 2, bw, sh - 4); ctx.strokeRect(bx, y + 2, bw, sh - 4);
        bx += bw + 1;
      }
    }
  });

  add('Living Room', 'Side Table', 1.5, 1.5, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    fill(ctx, shadeColor(c, -15));
    ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  });

  add('Living Room', 'Rug', 6, 4, (ctx, w, h, c) => {
    // outer
    fill(ctx, c); ctx.fillRect(2, 2, w - 4, h - 4);
    // border
    fill(ctx, shadeColor(c, -30)); ctx.fillRect(2, 2, w - 4, 5); ctx.fillRect(2, h - 7, w - 4, 5);
    ctx.fillRect(2, 2, 5, h - 4); ctx.fillRect(w - 7, 2, 5, h - 4);
    // pattern
    fill(ctx, shadeColor(c, 20));
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.3, h * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.18, h * 0.14, 0, 0, Math.PI * 2);
    fill(ctx, shadeColor(c, -15)); ctx.fill();
    // fringe
    stroke(ctx, shadeColor(c, -30), 1);
    for (let x = 5; x < w - 4; x += 4) {
      ctx.beginPath(); ctx.moveTo(x, 2); ctx.lineTo(x, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, h - 2); ctx.lineTo(x, h); ctx.stroke();
    }
  });

  // ─── BEDROOM ───
  add('Bedroom', 'Single Bed', 3, 5, (ctx, w, h, c) => drawBed(ctx, w, h, c));
  add('Bedroom', 'Double Bed', 5, 5, (ctx, w, h, c) => drawBed(ctx, w, h, c));
  add('Bedroom', 'King Bed', 7, 5, (ctx, w, h, c) => drawBed(ctx, w, h, c));

  add('Bedroom', 'Wardrobe', 4, 2, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.fillRect(1, 1, w - 2, h - 2); ctx.strokeRect(1, 1, w - 2, h - 2);
    // doors
    const mid = w / 2;
    stroke(ctx, '#777'); ctx.beginPath(); ctx.moveTo(mid, 1); ctx.lineTo(mid, h - 1); ctx.stroke();
    // handles
    fill(ctx, '#aaa'); stroke(ctx, '#888');
    ctx.fillRect(mid - 8, h / 2 - 2, 5, 4); ctx.strokeRect(mid - 8, h / 2 - 2, 5, 4);
    ctx.fillRect(mid + 3, h / 2 - 2, 5, 4); ctx.strokeRect(mid + 3, h / 2 - 2, 5, 4);
  });

  add('Bedroom', 'Nightstand', 1.5, 1.5, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.fillRect(1, 1, w - 2, h - 2); ctx.strokeRect(1, 1, w - 2, h - 2);
    // drawer line
    stroke(ctx, '#777'); ctx.beginPath(); ctx.moveTo(2, h / 2); ctx.lineTo(w - 2, h / 2); ctx.stroke();
    fill(ctx, '#aaa'); ctx.fillRect(w / 2 - 3, h / 2 - 1, 6, 2);
  });

  add('Bedroom', 'Dresser', 3, 2, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.fillRect(1, 1, w - 2, h - 2); ctx.strokeRect(1, 1, w - 2, h - 2);
    const dh = (h - 4) / 3;
    for (let i = 0; i < 3; i++) {
      const y = 2 + i * dh;
      stroke(ctx, '#777'); ctx.beginPath(); ctx.moveTo(2, y + dh); ctx.lineTo(w - 2, y + dh); ctx.stroke();
      fill(ctx, '#aaa'); ctx.fillRect(w / 2 - 4, y + dh / 2 - 1, 8, 2);
    }
  });

  add('Bedroom', 'Desk', 4, 2, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.fillRect(2, 2, w - 4, h - 4); ctx.strokeRect(2, 2, w - 4, h - 4);
    // legs
    [[3,3],[w-6,3],[3,h-6],[w-6,h-6]].forEach(([x,y]) => {
      fill(ctx, shadeColor(c, -20)); ctx.fillRect(x, y, 3, 3);
    });
    // small items
    fill(ctx, '#ccd6f6'); ctx.fillRect(w * 0.6, 4, w * 0.3, h * 0.35);
    fill(ctx, '#e94560'); ctx.fillRect(w * 0.15, h * 0.4, 6, 8);
  });

  add('Bedroom', 'Chair', 2, 2, (ctx, w, h, c) => drawChair(ctx, w, h, c));

  add('Bedroom', 'Bunk Bed', 3, 5, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    // frame
    ctx.fillRect(2, 2, w - 4, h - 4); ctx.strokeRect(2, 2, w - 4, h - 4);
    // middle rail
    stroke(ctx, '#777', 2); ctx.beginPath(); ctx.moveTo(2, h / 2); ctx.lineTo(w - 2, h / 2); ctx.stroke();
    // pillows top
    fill(ctx, '#e0e0e0'); ctx.fillRect(5, 5, w - 10, h * 0.12); ctx.strokeRect(5, 5, w - 10, h * 0.12);
    // pillows bottom
    ctx.fillRect(5, h / 2 + 3, w - 10, h * 0.12); ctx.strokeRect(5, h / 2 + 3, w - 10, h * 0.12);
    // ladder
    stroke(ctx, '#888'); fill(ctx, '#888');
    ctx.fillRect(w - 6, h * 0.35, 3, h * 0.3);
    for (let y = h * 0.38; y < h * 0.62; y += 5) {
      ctx.beginPath(); ctx.moveTo(w - 8, y); ctx.lineTo(w - 3, y); ctx.stroke();
    }
  });

  add('Bedroom', 'Sofa Bed', 5, 4, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.fillRect(2, 2, w - 4, h - 4); ctx.strokeRect(2, 2, w - 4, h - 4);
    // backrest
    fill(ctx, shadeColor(c, -20)); ctx.fillRect(2, 2, w - 4, h * 0.2); ctx.strokeRect(2, 2, w - 4, h * 0.2);
    // pillow
    fill(ctx, '#e0e0e0'); ctx.fillRect(6, h * 0.22, w * 0.35, h * 0.14); ctx.strokeRect(6, h * 0.22, w * 0.35, h * 0.14);
    ctx.fillRect(w * 0.5, h * 0.22, w * 0.35, h * 0.14); ctx.strokeRect(w * 0.5, h * 0.22, w * 0.35, h * 0.14);
    // fold line
    stroke(ctx, '#777', 1); ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(2, h * 0.55); ctx.lineTo(w - 2, h * 0.55); ctx.stroke();
    ctx.setLineDash([]);
  });

  add('Bedroom', "Child's Bed", 2.5, 5, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    roundRect(ctx, 2, 2, w - 4, h - 4, 6); ctx.fill(); ctx.stroke();
    // headboard
    fill(ctx, shadeColor(c, -25)); ctx.fillRect(2, 2, w - 4, h * 0.12); ctx.strokeRect(2, 2, w - 4, h * 0.12);
    // pillow
    fill(ctx, '#f0f0f0'); ctx.fillRect(5, h * 0.14, w - 10, h * 0.12); ctx.strokeRect(5, h * 0.14, w - 10, h * 0.12);
    // rail bars
    stroke(ctx, shadeColor(c, -30), 1.5);
    for (let x = 6; x < w - 3; x += 6) {
      ctx.beginPath(); ctx.moveTo(x, 2); ctx.lineTo(x, h * 0.12); ctx.stroke();
    }
  });

  // ─── KITCHEN ───
  add('Kitchen', 'Fridge', 2, 2.5, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    roundRect(ctx, 1, 1, w - 2, h - 2, 4); ctx.fill(); ctx.stroke();
    // freezer
    fill(ctx, shadeColor(c, -20)); ctx.fillRect(3, 3, w - 6, h * 0.28); ctx.strokeRect(3, 3, w - 6, h * 0.28);
    // handle
    fill(ctx, '#aaa'); stroke(ctx, '#888');
    ctx.fillRect(w - 6, h * 0.4, 3, h * 0.35); ctx.strokeRect(w - 6, h * 0.4, 3, h * 0.35);
  });

  add('Kitchen', 'Oven', 2, 2, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.fillRect(1, 1, w - 2, h - 2); ctx.strokeRect(1, 1, w - 2, h - 2);
    // burners
    stroke(ctx, '#333', 2);
    [[w*0.28, h*0.3],[w*0.72, h*0.3],[w*0.28, h*0.72],[w*0.72, h*0.72]].forEach(([cx,cy]) => {
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.stroke();
    });
  });

  add('Kitchen', 'Sink', 2, 2, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.fillRect(1, 1, w - 2, h - 2); ctx.strokeRect(1, 1, w - 2, h - 2);
    // basin
    fill(ctx, shadeColor(c, -30)); stroke(ctx, '#777');
    ctx.fillRect(4, 4, w - 8, h - 8); ctx.strokeRect(4, 4, w - 8, h - 8);
    // drain
    fill(ctx, '#555'); ctx.beginPath(); ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2); ctx.fill();
    // tap
    fill(ctx, '#ccc'); ctx.fillRect(w / 2 - 1, 2, 2, 6);
  });

  add('Kitchen', 'Countertop', 5, 1.5, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.fillRect(1, 1, w - 2, h - 2); ctx.strokeRect(1, 1, w - 2, h - 2);
    fill(ctx, shadeColor(c, 15));
    ctx.fillRect(3, 3, w - 6, 3);
  });

  add('Kitchen', 'Corner Counter', 4, 4, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.beginPath(); ctx.moveTo(1, 1); ctx.lineTo(w - 1, 1); ctx.lineTo(w - 1, h * 0.35);
    ctx.lineTo(w * 0.35, h * 0.35); ctx.lineTo(w * 0.35, h - 1); ctx.lineTo(1, h - 1); ctx.closePath();
    ctx.fill(); ctx.stroke();
  });

  add('Kitchen', 'Kitchen Table', 4, 3, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    roundRect(ctx, 4, 4, w - 8, h - 8, 4); ctx.fill(); ctx.stroke();
    // chairs
    fill(ctx, shadeColor(c, -20));
    ctx.fillRect(w * 0.2, 1, w * 0.25, 4); ctx.fillRect(w * 0.55, 1, w * 0.25, 4);
    ctx.fillRect(w * 0.2, h - 5, w * 0.25, 4); ctx.fillRect(w * 0.55, h - 5, w * 0.25, 4);
    ctx.fillRect(1, h * 0.25, 4, h * 0.25); ctx.fillRect(w - 5, h * 0.25, 4, h * 0.25);
  });

  add('Kitchen', 'Bar Stool', 1.5, 1.5, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    fill(ctx, shadeColor(c, -25));
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2); ctx.fill();
  });

  add('Kitchen', 'Island', 5, 3, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    roundRect(ctx, 2, 2, w - 4, h - 4, 6); ctx.fill(); ctx.stroke();
    fill(ctx, shadeColor(c, 10)); ctx.fillRect(6, 6, w - 12, 3);
    fill(ctx, shadeColor(c, -15));
    for (let x = w * 0.2; x < w * 0.8; x += w * 0.15) {
      ctx.fillRect(x, h - 8, 10, 6);
    }
  });

  add('Kitchen', 'Base Unit', 2, 1.5, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.fillRect(1, 1, w - 2, h - 2); ctx.strokeRect(1, 1, w - 2, h - 2);
    // worktop edge
    fill(ctx, shadeColor(c, 20)); ctx.fillRect(1, 1, w - 2, 3);
    // door
    fill(ctx, shadeColor(c, -10)); stroke(ctx, '#666');
    ctx.fillRect(4, 6, w - 8, h - 9); ctx.strokeRect(4, 6, w - 8, h - 9);
    // handle
    fill(ctx, '#aaa'); ctx.fillRect(w / 2 - 5, h - 6, 10, 2);
  });

  add('Kitchen', 'Wall Unit', 2, 1.2, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.fillRect(1, 1, w - 2, h - 2); ctx.strokeRect(1, 1, w - 2, h - 2);
    // door panels
    stroke(ctx, '#666');
    ctx.strokeRect(3, 3, (w - 8) / 2, h - 6);
    ctx.strokeRect(5 + (w - 8) / 2, 3, (w - 8) / 2, h - 6);
    // handles
    fill(ctx, '#aaa');
    ctx.fillRect((w - 8) / 2 - 2, h / 2 - 1, 4, 2);
    ctx.fillRect(5 + (w - 8) / 2 + (w - 8) / 2 - 2, h / 2 - 1, 4, 2);
  });

  add('Kitchen', 'Dishwasher', 2, 2, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.fillRect(1, 1, w - 2, h - 2); ctx.strokeRect(1, 1, w - 2, h - 2);
    // control panel strip
    fill(ctx, shadeColor(c, -25)); ctx.fillRect(3, 3, w - 6, h * 0.18); ctx.strokeRect(3, 3, w - 6, h * 0.18);
    // indicator dots
    fill(ctx, '#4a9eff'); ctx.beginPath(); ctx.arc(w * 0.3, h * 0.1, 2, 0, Math.PI * 2); ctx.fill();
    fill(ctx, '#e94560'); ctx.beginPath(); ctx.arc(w * 0.5, h * 0.1, 2, 0, Math.PI * 2); ctx.fill();
    fill(ctx, '#44cc88'); ctx.beginPath(); ctx.arc(w * 0.7, h * 0.1, 2, 0, Math.PI * 2); ctx.fill();
    // door
    fill(ctx, shadeColor(c, 10)); ctx.fillRect(3, h * 0.22, w - 6, h * 0.7); ctx.strokeRect(3, h * 0.22, w - 6, h * 0.7);
    // handle
    fill(ctx, '#aaa'); ctx.fillRect(6, h * 0.27, w - 12, 3); ctx.strokeRect(6, h * 0.27, w - 12, 3);
  });

  add('Kitchen', 'Microwave', 2, 1.5, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    roundRect(ctx, 1, 1, w - 2, h - 2, 3); ctx.fill(); ctx.stroke();
    // window
    fill(ctx, '#1a2340'); stroke(ctx, '#333');
    ctx.fillRect(3, 3, w * 0.65, h - 6); ctx.strokeRect(3, 3, w * 0.65, h - 6);
    // plate hint
    stroke(ctx, '#444', 1);
    ctx.beginPath(); ctx.arc(3 + w * 0.65 / 2, h / 2, Math.min(w, h) * 0.22, 0, Math.PI * 2); ctx.stroke();
    // controls
    fill(ctx, shadeColor(c, -20));
    ctx.fillRect(w * 0.7, 3, w * 0.25, h - 6); ctx.strokeRect(w * 0.7, 3, w * 0.25, h - 6);
  });

  add('Kitchen', 'Hob / Cooktop', 3, 2, (ctx, w, h, c) => {
    fill(ctx, '#1e1e1e'); stroke(ctx, '#555');
    ctx.fillRect(1, 1, w - 2, h - 2); ctx.strokeRect(1, 1, w - 2, h - 2);
    // 4 burners
    const positions = [[w*0.25, h*0.3],[w*0.72, h*0.3],[w*0.25, h*0.72],[w*0.72, h*0.72]];
    positions.forEach(([cx, cy]) => {
      stroke(ctx, '#555', 2); ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.stroke();
      stroke(ctx, '#777', 1); ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.stroke();
      fill(ctx, '#444'); ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
    });
  });

  add('Kitchen', 'Kitchen Corner', 4, 4, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    // L-shape countertop
    ctx.beginPath();
    ctx.moveTo(1, 1); ctx.lineTo(w - 1, 1); ctx.lineTo(w - 1, h * 0.4);
    ctx.lineTo(w * 0.4, h * 0.4); ctx.lineTo(w * 0.4, h - 1); ctx.lineTo(1, h - 1); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // worktop highlight
    fill(ctx, shadeColor(c, 15));
    ctx.beginPath();
    ctx.moveTo(3, 3); ctx.lineTo(w - 3, 3); ctx.lineTo(w - 3, h * 0.4 - 1);
    ctx.lineTo(w * 0.4 - 1, h * 0.4 - 1); ctx.lineTo(w * 0.4 - 1, h - 3); ctx.lineTo(3, h - 3); ctx.closePath();
    ctx.fillRect(3, 3, w - 6, 3);
    ctx.fillRect(3, 3, 3, h - 6);
  });

  // ─── BATHROOM ───
  add('Bathroom', 'Bathtub', 3, 5, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    roundRect(ctx, 2, 2, w - 4, h - 4, 8); ctx.fill(); ctx.stroke();
    // inner
    fill(ctx, shadeColor(c, -25));
    roundRect(ctx, 6, 6, w - 12, h - 12, 6); ctx.fill(); ctx.stroke();
    // tap
    fill(ctx, '#ccc'); ctx.fillRect(w / 2 - 4, 4, 8, 5); ctx.strokeRect(w / 2 - 4, 4, 8, 5);
    // drain
    fill(ctx, '#666'); ctx.beginPath(); ctx.arc(w / 2, h - 14, 3, 0, Math.PI * 2); ctx.fill();
  });

  add('Bathroom', 'Shower', 3, 3, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.fillRect(1, 1, w - 2, h - 2); ctx.strokeRect(1, 1, w - 2, h - 2);
    // floor
    fill(ctx, shadeColor(c, -20));
    ctx.fillRect(4, 4, w - 8, h - 8); ctx.strokeRect(4, 4, w - 8, h - 8);
    // drain
    fill(ctx, '#666'); ctx.beginPath(); ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2); ctx.fill();
    // shower head
    fill(ctx, '#aaa'); ctx.fillRect(w * 0.65, h * 0.1, 8, 8); ctx.strokeRect(w * 0.65, h * 0.1, 8, 8);
    // glass line
    stroke(ctx, '#88aaff', 2); ctx.beginPath(); ctx.moveTo(1, h - 1); ctx.lineTo(w - 1, h - 1); ctx.stroke();
  });

  add('Bathroom', 'Toilet', 2, 2.5, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    // tank
    ctx.fillRect(2, 2, w - 4, h * 0.3); ctx.strokeRect(2, 2, w - 4, h * 0.3);
    // bowl
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.65, w * 0.42, h * 0.32, 0, 0, Math.PI * 2);
    fill(ctx, c); ctx.fill(); ctx.stroke();
    // seat
    fill(ctx, shadeColor(c, -15));
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.63, w * 0.35, h * 0.27, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // water
    fill(ctx, '#b3d9ff');
    ctx.beginPath(); ctx.ellipse(w / 2, h * 0.63, w * 0.23, h * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  });

  add('Bathroom', 'Sink/Vanity', 2, 2, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    roundRect(ctx, 2, 2, w - 4, h - 4, 4); ctx.fill(); ctx.stroke();
    fill(ctx, shadeColor(c, -25));
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.3, h * 0.28, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    fill(ctx, '#666'); ctx.beginPath(); ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2); ctx.fill();
    fill(ctx, '#ccc'); ctx.fillRect(w / 2 - 1, 4, 2, 6);
  });

  add('Bathroom', 'Shower Cabin', 4, 4, (ctx, w, h, c) => {
    // walls
    fill(ctx, c); stroke(ctx, '#555', 2);
    ctx.fillRect(1, 1, w - 2, h - 2); ctx.strokeRect(1, 1, w - 2, h - 2);
    // floor tray
    fill(ctx, shadeColor(c, -20)); ctx.fillRect(4, 4, w - 8, h - 8); ctx.strokeRect(4, 4, w - 8, h - 8);
    // drain
    fill(ctx, '#555'); ctx.beginPath(); ctx.arc(w / 2, h / 2, 4, 0, Math.PI * 2); ctx.fill();
    stroke(ctx, '#777'); ctx.beginPath(); ctx.arc(w / 2, h / 2, 4, 0, Math.PI * 2); ctx.stroke();
    // drain lines
    stroke(ctx, '#777', 1);
    ctx.beginPath(); ctx.moveTo(w/2-3, h/2); ctx.lineTo(w/2+3, h/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w/2, h/2-3); ctx.lineTo(w/2, h/2+3); ctx.stroke();
    // glass door (bottom edge)
    stroke(ctx, '#88aaff', 2.5); ctx.beginPath(); ctx.moveTo(1, h - 1); ctx.lineTo(w * 0.55, h - 1); ctx.stroke();
    // shower head (top-right)
    fill(ctx, '#ccc'); stroke(ctx, '#999');
    ctx.fillRect(w - 12, 5, 8, 8); ctx.strokeRect(w - 12, 5, 8, 8);
    stroke(ctx, '#bbb', 1);
    for (let dx = 0; dx < 7; dx += 2) for (let dy = 0; dy < 7; dy += 2) {
      ctx.beginPath(); ctx.arc(w - 11 + dx, 6 + dy, 0.7, 0, Math.PI * 2); ctx.stroke();
    }
  });

  add('Bathroom', 'Double Sink', 4, 2, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.fillRect(1, 1, w - 2, h - 2); ctx.strokeRect(1, 1, w - 2, h - 2);
    // left basin
    const bw = (w - 12) / 2, bh = h - 8;
    fill(ctx, shadeColor(c, -30)); stroke(ctx, '#777');
    ctx.fillRect(4, 4, bw, bh); ctx.strokeRect(4, 4, bw, bh);
    fill(ctx, '#555'); ctx.beginPath(); ctx.arc(4 + bw / 2, 4 + bh / 2, 3, 0, Math.PI * 2); ctx.fill();
    fill(ctx, '#ccc'); ctx.fillRect(4 + bw / 2 - 1, 2, 2, 5);
    // right basin
    fill(ctx, shadeColor(c, -30)); stroke(ctx, '#777');
    ctx.fillRect(8 + bw, 4, bw, bh); ctx.strokeRect(8 + bw, 4, bw, bh);
    fill(ctx, '#555'); ctx.beginPath(); ctx.arc(8 + bw + bw / 2, 4 + bh / 2, 3, 0, Math.PI * 2); ctx.fill();
    fill(ctx, '#ccc'); ctx.fillRect(8 + bw + bw / 2 - 1, 2, 2, 5);
  });

  add('Bathroom', 'Towel Rack', 2, 0.5, (ctx, w, h, c) => {
    fill(ctx, '#aaa'); stroke(ctx, '#888');
    ctx.fillRect(2, h / 2 - 2, w - 4, 4); ctx.strokeRect(2, h / 2 - 2, w - 4, 4);
    // towels
    const tw = (w - 10) / 2;
    fill(ctx, '#e94560'); ctx.fillRect(4, 2, tw - 1, h - 4);
    fill(ctx, '#4a9eff'); ctx.fillRect(6 + tw, 2, tw - 1, h - 4);
  });

  // ─── OFFICE ───
  add('Office', 'Office Desk', 5, 2, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.fillRect(2, 2, w - 4, h - 4); ctx.strokeRect(2, 2, w - 4, h - 4);
    fill(ctx, shadeColor(c, -15)); ctx.fillRect(w * 0.65, 4, w * 0.3, h - 8); ctx.strokeRect(w * 0.65, 4, w * 0.3, h - 8);
    fill(ctx, '#1a4480'); ctx.fillRect(5, 5, w * 0.55, h * 0.45);
    fill(ctx, '#e94560'); ctx.fillRect(8, h * 0.6, 10, 14);
  });

  add('Office', 'Office Chair', 2, 2, (ctx, w, h, c) => drawChair(ctx, w, h, c));

  add('Office', 'Filing Cabinet', 2, 3, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.fillRect(1, 1, w - 2, h - 2); ctx.strokeRect(1, 1, w - 2, h - 2);
    const dh = (h - 4) / 4;
    for (let i = 0; i < 4; i++) {
      const y = 2 + i * dh;
      stroke(ctx, '#777'); ctx.beginPath(); ctx.moveTo(2, y + dh); ctx.lineTo(w - 2, y + dh); ctx.stroke();
      fill(ctx, '#aaa'); ctx.fillRect(w / 2 - 5, y + dh / 2 - 1, 10, 2);
    }
  });

  add('Office', 'Meeting Table', 8, 4, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    roundRect(ctx, 5, 5, w - 10, h - 10, 5); ctx.fill(); ctx.stroke();
    // chairs around
    fill(ctx, shadeColor(c, -30));
    for (let i = 0; i < 4; i++) ctx.fillRect(5 + i * (w / 4) + 2, 1, (w / 4) - 4, 5);
    for (let i = 0; i < 4; i++) ctx.fillRect(5 + i * (w / 4) + 2, h - 6, (w / 4) - 4, 5);
    ctx.fillRect(1, h * 0.2, 5, h * 0.25); ctx.fillRect(w - 6, h * 0.2, 5, h * 0.25);
    ctx.fillRect(1, h * 0.55, 5, h * 0.25); ctx.fillRect(w - 6, h * 0.55, 5, h * 0.25);
  });

  add('Office', 'Office Shelving', 3, 1.5, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.fillRect(1, 1, w - 2, h - 2); ctx.strokeRect(1, 1, w - 2, h - 2);
    stroke(ctx, '#777'); ctx.beginPath(); ctx.moveTo(w / 3, 1); ctx.lineTo(w / 3, h - 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 2 / 3, 1); ctx.lineTo(w * 2 / 3, h - 1); ctx.stroke();
    fill(ctx, '#e94560'); ctx.fillRect(3, 3, 8, h - 6);
    fill(ctx, '#4a9eff'); ctx.fillRect(w / 3 + 2, 3, 8, h - 6);
    fill(ctx, '#50fa7b'); ctx.fillRect(w * 2 / 3 + 2, 3, 8, h - 6);
  });

  // ─── MISC ───
  add('Misc', 'Plant', 1.5, 1.5, (ctx, w, h, c) => {
    // pot
    fill(ctx, '#8b6355'); stroke(ctx, '#6d4c41');
    ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.7); ctx.lineTo(w * 0.7, h * 0.7);
    ctx.lineTo(w * 0.65, h - 3); ctx.lineTo(w * 0.35, h - 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    // leaves
    const leafColors = ['#2d6a4f','#40916c','#52b788','#74c69d'];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const lx = w / 2 + Math.cos(angle) * w * 0.22;
      const ly = h / 2 + Math.sin(angle) * h * 0.2 - 4;
      fill(ctx, leafColors[i % leafColors.length]);
      ctx.beginPath(); ctx.ellipse(lx, ly, 7, 4, angle, 0, Math.PI * 2); ctx.fill();
    }
    fill(ctx, '#2d6a4f');
    ctx.beginPath(); ctx.ellipse(w / 2, h * 0.45, 6, 6, 0, 0, Math.PI * 2); ctx.fill();
  });

  add('Misc', 'Floor Lamp', 1.5, 1.5, (ctx, w, h, c) => {
    // base
    fill(ctx, '#888'); stroke(ctx, '#666');
    ctx.beginPath(); ctx.arc(w / 2, h - 6, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // pole
    stroke(ctx, '#aaa', 2); ctx.beginPath(); ctx.moveTo(w / 2, h - 6); ctx.lineTo(w / 2, 10); ctx.stroke();
    // shade
    fill(ctx, c); stroke(ctx, '#888');
    ctx.beginPath(); ctx.moveTo(w * 0.2, 12); ctx.lineTo(w * 0.8, 12); ctx.lineTo(w * 0.65, 3); ctx.lineTo(w * 0.35, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    // glow
    fill(ctx, 'rgba(255,240,180,0.3)');
    ctx.beginPath(); ctx.arc(w / 2, 12, 8, 0, Math.PI * 2); ctx.fill();
  });

  add('Misc', 'Stairs', 4, 4, (ctx, w, h, c) => {
    fill(ctx, c); stroke(ctx, '#555');
    ctx.fillRect(1, 1, w - 2, h - 2); ctx.strokeRect(1, 1, w - 2, h - 2);
    const steps = 6;
    const sw = (w - 4) / steps;
    stroke(ctx, '#777');
    for (let i = 0; i < steps; i++) {
      fill(ctx, i % 2 === 0 ? shadeColor(c, -10) : shadeColor(c, 10));
      ctx.fillRect(2 + i * sw, 2, sw, h - 4); ctx.strokeRect(2 + i * sw, 2, sw, h - 4);
    }
    // arrow
    stroke(ctx, '#e94560', 2);
    ctx.beginPath(); ctx.moveTo(6, h / 2); ctx.lineTo(w - 6, h / 2);
    ctx.moveTo(w - 10, h / 2 - 4); ctx.lineTo(w - 6, h / 2); ctx.lineTo(w - 10, h / 2 + 4);
    ctx.stroke();
  });

  add('Misc', 'Fireplace', 4, 2, (ctx, w, h, c) => {
    fill(ctx, '#555'); stroke(ctx, '#444');
    ctx.fillRect(1, 1, w - 2, h - 2); ctx.strokeRect(1, 1, w - 2, h - 2);
    // opening
    fill(ctx, '#1a1a1a'); ctx.fillRect(6, 4, w - 12, h - 6); ctx.strokeRect(6, 4, w - 12, h - 6);
    // flames
    const fireY = h - 4;
    fill(ctx, '#e94560'); ctx.beginPath(); ctx.moveTo(w * 0.35, fireY); ctx.bezierCurveTo(w * 0.35, h * 0.3, w * 0.45, h * 0.2, w * 0.5, h * 0.15); ctx.bezierCurveTo(w * 0.55, h * 0.2, w * 0.65, h * 0.3, w * 0.65, fireY); ctx.closePath(); ctx.fill();
    fill(ctx, '#ff6600'); ctx.beginPath(); ctx.moveTo(w * 0.4, fireY); ctx.bezierCurveTo(w * 0.4, h * 0.4, w * 0.47, h * 0.3, w * 0.5, h * 0.25); ctx.bezierCurveTo(w * 0.53, h * 0.3, ctx.bezierCurveTo(w * 0.6, h * 0.4, w * 0.6, fireY), 0, 0); ctx.fill();
    fill(ctx, '#ffcc00'); ctx.beginPath(); ctx.moveTo(w * 0.45, fireY); ctx.bezierCurveTo(w * 0.45, h * 0.5, w * 0.48, h * 0.4, w * 0.5, h * 0.35); ctx.bezierCurveTo(w * 0.52, h * 0.4, w * 0.55, h * 0.5, w * 0.55, fireY); ctx.closePath(); ctx.fill();
  });

  // Custom Image — paid-only. Placeholder thumbnail (dashed box + icon) since
  // there's no per-def image; the actual picture is chosen per-instance on
  // drop (see the 'drop' handler) and stored as item.imageDataUrl.
  D.push({
    id: idCounter++, name: 'Custom Image', category: 'Custom', tier: 'paid', isImage: true,
    w: 2 * GRID, h: 2 * GRID,
    draw: (ctx, w, h, c) => {
      stroke(ctx, '#777', 1.5);
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.setLineDash([]);
      fill(ctx, '#777');
      ctx.beginPath();
      ctx.arc(w * 0.35, h * 0.4, Math.min(w, h) * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w * 0.2, h * 0.75);
      ctx.lineTo(w * 0.45, h * 0.5);
      ctx.lineTo(w * 0.6, h * 0.65);
      ctx.lineTo(w * 0.8, h * 0.4);
      ctx.lineTo(w * 0.85, h * 0.75);
      ctx.closePath();
      ctx.fill();
    },
  });

  return D;
}

function drawBed(ctx, w, h, c) {
  // frame
  fill(ctx, shadeColor(c, -20)); stroke(ctx, '#555');
  ctx.fillRect(1, 1, w - 2, h - 2); ctx.strokeRect(1, 1, w - 2, h - 2);
  // headboard
  fill(ctx, shadeColor(c, -35));
  ctx.fillRect(2, 2, w - 4, h * 0.18); ctx.strokeRect(2, 2, w - 4, h * 0.18);
  // mattress
  fill(ctx, shadeColor(c, 20));
  ctx.fillRect(4, h * 0.2, w - 8, h * 0.72); ctx.strokeRect(4, h * 0.2, w - 8, h * 0.72);
  // pillow(s)
  fill(ctx, '#f0f0f0'); stroke(ctx, '#ccc');
  const pillowW = Math.min((w - 14) / Math.max(1, Math.round((w - 14) / 30)), 36);
  const numPillows = Math.max(1, Math.floor((w - 14) / (pillowW + 4)));
  const startX = 4 + ((w - 8) - (numPillows * pillowW + (numPillows - 1) * 4)) / 2;
  for (let i = 0; i < numPillows; i++) {
    roundRect(ctx, startX + i * (pillowW + 4), h * 0.22, pillowW, h * 0.18, 4); ctx.fill(); ctx.stroke();
  }
  // blanket line
  fill(ctx, shadeColor(c, 10)); ctx.fillRect(4, h * 0.45, w - 8, h * 0.05);
}

function drawChair(ctx, w, h, c) {
  fill(ctx, c); stroke(ctx, '#555', 1.5);
  // seat
  roundRect(ctx, 3, h * 0.3, w - 6, h * 0.65, 4); ctx.fill(); ctx.stroke();
  // back
  fill(ctx, shadeColor(c, -20));
  roundRect(ctx, 3, 2, w - 6, h * 0.3, 3); ctx.fill(); ctx.stroke();
  // legs
  fill(ctx, shadeColor(c, -30));
  [[3,h-5],[w-7,h-5]].forEach(([x,y]) => { ctx.fillRect(x, y, 4, 4); });
}

function shadeColor(color, pct) {
  // parse hex or named color
  let r, g, b;
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255;
  } else {
    // create temp canvas to parse CSS color
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = 1;
    const tc = tmp.getContext('2d'); tc.fillStyle = color; tc.fillRect(0,0,1,1);
    const d = tc.getImageData(0,0,1,1).data;
    r = d[0]; g = d[1]; b = d[2];
  }
  const f = pct / 100;
  r = Math.max(0, Math.min(255, Math.round(r + (f > 0 ? (255 - r) : r) * Math.abs(f))));
  g = Math.max(0, Math.min(255, Math.round(g + (f > 0 ? (255 - g) : g) * Math.abs(f))));
  b = Math.max(0, Math.min(255, Math.round(b + (f > 0 ? (255 - b) : b) * Math.abs(f))));
  return `rgb(${r},${g},${b})`;
}

const FURNITURE_DEFS = makeDefs();

// ═══════════════════════════════════════════════════════════
