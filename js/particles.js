// ===== パーティクル・演出システム =====
let particles = [];
let damagePopups = [];
let screenShake = 0;
let hitStop = 0;

function addShake(amount) { screenShake = Math.min(18, screenShake + amount); }
function addHitStop(sec) { hitStop = Math.max(hitStop, sec); }

function spawnParticles(x, y, color, count, opts = {}) {
  const speed = opts.speed || 220;
  const life = opts.life || 0.4;
  const size = opts.size || 4;
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(speed * 0.3, speed);
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(life * 0.6, life), maxLife: life, size: rand(size * 0.6, size),
      color, gravity: opts.gravity || 0, fade: true, shape: opts.shape || "circle",
    });
  }
}
function spawnFlash(x, y, color, size, life) {
  particles.push({ x, y, flash: true, size, maxSize: size, life, maxLife: life, color });
}
function spawnMuzzle(x, y, angle, color) {
  spawnFlash(x + Math.cos(angle) * 6, y + Math.sin(angle) * 6, color, 14, 0.09);
  for (let i = 0; i < 6; i++) {
    const a = angle + rand(-0.4, 0.4);
    const sp = rand(180, 420);
    const len = rand(3, 7);
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.15, maxLife: 0.15, size: rand(2, 3.5), color, gravity: 0, fade: true,
      shape: "spark", len,
    });
  }
  // 硝煙(ゆっくり漂って消える煙)
  for (let i = 0; i < 2; i++) {
    const a = angle + rand(-0.5, 0.5);
    particles.push({
      x, y, vx: Math.cos(a) * rand(20, 60), vy: Math.sin(a) * rand(20, 60) - 15,
      life: 0.35, maxLife: 0.35, size: rand(4, 7), color: "rgba(200,200,210,0.5)", gravity: -10, fade: true,
    });
  }
}
function spawnHitSpark(x, y, color) {
  spawnFlash(x, y, "#ffffff", 10, 0.08);
  spawnParticles(x, y, color, 6, { speed: 260, life: 0.28, size: 3.5 });
  for (let i = 0; i < 5; i++) {
    const a = rand(0, Math.PI * 2);
    particles.push({
      x, y, vx: Math.cos(a) * rand(200, 420), vy: Math.sin(a) * rand(200, 420),
      life: 0.16, maxLife: 0.16, size: 2.5, color: "#ffffff", gravity: 0, fade: true, shape: "spark", len: rand(5, 10),
    });
  }
}
function spawnExplosion(x, y, radius) {
  spawnFlash(x, y, "#fff6d8", radius * 0.7, 0.15);
  spawnParticles(x, y, "#ffcf5c", 20, { speed: 340, life: 0.5, size: 6 });
  spawnParticles(x, y, "#ff6b3d", 16, { speed: 240, life: 0.65, size: 8 });
  spawnParticles(x, y, "#5a5a5a", 10, { speed: 100, life: 0.9, size: 9, gravity: -30 });
  particles.push({ x, y, ring: true, r: 4, maxR: radius, life: 0.35, maxLife: 0.35, color: "#ffd27a" });
  particles.push({ x, y, ring: true, r: 2, maxR: radius * 0.7, life: 0.5, maxLife: 0.5, color: "#ff8a3d" });
  addShake(10);
  addHitStop(0.05);
}
function spawnDeathPoof(x, y, color) {
  spawnFlash(x, y, color, 24, 0.12);
  spawnParticles(x, y, color, 24, { speed: 270, life: 0.55, size: 5 });
  spawnParticles(x, y, "#ffffff", 10, { speed: 190, life: 0.32, size: 3 });
  particles.push({ x, y, ring: true, r: 2, maxR: 46, life: 0.4, maxLife: 0.4, color: "#ffffff" });
}
function spawnDamagePopup(x, y, amount, crit) {
  damagePopups.push({ x, y: y - 20, vy: -60, life: 0.7, maxLife: 0.7, amount: Math.round(amount), crit });
}
function spawnGemSparkle(x, y) { spawnParticles(x, y, "#7cf2ff", 6, { speed: 120, life: 0.4, size: 3 }); }

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    if (p.ring) { p.r = lerp(p.r, p.maxR, 1 - p.life / p.maxLife); continue; }
    if (p.flash) { p.size = p.maxSize * (p.life / p.maxLife); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += (p.gravity || 0) * dt;
    p.vx *= 0.92; p.vy *= 0.96;
  }
  for (let i = damagePopups.length - 1; i >= 0; i--) {
    const d = damagePopups[i];
    d.life -= dt; d.y += d.vy * dt; d.vy += 90 * dt;
    if (d.life <= 0) damagePopups.splice(i, 1);
  }
  if (screenShake > 0) screenShake = Math.max(0, screenShake - dt * 40);
  if (hitStop > 0) hitStop = Math.max(0, hitStop - dt);
}

function drawParticles(ctx) {
  for (const p of particles) {
    if (p.ring) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.6;
      ctx.strokeStyle = p.color; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      continue;
    }
    if (p.flash) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.9;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(1, p.size));
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.4, p.color); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, p.size), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      continue;
    }
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    if (p.shape === "spark") {
      const ang = Math.atan2(p.vy, p.vx);
      ctx.translate(p.x, p.y); ctx.rotate(ang);
      ctx.fillRect(-(p.len || 6) / 2, -p.size / 2, p.len || 6, p.size);
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "bold 16px 'Segoe UI', sans-serif";
  for (const d of damagePopups) {
    ctx.globalAlpha = Math.max(0, d.life / d.maxLife);
    ctx.fillStyle = d.crit ? "#ffd23f" : "#ffffff";
    ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 3;
    ctx.font = d.crit ? "bold 20px 'Segoe UI', sans-serif" : "bold 15px 'Segoe UI', sans-serif";
    ctx.strokeText(String(d.amount), d.x, d.y);
    ctx.fillText(String(d.amount), d.x, d.y);
  }
  ctx.restore();
}
