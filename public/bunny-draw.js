// ============================================================
//  bunny-draw.js  –  Shared Canvas 2D character drawing
//  Used by: hero-scene.js (menu animation)
//           game.js       (in-game CanvasTexture, updated each frame)
//
//  All functions live on the global BunnyDraw object.
//  Parameter `t` is a frame-counter equivalent (60 fps ≈ t++ per frame).
//  For in-game use pass:  scene.totalTime / 16.67
// ============================================================

const BunnyDraw = (function () {

  // ----------------------------------------------------------
  //  BUNNY
  //  cx, cy  – drawing origin (centre of body area)
  //  scale   – overall scale
  //  t       – animation time (frame counter)
  //  opts    – { hasShield: bool, showEgg: bool }
  // ----------------------------------------------------------
  function drawBunny(ctx, cx, cy, scale, t, opts) {
    opts = opts || {};
    const hasShield = !!opts.hasShield;
    const showEgg   = opts.showEgg !== false; // default true

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Shield glow behind everything
    if (hasShield) {
      const grd = ctx.createRadialGradient(0, -5, 4, 0, -5, 52);
      grd.addColorStop(0, 'rgba(243,156,18,0.35)');
      grd.addColorStop(0.6, 'rgba(243,156,18,0.12)');
      grd.addColorStop(1, 'rgba(243,156,18,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(0, -5, 52, 0, Math.PI * 2);
      ctx.fill();
      // Pulsing ring
      const pulse = 40 + Math.sin(t * 0.18) * 3;
      ctx.strokeStyle = `rgba(243,156,18,${0.35 + Math.sin(t * 0.2) * 0.15})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -5, pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    const hop = Math.abs(Math.sin(t * 0.04)) * 10;
    ctx.translate(0, -hop);

    // Ground shadow (stretches as bunny rises)
    ctx.fillStyle = `rgba(0,0,0,${0.12 - hop * 0.005})`;
    ctx.beginPath();
    ctx.ellipse(0, 55 + hop * 0.5, 30 + hop * 0.4, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-26, 22, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(245,240,235,0.6)';
    ctx.beginPath();
    ctx.arc(-24, 20, 5, 0, Math.PI * 2);
    ctx.fill();

    // Back paws (running motion)
    ctx.fillStyle = '#d4c4b0';
    const pawA = Math.sin(t * 0.05) * 3;
    ctx.beginPath();
    ctx.ellipse(-10, 48 + pawA, 9, 5, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(10, 48 - pawA, 9, 5, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const bodyG = ctx.createRadialGradient(-3, 10, 4, 0, 15, 32);
    bodyG.addColorStop(0, '#f0e6d8');
    bodyG.addColorStop(1, '#d4c4b0');
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.ellipse(0, 15, 28, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = 'rgba(255,250,242,0.6)';
    ctx.beginPath();
    ctx.ellipse(3, 18, 16, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    const headG = ctx.createRadialGradient(0, -18, 4, 0, -14, 22);
    headG.addColorStop(0, '#f0e6d8');
    headG.addColorStop(1, '#ddd0c0');
    ctx.fillStyle = headG;
    ctx.beginPath();
    ctx.ellipse(0, -16, 22, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears (wiggle slightly)
    const earW = Math.sin(t * 0.03) * 0.1;
    for (const off of [-10, 10]) {
      ctx.save();
      ctx.translate(off, -33);
      ctx.rotate(off < 0 ? -0.12 + earW : 0.12 - earW);
      ctx.fillStyle = '#ddd0c0';
      ctx.beginPath();
      ctx.ellipse(0, -20, 9, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f0b4b4';
      ctx.beginPath();
      ctx.ellipse(0, -17, 5.5, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Cheeks
    ctx.fillStyle = 'rgba(255,180,180,0.35)';
    ctx.beginPath();
    ctx.ellipse(-15, -8, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(15, -8, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (blink)
    const blink = Math.sin(t * 0.015) > 0.96 ? 0.12 : 1;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-8, -19, 7, 7.5 * blink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(8, -19, 7, 7.5 * blink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.arc(-7, -18, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(9, -18, 4, 0, Math.PI * 2);
    ctx.fill();
    // Shine
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-6, -20, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, -20, 2, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#e88';
    ctx.beginPath();
    ctx.ellipse(1, -11, 3.5, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    ctx.strokeStyle = 'rgba(180,120,120,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(-2, -6, 3.5, 0.1, Math.PI - 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(4, -6, 3.5, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // Whiskers
    ctx.strokeStyle = 'rgba(160,140,120,0.35)';
    ctx.lineWidth = 0.8;
    for (const side of [-1, 1]) {
      for (let w = -1; w <= 1; w++) {
        ctx.beginPath();
        ctx.moveTo(side * 12, -10 + w * 3);
        ctx.lineTo(side * 28, -12 + w * 4);
        ctx.stroke();
      }
    }

    // Left arm (waving)
    const wave = Math.sin(t * 0.04) * 0.3;
    ctx.save();
    ctx.translate(-24, 2);
    ctx.rotate(-0.5 + wave);
    ctx.fillStyle = '#d4c4b0';
    ctx.beginPath();
    ctx.ellipse(0, -6, 6, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ddd0c0';
    ctx.beginPath();
    ctx.arc(0, -16, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Right arm + egg in hand (hero scene only)
    if (showEgg) {
      ctx.fillStyle = '#d4c4b0';
      ctx.beginPath();
      ctx.ellipse(26, 4, 7, 12, 0.4, 0, Math.PI * 2);
      ctx.fill();

      const eggBob = Math.sin(t * 0.05) * 2;
      ctx.fillStyle = '#fdcb6e';
      ctx.beginPath();
      ctx.ellipse(36, -6 + eggBob, 11, 14, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.ellipse(33, -12 + eggBob, 4, 6, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(33 + i * 3, -4 + eggBob, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // In-game: right arm open/reaching
      const reach = Math.sin(t * 0.04 + 1.5) * 0.3;
      ctx.save();
      ctx.translate(24, 2);
      ctx.rotate(0.5 + reach);
      ctx.fillStyle = '#d4c4b0';
      ctx.beginPath();
      ctx.ellipse(0, -6, 6, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ddd0c0';
      ctx.beginPath();
      ctx.arc(0, -16, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  // ----------------------------------------------------------
  //  CHICKEN
  //  x, y   – centre position
  //  dir    – 1 = facing right, -1 = facing left
  //  idx    – chicken index (for animation phase offset)
  //  t      – animation time
  //  scale  – overall scale
  // ----------------------------------------------------------
  function drawChicken(ctx, x, y, dir, idx, t, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale || 1, scale || 1);

    const walk = Math.sin(t * 0.06 + idx * 1.5) * 4;
    const bob  = Math.abs(Math.sin(t * 0.06 + idx * 1.5)) * 3;
    ctx.translate(0, -bob);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath();
    ctx.ellipse(0, 30 + bob, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail feathers
    ctx.fillStyle = '#d4cbb8';
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(-16 * dir, 0);
      ctx.rotate((-0.2 + i * 0.1) * dir);
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.5, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Legs
    ctx.strokeStyle = '#e8a020';
    ctx.lineWidth = 2.5;
    for (const off of [-5, 5]) {
      const lw = walk * (off > 0 ? 1 : -1);
      ctx.beginPath();
      ctx.moveTo(off, 18);
      ctx.lineTo(off + lw, 28);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(off + lw - 3, 30);
      ctx.lineTo(off + lw, 28);
      ctx.lineTo(off + lw + 3, 30);
      ctx.stroke();
      ctx.lineWidth = 2.5;
    }

    // Body
    const bGrad = ctx.createRadialGradient(-2, -1, 3, 0, 1, 22);
    bGrad.addColorStop(0, '#faf5eb');
    bGrad.addColorStop(1, '#e8dcc8');
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.ellipse(0, 2, 23, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing flapping
    const flapAngle = Math.sin(t * 0.08 + idx) * 0.25;
    ctx.save();
    ctx.translate(-4 * dir, 0);
    ctx.rotate(flapAngle * dir);
    ctx.fillStyle = '#e0d5c0';
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 11, 0.1 * dir, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Neck + Head
    const hx = 17 * dir;
    ctx.fillStyle = '#faf5eb';
    ctx.beginPath();
    ctx.ellipse(10 * dir, -8, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx, -14, 13, 0, Math.PI * 2);
    ctx.fill();

    // Crest
    ctx.fillStyle = '#dc3545';
    ctx.beginPath();
    ctx.moveTo(hx - 6 * dir, -24);
    ctx.lineTo(hx - 3 * dir, -38);
    ctx.lineTo(hx, -26);
    ctx.lineTo(hx + 2 * dir, -35);
    ctx.lineTo(hx + 5 * dir, -25);
    ctx.lineTo(hx + 7 * dir, -33);
    ctx.lineTo(hx + 10 * dir, -24);
    ctx.closePath();
    ctx.fill();

    // Wattle
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.ellipse(hx + 5 * dir, -2, 3.5, 6, 0.2 * dir, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#f0a030';
    ctx.beginPath();
    ctx.moveTo(hx + 10 * dir, -17);
    ctx.lineTo(hx + 26 * dir, -14);
    ctx.lineTo(hx + 10 * dir, -12);
    ctx.closePath();
    ctx.fill();
    const beakOpen = Math.abs(Math.sin(t * 0.08 + idx * 2)) * 3;
    ctx.fillStyle = '#e89520';
    ctx.beginPath();
    ctx.moveTo(hx + 10 * dir, -10);
    ctx.lineTo(hx + 22 * dir, -9 + beakOpen);
    ctx.lineTo(hx + 10 * dir, -8);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(hx + 5 * dir, -17, 5.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(hx + 6 * dir, -17, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(hx + 6.5 * dir, -17, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(hx + 5 * dir, -19, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Angry eyebrow
    ctx.strokeStyle = '#2d3436';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx - 1 * dir, -25);
    ctx.lineTo(hx + 12 * dir, -21);
    ctx.stroke();
    ctx.lineCap = 'butt';

    ctx.restore();
  }

  return { drawBunny, drawChicken };
})();
