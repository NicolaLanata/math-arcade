/* Math Arcade - Mission Mode Core (vanilla JS, offline)
   Used ONLY by sum_mission.html and subtraction_mission.html.
*/
(function () {
  "use strict";

  const PROBLEMS_PER_MISSION = 5;

  function $(id) { return document.getElementById(id); }

  function fmtTimeMs(ms) {
    const s = Math.max(0, ms) / 1000;
    const m = Math.floor(s / 60);
    const r = s - 60 * m;
    if (m === 0) return `${r.toFixed(1)}s`;
    return `${m}:${r.toFixed(1).padStart(4, "0")}s`;
  }

  function safeParseJSON(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function bestKey(prefix, level) {
    return `${prefix}_best_L${level}`;
  }

  function loadBest(prefix, level) {
    const raw = localStorage.getItem(bestKey(prefix, level));
    if (!raw) return null;
    const obj = safeParseJSON(raw);
    if (!obj || typeof obj !== "object") return null;
    if (!Number.isFinite(obj.correct) || !Number.isFinite(obj.timeMs)) return null;
    return {
      name: (typeof obj.name === "string" && obj.name.trim()) ? obj.name.trim() : "Player",
      correct: obj.correct,
      timeMs: obj.timeMs
    };
  }

  function saveBest(prefix, level, rec) {
    try {
      localStorage.setItem(bestKey(prefix, level), JSON.stringify(rec));
    } catch {
      // ignore quota/private mode errors
    }
  }

  function isBetterAttempt(a, b) {
    // Lexicographic: higher correct always better; if tie, lower time wins.
    if (!b) return true;
    if (a.correct !== b.correct) return a.correct > b.correct;
    return a.timeMs < b.timeMs;
  }

  function recToText(rec) {
    if (!rec) return "Best: —";
    return `Best: ${rec.correct}/${PROBLEMS_PER_MISSION} in ${fmtTimeMs(rec.timeMs)} • ${rec.name}`;
  }

  function normalizeName(s) {
    const t = (s || "").trim();
    if (!t) return "Player";
    return t.slice(0, 18);
  }

  function getStoredName() {
    const p = window.MathArcadeProgress;
    if (p && typeof p.getActiveUserName === "function") {
      return normalizeName(p.getActiveUserName());
    }
    const v = localStorage.getItem("mathArcade_playerName") || "";
    return normalizeName(v);
  }

  function setStoredName(name) {
    const normalized = normalizeName(name);
    try { localStorage.setItem("mathArcade_playerName", normalized); } catch {}
  }

  function init(config) {
    if (!config || typeof config !== "object") throw new Error("Mission config missing");
    if (typeof config.generateProblem !== "function") throw new Error("generateProblem(level) required");
    if (typeof config.storagePrefix !== "string" || !config.storagePrefix) throw new Error("storagePrefix required");
    if (typeof config.title !== "string" || !config.title) config.title = "Mission";

    const elTitle = $("missionTitle");
    const elName = $("playerName");

    const screenLevel = $("screenLevel");
    const screenRun = $("screenRun");
    const screenEnd = $("screenEnd");

    const elBest1 = $("bestL1");
    const elBest2 = $("bestL2");
    const elBest3 = $("bestL3");

    const elLevelTag = $("levelTag");
    const elTimer = $("timerText");
    const elCounter = $("counterText");
    const elMarkers = $("markers");

    const elEquation = $("equationText");
    const elAnswer = $("answerText");
    const elFeedback = $("feedbackText");

    const btnAgain = $("btnAgain");
    const btnLevels = $("btnLevels");

    const elEndSummary = $("endSummary");
    const elEndBest = $("endBest");

    if (!screenLevel || !screenRun || !screenEnd) throw new Error("Mission screens missing");

    if (elTitle) elTitle.textContent = config.title;

    if (elName) {
      elName.value = getStoredName();
      elName.addEventListener("input", () => setStoredName(elName.value));
    }

    // State
    let level = 1;
    let index = 0;
    let correct = 0;
    let results = new Array(PROBLEMS_PER_MISSION).fill(null); // true/false
    let current = null;
    let input = "";
    let locked = false;

    let timerStarted = false;
    let startMs = 0;
    let endMs = 0;
    let timerInterval = null;

    let lastLevelPlayed = 1;
    let playerName = "Player";

    // Celebration (balloons), mirroring Sum/Subtraction Master.
    function ensureCelebrationArea() {
      let area = document.getElementById("celebration-area");
      if (area) return area;
      area = document.createElement("div");
      area.id = "celebration-area";
      area.style.position = "fixed";
      area.style.top = "0";
      area.style.left = "0";
      area.style.width = "100%";
      area.style.height = "100%";
      area.style.pointerEvents = "none";
      area.style.zIndex = "1";
      document.body.insertBefore(area, document.body.firstChild);
      return area;
    }

    function triggerCelebration() {
      const area = ensureCelebrationArea();
      const colors = [
        "rgba(231,76,60,0.95)",
        "rgba(52,152,219,0.95)",
        "rgba(46,204,113,0.95)",
        "rgba(241,196,15,0.95)",
        "rgba(155,89,182,0.95)"
      ];
      const count = 15;
      for (let i = 0; i < count; i++) {
        const b = document.createElement("div");
        b.className = "balloon";
        b.style.left = (Math.random() * 90) + "%";
        b.style.background = colors[Math.floor(Math.random() * colors.length)];
        const dur = 3 + Math.random() * 2;
        b.style.animationDuration = dur + "s";
        area.appendChild(b);
        window.setTimeout(() => { b.remove(); }, Math.ceil(dur * 1000) + 250);
      }
    }

    function show(which) {
      screenLevel.style.display = (which === "level") ? "block" : "none";
      screenRun.style.display = (which === "run") ? "block" : "none";
      screenEnd.style.display = (which === "end") ? "block" : "none";
    }

    function refreshBest() {
      if (elBest1) elBest1.textContent = recToText(loadBest(config.storagePrefix, 1));
      if (elBest2) elBest2.textContent = recToText(loadBest(config.storagePrefix, 2));
      if (elBest3) elBest3.textContent = recToText(loadBest(config.storagePrefix, 3));
    }

    function rebuildMarkers() {
      if (!elMarkers) return;
      elMarkers.innerHTML = "";
      for (let i = 0; i < PROBLEMS_PER_MISSION; i++) {
        const d = document.createElement("div");
        d.className = "mission-marker";
        elMarkers.appendChild(d);
      }
    }

    function updateMarkers() {
      if (!elMarkers) return;
      const kids = Array.from(elMarkers.children);
      for (let i = 0; i < kids.length; i++) {
        kids[i].classList.remove("ok", "bad", "active");
        if (i === index) kids[i].classList.add("active");
        if (results[i] === true) kids[i].classList.add("ok");
        if (results[i] === false) kids[i].classList.add("bad");
      }
    }

    function setFeedback(kind, txt) {
      if (!elFeedback) return;
      elFeedback.textContent = txt || "";
      elFeedback.classList.remove("ok", "bad");
      if (kind) elFeedback.classList.add(kind);
    }

    function setAnswer() {
      if (!elAnswer) return;
      elAnswer.textContent = input.length ? input : "—";
    }

    function updateTop() {
      if (elLevelTag) elLevelTag.textContent = `Level ${level}`;
      if (elCounter) elCounter.textContent = `Problem ${index + 1}/${PROBLEMS_PER_MISSION}`;
    }

    function setTimerText(ms) {
      if (!elTimer) return;
      elTimer.textContent = fmtTimeMs(ms);
    }

    function startTimerIfNeeded() {
      if (timerStarted) return;
      timerStarted = true;
      startMs = performance.now();
      setTimerText(0);
      if (timerInterval) window.clearInterval(timerInterval);
      timerInterval = window.setInterval(() => {
        setTimerText(performance.now() - startMs);
      }, 100);
    }

    function stopTimer() {
      if (timerInterval) window.clearInterval(timerInterval);
      timerInterval = null;
      if (!timerStarted) {
        endMs = 0;
        return;
      }
      endMs = performance.now();
      setTimerText(endMs - startMs);
    }

    function newProblem() {
      locked = false;
      input = "";
      setAnswer();
      setFeedback(null, "");

      if (index >= PROBLEMS_PER_MISSION) {
        finishMission();
        return;
      }

      current = config.generateProblem(level);
      if (!current || typeof current !== "object") throw new Error("generateProblem returned invalid object");
      if (typeof current.text !== "string" || !current.text) throw new Error("generateProblem must return text");
      if (!Number.isFinite(current.answer)) throw new Error("generateProblem must return numeric answer");

      if (elEquation) elEquation.textContent = current.text;
      updateTop();
      updateMarkers();
    }

    function finishMission() {
      stopTimer();
      const totalMs = timerStarted ? (endMs - startMs) : 0;

      const attempt = {
        name: playerName,
        correct: correct,
        timeMs: totalMs
      };

      const prev = loadBest(config.storagePrefix, level);
      const better = isBetterAttempt(attempt, prev);
      if (better) saveBest(config.storagePrefix, level, attempt);

      const best = loadBest(config.storagePrefix, level);

      if (elEndSummary) elEndSummary.textContent = `${correct}/${PROBLEMS_PER_MISSION} correct • ${fmtTimeMs(totalMs)}`;
      if (elEndBest) {
        if (!best) elEndBest.textContent = "Best: —";
        else elEndBest.textContent = (better ? "New best! " : "Best: ") + `${best.correct}/${PROBLEMS_PER_MISSION} in ${fmtTimeMs(best.timeMs)} • ${best.name}`;
      }

      const p = window.MathArcadeProgress;
      if (p && typeof p.recordMissionResult === "function") {
        p.recordMissionResult({
          correct: correct,
          total: PROBLEMS_PER_MISSION,
          timeMs: totalMs,
          level: level,
          storagePrefix: config.storagePrefix
        });
      }

      refreshBest();
      show("end");
    }

    function submit() {
      if (locked) return;
      if (!current) return;
      if (!input.length) return;

      startTimerIfNeeded();
      locked = true;

      const given = parseInt(input, 10);
      const ok = Number.isFinite(given) && (given === current.answer);

      if (ok) {
        // Score is based on first-attempt correctness.
        if (results[index] === null) {
          results[index] = true;
          correct += 1;
        }

        updateMarkers();
        setFeedback("ok", "✓");
        triggerCelebration();

        // Stop time right at the final correct submission
        if (index === PROBLEMS_PER_MISSION - 1) stopTimer();

        const delay = 320;
        window.setTimeout(() => {
          index += 1;
          newProblem();
        }, delay);
        return;
      }

      // Wrong: do NOT advance. Require correct before moving on.
      // First wrong attempt marks the problem as incorrect; further wrong attempts do not add more mistakes.
      if (results[index] === null) results[index] = false;
      updateMarkers();
      setFeedback("bad", "✗");

      const delay = 480;
      window.setTimeout(() => {
        locked = false;
        input = "";
        setAnswer();
        setFeedback(null, "");
        updateMarkers();
      }, delay);
    }

    function pressKey(k) {
      if (locked) return;

      if (k === "ok") { submit(); return; }
      if (k === "back") {
        // Backspace shouldn't start the timer on its own.
        if (input.length) input = input.slice(0, -1);
        setAnswer();
        return;
      }

      if (/^[0-9]$/.test(k)) {
        startTimerIfNeeded();
        if (input.length >= 5) return;
        if (input === "0") input = "";
        input += k;
        setAnswer();
      }
    }

    function startMission(lvl) {
      level = lvl;
      lastLevelPlayed = lvl;
      index = 0;
      correct = 0;
      results = new Array(PROBLEMS_PER_MISSION).fill(null);
      current = null;
      input = "";
      locked = false;

      timerStarted = false;
      startMs = 0;
      endMs = 0;
      if (timerInterval) window.clearInterval(timerInterval);
      timerInterval = null;
      setTimerText(0);

      playerName = normalizeName(elName ? elName.value : getStoredName());

      rebuildMarkers();
      updateMarkers();
      updateTop();

      show("run");
      newProblem();
    }

    function bindLevels() {
      const wrap = $("levelButtons");
      if (!wrap) return;
      wrap.addEventListener("click", (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        const btn = t.closest("button[data-level]");
        if (!btn) return;
        const lvl = parseInt(btn.getAttribute("data-level") || "", 10);
        if (!Number.isFinite(lvl) || lvl < 1 || lvl > 3) return;
        startMission(lvl);
      });
    }

    function bindKeypad() {
      const pad = $("missionKeypad");
      if (!pad) return;
      pad.addEventListener("click", (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        const k = t.getAttribute("data-key");
        if (!k) return;
        pressKey(k);
      });
    }

    function bindKeyboard() {
      window.addEventListener("keydown", (e) => {
        if (screenRun.style.display !== "block") return;
        if (locked) return;
        const key = e.key;
        if (/^[0-9]$/.test(key)) { e.preventDefault(); pressKey(key); return; }
        if (key === "Backspace") { e.preventDefault(); pressKey("back"); return; }
        if (key === "Enter") { e.preventDefault(); pressKey("ok"); return; }
      });
    }

    function bindEnd() {
      if (btnAgain) btnAgain.addEventListener("click", () => startMission(lastLevelPlayed));
      if (btnLevels) btnLevels.addEventListener("click", () => { show("level"); });
    }

    refreshBest();
    show("level");
    bindLevels();
    bindKeypad();
    bindKeyboard();
    bindEnd();
  }

  window.MissionCore = { init };
})();
