// Canvas ve UI öğeleri
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const coinsEl = document.getElementById("coins");
const finalScoreEl = document.getElementById("finalScore");
const finalCoinsEl = document.getElementById("finalCoins");
const overlayGameOver = document.getElementById("gameOver");
const overlayStart = document.getElementById("startOverlay");
const overlayLanding = document.getElementById("landing");
const overlayLeaderboard = document.getElementById("leaderboard");
const overlayPause = document.getElementById("pauseOverlay");
const overlayName = document.getElementById("nameModal");
const btnRestart = document.getElementById("btnRestart");
const btnRestart2 = document.getElementById("btnRestart2");
const btnStart = document.getElementById("btnStart");
const btnPlay = document.getElementById("btnPlay");
const btnJump = document.getElementById("btnJump");
const btnPause = document.getElementById("btnPause");
const btnLeaderboard = document.getElementById("btnLeaderboard");
const btnLeaderboard2 = document.getElementById("btnLeaderboard2");
const btnLbClose = document.getElementById("btnLbClose");
const lbBody = document.getElementById("lbBody");
const btnResume = document.getElementById("btnResume");
const btnNameSave = document.getElementById("btnNameSave");
const btnNameCancel = document.getElementById("btnNameCancel");
const nameInput = document.getElementById("nameInput");

// Boyutlar ve fizik
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GROUND_Y = HEIGHT - 80;
const GRAVITY = 0.8;
const JUMP_VELOCITY = -14;

// Hız ve zorluk (zamanla artar)
const BASE_SPEED = 6;
let speedMultiplier = 1;           // 1.0 → 2.2 arası
let difficultyTimeMs = 0;          // toplam geçen süre

// Sabit karakter sprite
const playerImage = new Image();
let spriteReady = false;
playerImage.onload = () => (spriteReady = true);
// kendi görselini bu yola koy: assets/character.png
playerImage.src = "assets/character.png";

// Fallback çizim (sprite gelmeden önce)
function drawFallbackPlayer(x, y, size) {
  ctx.fillStyle = "#222";
  ctx.fillRect(x - size * 0.3, y - size, size * 0.6, size);
  ctx.fillStyle = "#ffd166";
  ctx.beginPath(); ctx.arc(x, y - size * 0.7, size * 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ef233c";
  ctx.fillRect(x - size * 0.35, y - size * 0.25, size * 0.7, size * 0.28);
}

// Oyuncu ve dünya
const player = { x: 140, y: GROUND_Y, vy: 0, size: 56, onGround: true, dead: false };
let groundOffset = 0;
let score = 0;
let coins = 0;
let isPaused = true;
let hasStarted = false;

const obstacles = []; // {x,y,w,h}
const coinItems = []; // {x,y,r,collected}
const popups = [];    // {x,y,ttl,text}
const sparks = [];    // {x,y,vx,vy,ttl}
const rings = [];     // {x,y,r,vr,ttl}

// Yardımcılar
const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Spawner zamanlayıcıları
let spawnTimer = 0;
let coinTimer = 0;

// Kontroller
function jump() {
  if (!hasStarted || isPaused || player.dead) return;
  if (player.onGround) {
    player.vy = JUMP_VELOCITY;
    player.onGround = false;
  }
}
btnJump.addEventListener("click", jump);
btnPause.addEventListener("click", togglePause);
btnRestart.addEventListener("click", restart);
btnRestart2.addEventListener("click", restart);
btnStart.addEventListener("click", startGame);
btnPlay.addEventListener("click", openStart);
btnLeaderboard.addEventListener("click", openLeaderboard);
btnLeaderboard2?.addEventListener("click", openLeaderboard);
btnLbClose.addEventListener("click", closeLeaderboard);
btnResume?.addEventListener("click", () => { if (isPaused) togglePause(); });
btnNameCancel?.addEventListener("click", () => overlayName.classList.add("hidden"));
btnNameSave?.addEventListener("click", commitSaveScore);
nameInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") commitSaveScore(); });

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); if (!hasStarted) startGame(); else jump(); }
  if (e.code === "KeyP") togglePause();
  if (player.dead && (e.code === "Enter" || e.code === "Space")) restart();
});
canvas.addEventListener("pointerdown", () => { if (!hasStarted) startGame(); else jump(); });

function startGame() {
  hasStarted = true;
  isPaused = false;
  overlayStart.classList.add("hidden");
  overlayLanding.classList.add("hidden");
  overlayPause?.classList.add("hidden");
}
function openStart() {
  overlayStart.classList.remove("hidden");
  overlayLanding.classList.add("hidden");
}
function openLeaderboard() {
  renderLeaderboard();
  overlayLeaderboard.classList.remove("hidden");
}
function closeLeaderboard() {
  overlayLeaderboard.classList.add("hidden");
}
function togglePause() {
  if (!hasStarted || player.dead) return;
  isPaused = !isPaused;
  btnPause.textContent = isPaused ? "Resume" : "Pause";
  if (isPaused && hasStarted && !player.dead) overlayPause?.classList.remove("hidden"); else overlayPause?.classList.add("hidden");
}
function restart() {
  score = 0; coins = 0;
  player.y = GROUND_Y; player.vy = 0; player.onGround = true; player.dead = false;
  obstacles.length = 0; coinItems.length = 0; popups.length = 0; sparks.length = 0; rings.length = 0;
  groundOffset = 0; spawnTimer = 0; coinTimer = 0;
  speedMultiplier = 1; difficultyTimeMs = 0;
  isPaused = false; hasStarted = true;
  overlayGameOver.classList.add("hidden");
  overlayPause?.classList.add("hidden");
  btnPause.textContent = "Pause";
}

// Efektler
function onCollectAura(cx, cy) {
  popups.push({ x: cx, y: cy - 10, ttl: 600, text: "+1 AURA" });
  for (let i = 0; i < 12; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 1.5 + Math.random() * 2.0;
    sparks.push({ x: cx, y: cy, vx: Math.cos(ang)*sp, vy: Math.sin(ang)*sp - 1, ttl: 500 + Math.random()*300 });
  }
}
function updateFx(dt) {
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i]; p.ttl -= dt; p.y -= 0.03 * dt;
    if (p.ttl <= 0) popups.splice(i, 1);
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]; s.ttl -= dt; s.x += s.vx; s.y += s.vy; s.vy += 0.02;
    if (s.ttl <= 0) sparks.splice(i, 1);
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]; r.ttl -= dt; r.r += r.vr * (dt * 0.6);
    if (r.ttl <= 0) rings.splice(i, 1);
  }
}

// Çizimler
function drawAuraBubble(x, y, r) {
  const grd = ctx.createRadialGradient(x - r*0.3, y - r*0.4, 2, x, y, r);
  grd.addColorStop(0, "#d8b4fe");
  grd.addColorStop(1, "#7c3aed");
  ctx.fillStyle = grd;
  ctx.shadowColor = "#a78bfa";
  ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = "#ffffffaa";
  ctx.beginPath(); ctx.ellipse(x - r*0.3, y - r*0.4, r*0.35, r*0.22, -0.5, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff";
  ctx.font = "bold 10px Nunito, system-ui";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("AURA", x, y);
}
function drawCoins() { coinItems.forEach(c => { if (!c.collected) drawAuraBubble(c.x, c.y, c.r); }); }
function drawObstacles() { ctx.fillStyle = "#1f2937"; obstacles.forEach(o => ctx.fillRect(o.x, o.y, o.w, o.h)); }
function drawPlayer() {
  const { x, y, size } = player;
  if (spriteReady) {
    const aspect = playerImage.width / playerImage.height || 1;
    const w = size * 0.95, h = w / aspect;
    ctx.drawImage(playerImage, x - w / 2, y - h, w, h);
  } else {
    drawFallbackPlayer(x, y, size);
  }
}
function drawBackground() {
  // Uzak bulutlar
  ctx.fillStyle = "#ffffff22";
  for (let i = 0; i < 6; i++) {
    const x = ((i * 260 - (groundOffset * 0.25)) % (WIDTH + 260)) - 130;
    ctx.beginPath(); ctx.arc(x + 80, 100, 24, 0, Math.PI*2);
    ctx.arc(x + 120, 110, 34, 0, Math.PI*2);
    ctx.arc(x + 160, 100, 24, 0, Math.PI*2); ctx.fill();
  }
  // Orta bulutlar
  ctx.fillStyle = "#ffffff44";
  for (let i = 0; i < 6; i++) {
    const x = ((i * 220 - (groundOffset * 0.5)) % (WIDTH + 220)) - 110;
    ctx.beginPath(); ctx.arc(x + 80, 140, 30, 0, Math.PI*2);
    ctx.arc(x + 120, 150, 40, 0, Math.PI*2);
    ctx.arc(x + 160, 140, 30, 0, Math.PI*2); ctx.fill();
  }
  // Gökyüzü yazıları: "Common Lamumu"
  ctx.save();
  ctx.fillStyle = "#ffffff33"; // daha belirgin
  ctx.strokeStyle = "#ffffff4a";
  ctx.lineWidth = 2;
  ctx.shadowColor = "#00000055";
  ctx.shadowBlur = 6;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 56px Nunito, system-ui";
  for (let i = 0; i < 6; i++) {
    const baseX = ((i * 300 - (groundOffset * 0.2)) % (WIDTH + 300)) - 150;
    const y1 = 60, y2 = 110;
    ctx.save();
    ctx.translate(baseX + 120, y1);
    ctx.rotate(-0.06);
    ctx.fillText("Common Lamumu", 0, 0);
    ctx.strokeText("Common Lamumu", 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(baseX + 260, y2);
    ctx.rotate(0.05);
    ctx.fillText("Common Lamumu", 0, 0);
    ctx.strokeText("Common Lamumu", 0, 0);
    ctx.restore();
  }
  ctx.restore();
  // Zemin
  ctx.fillStyle = "#4d7c0f"; ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
  // Yol şeritleri
  ctx.fillStyle = "#3f6212";
  for (let i = 0; i < 20; i++) {
    const x = ((i * 80 - groundOffset) % (WIDTH + 80)) - 40;
    ctx.fillRect(x, GROUND_Y - 8, 50, 6);
  }
}
function drawFx() {
  ctx.save();
  popups.forEach(p => {
    const a = clamp(p.ttl / 600, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = "#fff";
    ctx.font = "800 14px Nunito, system-ui";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(p.text, p.x, p.y);
  });
  sparks.forEach(s => {
    const a = clamp(s.ttl / 500, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = "#e9d5ff";
    ctx.beginPath(); ctx.arc(s.x, s.y, 2, 0, Math.PI*2); ctx.fill();
  });
  rings.forEach(r => {
    const a = clamp(r.ttl / 400, 0, 1) * 0.9;
    ctx.globalAlpha = a;
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.stroke();
  });
  ctx.restore();
}

// Çarpışma ve yardımcı
const rectsOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Oyun döngüsü
let last = 0;
function update(dt) {
  if (!hasStarted || isPaused || player.dead) return;

  // Zorluk zamanlayıcıları
  difficultyTimeMs += dt;
  // 0–2 dakikada hız çarpanı 1 → 2.2
  speedMultiplier = clamp(1 + (difficultyTimeMs / 120000) * 1.2, 1, 2.2);
  const SPEED = BASE_SPEED * speedMultiplier;

  // Skor
  score += dt * 0.06 * speedMultiplier;
  scoreEl.textContent = Math.floor(score).toString();
  coinsEl.textContent = coins.toString();

  // Zemin akışı
  groundOffset += SPEED;

  // Fizik
  player.vy += GRAVITY;
  player.y += player.vy;
  if (player.y >= GROUND_Y) { player.y = GROUND_Y; player.vy = 0; player.onGround = true; }

  // Spawner (zorluk arttıkça daha sık ve daha geniş engeller)
  spawnTimer -= dt; coinTimer -= dt;
  if (spawnTimer <= 0) {
    const h = rand(30, 70 + 20 * (speedMultiplier - 1));          // yükseklik artabilir
    const w = rand(26, 44 + 10 * (speedMultiplier - 1));          // genişlik artabilir
    obstacles.push({ x: WIDTH + 40, y: GROUND_Y - h, w, h });
    const base = rand(900, 1300);
    const scaled = base / speedMultiplier;                        // hız arttıkça daha sık
    spawnTimer = clamp(scaled, 450, 1300);
  }
  if (coinTimer <= 0) {
    const y = GROUND_Y - rand(40, 140);
    const count = Math.floor(rand(2, 5));
    for (let i = 0; i < count; i++) coinItems.push({ x: WIDTH + 40 + i * 26, y, r: 9, collected: false });
    const base = rand(700, 1200);
    coinTimer = clamp(base / speedMultiplier, 400, 1200);
  }

  // Hareket ve temizleme
  obstacles.forEach(o => o.x -= SPEED);
  while (obstacles.length && obstacles[0].x + obstacles[0].w < -10) obstacles.shift();
  coinItems.forEach(c => c.x -= SPEED);
  while (coinItems.length && coinItems[0].x + coinItems[0].r < -10) coinItems.shift();

  // Çarpışma
  const playerBox = { x: player.x - player.size * 0.25, y: player.y - player.size * 0.9, w: player.size * 0.5, h: player.size * 0.9 };
  for (const o of obstacles) {
    if (rectsOverlap(playerBox, o)) {
      player.dead = true;
      finalScoreEl.textContent = Math.floor(score).toString();
      finalCoinsEl.textContent = coins.toString();
      overlayGameOver.classList.remove("hidden");
      openNameModal(Math.floor(score), coins);
      isPaused = true;
      break;
    }
  }
  // AURA toplama
  coinItems.forEach(c => {
    if (!c.collected) {
      const dx = Math.abs(c.x - (playerBox.x + playerBox.w / 2));
      const dy = Math.abs(c.y - (playerBox.y + playerBox.h / 2));
      if (dx < playerBox.w * 0.55 && dy < playerBox.h * 0.55) {
        c.collected = true;
        coins += 1;
        score += 10;
        onCollectAura(c.x, c.y);
        rings.push({ x: c.x, y: c.y, r: 6, vr: 0.5, ttl: 400 });
      }
    }
  });

  updateFx(dt);
}
function render() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawBackground();
  drawObstacles();
  drawCoins();
  drawPlayer();
  drawFx();
}
function loop(ts) {
  const dt = Math.min(50, ts - last || 16.6);
  last = ts;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Leaderboard: localStorage
const LB_KEY = "lamumu_runner_lb_v1";
function getLeaderboard() {
  try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; } catch { return []; }
}
function setLeaderboard(items) {
  try { localStorage.setItem(LB_KEY, JSON.stringify(items)); } catch {}
}
let pendingScore = null;
function openNameModal(scoreValue, auraValue) {
  pendingScore = { score: scoreValue, aura: auraValue };
  const defaultName = localStorage.getItem("lamumu_runner_name") || "Player";
  if (nameInput) nameInput.value = defaultName;
  overlayName?.classList.remove("hidden");
  nameInput?.focus();
}
function commitSaveScore() {
  if (!pendingScore) { overlayName?.classList.add("hidden"); return; }
  const name = (nameInput?.value || "Player").trim() || "Player";
  localStorage.setItem("lamumu_runner_name", name);
  const items = getLeaderboard();
  items.push({ name, score: pendingScore.score, aura: pendingScore.aura, at: Date.now() });
  items.sort((a,b) => (b.score + b.aura*0.5) - (a.score + a.aura*0.5));
  setLeaderboard(items.slice(0, 10));
  pendingScore = null;
  overlayName?.classList.add("hidden");
}
function renderLeaderboard() {
  const items = getLeaderboard();
  lbBody.innerHTML = items.map((it, idx) => `<tr><td>${idx+1}</td><td>${escapeHtml(it.name)}</td><td>${it.score}</td><td>${it.aura}</td></tr>`).join("");
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
}