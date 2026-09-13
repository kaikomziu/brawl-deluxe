// ===== 描画 =====
function playerAllyTeam(mode) {
  const p = mode.fighters.find(f => f.isPlayer);
  return p ? p.team : null;
}

function isHiddenFromPlayer(mode, f, time) {
  if (f.isPlayer) return false;
  const p = mode.fighters.find(fx => fx.isPlayer);
  if (!p) return false;
  if (f.team === p.team) return false; // 味方は常に見える
  if (time != null && time < f.stealthUntil) return true; // ゴーストの必殺技ステルス
  if (!isBush(mode.map, f.x, f.y)) return false;
  // 自分または生存中の味方がバレ距離内にいれば見える
  for (const ally of mode.fighters) {
    if (!ally.alive) continue;
    if (ally.team !== p.team) continue;
    if (dist(ally.x, ally.y, f.x, f.y) <= bushRevealDist()) return false;
  }
  return true;
}

function drawTile(ctx, tx, ty, ch, time) {
  const x = tx * TILE, y = ty * TILE;
  if (ch === "#") {
    ctx.fillStyle = "#3a3d55";
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = "#4d5175";
    ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 10);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x, y + TILE - 6, TILE, 6);
  } else if (ch === "w") {
    const shimmer = Math.sin(time * 2 + tx * 0.7 + ty * 0.5) * 8;
    ctx.fillStyle = "#1c5f8a";
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = `rgba(120,210,255,0.25)`;
    ctx.fillRect(x, y + 18 + shimmer * 0.2, TILE, 6);
  } else if (ch === "b") {
    ctx.fillStyle = "#274a2a";
    ctx.fillRect(x, y, TILE, TILE);
  }
}

function drawBushTop(ctx, tx, ty, time) {
  const x = tx * TILE + TILE / 2, y = ty * TILE + TILE / 2;
  const sway = Math.sin(time * 1.6 + tx * 1.3 + ty) * 2;
  ctx.save();
  ctx.translate(x, y + sway);
  ctx.fillStyle = "#3d7a3f";
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 11, Math.sin(a) * 11, 13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#4f9950";
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawMap(ctx, map, time) {
  ctx.fillStyle = "#1b1d2b";
  ctx.fillRect(0, 0, MAP_W * TILE, MAP_H * TILE);
  // floor grid
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  for (let x = 0; x <= MAP_W; x++) { ctx.beginPath(); ctx.moveTo(x * TILE, 0); ctx.lineTo(x * TILE, MAP_H * TILE); ctx.stroke(); }
  for (let y = 0; y <= MAP_H; y++) { ctx.beginPath(); ctx.moveTo(0, y * TILE); ctx.lineTo(MAP_W * TILE, y * TILE); ctx.stroke(); }
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    const ch = map.grid[ty][tx];
    if (ch !== ".") drawTile(ctx, tx, ty, ch, time);
  }
  if (map.goalA) drawGoal(ctx, map.goalA, "#5da8ff");
  if (map.goalB) drawGoal(ctx, map.goalB, "#ff5d5d");
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    if (map.grid[ty][tx] === "b") drawBushTop(ctx, tx, ty, time);
  }
}

function drawGoal(ctx, g, color) {
  const grad = ctx.createLinearGradient(g.x, g.y, g.x + g.w, g.y);
  grad.addColorStop(0, color + "55");
  grad.addColorStop(1, color + "00");
  ctx.fillStyle = grad;
  ctx.fillRect(g.x, g.y, g.w, g.h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(g.x + 1, g.y + 1, g.w - 2, g.h - 2);
}

function drawGems(ctx, gems, time) {
  for (const g of gems) {
    const bob = Math.sin(time * 3 + g.id) * 4;
    ctx.save();
    ctx.translate(g.x, g.y + bob);
    ctx.rotate(time * 1.5 + g.id);
    ctx.shadowColor = "#5cf2ff"; ctx.shadowBlur = 12;
    ctx.fillStyle = "#7cf2ff";
    ctx.beginPath();
    ctx.moveTo(0, -10); ctx.lineTo(8, 0); ctx.lineTo(0, 10); ctx.lineTo(-8, 0); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#d8fbff";
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(3, -2); ctx.lineTo(-3, -2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function drawBall(ctx, ball) {
  ctx.save();
  ctx.shadowColor = "#000"; ctx.shadowBlur = 6;
  ctx.fillStyle = "#f4f4f4";
  ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#222"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ball.x - 6, ball.y); ctx.lineTo(ball.x + 6, ball.y); ctx.moveTo(ball.x, ball.y - 6); ctx.lineTo(ball.x, ball.y + 6); ctx.stroke();
  ctx.restore();
}

function drawClouds(ctx, mode, time) {
  if (!mode.clouds) return;
  for (const c of mode.clouds) {
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(time * 4) * 0.05;
    const grad = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, c.r);
    grad.addColorStop(0, "#7bd83a"); grad.addColorStop(1, "rgba(123,216,58,0)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawShowdownZone(ctx, mode) {
  const z = mode.zone;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, MAP_W * TILE, MAP_H * TILE);
  ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2, true);
  ctx.fillStyle = "rgba(180,20,20,0.32)";
  ctx.fill("evenodd");
  ctx.strokeStyle = "#ff6b6b"; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawPowerCubes(ctx, cubes, time) {
  for (const c of cubes) {
    if (c.taken) continue;
    ctx.save();
    ctx.translate(c.x, c.y + Math.sin(time * 3 + c.id) * 3);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#ffd23f"; ctx.shadowColor = "#ffd23f"; ctx.shadowBlur = 14;
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
  }
}

function weaponShape(ctx, kind) {
  ctx.fillStyle = "#2a2c3d";
  switch (kind) {
    case "sniper": ctx.fillRect(6, -2.5, 26, 5); break;
    case "shotgun": ctx.fillRect(6, -4, 20, 8); break;
    case "lob": ctx.fillRect(6, -4, 16, 8); break;
    case "dual": ctx.fillRect(6, -6, 14, 4); ctx.fillRect(6, 2, 14, 4); break;
    default: ctx.fillRect(6, -3, 20, 6);
  }
}

function drawFighter(ctx, f, mode, time, isMe) {
  if (isHiddenFromPlayer(mode, f, time)) return;
  if (!f.alive) return;
  const inBush = isBush(mode.map, f.x, f.y);
  ctx.save();
  let alpha = 1;
  if (inBush) alpha = f.isPlayer || f.team === playerAllyTeam(mode) ? 0.75 : 0.9;
  ctx.globalAlpha = alpha;

  const scale = 1 + f.hitFlash * 0.18;
  ctx.translate(f.x, f.y);

  // 影
  ctx.globalAlpha = alpha * 0.35;
  ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.ellipse(0, f.radius * 0.8, f.radius * 0.9, f.radius * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = alpha;

  // 必殺技ゲージリング
  if (f.superCharge > 0) {
    ctx.save();
    ctx.strokeStyle = f.superCharge >= f.superMax ? "#ffd23f" : "rgba(255,210,63,0.55)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, f.radius + 7, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * f.superCharge) / f.superMax);
    ctx.stroke();
    ctx.restore();
  }
  if (time < f.invulnUntil) {
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${0.5 + Math.sin(time * 20) * 0.3})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, f.radius + 3, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  ctx.rotate(f.facing);
  ctx.scale(scale, scale);
  weaponShape(ctx, f.brawler.attack.kind);
  ctx.rotate(-f.facing);

  // 本体
  const teamRing = f.team === "A" ? "#5da8ff" : f.team === "B" ? "#ff5d5d" : (isMe ? "#ffd23f" : "#c9c9d8");
  ctx.beginPath(); ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
  ctx.fillStyle = f.hitFlash > 0.4 ? "#ffffff" : f.brawler.color;
  ctx.fill();
  ctx.lineWidth = isMe ? 4 : 3;
  ctx.strokeStyle = teamRing;
  ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, f.radius * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = f.brawler.colorDark; ctx.fill();

  if (time < f.frozenUntil) { ctx.fillStyle = "rgba(150,230,255,0.55)"; ctx.beginPath(); ctx.arc(0, 0, f.radius + 1, 0, Math.PI * 2); ctx.fill(); }
  if (time < f.poisonUntil) { ctx.strokeStyle = "rgba(123,216,58,0.8)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, f.radius + 4, 0, Math.PI * 2); ctx.stroke(); }

  ctx.restore();

  // 名前・HPバー
  ctx.save();
  ctx.translate(f.x, f.y - f.radius - 20);
  if (!f.isPlayer) {
    ctx.font = "11px 'Segoe UI', sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(f.name, 0, -6);
  }
  const w = 40, h = 5;
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(-w / 2, 0, w, h);
  const ratio = clamp(f.hp / f.maxHp, 0, 1);
  ctx.fillStyle = ratio > 0.5 ? "#5ce065" : ratio > 0.25 ? "#ffd23f" : "#ff5d5d";
  ctx.fillRect(-w / 2, 0, w * ratio, h);
  if (f.carryingGems > 0) {
    ctx.fillStyle = "#7cf2ff"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("💎" + f.carryingGems, 0, h + 12);
  }
  if (f.carryingBall) { ctx.font = "13px sans-serif"; ctx.fillText("⚽", 0, h + 13); }
  ctx.restore();
}

function drawProjectile(ctx, p) {
  ctx.save();
  const y = p.arc ? p.y - (p.height || 0) : p.y;
  if (p.arc) {
    ctx.globalAlpha = 0.3; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(p.x, p.y, p.radius * 0.9, p.radius * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.shadowColor = p.color; ctx.shadowBlur = 10;
  ctx.fillStyle = p.color;
  ctx.save();
  ctx.translate(p.x, y);
  if (!p.arc) ctx.rotate(Math.atan2(p.vy, p.vx));
  if (p.kind === "sniper" || p.kind === "knife" || p.kind === "dart") {
    ctx.fillRect(-p.radius * 2, -p.radius * 0.5, p.radius * 4, p.radius);
  } else {
    ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

function drawLasers(ctx) {
  for (const l of laserBeams) {
    ctx.save();
    ctx.globalAlpha = l.life / l.maxLife;
    ctx.strokeStyle = l.color; ctx.lineWidth = 10; ctx.shadowColor = l.color; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
    ctx.restore();
  }
}

function drawWorld(ctx, mode, time) {
  const player = mode.fighters.find(f => f.isPlayer);
  drawMap(ctx, mode.map, time);
  if (mode.id === "showdown") drawPowerCubes(ctx, mode.powerCubes, time);
  if (mode.gems) drawGems(ctx, mode.gems, time);
  if (mode.ball) drawBall(ctx, mode.ball);
  drawClouds(ctx, mode, time);
  const sorted = mode.fighters.slice().sort((a, b) => a.y - b.y);
  for (const f of sorted) drawFighter(ctx, f, mode, time, f === player);
  for (const p of mode.projectiles) drawProjectile(ctx, p);
  drawLasers(ctx);
  drawParticles(ctx);
  if (mode.id === "showdown") drawShowdownZone(ctx, mode);
}
