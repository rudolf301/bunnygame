// ============================================================
//  ANIMATED HERO SCENE for Menu
// ============================================================
(function () {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 700, H = 280;
  canvas.width = W;
  canvas.height = H;

  let t = 0;

  // Scattered eggs
  const groundEggs = [];
  const eggColors = ['#ff7675', '#74b9ff', '#a29bfe', '#55efc4', '#fdcb6e', '#fd79a8', '#00cec9', '#e17055'];
  for (let i = 0; i < 10; i++) {
    groundEggs.push({
      x: 40 + i * 65 + (Math.random() - 0.5) * 25,
      y: 215 + Math.random() * 25,
      color: eggColors[i % eggColors.length],
      size: 0.55 + Math.random() * 0.35,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // Grass
  const grass = [];
  for (let i = 0; i < 30; i++) {
    grass.push({ x: Math.random() * W, y: 230 + Math.random() * 40, h: 6 + Math.random() * 10 });
  }

  // Sparkles
  const sparkles = [];
  for (let i = 0; i < 15; i++) {
    sparkles.push({
      x: Math.random() * W,
      y: 20 + Math.random() * 180,
      size: 1 + Math.random() * 2.5,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // drawBunny and drawChicken are provided by bunny-draw.js (BunnyDraw)

  function drawGroundEgg(egg) {
    const bob = Math.sin(t * 0.03 + egg.phase) * 2;
    ctx.save();
    ctx.translate(egg.x, egg.y + bob);
    ctx.scale(egg.size, egg.size);

    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = egg.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(-3, -5, 3, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 2, 7, 3.5, 5.9);
    ctx.stroke();

    ctx.restore();
  }

  function drawGrassTuft(g) {
    const sway = Math.sin(t * 0.02 + g.x * 0.1) * 2;
    ctx.strokeStyle = 'rgba(100,170,80,0.45)';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (const ox of [-2, 0, 2]) {
      ctx.beginPath();
      ctx.moveTo(g.x + ox, g.y);
      ctx.quadraticCurveTo(g.x + ox + sway * 0.5, g.y - g.h * 0.5, g.x + ox + sway, g.y - g.h * (ox === 0 ? 1 : 0.8));
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  // Carrot
  function drawCarrot(x, y) {
    const bob = Math.sin(t * 0.04) * 5;
    const rot = Math.sin(t * 0.025) * 0.15;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(rot);

    // Glow
    const grd = ctx.createRadialGradient(0, 2, 4, 0, 2, 22);
    grd.addColorStop(0, 'rgba(243,156,18,0.25)');
    grd.addColorStop(1, 'rgba(243,156,18,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 2, 22, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#e67e22';
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.bezierCurveTo(-10, 8, -10, -4, -5, -12);
    ctx.bezierCurveTo(-2, -15, 2, -15, 5, -12);
    ctx.bezierCurveTo(10, -4, 10, 8, 0, 18);
    ctx.fill();

    // Lines
    ctx.strokeStyle = 'rgba(211,84,0,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-5, 2); ctx.lineTo(5, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(4, 8); ctx.stroke();

    // Leaves
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.ellipse(-4, -16, 3, 9, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4, -16, 3, 9, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.ellipse(0, -18, 2.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ---- MAIN LOOP ----
  function render() {
    t++;
    ctx.clearRect(0, 0, W, H);

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#c9e8a0');
    sky.addColorStop(0.5, '#b8dc8a');
    sky.addColorStop(1, '#98c860');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Ground hills
    ctx.fillStyle = '#8aba55';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.quadraticCurveTo(W * 0.25, H - 60, W * 0.5, H - 50);
    ctx.quadraticCurveTo(W * 0.75, H - 40, W, H - 55);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#7db048';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.quadraticCurveTo(W * 0.3, H - 35, W * 0.5, H - 30);
    ctx.quadraticCurveTo(W * 0.7, H - 25, W, H - 35);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // Grass
    for (const g of grass) drawGrassTuft(g);

    // Ground eggs
    for (const egg of groundEggs) drawGroundEgg(egg);

    // Sparkles
    for (const sp of sparkles) {
      const alpha = 0.2 + Math.sin(t * 0.04 + sp.phase) * 0.3;
      const sy = sp.y + Math.sin(t * 0.02 + sp.phase) * 8;
      if (alpha <= 0) continue;
      ctx.fillStyle = `rgba(255,255,200,${alpha})`;
      ctx.beginPath();
      ctx.arc(sp.x, sy, sp.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(sp.x - sp.size * 2, sy - 0.4, sp.size * 4, 0.8);
      ctx.fillRect(sp.x - 0.4, sy - sp.size * 2, 0.8, sp.size * 4);
    }

    // LEFT chickens - running toward center
    const sway1 = Math.sin(t * 0.02) * 25;
    BunnyDraw.drawChicken(ctx, 90 + sway1, 145, 1, 0, t, 1.0);
    BunnyDraw.drawChicken(ctx, 30 + sway1 * 0.7, 160, 1, 1, t, 0.85);

    // RIGHT chickens
    const sway2 = Math.sin(t * 0.02 + 2) * 25;
    BunnyDraw.drawChicken(ctx, W - 90 - sway2, 140, -1, 2, t, 1.0);
    BunnyDraw.drawChicken(ctx, W - 25 - sway2 * 0.7, 158, -1, 3, t, 0.85);

    // BUNNY - big and center!
    BunnyDraw.drawBunny(ctx, W / 2, 130, 1.4, t, { showEgg: true });

    // Carrot floating above
    drawCarrot(W / 2 + 5, 28);

    // "!" exclamation above chickens
    const exAlpha = 0.4 + Math.abs(Math.sin(t * 0.06)) * 0.6;
    ctx.font = 'bold 22px Fredoka One, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(220,53,69,${exAlpha})`;
    ctx.fillText('!', 100 + sway1, 100);
    ctx.fillText('!', W - 100 - sway2, 95);

    // Motion lines behind chickens
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const ly = 140 + i * 10;
      // left side
      ctx.beginPath();
      ctx.moveTo(10 + sway1 * 0.5 - i * 8, ly);
      ctx.lineTo(30 + sway1 * 0.5 - i * 8, ly);
      ctx.stroke();
      // right side
      ctx.beginPath();
      ctx.moveTo(W - 10 - sway2 * 0.5 + i * 8, ly);
      ctx.lineTo(W - 30 - sway2 * 0.5 + i * 8, ly);
      ctx.stroke();
    }

    requestAnimationFrame(render);
  }

  render();
})();
