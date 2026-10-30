(() => {
'use strict';

const COLS = 10, ROWS = 20;
const LOCK_DELAY = 500, MAX_LOCK_RESETS = 15;
const CLEAR_TIMES = [0, 340, 400, 460, 680];
const CLEAR_NAMES = ['', '', 'DOUBLE', 'TRIPLE', 'TETRIS'];

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
  overlay: $('overlay'), ovTitle: $('ovTitle'), ovText: $('ovText'), ovBtn: $('ovBtn'), ovBtn2: $('ovBtn2') };

let board, piece, queue, holdType, canHold;
let score, lines, level, best = 0;
let state = 'menu'; // menu | playing | slamming | paused | clearing | over
let dropAcc, lockT, lockResets, clearRows, clearT;
let slam = null, shake = 0, flash = null;
let particles = [], popup = null, jolt = 0, clearDur = 340;
let cell = 24;

const SLAM_FLASH = 220;
const STEP_MUL = [1.3, 1, 0.75];
const settings = { ghost: true, haptics: true, longPress: true, sens: 1, startLevel: 1 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('tetris.settings') || '{}')); } catch (e) {}
const saveSettings = () => { try { localStorage.setItem('tetris.settings', JSON.stringify(settings)); } catch (e) {} };

try { best = +localStorage.getItem('tetris.best') || 0; } catch (e) {}
el.best.textContent = best;

// ---------- helpers ----------
const rotateM = (m, dir) => {
  const n = m.length;
  return m.map((_, r) => m.map((_, c) => dir > 0 ? m[n - 1 - c][r] : m[c][n - 1 - r]));
};
const vibrate = ms => { if (!settings.haptics) return; try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

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
  score = 0; lines = 0; level = settings.startLevel; clearRows = null;
  slam = null; shake = 0; flash = null; particles = []; popup = null; jolt = 0;
  updateHud();
  spawn();
  state = 'playing';
  hideOverlay();
}

function showMenu() {
  state = 'menu';
  hideOverlay();
  $('settings').classList.add('hidden');
  $('menuBest').textContent = best;
  $('menu').classList.remove('hidden');
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
  let to = piece.y;
  while (!collides(piece.m, piece.x, to + 1)) to++;
  if (to === piece.y) { lockPiece(); return; }
  const dist = to - piece.y;
  slam = { from: piece.y, to, t: 0, dur: Math.min(240, 70 + dist * 9), cur: piece.y };
  state = 'slamming';
  vibrate(12);
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
  const cells = [];
  piece.m.forEach((row, r) => row.forEach((v, c) => {
    if (!v) return;
    const y = piece.y + r;
    if (y < 0) overTop = true; else { board[y][piece.x + c] = piece.t; cells.push([piece.x + c, y]); }
  }));
  flash = { cells, t: 0 };
  if (overTop) return gameOver();

  const full = [];
  for (let y = 0; y < ROWS; y++) if (board[y].every(Boolean)) full.push(y);
  canHold = true;

  if (full.length) {
    const n = full.length;
    const gain = [0, 100, 300, 500, 800][n] * level;
    score += gain;
    lines += n;
    level = settings.startLevel + Math.floor(lines / 10);
    updateHud();
    clearRows = full; clearDur = clearT = CLEAR_TIMES[n]; state = 'clearing';
    piece = null;
    startClearFx(full, n, gain);
    vibrate(n === 4 ? [40, 30, 40, 30, 120] : n === 1 ? 25 : [30, 20, 50]);
  } else {
    vibrate(8);
    spawn();
  }
}

function startClearFx(rows, n, gain) {
  jolt = [0, 0.25, 0.5, 0.85, 1.6][n];
  const per = n === 4 ? 6 : 2 + n;
  for (const y of rows) for (let x = 0; x < COLS; x++) {
    const t = board[y][x];
    for (let i = 0; i < per; i++) {
      particles.push({
        x: x + 0.5, y: y + 0.5,
        vx: (Math.random() - 0.5) * (7 + n * 2.5), vy: -(Math.random() * 5 + 2) * (1 + n * 0.12),
        life: 0, max: 600 + Math.random() * 600, size: 0.08 + Math.random() * 0.15,
        delay: (x / COLS) * 0.5 * clearDur, color: n === 4 && i % 2 ? '#ffffff' : COLORS[t],
      });
    }
  }
  popup = { text: CLEAR_NAMES[n], sub: '+' + gain.toLocaleString('en-US'), t: 0, dur: n === 4 ? 1400 : 1000, n, y: rows.reduce((a, b) => a + b, 0) / n };
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
  if (shake > 0) shake = Math.max(0, shake - dt / 160);
  if (flash && (flash.t += dt) > SLAM_FLASH) flash = null;
  if (jolt > 0) jolt = Math.max(0, jolt - dt / 450);
  if (popup && (popup.t += dt) > popup.dur) popup = null;
  if (particles.length) {
    const s = dt / 1000;
    particles = particles.filter(p => {
      if (p.delay > 0) { p.delay -= dt; return true; }
      p.life += dt; p.vy += 22 * s; p.x += p.vx * s; p.y += p.vy * s;
      return p.life < p.max;
    });
  }

  if (state === 'slamming') {
    slam.t += dt;
    const p = Math.min(1, slam.t / slam.dur);
    slam.cur = slam.from + (slam.to - slam.from) * p * p;
    if (p >= 1) {
      score += (slam.to - slam.from) * 2;
      piece.y = slam.to;
      slam = null;
      state = 'playing';
      updateHud();
      shake = 1;
      lockPiece();
    }
    return;
  }
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

function drawClear(ctx, W, H) {
  const k = 1 - clearT / clearDur, n = clearRows.length;
  for (const y of clearRows) for (let x = 0; x < COLS; x++) {
    const t = board[y][x];
    if (!t) continue;
    const l = Math.max(0, Math.min(1, k * 1.7 - (x / COLS) * 0.7));
    const cx = x * cell + cell / 2, cy = y * cell + cell / 2, sc = 1 + l * 0.35;
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
    drawBlock(ctx, x * cell, y * cell, cell, COLORS[t], 1 - l);
    ctx.fillStyle = `rgba(255,255,255,${Math.sin(Math.min(1, l * 1.2) * Math.PI) * 0.85})`;
    rr(ctx, x * cell + 1, y * cell + 1, cell - 2, cell - 2, cell * 0.22); ctx.fill();
    ctx.restore();
  }
  // light sweep across the cleared rows
  const bx = (k * 1.4 - 0.2) * W;
  const beam = ctx.createLinearGradient(bx - cell * 2.5, 0, bx + cell * 2.5, 0);
  beam.addColorStop(0, 'rgba(255,255,255,0)');
  beam.addColorStop(0.5, 'rgba(255,255,255,0.95)');
  beam.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = beam;
  for (const y of clearRows) ctx.fillRect(0, y * cell - cell * 0.1, W, cell * 1.2);

  if (n === 4) {
    const pulse = Math.sin(Math.min(1, k * 1.2) * Math.PI);
    ctx.fillStyle = `hsla(${k * 420}, 90%, 62%, ${0.28 * pulse})`;
    ctx.fillRect(0, 0, W, H);
    const cy = (clearRows[0] + clearRows[3] + 1) / 2 * cell;
    for (let i = 0; i < 2; i++) {
      const kk = Math.max(0, k - i * 0.12);
      ctx.strokeStyle = `rgba(${i ? '245,215,90' : '77,216,232'},${1 - kk})`;
      ctx.lineWidth = Math.max(1, cell * 0.3 * (1 - kk));
      ctx.beginPath(); ctx.arc(W / 2, cy, kk * W * 1.1, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

function drawParticles(ctx) {
  if (!particles.length) return;
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    if (p.delay > 0) continue;
    const a = 1 - p.life / p.max, sz = p.size * cell * (0.5 + a * 0.5);
    ctx.globalAlpha = a; ctx.fillStyle = p.color;
    ctx.fillRect(p.x * cell - sz / 2, p.y * cell - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function drawPopup(ctx, W, H) {
  if (!popup) return;
  const p = popup.t / popup.dur, u = Math.min(1, p / 0.18) - 1;
  const pop = p < 0.18 ? 1 + 2.70158 * u * u * u + 1.70158 * u * u : 1;
  const a = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
  const tetris = popup.n === 4;
  const y = Math.max(cell * 3, Math.min(H * 0.55, popup.y * cell)) - p * cell * 1.5;
  ctx.save();
  ctx.translate(W / 2, y); ctx.scale(pop, pop);
  ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = tetris ? '#8b7bff' : 'rgba(139,123,255,0.9)'; ctx.shadowBlur = cell * (tetris ? 1.2 : 0.7);
  if (popup.text) {
    const fs = cell * (tetris ? 1.9 : 1.25);
    ctx.font = `800 ${fs}px system-ui, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = Math.round(fs * 0.08) + 'px';
    if (tetris) {
      const g = ctx.createLinearGradient(-W * 0.4, 0, W * 0.4, 0);
      ['#4dd8e8', '#b57bee', '#f2677a', '#f7d154'].forEach((c, i) => g.addColorStop(i / 3, c));
      ctx.fillStyle = g;
    } else ctx.fillStyle = '#fff';
    ctx.fillText(popup.text, 0, 0);
  }
  ctx.shadowBlur = 0;
  ctx.font = `700 ${cell * 0.7}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(popup.sub, 0, popup.text ? cell * (tetris ? 1.4 : 1) : 0);
  ctx.restore();
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

  ctx.save();
  if (shake > 0) ctx.translate(0, shake * shake * cell * 0.2);
  if (jolt > 0) ctx.translate((Math.random() - 0.5) * jolt * cell * 0.3, (Math.random() - 0.5) * jolt * cell * 0.3);

  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (board[y][x] && !(clearRows && clearRows.includes(y))) drawBlock(ctx, x * cell, y * cell, cell, COLORS[board[y][x]]);
  }

  if (clearRows) drawClear(ctx, W, H);
  drawParticles(ctx);

  if (piece && (state === 'playing' || state === 'paused' || state === 'slamming')) {
    const slamming = state === 'slamming';
    const py = slamming ? slam.cur : piece.y;
    if (!slamming && settings.ghost) {
      let gy = piece.y;
      while (!collides(piece.m, piece.x, gy + 1)) gy++;
      piece.m.forEach((row, r) => row.forEach((v, c) => {
        if (v && gy + r >= 0 && gy !== piece.y) drawGhost(ctx, (piece.x + c) * cell, (gy + r) * cell, cell, COLORS[piece.t]);
      }));
    }
    if (slamming) {
      piece.m.forEach((row, r) => row.forEach((v, c) => {
        if (!v) return;
        const x = (piece.x + c) * cell, y0 = (slam.from + r) * cell, y1 = (py + r) * cell;
        if (y1 - y0 < 2) return;
        const tg = ctx.createLinearGradient(0, y0, 0, y1);
        tg.addColorStop(0, COLORS[piece.t] + '00');
        tg.addColorStop(1, COLORS[piece.t] + '70');
        ctx.fillStyle = tg;
        ctx.fillRect(x + cell * 0.18, y0, cell * 0.64, y1 - y0);
      }));
    }
    piece.m.forEach((row, r) => row.forEach((v, c) => {
      if (v && py + r > -1) drawBlock(ctx, (piece.x + c) * cell, (py + r) * cell, cell, COLORS[piece.t]);
    }));
  }

  if (flash) {
    ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - flash.t / SLAM_FLASH)})`;
    for (const [x, y] of flash.cells) { rr(ctx, x * cell + 1, y * cell + 1, cell - 2, cell - 2, cell * 0.22); ctx.fill(); }
  }
  ctx.restore();
  drawPopup(ctx, W, H);
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
  const now = performance.now();
  const me = g = { x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, t0: now, ax: 0, ay: 0, moved: false, fired: false, timer: 0, samples: [{ t: now, x: e.clientX, y: e.clientY }] };
  if (settings.longPress) {
    me.timer = setTimeout(() => { if (g === me && !me.moved && active()) { me.fired = true; hardDrop(); } }, 380);
  }
});
stage.addEventListener('pointermove', e => {
  if (!g) return;
  const now = performance.now();
  g.samples.push({ t: now, x: e.clientX, y: e.clientY });
  while (g.samples.length > 2 && now - g.samples[0].t > 100) g.samples.shift();
  g.ax += e.clientX - g.lx;
  const dy = e.clientY - g.ly;
  if (dy > 0) g.ay += dy;
  g.lx = e.clientX; g.ly = e.clientY;
  if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 10) { g.moved = true; clearTimeout(g.timer); }
  if (g.fired) return;
  const sx = cell * 0.9 * STEP_MUL[settings.sens], sy = cell * 0.85;
  while (g.ax >= sx) { move(1); g.ax -= sx; }
  while (g.ax <= -sx) { move(-1); g.ax += sx; }
  while (g.ay >= sy) { softStep(); g.ay -= sy; }
});
const endGesture = e => {
  if (!g) return;
  clearTimeout(g.timer);
  const dt = performance.now() - g.t0;
  const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
  if (e.type === 'pointerup' && !g.fired) {
    const a = g.samples[0], b = g.samples[g.samples.length - 1];
    const span = b.t - a.t, fy = b.y - a.y;
    const flick = span > 8 && fy > cell * 0.7 && fy / span > 0.8 && Math.abs(b.x - a.x) < fy * 0.8;
    if (!g.moved && dt < 300) rotate(1);
    else if (dy < -cell * 3 && Math.abs(dx) < Math.abs(dy) * 0.6) hold();
    else if (flick || (dy > cell * 3 && dt < 260 && Math.abs(dx) < Math.abs(dy) * 0.6)) hardDrop();
  }
  g = null;
};
stage.addEventListener('pointerup', endGesture);
stage.addEventListener('pointercancel', endGesture);
holdCv.parentElement.addEventListener('pointerdown', hold);

// ---------- input: keyboard ----------
window.addEventListener('keydown', e => {
  const k = e.key;
  if (k === 'Enter' && (state === 'menu' || state === 'over')) { startClassic(); return; }
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
function startClassic() { $('menu').classList.add('hidden'); newGame(); }
el.ovBtn.addEventListener('click', () => (state === 'paused' ? resume() : newGame()));
el.ovBtn2.addEventListener('click', showMenu);
$('playClassic').addEventListener('click', startClassic);
$('openSettings').addEventListener('click', () => { renderSettings(); $('settings').classList.remove('hidden'); });
$('setBack').addEventListener('click', () => $('settings').classList.add('hidden'));

function renderSettings() {
  document.querySelectorAll('.switch').forEach(b => b.classList.toggle('on', !!settings[b.dataset.key]));
  document.querySelectorAll('#sensSeg button').forEach(b => b.classList.toggle('on', +b.dataset.v === settings.sens));
  $('lvVal').textContent = settings.startLevel;
}
document.querySelectorAll('.switch').forEach(b => b.addEventListener('click', () => {
  settings[b.dataset.key] = !settings[b.dataset.key]; saveSettings(); renderSettings();
  if (b.dataset.key === 'haptics' && settings.haptics) vibrate(20);
}));
document.querySelectorAll('#sensSeg button').forEach(b => b.addEventListener('click', () => { settings.sens = +b.dataset.v; saveSettings(); renderSettings(); }));
$('lvDown').addEventListener('click', () => { settings.startLevel = Math.max(1, settings.startLevel - 1); saveSettings(); renderSettings(); });
$('lvUp').addEventListener('click', () => { settings.startLevel = Math.min(15, settings.startLevel + 1); saveSettings(); renderSettings(); });
renderSettings();
$('menuBest').textContent = best;
$('pauseBtn').addEventListener('click', () => (state === 'paused' ? resume() : pause()));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('resize', layout);

layout();
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
})();
