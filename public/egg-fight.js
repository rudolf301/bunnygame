// ============================================================
//  EGG FIGHT - Tucanje jaja! Best of 5 rounds
// ============================================================

class EggFightScene extends Phaser.Scene {
  constructor() { super('EggFightScene'); }

  init(data) {
    // Data can come from scene start or from game registry
    const reg = this.registry ? this.registry.get('eggFightData') : null;
    const d = data && data.myName ? data : (reg || {});
    this.myName    = d.myName    || 'Player 1';
    this.oppName   = d.oppName   || 'Player 2';
    this.playerIdx = d.playerIndex || 0;
    this.roundNum  = 1;
    this.maxRounds = 5;
    this.myWins    = 0;
    this.oppWins   = 0;
    this.state     = 'waiting'; // waiting | countdown | tapping | sent | result
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.W = W;  this.H = H;

    // ---- BACKGROUND: wooden table ----
    this.add.rectangle(W / 2, H / 2, W, H, 0x8b6914);
    const wood = this.add.graphics();
    wood.lineStyle(1, 0x7a5c12, 0.25);
    for (let y = 0; y < H; y += 18) {
      wood.lineBetween(0, y + Math.sin(y * 0.08) * 6, W, y + Math.cos(y * 0.08) * 6);
    }
    // Cloth napkin
    this.add.rectangle(W / 2, H * 0.46, W * 0.55, H * 0.42, 0xc0392b, 0.12);

    // ---- VS BANNER ----
    this.add.text(W / 2, H * 0.07, '🥚 EGG FIGHT! 🥚', {
      fontFamily: 'Fredoka One, sans-serif', fontSize: '34px',
      color: '#ffd700', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(20);

    // ---- SCORE ----
    this.scoreText = this.add.text(W / 2, H * 0.15, `${this.myName}  0 - 0  ${this.oppName}`, {
      fontFamily: 'Nunito, sans-serif', fontSize: '24px', fontStyle: 'bold',
      color: '#fff', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(20);

    // ---- ROUND ----
    this.roundText = this.add.text(W / 2, H * 0.21, 'Round 1 / 5', {
      fontFamily: 'Nunito, sans-serif', fontSize: '16px',
      color: '#ffeaa7', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);

    // ---- EGGS (drawn via Graphics) ----
    this.myEggGfx  = this.add.graphics().setDepth(10);
    this.oppEggGfx = this.add.graphics().setDepth(10);
    this.myEggX  = W * 0.30;  this.myEggY  = H * 0.46;
    this.oppEggX = W * 0.70;  this.oppEggY = H * 0.46;
    this.myEggColor  = 0x6c5ce7;
    this.oppEggColor = 0xe74c3c;
    this.myCracks  = [];
    this.oppCracks = [];
    this.drawEgg(this.myEggGfx,  this.myEggX,  this.myEggY,  this.myEggColor,  1, this.myCracks);
    this.drawEgg(this.oppEggGfx, this.oppEggX, this.oppEggY, this.oppEggColor, 1, this.oppCracks);

    // Names
    this.add.text(this.myEggX,  this.myEggY + 85, '⬇ ' + this.myName, {
      fontFamily: 'Nunito', fontSize: '18px', fontStyle: 'bold',
      color: '#c8a2ff', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);
    this.add.text(this.oppEggX, this.oppEggY + 85, this.oppName + ' ⬇', {
      fontFamily: 'Nunito', fontSize: '18px', fontStyle: 'bold',
      color: '#ff7675', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);

    // ---- POWER BAR ----
    this.barX = W * 0.18;  this.barY = H * 0.78;
    this.barW = W * 0.64;  this.barH = 28;
    this.barGfx = this.add.graphics().setDepth(15);
    this.markerPos = 0;     // 0..1
    this.markerDir = 1;
    this.markerSpeed = 1.6;

    // Instruction
    this.tapText = this.add.text(W / 2, H * 0.72, '', {
      fontFamily: 'Nunito', fontSize: '22px', fontStyle: 'bold',
      color: '#ffd700', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(20);

    // Center announcement (3-2-1-TAP)
    this.announce = this.add.text(W / 2, H * 0.38, '', {
      fontFamily: 'Fredoka One', fontSize: '72px',
      color: '#ffd700', stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(30).setAlpha(0);

    // Power shown after tap
    this.powerLabel = this.add.text(W / 2, H * 0.88, '', {
      fontFamily: 'Nunito', fontSize: '16px',
      color: '#dfe6e9', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(20);

    // Particles
    this.particles = [];
    this.partGfx = this.add.graphics().setDepth(25);

    // Input
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.on('pointerdown', () => { if (this.state === 'tapping') this.playerTap(); });

    // Socket
    this.setupSocket();
    this.startRound();
  }

  // ============================================================
  //  EGG DRAWING (decorative Easter egg with optional cracks)
  // ============================================================
  drawEgg(gfx, cx, cy, baseColor, scale, cracks) {
    gfx.clear();
    const w = 64 * scale, h = 88 * scale;

    // Shadow
    gfx.fillStyle(0x000000, 0.13);
    gfx.fillEllipse(cx + 4, cy + h * 0.47, w * 0.65, 10);

    // Body
    gfx.fillStyle(baseColor);
    gfx.fillEllipse(cx, cy, w, h);

    // Highlight
    gfx.fillStyle(0xffffff, 0.22);
    gfx.fillEllipse(cx - w * 0.14, cy - h * 0.22, w * 0.36, h * 0.32);

    // Decorative band (horizontal stripe)
    gfx.fillStyle(0xffffff, 0.15);
    gfx.fillEllipse(cx, cy + 2, w * 0.92, h * 0.12);

    // Dots around band
    gfx.fillStyle(0xffffff, 0.3);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      gfx.fillCircle(cx + Math.cos(a) * w * 0.28, cy + Math.sin(a) * h * 0.06, 3.5 * scale);
    }

    // Zigzag
    gfx.lineStyle(2 * scale, 0xffffff, 0.2);
    gfx.beginPath();
    for (let i = 0; i < 9; i++) {
      const px = cx - w * 0.38 + (w * 0.76 / 8) * i;
      const py = cy + h * 0.14 + (i % 2 === 0 ? -5 : 5) * scale;
      if (i === 0) gfx.moveTo(px, py); else gfx.lineTo(px, py);
    }
    gfx.strokePath();

    // Stars
    gfx.fillStyle(0xffd700, 0.25);
    gfx.fillStar(cx - 10, cy - h * 0.25, 5, 6, 3);
    gfx.fillStar(cx + 14, cy - h * 0.18, 5, 5, 2.5);

    // Cracks
    if (cracks.length > 0) {
      gfx.lineStyle(3, 0x111111, 0.85);
      cracks.forEach(cr => {
        gfx.beginPath();
        cr.forEach((pt, i) => {
          const px = cx + pt.x * scale, py = cy + pt.y * scale;
          if (i === 0) gfx.moveTo(px, py); else gfx.lineTo(px, py);
        });
        gfx.strokePath();
      });
      // White edge (crack highlight)
      gfx.lineStyle(1, 0xffffff, 0.25);
      cracks.forEach(cr => {
        gfx.beginPath();
        cr.forEach((pt, i) => {
          const px = cx + pt.x * scale + 1, py = cy + pt.y * scale - 1;
          if (i === 0) gfx.moveTo(px, py); else gfx.lineTo(px, py);
        });
        gfx.strokePath();
      });
    }
  }

  genCrack() {
    const pts = [];
    let x = Phaser.Math.Between(-8, 8);
    let y = Phaser.Math.Between(-28, -8);
    pts.push({ x, y });
    const n = Phaser.Math.Between(3, 6);
    for (let i = 0; i < n; i++) {
      x += Phaser.Math.Between(-18, 18);
      y += Phaser.Math.Between(5, 16);
      pts.push({ x, y });
    }
    return pts;
  }

  // ============================================================
  //  ROUND FLOW
  // ============================================================
  startRound() {
    this.state = 'countdown';
    this.markerPos = 0;
    this.markerDir = 1;
    this.markerSpeed = 1.6 + (this.roundNum - 1) * 0.35;
    this.roundText.setText(`Round ${this.roundNum} / ${this.maxRounds}`);
    this.tapText.setText('');
    this.powerLabel.setText('');
    this.barGfx.clear();

    const steps = ['3', '2', '1', 'TAP!'];
    steps.forEach((txt, i) => {
      this.time.delayedCall(i * 750, () => {
        if (this.state !== 'countdown') return;
        this.announce.setText(txt).setAlpha(1).setScale(1.6);
        this.announce.setColor(txt === 'TAP!' ? '#ff6b6b' : '#ffd700');
        this.tweens.add({
          targets: this.announce, scaleX: 1, scaleY: 1,
          duration: 500, ease: 'Back.easeOut',
        });
        if (txt !== 'TAP!') {
          this.tweens.add({ targets: this.announce, alpha: 0.15, delay: 400, duration: 250 });
        }
        if (txt === 'TAP!') {
          this.state = 'tapping';
          this.tapText.setText('🔨 Press SPACE or TAP!');
          this.tweens.add({ targets: this.announce, alpha: 0, delay: 500, duration: 300 });
        }
      });
    });
  }

  playerTap() {
    if (this.state !== 'tapping') return;
    this.state = 'sent';
    const power = Math.round(100 - Math.abs(this.markerPos - 0.5) * 200);
    this.tapText.setText(`Power: ${power}% — Waiting for opponent...`);
    this.barGfx.clear();
    socket.emit('egg-fight-tap', { power });
  }

  // ============================================================
  //  SOCKET
  // ============================================================
  setupSocket() {
    socket.on('egg-fight-result', (data) => this.showCollision(data));
    socket.on('egg-fight-over',   (data) => {
      this.time.delayedCall(2200, () => {
        const iWon = data.winner === this.playerIdx;
        const title = data.winner === -1 ? '🤝 Draw!' : iWon ? '🏆 Victory!' : '😢 Defeat!';
        const color = data.winner === -1 ? '#6c5ce7' : iWon ? '#00b894' : '#d63031';
        document.getElementById('goTitle').textContent = title;
        document.getElementById('goTitle').style.color  = color;
        document.getElementById('goScore').textContent   = `${data.scores[0]} - ${data.scores[1]}`;
        document.getElementById('goLevel').textContent   = `${data.players[0]} vs ${data.players[1]}`;
        document.getElementById('goMultiplayer').innerHTML = '';
        document.getElementById('goRank').innerHTML = '';
        showScreen('gameover-screen');
        // cleanup listeners
        socket.off('egg-fight-result');
        socket.off('egg-fight-over');
      });
    });
  }

  // ============================================================
  //  COLLISION ANIMATION
  // ============================================================
  showCollision(data) {
    this.state = 'result';
    const mi = this.playerIdx, oi = 1 - mi;
    const myPow = data.powers[mi], opPow = data.powers[oi];
    const iWon = data.winner === mi;
    const draw = data.winner === -1;

    this.tapText.setText('');
    this.barGfx.clear();

    const cx = this.W / 2, cy = this.H * 0.46;
    const omx = this.myEggX, oox = this.oppEggX;

    // 1) Eggs move toward center
    this.tweens.add({
      targets: { v: 0 }, v: 1,
      duration: 380, ease: 'Quad.easeIn',
      onUpdate: (tw) => {
        const v = tw.getValue();
        this.drawEgg(this.myEggGfx,  Phaser.Math.Linear(omx, cx - 32, v), cy, this.myEggColor,  1, this.myCracks);
        this.drawEgg(this.oppEggGfx, Phaser.Math.Linear(oox, cx + 32, v), cy, this.oppEggColor, 1, this.oppCracks);
      },
      onComplete: () => {
        // 2) IMPACT
        this.cameras.main.shake(350, 0.025);
        // Particles
        for (let i = 0; i < 35; i++) {
          this.particles.push({
            x: cx, y: cy,
            vx: (Math.random() - 0.5) * 14,
            vy: -Math.random() * 9 - 2,
            life: 30 + Math.random() * 22, maxLife: 52,
            color: [0xffd700, 0xffffff, 0xff6b6b, 0x6c5ce7][Math.floor(Math.random() * 4)],
            r: 2 + Math.random() * 5,
          });
        }

        // Crack on loser
        if (!draw) {
          if (iWon) this.oppCracks.push(this.genCrack());
          else      this.myCracks.push(this.genCrack());
        }

        // Update score
        this.myWins  = data.scores[mi];
        this.oppWins = data.scores[oi];
        this.scoreText.setText(`${this.myName}  ${this.myWins} - ${this.oppWins}  ${this.oppName}`);

        // Power label
        this.powerLabel.setText(`You: ${myPow}%  vs  ${this.oppName}: ${opPow}%`);

        // 3) Bounce eggs back
        this.time.delayedCall(220, () => {
          this.tweens.add({
            targets: { v: 0 }, v: 1,
            duration: 480, ease: 'Bounce.easeOut',
            onUpdate: (tw) => {
              const v = tw.getValue();
              this.drawEgg(this.myEggGfx,  Phaser.Math.Linear(cx - 32, omx, v), cy, this.myEggColor,  1, this.myCracks);
              this.drawEgg(this.oppEggGfx, Phaser.Math.Linear(cx + 32, oox, v), cy, this.oppEggColor, 1, this.oppCracks);
            },
          });
        });

        // Result text
        const txt = draw ? '🤝 Draw!' : iWon ? '✅ You Win!' : '❌ You Lose!';
        const col = draw ? '#6c5ce7' : iWon ? '#00b894' : '#d63031';
        this.announce.setText(txt).setColor(col).setAlpha(1).setScale(0.7);
        this.tweens.add({ targets: this.announce, scaleX: 1, scaleY: 1, duration: 400, ease: 'Back.easeOut' });
        this.tweens.add({ targets: this.announce, alpha: 0, delay: 1300, duration: 400 });

        // Next round
        this.roundNum++;
        this.time.delayedCall(2400, () => {
          if (this.roundNum <= this.maxRounds && this.myWins < 3 && this.oppWins < 3) {
            this.powerLabel.setText('');
            this.startRound();
          }
        });
      },
    });
  }

  // ============================================================
  //  UPDATE (power bar + particles)
  // ============================================================
  update(time, delta) {
    if (typeof gamePaused !== 'undefined' && gamePaused) return;
    // Power bar
    if (this.state === 'tapping') {
      this.markerPos += this.markerDir * this.markerSpeed * (delta / 1000);
      if (this.markerPos >= 1) { this.markerPos = 1; this.markerDir = -1; }
      if (this.markerPos <= 0) { this.markerPos = 0; this.markerDir = 1; }

      this.barGfx.clear();
      // Background
      this.barGfx.fillStyle(0x2d3436, 0.85);
      this.barGfx.fillRoundedRect(this.barX - 4, this.barY - 4, this.barW + 8, this.barH + 8, 8);

      // Gradient segments (red → green → red)
      const segs = 24;
      const sw = this.barW / segs;
      for (let i = 0; i < segs; i++) {
        const dist = Math.abs(i - segs / 2) / (segs / 2);
        const r = Math.round(220 * dist + 35);
        const g = Math.round(220 * (1 - dist) + 35);
        this.barGfx.fillStyle(Phaser.Display.Color.GetColor(r, g, 40), 0.85);
        this.barGfx.fillRect(this.barX + i * sw, this.barY, sw + 1, this.barH);
      }

      // Sweet spot glow
      this.barGfx.fillStyle(0xffd700, 0.2 + Math.sin(time * 0.005) * 0.1);
      this.barGfx.fillRect(this.barX + this.barW * 0.44, this.barY, this.barW * 0.12, this.barH);

      // Marker
      const mx = this.barX + this.markerPos * this.barW;
      this.barGfx.fillStyle(0xffffff);
      this.barGfx.fillTriangle(mx, this.barY - 6, mx - 8, this.barY - 18, mx + 8, this.barY - 18);
      this.barGfx.fillRect(mx - 3, this.barY, 6, this.barH);

      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.playerTap();
    }

    // Particles
    this.partGfx.clear();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life--;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      const a = p.life / p.maxLife;
      this.partGfx.fillStyle(p.color, a);
      this.partGfx.fillCircle(p.x, p.y, p.r * a);
    }
  }
}
