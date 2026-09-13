// ===== オンライン対戦: Supabase Realtime (Broadcast/Presence) によるホスト権威型通信 =====
"use strict";

const SUPABASE_URL = "https://kifnzvktwbomxthzvvgy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZm56dmt0d2JvbXh0aHp2dmd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzgxMzgsImV4cCI6MjA5MzQxNDEzOH0.M7nXP-u--6J_6rRpgz1cJj21_7KX6MtfTmZy77Xf_IE";
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 紛らわしい 0/O/1/I を除外
const SNAPSHOT_EVERY_N_TICKS = 2; // ホスト→ゲストへ送るスナップショットの間引き(約30Hz)
const INPUT_SEND_INTERVAL_MS = 50; // ゲスト→ホストへの入力送信間隔(約20Hz)

function genRoomCode(len = 5) {
  let s = "";
  for (let i = 0; i < len; i++) s += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  return s;
}

// ホストが読む「オンライン対戦相手(ゲスト)の入力」バッファ。
// 生の連続値(held状態)から自前でエッジ検出し、必殺技が1回だけ発動するようにする。
class DuelRemoteInput {
  constructor() {
    this.raw = { moveX: 0, moveY: 0, aimAngle: 0, firing: false, superHeld: false };
    this.prevSuperHeld = false;
    this.lastUpdate = 0;
  }
  apply(data) { Object.assign(this.raw, data); this.lastUpdate = Date.now(); }
  read() {
    const stale = Date.now() - this.lastUpdate > 2000;
    const r = stale ? { moveX: 0, moveY: 0, aimAngle: this.raw.aimAngle, firing: false, superHeld: false } : this.raw;
    const wantSuper = !!(r.superHeld && !this.prevSuperHeld);
    this.prevSuperHeld = !!r.superHeld;
    return { moveX: r.moveX, moveY: r.moveY, aimAngle: r.aimAngle, firing: !!r.firing, wantSuper, connected: !stale };
  }
}

class OnlineSession {
  constructor() {
    this.client = null;
    this.channel = null;
    this.role = null; // 'host' | 'guest'
    this.roomCode = null;
    this.myId = Math.random().toString(36).slice(2, 10);
    this.peerPresent = false;
    this.handlers = {};
    this.remoteInput = new DuelRemoteInput();
    this.latencyMs = null;
    this._pingTimer = null;
    this._inputSendTimer = null;
  }

  _ensureClient() {
    if (!this.client) {
      if (!window.supabase) throw new Error("通信ライブラリの読み込みに失敗しました。通信環境を確認してください。");
      this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  }

  on(type, cb) { this.handlers[type] = cb; }

  createRoom() {
    this._ensureClient();
    this.role = "host";
    this.roomCode = genRoomCode();
    return this._joinChannel(this.roomCode).then(() => this.roomCode);
  }

  joinRoom(code) {
    this._ensureClient();
    this.role = "guest";
    this.roomCode = (code || "").toUpperCase().trim();
    return this._joinChannel(this.roomCode);
  }

  _joinChannel(code) {
    return new Promise((resolve, reject) => {
      const ch = this.client.channel("brawl-duel-" + code, {
        config: { broadcast: { self: false }, presence: { key: this.myId } },
      });
      this.channel = ch;
      ch.on("broadcast", { event: "msg" }, ({ payload }) => this._handleMessage(payload));
      ch.on("presence", { event: "sync" }, () => this._handlePresence());
      let settled = false;
      const timeout = setTimeout(() => { if (!settled) { settled = true; reject(new Error("TIMEOUT")); } }, 9000);
      ch.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          try { await ch.track({ role: this.role }); } catch (e) { /* ignore */ }
          if (!settled) { settled = true; clearTimeout(timeout); resolve(); }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (!settled) { settled = true; clearTimeout(timeout); reject(new Error(status)); }
        }
      });
    });
  }

  _handlePresence() {
    if (!this.channel) return;
    const state = this.channel.presenceState();
    const others = Object.keys(state).filter((k) => k !== this.myId);
    const wasPresent = this.peerPresent;
    this.peerPresent = others.length > 0;
    if (this.peerPresent && !wasPresent && this.handlers.peerJoined) this.handlers.peerJoined();
    if (!this.peerPresent && wasPresent && this.handlers.peerLeft) this.handlers.peerLeft();
  }

  _handleMessage(payload) {
    const { type, data } = payload || {};
    if (!type) return;
    if (type === "input") { this.remoteInput.apply(data); return; }
    if (type === "ping") { this.send("pong", { t: data.t }); return; }
    if (type === "pong") { this.latencyMs = Date.now() - data.t; return; }
    if (this.handlers[type]) this.handlers[type](data);
  }

  send(type, data) {
    if (!this.channel) return;
    this.channel.send({ type: "broadcast", event: "msg", payload: { type, data } });
  }

  // ゲスト用: 自分の入力を定期的にホストへ送信し続ける(連続値なので変化検出はせず一定間隔で送る)
  startInputStream(getRawFn) {
    if (this._inputSendTimer) return;
    this._inputSendTimer = setInterval(() => this.send("input", getRawFn()), INPUT_SEND_INTERVAL_MS);
  }

  startPing() {
    if (this._pingTimer) return;
    this._pingTimer = setInterval(() => this.send("ping", { t: Date.now() }), 2500);
  }

  leave() {
    if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null; }
    if (this._inputSendTimer) { clearInterval(this._inputSendTimer); this._inputSendTimer = null; }
    if (this.channel) { this.channel.unsubscribe(); this.channel = null; }
    this.peerPresent = false;
  }
}

// ===== デュエル対戦の状態同期(ホスト→ゲストへのスナップショット) =====
function buildDuelSnapshot(mode) {
  return {
    state: mode.state, countdownT: mode.countdownT, elapsed: mode.elapsed,
    scoreA: mode.scoreA, scoreB: mode.scoreB,
    winTeam: mode.result ? mode.result.winTeam : null, reason: mode.result ? mode.result.reason : null,
    fighters: mode.fighters.map((f) => ({
      x: Math.round(f.x * 10) / 10, y: Math.round(f.y * 10) / 10, facing: f.facing, aimAngle: f.aimAngle,
      hp: Math.round(f.hp * 10) / 10, maxHp: f.maxHp, ammo: f.ammo, ammoMax: f.ammoMax, alive: f.alive,
      superCharge: Math.round(f.superCharge), superMax: f.superMax, hitFlash: f.hitFlash,
      invulnUntil: f.invulnUntil, slowUntil: f.slowUntil, poisonUntil: f.poisonUntil,
      frozenUntil: f.frozenUntil, stunUntil: f.stunUntil, stealthUntil: f.stealthUntil,
      carryingGems: f.carryingGems, eliminations: f.stats.eliminations, damageDealt: Math.round(f.stats.damageDealt),
      respawnTimer: f.respawnTimer,
    })),
    projectiles: mode.projectiles.map((p) => ({
      x: Math.round(p.x), y: Math.round(p.y), height: p.height || 0, radius: p.radius, color: p.color,
      kind: p.kind, arc: !!p.arc, angle: p.arc ? 0 : Math.atan2(p.vy, p.vx),
    })),
  };
}

// 直前のスナップショットとの差分から、被弾/撃破/必殺技発動などの演出をゲスト側で推測して再現する。
function inferRemoteEffects(mode, prevFighters) {
  if (!prevFighters) return;
  mode.fighters.forEach((f, i) => {
    const prev = prevFighters[i];
    if (!prev) return;
    if (f.alive && prev.alive && f.hp < prev.hp - 0.5) {
      spawnHitSpark(f.x, f.y, "#fff");
      SFX.hit();
    }
    if (prev.alive && !f.alive) { spawnDeathPoof(f.x, f.y, f.brawler.color); SFX.death(); addShake(6); }
    if (prev.superCharge >= f.superMax - 1 && f.superCharge < 10) {
      spawnParticles(f.x, f.y, f.brawler.color, 16, { speed: 180, life: 0.4, size: 4 });
      SFX.superFire();
    }
  });
}

function applyDuelSnapshot(mode, data) {
  const wasEnded = mode.state === "ended";
  const prevFighters = mode.fighters.map((f) => ({ alive: f.alive, hp: f.hp, superCharge: f.superCharge, maxHp: f.maxHp }));
  mode.state = data.state; mode.countdownT = data.countdownT; mode.elapsed = data.elapsed;
  mode.scoreA = data.scoreA; mode.scoreB = data.scoreB;
  data.fighters.forEach((fd, i) => {
    const f = mode.fighters[i];
    if (!f) return;
    f.x = fd.x; f.y = fd.y; f.facing = fd.facing; f.aimAngle = fd.aimAngle;
    f.hp = fd.hp; f.maxHp = fd.maxHp; f.ammo = fd.ammo; f.ammoMax = fd.ammoMax; f.alive = fd.alive;
    f.superCharge = fd.superCharge; f.superMax = fd.superMax; f.hitFlash = fd.hitFlash;
    f.invulnUntil = fd.invulnUntil; f.slowUntil = fd.slowUntil; f.poisonUntil = fd.poisonUntil;
    f.frozenUntil = fd.frozenUntil; f.stunUntil = fd.stunUntil; f.stealthUntil = fd.stealthUntil;
    f.carryingGems = fd.carryingGems; f.stats.eliminations = fd.eliminations; f.stats.damageDealt = fd.damageDealt;
    f.respawnTimer = fd.respawnTimer;
  });
  mode.projectiles = data.projectiles.map((p) => ({
    x: p.x, y: p.y, height: p.height, radius: p.radius, color: p.color, kind: p.kind, arc: p.arc,
    vx: Math.cos(p.angle) * 1, vy: Math.sin(p.angle) * 1,
  }));
  inferRemoteEffects(mode, prevFighters);
  if (data.state === "ended" && !wasEnded) {
    const myFighter = mode.fighters.find((f) => f.isPlayer);
    mode.result = {
      winTeam: data.winTeam, reason: data.reason,
      playerWon: myFighter ? data.winTeam === myFighter.team : false,
      placement: null, player: myFighter,
    };
  }
}
