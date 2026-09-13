// ===== ファイター/弾/アイテムのロジック =====
let _entityId = 1;
function nextId() { return _entityId++; }

function createFighter(brawlerId, team, x, y, opts = {}) {
  const brawler = getBrawler(brawlerId);
  return {
    id: nextId(), brawler, team,
    isPlayer: !!opts.isPlayer, isBot: !opts.isPlayer,
    x, y, spawnX: x, spawnY: y, radius: brawler.radius,
    hp: brawler.hp, maxHp: brawler.hp,
    moveX: 0, moveY: 0, aimAngle: opts.aimAngle ?? 0, facing: 0,
    ammo: brawler.attack.ammo, ammoMax: brawler.attack.ammo,
    ammoRegenT: 0, fireCooldown: 0,
    superCharge: 0, superMax: 100,
    alive: true, respawnTimer: 0, invulnUntil: 0,
    slowUntil: 0, slowFactor: 1, poisonUntil: 0, poisonDps: 0,
    stunUntil: 0, frozenUntil: 0, speedBoostUntil: 0, speedBoostFactor: 1,
    dashUntil: 0, dashVX: 0, dashVY: 0,
    carryingGems: 0, carryingBall: false,
    stats: { damageDealt: 0, eliminations: 0, gemsCollected: 0, goals: 0 },
    aiState: "seek", aiTimer: 0, aiTarget: null,
    name: opts.name || brawler.name,
    difficulty: opts.difficulty || "normal",
    hitFlash: 0,
  };
}

function canOccupy(map, x, y, r) {
  const off = r * 0.72;
  const pts = [
    [x - r, y], [x + r, y], [x, y - r], [x, y + r],
    [x - off, y - off], [x + off, y - off], [x - off, y + off], [x + off, y + off],
  ];
  for (const [px, py] of pts) if (isSolid(map, px, py)) return false;
  return true;
}

function fighterSpeed(f, now) {
  let s = f.brawler.speed;
  if (now < f.slowUntil) s *= f.slowFactor;
  if (now < f.speedBoostUntil) s *= f.speedBoostFactor;
  if (now < f.frozenUntil) s = 0;
  if (now < f.stunUntil) s = 0;
  return s;
}

function moveFighter(f, dt, map, now, allFighters) {
  if (!f.alive) return;
  if (now < f.dashUntil) {
    const nx = f.x + f.dashVX * dt, ny = f.y + f.dashVY * dt;
    if (canOccupy(map, nx, f.y, f.radius)) f.x = nx;
    if (canOccupy(map, f.x, ny, f.radius)) f.y = ny;
  } else {
    const speed = fighterSpeed(f, now);
    const len = Math.hypot(f.moveX, f.moveY) || 1;
    const vx = (f.moveX / len) * speed, vy = (f.moveY / len) * speed;
    if (speed > 0 && (f.moveX || f.moveY)) {
      f.facing = Math.atan2(vy, vx);
      const nx = f.x + vx * dt;
      if (canOccupy(map, nx, f.y, f.radius)) f.x = nx;
      const ny = f.y + vy * dt;
      if (canOccupy(map, f.x, ny, f.radius)) f.y = ny;
    }
  }
  f.x = clamp(f.x, f.radius + TILE * 0.4, MAP_W * TILE - f.radius - TILE * 0.4);
  f.y = clamp(f.y, f.radius + TILE * 0.4, MAP_H * TILE - f.radius - TILE * 0.4);
  // 他ファイターと軽く押し合う
  for (const o of allFighters) {
    if (o === f || !o.alive) continue;
    const minD = f.radius + o.radius;
    const d = dist(f.x, f.y, o.x, o.y);
    if (d > 0 && d < minD) {
      const push = (minD - d) / 2;
      const ax = (f.x - o.x) / d, ay = (f.y - o.y) / d;
      f.x += ax * push; f.y += ay * push;
    }
  }
  if (f.hitFlash > 0) f.hitFlash = Math.max(0, f.hitFlash - dt * 6);
  // アモ回復
  if (f.ammo < f.ammoMax) {
    f.ammoRegenT += dt;
    const per = f.brawler.attack.reloadTime / f.ammoMax;
    if (f.ammoRegenT >= per) { f.ammoRegenT -= per; f.ammo++; }
  } else f.ammoRegenT = 0;
  if (f.fireCooldown > 0) f.fireCooldown -= dt;
}

function canFireNow(f, now) {
  return f.alive && f.fireCooldown <= 0 && f.ammo > 0 && now >= f.stunUntil && now >= f.frozenUntil;
}

function spreadAngles(base, count, spreadDeg) {
  if (count <= 1) return [base];
  const total = (spreadDeg * Math.PI) / 180;
  const angles = [];
  for (let i = 0; i < count; i++) angles.push(base - total / 2 + (total * i) / (count - 1));
  return angles;
}

function makeProjectile(f, angle, atk, now) {
  const p = {
    id: nextId(), owner: f, ownerTeam: f.team,
    x: f.x + Math.cos(angle) * (f.radius + 6), y: f.y + Math.sin(angle) * (f.radius + 6),
    angle, damage: atk.damage, radius: atk.projRadius, color: f.brawler.color,
    pierce: !!atk.pierce, hitSet: new Set(), kind: atk.kind,
    effect: atk.slow ? "slow" : atk.poison ? "poison" : atk.healOnHitAlly ? "heal" : null,
    slowFactor: atk.slow ? 1 - atk.slow : 1, slowTime: atk.slowTime || 0,
    poisonDps: atk.poison || 0, poisonTime: atk.poisonTime || 0, healAmt: atk.healOnHitAlly || 0,
    life: (atk.range / atk.projSpeed) * (atk.returns ? 2.3 : 1) + 0.05,
  };
  if (atk.arc) {
    p.arc = true; p.t = 0; p.totalTime = atk.range / atk.projSpeed;
    p.startX = p.x; p.startY = p.y;
    p.targetX = f.x + Math.cos(angle) * atk.range; p.targetY = f.y + Math.sin(angle) * atk.range;
    p.aoe = atk.aoe || 50;
  } else {
    p.vx = Math.cos(angle) * atk.projSpeed; p.vy = Math.sin(angle) * atk.projSpeed;
    if (atk.returns) { p.returns = true; p.traveled = 0; p.maxDist = atk.range; p.reversed = false; }
  }
  return p;
}

function tryFire(f, mode, now) {
  if (!canFireNow(f, now)) return false;
  const atk = f.brawler.attack;
  const angles = spreadAngles(f.aimAngle, atk.count, atk.spread);
  for (const a of angles) mode.projectiles.push(makeProjectile(f, a, atk, now));
  f.ammo--; f.fireCooldown = atk.cooldown;
  SFX.shoot(atk.kind);
  spawnMuzzle(f.x + Math.cos(f.aimAngle) * (f.radius + 4), f.y + Math.sin(f.aimAngle) * (f.radius + 4), f.aimAngle, f.brawler.color);
  return true;
}

function updateProjectiles(mode, dt, now) {
  const list = mode.projectiles;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.arc) {
      p.t += dt;
      const frac = clamp(p.t / p.totalTime, 0, 1);
      p.x = lerp(p.startX, p.targetX, frac); p.y = lerp(p.startY, p.targetY, frac);
      p.height = Math.sin(frac * Math.PI) * 44;
      if (frac >= 1) {
        spawnExplosion(p.x, p.y, p.aoe);
        SFX.explosion();
        for (const t of mode.fighters) {
          if (!t.alive || t.team === p.ownerTeam) continue;
          if (dist(t.x, t.y, p.x, p.y) <= p.aoe + t.radius) applyDamage(t, p.damage, p.owner, mode, now);
        }
        list.splice(i, 1);
      }
      continue;
    }
    if (p.returns && !p.reversed) {
      p.traveled += Math.hypot(p.vx, p.vy) * dt;
      if (p.traveled >= p.maxDist) { p.vx *= -1; p.vy *= -1; p.reversed = true; }
    }
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    if (blocksBullet(mode.map, nx, ny)) {
      spawnHitSpark(nx, ny, p.color);
      list.splice(i, 1); continue;
    }
    p.x = nx; p.y = ny;
    let removed = false;
    for (const t of mode.fighters) {
      if (!t.alive || p.hitSet.has(t.id)) continue;
      const sameTeam = t.team === p.ownerTeam;
      if (sameTeam && p.effect !== "heal") continue;
      if (!sameTeam && p.effect === "heal") continue;
      if (t === p.owner) continue;
      if (circleHit(p.x, p.y, p.radius, t.x, t.y, t.radius)) {
        if (p.effect === "heal") {
          if (t.hp < t.maxHp) {
            t.hp = Math.min(t.maxHp, t.hp + p.healAmt);
            spawnParticles(t.x, t.y, "#ff8fd6", 8, { speed: 100, life: 0.35, size: 3 });
            SFX.heal();
          }
        } else {
          applyDamage(t, p.damage, p.owner, mode, now);
          if (p.effect === "slow") { t.slowUntil = now + p.slowTime; t.slowFactor = p.slowFactor; }
          if (p.effect === "poison") { t.poisonUntil = now + p.poisonTime; t.poisonDps = p.poisonDps; }
        }
        p.hitSet.add(t.id);
        if (!p.pierce) { removed = true; break; }
      }
    }
    if (removed || p.life <= 0) list.splice(i, 1);
  }
}

function applyDamage(target, dmg, attacker, mode, now, opts = {}) {
  if (!target.alive) return;
  if (now < target.invulnUntil) return;
  target.hp -= dmg;
  target.hitFlash = 1;
  spawnDamagePopup(target.x, target.y, dmg, false);
  if (!opts.silent) {
    spawnHitSpark(target.x, target.y, attacker ? attacker.brawler.color : "#fff");
    SFX.hit();
    addHitStop(0.02);
    if (target.isPlayer || (attacker && attacker.isPlayer)) addShake(3);
  }
  if (attacker && attacker !== target && attacker.alive) {
    attacker.superCharge = Math.min(attacker.superMax, attacker.superCharge + attacker.brawler.superCharge.perHit);
    attacker.stats.damageDealt += dmg;
  }
  target.superCharge = Math.min(target.superMax, target.superCharge + dmg * target.brawler.superCharge.perDamageTaken);
  if (target.carryingBall && mode.ball && mode.ball.carrier === target && typeof dropBall === "function") dropBall(mode, target);
  if (target.hp <= 0 && target.alive) {
    target.hp = 0; target.alive = false;
    spawnDeathPoof(target.x, target.y, target.brawler.color);
    SFX.death(); addShake(6);
    if (attacker && attacker !== target) attacker.stats.eliminations++;
    if (mode.onDeath) mode.onDeath(target, attacker, now);
  }
}

// ===== 必殺技 =====
function fireSuper(f, mode, now) {
  if (f.superCharge < f.superMax || !f.alive) return;
  f.superCharge = 0;
  SFX.superFire();
  const enemies = mode.fighters.filter(t => t.alive && t.team !== f.team);
  const allies = mode.fighters.filter(t => t.alive && (t.team === f.team));
  switch (f.brawler.superId) {
    case "rex_barrage": {
      const angs = spreadAngles(f.aimAngle, 9, 70);
      for (const a of angs) {
        const p = makeProjectile(f, a, { ...f.brawler.attack, damage: f.brawler.attack.damage * 0.9, count: 1, projSpeed: 700 }, now);
        mode.projectiles.push(p);
      }
      addShake(4);
      break;
    }
    case "nova_laser": {
      const a = f.aimAngle;
      const ex = f.x + Math.cos(a) * 900, ey = f.y + Math.sin(a) * 900;
      spawnLaserBeam(f.x, f.y, ex, ey, f.brawler.color);
      addShake(8);
      for (const t of enemies) {
        const d = pointToSegDist(t.x, t.y, f.x, f.y, ex, ey);
        if (d <= t.radius + 10 && clearLineOfSight(mode.map, f.x, f.y, t.x, t.y)) applyDamage(t, 140, f, mode, now);
      }
      break;
    }
    case "bomta_bigbomb": {
      const a = f.aimAngle;
      const tx = f.x + Math.cos(a) * f.brawler.attack.range * 1.1, ty = f.y + Math.sin(a) * f.brawler.attack.range * 1.1;
      const p = { id: nextId(), owner: f, ownerTeam: f.team, arc: true, t: 0, totalTime: 0.55, startX: f.x, startY: f.y, targetX: tx, targetY: ty, aoe: 100, damage: 110, radius: 12, color: "#ffb020", life: 1, kind: "lob" };
      mode.projectiles.push(p);
      break;
    }
    case "heal_burst": {
      for (const t of allies) {
        t.hp = Math.min(t.maxHp, t.hp + 90);
        t.speedBoostUntil = now + 3; t.speedBoostFactor = 1.35;
        spawnParticles(t.x, t.y, "#ff8fd6", 16, { speed: 140, life: 0.5, size: 4 });
      }
      SFX.heal(); addShake(2);
      break;
    }
    case "tanker_charge": {
      f.dashUntil = now + 0.35; f.invulnUntil = now + 0.35;
      f.dashVX = Math.cos(f.aimAngle) * 700; f.dashVY = Math.sin(f.aimAngle) * 700;
      f._chargeHit = new Set();
      f._chargeUntil = now + 0.35; f._chargeMode = mode;
      addShake(5);
      break;
    }
    case "wind_dash": {
      f.dashUntil = now + 0.28; f.invulnUntil = now + 0.32;
      f.dashVX = Math.cos(f.aimAngle) * 900; f.dashVY = Math.sin(f.aimAngle) * 900;
      f.speedBoostUntil = now + 1.2; f.speedBoostFactor = 1.3;
      f._chargeHit = new Set(); f._chargeUntil = now + 0.28; f._chargeMode = mode; f._chargeDmg = 60;
      break;
    }
    case "shota_rapid": {
      f.rapidUntil = now + 3.2;
      break;
    }
    case "frost_freeze": {
      for (const t of enemies) {
        if (dist(t.x, t.y, f.x, f.y) <= 160) {
          t.frozenUntil = now + 1.6; t.stunUntil = now + 1.6;
          spawnParticles(t.x, t.y, "#8fe8ff", 14, { speed: 100, life: 0.5, size: 4 });
        }
      }
      spawnParticles(f.x, f.y, "#8fe8ff", 26, { speed: 220, life: 0.5, size: 5 });
      SFX.freeze(); addShake(4);
      break;
    }
    case "venom_cloud": {
      const a = f.aimAngle;
      const cx = f.x + Math.cos(a) * 220, cy = f.y + Math.sin(a) * 220;
      mode.clouds = mode.clouds || [];
      mode.clouds.push({ x: cx, y: cy, r: 80, until: now + 4, dps: 26, team: f.team, owner: f });
      spawnParticles(cx, cy, "#7bd83a", 20, { speed: 60, life: 1, size: 6 });
      break;
    }
    case "ghost_strike": {
      const a = f.aimAngle;
      let tx = f.x + Math.cos(a) * 260, ty = f.y + Math.sin(a) * 260;
      let target = null, best = 1e9;
      for (const t of enemies) {
        const d = dist(f.x, f.y, t.x, t.y);
        if (d < 340 && d < best) { best = d; target = t; }
      }
      if (target) { tx = target.x; ty = target.y; }
      if (canOccupy(mode.map, tx, ty, f.radius)) { f.x = tx; f.y = ty; }
      f.invulnUntil = now + 0.25; f.stealthUntil = now + 1.2;
      spawnParticles(f.x, f.y, f.brawler.color, 18, { speed: 200, life: 0.4, size: 4 });
      for (const t of enemies) if (dist(t.x, t.y, f.x, f.y) <= 70) applyDamage(t, 90, f, mode, now);
      break;
    }
  }
}

function pointToSegDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = clamp(t, 0, 1);
  return dist(px, py, x1 + dx * t, y1 + dy * t);
}
function clearLineOfSight(map, x1, y1, x2, y2) {
  const steps = Math.ceil(dist(x1, y1, x2, y2) / 16);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocksBullet(map, lerp(x1, x2, t), lerp(y1, y2, t))) return false;
  }
  return true;
}
let laserBeams = [];
function spawnLaserBeam(x1, y1, x2, y2, color) { laserBeams.push({ x1, y1, x2, y2, color, life: 0.25, maxLife: 0.25 }); }
function updateLasers(dt) {
  for (let i = laserBeams.length - 1; i >= 0; i--) { laserBeams[i].life -= dt; if (laserBeams[i].life <= 0) laserBeams.splice(i, 1); }
}

function updateChargeHits(f, mode, now) {
  if (!f._chargeUntil || now > f._chargeUntil) return;
  for (const t of mode.fighters) {
    if (!t.alive || t.team === f.team || f._chargeHit.has(t.id)) continue;
    if (circleHit(f.x, f.y, f.radius + 6, t.x, t.y, t.radius)) {
      applyDamage(t, f._chargeDmg || 70, f, mode, now);
      t.stunUntil = Math.max(t.stunUntil, now + 0.5);
      const a = Math.atan2(t.y - f.y, t.x - f.x);
      t.dashUntil = now + 0.15; t.dashVX = Math.cos(a) * 500; t.dashVY = Math.sin(a) * 500;
      f._chargeHit.add(t.id);
    }
  }
}

const DOT_TICK = 0.3;
function updatePoisonClouds(mode, dt, now) {
  if (!mode.clouds) return;
  mode.clouds = mode.clouds.filter(c => c.until > now);
  for (const c of mode.clouds) {
    c.tickT = (c.tickT || 0) + dt;
    if (c.tickT < DOT_TICK) continue;
    const amt = c.dps * c.tickT; c.tickT = 0;
    for (const t of mode.fighters) {
      if (!t.alive || t.team === c.team) continue;
      if (dist(t.x, t.y, c.x, c.y) <= c.r) applyDamage(t, amt, c.owner, mode, now, { silent: true });
    }
  }
}

// 毒ダーツなどのダメージオーバータイム(まとめてtickで処理し、SEを連打しない)
function updateStatusDots(mode, dt, now) {
  for (const f of mode.fighters) {
    if (!f.alive) continue;
    if (now < f.poisonUntil && f.poisonDps > 0) {
      f.dotTickT = (f.dotTickT || 0) + dt;
      if (f.dotTickT >= DOT_TICK) {
        const amt = f.poisonDps * f.dotTickT; f.dotTickT = 0;
        applyDamage(f, amt, null, mode, now, { silent: true });
      }
    } else f.dotTickT = 0;
  }
}
