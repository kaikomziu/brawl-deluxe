// ===== 入力(キーボード/マウス/タッチ) =====
const Input = {
  keys: {}, mouseX: 480, mouseY: 320, mouseDown: false,
  superPressed: false, superQueued: false,
  touchMove: { active: false, dx: 0, dy: 0 },
  touchAim: { active: false, dx: 0, dy: 0 },
  touchSuperQueued: false,
  isTouch: false,
};

function initInput(canvas) {
  window.addEventListener("keydown", (e) => {
    Input.keys[e.code] = true;
    if (e.code === "Space" || e.code === "KeyE") { if (!Input.superPressed) Input.superQueued = true; Input.superPressed = true; }
  });
  window.addEventListener("keyup", (e) => { Input.keys[e.code] = false; if (e.code === "Space" || e.code === "KeyE") Input.superPressed = false; });

  function toCanvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  }
  canvas.addEventListener("mousemove", (e) => {
    const c = toCanvasCoords(e.clientX, e.clientY);
    Input.mouseX = c.x; Input.mouseY = c.y;
  });
  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) Input.mouseDown = true;
    if (e.button === 2) { if (!Input.superPressed) Input.superQueued = true; Input.superPressed = true; }
  });
  window.addEventListener("mouseup", (e) => { if (e.button === 0) Input.mouseDown = false; if (e.button === 2) Input.superPressed = false; });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  if ("ontouchstart" in window || navigator.maxTouchPoints > 0) Input.isTouch = true;
  setupJoystick(document.getElementById("joyMove"), document.getElementById("joyMoveKnob"), Input.touchMove);
  setupJoystick(document.getElementById("joyAim"), document.getElementById("joyAimKnob"), Input.touchAim);
  const superBtn = document.getElementById("btnSuper");
  if (superBtn) {
    superBtn.addEventListener("touchstart", (e) => { e.preventDefault(); Input.touchSuperQueued = true; }, { passive: false });
    superBtn.addEventListener("click", () => { Input.touchSuperQueued = true; });
  }
}

function setupJoystick(base, knob, state) {
  if (!base || !knob) return;
  let activeId = null;
  const maxR = 38;
  function update(clientX, clientY) {
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    let dx = clientX - cx, dy = clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > maxR) { dx = (dx / d) * maxR; dy = (dy / d) * maxR; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    state.dx = dx / maxR; state.dy = dy / maxR; state.active = Math.hypot(state.dx, state.dy) > 0.15;
  }
  function reset() {
    state.active = false; state.dx = 0; state.dy = 0; activeId = null;
    knob.style.transform = "translate(0,0)";
  }
  base.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const t = e.changedTouches[0]; activeId = t.identifier;
    update(t.clientX, t.clientY);
  }, { passive: false });
  base.addEventListener("touchmove", (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === activeId) update(t.clientX, t.clientY);
  }, { passive: false });
  base.addEventListener("touchend", (e) => {
    for (const t of e.changedTouches) if (t.identifier === activeId) reset();
  });
  base.addEventListener("touchcancel", reset);
}

function readPlayerInput(player) {
  let mx = 0, my = 0;
  if (Input.touchMove.active) { mx = Input.touchMove.dx; my = Input.touchMove.dy; }
  else {
    if (Input.keys["KeyW"] || Input.keys["ArrowUp"]) my -= 1;
    if (Input.keys["KeyS"] || Input.keys["ArrowDown"]) my += 1;
    if (Input.keys["KeyA"] || Input.keys["ArrowLeft"]) mx -= 1;
    if (Input.keys["KeyD"] || Input.keys["ArrowRight"]) mx += 1;
  }
  let aimAngle = player.aimAngle, firing = false;
  if (Input.touchAim.active) {
    aimAngle = Math.atan2(Input.touchAim.dy, Input.touchAim.dx);
    firing = true;
  } else {
    aimAngle = Math.atan2(Input.mouseY - player.y, Input.mouseX - player.x);
    firing = Input.mouseDown;
  }
  let wantSuper = false;
  if (Input.superQueued) { wantSuper = true; Input.superQueued = false; }
  if (Input.touchSuperQueued) { wantSuper = true; Input.touchSuperQueued = false; }
  return { moveX: mx, moveY: my, aimAngle, firing, wantSuper };
}
