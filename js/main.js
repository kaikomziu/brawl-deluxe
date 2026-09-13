// ===== 起動 =====
window.addEventListener("DOMContentLoaded", () => {
  initGame();
  const v = document.getElementById("versionTag");
  if (v) v.textContent = BRAWL_VERSION;
});
