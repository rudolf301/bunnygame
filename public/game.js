// ============================================================
//  ZEC SKUPLJA JAJA - Phaser 3 Engine v3
// ============================================================

const socket = io();

// ---- UI helpers ----
function showScreen(id) {
  ['menu-screen', 'lobby-screen', 'game-screen', 'gameover-screen'].forEach(s => {
    document.getElementById(s).classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
  // Show/hide ability bar only during active gameplay
  const ab = document.getElementById('abilityBar');
  if (ab) ab.style.display = (id === 'game-screen') ? 'flex' : 'none';
}

function showToast(msg, duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ---- Background deco ----
(function createBgDeco() {
  const deco = document.getElementById('bgDeco');
  const emojis = ['🥚', '🐰', '🥕', '🌸', '🌿', '🐣'];
  for (let i = 0; i < 15; i++) {
    const s = document.createElement('span');
    s.className = 'bg-egg';
    s.textContent = emojis[i % emojis.length];
    s.style.left = (5 + Math.random() * 90) + '%';
    s.style.top = (5 + Math.random() * 90) + '%';
    s.style.animationDelay = (Math.random() * 10) + 's';
    s.style.animationDuration = (10 + Math.random() * 10) + 's';
    deco.appendChild(s);
  }
})();

// ============================================================
//  SOUND ENGINE
// ============================================================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(freq, dur, type = 'sine', vol = 0.12, slide = 0) {
  ensureAudio();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, audioCtx.currentTime + dur);
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + dur);
}

function playNoise(dur, vol = 0.06) {
  ensureAudio();
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = audioCtx.createBufferSource(); s.buffer = buf;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  const f = audioCtx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
  s.connect(f).connect(g).connect(audioCtx.destination);
  s.start();
}

const SFX = {
  egg() { playTone(880, 0.1); setTimeout(() => playTone(1100, 0.1), 60); setTimeout(() => playTone(1320, 0.15, 'sine', 0.08), 120); },
  carrot() { [523, 659, 784, 1047].forEach((n, i) => setTimeout(() => playTone(n, 0.12, 'square', 0.07), i * 80)); },
  shieldHit() { playTone(200, 0.15, 'sawtooth', 0.1, 400); playNoise(0.12, 0.08); },
  damage() { playTone(300, 0.15, 'sawtooth', 0.12, -200); playNoise(0.15, 0.08); },
  levelUp() { [523, 659, 784, 1047].forEach((n, i) => setTimeout(() => playTone(n, 0.15, 'square', 0.07), i * 100)); },
  chickenWarn() { playTone(400, 0.06, 'square', 0.04); setTimeout(() => playTone(400, 0.06, 'square', 0.04), 130); },
  chickenSpawn() { playTone(180, 0.1, 'sawtooth', 0.05, 80); },
  over() { [440, 370, 330, 220].forEach((n, i) => setTimeout(() => playTone(n, 0.3, 'sawtooth', 0.08), i * 200)); },
  click() { playTone(800, 0.05, 'sine', 0.06); },
  golden() { [1047, 1319, 1568, 2093].forEach((n, i) => setTimeout(() => playTone(n, 0.12, 'sine', 0.09), i * 60)); },
  speedUp() { playTone(500, 0.08, 'square', 0.06, 300); setTimeout(() => playTone(900, 0.1, 'square', 0.06), 100); },
  magnet() { playTone(350, 0.15, 'sine', 0.08, 150); setTimeout(() => playTone(600, 0.12, 'sine', 0.06), 120); },
  freeze() { playTone(1200, 0.2, 'sine', 0.1, -600); playTone(800, 0.25, 'sine', 0.06, -400); },
  combo() { playTone(660, 0.06, 'square', 0.06); setTimeout(() => playTone(880, 0.08, 'square', 0.07), 50); },
  blast() {
    playTone(120, 0.35, 'sawtooth', 0.14, 60); playNoise(0.25, 0.14);
    setTimeout(() => { playTone(80, 0.25, 'sawtooth', 0.1); playNoise(0.2, 0.1); }, 120);
  },
  abilityReady() { playTone(600, 0.06, 'sine', 0.07); setTimeout(() => playTone(900, 0.08, 'sine', 0.06), 80); },
};

// ============================================================
//  MUSIC ENGINE (MP3 background music)
// ============================================================
let musicPlaying = false;
let bgMusic = null;

function createMusicPlayer() {
  if (bgMusic) return;
  bgMusic = new Audio('/music/bg-music.mp3');
  bgMusic.loop = true;
  bgMusic.volume = 0.35;
  bgMusic.preload = 'auto';
}

function startMusic() {
  if (musicPlaying) return;
  createMusicPlayer();
  musicPlaying = true;
  bgMusic.play().catch(() => {
    // Autoplay blocked - will play on next user interaction
    musicPlaying = false;
  });
  document.getElementById('btnMusic').textContent = '🔊';
}

function stopMusic() {
  musicPlaying = false;
  if (bgMusic) {
    bgMusic.pause();
  }
  document.getElementById('btnMusic').textContent = '🔇';
}

function toggleMusic() {
  if (musicPlaying) stopMusic();
  else startMusic();
}

// Music button
document.getElementById('btnMusic').addEventListener('click', toggleMusic);

// Preload music
createMusicPlayer();

// ============================================================
//  LEADERBOARD
// ============================================================
let currentLbMode = 'all';

async function loadLeaderboard(mode) {
  currentLbMode = mode || 'all';
  try {
    const url = mode && mode !== 'all' ? `/api/scores?limit=10&mode=${mode}` : '/api/scores?limit=10';
    const res = await fetch(url);
    const scores = await res.json();
    renderLeaderboard(scores);
  } catch (e) {
    console.error('Leaderboard load failed:', e);
  }
  // Stats
  try {
    const res = await fetch('/api/stats');
    const stats = await res.json();
    renderStats(stats);
  } catch (e) {}
}

function renderLeaderboard(scores) {
  const list = document.getElementById('leaderboardList');
  if (!scores.length) {
    list.innerHTML = '<p class="lb-empty">Nema rezultata jos. Budi prvi!</p>';
    return;
  }
  const rankIcons = ['🥇', '🥈', '🥉'];
  list.innerHTML = scores.map((s, i) => {
    const topClass = i < 3 ? ` top${i + 1}` : '';
    const rank = i < 3 ? rankIcons[i] : `${i + 1}`;
    const modeClass = s.mode || 'solo';
    const modeBadge = s.mode ? `<span class="lb-mode-badge ${modeClass}">${modeClass}</span>` : '';
    return `
      <div class="lb-row${topClass}">
        <span class="lb-rank">${rank}</span>
        <span class="lb-name">${escHtml(s.name)}</span>
        ${modeBadge}
        <span class="lb-level">Lv${s.level}</span>
        <span class="lb-score">${s.score}</span>
      </div>`;
  }).join('');
}

function renderStats(stats) {
  const el = document.getElementById('lbStats');
  if (!stats || !stats.totalGames) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="lb-stat"><div class="lb-stat-val">${stats.totalGames}</div><div class="lb-stat-label">Igara</div></div>
    <div class="lb-stat"><div class="lb-stat-val">${stats.highestScore}</div><div class="lb-stat-label">Best Score</div></div>
    <div class="lb-stat"><div class="lb-stat-val">${stats.avgScore}</div><div class="lb-stat-label">Average</div></div>
    <div class="lb-stat"><div class="lb-stat-val">${stats.highestLevel}</div><div class="lb-stat-label">Max Level</div></div>
  `;
}

function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

async function submitScore(name, score, level, mode) {
  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score, level, mode }),
    });
    const data = await res.json();
    return data;
  } catch (e) {
    console.error('Score submit failed:', e);
    return null;
  }
}

// Tab clicks
document.querySelectorAll('.lb-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadLeaderboard(tab.dataset.mode);
  });
});

// Load leaderboard on start
loadLeaderboard('all');

// ============================================================
//  GAME STATE
// ============================================================
let gameMode = 'single';
let roomCode = null;
let playerIndex = 0;
let opponentName = '';
let opponentScore = 0;
let opponentAlive = true;
let phaserGame = null;
let gamePaused = false;

const EGG_COLORS = [0xff7675, 0x74b9ff, 0xa29bfe, 0x55efc4, 0xfdcb6e, 0xfd79a8, 0x00cec9, 0xe17055, 0x6c5ce7, 0x00b894];

// ============================================================
//  PHASER SCENE
// ============================================================
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.score = 0;
    this.lives = 3.0;           // Half-heart system: 0.5 per hit
    this.level = 1;
    this.shieldTimer = 0;
    this.invTimer = 0;
    this.eggsSinceCarrot = 0;
    this.chickenKills = 0;
    this.isGameOver = false;

    // -- NEW gameplay state --
    this.comboCount = 0;
    this.comboTimer = 0;
    this.comboMultiplier = 1;
    this.speedBoostTimer = 0;
    this.magnetTimer = 0;
    this.freezeTimer = 0;
    this.screenShakeTimer = 0;
    this.totalTime = 0;
    this.chickenSpawnCooldown = 0;
    this.maxChickens = 14; // HARD CAP

    // Half-heart pickup (spawns every 20s when score >= 100)
    this.heartPickupTimer = 0;

    // Hard mode flag (score >= 200)
    this.hardModeAnnounced = false;

    // Angry mode (5 eggs streak)
    this.angryTimer = 0;
    this.angryAnnounced = false;

    // Boss
    this.boss = null;

    // Carrot throw cooldown
    this.carrotThrowCd = 0;

    // ---- ABILITY HOTBAR (keys 1-4) ----
    this.abilityDefs = [
      { label: '1', icon: '❄️', name: 'Freeze', maxCd: 20000, duration: 5000 },
      { label: '2', icon: '🥕', name: 'Shield', maxCd: 16000, duration: 7000 },
      { label: '3', icon: '⚡', name: 'Turbo',  maxCd: 12000, duration: 5000 },
      { label: '4', icon: '💣', name: 'Blast',  maxCd: 28000, duration: 0    },
    ];
    this.abilityCds = [0, 0, 0, 0]; // remaining cooldown ms (0 = ready)

    const W = this.scale.width;
    const H = this.scale.height;

    // Background
    this.add.rectangle(W / 2, H / 2, W, H, 0xc8e6a0);

    for (let x = 0; x < W; x += 90) {
      for (let y = 0; y < H; y += 90) {
        this.add.circle(x + 45, y + 45, 32, 0xb8d890, 0.35);
      }
    }

    // Grass - darker, behind everything
    this.grassGfx = this.add.graphics().setDepth(0).setAlpha(0.6);
    this.grassTufts = [];
    for (let i = 0; i < 35; i++) {
      this.grassTufts.push({ x: Phaser.Math.Between(0, W), y: Phaser.Math.Between(0, H), h: Phaser.Math.Between(6, 14) });
    }

    // Flowers (across whole map)
    for (let i = 0; i < 18; i++) {
      const fx = Phaser.Math.Between(30, W - 30);
      const fy = Phaser.Math.Between(30, H - 30);
      const fc = [0xff6b6b, 0xffd93d, 0x6c5ce7, 0xfd79a8, 0xffffff][i % 5];
      const petals = Phaser.Math.Between(4, 6);
      const g = this.add.graphics();
      g.fillStyle(0x5a9e3f);
      g.fillRect(fx - 1, fy - 12, 2, 12);
      for (let p = 0; p < petals; p++) {
        const angle = (Math.PI * 2 / petals) * p;
        g.fillStyle(fc, 0.7);
        g.fillEllipse(fx + Math.cos(angle) * 4, fy - 12 + Math.sin(angle) * 4, 5, 5);
      }
      g.fillStyle(0xf1c40f);
      g.fillCircle(fx, fy - 12, 2.5);
    }

    // Groups
    this.eggs = this.physics.add.group();
    this.carrots = this.physics.add.group();
    this.chickens = this.physics.add.group();
    this.powerups = this.physics.add.group();
    this.hearts = this.physics.add.group();
    this.chickenProjs = this.physics.add.group(); // eggs thrown by chickens
    this.carrotProjs  = this.physics.add.group(); // carrots thrown by bunny

    // Terrain obstacles (collidable for bunny + chickens)
    if (!this.textures.exists('blank_px')) {
      const bg = this.make.graphics({ add: false });
      bg.fillStyle(0xffffff); bg.fillRect(0, 0, 4, 4);
      bg.generateTexture('blank_px', 4, 4); bg.destroy();
    }
    this.obstacles = this.physics.add.staticGroup();
    this.obstacleGfxList = []; // graphics to clear on level change

    this.warnings = [];

    // Textures - create once, reuse
    // Animated bunny via CanvasTexture (updated every frame using BunnyDraw)
    if (!this.textures.exists('bunny_canvas_tex')) {
      this.textures.createCanvas('bunny_canvas_tex', 82, 102);
    }
    this.bunnyCanvasTex = this.textures.get('bunny_canvas_tex');
    this.bunnyCtx2D = this.bunnyCanvasTex.getCanvas().getContext('2d');
    // Keep static fallback textures for other scenes
    if (!this.textures.exists('bunny')) this.createBunnyTexture();
    if (!this.textures.exists('bunny_shield')) this.createBunnyShieldTexture();
    if (!this.textures.exists('golden_egg')) this.createGoldenEggTexture();
    if (!this.textures.exists('speed_powerup')) this.createSpeedTexture();
    if (!this.textures.exists('magnet_powerup')) this.createMagnetTexture();
    if (!this.textures.exists('freeze_powerup')) this.createFreezeTexture();
    if (!this.textures.exists('half_heart_tex')) this.createHalfHeartTexture();
    if (!this.textures.exists('boss_tex'))       this.createBossTex();
    if (!this.textures.exists('chick_egg_tex'))  this.createChickEggTex();
    if (!this.textures.exists('carrot_proj_tex')) this.createCarrotProjTex();
    // Pre-create egg textures (one per color)
    this.eggTextureKeys = [];
    EGG_COLORS.forEach((color, idx) => {
      const key = 'egg_color_' + idx;
      if (!this.textures.exists(key)) {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0x000000, 0.08);
        g.fillEllipse(14, 30, 16, 6);
        g.fillStyle(color);
        g.fillEllipse(14, 14, 22, 28);
        g.lineStyle(2, 0xffffff, 0.5);
        g.beginPath();
        g.arc(14, 16, 8, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
        g.strokePath();
        g.fillStyle(0xffffff, 0.45);
        g.fillEllipse(10, 8, 5, 7);
        g.generateTexture(key, 28, 36);
        g.destroy();
      }
      this.eggTextureKeys.push(key);
    });
    // Pre-create chicken texture
    if (!this.textures.exists('chicken_tex')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      const cx = 30, cy = 25;
      g.fillStyle(0xf5f0e6);
      g.fillEllipse(cx, cy, 44, 34);
      g.fillStyle(0xe8e0d0);
      g.fillEllipse(cx - 5, cy - 2, 24, 18);
      g.fillStyle(0xf5f0e6);
      g.fillCircle(cx + 16, cy - 12, 12);
      g.fillStyle(0xdc3545);
      g.fillTriangle(cx + 12, cy - 22, cx + 14, cy - 34, cx + 16, cy - 22);
      g.fillTriangle(cx + 16, cy - 22, cx + 18, cy - 32, cx + 20, cy - 22);
      g.fillStyle(0xf5a623);
      g.fillTriangle(cx + 26, cy - 14, cx + 36, cy - 10, cx + 26, cy - 6);
      g.fillStyle(0x2d3436);
      g.fillCircle(cx + 20, cy - 14, 3);
      g.fillStyle(0xe74c3c);
      g.fillCircle(cx + 20, cy - 14, 1.5);
      g.lineStyle(2.5, 0x2d3436);
      g.lineBetween(cx + 14, cy - 20, cx + 26, cy - 17);
      g.lineStyle(2, 0xf5a623);
      g.lineBetween(cx - 5, cy + 16, cx - 5, cy + 26);
      g.lineBetween(cx + 5, cy + 16, cx + 5, cy + 26);
      g.generateTexture('chicken_tex', 60, 50);
      g.destroy();
    }
    // Pre-create carrot texture
    if (!this.textures.exists('carrot_tex')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xf39c12, 0.15);
      g.fillCircle(16, 20, 20);
      g.fillStyle(0xe67e22);
      g.beginPath();
      g.moveTo(16, 38); g.lineTo(6, 14); g.lineTo(10, 6);
      g.lineTo(16, 4); g.lineTo(22, 6); g.lineTo(26, 14);
      g.closePath(); g.fillPath();
      g.lineStyle(1, 0xd35400, 0.3);
      g.lineBetween(10, 16, 22, 16);
      g.lineBetween(11, 22, 21, 22);
      g.lineBetween(13, 28, 19, 28);
      g.fillStyle(0x27ae60);
      g.fillEllipse(12, 4, 5, 12);
      g.fillEllipse(20, 3, 5, 12);
      g.fillStyle(0x2ecc71);
      g.fillEllipse(16, 2, 4, 10);
      g.generateTexture('carrot_tex', 32, 42);
      g.destroy();
    }

    // Bunny - animated via CanvasTexture (redrawn each frame by BunnyDraw)
    this.bunny = this.physics.add.sprite(W / 2, H / 2, 'bunny_canvas_tex');
    this.bunny.setCollideWorldBounds(true);
    this.bunny.setDepth(10);
    this.bunny.dir = 1;
    this.bunny.body.setSize(30, 35);
    this.bunny.body.setOffset(26, 55); // align hitbox with bunny body in canvas

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    // Ability hotbar keys 1-4
    this.abilityKeys = [
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
    ];

    // Space = throw carrot
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // ---- MOBILE TOUCH: ability tap handlers ----
    this.setupMobileControls();

    // Spawn initial level terrain
    this.spawnLevelObstacles();

    // Spawn initial eggs
    for (let i = 0; i < 6; i++) this.spawnEgg();
    for (let i = 0; i < 2; i++) this.spawnChickenWithWarning();

    // Overlaps
    this.physics.add.overlap(this.bunny, this.eggs, this.collectEgg, null, this);
    this.physics.add.overlap(this.bunny, this.carrots, this.collectCarrot, null, this);
    this.physics.add.overlap(this.bunny, this.chickens, this.hitChicken, null, this);
    this.physics.add.overlap(this.bunny, this.powerups, this.collectPowerup, null, this);
    this.physics.add.overlap(this.bunny, this.hearts, this.collectHeart, null, this);

    // Colliders: bunny + chickens hit terrain obstacles
    this.physics.add.collider(this.bunny, this.obstacles);
    this.physics.add.collider(this.chickens, this.obstacles);

    // Projectile overlaps
    this.physics.add.overlap(this.bunny, this.chickenProjs, this.hitByChickenEgg, null, this);
    this.physics.add.overlap(this.carrotProjs, this.chickens, this.carrotHitChicken, null, this);

    // Graphics layers
    this.warnGfx = this.add.graphics().setDepth(5);
    this.partGfx = this.add.graphics().setDepth(15);
    this.effectGfx = this.add.graphics().setDepth(8);
    this.particles = [];

    // Shield visual
    this.shieldCircle = this.add.graphics().setDepth(9);

    // Combo text
    this.comboText = this.add.text(W / 2, 70, '', {
      fontFamily: 'Fredoka One, Nunito, sans-serif',
      fontSize: '28px',
      color: '#ff6b6b',
      stroke: '#000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(25).setAlpha(0);

    // Timer text (top center)
    this.timerText = this.add.text(W / 2, H - 35, '', {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '14px',
      color: '#fff',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(25).setAlpha(0.6);

    this.updateHUD();
    this.updateAbilityBar(0);
    this.input.keyboard.on('keydown', () => ensureAudio());
  }

  // ============================================================
  //  TEXTURE GENERATION
  // ============================================================
  createBunnyTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const cx = 40, cy = 70;
    g.fillStyle(0xe0d5c9);
    g.fillEllipse(cx, cy + 5, 40, 35);
    g.fillEllipse(cx, cy - 18, 30, 28);
    for (const off of [-7, 7]) {
      g.fillStyle(0xe0d5c9);
      g.fillEllipse(cx + off, cy - 48, 10, 30);
      g.fillStyle(0xf0b4b4);
      g.fillEllipse(cx + off, cy - 44, 6, 20);
    }
    g.fillStyle(0x2d3436);
    g.fillCircle(cx - 5, cy - 22, 3);
    g.fillCircle(cx + 5, cy - 22, 3);
    g.fillStyle(0xffffff);
    g.fillCircle(cx - 4, cy - 23, 1.2);
    g.fillCircle(cx + 6, cy - 23, 1.2);
    g.fillStyle(0xe68282);
    g.fillEllipse(cx, cy - 15, 5, 4);
    g.lineStyle(1, 0xc07070, 0.8);
    g.beginPath();
    g.arc(cx, cy - 12, 3, Phaser.Math.DegToRad(10), Phaser.Math.DegToRad(170));
    g.strokePath();
    g.fillStyle(0xffffff);
    g.fillCircle(cx - 18, cy + 10, 7);
    g.generateTexture('bunny', 80, 100);
    g.destroy();
  }

  createBunnyShieldTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const cx = 45, cy = 70;
    g.fillStyle(0xf39c12, 0.12);
    g.fillCircle(cx, cy - 10, 42);
    g.lineStyle(2.5, 0xf39c12, 0.5);
    g.strokeCircle(cx, cy - 10, 40);
    g.fillStyle(0xe0d5c9);
    g.fillEllipse(cx, cy + 5, 40, 35);
    g.fillEllipse(cx, cy - 18, 30, 28);
    for (const off of [-7, 7]) {
      g.fillStyle(0xe0d5c9);
      g.fillEllipse(cx + off, cy - 48, 10, 30);
      g.fillStyle(0xf0b4b4);
      g.fillEllipse(cx + off, cy - 44, 6, 20);
    }
    g.fillStyle(0x2d3436);
    g.fillCircle(cx - 5, cy - 22, 3);
    g.fillCircle(cx + 5, cy - 22, 3);
    g.fillStyle(0xffffff);
    g.fillCircle(cx - 4, cy - 23, 1.2);
    g.fillCircle(cx + 6, cy - 23, 1.2);
    g.fillStyle(0xe68282);
    g.fillEllipse(cx, cy - 15, 5, 4);
    g.lineStyle(1, 0xc07070, 0.8);
    g.beginPath();
    g.arc(cx, cy - 12, 3, Phaser.Math.DegToRad(10), Phaser.Math.DegToRad(170));
    g.strokePath();
    g.fillStyle(0xffffff);
    g.fillCircle(cx - 18, cy + 10, 7);
    g.generateTexture('bunny_shield', 90, 110);
    g.destroy();
  }

  createGoldenEggTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffd700, 0.25);
    g.fillCircle(16, 16, 18);
    g.fillStyle(0xffd700);
    g.fillEllipse(16, 14, 22, 28);
    g.fillStyle(0xffed4a, 0.8);
    g.fillEllipse(12, 8, 6, 8);
    g.lineStyle(1.5, 0xffffff, 0.6);
    g.beginPath();
    g.arc(16, 16, 8, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
    g.strokePath();
    g.generateTexture('golden_egg', 32, 36);
    g.destroy();
  }

  createSpeedTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x00cec9, 0.2);
    g.fillCircle(16, 16, 16);
    g.fillStyle(0x00cec9);
    // Lightning bolt
    g.beginPath();
    g.moveTo(18, 2); g.lineTo(10, 15); g.lineTo(16, 15);
    g.lineTo(12, 30); g.lineTo(24, 13); g.lineTo(18, 13);
    g.closePath();
    g.fillPath();
    g.generateTexture('speed_powerup', 32, 32);
    g.destroy();
  }

  createMagnetTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xe74c3c, 0.2);
    g.fillCircle(16, 16, 16);
    // Magnet shape (U)
    g.fillStyle(0xe74c3c);
    g.fillRect(6, 6, 6, 18);
    g.fillRect(20, 6, 6, 18);
    g.fillRect(6, 20, 20, 6);
    g.fillStyle(0x3498db);
    g.fillRect(6, 6, 6, 6);
    g.fillRect(20, 6, 6, 6);
    g.generateTexture('magnet_powerup', 32, 32);
    g.destroy();
  }

  createFreezeTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x74b9ff, 0.2);
    g.fillCircle(16, 16, 16);
    g.fillStyle(0x74b9ff);
    // Snowflake-ish
    g.fillRect(15, 4, 2, 24);
    g.fillRect(4, 15, 24, 2);
    // Diagonals
    for (const [dx, dy] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
      g.fillRect(16 + dx * 4 - 1, 16 + dy * 4 - 1, 2, 2);
      g.fillRect(16 + dx * 8 - 1, 16 + dy * 8 - 1, 2, 2);
    }
    g.generateTexture('freeze_powerup', 32, 32);
    g.destroy();
  }

  createHalfHeartTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    // Outer pink glow
    g.fillStyle(0xff69b4, 0.25);
    g.fillCircle(16, 15, 17);
    // Heart shape: two circles + downward triangle
    g.fillStyle(0xff1493);
    g.fillCircle(10, 11, 8);
    g.fillCircle(22, 11, 8);
    g.fillTriangle(3, 15, 29, 15, 16, 30);
    // Shine
    g.fillStyle(0xffffff, 0.45);
    g.fillEllipse(11, 8, 5, 4);
    // "+½" label drawn with small text is tricky in Phaser Graphics,
    // so instead we draw a small white plus sign and half marker
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(14, 13, 5, 1.5); // minus → make + with vertical
    g.fillRect(15.5, 11.5, 1.5, 5);
    g.generateTexture('half_heart_tex', 32, 32);
    g.destroy();
  }

  // ============================================================
  //  SPAWNING
  // ============================================================
  spawnEgg() {
    const W = this.scale.width, H = this.scale.height;
    const x = Phaser.Math.Between(70, W - 70);
    const y = Phaser.Math.Between(80, H - 80);
    const colorIdx = Phaser.Math.Between(0, EGG_COLORS.length - 1);

    const egg = this.physics.add.sprite(x, y, this.eggTextureKeys[colorIdx]);
    egg.eggColor = EGG_COLORS[colorIdx];
    egg.isGolden = false;
    egg.setDepth(3);
    egg.body.setSize(20, 24);
    this.eggs.add(egg);

    this.tweens.add({
      targets: egg, y: y - 4,
      duration: 800 + Math.random() * 400,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  spawnGoldenEgg() {
    const W = this.scale.width, H = this.scale.height;
    const x = Phaser.Math.Between(60, W - 60);
    const y = Phaser.Math.Between(80, H - 80);

    const egg = this.physics.add.sprite(x, y, 'golden_egg');
    egg.eggColor = 0xffd700;
    egg.isGolden = true;
    egg.setDepth(4);
    egg.body.setSize(20, 24);
    this.eggs.add(egg);

    // Flashy tween
    this.tweens.add({
      targets: egg, y: y - 6, scaleX: 1.15, scaleY: 1.15,
      duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    // Auto-despawn after 8s
    this.time.delayedCall(8000, () => {
      if (egg.active) {
        this.tweens.add({ targets: egg, alpha: 0, duration: 400, onComplete: () => egg.destroy() });
      }
    });
  }

  spawnCarrot() {
    const W = this.scale.width, H = this.scale.height;
    const x = Phaser.Math.Between(60, W - 60);
    const y = Phaser.Math.Between(80, H - 80);

    const carrot = this.physics.add.sprite(x, y, 'carrot_tex');
    carrot.setDepth(4);
    carrot.body.setSize(20, 28);
    this.carrots.add(carrot);

    this.tweens.add({
      targets: carrot, y: y - 5, scaleX: 1.08, scaleY: 1.08,
      duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  spawnPowerup() {
    const W = this.scale.width, H = this.scale.height;
    const x = Phaser.Math.Between(60, W - 60);
    const y = Phaser.Math.Between(80, H - 80);
    const types = ['speed', 'magnet', 'freeze'];
    const type = types[Phaser.Math.Between(0, types.length - 1)];

    const pw = this.physics.add.sprite(x, y, type + '_powerup');
    pw.pwType = type;
    pw.setDepth(4);
    pw.body.setSize(24, 24);
    this.powerups.add(pw);

    this.tweens.add({
      targets: pw, y: y - 5, angle: 10,
      duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Despawn after 10s
    this.time.delayedCall(10000, () => {
      if (pw.active) {
        this.tweens.add({ targets: pw, alpha: 0, duration: 500, onComplete: () => pw.destroy() });
      }
    });
  }

  spawnHalfHeart() {
    if (this.lives >= 3.0) return; // already full
    const W = this.scale.width, H = this.scale.height;
    const x = Phaser.Math.Between(60, W - 60);
    const y = Phaser.Math.Between(80, H - 80);

    const h = this.physics.add.sprite(x, y, 'half_heart_tex');
    h.setDepth(5);
    h.body.setSize(26, 26);
    this.hearts.add(h);

    // Pulse tween
    this.tweens.add({
      targets: h, y: y - 7, scaleX: 1.15, scaleY: 1.15,
      duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Auto-despawn after 12s
    this.time.delayedCall(12000, () => {
      if (h.active) {
        this.tweens.add({ targets: h, alpha: 0, duration: 500, onComplete: () => h.destroy() });
      }
    });

    showToast('💗 Half heart appeared!');
  }

  spawnChickenWithWarning() {
    // Don't spawn if at cap (including pending warnings)
    const totalChickens = this.chickens.countActive() + this.warnings.length;
    if (totalChickens >= this.maxChickens) return;

    const W = this.scale.width, H = this.scale.height;
    const side = Phaser.Math.Between(0, 3);
    let sx, sy, wx, wy;

    if (side === 0) { sx = -30; sy = Phaser.Math.Between(60, H - 60); wx = 25; wy = sy; }
    else if (side === 1) { sx = W + 30; sy = Phaser.Math.Between(60, H - 60); wx = W - 25; wy = sy; }
    else if (side === 2) { sx = Phaser.Math.Between(60, W - 60); sy = -30; wx = sx; wy = 25; }
    else { sx = Phaser.Math.Between(60, W - 60); sy = H + 30; wx = sx; wy = H - 25; }

    this.warnings.push({ x: wx, y: wy, timer: 1500, max: 1500, sx, sy });
    SFX.chickenWarn();
  }

  actuallySpawnChicken(sx, sy) {
    // Respect dynamic cap
    const scoreChickenBonus2 = Math.floor((this.score || 0) / 250);
    const dynamicMax = Math.min(4 + Math.floor(this.level / 2) + scoreChickenBonus2, this.maxChickens);
    if (this.chickens.countActive() >= dynamicMax) return;

    // Add random offset so chickens don't spawn at same spot
    const offsetX = (Math.random() - 0.5) * 60;
    const offsetY = (Math.random() - 0.5) * 60;

    const chicken = this.physics.add.sprite(sx + offsetX, sy + offsetY, 'chicken_tex');
    // Speed: faster base, scales more aggressively with level
    chicken.speed = 90 + Math.min(this.level, 10) * 15 + Math.random() * 30;
    chicken.dashTimer  = 3000 + Math.random() * 5000; // time until next dash
    chicken.dashActive = 0;                            // dash duration remaining
    chicken.throwTimer = 5000 + Math.random() * 5000; // time until throws egg
    chicken.stunTimer  = 0;                            // stun from carrot hit
    chicken.baseSpeed = chicken.speed;
    chicken.setDepth(6);
    chicken.body.setSize(35, 30);
    this.chickens.add(chicken);
    SFX.chickenSpawn();
  }

  // ============================================================
  //  COLLECT / HIT
  // ============================================================
  collectEgg(bunny, egg) {
    if (!egg.active) return;
    const x = egg.x, y = egg.y;
    const isGolden = egg.isGolden;
    const c = egg.eggColor;
    egg.destroy();

    // Combo system
    this.comboCount++;
    this.comboTimer = 2000; // 2s window
    this.comboMultiplier = Math.min(5, 1 + Math.floor(this.comboCount / 3));

    let points = isGolden ? 10 : 1;
    points *= this.comboMultiplier;

    this.score += points;
    this.eggsSinceCarrot++;

    if (isGolden) {
      SFX.golden();
      this.spawnBurst(x, y, 0xffd700, 20);
      this.addPopup(x, y - 10, `+${points} GOLD!`, '#ffd700');
      this.shakeScreen(150);
    } else {
      SFX.egg();
      this.spawnBurst(x, y, c, 8);
      if (this.comboMultiplier > 1) {
        SFX.combo();
        this.addPopup(x, y - 10, `+${points} x${this.comboMultiplier}`, '#ff6b6b');
      } else {
        this.addPopup(x, y - 10, `+${points}`, '#fff');
      }
    }

    // Level up with themed levels
    const levelThresholds = [0, 8, 20, 38, 60, 90, 125, 170, 220, 280, 350];
    const nextThreshold = levelThresholds[this.level] || (this.level * 40);
    // Angry mode: 5+ combo streak
    if (this.comboCount >= 5 && this.angryTimer <= 0) {
      this.angryTimer = 10000;
      this.cameras.main.flash(300, 255, 60, 0, false);
      showToast('😡 ANGRY! Chickens enraged for 10s!');
      this.addPopup(bunny.x, bunny.y - 55, '😡 ANGRY!', '#e74c3c');
    }

    if (this.score >= nextThreshold) {
      this.level++;
      this.spawnChickenWithWarning();
      SFX.levelUp();

      // Level themes
      const levelNames = {
        2: '🌿 Meadow',
        3: '🌸 Spring Garden',
        4: '🌲 Forest',
        5: '🏔️ Mountain',
        6: '🌙 Night',
        7: '❄️ Winter',
        8: '🌋 Volcano',
        9: '⭐ Starry Sky',
        10: '👑 Legend',
      };
      const levelName = levelNames[this.level] || `Level ${this.level}`;
      showToast(`${levelName} - Level ${this.level}! 🔥`);
      this.addPopup(bunny.x, bunny.y - 50, `${levelName}`, '#f1c40f');
      this.shakeScreen(200);

      // Change background tint per level
      this.applyLevelTheme();

      // Boss every 5th level
      if (this.level % 5 === 0) {
        this.time.delayedCall(1500, () => this.spawnBoss());
      }
    }

    // Carrot spawn
    const threshold = this.getCarrotThreshold();
    if (this.eggsSinceCarrot >= threshold) {
      this.spawnCarrot();
      this.eggsSinceCarrot = 0;
      showToast('🥕 A carrot appeared!');
    }

    if (!isGolden) this.spawnEgg();
    this.updateHUD();
  }

  collectCarrot(bunny, carrot) {
    if (!carrot.active) return;
    const x = carrot.x, y = carrot.y;
    carrot.destroy();
    this.shieldTimer = 5000;
    SFX.carrot();
    this.spawnBurst(x, y, 0xf39c12, 15);
    this.spawnBurst(x, y, 0xf1c40f, 10);
    this.addPopup(x, y - 15, 'SHIELD!', '#f39c12');
    showToast('🛡️ Shield activated! Crush the chickens!');
    this.shakeScreen(100);
    this.updateHUD();
  }

  collectPowerup(bunny, pw) {
    if (!pw.active) return;
    const x = pw.x, y = pw.y;
    const type = pw.pwType;
    pw.destroy();

    if (type === 'speed') {
      this.speedBoostTimer = 5000;
      SFX.speedUp();
      this.spawnBurst(x, y, 0x00cec9, 12);
      this.addPopup(x, y - 15, 'SPEED!', '#00cec9');
      showToast('⚡ Turbo speed!');
    } else if (type === 'magnet') {
      this.magnetTimer = 6000;
      SFX.magnet();
      this.spawnBurst(x, y, 0xe74c3c, 12);
      this.addPopup(x, y - 15, 'MAGNET!', '#e74c3c');
      showToast('🧲 Egg magnet!');
    } else if (type === 'freeze') {
      this.freezeTimer = 4000;
      SFX.freeze();
      this.spawnBurst(x, y, 0x74b9ff, 15);
      this.addPopup(x, y - 15, 'FREEZE!', '#74b9ff');
      showToast('❄️ Chickens frozen!');
    }
    this.shakeScreen(80);
  }

  collectHeart(bunny, heart) {
    if (!heart.active) return;
    const x = heart.x, y = heart.y;
    heart.destroy();

    if (this.lives < 3.0) {
      this.lives = Math.min(3.0, this.lives + 0.5);
      this.spawnBurst(x, y, 0xff69b4, 12);
      this.addPopup(x, y - 15, '+½ ❤️', '#ff69b4');
      playTone(880, 0.08, 'sine', 0.08); setTimeout(() => playTone(1100, 0.1, 'sine', 0.07), 80);
      this.updateHUD();
    }
  }

  hitChicken(bunny, chicken) {
    if (this.isGameOver || !chicken.active) return;

    if (this.shieldTimer > 0) {
      const x = chicken.x, y = chicken.y;
      chicken.destroy();
      this.chickenKills++;
      this.score += 3 * this.comboMultiplier;
      SFX.shieldHit();
      this.spawnBurst(x, y, 0xe74c3c, 10);
      this.spawnBurst(x, y, 0xf39c12, 6);
      this.addPopup(x, y - 10, `+${3 * this.comboMultiplier} BOOM!`, '#e74c3c');
      showToast('💥 Chicken destroyed!');
      this.shakeScreen(250);
      this.time.delayedCall(4000, () => { if (!this.isGameOver) this.spawnChickenWithWarning(); });
      this.updateHUD();
    } else if (this.invTimer <= 0) {
      this.lives -= 0.5;
      this.invTimer = 1500;
      SFX.damage();
      this.spawnBurst(bunny.x, bunny.y, 0xe74c3c, 12);
      this.addPopup(bunny.x, bunny.y - 20, '-½ ❤️', '#e74c3c');
      this.shakeScreen(300);

      // Reset combo on hit
      this.comboCount = 0;
      this.comboMultiplier = 1;

      const W = this.scale.width, H = this.scale.height;
      chicken.setPosition(chicken.x < W / 2 ? -30 : W + 30, Phaser.Math.Between(0, H));

      this.tweens.add({
        targets: bunny, alpha: 0.3, duration: 100,
        yoyo: true, repeat: 7, onComplete: () => { bunny.alpha = 1; },
      });

      if (this.lives <= 0) this.doGameOver();
      this.updateHUD();
    }
  }

  // ============================================================
  //  MOBILE CONTROLS
  // ============================================================
  setupMobileControls() {
    const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    // ---- Joystick ----
    this.touchDir = { x: 0, y: 0 };
    this.joystickActive = false;

    const joystickEl = document.getElementById('mobileJoystick');
    const base = document.getElementById('joystickBase');
    const knob = document.getElementById('joystickKnob');
    if (!base || !knob) return;

    const maxDist = 50; // max knob travel in px

    const getCenter = () => {
      const r = base.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };

    const moveKnob = (tx, ty) => {
      const c = getCenter();
      let dx = tx - c.x;
      let dy = ty - c.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > maxDist) { dx = dx / dist * maxDist; dy = dy / dist * maxDist; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      // Normalize to -1..1
      this.touchDir.x = dx / maxDist;
      this.touchDir.y = dy / maxDist;
    };

    const resetKnob = () => {
      knob.style.transform = 'translate(-50%, -50%)';
      this.touchDir.x = 0;
      this.touchDir.y = 0;
      this.joystickActive = false;
    };

    base.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.joystickActive = true;
      const t = e.touches[0];
      moveKnob(t.clientX, t.clientY);
    }, { passive: false });

    base.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.joystickActive) return;
      const t = e.touches[0];
      moveKnob(t.clientX, t.clientY);
    }, { passive: false });

    base.addEventListener('touchend', (e) => {
      e.preventDefault();
      resetKnob();
    }, { passive: false });

    base.addEventListener('touchcancel', (e) => {
      resetKnob();
    });

    // ---- Ability tap handlers ----
    const scene = this;
    for (let i = 0; i < 4; i++) {
      const slot = document.getElementById('ab' + i);
      if (!slot) continue;
      slot.style.pointerEvents = 'auto';
      slot.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        scene.useAbility(i);
      }, { passive: false });
    }

    // ---- Prevent page scroll/zoom on game area ----
    const gameScreen = document.getElementById('game-screen');
    gameScreen.addEventListener('touchmove', (e) => {
      // Only prevent on the game area, not on UI
      if (e.target.closest('.ability-slot') || e.target.closest('.joystick-base')) return;
      e.preventDefault();
    }, { passive: false });
  }

  // ============================================================
  //  ABILITY HOTBAR
  // ============================================================
  useAbility(idx) {
    if (this.isGameOver || gamePaused) return;
    if (this.abilityCds[idx] > 0) {
      // Flash slot red to indicate it's on cooldown
      const slot = document.getElementById('ab' + idx);
      if (slot) { slot.style.borderColor = '#e74c3c'; setTimeout(() => slot.style.borderColor = '', 300); }
      return;
    }
    ensureAudio();
    const ab = this.abilityDefs[idx];
    this.abilityCds[idx] = ab.maxCd;

    // Flash active animation on slot
    const slot = document.getElementById('ab' + idx);
    if (slot) {
      slot.classList.add('active-flash');
      setTimeout(() => slot.classList.remove('active-flash'), 250);
    }

    switch (idx) {
      case 0: // ❄️ FREEZE
        this.freezeTimer = ab.duration;
        SFX.freeze();
        this.spawnBurst(this.scale.width / 2, this.scale.height / 2, 0x74b9ff, 30);
        if (this.score >= 200) {
          this.addPopup(this.bunny.x, this.bunny.y - 45, '❄️ RESIST!', '#74b9ff');
          showToast('❄️ Chickens resist! Only slowed 70%!');
        } else {
          this.addPopup(this.bunny.x, this.bunny.y - 45, '❄️ FREEZE!', '#74b9ff');
          showToast('❄️ All chickens frozen!');
        }
        this.shakeScreen(120);
        this.cameras.main.flash(200, 100, 180, 255, false);
        break;

      case 1: // 🥕 SHIELD
        this.shieldTimer = ab.duration;
        SFX.carrot();
        this.spawnBurst(this.bunny.x, this.bunny.y, 0xf39c12, 18);
        this.addPopup(this.bunny.x, this.bunny.y - 45, '🥕 SHIELD!', '#f39c12');
        showToast('🛡️ Carrot Shield activated!');
        this.shakeScreen(80);
        this.updateHUD();
        break;

      case 2: // ⚡ TURBO
        this.speedBoostTimer = ab.duration;
        SFX.speedUp();
        this.spawnBurst(this.bunny.x, this.bunny.y, 0x00cec9, 15);
        this.addPopup(this.bunny.x, this.bunny.y - 45, '⚡ TURBO!', '#00cec9');
        showToast('⚡ Turbo speed activated!');
        break;

      case 3: { // 💣 BLAST
        SFX.blast();
        this.cameras.main.flash(300, 255, 100, 50, false);
        this.shakeScreen(500);
        this.spawnBurst(this.bunny.x, this.bunny.y, 0xff6b6b, 35);
        this.spawnBurst(this.bunny.x, this.bunny.y, 0xffd700, 20);

        const hardMode = this.score >= 200;
        // Hard mode: only kills chickens within 200px radius
        const blastRadius = hardMode ? 200 : Infinity;
        let kills = 0;
        const toKill = this.chickens.getChildren().filter(c => {
          if (!c.active || c.isBoss) return false;
          if (hardMode) {
            return Phaser.Math.Distance.Between(this.bunny.x, this.bunny.y, c.x, c.y) <= blastRadius;
          }
          return true;
        });
        toKill.forEach(c => {
          for (let i = 0; i < 3; i++) this.spawnBurst(c.x, c.y, 0xe74c3c, 6);
          c.destroy();
          kills++;
        });
        // Blast does 1 HP to boss if in range
        if (this.boss && this.boss.active) {
          const bd = Phaser.Math.Distance.Between(this.bunny.x, this.bunny.y, this.boss.x, this.boss.y);
          if (bd <= (hardMode ? blastRadius : 999)) this.bossHit(this.boss);
        }

        if (kills > 0) {
          const pts = kills * 3 * this.comboMultiplier;
          this.score += pts;
          this.addPopup(this.bunny.x, this.bunny.y - 50, `💣 BLAST! +${pts}`, '#ff6b6b');
          if (hardMode) {
            showToast(`💣 BLAST! ${kills} nearby chickens destroyed! +${pts} pts`);
          } else {
            showToast(`💣 BLAST! ${kills} chickens destroyed! +${pts} pts`);
          }
          this.updateHUD();
        } else {
          this.addPopup(this.bunny.x, this.bunny.y - 50, hardMode ? '💣 BLAST! (range only!)' : '💣 BLAST!', '#ff6b6b');
          showToast(hardMode ? '💣 BLAST! No chickens in range!' : '💣 BLAST!');
        }
        break;
      }
    }
  }

  updateAbilityBar(delta) {
    for (let i = 0; i < 4; i++) {
      const wasReady = this.abilityCds[i] <= 0;
      if (this.abilityCds[i] > 0) {
        this.abilityCds[i] = Math.max(0, this.abilityCds[i] - delta);
        // Play ready sound when cooldown finishes
        if (!wasReady && this.abilityCds[i] <= 0) SFX.abilityReady();
      }

      const ab    = this.abilityDefs[i];
      const pct   = ab.maxCd > 0 ? this.abilityCds[i] / ab.maxCd : 0;
      const ready = this.abilityCds[i] <= 0;

      const overlay = document.getElementById('abCd' + i);
      const timer   = document.getElementById('abTimer' + i);
      const slotEl  = document.getElementById('ab' + i);

      if (overlay) overlay.style.height = (pct * 100) + '%';
      if (timer)   timer.textContent = ready ? '' : Math.ceil(this.abilityCds[i] / 1000) + 's';
      if (slotEl) {
        if (ready) slotEl.classList.add('ready');
        else       slotEl.classList.remove('ready');
      }
    }
  }

  // ============================================================
  //  HELPERS
  // ============================================================
  getCarrotThreshold() {
    if (this.level <= 1) return 5;
    if (this.level <= 3) return 10;
    return 20;
  }

  spawnBurst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 8,
        vy: -Math.random() * 5 - 1,
        life: 25 + Math.random() * 15,
        maxLife: 40,
        color,
        r: 2 + Math.random() * 4,
      });
    }
  }

  addPopup(x, y, text, color) {
    const t = this.add.text(x, y, text, {
      fontFamily: 'Nunito, sans-serif', fontSize: '18px', fontStyle: 'bold',
      color, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({
      targets: t, y: y - 45, alpha: 0, duration: 900,
      ease: 'Cubic.easeOut', onComplete: () => t.destroy(),
    });
  }

  shakeScreen(duration) {
    this.screenShakeTimer = duration;
    this.cameras.main.shake(duration, 0.005);
  }

  // ============================================================
  //  BOSS CHICKEN
  // ============================================================
  createBossTex() {
    const g = this.make.graphics({ add: false });
    const cx = 50, cy = 40;
    g.fillStyle(0xd32f2f); g.fillEllipse(cx, cy, 72, 55);
    g.fillStyle(0xb71c1c); g.fillEllipse(cx - 8, cy - 3, 38, 28);
    g.fillStyle(0xd32f2f); g.fillCircle(cx + 26, cy - 20, 19);
    g.fillStyle(0xff1744); g.fillTriangle(cx + 20, cy - 36, cx + 22, cy - 56, cx + 24, cy - 36);
    g.fillTriangle(cx + 24, cy - 36, cx + 26, cy - 52, cx + 28, cy - 36);
    g.fillStyle(0xff6f00); g.fillTriangle(cx + 42, cy - 23, cx + 58, cy - 17, cx + 42, cy - 9);
    g.fillStyle(0xffffff); g.fillCircle(cx + 32, cy - 23, 5); g.fillCircle(cx + 32, cy - 23, 2.5);
    g.fillStyle(0xff0000); g.fillCircle(cx + 33, cy - 23, 1.5);
    g.lineStyle(3, 0x7f0000); g.lineBetween(cx + 22, cy - 33, cx + 38, cy - 28);
    g.lineStyle(2, 0xff6f00);
    g.lineBetween(cx - 8, cy + 26, cx - 8, cy + 40); g.lineBetween(cx + 6, cy + 26, cx + 6, cy + 40);
    g.generateTexture('boss_tex', 100, 80); g.destroy();
  }

  createChickEggTex() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xff6b6b); g.fillEllipse(9, 12, 14, 18);
    g.fillStyle(0xffffff, 0.4); g.fillEllipse(7, 8, 4, 6);
    g.generateTexture('chick_egg_tex', 18, 24); g.destroy();
  }

  createCarrotProjTex() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xe67e22); g.fillTriangle(10, 26, 4, 6, 16, 6);
    g.fillStyle(0x27ae60); g.fillEllipse(7, 4, 5, 10); g.fillEllipse(13, 3, 5, 10);
    g.generateTexture('carrot_proj_tex', 20, 30); g.destroy();
  }

  spawnBoss() {
    if (this.isGameOver) return;
    const W = this.scale.width, H = this.scale.height;
    // Spawn from random side
    const side = Phaser.Math.Between(0, 3);
    let bx, by;
    if (side === 0) { bx = -50; by = H / 2; }
    else if (side === 1) { bx = W + 50; by = H / 2; }
    else if (side === 2) { bx = W / 2; by = -50; }
    else { bx = W / 2; by = H + 50; }

    const boss = this.physics.add.sprite(bx, by, 'boss_tex');
    boss.setScale(1.3).setDepth(9);
    boss.body.setSize(70, 55);
    boss.isBoss = true;
    boss.hp = 3;
    boss.speed = 60;
    boss.throwTimer = 2000;
    boss.dashTimer = 99999; // boss doesn't dash
    boss.dashActive = 0;
    boss.stunTimer = 0;
    this.chickens.add(boss);
    this.boss = boss;

    // HP bar (simple text above boss)
    boss.hpText = this.add.text(bx, by - 55, '❤️❤️❤️', {
      fontSize: '18px', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);

    this.cameras.main.flash(400, 200, 0, 0, false);
    this.shakeScreen(300);
    showToast(`💀 BOSS! Level ${this.level} Boss Chicken attacks!`);
    this.addPopup(W / 2, H / 2 - 40, '💀 BOSS!', '#ff0000');

    // Update boss hp text each frame
    this.physics.add.overlap(this.carrotProjs, boss, (proj, b) => {
      this.carrotHitBoss(proj, b);
    }, null, this);
  }

  bossHit(boss) {
    boss.hp--;
    this.shakeScreen(200);
    this.spawnBurst(boss.x, boss.y, 0xe74c3c, 15);
    const hearts = '❤️'.repeat(Math.max(0, boss.hp));
    if (boss.hpText) boss.hpText.setText(hearts || '💀');

    if (boss.hp <= 0) {
      this.bossDie(boss);
    } else {
      // Flash boss red
      boss.setTint(0xffffff);
      this.time.delayedCall(150, () => { if (boss.active) boss.clearTint(); });
    }
  }

  bossDie(boss) {
    const bx = boss.x, by = boss.y;
    if (boss.hpText) boss.hpText.destroy();
    boss.destroy();
    this.boss = null;

    for (let i = 0; i < 5; i++) {
      this.time.delayedCall(i * 120, () => {
        this.spawnBurst(bx + Phaser.Math.Between(-60, 60), by + Phaser.Math.Between(-40, 40), 0xff6b6b, 20);
        this.spawnBurst(bx + Phaser.Math.Between(-60, 60), by + Phaser.Math.Between(-40, 40), 0xffd700, 15);
      });
    }
    this.cameras.main.flash(500, 255, 100, 0, false);
    this.shakeScreen(600);

    const pts = 50 * this.comboMultiplier;
    this.score += pts;
    this.addPopup(bx, by - 40, `💀 BOSS DOWN! +${pts}`, '#ffd700');
    showToast(`💀 Boss defeated! +${pts} pts!`);
    this.updateHUD();
  }

  // ============================================================
  //  PROJECTILES
  // ============================================================
  chickenThrowEgg(chicken) {
    if (!this.bunny || this.isGameOver) return;
    const bx = chicken.x, by = chicken.y;
    const tx = this.bunny.x, ty = this.bunny.y;
    const d = Math.hypot(tx - bx, ty - by) || 1;
    const speed = 280;

    const proj = this.physics.add.sprite(bx, by, 'chick_egg_tex');
    proj.setDepth(7);
    proj.body.setSize(14, 18);
    proj.life = 2500;
    proj.setVelocity((tx - bx) / d * speed, (ty - by) / d * speed);
    this.chickenProjs.add(proj);

    // Rotate toward target
    proj.angle = Phaser.Math.RadToDeg(Math.atan2(ty - by, tx - bx));
  }

  hitByChickenEgg(bunny, proj) {
    if (!proj.active || this.invTimer > 0 || this.shieldTimer > 0) return;
    proj.destroy();
    this.lives -= 0.5;
    this.invTimer = 1200;
    SFX.damage();
    this.spawnBurst(bunny.x, bunny.y, 0xff6b6b, 10);
    this.shakeScreen(200);
    this.addPopup(bunny.x, bunny.y - 20, '🥚 -½❤️', '#ff4444');
    if (this.lives <= 0) this.doGameOver();
    this.updateHUD();
  }

  throwCarrot() {
    if (this.isGameOver) return;
    this.carrotThrowCd = 1800;
    const bx = this.bunny.x, by = this.bunny.y;
    const dir = this.bunny.dir || 1;

    // Use last movement direction if available
    const vx = this.bunny.body.velocity.x;
    const vy = this.bunny.body.velocity.y;
    const mag = Math.hypot(vx, vy) || 1;
    const nx = mag > 10 ? vx / mag : dir;
    const ny = mag > 10 ? vy / mag : 0;

    const speed = 520;
    const proj = this.physics.add.sprite(bx, by, 'carrot_proj_tex');
    proj.setDepth(11);
    proj.body.setSize(12, 18);
    proj.life = 1200;
    proj.setVelocity(nx * speed, ny * speed);
    proj.angle = Phaser.Math.RadToDeg(Math.atan2(ny, nx)) + 90;
    this.carrotProjs.add(proj);

    SFX.carrot();
    this.spawnBurst(bx, by, 0xe67e22, 5);
  }

  carrotHitChicken(proj, chicken) {
    if (!proj.active || !chicken.active) return;
    if (chicken.isBoss) return; // handled separately
    proj.destroy();
    chicken.stunTimer = 2000;
    this.spawnBurst(chicken.x, chicken.y, 0xe67e22, 12);
    this.addPopup(chicken.x, chicken.y - 20, '🥕 STUNNED!', '#e67e22');
  }

  carrotHitBoss(proj, boss) {
    if (!proj.active || !boss.active) return;
    proj.destroy();
    this.bossHit(boss);
  }

  applyLevelTheme() {
    const tints = {
      1:  0xc8e6a0, 2:  0xd4f0a0, 3:  0xa8dba8,
      4:  0x9db88a, 5:  0xb0c4a0, 6:  0x1a1a2e,
      7:  0xd8eaf8, 8:  0xb05030, 9:  0x2a1a40, 10: 0xe8d880,
    };
    const tint = tints[this.level] || 0xc8e6a0;
    this.cameras.main.setBackgroundColor(tint);
    this.spawnLevelObstacles();
  }

  // ============================================================
  //  FENCE VISUAL  (redrawn each level-up)
  // ============================================================
  drawFence() {
    const H = this.scale.height;
    const fx = this.fenceX;
    if (!this.fenceGfx) return;
    this.fenceGfx.clear();

    const fenceStyles = {
      1:  { post: 0x8b5e3c, plank: 0xb8845a, top: 0xd4a574 }, // wood
      2:  { post: 0x6dad40, plank: 0x8bc34a, top: 0xa5d65a }, // hedge
      3:  { post: 0x4a3728, plank: 0x6b5040, top: 0x5a4030 }, // dark wood (forest)
      4:  { post: 0x707070, plank: 0x909090, top: 0xa0a0a0 }, // stone (mountain)
      5:  { post: 0x2d1b4e, plank: 0x3d2b6e, top: 0x6040c0 }, // purple (night)
      6:  { post: 0x8ab4d0, plank: 0xbde0f0, top: 0xffffff }, // icy (winter)
      7:  { post: 0x703020, plank: 0x904020, top: 0xff6030 }, // lava (volcano)
      8:  { post: 0x5a3080, plank: 0x8050b0, top: 0xc090ff }, // crystal (starry)
      9:  { post: 0xb8860b, plank: 0xdaa520, top: 0xffd700 }, // golden (legend)
    };
    const s = fenceStyles[this.level] || fenceStyles[1];

    // Post every 40px
    for (let y = 0; y <= H; y += 40) {
      this.fenceGfx.fillStyle(s.post, 1);
      this.fenceGfx.fillRect(fx - 5, y, 10, 38);
      this.fenceGfx.fillStyle(s.top, 1);
      this.fenceGfx.fillRect(fx - 6, y, 12, 5);
    }
    // Two horizontal planks
    this.fenceGfx.fillStyle(s.plank, 0.9);
    this.fenceGfx.fillRect(fx - 3, 0, 6, H);
    // Lighter stripe for 3D effect
    this.fenceGfx.fillStyle(s.top, 0.4);
    this.fenceGfx.fillRect(fx - 3, 0, 2, H);
  }

  // ============================================================
  //  LEVEL TERRAIN OBSTACLES  (grid-based even distribution)
  // ============================================================
  spawnLevelObstacles() {
    this.obstacleGfxList.forEach(g => g.destroy());
    this.obstacleGfxList = [];
    this.obstacles.clear(true, true);

    if (this.level < 2) return; // level 1 = open meadow

    const W = this.scale.width, H = this.scale.height;
    const fX = W - 50; // full map width

    // Add invisible static body for collisions
    const place = (x, y, w, h) => {
      const body = this.obstacles.create(x, y, 'blank_px');
      body.setVisible(false);
      body.body.setSize(w, h);
      body.refreshBody();
    };

    // ---- GRID-BASED PLACEMENT ----
    // Divide player zone into a 4x3 grid, place 1 obstacle per picked cell
    const COLS = 4, ROWS = 3;
    const padX = 55, padY = 70;
    const cellW = (fX - padX * 2) / COLS;
    const cellH = (H - padY * 2) / ROWS;
    const bunnyX = W * 0.35, bunnyY = H * 0.5; // approx player start

    // Build shuffled list of grid cell positions
    const cells = [];
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        // Random jitter within cell
        const x = padX + c * cellW + cellW * 0.15 + Math.random() * cellW * 0.7;
        const y = padY + r * cellH + cellH * 0.15 + Math.random() * cellH * 0.7;
        // Skip cells too close to player spawn
        if (Math.hypot(x - bunnyX, y - bunnyY) < 90) continue;
        cells.push({ x, y });
      }
    }
    // Fisher-Yates shuffle
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    // How many obstacles: grows with level
    const count = Math.min(3 + this.level, cells.length);
    const chosen = cells.slice(0, count);

    const drawObstacle = ({ x, y }, idx) => {
      const g = this.add.graphics().setDepth(2);
      this.obstacleGfxList.push(g);

      switch (this.level) {

        case 2: { // 🌸 Spring Garden - flower hedges
          g.fillStyle(0x27ae60); g.fillRoundedRect(x - 32, y - 11, 64, 22, 10);
          g.fillStyle(0xff69b4, 0.9);
          for (let j = 0; j < 7; j++) g.fillCircle(x - 26 + j * 9, y - 11, 7);
          g.fillStyle(0xffffff, 0.3);
          for (let j = 0; j < 7; j++) g.fillCircle(x - 24 + j * 9, y - 14, 3);
          place(x, y, 64, 22);
          break;
        }

        case 3: { // 🌲 Forest - pine trees
          // Shadow
          g.fillStyle(0x000000, 0.12); g.fillEllipse(x + 4, y + 28, 40, 12);
          // Trunk
          g.fillStyle(0x5d4037); g.fillRect(x - 7, y + 4, 14, 30);
          g.fillStyle(0x4e342e, 0.5); g.fillRect(x + 1, y + 4, 4, 30);
          // Canopy layers
          g.fillStyle(0x1b5e20); g.fillTriangle(x, y - 48, x - 32, y + 8, x + 32, y + 8);
          g.fillStyle(0x2e7d32); g.fillTriangle(x, y - 34, x - 26, y + 14, x + 26, y + 14);
          g.fillStyle(0x388e3c); g.fillTriangle(x, y - 18, x - 20, y + 18, x + 20, y + 18);
          g.fillStyle(0xffffff, 0.12); g.fillTriangle(x, y - 48, x - 6, y - 30, x + 6, y - 30);
          place(x, y - 10, 30, 58);
          break;
        }

        case 4: { // 🏔️ Mountain - rocky boulders
          g.fillStyle(0x000000, 0.1); g.fillEllipse(x + 5, y + 18, 66, 14);
          g.fillStyle(0x546e7a); g.fillEllipse(x, y, 64, 42);
          g.fillStyle(0x78909c); g.fillEllipse(x - 4, y - 6, 52, 30);
          g.fillStyle(0xb0bec5, 0.7); g.fillEllipse(x - 14, y - 12, 20, 13);
          g.fillStyle(0xcfd8dc, 0.4); g.fillEllipse(x - 18, y - 15, 9, 6);
          g.fillStyle(0x455a64, 0.5); g.fillEllipse(x + 18, y + 8, 18, 11);
          place(x, y, 58, 38);
          break;
        }

        case 5: { // 🌙 Night - glowing mushroom clusters
          // Big shroom
          g.fillStyle(0xd7ccc8); g.fillRect(x - 6, y + 2, 12, 24);
          g.fillStyle(0xb71c1c); g.fillEllipse(x, y + 2, 38, 22);
          g.fillStyle(0xff1744, 0.3); g.fillEllipse(x, y - 2, 30, 14);
          g.fillStyle(0xffffff, 0.8);
          g.fillCircle(x - 10, y - 1, 4); g.fillCircle(x + 2, y - 4, 3); g.fillCircle(x + 12, y, 4);
          // Medium shroom
          g.fillStyle(0xd7ccc8); g.fillRect(x + 22, y + 8, 8, 16);
          g.fillStyle(0xad1457); g.fillEllipse(x + 26, y + 8, 24, 14);
          g.fillStyle(0xffffff, 0.6); g.fillCircle(x + 20, y + 5, 3); g.fillCircle(x + 28, y + 4, 2);
          // Small shroom
          g.fillStyle(0xd7ccc8); g.fillRect(x - 24, y + 12, 6, 12);
          g.fillStyle(0x880e4f); g.fillEllipse(x - 21, y + 12, 16, 10);
          // Glow effect
          g.fillStyle(0xff4081, 0.08); g.fillCircle(x, y, 38);
          place(x + 4, y + 12, 60, 34);
          break;
        }

        case 6: { // ❄️ Winter - snowy mini mountains
          g.fillStyle(0x000000, 0.08); g.fillEllipse(x + 4, y + 14, 80, 16);
          // Mountain body
          g.fillStyle(0x78909c); g.fillTriangle(x, y - 52, x - 44, y + 14, x + 44, y + 14);
          g.fillStyle(0x90a4ae); g.fillTriangle(x - 10, y - 28, x - 44, y + 14, x + 10, y + 14);
          // Snow cap
          g.fillStyle(0xeceff1); g.fillTriangle(x, y - 52, x - 22, y - 20, x + 22, y - 20);
          g.fillStyle(0xffffff, 0.7); g.fillTriangle(x, y - 52, x - 8, y - 38, x + 8, y - 38);
          // Snow base drift
          g.fillStyle(0xe3f2fd, 0.7); g.fillEllipse(x, y + 14, 75, 16);
          g.fillStyle(0xffffff, 0.4); g.fillEllipse(x - 10, y + 10, 30, 9);
          place(x, y - 14, 68, 64);
          break;
        }

        case 7: { // 🌋 Volcano - lava rock clusters
          g.fillStyle(0x000000, 0.15); g.fillEllipse(x + 3, y + 16, 64, 14);
          g.fillStyle(0x1a0000); g.fillEllipse(x, y, 60, 38);
          g.fillStyle(0x3e2723); g.fillEllipse(x - 4, y - 4, 46, 26);
          g.fillStyle(0xbf360c, 0.9); g.fillEllipse(x - 14, y - 6, 18, 11);
          g.fillStyle(0xff6d00, 0.7); g.fillEllipse(x - 14, y - 9, 12, 7);
          g.fillStyle(0xff8f00, 0.5); g.fillCircle(x - 14, y - 11, 4);
          // Lava crack
          g.lineStyle(2, 0xff3d00, 0.6);
          g.lineBetween(x + 6, y - 8, x + 18, y + 6);
          g.lineBetween(x + 18, y + 6, x + 12, y + 14);
          g.fillStyle(0xff1744, 0.2); g.fillCircle(x + 8, y, 22);
          place(x, y, 54, 34);
          break;
        }

        case 8: { // ⭐ Starry Sky - crystal spires
          const crystalColors = [0x9c27b0, 0x3f51b5, 0x00bcd4, 0xe91e63];
          const offsets = [{ ox: -16, h: 40 }, { ox: 0, h: 56 }, { ox: 14, h: 36 }, { ox: -6, h: 48 }];
          offsets.forEach(({ ox, h: ch }, ci) => {
            g.fillStyle(crystalColors[ci], 0.85);
            g.fillTriangle(x + ox, y - ch, x + ox - 9, y + 6, x + ox + 9, y + 6);
            g.fillStyle(0xffffff, 0.25);
            g.fillTriangle(x + ox, y - ch, x + ox - 3, y - ch + 14, x + ox + 3, y - ch + 14);
            g.fillStyle(crystalColors[ci], 0.3);
            g.fillEllipse(x + ox, y + 6, 18, 6);
          });
          g.fillStyle(0xffffff, 0.06); g.fillCircle(x, y - 20, 42);
          place(x, y - 16, 50, 64);
          break;
        }

        default: { // 👑 Legend (9+) - mix of all terrain
          const type = idx % 4;
          if (type === 0) { // tree
            g.fillStyle(0x000000, 0.1); g.fillEllipse(x + 3, y + 26, 36, 10);
            g.fillStyle(0x5d4037); g.fillRect(x - 6, y + 4, 12, 26);
            g.fillStyle(0x1b5e20); g.fillTriangle(x, y - 42, x - 28, y + 8, x + 28, y + 8);
            g.fillStyle(0x2e7d32); g.fillTriangle(x, y - 28, x - 22, y + 12, x + 22, y + 12);
            place(x, y - 8, 28, 52);
          } else if (type === 1) { // boulder
            g.fillStyle(0x546e7a); g.fillEllipse(x, y, 58, 38);
            g.fillStyle(0x78909c); g.fillEllipse(x - 4, y - 6, 46, 26);
            g.fillStyle(0xb0bec5, 0.6); g.fillEllipse(x - 12, y - 12, 18, 12);
            place(x, y, 52, 34);
          } else if (type === 2) { // snowy mountain
            g.fillStyle(0x78909c); g.fillTriangle(x, y - 48, x - 40, y + 12, x + 40, y + 12);
            g.fillStyle(0xeceff1); g.fillTriangle(x, y - 48, x - 20, y - 18, x + 20, y - 18);
            g.fillStyle(0xe3f2fd, 0.6); g.fillEllipse(x, y + 12, 68, 14);
            place(x, y - 12, 62, 58);
          } else { // crystal
            g.fillStyle(0x9c27b0, 0.85); g.fillTriangle(x, y - 50, x - 12, y + 6, x + 12, y + 6);
            g.fillStyle(0x3f51b5, 0.8); g.fillTriangle(x + 16, y - 36, x + 6, y + 6, x + 26, y + 6);
            g.fillStyle(0xffffff, 0.2); g.fillTriangle(x, y - 50, x - 4, y - 32, x + 4, y - 32);
            place(x + 8, y - 16, 42, 58);
          }
          break;
        }
      }
    };

    chosen.forEach((cell, i) => drawObstacle(cell, i));
  }

  doGameOver() {
    this.isGameOver = true;
    SFX.over();

    if (gameMode === 'multi') {
      socket.emit('game-over', { score: this.score, level: this.level });
    }

    document.getElementById('goScore').textContent = this.score;
    document.getElementById('goLevel').textContent = `Level ${this.level}`;

    if (gameMode === 'multi') {
      const mp = document.getElementById('goMultiplayer');
      mp.innerHTML = `<p style="margin:1rem 0;font-weight:700;">${opponentName}: ${opponentScore} eggs</p>`;
      if (!opponentAlive || this.score > opponentScore) {
        document.getElementById('goTitle').textContent = '🏆 Victory!';
        document.getElementById('goTitle').style.color = '#00b894';
      } else if (this.score < opponentScore) {
        document.getElementById('goTitle').textContent = '😢 Defeat!';
        document.getElementById('goTitle').style.color = '#d63031';
      } else {
        document.getElementById('goTitle').textContent = '🤝 Draw!';
        document.getElementById('goTitle').style.color = '#6c5ce7';
      }
    } else {
      document.getElementById('goTitle').textContent = 'Game Over!';
      document.getElementById('goTitle').style.color = '#d63031';
      document.getElementById('goMultiplayer').innerHTML = '';
    }

    // Submit score to leaderboard
    const playerName = document.getElementById('playerName').value.trim() || 'Player';
    const finalScore = this.score;
    const finalLevel = this.level;
    const finalMode = gameMode === 'multi' ? 'multi' : 'solo';

    submitScore(playerName, finalScore, finalLevel, finalMode).then(result => {
      const rankEl = document.getElementById('goRank');
      if (result) {
        let html = `<span style="color:#636e72">Rang: <strong>#${result.rank}</strong></span>`;
        if (result.isNewBest) {
          html += ` <span class="new-best">⭐ Novi licni rekord!</span>`;
        }
        rankEl.innerHTML = html;
      } else {
        rankEl.innerHTML = '';
      }
      // Refresh leaderboard
      loadLeaderboard(currentLbMode);
    });

    this.time.delayedCall(500, () => showScreen('gameover-screen'));
  }

  updateHUD() {
    document.getElementById('hudScore').textContent = this.score;
    document.getElementById('hudLevel').textContent = this.level;

    let hearts = '';
    for (let i = 0; i < 3; i++) {
      if (this.lives >= i + 1) {
        hearts += '<span class="heart">❤️</span>';
      } else if (this.lives >= i + 0.5) {
        hearts += '<span class="heart half">🩷</span>';
      } else {
        hearts += '<span class="heart lost">🖤</span>';
      }
    }
    document.getElementById('hudHearts').innerHTML = hearts;

    const si = document.getElementById('shieldIndicator');
    if (this.shieldTimer > 0) si.classList.add('active');
    else si.classList.remove('active');

    const threshold = this.getCarrotThreshold();
    document.getElementById('carrotText').textContent = `${this.eggsSinceCarrot}/${threshold}`;
    document.getElementById('carrotBarFill').style.width = `${(this.eggsSinceCarrot / threshold) * 100}%`;

    if (gameMode === 'multi') {
      const ms = document.getElementById('mpScores');
      ms.style.display = 'flex';
      ms.innerHTML = `
        <div class="mp-score-card self">Ti: ${this.score} 🥚</div>
        <div class="mp-score-card">${opponentName}: ${opponentScore} 🥚</div>`;
    }
  }

  // ============================================================
  //  MAIN UPDATE - 60fps
  // ============================================================
  update(time, delta) {
    if (this.isGameOver || gamePaused) return;
    this.totalTime += delta;

    // ---- MOVEMENT ----
    const baseSpeed = 260;
    const speed = this.speedBoostTimer > 0 ? baseSpeed * 1.6 : baseSpeed;
    let vx = 0, vy = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) { vx = -speed; this.bunny.dir = -1; }
    if (this.cursors.right.isDown || this.wasd.right.isDown) { vx = speed; this.bunny.dir = 1; }
    if (this.cursors.up.isDown || this.wasd.up.isDown) vy = -speed;
    if (this.cursors.down.isDown || this.wasd.down.isDown) vy = speed;

    // Mobile joystick input (adds to keyboard, whichever is active)
    if (this.touchDir && (this.touchDir.x !== 0 || this.touchDir.y !== 0)) {
      const deadzone = 0.15;
      const tx = Math.abs(this.touchDir.x) > deadzone ? this.touchDir.x : 0;
      const ty = Math.abs(this.touchDir.y) > deadzone ? this.touchDir.y : 0;
      if (tx !== 0 || ty !== 0) {
        vx = tx * speed;
        vy = ty * speed;
        if (tx < -deadzone) this.bunny.dir = -1;
        else if (tx > deadzone) this.bunny.dir = 1;
      }
    }

    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
    this.bunny.setVelocity(vx, vy);
    this.bunny.setFlipX(this.bunny.dir === -1);

// ---- TIMERS ----
    if (this.invTimer > 0) this.invTimer -= delta;
    if (this.shieldTimer > 0) {
      this.shieldTimer -= delta;
    }
    if (this.speedBoostTimer > 0) this.speedBoostTimer -= delta;
    if (this.magnetTimer > 0) this.magnetTimer -= delta;
    if (this.freezeTimer > 0) this.freezeTimer -= delta;

    // Combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.comboMultiplier = 1;
      }
    }

    // ---- HARD MODE TRIGGER (score >= 200) ----
    if (this.score >= 200 && !this.hardModeAnnounced) {
      this.hardModeAnnounced = true;
      showToast('⚠️ HARD MODE! Chickens resist abilities!');
      this.cameras.main.flash(500, 255, 40, 40, false);
      this.shakeScreen(400);
      this.addPopup(this.bunny.x, this.bunny.y - 60, '⚠️ HARD MODE!', '#e74c3c');
    }

    // ---- ABILITY KEYS (1-4) ----
    for (let i = 0; i < 4; i++) {
      if (Phaser.Input.Keyboard.JustDown(this.abilityKeys[i])) {
        this.useAbility(i);
      }
    }

    // Update ability bar cooldown display (~every frame is fine)
    this.updateAbilityBar(delta);

    // ---- COMBO DISPLAY ----
    if (this.comboMultiplier > 1) {
      this.comboText.setText(`COMBO x${this.comboMultiplier}`);
      this.comboText.setAlpha(0.9);
      this.comboText.setScale(1 + Math.sin(time * 0.008) * 0.1);
    } else {
      this.comboText.setAlpha(0);
    }

    // Timer display
    const secs = Math.floor(this.totalTime / 1000);
    const mins = Math.floor(secs / 60);
    this.timerText.setText(`${mins}:${String(secs % 60).padStart(2, '0')}`);

    // ---- SHIELD VISUAL ----
    this.shieldCircle.clear();
    if (this.shieldTimer > 0) {
      const pulse = 38 + Math.sin(time * 0.006) * 4;
      this.shieldCircle.lineStyle(2, 0xf39c12, 0.5);
      this.shieldCircle.strokeCircle(this.bunny.x, this.bunny.y - 5, pulse);
    }

    // ---- EFFECTS VISUAL ----
    this.effectGfx.clear();
    if (this.speedBoostTimer > 0) {
      // Speed trail
      this.effectGfx.fillStyle(0x00cec9, 0.15);
      for (let i = 1; i <= 3; i++) {
        this.effectGfx.fillCircle(
          this.bunny.x - vx * 0.02 * i,
          this.bunny.y - vy * 0.02 * i,
          8 - i * 2
        );
      }
    }
    if (this.magnetTimer > 0) {
      // Magnet range ring
      const mPulse = 100 + Math.sin(time * 0.005) * 10;
      this.effectGfx.lineStyle(1.5, 0xe74c3c, 0.2);
      this.effectGfx.strokeCircle(this.bunny.x, this.bunny.y, mPulse);
    }
    if (this.freezeTimer > 0) {
      // Frost overlay on screen edges
      this.effectGfx.fillStyle(0x74b9ff, 0.06);
      this.effectGfx.fillRect(0, 0, this.scale.width, this.scale.height);
    }

    // ---- MAGNET: attract eggs ----
    if (this.magnetTimer > 0) {
      this.eggs.getChildren().forEach(egg => {
        const d = Phaser.Math.Distance.Between(this.bunny.x, this.bunny.y, egg.x, egg.y);
        if (d < 120) {
          const angle = Phaser.Math.Angle.Between(egg.x, egg.y, this.bunny.x, this.bunny.y);
          const pull = 200 * (1 - d / 120);
          egg.body.setVelocity(Math.cos(angle) * pull, Math.sin(angle) * pull);
        }
      });
    }

    // ---- WARNINGS ----
    this.warnGfx.clear();
    for (let i = this.warnings.length - 1; i >= 0; i--) {
      const w = this.warnings[i];
      w.timer -= delta;
      if (w.timer <= 0) {
        this.actuallySpawnChicken(w.sx, w.sy);
        this.warnings.splice(i, 1);
        continue;
      }
      const progress = w.timer / w.max;
      const alpha = 0.3 + Math.sin(time * 0.012) * 0.3;
      const size = 18 + (1 - progress) * 14;
      this.warnGfx.lineStyle(3, 0xe74c3c, alpha);
      this.warnGfx.strokeCircle(w.x, w.y, size);
      this.warnGfx.fillStyle(0xe74c3c, alpha);
      this.warnGfx.fillRect(w.x - 1.5, w.y - 8, 3, 10);
      this.warnGfx.fillCircle(w.x, w.y + 6, 2);
    }

    // ---- ANGRY TIMER ----
    if (this.angryTimer > 0) this.angryTimer -= delta;

    // ---- CARROT THROW COOLDOWN ----
    if (this.carrotThrowCd > 0) this.carrotThrowCd -= delta;

    // ---- SPACE = THROW CARROT ----
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && this.carrotThrowCd <= 0) {
      this.throwCarrot();
    }

    // ---- CHICKENS CHASE (with separation so they spread out) ----
    const frozen = this.freezeTimer > 0;
    const hardMode = this.score >= 200;
    const angry = this.angryTimer > 0;
    const allChickens = this.chickens.getChildren();
    allChickens.forEach((c, idx) => {
      if (!c.active) return;

      // ---- STUN (from carrot hit) ----
      if (c.stunTimer > 0) {
        c.stunTimer -= delta;
        c.setVelocity(0, 0);
        c.setTint(0xf39c12);
        return;
      }

      if (frozen) {
        if (hardMode) {
          c.setTint(0xa8d8ff);
        } else {
          c.setVelocity(0, 0);
          c.setTint(0x74b9ff);
          return;
        }
      } else if (angry) {
        c.setTint(c.isBoss ? 0xff0000 : 0xff4444); // red tint in angry mode
      } else {
        c.clearTint();
      }

      // ---- DASH TIMER ----
      if (!c.isBoss) {
        if (c.dashActive > 0) {
          c.dashActive -= delta;
        } else {
          c.dashTimer -= delta;
          if (c.dashTimer <= 0) {
            c.dashActive = 500 + Math.random() * 300; // dash lasts 0.5-0.8s
            c.dashTimer = 3000 + Math.random() * 5000;
            c.setTint(0xe74c3c);
            this.spawnBurst(c.x, c.y, 0xe74c3c, 5);
          }
        }
      }

      // ---- EGG THROW (chickens + boss) ----
      if (c.throwTimer !== undefined) {
        c.throwTimer -= delta;
        if (c.throwTimer <= 0) {
          this.chickenThrowEgg(c);
          c.throwTimer = c.isBoss
            ? 1800 + Math.random() * 1200
            : 5000 + Math.random() * 4000;
        }
      }

      // Direction toward bunny
      let dx = this.bunny.x - c.x;
      let dy = this.bunny.y - c.y;
      const d = Math.hypot(dx, dy) || 1;

      // Separation force
      let sepX = 0, sepY = 0;
      allChickens.forEach((other, j) => {
        if (j === idx || !other.active) return;
        const ox = c.x - other.x;
        const oy = c.y - other.y;
        const od = Math.hypot(ox, oy) || 1;
        if (od < 80) {
          const force = (80 - od) / 80;
          sepX += (ox / od) * force;
          sepY += (oy / od) * force;
        }
      });

      const wobble = Math.sin(time * 0.003 + idx * 2.5) * 0.25;
      const scoreSpeedBonus = hardMode ? Math.min(60, Math.floor(this.score / 200) * 8) : 0;
      const freezeSlow = (frozen && hardMode) ? 0.3 : 1.0;
      const angryBoost = angry ? 1.45 : 1.0;
      const dashBoost = (c.dashActive > 0) ? 3.0 : 1.0;

      const chaseX = dx / d;
      const chaseY = dy / d;
      const spd = (c.speed + scoreSpeedBonus) * freezeSlow * angryBoost * dashBoost;
      const finalX = (chaseX + sepX * 0.6 + wobble * chaseY) * spd;
      const finalY = (chaseY + sepY * 0.6 - wobble * chaseX) * spd;

      c.setVelocity(finalX, finalY);
      c.setFlipX(dx < 0);
    });

    // ---- BOSS HP TEXT FOLLOW ----
    if (this.boss && this.boss.active && this.boss.hpText) {
      this.boss.hpText.setPosition(this.boss.x, this.boss.y - 60);
    }

    // ---- CHICKEN PROJECTILES MOVEMENT + CLEANUP ----
    this.chickenProjs.getChildren().forEach(p => {
      if (!p.active) return;
      p.life -= delta;
      if (p.life <= 0) p.destroy();
    });

    // ---- CARROT PROJECTILES MOVEMENT + CLEANUP ----
    this.carrotProjs.getChildren().forEach(p => {
      if (!p.active) return;
      p.life -= delta;
      p.angle += 12;
      if (p.life <= 0) p.destroy();
    });

    // ---- GRASS (darker green) ----
    this.grassGfx.clear();
    this.grassGfx.lineStyle(2, 0x4a8a30);
    for (const gt of this.grassTufts) {
      const sway = Math.sin(time * 0.001 + gt.x * 0.1) * 3;
      this.grassGfx.lineBetween(gt.x, gt.y, gt.x + sway, gt.y - gt.h);
      this.grassGfx.lineBetween(gt.x - 3, gt.y, gt.x - 3 + sway, gt.y - gt.h * 0.8);
      this.grassGfx.lineBetween(gt.x + 3, gt.y, gt.x + 3 + sway, gt.y - gt.h * 0.9);
    }

    // ---- PARTICLES ----
    this.partGfx.clear();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      const alpha = p.life / p.maxLife;
      this.partGfx.fillStyle(p.color, alpha);
      this.partGfx.fillCircle(p.x, p.y, p.r * alpha);
    }

    // ---- SPAWNING ----
    // Eggs: more eggs on screen as levels grow (both zones)
    const maxEggs = Math.min(4 + this.level, 14);
    while (this.eggs.countActive() < maxEggs) this.spawnEgg();

    // Chickens: fast spawn, scales with level + score
    this.chickenSpawnCooldown -= delta;
    if (this.chickenSpawnCooldown <= 0) {
      const scoreSpeedUp = Math.min(3000, Math.floor(this.score / 50) * 200);
      const minCooldown = Math.max(1500, 7000 - this.level * 500 - scoreSpeedUp);
      this.chickenSpawnCooldown = minCooldown + Math.random() * 1500;
      this.spawnChickenWithWarning();
    }

    // Golden egg - from level 2, ~every 20s
    if (this.level >= 2 && Math.random() < 0.0003) {
      const goldenCount = this.eggs.getChildren().filter(e => e.isGolden).length;
      if (goldenCount < 1) this.spawnGoldenEgg();
    }

    // Floor powerups removed — abilities are now on hotbar keys 1-4

    // Half-heart pickup: every 20s when score >= 100 and lives < 3
    if (this.score >= 100 && this.lives < 3.0) {
      this.heartPickupTimer -= delta;
      if (this.heartPickupTimer <= 0) {
        this.heartPickupTimer = 20000;
        if (this.hearts.countActive() === 0) this.spawnHalfHeart();
      }
    } else {
      // Reset timer so it's ready when conditions are met
      if (this.heartPickupTimer <= 0) this.heartPickupTimer = 20000;
    }

    // Particle cap
    if (this.particles.length > 80) {
      this.particles.splice(0, this.particles.length - 80);
    }

    // ---- ANIMATED BUNNY (redraw canvas texture every frame) ----
    const bCtx = this.bunnyCtx2D;
    const bt = this.totalTime / 16.67; // convert ms to ~frame counter
    bCtx.clearRect(0, 0, 82, 102);
    BunnyDraw.drawBunny(bCtx, 41, 68, 0.72, bt, {
      hasShield: this.shieldTimer > 0,
      showEgg: false,
    });
    this.bunnyCanvasTex.refresh();

    // ---- MULTIPLAYER SYNC ----
    if (gameMode === 'multi' && Math.floor(time / 200) !== Math.floor((time - delta) / 200)) {
      socket.emit('game-update', { score: this.score, lives: this.lives, level: this.level });
    }
  }
}

// ============================================================
//  START / STOP
// ============================================================
function startGame() {
  if (phaserGame) { phaserGame.destroy(true); phaserGame = null; }
  document.getElementById('phaser-game').innerHTML = '';

  phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'phaser-game',
    backgroundColor: '#c8e6a0',
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
    input: { touch: { capture: false } },
    scene: [GameScene],
    fps: {
      target: 60,
      forceSetTimeOut: false,
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      pixelArt: false,
    },
  });

  showScreen('game-screen');

  // Show tutorial if not skipped
  const skipTut = localStorage.getItem('skipTutorial') === 'true';
  if (!skipTut) {
    gamePaused = true;
    document.getElementById('tutorial-overlay').classList.remove('hidden');
  } else {
    gamePaused = false;
  }
}

// Store versus data globally so scene can access it
let pendingVersusData = null;

function startVersusGame(data) {
  if (phaserGame) { phaserGame.destroy(true); phaserGame = null; }
  document.getElementById('phaser-game').innerHTML = '';
  pendingVersusData = data;

  phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'phaser-game',
    backgroundColor: '#c8e6a0',
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: [VersusScene],
    fps: { target: 60 },
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true },
  });

  showScreen('game-screen');
}

function startEggFight(data) {
  if (phaserGame) { phaserGame.destroy(true); phaserGame = null; }
  document.getElementById('phaser-game').innerHTML = '';

  const myName = document.getElementById('playerName').value.trim() || 'Player';
  const oppPlayer = data.players.find(p => p.name !== myName);
  const oppName = oppPlayer ? oppPlayer.name : 'Opponent';

  phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'phaser-game',
    backgroundColor: '#5a3d1a',
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: [EggFightScene],
    fps: { target: 60 },
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true },
  });

  // Pass data to scene via registry
  phaserGame.registry.set('eggFightData', {
    myName,
    oppName,
    playerIndex,
  });

  showScreen('game-screen');
  // Hide HUD elements not needed for egg fight
  document.getElementById('abilityBar').style.display = 'none';
  document.getElementById('mpScores').style.display = 'none';
  document.getElementById('carrotProgress').style.display = 'none';
  document.getElementById('shieldIndicator').style.display = 'none';
  document.getElementById('mobileJoystick').style.display = 'none';
  const hud = document.querySelector('.game-hud');
  if (hud) hud.style.display = 'none';
}

function stopGame() {
  if (phaserGame) { phaserGame.destroy(true); phaserGame = null; }
  document.getElementById('phaser-game').innerHTML = '';
  gamePaused = false;
  // Restore HUD elements that egg fight may have hidden
  document.getElementById('carrotProgress').style.display = '';
  document.getElementById('shieldIndicator').style.display = '';
  document.getElementById('mobileJoystick').style.display = '';
  const hud = document.querySelector('.game-hud');
  if (hud) hud.style.display = '';
  // Clean up egg fight socket listeners
  socket.off('egg-fight-result');
  socket.off('egg-fight-over');
}

// Tutorial start button
document.getElementById('btnTutorialStart').addEventListener('click', () => {
  ensureAudio(); SFX.click();
  document.getElementById('tutorial-overlay').classList.add('hidden');
  gamePaused = false;
  if (document.getElementById('skipTutorial').checked) {
    localStorage.setItem('skipTutorial', 'true');
  }
});

// ============================================================
//  PAUSE (ESC)
// ============================================================
function togglePause() {
  const pauseEl = document.getElementById('pause-overlay');
  const gameScreen = document.getElementById('game-screen');
  if (gameScreen.classList.contains('hidden')) return; // not in game
  if (!phaserGame) return;

  if (gamePaused) {
    // Resume
    gamePaused = false;
    pauseEl.classList.add('hidden');
  } else {
    // Pause
    gamePaused = true;
    pauseEl.classList.remove('hidden');
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    togglePause();
  }
});

document.getElementById('btnResume').addEventListener('click', () => {
  ensureAudio(); SFX.click();
  gamePaused = false;
  document.getElementById('pause-overlay').classList.add('hidden');
});

document.getElementById('btnPauseMenu').addEventListener('click', () => {
  ensureAudio(); SFX.click();
  gamePaused = false;
  document.getElementById('pause-overlay').classList.add('hidden');
  stopGame();
  socket.emit('leave-room');
  showScreen('menu-screen');
  loadLeaderboard(currentLbMode);
});

// ============================================================
//  MENU BUTTONS
// ============================================================
document.getElementById('btnSingle').addEventListener('click', () => {
  ensureAudio(); SFX.click();
  gameMode = 'single';
  document.getElementById('mpScores').style.display = 'none';
  startGame();
});

document.getElementById('btnCreateRoom').addEventListener('click', () => {
  ensureAudio(); SFX.click();
  socket.emit('create-room', document.getElementById('playerName').value.trim() || 'Player');
});

document.getElementById('btnJoinRoom').addEventListener('click', () => {
  ensureAudio(); SFX.click();
  const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
  if (code.length < 3) { document.getElementById('roomError').textContent = 'Unesi validan kod!'; return; }
  socket.emit('join-room', { code, playerName: document.getElementById('playerName').value.trim() || 'Player' });
});

document.getElementById('btnRestart').addEventListener('click', () => {
  ensureAudio(); SFX.click();
  if (gameMode === 'multi' || gameMode === 'versus' || gameMode === 'eggfight') { stopGame(); socket.emit('leave-room'); showScreen('menu-screen'); }
  else startGame();
});

document.getElementById('btnMenu').addEventListener('click', () => {
  ensureAudio(); SFX.click();
  stopGame(); socket.emit('leave-room'); showScreen('menu-screen');
  loadLeaderboard(currentLbMode);
});

document.getElementById('btnReady').addEventListener('click', () => {
  ensureAudio(); SFX.click();
  socket.emit('player-ready');
  document.getElementById('btnReady').disabled = true;
  document.getElementById('btnReady').textContent = 'Waiting...';
});

document.getElementById('btnLeave').addEventListener('click', () => {
  ensureAudio(); SFX.click();
  socket.emit('leave-room'); showScreen('menu-screen');
});

// ============================================================
//  SOCKET.IO
// ============================================================
let selectedMode = 'classic';

// Mode selector buttons
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMode = btn.dataset.mode;
    socket.emit('set-mode', selectedMode);
    const desc = document.getElementById('modeDesc');
    if (selectedMode === 'versus') {
      desc.textContent = '🐰 vs 🐔 One player is the bunny, one is the chicken! Best of 5 rounds, sides swap.';
    } else if (selectedMode === 'eggfight') {
      desc.textContent = '🥚💥 Easter egg tapping! Tap at the right moment for maximum power. Best of 5 rounds!';
    } else {
      desc.textContent = 'Both collect eggs - whoever gets more wins!';
    }
  });
});

function showLobbyWith2Players() {
  document.getElementById('waitingText').style.display = 'none';
  document.getElementById('modeSelector').style.display = 'block';
  const btn = document.getElementById('btnReady');
  btn.style.display = 'inline-flex'; btn.disabled = false; btn.textContent = "I'm Ready!";
}

socket.on('room-created', ({ code, playerIndex: pi }) => {
  playerIndex = pi; roomCode = code;
  showScreen('lobby-screen');
  document.getElementById('roomCodeDisplay').textContent = code;
  updateLobby([document.getElementById('playerName').value.trim() || 'Player']);
  document.getElementById('waitingText').style.display = 'block';
  document.getElementById('modeSelector').style.display = 'none';
  document.getElementById('btnReady').style.display = 'none';
});

socket.on('room-joined', ({ code, playerIndex: pi, opponent }) => {
  playerIndex = pi; roomCode = code; opponentName = opponent;
  showScreen('lobby-screen');
  document.getElementById('roomCodeDisplay').textContent = code;
  updateLobby([opponent, document.getElementById('playerName').value.trim() || 'Player']);
  showLobbyWith2Players();
});

socket.on('opponent-joined', (name) => {
  opponentName = name;
  updateLobby([document.getElementById('playerName').value.trim() || 'Player', name]);
  showLobbyWith2Players();
  showToast(`${name} joined!`);
});

socket.on('mode-set', (mode) => {
  selectedMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
});

// Classic mode start
socket.on('game-start', () => {
  gameMode = 'multi';
  document.getElementById('mpScores').style.display = 'flex';
  startGame();
  showToast('Game starting! 🎮');
});

// Versus mode start
socket.on('versus-start', (data) => {
  gameMode = 'versus';
  document.getElementById('mpScores').style.display = 'none';

  // Determine my role
  const myName = document.getElementById('playerName').value.trim() || 'Player';
  const myPlayer = data.players.find(p => p.name === myName);
  const myRole = myPlayer ? myPlayer.role : data.players[playerIndex].role;

  startVersusGame({
    myRole,
    round: data.round,
    maxRounds: data.maxRounds,
    roundTime: data.roundTime,
    eggs: data.eggs,
    mapW: data.mapW,
    mapH: data.mapH,
    eggsToWin: data.eggsToWin,
    players: data.players,
    isTiebreaker: false,
  });
  showToast(`Round 1 - You are ${myRole === 'bunny' ? '🐰 Bunny' : '🐔 Chicken'}!`);
});

// Egg Fight mode start
socket.on('eggfight-start', (data) => {
  gameMode = 'eggfight';
  startEggFight(data);
  showToast('Egg Fight! 🥚💥');
});

socket.on('opponent-update', (d) => { opponentScore = d.score || 0; });
socket.on('opponent-game-over', (d) => { opponentAlive = false; opponentScore = d.score || 0; showToast(`${opponentName} lost!`); });

socket.on('opponent-left', () => {
  showToast(`${opponentName} left the game`);
  if (phaserGame) {
    if (gameMode === 'eggfight') {
      stopGame(); showScreen('menu-screen');
    } else {
      const sc = phaserGame.scene.getScene('GameScene');
      if (sc && !sc.isGameOver) sc.doGameOver();
      else { stopGame(); showScreen('menu-screen'); }
    }
  } else showScreen('menu-screen');
});

socket.on('room-error', (msg) => {
  document.getElementById('roomError').textContent = msg;
  setTimeout(() => { document.getElementById('roomError').textContent = ''; }, 3000);
});

function updateLobby(names) {
  const list = document.getElementById('playerList');
  list.innerHTML = '';
  names.forEach(name => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="status-dot"></span> ${name}`;
    list.appendChild(li);
  });
}

const funNames = ['ZecBrzi', 'JajeLov', 'MrkvaCar', 'BunnyKing', 'EggHunter', 'ZekiPeki'];
document.getElementById('playerName').value = funNames[Phaser.Math.Between(0, funNames.length - 1)];
