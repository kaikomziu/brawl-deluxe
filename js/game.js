// ===== ゲーム本体・メインループ =====
const Game = {
  canvas: null, ctx: null,
  mode: null, selectedBrawler: null, selectedMode: null, difficulty: "normal",
  save: null, paused: false, lastTime: 0, resultShown: false, endTimer: 0,
};

function defaultSave() {
  return { trophiesTotal: 0, brawlerTrophies: {}, matchesPlayed: 0, settings: { volume: 0.6, muted: false } };
}

function fitCanvas() {
  const c = Game.canvas;
  if (!c) return;
  const ratio = (MAP_W * TILE) / (MAP_H * TILE);
  let w = window.innerWidth, h = w / ratio;
  if (h > window.innerHeight) { h = window.innerHeight; w = h * ratio; }
  c.style.width = w + "px"; c.style.height = h + "px";
}

function initGame() {
  Game.canvas = $("gameCanvas");
  Game.canvas.width = MAP_W * TILE; Game.canvas.height = MAP_H * TILE;
  Game.ctx = Game.canvas.getContext("2d");
  Game.save = loadSave() || defaultSave();
  if (!Game.save.settings) Game.save.settings = { volume: 0.6, muted: false };
  cacheUI();
  initInput(Game.canvas);
  document.body.classList.toggle("touchMode", Input.isTouch);
  applySettingsUI();
  wireButtons();
  fitCanvas();
  window.addEventListener("resize", fitCanvas);
  showScreen("screenTitle");
  requestAnimationFrame(loop);
}

function wireButtons() {
  $("btnPlay").addEventListener("click", () => { SFX.ensure(); SFX.click(); renderBrawlerSelect(); showScreen("screenBrawlerSelect"); });
  $("btnHowTo").addEventListener("click", () => { SFX.click(); showScreen("screenHowTo"); });
  $("btnSettingsTitle").addEventListener("click", () => { SFX.click(); showScreen("screenSettings"); });
  $("btnBackHowTo").addEventListener("click", () => { SFX.click(); showScreen("screenTitle"); });
  $("btnBackSettings").addEventListener("click", () => { SFX.click(); showScreen("screenTitle"); });
  $("btnBrawlerNext").addEventListener("click", () => {
    if (!Game.selectedBrawler) return;
    SFX.click(); renderModeSelect(); showScreen("screenModeSelect");
  });
  $("btnBrawlerBack").addEventListener("click", () => { SFX.click(); showScreen("screenTitle"); });
  $("btnModeBack").addEventListener("click", () => { SFX.click(); showScreen("screenBrawlerSelect"); });
  UI.btnStartMatch.addEventListener("click", () => { SFX.click(); startMatch(); });

  UI.volumeSlider.addEventListener("input", (e) => {
    Game.save.settings.volume = parseFloat(e.target.value);
    SFX.setVolume(Game.save.settings.volume); writeSave(Game.save);
  });
  UI.muteToggle.addEventListener("change", (e) => {
    Game.save.settings.muted = e.target.checked;
    SFX.setMuted(Game.save.settings.muted); writeSave(Game.save);
  });

  $("btnPause").addEventListener("click", () => togglePause(true));
  $("btnResume").addEventListener("click", () => togglePause(false));
  $("btnPauseSettings").addEventListener("click", () => { showScreen("screenSettings"); UI.pauseModal.classList.add("hidden"); });
  $("btnQuit").addEventListener("click", () => { Game.paused = false; UI.pauseModal.classList.add("hidden"); showScreen("screenTitle"); });
  window.addEventListener("keydown", (e) => { if (e.code === "Escape" && Game.mode && Game.mode.state === "playing") togglePause(!Game.paused); });

  $("btnRematch").addEventListener("click", () => { SFX.click(); startMatch(); });
  $("btnResultsMenu").addEventListener("click", () => { SFX.click(); showScreen("screenTitle"); });
}

function togglePause(p) {
  Game.paused = p;
  UI.pauseModal.classList.toggle("hidden", !p);
}

function startMatch() {
  SFX.ensure();
  let mode;
  if (Game.selectedMode === "gemgrab") mode = createGemGrabMode(Game.selectedBrawler, Game.difficulty);
  else if (Game.selectedMode === "showdown") mode = createShowdownMode(Game.selectedBrawler, Game.difficulty);
  else mode = createBrawlBallMode(Game.selectedBrawler, Game.difficulty);
  Game.mode = mode;
  Game.paused = false; Game.resultShown = false; Game.endTimer = 0;
  particles = []; damagePopups = []; laserBeams = []; screenShake = 0; hitStop = 0;
  UI.hudSuperFill.closest(".superBox").classList.remove("ready");
  showScreen("hud");
}

function loop(ts) {
  requestAnimationFrame(loop);
  const now = ts / 1000;
  let dt = Math.min(0.033, (ts - (Game.lastTime || ts)) / 1000);
  Game.lastTime = ts;
  updateParticles(dt);
  if (Game.mode && !Game.paused) {
    if (hitStop <= 0) {
      const mode = Game.mode;
      const player = mode.fighters.find(f => f.isPlayer);
      if (player && mode.state === "playing" && player.alive) {
        const inp = readPlayerInput(player);
        player.moveX = inp.moveX; player.moveY = inp.moveY; player.aimAngle = inp.aimAngle;
        if (inp.firing) tryFire(player, mode, now);
        if (inp.wantSuper) fireSuper(player, mode, now);
      } else if (player) { player.moveX = 0; player.moveY = 0; }
      updateMode(mode, dt, now);
      updateHUD(mode, now);
      if (mode.state === "ended" && !Game.resultShown) {
        Game.endTimer += dt;
        if (Game.endTimer > 1.4) { Game.resultShown = true; showResults(mode); }
      }
    }
  }
  render(now);
}

function render(now) {
  const ctx = Game.ctx;
  ctx.save();
  ctx.clearRect(0, 0, Game.canvas.width, Game.canvas.height);
  if (screenShake > 0) ctx.translate(rand(-screenShake, screenShake), rand(-screenShake, screenShake));
  if (Game.mode) drawWorld(ctx, Game.mode, now);
  ctx.restore();
}
