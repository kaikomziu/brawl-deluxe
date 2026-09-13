// ===== UI 画面制御 =====
const UI = {};
function $(id) { return document.getElementById(id); }

function cacheUI() {
  ["screenTitle", "screenBrawlerSelect", "screenModeSelect", "screenSettings", "screenHowTo", "screenResults",
    "hud", "pauseModal",
    "brawlerGrid", "brawlerDetail", "modeGrid", "diffGrid",
    "hudTop", "hudTimer", "hudPlayerName", "hudPlayerIcon", "hudHealthFill", "hudHealthText",
    "hudAmmoPips", "hudSuperFill", "hudSuperLabel", "countdownOverlay", "countdownText",
    "respawnOverlay", "respawnText", "resultTitle", "resultReason", "resultTrophy", "resultStats",
    "totalTrophies", "volumeSlider", "muteToggle", "btnStartMatch", "goalScoreLine",
    "btnOnlineDuel", "screenOnlineMenu", "screenOnlineLobby", "onlineMenuError", "joinCodeInput",
    "onlineRoomCode", "onlineMeRole", "onlineMeBrawler", "onlineOppCard", "onlineOppBrawler",
    "onlineStatus", "btnOnlineStart", "onlineWaitingHost", "onlineDisconnectOverlay", "onlineDisconnectMsg",
  ].forEach(id => (UI[id] = $(id)));
}

function showScreen(id) {
  ["screenTitle", "screenBrawlerSelect", "screenModeSelect", "screenSettings", "screenHowTo", "screenResults", "hud",
    "screenOnlineMenu", "screenOnlineLobby"]
    .forEach(s => UI[s] && UI[s].classList.add("hidden"));
  if (UI[id]) UI[id].classList.remove("hidden");
}

function unlockedTrophyNeeded(brawlerId) {
  const idx = UNLOCK_ORDER.indexOf(brawlerId);
  return UNLOCK_THRESHOLDS[idx] ?? 0;
}
function isUnlocked(save, brawlerId) { return save.trophiesTotal >= unlockedTrophyNeeded(brawlerId); }

function renderBrawlerSelect() {
  UI.totalTrophies.textContent = "🏆 " + Game.save.trophiesTotal;
  UI.brawlerGrid.innerHTML = "";
  BRAWLERS.forEach(b => {
    const unlocked = isUnlocked(Game.save, b.id);
    const trophies = Game.save.brawlerTrophies[b.id] || 0;
    const card = document.createElement("div");
    card.className = "brawlerCard" + (unlocked ? "" : " locked") + (Game.selectedBrawler === b.id ? " selected" : "");
    card.style.setProperty("--bcolor", b.color);
    card.innerHTML = `<div class="bcIcon">${unlocked ? b.icon : "🔒"}</div>
      <div class="bcName">${b.name}</div>
      <div class="bcTrophy">${unlocked ? "🏆 " + trophies : "必要 🏆" + unlockedTrophyNeeded(b.id)}</div>`;
    if (unlocked) card.addEventListener("click", () => selectBrawler(b.id));
    UI.brawlerGrid.appendChild(card);
  });
  if (Game.selectedBrawler) selectBrawler(Game.selectedBrawler, true);
}

function selectBrawler(id, silent) {
  Game.selectedBrawler = id;
  if (!silent) SFX.click();
  document.querySelectorAll(".brawlerCard").forEach(c => c.classList.remove("selected"));
  const idx = BRAWLERS.findIndex(b => b.id === id);
  const cards = UI.brawlerGrid.children;
  if (cards[idx]) cards[idx].classList.add("selected");
  const b = getBrawler(id);
  UI.brawlerDetail.innerHTML = `<span class="bdIcon">${b.icon}</span>
    <div><div class="bdName" style="color:${b.color}">${b.name}<span class="bdRole">${b.role}</span></div>
    <div class="bdDesc">${b.desc}</div>
    <div class="bdStats">❤️ ${b.hp}　🏃 ${b.speed}　🎯 射程${b.attack.range}</div></div>`;
  UI.brawlerDetail.classList.remove("hidden");
}

function renderModeSelect() {
  UI.modeGrid.innerHTML = "";
  Object.keys(MODE_INFO).forEach(id => {
    const m = MODE_INFO[id];
    const card = document.createElement("div");
    card.className = "modeCard" + (Game.selectedMode === id ? " selected" : "");
    card.innerHTML = `<div class="mcIcon">${m.icon}</div><div class="mcName">${m.name}</div><div class="mcDesc">${m.desc}</div>`;
    card.addEventListener("click", () => {
      Game.selectedMode = id; SFX.click();
      document.querySelectorAll(".modeCard").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      UI.btnStartMatch.disabled = false;
      UI.btnOnlineDuel.classList.toggle("hidden", id !== "duel");
    });
    UI.modeGrid.appendChild(card);
  });
  const diffs = [["weak", "よわい"], ["normal", "ふつう"], ["strong", "つよい"], ["pro", "激つよ"]];
  UI.diffGrid.innerHTML = "";
  diffs.forEach(([id, label]) => {
    const btn = document.createElement("button");
    btn.className = "diffBtn" + (Game.difficulty === id ? " selected" : "");
    btn.textContent = label;
    btn.addEventListener("click", () => {
      Game.difficulty = id; SFX.click();
      document.querySelectorAll(".diffBtn").forEach(c => c.classList.remove("selected"));
      btn.classList.add("selected");
    });
    UI.diffGrid.appendChild(btn);
  });
  UI.btnStartMatch.disabled = !Game.selectedMode;
  UI.btnOnlineDuel.classList.toggle("hidden", Game.selectedMode !== "duel");
}

function fillAmmoPips(f) {
  UI.hudAmmoPips.innerHTML = "";
  for (let i = 0; i < f.ammoMax; i++) {
    const d = document.createElement("div");
    d.className = "pip" + (i < f.ammo ? " full" : "");
    UI.hudAmmoPips.appendChild(d);
  }
}

function updateHUD(mode, now) {
  const player = mode.fighters.find(f => f.isPlayer);
  UI.hudTimer.textContent = fmtTime(mode.timeLimit - mode.elapsed);
  if (mode.id === "gemgrab") {
    UI.hudTop.innerHTML = `<span class="teamA">🔵 ${mode.scoreA ?? 0}</span> <span class="gemIcon">💎</span> <span class="teamB">${mode.scoreB ?? 0} 🔴</span>`;
  } else if (mode.id === "brawlball") {
    UI.hudTop.innerHTML = `<span class="teamA">🔵 ${mode.scoreA}</span> - <span class="teamB">${mode.scoreB} 🔴</span>`;
  } else if (mode.id === "showdown") {
    const alive = mode.fighters.filter(f => f.alive).length;
    UI.hudTop.innerHTML = `🏆 残り ${alive} 人`;
  } else if (mode.id === "duel") {
    const myTeam = player ? player.team : "A";
    const myScore = myTeam === "A" ? mode.scoreA : mode.scoreB;
    const oppScore = myTeam === "A" ? mode.scoreB : mode.scoreA;
    UI.hudTop.innerHTML = `🤺 自分 ${myScore} - ${oppScore} 相手 (先取${mode.killTarget})`;
  }
  if (player) {
    UI.hudPlayerIcon.textContent = player.brawler.icon;
    UI.hudHealthFill.style.width = clamp((player.hp / player.maxHp) * 100, 0, 100) + "%";
    UI.hudHealthText.textContent = Math.ceil(Math.max(0, player.hp)) + "/" + Math.round(player.maxHp);
    fillAmmoPips(player);
    const superPct = clamp((player.superCharge / player.superMax) * 100, 0, 100);
    UI.hudSuperFill.style.width = superPct + "%";
    UI.hudSuperLabel.textContent = superPct >= 100 ? "必殺技 発動可能!" : "必殺技";
    UI.hudSuperFill.closest(".superBox").classList.toggle("ready", superPct >= 100);
    UI.respawnOverlay.classList.toggle("hidden", player.alive);
    if (!player.alive && player.respawnTimer) {
      UI.respawnText.textContent = "復活まで " + Math.max(0, Math.ceil(player.respawnTimer - now)) + "秒";
    }
  }
  if (mode.state === "countdown") {
    UI.countdownOverlay.classList.remove("hidden");
    const c = Math.ceil(mode.countdownT);
    UI.countdownText.textContent = c > 0 ? String(c) : "FIGHT!";
  } else {
    UI.countdownOverlay.classList.add("hidden");
  }
}

function placementLabel(p) {
  if (p === 1) return "🥇 優勝!";
  if (p === 2) return "🥈 2位";
  if (p === 3) return "🥉 3位";
  return p + "位";
}

function computeTrophyDelta(mode) {
  const r = mode.result;
  if (mode.id === "showdown") {
    const table = { 1: 9, 2: 6, 3: 4, 4: 2, 5: 1, 6: -1, 7: -1, 8: -2, 9: -2, 10: -3 };
    return table[r.placement] ?? 0;
  }
  return r.playerWon ? 8 : -2;
}

function showResults(mode) {
  const r = mode.result;
  const player = r.player || mode.fighters.find(f => f.isPlayer);
  const delta = computeTrophyDelta(mode);
  const bId = Game.selectedBrawler;
  Game.save.brawlerTrophies[bId] = Math.max(0, (Game.save.brawlerTrophies[bId] || 0) + delta);
  Game.save.trophiesTotal = Object.values(Game.save.brawlerTrophies).reduce((a, b) => a + b, 0);
  Game.save.matchesPlayed = (Game.save.matchesPlayed || 0) + 1;
  writeSave(Game.save);

  const won = mode.id === "showdown" ? r.placement === 1 : r.playerWon;
  UI.resultTitle.textContent = won ? "🎉 WIN!" : (mode.id === "showdown" ? placementLabel(r.placement) : "😢 LOSE...");
  UI.resultTitle.className = won ? "win" : "lose";
  let sideLabel = "";
  if (r.winTeam && (mode.id === "gemgrab" || mode.id === "brawlball")) {
    sideLabel = `(${r.winTeam === player.team ? "🔵 味方チーム" : "🔴 敵チーム"}の勝利)`;
  } else if (r.winTeam && mode.id === "duel") {
    sideLabel = `(${r.playerWon ? "自分" : "相手"}の勝利)`;
  }
  UI.resultReason.textContent = r.reason + sideLabel;
  UI.resultTrophy.innerHTML = `🏆 ${delta >= 0 ? "+" : ""}${delta}`;
  UI.resultTrophy.className = delta >= 0 ? "gain" : "loss";
  UI.resultStats.innerHTML = `<div>与ダメージ ${Math.round(player.stats.damageDealt)}</div><div>撃破数 ${player.stats.eliminations}</div>` +
    (mode.id === "gemgrab" ? `<div>集めたジェム ${player.stats.gemsCollected}</div>` : "") +
    (mode.id === "brawlball" ? `<div>スコア 🔵${mode.scoreA} - ${mode.scoreB}🔴</div>` : "");
  if (won) SFX.win(); else SFX.lose();
  showScreen("screenResults");
}

function applySettingsUI() {
  UI.volumeSlider.value = Game.save.settings.volume;
  UI.muteToggle.checked = Game.save.settings.muted;
  SFX.setVolume(Game.save.settings.volume);
  SFX.setMuted(Game.save.settings.muted);
}
