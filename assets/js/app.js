/* Math Arcade - shared behavior (vanilla JS) */

(function () {
  "use strict";

  const PROFILE_STORAGE_KEY = "mathArcade_global_profiles_v2";
  const STORAGE_SCOPE_PREFIX = "mathArcade_scope_v2_";

  const AVATAR_OPTIONS = ["🦊", "🐼", "🦁", "🐯", "🐨", "🐸", "🐬", "🦄", "🐆", "🐧"];
  const DEFAULT_PLAYER_NAME = "Player";
  const MAX_PLAYER_NAME = 16;

  const SCOPED_KEY_PREFIXES = [
    "mathArcade_",
    "addDef_",
    "subDef_",
    "multDef_",
    "divDef_",
    "evenOdd_",
    "predChoice_",
    "division_"
  ];

  const SCOPED_EXACT_KEYS = new Set([
    "division_remainders_best_v1"
  ]);

  const KNOWN_GAME_ORDER = [
    "visual_sum", "sum_master", "sum_mission", "addition_defense",
    "subtraction_master", "subtraction_mission", "subtraction_defense",
    "atomic_multiplication", "multiplication_mission", "multiplication_defense",
    "division_factory", "division_dismantle", "atomic_division", "division_mission", "division_defense",
    "predecessor_choice", "even_odd"
  ];

  const MISSION_STAR_GAME_IDS = new Set([
    "sum_mission",
    "subtraction_mission",
    "multiplication_mission",
    "division_mission"
  ]);

  const GAME_PAGE_TO_ID = {
    "visual_sum.html": "visual_sum",
    "sum_master.html": "sum_master",
    "subtraction_master.html": "subtraction_master",
    "division_factory.html": "division_factory",
    "division_dismantle_factory.html": "division_dismantle",
    "atomic_multiplication.html": "atomic_multiplication",
    "atomic_division.html": "atomic_division",
    "predecessor_choice.html": "predecessor_choice",
    "even_odd.html": "even_odd",
    "addition_defense.html": "addition_defense",
    "sum_mission.html": "sum_mission",
    "subtraction_defense.html": "subtraction_defense",
    "subtraction_mission.html": "subtraction_mission",
    "division_challenge.html": "division_mission",
    "multiplication_mission.html": "multiplication_mission",
    "multiplication_defense.html": "multiplication_defense",
    "division_defense.html": "division_defense"
  };

  const RECORD_KEY_TO_GAME_ID = {
    "addDef_records_v1": "addition_defense",
    "subDef_records_v1": "subtraction_defense",
    "multDef_records_v1": "multiplication_defense",
    "divDef_records_v1": "division_defense",
    "evenOdd_records_v1": "even_odd",
    "predChoice_records_v1": "predecessor_choice",
    "division_remainders_best_v1": "division_mission"
  };

  let storageNative = null;
  let profilesCache = null;

  function initStorageNative() {
    if (storageNative || !("Storage" in window)) return;
    storageNative = {
      getItem: Storage.prototype.getItem,
      setItem: Storage.prototype.setItem,
      removeItem: Storage.prototype.removeItem,
      key: Storage.prototype.key
    };
  }

  function safeNativeGet(key) {
    initStorageNative();
    if (!storageNative || !("localStorage" in window)) return null;
    try {
      return storageNative.getItem.call(localStorage, key);
    } catch {
      return null;
    }
  }

  function safeNativeSet(key, value) {
    initStorageNative();
    if (!storageNative || !("localStorage" in window)) return;
    try {
      storageNative.setItem.call(localStorage, key, value);
    } catch {
      // ignore private mode / quota errors
    }
  }

  function safeNativeRemove(key) {
    initStorageNative();
    if (!storageNative || !("localStorage" in window)) return;
    try {
      storageNative.removeItem.call(localStorage, key);
    } catch {
      // ignore private mode / quota errors
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function cleanPlayerName(raw) {
    const base = String(raw || "")
      .replace(/[^A-Za-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!base) return DEFAULT_PLAYER_NAME;
    return base.slice(0, MAX_PLAYER_NAME);
  }

  function playerIdFromName(name) {
    const id = cleanPlayerName(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return id || "player-1";
  }

  function pickAvatarForId(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % AVATAR_OPTIONS.length;
    return AVATAR_OPTIONS[idx];
  }

  function createEmptyUser(name, id) {
    const stamp = nowIso();
    return {
      id: id,
      name: cleanPlayerName(name),
      avatar: pickAvatarForId(id),
      createdAt: stamp,
      updatedAt: stamp,
      adventure: {
        totalLaunches: 0,
        lastPlayedId: "",
        games: {}
      }
    };
  }

  function freshProfilesState() {
    return {
      version: 2,
      activeUserId: "",
      users: {}
    };
  }

  function normalizeProfiles(parsed) {
    const base = (parsed && typeof parsed === "object") ? parsed : freshProfilesState();

    if (!base.users || typeof base.users !== "object") base.users = {};

    const normalizedUsers = {};
    Object.keys(base.users).forEach((rawId) => {
      const u = base.users[rawId];
      if (!u || typeof u !== "object") return;

      const cleanName = cleanPlayerName(u.name || rawId);
      const id = playerIdFromName(cleanName);
      const existing = normalizedUsers[id] || createEmptyUser(cleanName, id);

      existing.name = cleanName;
      existing.avatar = AVATAR_OPTIONS.includes(u.avatar) ? u.avatar : existing.avatar;
      existing.createdAt = typeof u.createdAt === "string" ? u.createdAt : existing.createdAt;
      existing.updatedAt = typeof u.updatedAt === "string" ? u.updatedAt : existing.updatedAt;

      const adv = (u.adventure && typeof u.adventure === "object") ? u.adventure : {};
      const games = (adv.games && typeof adv.games === "object") ? adv.games : {};

      const normalizedGames = {};
      Object.keys(games).forEach((gid) => {
        const g = games[gid];
        if (!g || typeof g !== "object") return;
        normalizedGames[gid] = {
          plays: Number.isFinite(g.plays) ? Math.max(0, Math.floor(g.plays)) : 0,
          stars: Number.isFinite(g.stars) ? Math.max(0, Math.min(3, Math.floor(g.stars))) : 0,
          bestCorrect: Number.isFinite(g.bestCorrect) ? g.bestCorrect : null,
          bestTotal: Number.isFinite(g.bestTotal) ? g.bestTotal : null,
          bestTimeMs: Number.isFinite(g.bestTimeMs) ? g.bestTimeMs : null,
          lastPlayedAt: typeof g.lastPlayedAt === "string" ? g.lastPlayedAt : "",
          recordText: typeof g.recordText === "string" ? g.recordText : "",
          scoreValue: Number.isFinite(g.scoreValue) ? g.scoreValue : null,
          scoreLabel: typeof g.scoreLabel === "string" ? g.scoreLabel : ""
        };
      });

      existing.adventure = {
        totalLaunches: Number.isFinite(adv.totalLaunches) ? Math.max(0, Math.floor(adv.totalLaunches)) : 0,
        lastPlayedId: typeof adv.lastPlayedId === "string" ? adv.lastPlayedId : "",
        games: normalizedGames
      };

      normalizedUsers[id] = existing;
    });

    if (!Object.keys(normalizedUsers).length) {
      const fallback = freshProfilesState();
      return fallback;
    }

    let active = typeof base.activeUserId === "string" ? base.activeUserId : "";
    if (!normalizedUsers[active]) {
      active = Object.keys(normalizedUsers)[0] || "";
    }

    return {
      version: 2,
      activeUserId: active,
      users: normalizedUsers
    };
  }

  function loadProfiles() {
    if (profilesCache) return profilesCache;

    const raw = safeNativeGet(PROFILE_STORAGE_KEY);
    if (!raw) {
      profilesCache = freshProfilesState();
      safeNativeSet(PROFILE_STORAGE_KEY, JSON.stringify(profilesCache));
      return profilesCache;
    }

    try {
      profilesCache = normalizeProfiles(JSON.parse(raw));
    } catch {
      profilesCache = freshProfilesState();
    }

    safeNativeSet(PROFILE_STORAGE_KEY, JSON.stringify(profilesCache));
    return profilesCache;
  }

  function saveProfiles() {
    if (!profilesCache) return;
    safeNativeSet(PROFILE_STORAGE_KEY, JSON.stringify(profilesCache));
  }

  function getActiveUser() {
    const state = loadProfiles();
    if (!state.activeUserId || !state.users[state.activeUserId]) return null;
    return state.users[state.activeUserId];
  }

  function touchUser(user) {
    user.updatedAt = nowIso();
  }

  function switchOrCreateUserByName(rawName) {
    const state = loadProfiles();
    const name = cleanPlayerName(rawName);
    const id = playerIdFromName(name);

    if (!state.users[id]) {
      state.users[id] = createEmptyUser(name, id);
    } else {
      state.users[id].name = name;
    }

    state.activeUserId = id;
    touchUser(state.users[id]);
    saveProfiles();
    return state.users[id];
  }

  function switchUserById(id) {
    const state = loadProfiles();
    if (!state.users[id]) return null;
    state.activeUserId = id;
    touchUser(state.users[id]);
    saveProfiles();
    return state.users[id];
  }

  function purgeUserScopedData(userId) {
    if (!userId || !("localStorage" in window)) return 0;
    initStorageNative();
    if (!storageNative) return 0;

    const prefix = `${STORAGE_SCOPE_PREFIX}${userId}::`;
    const toRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = storageNative.key.call(localStorage, i);
      if (!k) continue;
      if (k.startsWith(prefix)) toRemove.push(k);
    }

    toRemove.forEach((k) => safeNativeRemove(k));
    return toRemove.length;
  }

  function deleteUserById(userId) {
    const state = loadProfiles();
    if (!state.users[userId]) return { ok: false, reason: "not-found", removedKeys: 0 };

    delete state.users[userId];
    const removedKeys = purgeUserScopedData(userId);

    const remaining = Object.keys(state.users);
    if (state.activeUserId === userId) {
      state.activeUserId = remaining[0];
      if (!state.activeUserId) state.activeUserId = "";
    }

    saveProfiles();
    return { ok: true, reason: "", removedKeys: removedKeys };
  }

  function setActiveAvatar(avatar) {
    if (!AVATAR_OPTIONS.includes(avatar)) return;
    const user = getActiveUser();
    if (!user) return;
    user.avatar = avatar;
    touchUser(user);
    saveProfiles();
  }

  function getCurrentGameId() {
    const path = window.location.pathname;
    const page = path.split("/").pop() || "";
    if (GAME_PAGE_TO_ID[page]) return GAME_PAGE_TO_ID[page];

    if (typeof MATH_ARCADE_GAMES !== "undefined") {
      const hit = MATH_ARCADE_GAMES.find((g) => {
        if (!g || typeof g.href !== "string") return false;
        return g.href.split("/").pop() === page;
      });
      if (hit) return hit.id;
    }

    return "";
  }

  function ensureGameStats(user, gameId) {
    if (!gameId) return null;
    if (!user.adventure || typeof user.adventure !== "object") {
      user.adventure = { totalLaunches: 0, lastPlayedId: "", games: {} };
    }
    if (!user.adventure.games || typeof user.adventure.games !== "object") {
      user.adventure.games = {};
    }
    if (!user.adventure.games[gameId]) {
      user.adventure.games[gameId] = {
        plays: 0,
        stars: 0,
        bestCorrect: null,
        bestTotal: null,
        bestTimeMs: null,
        lastPlayedAt: "",
        recordText: "",
        scoreValue: null,
        scoreLabel: ""
      };
    }
    return user.adventure.games[gameId];
  }

  function starsFromMission(correct, total) {
    if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) return 0;
    if (correct >= total) return 3;
    if (correct >= total - 1) return 2;
    if (correct >= Math.ceil(total / 2)) return 1;
    return 0;
  }

  function isMissionStarGame(gameId) {
    return MISSION_STAR_GAME_IDS.has(gameId);
  }

  function fmtDuration(ms) {
    if (!Number.isFinite(ms)) return "";
    const totalSec = Math.max(0, ms) / 1000;
    if (totalSec < 60) return `${totalSec.toFixed(1)}s`;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec - mins * 60;
    return `${mins}m ${secs.toFixed(1)}s`;
  }

  function safeParseJson(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function parseScoreboardRecord(raw) {
    const parsed = safeParseJson(raw);
    if (!parsed || typeof parsed !== "object") return null;

    let bestScore = null;
    Object.keys(parsed).forEach((k) => {
      const row = parsed[k];
      if (!row || typeof row !== "object") return;
      if (!Number.isFinite(row.score)) return;
      if (bestScore === null || row.score > bestScore) {
        bestScore = row.score;
      }
    });

    if (bestScore === null) return null;
    return {
      scoreValue: bestScore,
      scoreLabel: String(bestScore),
      recordText: `Best score ${bestScore}`
    };
  }

  function parseMissionLevelRecord(raw, level) {
    const parsed = safeParseJson(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!Number.isFinite(parsed.correct) || !Number.isFinite(parsed.timeMs)) return null;

    const total = 5;
    return {
      stars: starsFromMission(parsed.correct, total),
      bestCorrect: parsed.correct,
      bestTotal: total,
      bestTimeMs: parsed.timeMs,
      scoreValue: parsed.correct,
      scoreLabel: `${parsed.correct}/${total}`,
      recordText: `L${level} best ${parsed.correct}/${total} in ${fmtDuration(parsed.timeMs)}`
    };
  }

  function parseDivisionMissionRecord(raw) {
    const parsed = safeParseJson(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!Number.isFinite(parsed.greens) || !Number.isFinite(parsed.yellows) || !Number.isFinite(parsed.timeMs)) return null;

    const total = 5;
    const greens = Math.max(0, Math.min(total, Math.floor(parsed.greens)));
    const yellows = Math.max(0, Math.min(total - greens, Math.floor(parsed.yellows)));
    const reds = total - greens - yellows;
    return {
      stars: starsFromMission(greens, total),
      bestCorrect: greens,
      bestTotal: total,
      bestTimeMs: parsed.timeMs,
      scoreValue: greens,
      scoreLabel: `${greens}/${total}`,
      recordText: `${greens}G ${yellows}Y ${reds}R in ${fmtDuration(parsed.timeMs)}`
    };
  }

  function patchGameProgress(gameId, patch) {
    if (!gameId || !patch || typeof patch !== "object") return;
    const user = getActiveUser();
    if (!user) return;
    const game = ensureGameStats(user, gameId);
    if (!game) return;

    if (Number.isFinite(patch.stars) && isMissionStarGame(gameId)) {
      game.stars = Math.max(game.stars, Math.max(0, Math.min(3, Math.floor(patch.stars))));
    }

    if (typeof patch.recordText === "string" && patch.recordText.trim()) {
      game.recordText = patch.recordText.trim();
    }

    if (Number.isFinite(patch.scoreValue)) {
      const betterScore = (game.scoreValue === null) || (patch.scoreValue > game.scoreValue);
      if (betterScore) {
        game.scoreValue = patch.scoreValue;
        game.scoreLabel = typeof patch.scoreLabel === "string" && patch.scoreLabel.trim()
          ? patch.scoreLabel.trim()
          : String(patch.scoreValue);
      }
    }

    if (Number.isFinite(patch.bestCorrect) && Number.isFinite(patch.bestTotal)) {
      const betterByScore = (game.bestCorrect === null) || (patch.bestCorrect > game.bestCorrect);
      const tiedScore = (game.bestCorrect !== null) && (patch.bestCorrect === game.bestCorrect);
      const betterByTime = Number.isFinite(patch.bestTimeMs) && (game.bestTimeMs === null || patch.bestTimeMs < game.bestTimeMs);

      if (betterByScore || (tiedScore && betterByTime)) {
        game.bestCorrect = patch.bestCorrect;
        game.bestTotal = patch.bestTotal;
        game.bestTimeMs = Number.isFinite(patch.bestTimeMs) ? patch.bestTimeMs : game.bestTimeMs;
      }
    }

    game.lastPlayedAt = nowIso();
    user.adventure.lastPlayedId = gameId;

    touchUser(user);
    saveProfiles();
  }

  function clearGameRecord(gameId) {
    if (!gameId) return;
    const user = getActiveUser();
    if (!user) return;
    const game = ensureGameStats(user, gameId);
    if (!game) return;

    game.recordText = "";
    game.bestCorrect = null;
    game.bestTotal = null;
    game.bestTimeMs = null;
    game.scoreValue = null;
    game.scoreLabel = "";
    game.stars = 0;

    touchUser(user);
    saveProfiles();
  }

  function gameIdFromRecordKey(key) {
    if (RECORD_KEY_TO_GAME_ID[key]) return RECORD_KEY_TO_GAME_ID[key];

    const missionMatch = /^mathArcade_(sumMission|subMission|multMission)_best_L([1-3])$/.exec(key);
    if (!missionMatch) return "";

    const map = {
      sumMission: "sum_mission",
      subMission: "subtraction_mission",
      multMission: "multiplication_mission"
    };
    return map[missionMatch[1]] || "";
  }

  function patchFromStorageKey(key, value) {
    if (typeof key !== "string") return null;

    if (key.endsWith("_records_v1")) {
      return parseScoreboardRecord(value);
    }

    const missionMatch = /^mathArcade_(sumMission|subMission|multMission)_best_L([1-3])$/.exec(key);
    if (missionMatch) {
      return parseMissionLevelRecord(value, missionMatch[2]);
    }

    if (key === "division_remainders_best_v1") {
      return parseDivisionMissionRecord(value);
    }

    return null;
  }

  function recordGameLaunch(gameId) {
    if (!gameId) return;
    const user = getActiveUser();
    if (!user) return;
    const game = ensureGameStats(user, gameId);
    if (!game) return;

    game.plays += 1;
    game.lastPlayedAt = nowIso();

    user.adventure.totalLaunches = (user.adventure.totalLaunches || 0) + 1;
    user.adventure.lastPlayedId = gameId;

    touchUser(user);
    saveProfiles();
  }

  function recordMissionResult(result) {
    const gameId = getCurrentGameId();
    if (!gameId || !result || typeof result !== "object") return;

    const user = getActiveUser();
    if (!user) return;
    const game = ensureGameStats(user, gameId);
    if (!game) return;

    const correct = Number(result.correct);
    const total = Number(result.total);
    const timeMs = Number(result.timeMs);

    if (isMissionStarGame(gameId)) {
      const earnedStars = starsFromMission(correct, total);
      game.stars = Math.max(game.stars, earnedStars);
    }

    if (Number.isFinite(correct) && Number.isFinite(total)) {
      const betterByScore = (game.bestCorrect === null) || (correct > game.bestCorrect);
      const tiedScore = (game.bestCorrect !== null) && (correct === game.bestCorrect);
      const betterByTime = Number.isFinite(timeMs) && (game.bestTimeMs === null || timeMs < game.bestTimeMs);

      if (betterByScore || (tiedScore && betterByTime)) {
        game.bestCorrect = correct;
        game.bestTotal = total;
        if (Number.isFinite(timeMs)) game.bestTimeMs = timeMs;
      }
    }

    if (Number.isFinite(correct) && Number.isFinite(total)) {
      game.recordText = Number.isFinite(timeMs)
        ? `Best ${correct}/${total} in ${fmtDuration(timeMs)}`
        : `Best ${correct}/${total}`;

      if (game.scoreValue === null || correct > game.scoreValue) {
        game.scoreValue = correct;
        game.scoreLabel = `${correct}/${total}`;
      }
    }

    game.lastPlayedAt = nowIso();
    user.adventure.lastPlayedId = gameId;

    touchUser(user);
    saveProfiles();
  }

  function shouldScopeKey(key) {
    if (typeof key !== "string" || !key) return false;
    if (key === PROFILE_STORAGE_KEY) return false;
    if (key.startsWith("mathArcade_global_")) return false;
    if (key.startsWith(STORAGE_SCOPE_PREFIX)) return false;
    if (SCOPED_EXACT_KEYS.has(key)) return true;
    return SCOPED_KEY_PREFIXES.some((p) => key.startsWith(p));
  }

  function scopedStorageKey(key) {
    if (!shouldScopeKey(key)) return key;
    const active = getActiveUser();
    const id = active && active.id ? active.id : "";
    if (!id) return key;
    return `${STORAGE_SCOPE_PREFIX}${id}::${key}`;
  }

  function installUserScopedStorage() {
    initStorageNative();
    if (!storageNative || !("Storage" in window)) return;

    const proto = Storage.prototype;
    if (proto.__mathArcadeScopedV2) return;

    proto.getItem = function (key) {
      return storageNative.getItem.call(this, scopedStorageKey(key));
    };

    proto.setItem = function (key, value) {
      const scoped = scopedStorageKey(key);
      storageNative.setItem.call(this, scoped, value);

      const gameId = gameIdFromRecordKey(String(key));
      const patch = patchFromStorageKey(String(key), String(value));
      if (gameId && patch) {
        patchGameProgress(gameId, patch);
      }
    };

    proto.removeItem = function (key) {
      storageNative.removeItem.call(this, scopedStorageKey(key));
      const gameId = gameIdFromRecordKey(String(key));
      if (gameId) clearGameRecord(gameId);
    };

    Object.defineProperty(proto, "__mathArcadeScopedV2", {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false
    });
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getUsersSorted() {
    const state = loadProfiles();
    return Object.values(state.users)
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  }

  function listOrderedGameIds(games) {
    const all = games.map((g) => g.id);
    const order = [];

    KNOWN_GAME_ORDER.forEach((id) => {
      if (all.includes(id)) order.push(id);
    });

    all.forEach((id) => {
      if (!order.includes(id)) order.push(id);
    });

    return order;
  }

  function getUserGameState(user, gameId) {
    const games = user && user.adventure && user.adventure.games;
    if (!games || !games[gameId]) {
      return {
        plays: 0,
        stars: 0,
        bestCorrect: null,
        bestTotal: null,
        bestTimeMs: null,
        recordText: "",
        scoreValue: null,
        scoreLabel: ""
      };
    }
    return games[gameId];
  }

  function countUserStats(user, gameIds) {
    if (!user) {
      return {
        explored: 0,
        stars: 0,
        totalGames: gameIds.length,
        maxStars: MISSION_STAR_GAME_IDS.size * 3,
        completionPct: 0,
        totalScore: 0,
        scoredGames: 0
      };
    }

    let explored = 0;
    let stars = 0;
    let totalScore = 0;
    let scoredGames = 0;
    let starGames = 0;

    gameIds.forEach((id) => {
      const g = getUserGameState(user, id);
      if (g.plays > 0) explored += 1;
      if (isMissionStarGame(id)) {
        starGames += 1;
        stars += Number.isFinite(g.stars) ? g.stars : 0;
      }
      if (Number.isFinite(g.scoreValue)) {
        totalScore += g.scoreValue;
        scoredGames += 1;
      }
    });

    const totalGames = gameIds.length;
    const maxStars = starGames * 3;
    const pct = totalGames ? Math.round((explored / totalGames) * 100) : 0;

    return {
      explored,
      stars,
      totalGames,
      maxStars,
      completionPct: pct,
      totalScore,
      scoredGames
    };
  }

  function renderStars(n) {
    const clamped = Math.max(0, Math.min(3, Number.isFinite(n) ? Math.floor(n) : 0));
    return "★".repeat(clamped) + "☆".repeat(3 - clamped);
  }

  function gameRecordLine(gameState) {
    if (!gameState) return "Not started";
    if (typeof gameState.recordText === "string" && gameState.recordText.trim()) {
      return gameState.recordText.trim();
    }
    if (Number.isFinite(gameState.bestCorrect) && Number.isFinite(gameState.bestTotal)) {
      if (Number.isFinite(gameState.bestTimeMs)) {
        return `Best ${gameState.bestCorrect}/${gameState.bestTotal} in ${fmtDuration(gameState.bestTimeMs)}`;
      }
      return `Best ${gameState.bestCorrect}/${gameState.bestTotal}`;
    }
    if (gameState.plays > 0) {
      return `Played ${gameState.plays} time${gameState.plays === 1 ? "" : "s"}`;
    }
    return "Not started";
  }

  function gameScoreLine(gameState) {
    if (!gameState) return "—";
    if (typeof gameState.scoreLabel === "string" && gameState.scoreLabel.trim()) {
      return gameState.scoreLabel.trim();
    }
    if (Number.isFinite(gameState.scoreValue)) {
      return String(gameState.scoreValue);
    }
    return "—";
  }

  function setupTileLaunchAnimation(host) {
    const runner = host.querySelector("#trackAvatar");

    host.querySelectorAll("a.arcade-tile").forEach((tile) => {
      tile.addEventListener("click", (ev) => {
        if (ev.defaultPrevented) return;
        if (ev.button !== 0) return;
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

        const href = tile.getAttribute("href");
        if (!href) return;

        ev.preventDefault();

        const icon = tile.querySelector(".tile-icon") || tile;
        const from = (runner || host.querySelector(".arcade-adventure-title")).getBoundingClientRect();
        const to = icon.getBoundingClientRect();

        const bubble = document.createElement("div");
        bubble.className = "arcade-launch-avatar";
        bubble.textContent = runner ? runner.textContent : "🚀";

        const startX = from.left + from.width / 2;
        const startY = from.top + from.height / 2;
        const dx = (to.left + to.width / 2) - startX;
        const dy = (to.top + to.height / 2) - startY;

        bubble.style.left = `${startX}px`;
        bubble.style.top = `${startY}px`;
        document.body.appendChild(bubble);

        requestAnimationFrame(() => {
          bubble.style.transform = `translate(${dx}px, ${dy}px) scale(0.82)`;
          bubble.style.opacity = "0";
        });

        window.setTimeout(() => {
          bubble.remove();
          window.location.href = href;
        }, 420);
      });
    });
  }

  function bindHomeControls(host, games) {
    const modal = host.querySelector("#recordModal");
    const openRecordBtn = host.querySelector("#openPlayerRecord");
    const closeRecordBtn = host.querySelector("#closeRecordModal");

    const profileModal = host.querySelector("#profileModal");
    const profileTitle = host.querySelector("#profileModalTitle");
    const profileNameInput = host.querySelector("#profileNameInput");
    const saveProfileBtn = host.querySelector("#saveProfileBtn");
    const cancelProfileBtn = host.querySelector("#cancelProfileBtn");
    const closeProfileBtn = host.querySelector("#closeProfileModal");
    const newPlayerBtn = host.querySelector("#newPlayerBtn");
    const editPlayerBtn = host.querySelector("#editPlayerBtn");

    let selectedAvatar = (getActiveUser() && getActiveUser().avatar) ? getActiveUser().avatar : AVATAR_OPTIONS[0];

    function refreshProfileAvatarSelection() {
      host.querySelectorAll("button[data-profile-avatar]").forEach((btn) => {
        const avatar = btn.getAttribute("data-profile-avatar");
        if (avatar === selectedAvatar) btn.classList.add("is-active");
        else btn.classList.remove("is-active");
      });
    }

    function openProfileModal(mode) {
      if (!profileModal || !profileNameInput || !profileTitle) return;
      const active = getActiveUser();

      if (mode === "new") {
        profileTitle.textContent = "Create New Player";
        profileNameInput.value = "";
        selectedAvatar = AVATAR_OPTIONS[0];
      } else {
        if (!active) {
          profileTitle.textContent = "Create New Player";
          profileNameInput.value = "";
          selectedAvatar = AVATAR_OPTIONS[0];
        } else {
          profileTitle.textContent = `Edit ${active.name}`;
          profileNameInput.value = active.name;
          selectedAvatar = active.avatar;
        }
      }

      refreshProfileAvatarSelection();
      profileModal.removeAttribute("hidden");
      window.setTimeout(() => profileNameInput.focus(), 0);
    }

    function closeProfileModal() {
      if (!profileModal) return;
      profileModal.setAttribute("hidden", "");
    }

    function saveProfile() {
      if (!profileNameInput) return;
      let name = profileNameInput.value.trim();
      if (!name) {
        name = `Player ${getUsersSorted().length + 1}`;
      }
      switchOrCreateUserByName(name);
      setActiveAvatar(selectedAvatar);
      closeProfileModal();
      renderHome();
    }

    host.querySelectorAll("button[data-user-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-user-id");
        if (!id) return;
        switchUserById(id);
        renderHome();
      });
    });

    host.querySelectorAll("button[data-profile-avatar]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const avatar = btn.getAttribute("data-profile-avatar");
        if (!avatar) return;
        selectedAvatar = avatar;
        refreshProfileAvatarSelection();
      });
    });

    if (newPlayerBtn) {
      newPlayerBtn.addEventListener("click", () => openProfileModal("new"));
    }

    if (editPlayerBtn) {
      editPlayerBtn.addEventListener("click", () => openProfileModal("edit"));
    }

    if (saveProfileBtn) {
      saveProfileBtn.addEventListener("click", saveProfile);
    }

    if (cancelProfileBtn) {
      cancelProfileBtn.addEventListener("click", closeProfileModal);
    }

    if (closeProfileBtn) {
      closeProfileBtn.addEventListener("click", closeProfileModal);
    }

    if (profileNameInput) {
      profileNameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          saveProfile();
        }
      });
    }

    if (profileModal) {
      profileModal.addEventListener("click", (e) => {
        if (e.target === profileModal) closeProfileModal();
      });
    }

    function closeRecord() {
      if (!modal) return;
      modal.setAttribute("hidden", "");
    }

    if (openRecordBtn && modal) {
      openRecordBtn.addEventListener("click", () => {
        modal.removeAttribute("hidden");
      });
    }

    if (closeRecordBtn) {
      closeRecordBtn.addEventListener("click", closeRecord);
    }

    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeRecord();
      });
    }

    setupTileLaunchAnimation(host);

    const trackNodes = host.querySelectorAll(".arcade-track-node");
    if (trackNodes.length) {
      const active = getActiveUser();
      const gameOrder = listOrderedGameIds(games);
      const idx = Math.max(0, gameOrder.indexOf(active.adventure.lastPlayedId));
      const node = trackNodes[idx] || trackNodes[0];
      if (node) node.classList.add("is-current");
    }
  }

  function inGamesFolder() {
    // Works for GitHub Pages and local hosting
    const path = window.location.pathname;
    return path.includes("/games/");
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    const swPath = inGamesFolder() ? "../sw.js" : "./sw.js";
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(swPath).catch(() => {
        // Silent: offline will still work after a good install.
      });
    });
  }

  function injectGameHeader() {
    const body = document.body;
    if (!body || body.dataset.arcadePage !== "game") return;

    const backHref = inGamesFolder() ? "../index.html" : "index.html";
    const active = getActiveUser();
    const label = active ? `${active.avatar} ${active.name}` : "No player";

    const header = document.createElement("header");
    header.className = "arcade-header";
    header.innerHTML = `
      <a class="arcade-back" href="${backHref}">← Arcade</a>
      <div class="arcade-title">Math Arcade</div>
      <div class="arcade-spacer"></div>
      <div class="arcade-small">${escapeHtml(label)}</div>
    `;
    body.insertBefore(header, body.firstChild);
  }

  function renderHome() {
    const host = document.getElementById("arcadeHome");
    if (!host || typeof MATH_ARCADE_GAMES === "undefined") return;

    const games = [...MATH_ARCADE_GAMES];
    const byId = new Map(games.map((g) => [g.id, g]));

    const active = getActiveUser();
    const users = getUsersSorted();
    const gameIds = listOrderedGameIds(games);
    const stats = countUserStats(active, gameIds);

    if (!active) {
      const profileAvatarButtons = AVATAR_OPTIONS
        .map((a, idx) => {
          const cls = idx === 0 ? "arcade-avatar-btn is-active" : "arcade-avatar-btn";
          return `<button class="${cls}" type="button" data-profile-avatar="${escapeHtml(a)}" aria-label="Choose avatar ${escapeHtml(a)}">${escapeHtml(a)}</button>`;
        })
        .join("");

      host.innerHTML = `
        <section class="arcade-adventure-card" aria-label="Adventure HQ">
          <div class="arcade-adventure-head">
            <div>
              <h2 class="arcade-adventure-title">Adventure HQ</h2>
              <div class="arcade-adventure-sub">No players yet. Create your player to begin.</div>
            </div>
            <div class="arcade-summary-badge">0% explored</div>
          </div>

          <div class="arcade-players-head">
            <div class="arcade-players-title">Players</div>
            <div class="arcade-players-actions">
              <button class="arcade-btn primary" id="newPlayerBtn" type="button">Create First Player</button>
            </div>
          </div>

          <div class="arcade-summary-grid">
            <div class="arcade-summary-item"><div class="k">Explorer</div><div class="v">Not set</div></div>
            <div class="arcade-summary-item"><div class="k">Games Played</div><div class="v">0/${stats.totalGames}</div></div>
            <div class="arcade-summary-item"><div class="k">Mission Stars</div><div class="v">0/${stats.maxStars}</div></div>
            <div class="arcade-summary-item"><div class="k">Score</div><div class="v">0 (0)</div></div>
          </div>
        </section>

        <div class="arcade-profile-modal" id="profileModal" hidden>
          <div class="arcade-profile-dialog">
            <button class="arcade-record-close" id="closeProfileModal" type="button" aria-label="Close profile editor">✕</button>
            <h3 class="arcade-profile-title" id="profileModalTitle">Create New Player</h3>
            <label class="arcade-profile-label" for="profileNameInput">Player Name</label>
            <input class="arcade-profile-input" id="profileNameInput" maxlength="${MAX_PLAYER_NAME}" autocomplete="off" />
            <div class="arcade-profile-avatar-grid" aria-label="Avatar choices">
              ${profileAvatarButtons}
            </div>
            <div class="arcade-profile-actions">
              <button class="arcade-btn primary" id="saveProfileBtn" type="button">Save Player</button>
            </div>
          </div>
        </div>
      `;

      bindHomeControls(host, games);
      return;
    }

    const userChips = users
      .map((u) => {
        const cls = u.id === active.id ? "arcade-user-chip is-active" : "arcade-user-chip";
        return `<button class="${cls}" type="button" data-user-id="${escapeHtml(u.id)}">${escapeHtml(u.name)}</button>`;
      })
      .join("");

    const profileAvatarButtons = AVATAR_OPTIONS
      .map((a) => {
        const cls = a === active.avatar ? "arcade-avatar-btn is-active" : "arcade-avatar-btn";
        return `<button class="${cls}" type="button" data-profile-avatar="${escapeHtml(a)}" aria-label="Choose avatar ${escapeHtml(a)}">${escapeHtml(a)}</button>`;
      })
      .join("");

    const trackNodes = gameIds
      .map((id) => {
        const g = getUserGameState(active, id);
        const stateCls = g.plays > 0 ? "arcade-track-node is-done" : "arcade-track-node";
        const label = byId.get(id) ? byId.get(id).title : id;
        return `<div class="${stateCls}" title="${escapeHtml(label)}"></div>`;
      })
      .join("");

    const recordRows = gameIds
      .map((id) => {
        const meta = byId.get(id);
        const title = meta ? meta.title : id;
        const g = getUserGameState(active, id);
        const stars = isMissionStarGame(id) ? g.stars : 0;
        const starsLabel = isMissionStarGame(id) ? renderStars(stars) : "No stars";
        const starsClass = isMissionStarGame(id) ? "arcade-record-stars" : "arcade-record-stars arcade-record-stars-muted";
        const score = gameScoreLine(g);
        const record = gameRecordLine(g);
        return `
          <div class="arcade-record-row">
            <div class="arcade-record-row-head">
              <div class="arcade-record-title">${escapeHtml(title)}</div>
              <div class="arcade-record-metrics">
                <div class="${starsClass}">${starsLabel}</div>
                <div class="arcade-record-score">Score ${escapeHtml(score)}</div>
              </div>
            </div>
            <div class="arcade-record-meta">Plays: ${g.plays}</div>
            <div class="arcade-record-best">${escapeHtml(record)}</div>
          </div>
        `;
      })
      .join("");

    host.innerHTML = `
      <section class="arcade-adventure-card" aria-label="Adventure HQ">
        <div class="arcade-adventure-head">
          <div>
            <h2 class="arcade-adventure-title">Adventure HQ</h2>
            <div class="arcade-adventure-sub">Pick an existing player. Create a new one only when needed.</div>
          </div>
          <div class="arcade-summary-badge">${stats.completionPct}% explored</div>
        </div>

        <div class="arcade-players-head">
          <div class="arcade-players-title">Players</div>
          <div class="arcade-players-actions">
            <button class="arcade-btn" id="editPlayerBtn" type="button">Edit Active</button>
            <button class="arcade-btn primary" id="newPlayerBtn" type="button">+ New Player</button>
          </div>
        </div>

        <div class="arcade-user-chip-row" aria-label="Players">
          ${userChips}
        </div>

        <div class="arcade-summary-grid">
          <div class="arcade-summary-item"><div class="k">Explorer</div><div class="v">${escapeHtml(active.name)}</div></div>
          <div class="arcade-summary-item"><div class="k">Games Played</div><div class="v">${stats.explored}/${stats.totalGames}</div></div>
          <div class="arcade-summary-item"><div class="k">Mission Stars</div><div class="v">${stats.stars}/${stats.maxStars}</div></div>
          <div class="arcade-summary-item"><div class="k">Score</div><div class="v">${stats.totalScore} (${stats.scoredGames})</div></div>
        </div>

        <div class="arcade-progress" aria-label="Adventure progress">
          <div class="arcade-progress-fill" style="width:${stats.completionPct}%"></div>
        </div>

        <div class="arcade-track" aria-label="Adventure track">
          <button class="arcade-track-avatar-wrap" id="openPlayerRecord" type="button" aria-label="Open ${escapeHtml(active.name)} record">
            <div class="arcade-track-avatar-name">${escapeHtml(active.name)}</div>
            <div class="arcade-track-avatar" id="trackAvatar">${escapeHtml(active.avatar)}</div>
          </button>
          ${trackNodes}
        </div>
      </section>

      <section class="arcade-sect" aria-label="Addition">
        <h2>Addition</h2>
        <div class="arcade-grid" id="gridAddition"></div>
      </section>

      <section class="arcade-sect" aria-label="Subtraction">
        <h2>Subtraction</h2>
        <div class="arcade-grid" id="gridSubtraction"></div>
      </section>

      <section class="arcade-sect" aria-label="Multiplication">
        <h2>Multiplication</h2>
        <div class="arcade-grid" id="gridMultiplication"></div>
      </section>

      <section class="arcade-sect" aria-label="Division">
        <h2>Division</h2>
        <div class="arcade-grid" id="gridDivision"></div>
      </section>

      <section class="arcade-sect" aria-label="Quick Number Games">
        <h2>Quick Number Games</h2>
        <div class="arcade-grid" id="gridQuick"></div>
      </section>

      <section class="arcade-sect" aria-label="Parents">
        <h2>Parents</h2>
        <a class="arcade-btn" href="settings.html">⚙️ Manage Progress</a>
      </section>

      <div class="arcade-record-modal" id="recordModal" hidden>
        <div class="arcade-record-dialog">
          <button class="arcade-record-close" id="closeRecordModal" type="button" aria-label="Close record">✕</button>
          <div class="arcade-record-header">
            <div class="arcade-record-avatar">${escapeHtml(active.avatar)}</div>
            <div>
              <div class="arcade-record-name">${escapeHtml(active.name)}</div>
              <div class="arcade-record-subtitle">Adventure Record Book</div>
            </div>
          </div>
          <div class="arcade-record-summary">
            <div class="arcade-record-pill">Games ${stats.explored}/${stats.totalGames}</div>
            <div class="arcade-record-pill">Mission Stars ${stats.stars}/${stats.maxStars}</div>
            <div class="arcade-record-pill">Score ${stats.totalScore}</div>
            <div class="arcade-record-pill">Launches ${active.adventure.totalLaunches || 0}</div>
          </div>
          <div class="arcade-record-list">
            ${recordRows}
          </div>
        </div>
      </div>

      <div class="arcade-profile-modal" id="profileModal" hidden>
        <div class="arcade-profile-dialog">
          <button class="arcade-record-close" id="closeProfileModal" type="button" aria-label="Close profile editor">✕</button>
          <h3 class="arcade-profile-title" id="profileModalTitle">Edit Player</h3>
          <label class="arcade-profile-label" for="profileNameInput">Player Name</label>
          <input class="arcade-profile-input" id="profileNameInput" maxlength="${MAX_PLAYER_NAME}" autocomplete="off" />
          <div class="arcade-profile-avatar-grid" aria-label="Avatar choices">
            ${profileAvatarButtons}
          </div>
          <div class="arcade-profile-actions">
            <button class="arcade-btn" id="cancelProfileBtn" type="button">Cancel</button>
            <button class="arcade-btn primary" id="saveProfileBtn" type="button">Save Player</button>
          </div>
        </div>
      </div>
    `;

    function tileHtml(g) {
      const s = getUserGameState(active, g.id);
      const played = s.plays > 0;
      const stars = isMissionStarGame(g.id) ? s.stars : 0;
      const starsLabel = isMissionStarGame(g.id) ? renderStars(stars) : "No stars";
      const starsClass = isMissionStarGame(g.id) ? "tile-stars" : "tile-stars tile-stars-muted";
      const mastered = stars >= 3;
      const score = gameScoreLine(s);

      const classes = ["arcade-tile"];
      if (played) classes.push("is-played");
      if (mastered) classes.push("is-mastered");

      const progressText = played
        ? `Played ${s.plays} time${s.plays === 1 ? "" : "s"}`
        : "New mission";

      return `
        <a class="${classes.join(" ")}" href="${g.href}" data-kind="${g.kind}" data-game-id="${g.id}">
          <div class="arcade-badge" aria-hidden="true">${g.badge || ""}</div>
          <div class="tile-icon" aria-hidden="true">${g.icon || "🎲"}</div>
          <div class="tile-name">${g.title}</div>
          <div class="tile-desc">${g.desc || ""}</div>
          <div class="tile-performance">
            <div class="${starsClass}">${starsLabel}</div>
            <div class="tile-score">Score ${escapeHtml(score)}</div>
          </div>
          <div class="tile-progress">${progressText}</div>
        </a>
      `;
    }

    function fill(gridId, ids) {
      const grid = document.getElementById(gridId);
      if (!grid) return;

      grid.innerHTML = ids
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map(tileHtml)
        .join("");
    }

    fill("gridAddition", ["visual_sum", "sum_master", "sum_mission", "addition_defense"]);
    fill("gridSubtraction", ["subtraction_master", "subtraction_mission", "subtraction_defense"]);
    fill("gridMultiplication", ["atomic_multiplication", "multiplication_mission", "multiplication_defense"]);
    fill("gridDivision", ["division_factory", "division_dismantle", "atomic_division", "division_mission", "division_defense"]);
    fill("gridQuick", ["predecessor_choice", "even_odd"]);

    bindHomeControls(host, games);
  }

  function resetActiveUserProgress() {
    const user = getActiveUser();
    if (!user || !user.id) return 0;
    const id = user.id;
    const scopePrefix = `${STORAGE_SCOPE_PREFIX}${id}::`;

    const legacyPrefixes = [
      "mathArcade_",
      "addDef_",
      "subDef_",
      "multDef_",
      "divDef_",
      "evenOdd_",
      "predChoice_",
      "division_"
    ];

    const keys = [];
    if ("localStorage" in window) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = storageNative.key.call(localStorage, i);
        if (!k) continue;
        if (k === PROFILE_STORAGE_KEY || k.startsWith("mathArcade_global_")) continue;

        if (k.startsWith(scopePrefix)) {
          keys.push(k);
          continue;
        }

        if (legacyPrefixes.some((p) => k.startsWith(p))) {
          keys.push(k);
        }
      }
    }

    keys.forEach((k) => safeNativeRemove(k));

    user.adventure = {
      totalLaunches: 0,
      lastPlayedId: "",
      games: {}
    };
    touchUser(user);
    saveProfiles();

    return keys.length;
  }

  function setupParentalGate() {
    const qEl = document.getElementById("gateQuestion");
    const ansEl = document.getElementById("gateAnswer");
    const unlockBtn = document.getElementById("gateUnlock");
    const resetBtn = document.getElementById("resetProgress");
    const msgEl = document.getElementById("gateMsg");
    const playerListEl = document.getElementById("playerList");

    if (!qEl || !ansEl || !unlockBtn || !resetBtn) return;
    let unlocked = false;

    const active = getActiveUser();
    const activeNameEl = document.getElementById("activePlayerName");
    if (activeNameEl) {
      activeNameEl.textContent = active ? `${active.avatar} ${active.name}` : "None";
    }

    // Simple local gate: random arithmetic (no external services)
    const a = 3 + Math.floor(Math.random() * 7);  // 3..9
    const b = 2 + Math.floor(Math.random() * 7);  // 2..8
    const correct = a + b;

    qEl.textContent = `To unlock, answer: ${a} + ${b} = ?`;

    function setMsg(txt) {
      msgEl.textContent = txt || "";
    }

    function renderPlayerManager() {
      if (!playerListEl) return;
      const users = getUsersSorted();
      const activeNow = getActiveUser();
      const activeId = activeNow ? activeNow.id : "";

      if (!users.length) {
        playerListEl.innerHTML = `<div class="note">No players found.</div>`;
        return;
      }

      playerListEl.innerHTML = users.map((u) => {
        const activeTag = u.id === activeId ? " (active)" : "";
        const disabled = (!unlocked) ? "disabled" : "";
        return `
          <div class="arcade-user-chip${u.id === activeId ? " is-active" : ""}" style="display:flex;align-items:center;gap:8px;">
            <span>${escapeHtml(u.avatar)} ${escapeHtml(u.name)}${activeTag}</span>
            <button class="arcade-btn" type="button" data-delete-user="${escapeHtml(u.id)}" ${disabled} style="height:36px;padding:0 10px;font-size:13px;">Delete</button>
          </div>
        `;
      }).join("");

      playerListEl.querySelectorAll("button[data-delete-user]").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (!unlocked) return;
          const id = btn.getAttribute("data-delete-user");
          if (!id) return;
          const name = (loadProfiles().users[id] && loadProfiles().users[id].name) ? loadProfiles().users[id].name : "this player";
          const ok = window.confirm(`Delete player ${name}? This removes that player's saved progress on this device.`);
          if (!ok) return;

          const res = deleteUserById(id);
          if (!res.ok) {
            setMsg("Could not delete that player.");
            return;
          }

          const current = getActiveUser();
          const activeText = current ? `Active player is now ${current.name}.` : "No active player.";
          setMsg(`Deleted player. ${activeText} Removed ${res.removedKeys} saved item${res.removedKeys === 1 ? "" : "s"}.`);
          renderPlayerManager();
          const activeNameAgain = document.getElementById("activePlayerName");
          if (activeNameAgain) activeNameAgain.textContent = current ? `${current.avatar} ${current.name}` : "None";
        });
      });
    }

    unlockBtn.addEventListener("click", () => {
      const v = parseInt(ansEl.value.trim(), 10);
      if (!Number.isFinite(v)) { setMsg("Type a number."); return; }
      if (v === correct) {
        unlocked = true;
        resetBtn.disabled = false;
        setMsg("Unlocked.");
        renderPlayerManager();
      } else {
        setMsg("Not correct.");
      }
    });

    resetBtn.addEventListener("click", () => {
      const removed = resetActiveUserProgress();
      const current = getActiveUser();
      if (!current) {
        setMsg("No active player to reset.");
      } else {
        setMsg(`Progress reset for ${current.name} (${removed} item${removed === 1 ? "" : "s"}).`);
      }
      resetBtn.disabled = true;
      ansEl.value = "";
      unlocked = false;
      renderPlayerManager();
    });

    renderPlayerManager();
  }

  function publishProgressApi() {
    window.MathArcadeProgress = {
      getActiveUserName: () => {
        const u = getActiveUser();
        return u ? u.name : "";
      },
      setActiveUserName: (name) => switchOrCreateUserByName(name).name,
      getActiveAvatar: () => {
        const u = getActiveUser();
        return u ? u.avatar : "";
      },
      setActiveAvatar: setActiveAvatar,
      recordMissionResult: recordMissionResult,
      recordGameLaunch: recordGameLaunch
    };
  }

  function trackCurrentGameLaunch() {
    const body = document.body;
    if (!body || body.dataset.arcadePage !== "game") return;
    if (!getActiveUser()) return;
    const gameId = getCurrentGameId();
    if (!gameId) return;
    recordGameLaunch(gameId);
  }

  // Init
  loadProfiles();
  installUserScopedStorage();
  publishProgressApi();
  registerServiceWorker();
  injectGameHeader();
  renderHome();
  setupParentalGate();
  trackCurrentGameLaunch();

})();
