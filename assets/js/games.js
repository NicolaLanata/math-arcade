// Math Arcade game registry
// Keep this file simple: used by index.html and the service worker.

const MATH_ARCADE_GAMES = [
  // Tricks & Practice
  {
    id: "visual_sum",
    title: "Visual Sum",
    href: "games/visual_sum.html",
    icon: "🧩",
    badge: "📘",
    kind: "practice",
    order: 1,
    desc: "Build sums visually."
  },
  {
    id: "sum_master",
    title: "Sum Master",
    href: "games/sum_master.html",
    icon: "➕",
    badge: "📘",
    kind: "practice",
    order: 2,
    desc: "Add with place-value steps."
  },
  {
    id: "subtraction_master",
    title: "Subtraction Master",
    href: "games/subtraction_master.html",
    icon: "➖",
    badge: "📘",
    kind: "practice",
    order: 3,
    desc: "Subtraction strategies."
  },
  {
    id: "division_factory",
    title: "Division Factory",
    href: "games/division_factory.html",
    icon: "🏭",
    badge: "📘",
    kind: "practice",
    order: 4,
    desc: "Division as grouping."
  },
  {
    id: "atomic_multiplication",
    title: "Atomic Multiplication",
    href: "games/atomic_multiplication.html",
    icon: "⚛️",
    badge: "📘",
    kind: "practice",
    order: 5,
    desc: "Build products from pieces."
  },
  {
    id: "atomic_division",
    title: "Atomic Division",
    href: "games/atomic_division.html",
    icon: "🧪",
    badge: "📘",
    kind: "practice",
    order: 6,
    desc: "Break down division."
  },

  // Arcade Games
  {
    id: "predecessor_choice",
    title: "Predecessor Choice",
    href: "games/predecessor_choice.html",
    icon: "🔎",
    badge: "🎮",
    kind: "game",
    order: 100,
    desc: "Choose the number just before."
  },
  {
    id: "even_odd",
    title: "Even or Odd",
    href: "games/even_odd.html",
    icon: "⚡",
    badge: "🎮",
    kind: "game",
    order: 101,
    desc: "Fast parity decisions."
  },
  {
    id: "addition_defense",
    title: "Addition Defense",
    href: "games/addition_defense.html",
    icon: "🛡️",
    badge: "🎮",
    kind: "game",
    order: 110,
    desc: "Stop the robots with sums."
  },
  {
    id: "sum_mission",
    title: "Sum Mission",
    href: "games/sum_mission.html",
    icon: "🎯➕",
    badge: "⏱️",
    kind: "game",
    order: 111,
    desc: "5 timed sums. Beat your best."
  },
  {
    id: "subtraction_defense",
    title: "Subtraction Defense",
    href: "games/subtraction_defense.html",
    icon: "🛡️",
    badge: "🎮",
    kind: "game",
    order: 112,
    desc: "Stop the robots with differences."
  },
  {
    id: "subtraction_mission",
    title: "Subtraction Mission",
    href: "games/subtraction_mission.html",
    icon: "🎯➖",
    badge: "⏱️",
    kind: "game",
    order: 113,
    desc: "5 timed differences. Beat your best."
  },
  {
    id: "multiplication_defense",
    title: "Multiplication Defense",
    href: "games/multiplication_defense.html",
    icon: "🛡️",
    badge: "🎮",
    kind: "game",
    order: 114,
    desc: "Stop the robots with products."
  },
  {
    id: "division_defense",
    title: "Division Defense",
    href: "games/division_defense.html",
    icon: "🛡️",
    badge: "🎮",
    kind: "game",
    order: 115,
    desc: "Stop the robots with quotients."
  }
];
