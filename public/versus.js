// ============================================================
//  ZEC VS KOKOS - Versus Mode Scene
// ============================================================

class VersusScene extends Phaser.Scene {
  constructor() { super('VersusScene'); }

  init(data) {
    // Use passed data or global pendingVersusData
    const d = (data && data.myRole) ? data : (typeof pendingVersusData !== 'undefined' ? pendingVersusData : {});
    this.myRole = d.myRole || 'bunny';
    this.roundNum = d.round || 1;
    this.maxRounds = d.maxRounds || 5;
    this.roundTime = d.roundTime || 60;
    this.eggsToWin = d.eggsToWin || 10;
    this.serverEggs = d.eggs || [];
    this.mapW = d.mapW || 1200;
    this.mapH = d.mapH || 800;
    this.isTiebreaker = d.isTiebreaker || false;
    this.playersInfo = d.players || [];
  }

  create() {
    this.isOver = false;
    this.eggsCollected = 0;
    this.bunnyLives = 3;
    this.shieldTimer = 0;
    this.invTimer = 0;
    this.timeLeft = this.roundTime;
    this.stunTimer = 0;

    // Chicken abilities cooldowns
    this.trapCooldown = 0;
    this.minionCooldown = 0;
    this.trapsPlaced = [];
    this.minions = [];

    // Thrown eggs
    this.thrownEggs = [];
    this.throwCooldown = 0;

    const W = this.scale.width;
    const H = this.scale.height;

    // Camera will follow player, world is bigger
    this.physics.world.setBounds(0, 0, this.mapW, this.mapH);
    this.cameras.main.setBounds(0, 0, this.mapW, this.mapH);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0xc8e6a0);
    bg.fillRect(0, 0, this.mapW, this.mapH);
    for (let x = 0; x < this.mapW; x += 90) {
      for (let y = 0; y < this.mapH; y += 90) {
        bg.fillStyle(0xb8d890, 0.35);
        bg.fillCircle(x + 45, y + 45, 32);
      }
    }

    // Grass
    this.grassGfx = this.add.graphics().setDepth(0).setAlpha(0.4);
    this.grassTufts = [];
    for (let i = 0; i < 80; i++) {
      this.grassTufts.push({
        x: Phaser.Math.Between(0, this.mapW),
        y: Phaser.Math.Between(0, this.mapH),
        h: Phaser.Math.Between(6, 14)
      });
    }

    // Border walls visual
    const border = this.add.graphics().setDepth(1);
    border.lineStyle(4, 0x6dad54, 0.5);
    border.strokeRect(2, 2, this.mapW - 4, this.mapH - 4);

    // Textures
    if (!this.textures.exists('vs_bunny')) this.createBunnyTex();
    if (!this.textures.exists('vs_chicken')) this.createChickenTex();
    if (!this.textures.exists('vs_carrot')) this.createCarrotTex();
    if (!this.textures.exists('vs_trap')) this.createTrapTex();
    if (!this.textures.exists('vs_minion')) this.createMinionTex();
    this.createEggTextures();

    // Eggs group
    this.eggs = this.physics.add.group();
    for (const eggData of this.serverEggs) {
      if (!eggData.active) continue;
      const key = 'vs_egg_' + eggData.color;
      const egg = this.physics.add.sprite(eggData.x, eggData.y, key);
      egg.eggId = eggData.id;
      egg.setDepth(3);
      egg.body.setSize(18, 22);
      this.eggs.add(egg);
      this.tweens.add({
        targets: egg, y: eggData.y - 4,
        duration: 800 + Math.random() * 400,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // Carrots (spawn periodically)
    this.carrots = this.physics.add.group();
    this.carrotTimer = this.time.addEvent({
      delay: 12000, callback: this.spawnCarrot, callbackScope: this, loop: true,
    });
    this.spawnCarrot();

    // MY player
    if (this.myRole === 'bunny') {
      this.me = this.physics.add.sprite(200, this.mapH / 2, 'vs_bunny');
      this.me.setDepth(10);
      this.me.body.setSize(30, 35);
      this.me.setCollideWorldBounds(true);

      // Opponent (chicken)
      this.opponent = this.physics.add.sprite(this.mapW - 200, this.mapH / 2, 'vs_chicken');
      this.opponent.setDepth(10);
      this.opponent.body.setSize(35, 30);
    } else {
      this.me = this.physics.add.sprite(this.mapW - 200, this.mapH / 2, 'vs_chicken');
      this.me.setDepth(10);
      this.me.body.setSize(35, 30);
      this.me.setCollideWorldBounds(true);

      this.opponent = this.physics.add.sprite(200, this.mapH / 2, 'vs_bunny');
      this.opponent.setDepth(10);
      this.opponent.body.setSize(30, 35);
    }

    this.cameras.main.startFollow(this.me, true, 0.08, 0.08);

    // Traps group
    this.trapsGroup = this.physics.add.group();
    // Minions group
    this.minionsGroup = this.physics.add.group();

    // Overlaps - bunny collects eggs and carrots
    if (this.myRole === 'bunny') {
      this.physics.add.overlap(this.me, this.eggs, this.bunnyCollectEgg, null, this);
      this.physics.add.overlap(this.me, this.carrots, this.bunnyCollectCarrot, null, this);
      this.physics.add.overlap(this.me, this.trapsGroup, this.bunnyHitTrap, null, this);
      this.physics.add.overlap(this.me, this.minionsGroup, this.bunnyHitMinion, null, this);
    }

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // Particles
    this.partGfx = this.add.graphics().setDepth(15);
    this.particles = [];

    // Effect graphics
    this.effectGfx = this.add.graphics().setDepth(9);

    // HUD
    this.createHUD();

    // Timer countdown
    this.time.addEvent({
      delay: 1000,
      callback: () => {
        if (this.isOver) return;
        this.timeLeft--;
        if (this.timeLeft <= 0) {
          socket.emit('vs-time-up');
        }
      },
      loop: true,
    });

    // Round start announcement
    const announce = this.add.text(W / 2, H / 2, '', {
      fontFamily: 'Fredoka One, sans-serif',
      fontSize: '36px',
      color: '#fff',
      stroke: '#000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(30).setScrollFactor(0);

    const roleText = this.myRole === 'bunny' ? '🐰 You are BUNNY!\nCollect eggs!' : '🐔 You are CHICKEN!\nCatch the bunny!';
    const roundText = this.isTiebreaker ? '⚡ TIEBREAKER ROUND!' : `Round ${this.roundNum}/${this.maxRounds}`;
    announce.setText(`${roundText}\n${roleText}`);

    this.tweens.add({
      targets: announce,
      alpha: 0,
      delay: 2500,
      duration: 500,
      onComplete: () => announce.destroy(),
    });

    // Socket listeners
    this.setupSocketListeners();
  }

  // ============================================================
  //  TEXTURES
  // ============================================================
  createBunnyTex() {
    const g = this.make.graphics({ add: false });
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
    g.fillStyle(0xffffff);
    g.fillCircle(cx - 18, cy + 10, 7);
    g.generateTexture('vs_bunny', 80, 100);
    g.destroy();
  }

  createChickenTex() {
    const g = this.make.graphics({ add: false });
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
    g.generateTexture('vs_chicken', 60, 50);
    g.destroy();
  }

  createEggTextures() {
    const colors = [0xff7675, 0x74b9ff, 0xa29bfe, 0x55efc4, 0xfdcb6e, 0xfd79a8, 0x00cec9, 0xe17055, 0x6c5ce7, 0x00b894];
    colors.forEach((color, i) => {
      const key = 'vs_egg_' + i;
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ add: false });
      g.fillStyle(0x000000, 0.08);
      g.fillEllipse(14, 30, 16, 6);
      g.fillStyle(color);
      g.fillEllipse(14, 14, 22, 28);
      g.fillStyle(0xffffff, 0.45);
      g.fillEllipse(10, 8, 5, 7);
      g.generateTexture(key, 28, 36);
      g.destroy();
    });
  }

  createCarrotTex() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xf39c12, 0.15);
    g.fillCircle(16, 20, 20);
    g.fillStyle(0xe67e22);
    g.beginPath();
    g.moveTo(16, 38); g.lineTo(6, 14); g.lineTo(10, 6);
    g.lineTo(16, 4); g.lineTo(22, 6); g.lineTo(26, 14);
    g.closePath(); g.fillPath();
    g.fillStyle(0x27ae60);
    g.fillEllipse(12, 4, 5, 12);
    g.fillEllipse(20, 3, 5, 12);
    g.generateTexture('vs_carrot', 32, 42);
    g.destroy();
  }

  createTrapTex() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xe74c3c, 0.2);
    g.fillCircle(16, 16, 16);
    g.fillStyle(0xdc3545);
    g.fillCircle(16, 16, 8);
    g.lineStyle(2, 0xc0392b);
    g.strokeCircle(16, 16, 12);
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(13, 13, 3);
    g.generateTexture('vs_trap', 32, 32);
    g.destroy();
  }

  createMinionTex() {
    const g = this.make.graphics({ add: false });
    // Small chicken
    g.fillStyle(0xf5f0e6);
    g.fillEllipse(12, 12, 20, 16);
    g.fillStyle(0xdc3545);
    g.fillTriangle(10, 3, 12, -3, 14, 3);
    g.fillStyle(0x2d3436);
    g.fillCircle(16, 9, 2);
    g.fillStyle(0xf5a623);
    g.fillTriangle(18, 10, 24, 12, 18, 14);
    g.generateTexture('vs_minion', 24, 24);
    g.destroy();
  }

  createHUD() {
    const W = this.scale.width;

    // Round info
    this.hudRound = this.add.text(W / 2, 12, '', {
      fontFamily: 'Fredoka One', fontSize: '18px', color: '#fff',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(25).setScrollFactor(0);

    // Timer
    this.hudTimer = this.add.text(W / 2, 36, '', {
      fontFamily: 'Fredoka One', fontSize: '24px', color: '#fff',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(25).setScrollFactor(0);

    // Role indicator
    const roleEmoji = this.myRole === 'bunny' ? '🐰' : '🐔';
    this.add.text(15, 10, `${roleEmoji} ${this.myRole === 'bunny' ? 'ZEC' : 'KOKOS'}`, {
      fontFamily: 'Fredoka One', fontSize: '16px', color: '#fff',
      stroke: '#000', strokeThickness: 3,
    }).setDepth(25).setScrollFactor(0);

    // Eggs/Lives counter
    this.hudStatus = this.add.text(15, 34, '', {
      fontFamily: 'Nunito', fontSize: '14px', fontStyle: 'bold', color: '#fff',
      stroke: '#000', strokeThickness: 2,
    }).setDepth(25).setScrollFactor(0);

    // Abilities (bottom)
    if (this.myRole === 'chicken') {
      this.hudAbility = this.add.text(W / 2, this.scale.height - 20, 'SPACE: Zamka | E: Pozovi mini-kokosi', {
        fontFamily: 'Nunito', fontSize: '13px', fontStyle: 'bold', color: '#fff',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(25).setScrollFactor(0);
    } else {
      this.hudAbility = this.add.text(W / 2, this.scale.height - 20, 'SPACE: Baci jaje (omami kokos)', {
        fontFamily: 'Nunito', fontSize: '13px', fontStyle: 'bold', color: '#fff',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(25).setScrollFactor(0);
    }
  }

  spawnCarrot() {
    if (this.isOver) return;
    const c = this.physics.add.sprite(
      Phaser.Math.Between(60, this.mapW - 60),
      Phaser.Math.Between(60, this.mapH - 60),
      'vs_carrot'
    );
    c.setDepth(4);
    c.body.setSize(20, 28);
    this.carrots.add(c);
    this.tweens.add({
      targets: c, y: c.y - 5, scaleX: 1.08, scaleY: 1.08,
      duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    // Despawn after 15s
    this.time.delayedCall(15000, () => { if (c.active) c.destroy(); });
  }

  // ============================================================
  //  COLLECT / HIT (bunny side)
  // ============================================================
  bunnyCollectEgg(me, egg) {
    if (!egg.active || this.isOver) return;
    const id = egg.eggId;
    socket.emit('vs-egg-collected', id);
    this.spawnBurst(egg.x, egg.y, 0xfdcb6e, 8);
    egg.destroy();
    this.eggsCollected++;
    SFX.egg();
  }

  bunnyCollectCarrot(me, carrot) {
    if (!carrot.active || this.isOver) return;
    carrot.destroy();
    this.shieldTimer = 4000;
    socket.emit('vs-carrot-collected');
    this.spawnBurst(me.x, me.y, 0xf39c12, 12);
    SFX.carrot();
    showToast('🛡️ Shield! The chicken can\'t catch you!');
  }

  bunnyHitTrap(me, trap) {
    if (!trap.active || this.invTimer > 0 || this.shieldTimer > 0) return;
    trap.destroy();
    // Slow bunny for 2 seconds
    this.stunTimer = 2000;
    this.spawnBurst(me.x, me.y, 0xe74c3c, 10);
    SFX.damage();
    showToast('💥 Trap! You are slowed!');
  }

  bunnyHitMinion(me, minion) {
    if (!minion.active || this.invTimer > 0) return;
    if (this.shieldTimer > 0) {
      // Shield destroys minion
      minion.destroy();
      this.spawnBurst(minion.x, minion.y, 0xf39c12, 8);
      SFX.shieldHit();
      return;
    }
    minion.destroy();
    this.takeBunnyDamage();
  }

  takeBunnyDamage() {
    if (this.invTimer > 0 || this.shieldTimer > 0 || this.isOver) return;
    this.bunnyLives--;
    this.invTimer = 2000;
    socket.emit('vs-bunny-hit');
    this.spawnBurst(this.me.x, this.me.y, 0xe74c3c, 12);
    SFX.damage();
    this.cameras.main.shake(200, 0.008);
    this.tweens.add({
      targets: this.me, alpha: 0.3, duration: 100,
      yoyo: true, repeat: 9, onComplete: () => { this.me.alpha = 1; },
    });
  }

  spawnBurst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y, vx: (Math.random() - 0.5) * 8, vy: -Math.random() * 5 - 1,
        life: 25 + Math.random() * 15, maxLife: 40, color, r: 2 + Math.random() * 4,
      });
    }
  }

  // ============================================================
  //  SOCKET LISTENERS
  // ============================================================
  setupSocketListeners() {
    // Opponent moved
    socket.on('vs-opponent-move', (data) => {
      if (this.opponent) {
        this.opponent.setPosition(data.x, data.y);
        this.opponent.setFlipX(data.dir < 0);
      }
    });

    // Egg gone (other player collected)
    socket.on('vs-egg-gone', (eggId) => {
      const egg = this.eggs.getChildren().find(e => e.eggId === eggId);
      if (egg) {
        this.spawnBurst(egg.x, egg.y, 0xfdcb6e, 6);
        egg.destroy();
      }
      this.eggsCollected++;
    });

    // New egg spawned
    socket.on('vs-egg-spawn', (eggData) => {
      const key = 'vs_egg_' + eggData.color;
      const egg = this.physics.add.sprite(eggData.x, eggData.y, key);
      egg.eggId = eggData.id;
      egg.setDepth(3);
      egg.body.setSize(18, 22);
      this.eggs.add(egg);
      this.tweens.add({
        targets: egg, y: eggData.y - 4,
        duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    });

    // Bunny took damage
    socket.on('vs-bunny-damage', (lives) => {
      this.bunnyLives = lives;
    });

    // Trap placed by chicken opponent
    socket.on('vs-trap-placed', (pos) => {
      const trap = this.physics.add.sprite(pos.x, pos.y, 'vs_trap');
      trap.setDepth(2);
      trap.body.setSize(20, 20);
      this.trapsGroup.add(trap);
      this.tweens.add({ targets: trap, alpha: 0.6, duration: 500, yoyo: true, repeat: 3,
        onComplete: () => { if (trap.active) trap.destroy(); }
      });
    });

    // Minions spawned by chicken
    socket.on('vs-minions-spawned', (pos) => {
      for (let i = 0; i < 3; i++) {
        const m = this.physics.add.sprite(
          pos.x + (Math.random() - 0.5) * 40,
          pos.y + (Math.random() - 0.5) * 40,
          'vs_minion'
        );
        m.setDepth(6);
        m.body.setSize(16, 16);
        m.speed = 80 + Math.random() * 30;
        this.minionsGroup.add(m);
        // Auto-destroy after 6s
        this.time.delayedCall(6000, () => { if (m.active) m.destroy(); });
      }
    });

    // Egg thrown by bunny
    socket.on('vs-egg-thrown', (data) => {
      this.thrownEggs.push({
        x: data.x, y: data.y, vx: data.vx, vy: data.vy, life: 60,
      });
    });

    // Shield active
    socket.on('vs-shield-active', () => {
      this.shieldTimer = 4000;
    });

    // Round over
    socket.on('vs-next-round', (data) => {
      this.cleanupListeners();
      // Determine my role from players array
      const myName = document.getElementById('playerName').value.trim() || 'Igrac';
      const myPlayer = data.players.find(p => p.name === myName);
      const myRole = myPlayer ? myPlayer.role : data.players[playerIndex]?.role || 'bunny';
      pendingVersusData = { ...data, myRole };
      this.scene.restart(pendingVersusData);
    });

    socket.on('vs-match-over', (data) => {
      this.cleanupListeners();
      this.isOver = true;
      // Show results
      const W = this.scale.width, H = this.scale.height;
      let titleText, titleColor;
      if (data.winner === -1) {
        titleText = '🤝 Draw!';
        titleColor = '#6c5ce7';
      } else {
        const myIdx = this.playersInfo.findIndex(p => p.role === this.myRole);
        const iWon = data.winner === myIdx || (data.winner === 0 && myIdx === 0) || (data.winner === 1 && myIdx === 1);
        // Simplified: check by name
        titleText = '🏆 Victory!' // We'll determine in game.js
        titleColor = '#00b894';
      }
      document.getElementById('goTitle').textContent = titleText;
      document.getElementById('goTitle').style.color = titleColor;
      document.getElementById('goScore').textContent = `${data.scores[0]} - ${data.scores[1]}`;
      document.getElementById('goLevel').textContent = `${data.players[0]} vs ${data.players[1]}`;
      document.getElementById('goMultiplayer').innerHTML = '';
      document.getElementById('goRank').innerHTML = '';
      showScreen('gameover-screen');
    });
  }

  cleanupListeners() {
    socket.off('vs-opponent-move');
    socket.off('vs-egg-gone');
    socket.off('vs-egg-spawn');
    socket.off('vs-bunny-damage');
    socket.off('vs-trap-placed');
    socket.off('vs-minions-spawned');
    socket.off('vs-egg-thrown');
    socket.off('vs-shield-active');
    socket.off('vs-next-round');
    socket.off('vs-match-over');
  }

  // ============================================================
  //  UPDATE
  // ============================================================
  update(time, delta) {
    if (this.isOver) return;

    // Timers
    if (this.invTimer > 0) this.invTimer -= delta;
    if (this.shieldTimer > 0) this.shieldTimer -= delta;
    if (this.stunTimer > 0) this.stunTimer -= delta;
    if (this.trapCooldown > 0) this.trapCooldown -= delta;
    if (this.minionCooldown > 0) this.minionCooldown -= delta;
    if (this.throwCooldown > 0) this.throwCooldown -= delta;

    // Movement
    const isBunny = this.myRole === 'bunny';
    const baseSpeed = isBunny ? 240 : 200;
    const speed = this.stunTimer > 0 ? baseSpeed * 0.4 : baseSpeed;
    let vx = 0, vy = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) vx = -speed;
    if (this.cursors.right.isDown || this.wasd.right.isDown) vx = speed;
    if (this.cursors.up.isDown || this.wasd.up.isDown) vy = -speed;
    if (this.cursors.down.isDown || this.wasd.down.isDown) vy = speed;
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }

    this.me.setVelocity(vx, vy);
    if (vx !== 0) this.me.setFlipX(vx < 0);

    // Send position
    socket.volatile.emit('vs-move', {
      x: this.me.x, y: this.me.y, dir: vx < 0 ? -1 : 1,
    });

    // ---- CHICKEN ABILITIES ----
    if (!isBunny) {
      // SPACE: Place trap
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && this.trapCooldown <= 0) {
        this.trapCooldown = 5000;
        const pos = { x: this.me.x, y: this.me.y };
        socket.emit('vs-place-trap', pos);
        // Show own trap locally
        const trap = this.physics.add.sprite(pos.x, pos.y, 'vs_trap');
        trap.setDepth(2).setAlpha(0.6);
        this.tweens.add({
          targets: trap, alpha: 0.3, duration: 500, yoyo: true, repeat: 5,
          onComplete: () => { if (trap.active) trap.destroy(); }
        });
        SFX.chickenSpawn();
      }
      // E: Summon minions
      if (Phaser.Input.Keyboard.JustDown(this.eKey) && this.minionCooldown <= 0) {
        this.minionCooldown = 15000;
        socket.emit('vs-summon-minions', { x: this.me.x, y: this.me.y });
        // Spawn locally too
        for (let i = 0; i < 3; i++) {
          const m = this.physics.add.sprite(
            this.me.x + (Math.random() - 0.5) * 40,
            this.me.y + (Math.random() - 0.5) * 40,
            'vs_minion'
          );
          m.setDepth(6);
          m.body.setSize(16, 16);
          m.speed = 80 + Math.random() * 30;
          this.minionsGroup.add(m);
          this.time.delayedCall(6000, () => { if (m.active) m.destroy(); });
        }
        SFX.chickenWarn();
      }

      // Chicken catches bunny (check distance to opponent)
      if (this.opponent) {
        const d = Phaser.Math.Distance.Between(this.me.x, this.me.y, this.opponent.x, this.opponent.y);
        if (d < 30 && this.invTimer <= 0 && this.shieldTimer <= 0) {
          socket.emit('vs-bunny-hit');
        }
      }
    }

    // ---- BUNNY ABILITIES ----
    if (isBunny) {
      // SPACE: Throw egg at chicken (stuns for 2s)
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && this.throwCooldown <= 0) {
        this.throwCooldown = 3000;
        const dx = this.opponent.x - this.me.x;
        const dy = this.opponent.y - this.me.y;
        const d = Math.hypot(dx, dy) || 1;
        const throwData = {
          x: this.me.x, y: this.me.y,
          vx: (dx / d) * 400, vy: (dy / d) * 400,
        };
        socket.emit('vs-throw-egg', throwData);
        this.thrownEggs.push({ ...throwData, life: 60 });
        SFX.click();
      }
    }

    // Update minions (chase bunny/opponent)
    const target = isBunny ? this.me : this.opponent;
    this.minionsGroup.getChildren().forEach(m => {
      if (!target) return;
      const dx = target.x - m.x;
      const dy = target.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      m.setVelocity((dx / d) * m.speed, (dy / d) * m.speed);
    });

    // Update thrown eggs
    for (let i = this.thrownEggs.length - 1; i >= 0; i--) {
      const te = this.thrownEggs[i];
      te.x += te.vx * delta / 1000;
      te.y += te.vy * delta / 1000;
      te.life--;
      if (te.life <= 0) { this.thrownEggs.splice(i, 1); continue; }
      // Check hit
      if (this.opponent) {
        const d = Phaser.Math.Distance.Between(te.x, te.y, this.opponent.x, this.opponent.y);
        if (d < 25) {
          this.thrownEggs.splice(i, 1);
          this.spawnBurst(te.x, te.y, 0xfdcb6e, 10);
          SFX.shieldHit();
          showToast('🥚 Hit! Chicken is stunned!');
          // Opponent stunned - visual only (server handles)
        }
      }
    }

    // ---- SHIELD VISUAL ----
    this.effectGfx.clear();
    if (this.shieldTimer > 0 && isBunny) {
      const pulse = 35 + Math.sin(time * 0.006) * 4;
      this.effectGfx.lineStyle(2.5, 0xf39c12, 0.5);
      this.effectGfx.strokeCircle(this.me.x, this.me.y - 5, pulse);
    }

    // ---- GRASS ----
    this.grassGfx.clear();
    this.grassGfx.lineStyle(2, 0x6dad54);
    for (const gt of this.grassTufts) {
      const sway = Math.sin(time * 0.001 + gt.x * 0.1) * 2;
      this.grassGfx.lineBetween(gt.x, gt.y, gt.x + sway, gt.y - gt.h);
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
    if (this.particles.length > 60) this.particles.splice(0, this.particles.length - 60);

    // Draw thrown eggs
    for (const te of this.thrownEggs) {
      this.partGfx.fillStyle(0xfdcb6e, 0.9);
      this.partGfx.fillCircle(te.x, te.y, 6);
      this.partGfx.fillStyle(0xffffff, 0.4);
      this.partGfx.fillCircle(te.x - 1, te.y - 2, 2);
    }

    // ---- HUD UPDATE ----
    const roundLabel = this.isTiebreaker ? '⚡ TIEBREAKER' : `Round ${this.roundNum}/${this.maxRounds}`;
    this.hudRound.setText(roundLabel);

    const mins = Math.floor(this.timeLeft / 60);
    const secs = this.timeLeft % 60;
    this.hudTimer.setText(`${mins}:${String(secs).padStart(2, '0')}`);
    if (this.timeLeft <= 10) this.hudTimer.setColor('#ff6b6b');

    if (isBunny) {
      let hearts = '';
      for (let i = 0; i < 3; i++) hearts += i < this.bunnyLives ? '❤️' : '🖤';
      this.hudStatus.setText(`${hearts}  🥚 ${this.eggsCollected}/${this.eggsToWin}`);
    } else {
      let hearts = '';
      for (let i = 0; i < 3; i++) hearts += i < this.bunnyLives ? '❤️' : '🖤';
      this.hudStatus.setText(`Bunny: ${hearts}  🥚 ${this.eggsCollected}/${this.eggsToWin}`);
    }

    // Ability cooldown hints
    if (!isBunny) {
      const trapReady = this.trapCooldown <= 0 ? '✅' : `${Math.ceil(this.trapCooldown / 1000)}s`;
      const minionReady = this.minionCooldown <= 0 ? '✅' : `${Math.ceil(this.minionCooldown / 1000)}s`;
      this.hudAbility.setText(`SPACE: Trap [${trapReady}] | E: Mini-chickens [${minionReady}]`);
    } else {
      const throwReady = this.throwCooldown <= 0 ? '✅' : `${Math.ceil(this.throwCooldown / 1000)}s`;
      this.hudAbility.setText(`SPACE: Throw egg [${throwReady}]`);
    }
  }
}
