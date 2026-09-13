// ===== 起動 =====
window.addEventListener("DOMContentLoaded", () => {
  initGame();
  const v = document.getElementById("versionTag");
  if (v) v.textContent = "v" + BRAWL_VERSION;
});
