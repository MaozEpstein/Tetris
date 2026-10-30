(() => {
'use strict';

const COLS = 10, ROWS = 20;
const LOCK_DELAY = 500, MAX_LOCK_RESETS = 15, CLEAR_TIME = 300;

const COLORS = { I: '#4dd8e8', O: '#f7d154', T: '#b57bee', S: '#6bd67f', Z: '#f2677a', J: '#5b8def', L: '#f59b4b' };
const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]],
};
const TYPES = Object.keys(SHAPES);

// SRS wall kicks, (x, y) with y pointing up
const KICKS_JLSTZ = {
  '0>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]], '1>0': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  '1>2': [[0,0],[1,0],[1,-1],[0,2],[1,2]],     '2>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '2>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],    '3>2': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '3>0': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],  '0>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
};
const KICKS_I = {
  '0>1': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],  '1>0': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  '1>2': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],  '2>1': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  '2>3': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],  '3>2': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  '3>0': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],  '0>3': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
};

const $ = id => document.getElementById(id);
const boardCv = $('board'), holdCv = $('hold'), nextCv = $('next');
const bctx = boardCv.getContext('2d');
const el = { score: $('score'), level: $('level'), lines: $('lines'), best: $('best'),
  overlay: $('overlay'), ovTitle: $('ovTitle'), ovText: $('ovText'), ovBtn: $('ovBtn') };

let board, piece, queue, holdType, canHold;
let score, lines, level, best = 0;
let state = 'idle'; // idle | playing | paused | clearing | over
let dropAcc, lockT, lockResets, clearRows, clearT;
let cell = 24;

try { best = +localStorage.getItem('tetris.best') || 0; } catch (e) {}
el.best.textContent = best;

// ---------- helpers ----------
const rotateM = (m, dir) => {
  const n = m.length;
  return m.map((_, r) => m.map((_, c) => dir > 0 ? m[n - 1 - c][r] : m[c][n - 1 - r]));
};
const vibrate = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

function collides(m, x, y) {
  for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++) {
    if (!m[r][c]) continue;
    const nx = x + c, ny = y + r;
    if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
    if (ny >= 0 && board[ny][nx]) return true;
  }
  return false;
}

function refillQueue() {
  while (queue.length < 7) {
    const bag = TYPES.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    queue.push(...bag);
  }
}

function makePiece(t) {
  const m = SHAPES[t].map(r => r.slice());
  return { t, m, r: 0, x: Math.floor((COLS - m.length) / 2), y: -1 };
}

function spawn(t) {
  if (!t) { refillQueue(); t = queue.shift(); refillQueue(); }
  piece = makePiece(t);
  dropAcc = 0; lockT = 0; lockResets = 0;
  if (collides(piece.m, piece.x, piece.y)) gameOver();
}

const gravityMs = () => Math.max(16, Math.pow(0.8 - (level - 1) * 0.007, level - 1) * 1000);

// ---------- game flow ----------
function newGame() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  queue = []; holdType = null; canHold = true;
  score = 0; lines = 0; level = 1; clearRows = null;
  updateHud();
  spawn();
  state = 'playing';
  hideOverlay();
}

function gameOver() {
  state = 'over';
  if (score > best) { best = score; try { localStorage.setItem('tetris.best', best); } catch (e) {} }
  updateHud();
  vibrate([60, 40, 120]);
  showOverlay('GAME OVER', `Score ${score}\nBest ${best}`, 'AGAIN');
}

function pause() { if (state === 'playing') { state = 'paused'; showOverlay('PAUSED', '', 'RESUME'); } }
function resume() { if (state === 'paused') { state = 'playing'; hideOverlay(); } }

function showOverlay(title, text, btn) {
  el.ovTitle.textContent = title; el.ovText.textContent = text; el.ovBtn.textContent = btn;
  el.overlay.classList.remove('hidden');
}
function hideOverlay() { el.overlay.classList.add('hidden'); }

function updateHud() {
  el.score.textContent = score.toLocaleString('en-US');
  el.level.textContent = level;
  el.lines.textContent = lines;
  el.best.textContent = Math.max(best, score);
}

// ---------- actions ----------
const active = () => state === 'playing';

function onMoved() {
  if (collides(piece.m, piece.x, piece.y + 1) && lockResets < MAX_LOCK_RESETS) { lockT = 0; lockResets++; }
}

function move(dx) {
  if (!active() || collides(piece.m, piece.x + dx, piece.y)) return false;
  piece.x += dx; onMoved(); return true;
}

function softStep() {
  if (!active() || collides(piece.m, piece.x, piece.y + 1)) return false;
  piece.y++; score += 1; dropAcc = 0; updateHud(); return true;
}

function hardDrop() {
  if (!active()) return;
  let d = 0;
  while (!collides(piece.m, piece.x, piece.y + 1)) { piece.y++; d++; }
  score += d * 2;
  lockPiece();
}

function rotate(dir) {
  if (!active() || piece.t === 'O') return;
  const to = (piece.r + dir + 4) % 4;
  const m = rotateM(piece.m, dir);
  const kicks = (piece.t === 'I' ? KICKS_I : KICKS_JLSTZ)[`${piece.r}>${to}`];
  for (const [kx, ky] of kicks) {
    if (!collides(m, piece.x + kx, piece.y - ky)) {
      piece.m = m; piece.r = to; piece.x += kx; piece.y -= ky;
      onMoved();
      return;
    }
  }
}

function hold() {
  if (!active() || !canHold) return;
  const cur = piece.t;
  if (holdType) spawn(holdType); else spawn();
  holdType = cur;
  canHold = false;
  vibrate(8);
}

function lockPiece() {
  let overTop = false;
  piece.m.forEach((row, r) => row.forEach((v, c) => {
    if (!v) return;
    const y = piece.y + r;
    if (y < 0) overTop = true; else board[y][piece.x + c] = piece.t;
  }));
  if (overTop) return gameOver();

  const full = [];
  for (let y = 0; y < ROWS; y++) if (board[y].every(Boolean)) full.push(y);
  canHold = true;

  if (full.length) {
    const n = full.length;
    score += [0, 100, 300, 500, 800][n] * level;
    lines += n;
    level = Math.floor(lines / 10) + 1;
    updateHud();
    clearRows = full; clearT = CLEAR_TIME; state = 'clearing';
    piece = null;
    vibrate(n === 4 ? [30, 30, 60] : 25);
  } else {
    vibrate(8);
    spawn();
  }
}

function finishClear() {
  board = board.filter((_, y) => !clearRows.includes(y));
  while (board.length < ROWS) board.unshift(Array(COLS).fill(null));
  clearRows = null;
  state = 'playing';
  spawn();
}

// ---------- update ----------
function update(dt) {
  if (state === 'clearing') { clearT -= dt; if (clearT <= 0) finishClear(); return; }
  if (state !== 'playing') return;

  if (collides(piece.m, piece.x, piece.y + 1)) {
    dropAcc = 0;
    lockT += dt;
    if (lockT >= LOCK_DELAY) lockPiece();
  } else {
    lockT = 0;
    dropAcc += dt;
    const g = gravityMs();
    while (dropAcc >= g && !collides(piece.m, piece.x, piece.y + 1)) { piece.y++; dropAcc -= g; }
    if (collides(piece.m, piece.x, piece.y + 1)) dropAcc = 0;
  }
}

// ---------- rendering ----------
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, Math.round(v + (amt > 0 ? (255 - v) : v) * amt)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

function drawBlock(ctx, x, y, s, color, alpha = 1) {
  const p = Math.max(1, s * 0.05), w = s - p * 2, rad = s * 0.22;
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(x, y, x, y + s);
  g.addColorStop(0, shade(color, 0.28));
  g.addColorStop(1, shade(color, -0.18));
  ctx.fillStyle = g;
  rr(ctx, x + p, y + p, w, w, rad); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  rr(ctx, x + p + w * 0.14, y + p + w * 0.1, w * 0.72, w * 0.16, rad * 0.5); ctx.fill();
  ctx.globalAlpha = 1;
}

function drawGhost(ctx, x, y, s, color) {
  const p = Math.max(1, s * 0.05) + 1;
  ctx.strokeStyle = color; ctx.globalAlpha = 0.45; ctx.lineWidth = Math.max(1.5, s * 0.07);
  rr(ctx, x + p, y + p, s - p * 2, s - p * 2, s * 0.22); ctx.stroke();
  ctx.fillStyle = color; ctx.globalAlpha = 0.08; ctx.fill();
  ctx.globalAlpha = 1;
}

function sizeCanvas(cv, w, h) {
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function layout() {
  const st = $('stage').getBoundingClientRect();
  cell = Math.max(10, Math.floor(Math.min(st.width / COLS, st.height / ROWS)));
  sizeCanvas(boardCv, cell * COLS, cell * ROWS);
  const o = el.overlay.style;
  o.width = cell * COLS + 'px'; o.height = cell * ROWS + 'px';
  // small canvases keep a fixed css size
  sizeCanvas(holdCv, 56, 44); sizeCanvas(nextCv, 140, 44);
}

function drawMini(ctx, t, ox, ow, h, dim) {
  const m = SHAPES[t];
  let minR = 9, maxR = -1, minC = 9, maxC = -1;
  m.forEach((row, r) => row.forEach((v, c) => { if (v) { minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c); } }));
  const s = Math.min(ow / 4, h / 2.4, 13);
  const w = (maxC - minC + 1) * s, hh = (maxR - minR + 1) * s;
  const x0 = ox + (ow - w) / 2, y0 = (h - hh) / 2;
  m.forEach((row, r) => row.forEach((v, c) => { if (v) drawBlock(ctx, x0 + (c - minC) * s, y0 + (r - minR) * s, s, COLORS[t], dim ? 0.4 : 1); }));
}

function renderSide() {
  const hc = holdCv.getContext('2d');
  hc.clearRect(0, 0, 56, 44);
  if (holdType) drawMini(hc, holdType, 0, 56, 44, !canHold);
  const nc = nextCv.getContext('2d');
  nc.clearRect(0, 0, 140, 44);
  for (let i = 0; i < 3 && queue[i]; i++) drawMini(nc, queue[i], i * (140 / 3), 140 / 3, 44, false);
}

function render() {
  const ctx = bctx, W = cell * COLS, H = cell * ROWS;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#171532'); bg.addColorStop(1, '#0d0d20');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    ctx.beginPath(); ctx.arc(x * cell + cell / 2, y * cell + cell / 2, cell * 0.06, 0, 7); ctx.fill();
  }
  if (!board) return;

  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (board[y][x]) drawBlock(ctx, x * cell, y * cell, cell, COLORS[board[y][x]]);
  }

  if (clearRows) {
    const k = Math.max(0, clearT / CLEAR_TIME);
    ctx.fillStyle = `rgba(255,255,255,${(1 - k) < 0.5 ? (1 - k) * 1.6 : (k) * 1.6})`;
    for (const y of clearRows) ctx.fillRect(0, y * cell, W, cell);
  }

  if (piece && (state === 'playing' || state === 'paused')) {
    let gy = piece.y;
    while (!collides(piece.m, piece.x, gy + 1)) gy++;
    piece.m.forEach((row, r) => row.forEach((v, c) => {
      if (!v) return;
      if (gy + r >= 0 && gy !== piece.y) drawGhost(ctx, (piece.x + c) * cell, (gy + r) * cell, cell, COLORS[piece.t]);
    }));
    piece.m.forEach((row, r) => row.forEach((v, c) => {
      if (v && piece.y + r >= 0) drawBlock(ctx, (piece.x + c) * cell, (piece.y + r) * cell, cell, COLORS[piece.t]);
    }));
  }
  renderSide();
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(100, now - last); last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

// ---------- input: touch ----------
const stage = $('stage');
let g = null;
stage.addEventListener('pointerdown', e => {
  if (e.target.closest('.overlay:not(.hidden)')) return;
  stage.setPointerCapture(e.pointerId);
  g = { x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, t0: performance.now(), ax: 0, ay: 0, moved: false };
});
stage.addEventListener('pointermove', e => {
  if (!g) return;
  g.ax += e.clientX - g.lx;
  const dy = e.clientY - g.ly;
  if (dy > 0) g.ay += dy;
  g.lx = e.clientX; g.ly = e.clientY;
  if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 10) g.moved = true;
  const sx = cell * 0.9, sy = cell * 0.85;
  while (g.ax >= sx) { move(1); g.ax -= sx; }
  while (g.ax <= -sx) { move(-1); g.ax += sx; }
  while (g.ay >= sy) { softStep(); g.ay -= sy; }
});
const endGesture = e => {
  if (!g) return;
  const dt = performance.now() - g.t0;
  const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
  if (e.type === 'pointerup') {
    if (!g.moved && dt < 300) rotate(1);
    else if (dy < -cell * 3 && Math.abs(dx) < Math.abs(dy) * 0.6) hold();
    else if (dy > cell * 3 && dt < 260 && Math.abs(dx) < Math.abs(dy) * 0.6) hardDrop();
  }
  g = null;
};
stage.addEventListener('pointerup', endGesture);
stage.addEventListener('pointercancel', endGesture);
holdCv.parentElement.addEventListener('pointerdown', hold);

// ---------- input: keyboard ----------
window.addEventListener('keydown', e => {
  const k = e.key;
  if (k === 'Enter' && (state === 'idle' || state === 'over')) { newGame(); return; }
  if (k === 'p' || k === 'P' || k === 'Escape') { state === 'paused' ? resume() : pause(); return; }
  switch (k) {
    case 'ArrowLeft': move(-1); break;
    case 'ArrowRight': move(1); break;
    case 'ArrowDown': softStep(); break;
    case 'ArrowUp': case 'x': case 'X': rotate(1); break;
    case 'z': case 'Z': rotate(-1); break;
    case ' ': hardDrop(); break;
    case 'c': case 'C': case 'Shift': hold(); break;
    default: return;
  }
  e.preventDefault();
});

// ---------- ui ----------
el.ovBtn.addEventListener('click', () => (state === 'paused' ? resume() : newGame()));
$('pauseBtn').addEventListener('click', () => (state === 'paused' ? resume() : pause()));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('resize', layout);

layout();
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
})();
