(() => {
'use strict';

const COLS = 10, ROWS = 20;
const LOCK_DELAY = 500, MAX_LOCK_RESETS = 15;
const CLEAR_TIMES = [0, 340, 400, 460, 680];
const CLEAR_NAMES = ['', '', 'DOUBLE', 'TRIPLE', 'TETRIS'];
const SPRINT_GOAL = 40;
const COUNT_STEP = 800;
const SLAM_FLASH = 220;
const STEP_MUL = [1.3, 1, 0.75];

// Classic difficulty = how fast the speed ramps up (all start at the same pace).
// speed level L = lines / perLines + playTime / perMs
const DIFFS = [
  { name: 'EASY',   perLines: 15, perMs: 120000, desc: 'Speed rises slowly. Relax and learn.' },
  { name: 'NORMAL', perLines: 10, perMs: 75000,  desc: 'The classic curve.' },
  { name: 'HARD',   perLines: 8,  perMs: 50000,  desc: 'Speed climbs fast.' },
  { name: 'EXPERT', perLines: 6,  perMs: 35000,  desc: 'Gets scary within minutes.' },
  { name: 'INSANE', perLines: 4,  perMs: 22000,  desc: 'Survive as long as you can.' },
];

const THEMES = {
  aurora: { name: 'AURORA', style: 'glossy', bg1: '#1b1740', bg2: '#0b0c1a', well1: '#1d1a45', well2: '#0f0e26', accent: '#8b7bff', accent2: '#5b8def', text: '#eceaff', muted: '#8b88b0', onAccent: '#ffffff',
    colors: { I: '#4dd8e8', O: '#f7d154', T: '#b57bee', S: '#6bd67f', Z: '#f2677a', J: '#5b8def', L: '#f59b4b' } },
  sunset: { name: 'SUNSET', style: 'glossy', bg1: '#3d1631', bg2: '#150810', well1: '#3a1a33', well2: '#1c0b17', accent: '#ff6f91', accent2: '#ff9f68', text: '#fff0f3', muted: '#c797a6', onAccent: '#ffffff',
    colors: { I: '#ffd479', O: '#ff9f68', T: '#ff6f91', S: '#c77dff', Z: '#ff5a5f', J: '#9b72e8', L: '#ffb86b' } },
  ocean: { name: 'OCEAN', style: 'glossy', bg1: '#0d2c47', bg2: '#050f1c', well1: '#0f3050', well2: '#071522', accent: '#38bdf8', accent2: '#22d3ee', text: '#e6f6ff', muted: '#7fa8c2', onAccent: '#04202e',
    colors: { I: '#67e8f9', O: '#a7f3d0', T: '#93c5fd', S: '#5eead4', Z: '#f9a8d4', J: '#3b82f6', L: '#c4b5fd' } },
  retro: { name: 'RETRO', style: 'flat', bg1: '#262626', bg2: '#0c0c0c', well1: '#1a1a1a', well2: '#0b0b0b', accent: '#39ff14', accent2: '#1fae0c', text: '#e8ffe5', muted: '#7fa27a', onAccent: '#06210a',
    colors: { I: '#00e5ff', O: '#ffe600', T: '#c000ff', S: '#00e000', Z: '#ff2020', J: '#2c4cff', L: '#ff8000' } },
  oled: { name: 'OLED', style: 'glossy', bg1: '#0a0a0a', bg2: '#000000', well1: '#101012', well2: '#050506', accent: '#7c9cff', accent2: '#a78bfa', text: '#f2f2f7', muted: '#7d7d8a', onAccent: '#ffffff',
    colors: { I: '#4dd8e8', O: '#f7d154', T: '#b57bee', S: '#6bd67f', Z: '#f2677a', J: '#5b8def', L: '#f59b4b' } },
};

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
const el = {
  score: $('score'),
  l: [$('l1'), $('l2'), $('l3')], v: [$('v1'), $('v2'), $('v3')],
  overlay: $('overlay'), ovTitle: $('ovTitle'), ovText: $('ovText'), ovBtn: $('ovBtn'), ovBtn2: $('ovBtn2'), ovBtn3: $('ovBtn3'),
};

// ---------- storage ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
const settings = Object.assign({ ghost: true, haptics: true, longPress: true, sens: 1, difficulty: 1, theme: 'aurora' }, store.get('tetris.settings', {}));
if (!THEMES[settings.theme]) settings.theme = 'aurora';
settings.difficulty = Math.max(0, Math.min(DIFFS.length - 1, settings.difficulty | 0));
const saveSettings = () => store.set('tetris.settings', settings);

const db = store.get('tetris.db', null) || { classic: DIFFS.map(() => []), sprint: [], zen: [], stats: { games: 0, lines: 0, time: 0, pieces: 0 } };
if (!Array.isArray(db.classic[0])) db.classic = DIFFS.map(() => []);
{ // carry over the single best score saved by the first version
  const old = +store.get('tetris.best', 0);
  if (old > 0 && db.classic.every(l => !l.length)) db.classic[1].push({ score: old, lines: 0, level: 1, date: Date.now() });
}
const saveDb = () => store.set('tetris.db', db);

// ---------- state ----------
let theme = THEMES.aurora, COLORS = theme.colors;
let mode = 'classic';
let state = 'menu'; // menu | countdown | playing | slamming | paused | clearing | over
let board, piece, queue, holdType, canHold;
let score = 0, shown = 0, lines = 0, level = 1, pieces = 0, playTime = 0, combo = -1, b2b = false, sprintTime = 0, countdown = 0;
let dropAcc = 0, lockT = 0, lockResets = 0, clearRows = null, clearT = 0, clearDur = 340;
let slam = null, shake = 0, flash = null, jolt = 0;
let particles = [], popup = null, banner = null;
let cell = 24, PAD = 4, lastMain = '';

// ---------- helpers ----------
const fmt = n => Math.round(n).toLocaleString('en-US');
const pad = (n, w = 2) => String(n).padStart(w, '0');
const fmtTime = ms => `${Math.floor(ms / 60000)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(Math.floor(ms % 1000 / 10))}`;
const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const rotateM = (m, dir) => {
  const n = m.length;
  return m.map((_, r) => m.map((_, c) => dir > 0 ? m[n - 1 - c][r] : m[c][n - 1 - r]));
};
const vibrate = ms => { if (!settings.haptics) return; try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
const freshBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));
const bestClassic = () => (db.classic[settings.difficulty][0] || {}).score || 0;
const bestSprint = () => (db.sprint[0] || {}).time;
const bestZen = () => (db.zen[0] || {}).score || 0;

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

function wipeBoard() {
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (!board[y][x]) continue;
    particles.push({ x: x + 0.5, y: y + 0.5, vx: (Math.random() - 0.5) * 8, vy: -Math.random() * 6, life: 0, max: 700 + Math.random() * 500, size: 0.12 + Math.random() * 0.14, delay: 0, color: COLORS[board[y][x]] });
  }
  board = freshBoard();
  popup = { text: 'FRESH START', sub: '', tag: '', t: 0, dur: 1100, big: false, y: ROWS / 2 };
  jolt = 0.5;
}

function spawn(t) {
  if (!t) { refillQueue(); t = queue.shift(); refillQueue(); pieces++; }
  piece = makePiece(t);
  dropAcc = 0; lockT = 0; lockResets = 0;
  if (collides(piece.m, piece.x, piece.y)) {
    if (mode === 'zen') { wipeBoard(); piece = makePiece(t); } else gameOver();
  }
}

// speed level: smooth, grows with lines AND time; the difficulty sets how fast
const speedL = () => { const d = DIFFS[settings.difficulty]; return lines / d.perLines + playTime / d.perMs; };
function gravityMs() {
  if (mode === 'sprint') return 700;
  if (mode === 'zen') return 1100;
  const L = speedL();
  return Math.max(16, Math.pow(Math.max(0.05, 0.8 - L * 0.007), L) * 1000);
}

// ---------- game flow ----------
function newGame(m) {
  mode = m;
  board = freshBoard();
  queue = []; holdType = null; canHold = true;
  score = 0; shown = 0; lines = 0; level = 1; pieces = 0; playTime = 0; combo = -1; b2b = false; sprintTime = 0;
  clearRows = null; slam = null; shake = 0; flash = null; particles = []; popup = null; banner = null; jolt = 0;
  lastMain = '';
  spawn();
  countdown = COUNT_STEP * 3;
  state = 'countdown';
  hideOverlay();
  updateHud();
}

function showMenu() {
  state = 'menu';
  hideOverlay();
  ['settings', 'records'].forEach(id => $(id).classList.add('hidden'));
  refreshMenu();
  $('menu').classList.remove('hidden');
}

function startMode(m) { $('menu').classList.add('hidden'); newGame(m); }

function addRecord(m, entry, list) {
  list.push(entry);
  list.sort(m === 'sprint' ? (a, b) => a.time - b.time : (a, b) => b.score - a.score);
  list.length = Math.min(list.length, 10);
  return list.indexOf(entry);
}

function gameOver() { endGame(mode === 'sprint' && lines >= SPRINT_GOAL ? 'complete' : 'over'); }

function endGame(kind) {
  state = 'over'; slam = null;
  db.stats.games++; db.stats.lines += lines; db.stats.time += playTime; db.stats.pieces += pieces;
  const date = Date.now();
  let title = 'GAME OVER', text = '', rank = -1;
  if (mode === 'classic') {
    rank = addRecord('classic', { score, lines, level, date }, db.classic[settings.difficulty]);
    text = `${DIFFS[settings.difficulty].name}\nScore ${fmt(score)}\nLines ${lines} · Level ${level}`;
  } else if (mode === 'sprint') {
    if (kind === 'complete') {
      title = 'COMPLETE';
      rank = addRecord('sprint', { time: sprintTime, lines, date }, db.sprint);
      text = `Time ${fmtTime(sprintTime)}\n${pieces} pieces`;
    } else text = `Lines ${lines} / ${SPRINT_GOAL}`;
  } else {
    title = 'DONE';
    if (score > 0) rank = addRecord('zen', { score, lines, time: playTime, date }, db.zen);
    text = `Score ${fmt(score)}\nLines ${lines} · ${fmtTime(playTime)}`;
  }
  if (rank === 0) text += '\n★ NEW RECORD ★'; else if (rank > 0) text += `\nRank #${rank + 1}`;
  saveDb();
  updateHud();
  vibrate(kind === 'complete' ? [40, 30, 40, 30, 120] : [60, 40, 120]);
  showOverlay(title, text, 'AGAIN');
}

function pause() { if (state === 'playing') { state = 'paused'; showOverlay('PAUSED', '', 'RESUME', mode === 'zen'); } }
function resume() { if (state === 'paused') { state = 'playing'; hideOverlay(); } }

function showOverlay(title, text, btn, showFinish) {
  el.ovTitle.textContent = title; el.ovText.textContent = text; el.ovBtn.textContent = btn;
  el.ovBtn3.classList.toggle('hidden', !showFinish);
  el.overlay.classList.remove('hidden');
}
function hideOverlay() { el.overlay.classList.add('hidden'); }

function updateHud() {
  const set = (i, l, v) => { el.l[i].textContent = l; el.v[i].textContent = v; };
  if (mode === 'classic') {
    set(0, 'LV', level); set(1, 'LINES', lines); set(2, 'BEST', fmt(Math.max(bestClassic(), score)));
  } else if (mode === 'sprint') {
    set(0, 'LINES', `${Math.min(lines, SPRINT_GOAL)}/${SPRINT_GOAL}`); set(1, 'PIECES', pieces);
    set(2, 'BEST', bestSprint() ? fmtTime(bestSprint()) : '—');
  } else {
    set(0, 'LINES', lines); set(1, 'PIECES', pieces); set(2, 'BEST', fmt(Math.max(bestZen(), score)));
  }
}

function refreshMain() {
  let s;
  if (mode === 'sprint') s = fmtTime(state === 'over' && sprintTime ? sprintTime : playTime);
  else {
    if (shown < score) shown = Math.min(score, shown + Math.max(1, Math.ceil((score - shown) * 0.2)));
    s = fmt(shown);
  }
  if (s !== lastMain) { el.score.textContent = s; lastMain = s; }
}

function refreshMenu() {
  $('bestClassic').textContent = fmt(bestClassic());
  $('diffTag').textContent = DIFFS[settings.difficulty].name;
  $('bestSprint').textContent = bestSprint() ? fmtTime(bestSprint()) : '—';
  $('bestZen').textContent = fmt(bestZen());
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
  piece.y++; score += 1; dropAcc = 0; return true;
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
  if (overTop) {
    if (mode !== 'zen') { gameOver(); return; }
    wipeBoard(); combo = -1; canHold = true; spawn(); return;
  }

  const full = [];
  for (let y = 0; y < ROWS; y++) if (board[y].every(Boolean)) full.push(y);
  canHold = true;

  if (!full.length) { combo = -1; vibrate(8); spawn(); return; }

  const n = full.length;
  combo++;
  let gain = [0, 100, 300, 500, 800][n] * level, tag = '';
  if (n === 4) { if (b2b) { gain = Math.round(gain * 1.5); tag = 'BACK-TO-BACK'; } b2b = true; } else b2b = false;
  if (combo > 0) { gain += 50 * combo * level; tag = (tag ? tag + ' · ' : '') + `COMBO ×${combo}`; }
  let name = CLEAR_NAMES[n];
  if (!board.some((row, y) => !full.includes(y) && row.some(Boolean))) { gain += 1000 * level; name = 'PERFECT CLEAR'; }
  score += gain;
  lines += n;
  if (mode === 'sprint' && lines >= SPRINT_GOAL) sprintTime = playTime;
  updateHud();
  clearRows = full; clearDur = clearT = CLEAR_TIMES[n]; state = 'clearing';
  piece = null;
  startClearFx(full, n, gain, name, tag);
  vibrate(n === 4 || name === 'PERFECT CLEAR' ? [40, 30, 40, 30, 120] : n === 1 ? 25 : [30, 20, 50]);
}

function startClearFx(rows, n, gain, name, tag) {
  jolt = [0, 0.25, 0.5, 0.85, 1.6][n];
  const big = n === 4 || name === 'PERFECT CLEAR';
  const per = big ? 6 : 2 + n;
  for (const y of rows) for (let x = 0; x < COLS; x++) {
    const t = board[y][x];
    for (let i = 0; i < per; i++) {
      particles.push({
        x: x + 0.5, y: y + 0.5,
        vx: (Math.random() - 0.5) * (7 + n * 2.5), vy: -(Math.random() * 5 + 2) * (1 + n * 0.12),
        life: 0, max: 600 + Math.random() * 600, size: 0.08 + Math.random() * 0.15,
        delay: (x / COLS) * 0.5 * clearDur, color: big && i % 2 ? '#ffffff' : COLORS[t],
      });
    }
  }
  popup = { text: name, sub: '+' + fmt(gain), tag, t: 0, dur: big ? 1400 : 1000, big, y: rows.reduce((a, b) => a + b, 0) / n };
}

function finishClear() {
  board = board.filter((_, y) => !clearRows.includes(y));
  while (board.length < ROWS) board.unshift(Array(COLS).fill(null));
  clearRows = null;
  state = 'playing';
  if (mode === 'sprint' && lines >= SPRINT_GOAL) { endGame('complete'); return; }
  spawn();
}

// ---------- update ----------
function update(dt) {
  if (shake > 0) shake = Math.max(0, shake - dt / 160);
  if (flash && (flash.t += dt) > SLAM_FLASH) flash = null;
  if (jolt > 0) jolt = Math.max(0, jolt - dt / 450);
  if (popup && (popup.t += dt) > popup.dur) popup = null;
  if (banner && (banner.t += dt) > banner.dur) banner = null;
  if (particles.length) {
    const s = dt / 1000;
    particles = particles.filter(p => {
      if (p.delay > 0) { p.delay -= dt; return true; }
      p.life += dt; p.vy += 22 * s; p.x += p.vx * s; p.y += p.vy * s;
      return p.life < p.max;
    });
  }

  if (state === 'countdown') {
    countdown -= dt;
    if (countdown <= 0) { state = 'playing'; vibrate(20); }
    return;
  }
  if (state === 'playing' || state === 'slamming' || state === 'clearing') {
    playTime += dt;
    if (mode === 'classic') {
      const nl = Math.floor(speedL()) + 1;
      if (nl > level) { level = nl; banner = { text: 'LEVEL ' + nl, t: 0, dur: 1500 }; vibrate(15); updateHud(); }
    }
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
  ctx.globalAlpha = alpha;
  if (theme.style === 'flat') {
    const q = s * 0.06, w = s - q * 2, b = s * 0.14;
    ctx.fillStyle = color; ctx.fillRect(x + q, y + q, w, w);
    ctx.fillStyle = shade(color, 0.4); ctx.fillRect(x + q, y + q, w, b); ctx.fillRect(x + q, y + q, b, w);
    ctx.fillStyle = shade(color, -0.35); ctx.fillRect(x + q, y + q + w - b, w, b); ctx.fillRect(x + q + w - b, y + q, b, w);
    ctx.globalAlpha = 1;
    return;
  }
  const p = Math.max(1, s * 0.05), w = s - p * 2, rad = s * 0.22;
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
  ctx.strokeStyle = color; ctx.globalAlpha = 0.5; ctx.lineWidth = Math.max(1.5, s * 0.07);
  rr(ctx, x + p, y + p, s - p * 2, s - p * 2, theme.style === 'flat' ? 1 : s * 0.22); ctx.stroke();
  ctx.fillStyle = color; ctx.globalAlpha = 0.09; ctx.fill();
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
  cell = Math.max(10, Math.floor(Math.min((st.width - 12) / COLS, (st.height - 12) / ROWS)));
  PAD = Math.max(4, Math.round(cell * 0.16));
  const CW = cell * COLS + PAD * 2, CH = cell * ROWS + PAD * 2;
  sizeCanvas(boardCv, CW, CH);
  const o = el.overlay.style;
  o.width = CW + 'px'; o.height = CH + 'px'; o.setProperty('--cell', cell + 'px');
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
  for (let i = 0; i < 3 && queue && queue[i]; i++) drawMini(nc, queue[i], i * (140 / 3), 140 / 3, 44, false);
}

function drawWell(ctx, W, H) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, theme.well1); bg.addColorStop(1, theme.well2);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let x = 1; x < COLS; x += 2) ctx.fillRect(x * cell, 0, cell, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.075)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < COLS; x++) { ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, H); }
  for (let y = 1; y < ROWS; y++) { ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(W, y * cell + 0.5); }
  ctx.stroke();
}

function drawWall(ctx, W, H) {
  ctx.strokeStyle = theme.accent; ctx.lineWidth = PAD; ctx.globalAlpha = 0.95;
  rr(ctx, PAD / 2, PAD / 2, W - PAD, H - PAD, 6); ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawGlow(ctx, W, H) {
  for (const left of [true, false]) {
    const x0 = left ? 0 : W, x1 = left ? cell * 0.7 : W - cell * 0.7;
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, theme.accent + '55'); g.addColorStop(1, theme.accent + '00');
    ctx.fillStyle = g; ctx.fillRect(left ? 0 : W - cell * 0.7, 0, cell * 0.7, H);
  }
  const fl = ctx.createLinearGradient(0, H - cell * 0.8, 0, H);
  fl.addColorStop(0, theme.accent + '00'); fl.addColorStop(1, theme.accent + '40');
  ctx.fillStyle = fl; ctx.fillRect(0, H - cell * 0.8, W, cell * 0.8);
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

function glowText(ctx, text, x, y, size, fill, glow) {
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = Math.round(size * 0.08) + 'px';
  ctx.shadowColor = glow; ctx.shadowBlur = size * 0.5;
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

function drawPopup(ctx, W, H) {
  if (!popup) return;
  const p = popup.t / popup.dur, u = Math.min(1, p / 0.18) - 1;
  const pop = p < 0.18 ? 1 + 2.70158 * u * u * u + 1.70158 * u * u : 1;
  const a = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
  const y = Math.max(cell * 3, Math.min(H * 0.55, popup.y * cell)) - p * cell * 1.5;
  ctx.save();
  ctx.translate(W / 2, y); ctx.scale(pop, pop);
  ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let off = 0;
  if (popup.text) {
    const size = cell * (popup.big ? 1.7 : 1.25);
    let fill = '#fff';
    if (popup.big) {
      const g = ctx.createLinearGradient(-W * 0.4, 0, W * 0.4, 0);
      [COLORS.I, COLORS.T, COLORS.Z, COLORS.O].forEach((c, i) => g.addColorStop(i / 3, c));
      fill = g;
    }
    glowText(ctx, popup.text, 0, 0, size, fill, theme.accent);
    off = size * 0.85;
  }
  if (popup.sub) {
    ctx.font = `700 ${cell * 0.7}px system-ui, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fillText(popup.sub, 0, off);
    off += cell * 0.8;
  }
  if (popup.tag) {
    ctx.font = `700 ${cell * 0.46}px system-ui, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    ctx.fillStyle = theme.accent; ctx.fillText(popup.tag, 0, off);
  }
  ctx.restore();
}

function drawBanner(ctx, W) {
  if (!banner) return;
  const p = banner.t / banner.dur;
  const a = p < 0.15 ? p / 0.15 : p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
  ctx.save();
  ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  glowText(ctx, banner.text, W / 2, cell * 2 + p * cell * 0.8, cell * 0.95, '#fff', theme.accent);
  ctx.restore();
}

function drawCountdown(ctx, W, H) {
  const n = Math.ceil(countdown / COUNT_STEP);
  const u = 1 - (countdown - (n - 1) * COUNT_STEP) / COUNT_STEP;
  const sc = 1.5 - 0.5 * Math.min(1, u * 3);
  ctx.save();
  ctx.translate(W / 2, H * 0.42); ctx.scale(sc, sc);
  ctx.globalAlpha = 1 - u * 0.7; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  glowText(ctx, String(n), 0, 0, cell * 3.4, '#fff', theme.accent);
  ctx.restore();
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${cell * 0.5}px system-ui, sans-serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(mode === 'sprint' ? 'CLEAR 40 LINES' : mode === 'zen' ? 'JUST FLOW' : DIFFS[settings.difficulty].name, W / 2, H * 0.42 + cell * 2.6);
  ctx.restore();
}

function render() {
  const ctx = bctx, W = cell * COLS, H = cell * ROWS, CW = W + PAD * 2, CH = H + PAD * 2;
  ctx.fillStyle = theme.well2; ctx.fillRect(0, 0, CW, CH);
  ctx.save();
  ctx.translate(PAD, PAD);
  drawWell(ctx, W, H);
  if (!board) { drawGlow(ctx, W, H); ctx.restore(); drawWall(ctx, CW, CH); return; }

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

  drawGlow(ctx, W, H);
  drawPopup(ctx, W, H);
  drawBanner(ctx, W);
  if (state === 'countdown') drawCountdown(ctx, W, H);
  ctx.restore();
  drawWall(ctx, CW, CH);
  renderSide();
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(100, now - last); last = now;
  update(dt);
  refreshMain();
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
  if (k === 'Enter' && state === 'menu') { startMode('classic'); return; }
  if (k === 'Enter' && state === 'over') { newGame(mode); return; }
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

// ---------- theme ----------
function applyTheme(id) {
  theme = THEMES[id] || THEMES.aurora; COLORS = theme.colors;
  const r = document.documentElement.style;
  r.setProperty('--bg1', theme.bg1); r.setProperty('--bg2', theme.bg2);
  r.setProperty('--accent', theme.accent); r.setProperty('--accent2', theme.accent2);
  r.setProperty('--text', theme.text); r.setProperty('--muted', theme.muted); r.setProperty('--on-accent', theme.onAccent);
  r.setProperty('--c1', COLORS.I); r.setProperty('--c2', COLORS.T); r.setProperty('--c3', COLORS.Z);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = theme.bg2;
  const order = ['Z', 'L', 'O', 'S', 'I', 'T'];
  document.querySelectorAll('.logo span').forEach((s, i) => s.style.setProperty('--c', COLORS[order[i]]));
}

// ---------- settings / records ui ----------
function renderSettings() {
  document.querySelectorAll('.switch').forEach(b => b.classList.toggle('on', !!settings[b.dataset.key]));
  document.querySelectorAll('#sensSeg button').forEach(b => b.classList.toggle('on', +b.dataset.v === settings.sens));
  document.querySelectorAll('#diffSeg button').forEach(b => b.classList.toggle('on', +b.dataset.v === settings.difficulty));
  $('diffDesc').textContent = DIFFS[settings.difficulty].desc;
  document.querySelectorAll('.theme').forEach(b => b.classList.toggle('on', b.dataset.id === settings.theme));
}

function buildSettings() {
  const seg = $('diffSeg');
  DIFFS.forEach((d, i) => {
    const b = document.createElement('button');
    b.dataset.v = i; b.textContent = d.name[0] + d.name.slice(1).toLowerCase();
    b.addEventListener('click', () => { settings.difficulty = i; saveSettings(); renderSettings(); });
    seg.appendChild(b);
  });
  const grid = $('themeGrid');
  Object.entries(THEMES).forEach(([id, t]) => {
    const b = document.createElement('button');
    b.className = 'theme'; b.dataset.id = id;
    b.style.background = `linear-gradient(160deg, ${t.bg1}, ${t.bg2})`;
    b.innerHTML = `<div class="dots">${Object.values(t.colors).map(c => `<i style="background:${c}"></i>`).join('')}</div><span>${t.name}</span>`;
    b.addEventListener('click', () => { settings.theme = id; saveSettings(); applyTheme(id); renderSettings(); });
    grid.appendChild(b);
  });
}

let recMode = 'classic', recDiff = 1;
function renderRecords() {
  document.querySelectorAll('#recTabs button').forEach(b => b.classList.toggle('on', b.dataset.m === recMode));
  const chips = $('recDiffs');
  chips.innerHTML = '';
  if (recMode === 'classic') {
    DIFFS.forEach((d, i) => {
      const b = document.createElement('button');
      b.textContent = d.name; b.className = i === recDiff ? 'on' : '';
      b.addEventListener('click', () => { recDiff = i; renderRecords(); });
      chips.appendChild(b);
    });
  }
  const list = recMode === 'classic' ? db.classic[recDiff] : db[recMode];
  const box = $('recList');
  if (!list.length) {
    box.innerHTML = '<div class="empty">No records yet — go set one!</div>';
  } else {
    box.innerHTML = list.map((r, i) => {
      const main = recMode === 'sprint' ? fmtTime(r.time) : fmt(r.score);
      const det = recMode === 'classic' ? `${r.lines} lines · LV ${r.level}` : recMode === 'zen' ? `${r.lines} lines` : `${r.lines} lines`;
      return `<div class="rec"><span class="rk">${i + 1}</span><span class="rv">${main}</span><span class="rd">${det}<br>${fmtDate(r.date)}</span></div>`;
    }).join('');
  }
  const s = db.stats, mins = Math.floor(s.time / 60000);
  $('recStats').innerHTML = [[s.games, 'GAMES'], [s.lines, 'LINES'], [s.pieces, 'PIECES'], [mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`, 'PLAYED']]
    .map(([v, l]) => `<div><b>${v}</b>${l}</div>`).join('');
}

// ---------- ui wiring ----------
el.ovBtn.addEventListener('click', () => (state === 'paused' ? resume() : newGame(mode)));
el.ovBtn2.addEventListener('click', showMenu);
el.ovBtn3.addEventListener('click', () => endGame('finish'));
$('playClassic').addEventListener('click', () => startMode('classic'));
$('playSprint').addEventListener('click', () => startMode('sprint'));
$('playZen').addEventListener('click', () => startMode('zen'));
$('openSettings').addEventListener('click', () => { renderSettings(); $('settings').classList.remove('hidden'); });
$('setBack').addEventListener('click', () => { $('settings').classList.add('hidden'); refreshMenu(); });
$('openRecords').addEventListener('click', () => { recDiff = settings.difficulty; renderRecords(); $('records').classList.remove('hidden'); });
$('recBack').addEventListener('click', () => $('records').classList.add('hidden'));
document.querySelectorAll('#recTabs button').forEach(b => b.addEventListener('click', () => { recMode = b.dataset.m; renderRecords(); }));
document.querySelectorAll('.switch').forEach(b => b.addEventListener('click', () => {
  settings[b.dataset.key] = !settings[b.dataset.key]; saveSettings(); renderSettings();
  if (b.dataset.key === 'haptics' && settings.haptics) vibrate(20);
}));
document.querySelectorAll('#sensSeg button').forEach(b => b.addEventListener('click', () => { settings.sens = +b.dataset.v; saveSettings(); renderSettings(); }));
$('pauseBtn').addEventListener('click', () => (state === 'paused' ? resume() : pause()));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('resize', layout);

applyTheme(settings.theme);
buildSettings();
renderSettings();
refreshMenu();
layout();
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
})();
