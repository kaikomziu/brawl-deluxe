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
function spawnMuzzle(x, y, angle, color) {
  for (let i = 0; i < 5; i++) {
    const a = angle + rand(-0.35, 0.35);
    const sp = rand(150, 380);
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.15, maxLife: 0.15, size: rand(2, 4), color, gravity: 0, fade: true,
    });
  }
}
function spawnHitSpark(x, y, color) { spawnParticles(x, y, color, 8, { speed: 260, life: 0.3, size: 3.5 }); }
function spawnExplosion(x, y, radius) {
  spawnParticles(x, y, "#ffcf5c", 18, { speed: 320, life: 0.5, size: 6 });
  spawnParticles(x, y, "#ff6b3d", 14, { speed: 220, life: 0.6, size: 8 });
  particles.push({ x, y, ring: true, r: 4, maxR: radius, life: 0.3, maxLife: 0.3, color: "#ffd27a" });
  addShake(10);
  addHitStop(0.05);
}
function spawnDeathPoof(x, y, color) {
  spawnParticles(x, y, color, 22, { speed: 260, life: 0.55, size: 5 });
  spawnParticles(x, y, "#ffffff", 8, { speed: 180, life: 0.3, size: 3 });
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
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
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
