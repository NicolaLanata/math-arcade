/* Math Arcade - shared behavior (vanilla JS) */

(function () {
  "use strict";

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // Silent: offline will still work after a good install.
      });
    });
  }

  function inGamesFolder() {
    // Works for GitHub Pages and local hosting
    const path = window.location.pathname;
    return path.includes("/games/");
  }

  function injectGameHeader() {
    const body = document.body;
    if (!body || body.dataset.arcadePage !== "game") return;

    const backHref = inGamesFolder() ? "../index.html" : "index.html";

    const header = document.createElement("header");
    header.className = "arcade-header";
    header.innerHTML = `
      <a class="arcade-back" href="${backHref}">← Arcade</a>
      <div class="arcade-title">Math Arcade</div>
      <div class="arcade-spacer"></div>
    `;
    body.insertBefore(header, body.firstChild);
  }

  function renderHome() {
    const host = document.getElementById("arcadeHome");
    if (!host || typeof MATH_ARCADE_GAMES === "undefined") return;

    const games = [...MATH_ARCADE_GAMES].sort((a, b) => (a.order || 0) - (b.order || 0));

    const practice = games.filter(g => g.kind === "practice");
    const arcade = games.filter(g => g.kind === "game");

    host.innerHTML = `
      <section class="arcade-sect" aria-label="Tricks and Practice">
        <h2>📘 Tricks & Practice</h2>
        <div class="arcade-grid" id="gridPractice"></div>
      </section>

      <section class="arcade-sect" aria-label="Arcade Games">
        <h2>🎮 Arcade Games</h2>
        <div class="arcade-grid" id="gridArcade"></div>
      </section>

      <section class="arcade-sect" aria-label="Parents">
        <h2>Parents</h2>
        <a class="arcade-btn" href="settings.html">⚙️ Reset Progress</a>
      </section>
    `;

    function tileHtml(g) {
      return `
        <a class="arcade-tile" href="${g.href}" data-kind="${g.kind}">
          <div class="arcade-badge" aria-hidden="true">${g.badge || ""}</div>
          <div class="tile-icon" aria-hidden="true">${g.icon || "🎲"}</div>
          <div class="tile-name">${g.title}</div>
          <div class="tile-desc">${g.desc || ""}</div>
        </a>
      `;
    }

    const gridPractice = document.getElementById("gridPractice");
    const gridArcade = document.getElementById("gridArcade");

    gridPractice.innerHTML = practice.map(tileHtml).join("");
    gridArcade.innerHTML = arcade.map(tileHtml).join("");
  }

  function setupParentalGate() {
    const qEl = document.getElementById("gateQuestion");
    const ansEl = document.getElementById("gateAnswer");
    const unlockBtn = document.getElementById("gateUnlock");
    const resetBtn = document.getElementById("resetProgress");
    const msgEl = document.getElementById("gateMsg");

    if (!qEl || !ansEl || !unlockBtn || !resetBtn) return;

    // Simple local gate: random arithmetic (no external services)
    const a = 3 + Math.floor(Math.random() * 7);  // 3..9
    const b = 2 + Math.floor(Math.random() * 7);  // 2..8
    const correct = a + b;

    qEl.textContent = `To unlock, answer: ${a} + ${b} = ?`;

    function setMsg(txt) {
      msgEl.textContent = txt || "";
    }

    unlockBtn.addEventListener("click", () => {
      const v = parseInt(ansEl.value.trim(), 10);
      if (!Number.isFinite(v)) { setMsg("Type a number."); return; }
      if (v === correct) {
        resetBtn.disabled = false;
        setMsg("Unlocked.");
      } else {
        setMsg("Not correct.");
      }
    });

    resetBtn.addEventListener("click", () => {
      // Clear only our known prefixes (do NOT wipe unrelated site data)
      const prefixes = [
        "mathArcade_",
        "addDef_",
        "subDef_",
        "multDef_",
        "divDef_",
        "evenOdd_",
        "predChoice_"
      ];

      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (prefixes.some(p => k.startsWith(p))) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));

      setMsg(`Progress reset (${toRemove.length} item${toRemove.length === 1 ? "" : "s"}).`);
      resetBtn.disabled = true;
      ansEl.value = "";
    });
  }

  // Init
  registerServiceWorker();
  injectGameHeader();
  renderHome();
  setupParentalGate();

})();
