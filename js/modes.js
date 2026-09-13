// ===== ゲームモード =====
const MODE_INFO = {
  gemgrab: { name: "ジェムグラブ", icon: "💎", desc: "中央の鉱山からジェムを集め、10個以上持ったまま生き残れ。相手を倒すとジェムを落とさせられる。", timeLimit: 180 },
  showdown: { name: "ショーダウン", icon: "🏆", desc: "10人による一人用バトルロイヤル。安全地帯が縮み続ける中、最後まで生き残った1人が優勝。", timeLimit: 210 },
  brawlball: { name: "ブロールボール", icon: "⚽", desc: "3vs3のサッカー対決。ボールを相手ゴールに運べば1点。先に2点取ったチームの勝ち。", timeLimit: 180 },
};

function pickBotBrawlers(excludeId, count) {
  const pool = shuffle(BRAWLERS.filter(b => b.id !== excludeId));
  return pool.slice(0, count).map(b => b.id);
}

function baseMode(id, map, difficulty) {
  return {
    id, map, difficulty,
    fighters: [], projectiles: [], gems: [], clouds: [],
    state: "countdown", countdownT: 3.4, elapsed: 0,
    timeLimit: MODE_INFO[id].timeLimit, result: null,
  };
}

// ---------- ジェムグラブ ----------
function createGemGrabMode(playerBrawlerId, difficulty) {
  const map = pickMap("gemgrab");
  const mode = baseMode("gemgrab", map, difficulty);
  const botIds = pickBotBrawlers(playerBrawlerId, 5);
  const teamAExtra = [botIds[0], botIds[1]];
  const teamB = [botIds[2], botIds[3], botIds[4]];
  mode.fighters.push(createFighter(playerBrawlerId, "A", map.spawnsA[0].x, map.spawnsA[0].y, { isPlayer: true }));
  teamAExtra.forEach((id, i) => mode.fighters.push(createFighter(id, "A", map.spawnsA[i + 1].x, map.spawnsA[i + 1].y, { difficulty, name: getBrawler(id).name + " (味方)" })));
  teamB.forEach((id, i) => mode.fighters.push(createFighter(id, "B", map.spawnsB[i].x, map.spawnsB[i].y, { difficulty })));
  mode.gemSpawnT = 2.5;
  mode.suddenDeathT = null;
  mode.onDeath = (target, attacker, now) => {
    for (let i = 0; i < target.carryingGems; i++) {
      mode.gems.push({ x: target.x + rand(-24, 24), y: target.y + rand(-24, 24), id: nextId() });
    }
    target.carryingGems = 0;
    target.respawnTimer = now + 4.2;
  };
  mode.teamGems = (team) => mode.fighters.filter(f => f.team === team).reduce((s, f) => s + f.carryingGems, 0);
  return mode;
}

function tickGemGrab(mode, dt, now) {
  mode.gemSpawnT -= dt;
  if (mode.gemSpawnT <= 0 && mode.gems.length < 14) {
    mode.gemSpawnT = 2.6;
    const m = mode.map.gemMine;
    mode.gems.push({ x: m.x + rand(-14, 14), y: m.y + rand(-14, 14), id: nextId() });
  }
  for (const f of mode.fighters) {
    if (!f.alive) continue;
    for (let i = mode.gems.length - 1; i >= 0; i--) {
      const g = mode.gems[i];
      if (dist(f.x, f.y, g.x, g.y) <= f.radius + 12) {
        f.carryingGems++; f.stats.gemsCollected++;
        mode.gems.splice(i, 1);
        SFX.pickup(); spawnGemSparkle(g.x, g.y);
      }
    }
  }
  const gA = mode.teamGems("A"), gB = mode.teamGems("B");
  mode.scoreA = gA; mode.scoreB = gB;
  if (gA >= 10 && gB < 10) {
    if (mode.suddenDeathT == null) mode.suddenDeathT = 15;
    mode.suddenDeathT -= dt;
    if (mode.suddenDeathT <= 0) return finishMode(mode, "A", "10ジェム達成");
  } else if (gB >= 10 && gA < 10) {
    if (mode.suddenDeathT == null) mode.suddenDeathT = 15;
    mode.suddenDeathT -= dt;
    if (mode.suddenDeathT <= 0) return finishMode(mode, "B", "10ジェム達成");
  } else mode.suddenDeathT = null;
  if (mode.elapsed >= mode.timeLimit) {
    if (gA !== gB) return finishMode(mode, gA > gB ? "A" : "B", "タイムアップ");
  }
}

// ---------- ショーダウン ----------
function createShowdownMode(playerBrawlerId, difficulty) {
  const map = pickMap("showdown");
  const mode = baseMode("showdown", map, difficulty);
  const botIds = pickBotBrawlers(playerBrawlerId, 9);
  const spawns = shuffle(map.showdownSpawns);
  mode.fighters.push(createFighter(playerBrawlerId, "p0", spawns[0].x, spawns[0].y, { isPlayer: true }));
  botIds.forEach((id, i) => mode.fighters.push(createFighter(id, "p" + (i + 1), spawns[i + 1].x, spawns[i + 1].y, { difficulty })));
  mode.zone = { x: map.zoneCenter.x, y: map.zoneCenter.y, r: map.zoneStartR };
  mode.powerCubes = map.cubeSpots.map(c => ({ x: c.x, y: c.y, taken: false, id: nextId() }));
  mode.placements = [];
  mode.onDeath = (target, attacker, now) => {
    const aliveNow = mode.fighters.filter(f => f.alive).length;
    mode.placements.push({ f: target, place: aliveNow + 1 });
  };
  return mode;
}

function tickShowdown(mode, dt, now) {
  const frac = clamp(mode.elapsed / (mode.timeLimit * 0.8), 0, 1);
  mode.zone.r = lerp(mode.map.zoneStartR, mode.map.zoneEndR, frac);
  for (const f of mode.fighters) {
    if (!f.alive) continue;
    if (dist(f.x, f.y, mode.zone.x, mode.zone.y) > mode.zone.r) {
      f._zoneTickT = (f._zoneTickT || 0) + dt;
      if (f._zoneTickT >= DOT_TICK) { applyDamage(f, 14 * f._zoneTickT, null, mode, now, { silent: true }); f._zoneTickT = 0; }
    }
    for (const c of mode.powerCubes) {
      if (!c.taken && dist(f.x, f.y, c.x, c.y) <= f.radius + 14) {
        c.taken = true;
        f.maxHp *= 1.12; f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.12);
        f.brawler = { ...f.brawler, attack: { ...f.brawler.attack, damage: f.brawler.attack.damage * 1.1 } };
        SFX.pickup(); spawnParticles(f.x, f.y, "#ffd23f", 14, { speed: 140, life: 0.4, size: 4 });
      }
    }
  }
  const aliveList = mode.fighters.filter(f => f.alive);
  if (aliveList.length <= 1) {
    const winner = aliveList[0];
    if (winner) return finishMode(mode, winner.team, "最後の生き残り", winner);
    return finishMode(mode, null, "全滅");
  }
}

// ---------- ブロールボール ----------
function createBrawlBallMode(playerBrawlerId, difficulty) {
  const map = pickMap("brawlball");
  const mode = baseMode("brawlball", map, difficulty);
  const botIds = pickBotBrawlers(playerBrawlerId, 5);
  mode.fighters.push(createFighter(playerBrawlerId, "A", map.spawnsA[0].x, map.spawnsA[0].y, { isPlayer: true }));
  [botIds[0], botIds[1]].forEach((id, i) => mode.fighters.push(createFighter(id, "A", map.spawnsA[i + 1].x, map.spawnsA[i + 1].y, { difficulty })));
  [botIds[2], botIds[3], botIds[4]].forEach((id, i) => mode.fighters.push(createFighter(id, "B", map.spawnsB[i].x, map.spawnsB[i].y, { difficulty })));
  mode.ball = { x: map.ballSpawn.x, y: map.ballSpawn.y, vx: 0, vy: 0, radius: 13, carrier: null };
  mode.scoreA = 0; mode.scoreB = 0;
  mode.goalTarget = 2;
  mode.onDeath = (target, attacker, now) => {
    dropBall(mode, target);
    target.respawnTimer = now + 4.2;
  };
  return mode;
}

function dropBall(mode, f) {
  if (mode.ball.carrier === f) {
    mode.ball.carrier = null; f.carryingBall = false;
    mode.ball.x = f.x; mode.ball.y = f.y;
    mode.ball.vx = Math.cos(f.facing) * 60; mode.ball.vy = Math.sin(f.facing) * 60;
  }
}

function kickoffReset(mode, now) {
  mode.ball.carrier = null;
  mode.ball.x = mode.map.ballSpawn.x; mode.ball.y = mode.map.ballSpawn.y;
  mode.ball.vx = 0; mode.ball.vy = 0;
  for (const f of mode.fighters) {
    f.carryingBall = false;
    const spawns = f.team === "A" ? mode.map.spawnsA : mode.map.spawnsB;
    const idx = mode.fighters.filter(x => x.team === f.team).indexOf(f);
    const s = spawns[idx] || spawns[0];
    f.x = s.x; f.y = s.y; f.alive = true; f.hp = f.maxHp; f.ammo = f.ammoMax;
    f.slowUntil = 0; f.poisonUntil = 0; f.stunUntil = 0; f.frozenUntil = 0; f.dashUntil = 0;
    f.invulnUntil = now + 1.2; f.respawnTimer = 0;
  }
}

function tickBrawlBall(mode, dt, now) {
  const ball = mode.ball;
  if (ball.carrier) {
    if (!ball.carrier.alive) { ball.carrier = null; }
    else { ball.x = ball.carrier.x + Math.cos(ball.carrier.facing) * (ball.carrier.radius + 10); ball.y = ball.carrier.y + Math.sin(ball.carrier.facing) * (ball.carrier.radius + 10); }
  } else {
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    ball.vx *= 0.9; ball.vy *= 0.9;
    if (isSolid(mode.map, ball.x, ball.y)) { ball.x -= ball.vx * dt; ball.y -= ball.vy * dt; ball.vx *= -0.5; ball.vy *= -0.5; }
    ball.x = clamp(ball.x, ball.radius, MAP_W * TILE - ball.radius);
    ball.y = clamp(ball.y, ball.radius, MAP_H * TILE - ball.radius);
    for (const f of mode.fighters) {
      if (!f.alive) continue;
      if (dist(f.x, f.y, ball.x, ball.y) <= f.radius + ball.radius) { ball.carrier = f; f.carryingBall = true; break; }
    }
  }
  if (pointInRect(ball.x, ball.y, mode.map.goalA.x, mode.map.goalA.y, mode.map.goalA.w, mode.map.goalA.h)) {
    mode.scoreB++; SFX.goal(); addShake(10); spawnExplosion(ball.x, ball.y, 40);
    if (mode.scoreB >= mode.goalTarget && mode.elapsed > 5) return finishMode(mode, "B", "ゴール達成");
    kickoffReset(mode, now);
  } else if (pointInRect(ball.x, ball.y, mode.map.goalB.x, mode.map.goalB.y, mode.map.goalB.w, mode.map.goalB.h)) {
    mode.scoreA++; SFX.goal(); addShake(10); spawnExplosion(ball.x, ball.y, 40);
    if (mode.scoreA >= mode.goalTarget && mode.elapsed > 5) return finishMode(mode, "A", "ゴール達成");
    kickoffReset(mode, now);
  }
  if (mode.elapsed >= mode.timeLimit && mode.scoreA !== mode.scoreB) {
    return finishMode(mode, mode.scoreA > mode.scoreB ? "A" : "B", "タイムアップ");
  }
}

function finishMode(mode, winTeam, reason, winnerFighter) {
  if (mode.state === "ended") return;
  mode.state = "ended";
  const player = mode.fighters.find(f => f.isPlayer);
  let playerWon = false, placement = null;
  if (mode.id === "showdown") {
    placement = mode.placements.filter(p => p.f === player)[0]?.place;
    if (!placement) placement = 1; // 生き残った
    playerWon = placement === 1;
  } else {
    playerWon = winTeam === player.team;
  }
  mode.result = { winTeam, reason, playerWon, placement, player };
}

// メインの更新ディスパッチ
function updateMode(mode, dt, now) {
  if (mode.state === "countdown") {
    const prev = Math.ceil(mode.countdownT);
    mode.countdownT -= dt;
    const cur = Math.ceil(mode.countdownT);
    if (cur !== prev && cur >= 0) SFX.countdown(cur === 0);
    if (mode.countdownT <= 0) mode.state = "playing";
    return;
  }
  if (mode.state !== "playing") return;
  mode.elapsed += dt;

  for (const f of mode.fighters) {
    if (!f.alive) {
      if (mode.id !== "showdown" && f.respawnTimer && now >= f.respawnTimer) {
        const spawns = f.team === "A" ? mode.map.spawnsA : (f.team === "B" ? mode.map.spawnsB : null);
        const pt = spawns ? choice(spawns) : { x: f.spawnX, y: f.spawnY };
        f.x = pt.x; f.y = pt.y; f.alive = true; f.hp = f.maxHp; f.ammo = f.ammoMax;
        f.invulnUntil = now + 1.6; f.respawnTimer = 0;
      }
      continue;
    }
    if (f.isBot) updateBotAI(f, mode, now, dt);
    moveFighter(f, dt, mode.map, now, mode.fighters);
    updateChargeHits(f, mode, now);
    if (f.rapidUntil && now < f.rapidUntil) { f.fireCooldown = 0; f.ammo = Math.max(f.ammo, 1); }
  }
  updateProjectiles(mode, dt, now);
  updateStatusDots(mode, dt, now);
  updatePoisonClouds(mode, dt, now);
  updateLasers(dt);

  if (mode.id === "gemgrab") tickGemGrab(mode, dt, now);
  else if (mode.id === "showdown") tickShowdown(mode, dt, now);
  else if (mode.id === "brawlball") tickBrawlBall(mode, dt, now);
}
