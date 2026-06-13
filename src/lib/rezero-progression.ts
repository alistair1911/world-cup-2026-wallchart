export type ReZeroBadge = {
  level: number;
  minPoints: number;
  title: string;
  subtitle: string;
  accent: string;
};

export type ReZeroExactBadge = {
  tier: number;
  minExact: number;
  title: string;
  subtitle: string;
  accent: string;
};

export const REZERO_BADGES: ReZeroBadge[] = [
  {
    level: 1,
    minPoints: 0,
    title: "Appa Stand Rookie",
    subtitle: "The prediction journey begins in Lugunica.",
    accent: "from-slate-200 to-white"
  },
  {
    level: 2,
    minPoints: 10,
    title: "Emilia Camp Hope",
    subtitle: "First checkpoint cleared with silver-haired confidence.",
    accent: "from-violet-100 to-white"
  },
  {
    level: 3,
    minPoints: 20,
    title: "Puck's Lucky Charm",
    subtitle: "Tiny spirit energy for close score calls.",
    accent: "from-sky-100 to-white"
  },
  {
    level: 4,
    minPoints: 30,
    title: "Rem's Resolve",
    subtitle: "Locked in, loyal, and dangerous on exact scores.",
    accent: "from-blue-100 to-white"
  },
  {
    level: 5,
    minPoints: 40,
    title: "Ram's Sharp Read",
    subtitle: "Prediction instincts with zero hesitation.",
    accent: "from-rose-100 to-white"
  },
  {
    level: 6,
    minPoints: 50,
    title: "Beatrice Library Key",
    subtitle: "Unlocked forbidden knowledge of group-stage chaos.",
    accent: "from-amber-100 to-white"
  },
  {
    level: 7,
    minPoints: 60,
    title: "Sanctuary Trial",
    subtitle: "A checkpoint for brave picks under pressure.",
    accent: "from-emerald-100 to-white"
  },
  {
    level: 8,
    minPoints: 70,
    title: "Roswaal's Master Plan",
    subtitle: "The bracket starts to look suspiciously intentional.",
    accent: "from-fuchsia-100 to-white"
  },
  {
    level: 9,
    minPoints: 80,
    title: "Royal Selection Candidate",
    subtitle: "Leaderboard royalty is now within reach.",
    accent: "from-yellow-100 to-white"
  },
  {
    level: 10,
    minPoints: 90,
    title: "Knight of Lugunica",
    subtitle: "Elite protection against bad prediction luck.",
    accent: "from-indigo-100 to-white"
  },
  {
    level: 11,
    minPoints: 100,
    title: "Return by Prediction",
    subtitle: "Final-form checkpoint for World Cup prophecy.",
    accent: "from-red-100 to-white"
  }
];

export const REZERO_EXACT_BADGES: ReZeroExactBadge[] = [
  {
    tier: 1,
    minExact: 1,
    title: "Perfect Loop",
    subtitle: "One exact score. Subaru would absolutely remember this timeline.",
    accent: "from-red-50 to-white"
  },
  {
    tier: 2,
    minExact: 3,
    title: "Rem's Blue Ribbon",
    subtitle: "Three exact scores means the prediction heart is fully awake.",
    accent: "from-blue-50 to-white"
  },
  {
    tier: 3,
    minExact: 5,
    title: "Beatrice's Forbidden Page",
    subtitle: "Five perfect calls unlock some suspiciously precise knowledge.",
    accent: "from-amber-50 to-white"
  },
  {
    tier: 4,
    minExact: 8,
    title: "Sanctuary Perfect Trial",
    subtitle: "Eight exact scores. No fear, only clean scorelines.",
    accent: "from-emerald-50 to-white"
  },
  {
    tier: 5,
    minExact: 12,
    title: "Witch Factor of Accuracy",
    subtitle: "Twelve exact scores is officially prediction magic.",
    accent: "from-violet-50 to-white"
  }
];

export function getReZeroProgress(points: number) {
  const earned = REZERO_BADGES.filter((badge) => points >= badge.minPoints);
  const current = earned[earned.length - 1] ?? REZERO_BADGES[0];
  const next = REZERO_BADGES.find((badge) => badge.minPoints > points) ?? null;
  const previousMin = current.minPoints;
  const nextMin = next?.minPoints ?? Math.max(points, current.minPoints + 10);
  const progress = next
    ? Math.min(100, Math.max(0, ((points - previousMin) / Math.max(1, nextMin - previousMin)) * 100))
    : 100;

  return {
    current,
    earned,
    next,
    pointsToNext: next ? Math.max(0, next.minPoints - points) : 0,
    progress
  };
}

export function getReZeroExactProgress(exact: number) {
  const earned = REZERO_EXACT_BADGES.filter((badge) => exact >= badge.minExact);
  const current = earned[earned.length - 1] ?? null;
  const next = REZERO_EXACT_BADGES.find((badge) => badge.minExact > exact) ?? null;
  const previousMin = current?.minExact ?? 0;
  const nextMin = next?.minExact ?? Math.max(exact, previousMin + 1);
  const progress = next
    ? Math.min(100, Math.max(0, ((exact - previousMin) / Math.max(1, nextMin - previousMin)) * 100))
    : 100;

  return {
    current,
    earned,
    next,
    exactToNext: next ? Math.max(0, next.minExact - exact) : 0,
    progress
  };
}

export function getReZeroAvatarTheme(userKey: string, level: number) {
  const isLucas = userKey === "lucas";
  const stage = Math.min(5, Math.max(1, Math.ceil(level / 2)));

  const tataStages = [
    {
      title: "Tata Rookie",
      gradient: "from-amber-200 via-white to-slate-100",
      hair: "#2f241f",
      outfit: "#b91c1c",
      charm: "Appa"
    },
    {
      title: "Tata Emilia Camp",
      gradient: "from-violet-200 via-white to-sky-100",
      hair: "#3b2a22",
      outfit: "#7c3aed",
      charm: "Hope"
    },
    {
      title: "Tata Rem Resolve",
      gradient: "from-blue-200 via-white to-cyan-100",
      hair: "#2b211d",
      outfit: "#2563eb",
      charm: "Exact"
    },
    {
      title: "Tata Library Keeper",
      gradient: "from-amber-200 via-white to-fuchsia-100",
      hair: "#261c18",
      outfit: "#92400e",
      charm: "Book"
    },
    {
      title: "Tata Royal Knight",
      gradient: "from-red-200 via-white to-yellow-100",
      hair: "#201716",
      outfit: "#991b1b",
      charm: "Crown"
    }
  ];

  const lucasStages = [
    {
      title: "Lucas Rookie",
      gradient: "from-sky-200 via-white to-slate-100",
      hair: "#1f2937",
      outfit: "#0f766e",
      charm: "Appa"
    },
    {
      title: "Lucas Spirit Friend",
      gradient: "from-cyan-200 via-white to-violet-100",
      hair: "#111827",
      outfit: "#0891b2",
      charm: "Puck"
    },
    {
      title: "Lucas Blue Ribbon",
      gradient: "from-blue-200 via-white to-indigo-100",
      hair: "#111827",
      outfit: "#1d4ed8",
      charm: "Rem"
    },
    {
      title: "Lucas Trial Breaker",
      gradient: "from-emerald-200 via-white to-blue-100",
      hair: "#0f172a",
      outfit: "#047857",
      charm: "Trial"
    },
    {
      title: "Lucas Return Hero",
      gradient: "from-violet-200 via-white to-red-100",
      hair: "#020617",
      outfit: "#6d28d9",
      charm: "Loop"
    }
  ];

  return (isLucas ? lucasStages : tataStages)[stage - 1];
}
