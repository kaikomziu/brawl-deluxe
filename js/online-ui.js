// ===== オンライン対戦: ロビーUI =====
"use strict";

const ONLINE = {
  session: null, role: null, code: null,
  myBrawlerId: null, oppBrawlerId: null,
  inBattle: false,
};

function showOnlineMenuError(msg) { UI.onlineMenuError.textContent = msg || ""; }

function openOnlineMenu() {
  showOnlineMenuError("");
  UI.joinCodeInput.value = "";
  showScreen("screenOnlineMenu");
}

function onlineCreateRoom() {
  showOnlineMenuError("接続しています…");
  const session = new OnlineSession();
  session.createRoom().then((code) => {
    ONLINE.session = session;
    showOnlineMenuError("");
    enterOnlineLobby(code, "host");
  }).catch(() => {
    showOnlineMenuError("ルーム作成に失敗しました。通信環境を確認してもう一度お試しください。");
  });
}

function onlineJoinRoom() {
  const code = UI.joinCodeInput.value.trim().toUpperCase();
  if (code.length < 4) { showOnlineMenuError("コードを入力してください。"); return; }
  showOnlineMenuError("接続しています…");
  const session = new OnlineSession();
  session.joinRoom(code).then(() => {
    setTimeout(() => {
      if (!session.peerPresent) {
        session.leave();
        showOnlineMenuError("ルームが見つかりません。コードを確認するか、相手がルームを作ってから入室してください。");
      } else {
        ONLINE.session = session;
        showOnlineMenuError("");
        enterOnlineLobby(code, "guest");
      }
    }, 1300);
  }).catch(() => {
    showOnlineMenuError("接続に失敗しました。通信環境を確認してもう一度お試しください。");
  });
}

function enterOnlineLobby(code, role) {
  ONLINE.role = role; ONLINE.code = code;
  ONLINE.myBrawlerId = Game.selectedBrawler;
  ONLINE.oppBrawlerId = null;
  ONLINE.inBattle = false;
  const session = ONLINE.session;

  UI.onlineRoomCode.textContent = code;
  UI.onlineMeRole.textContent = role === "host" ? "(ホスト)" : "(ゲスト)";
  UI.btnOnlineStart.style.display = role === "host" ? "block" : "none";
  UI.onlineWaitingHost.classList.toggle("hidden", role === "host");

  session.on("peerJoined", () => { renderOnlineStatus(); sendOnlineLobbyState(); });
  session.on("peerLeft", () => {
    ONLINE.oppBrawlerId = null;
    renderOnlineLobby(); renderOnlineStatus();
  });
  session.on("lobby", (data) => {
    const firstTime = ONLINE.oppBrawlerId == null;
    ONLINE.oppBrawlerId = data.brawlerId;
    renderOnlineLobby();
    // 相手がこちらの初回ブロードキャストをまだ受け取れていない可能性があるため、
    // 初めて相手の情報を受け取った時に自分の情報を返す(ハンドシェイクの取りこぼし対策)
    if (firstTime) sendOnlineLobbyState();
  });
  session.on("start", (data) => { startOnlineDuel("guest", data); });

  session.startPing();
  renderOnlineLobby();
  renderOnlineStatus();
  sendOnlineLobbyState();
  showScreen("screenOnlineLobby");
}

function sendOnlineLobbyState() {
  if (ONLINE.session) ONLINE.session.send("lobby", { brawlerId: ONLINE.myBrawlerId });
}

function renderOnlineStatus() {
  if (!ONLINE.session || !ONLINE.session.peerPresent) UI.onlineStatus.textContent = "🕒 相手を待っています…コードを伝えてね";
  else UI.onlineStatus.textContent = "✅ 相手が接続しました！";
}

function renderOnlineLobby() {
  const me = getBrawler(ONLINE.myBrawlerId);
  UI.onlineMeBrawler.innerHTML = `<span class="obIcon">${me.icon}</span><span>${me.name}</span>`;
  if (ONLINE.oppBrawlerId) {
    const opp = getBrawler(ONLINE.oppBrawlerId);
    UI.onlineOppCard.classList.add("active");
    UI.onlineOppBrawler.innerHTML = `<span class="obIcon">${opp.icon}</span><span>${opp.name}</span>`;
  } else {
    UI.onlineOppCard.classList.remove("active");
    UI.onlineOppBrawler.innerHTML = `<span class="obIcon">?</span><span>未接続</span>`;
  }
  UI.btnOnlineStart.disabled = !ONLINE.oppBrawlerId;
}

function onlineStartBattle() {
  if (!ONLINE.oppBrawlerId) return;
  // マップはホストが1回だけ決めてゲストに伝え、両者が必ず同じマップになるようにする
  const map = pickMap("duel");
  const cfg = { hostBrawlerId: ONLINE.myBrawlerId, guestBrawlerId: ONLINE.oppBrawlerId, mapId: map.id };
  ONLINE.session.send("start", cfg);
  startOnlineDuel("host", cfg);
}

function startOnlineDuel(role, cfg) {
  ONLINE.inBattle = true;
  startDuelOnlineMatch(role, cfg.hostBrawlerId, cfg.guestBrawlerId, ONLINE.session, cfg.mapId);
}

function onlineLeaveLobby() {
  if (ONLINE.session) { ONLINE.session.leave(); ONLINE.session = null; }
  ONLINE.oppBrawlerId = null; ONLINE.inBattle = false;
  openOnlineMenu();
}

function showOnlineDisconnect(msg) {
  UI.onlineDisconnectMsg.textContent = msg;
  UI.onlineDisconnectOverlay.classList.remove("hidden");
}

function onlineDisconnectBackToMenu() {
  UI.onlineDisconnectOverlay.classList.add("hidden");
  if (ONLINE.session) { ONLINE.session.leave(); ONLINE.session = null; }
  ONLINE.inBattle = false;
  Game.mode = null;
  showScreen("screenTitle");
}
