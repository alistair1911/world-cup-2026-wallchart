import type { FamilyUser, GroupLetter, KnockoutSeed, Match, MatchPhase, Team } from "./types";

export const FAMILY_USERS: FamilyUser[] = [
  { key: "tata", displayName: "Tata", accent: "bg-cup-red" },
  { key: "lucas", displayName: "Lucas", accent: "bg-pitch-600" }
];

export const GROUPS: GroupLetter[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const groupTeams: Record<GroupLetter, Array<Omit<Team, "group" | "seed">>> = {
  A: [
    { id: "mexico", name: "Mexico", code: "MEX", flag: "🇲🇽" },
    { id: "south-africa", name: "South Africa", code: "RSA", flag: "🇿🇦" },
    { id: "korea-republic", name: "Korea Republic", code: "KOR", flag: "🇰🇷" },
    { id: "czechia", name: "Czechia", code: "CZE", flag: "🇨🇿" }
  ],
  B: [
    { id: "canada", name: "Canada", code: "CAN", flag: "🇨🇦" },
    { id: "switzerland", name: "Switzerland", code: "SUI", flag: "🇨🇭" },
    { id: "qatar", name: "Qatar", code: "QAT", flag: "🇶🇦" },
    { id: "bosnia-herzegovina", name: "Bosnia and Herzegovina", code: "BIH", flag: "🇧🇦" }
  ],
  C: [
    { id: "brazil", name: "Brazil", code: "BRA", flag: "🇧🇷" },
    { id: "morocco", name: "Morocco", code: "MAR", flag: "🇲🇦" },
    { id: "haiti", name: "Haiti", code: "HAI", flag: "🇭🇹" },
    { id: "scotland", name: "Scotland", code: "SCO", flag: "🏴" }
  ],
  D: [
    { id: "usa", name: "USA", code: "USA", flag: "🇺🇸" },
    { id: "paraguay", name: "Paraguay", code: "PAR", flag: "🇵🇾" },
    { id: "australia", name: "Australia", code: "AUS", flag: "🇦🇺" },
    { id: "turkiye", name: "Türkiye", code: "TUR", flag: "🇹🇷" }
  ],
  E: [
    { id: "germany", name: "Germany", code: "GER", flag: "🇩🇪" },
    { id: "curacao", name: "Curaçao", code: "CUW", flag: "🇨🇼" },
    { id: "cote-divoire", name: "Côte d'Ivoire", code: "CIV", flag: "🇨🇮" },
    { id: "ecuador", name: "Ecuador", code: "ECU", flag: "🇪🇨" }
  ],
  F: [
    { id: "netherlands", name: "Netherlands", code: "NED", flag: "🇳🇱" },
    { id: "japan", name: "Japan", code: "JPN", flag: "🇯🇵" },
    { id: "tunisia", name: "Tunisia", code: "TUN", flag: "🇹🇳" },
    { id: "sweden", name: "Sweden", code: "SWE", flag: "🇸🇪" }
  ],
  G: [
    { id: "belgium", name: "Belgium", code: "BEL", flag: "🇧🇪" },
    { id: "egypt", name: "Egypt", code: "EGY", flag: "🇪🇬" },
    { id: "ir-iran", name: "IR Iran", code: "IRN", flag: "🇮🇷" },
    { id: "new-zealand", name: "New Zealand", code: "NZL", flag: "🇳🇿" }
  ],
  H: [
    { id: "spain", name: "Spain", code: "ESP", flag: "🇪🇸" },
    { id: "cabo-verde", name: "Cabo Verde", code: "CPV", flag: "🇨🇻" },
    { id: "saudi-arabia", name: "Saudi Arabia", code: "KSA", flag: "🇸🇦" },
    { id: "uruguay", name: "Uruguay", code: "URU", flag: "🇺🇾" }
  ],
  I: [
    { id: "france", name: "France", code: "FRA", flag: "🇫🇷" },
    { id: "senegal", name: "Senegal", code: "SEN", flag: "🇸🇳" },
    { id: "norway", name: "Norway", code: "NOR", flag: "🇳🇴" },
    { id: "iraq", name: "Iraq", code: "IRQ", flag: "🇮🇶" }
  ],
  J: [
    { id: "argentina", name: "Argentina", code: "ARG", flag: "🇦🇷" },
    { id: "algeria", name: "Algeria", code: "ALG", flag: "🇩🇿" },
    { id: "austria", name: "Austria", code: "AUT", flag: "🇦🇹" },
    { id: "jordan", name: "Jordan", code: "JOR", flag: "🇯🇴" }
  ],
  K: [
    { id: "portugal", name: "Portugal", code: "POR", flag: "🇵🇹" },
    { id: "uzbekistan", name: "Uzbekistan", code: "UZB", flag: "🇺🇿" },
    { id: "colombia", name: "Colombia", code: "COL", flag: "🇨🇴" },
    { id: "congo-dr", name: "Congo DR", code: "COD", flag: "🇨🇩" }
  ],
  L: [
    { id: "england", name: "England", code: "ENG", flag: "🏴" },
    { id: "croatia", name: "Croatia", code: "CRO", flag: "🇭🇷" },
    { id: "ghana", name: "Ghana", code: "GHA", flag: "🇬🇭" },
    { id: "panama", name: "Panama", code: "PAN", flag: "🇵🇦" }
  ]
};

export const TEAMS: Team[] = GROUPS.flatMap((group) =>
  groupTeams[group].map((team, index) => ({
    ...team,
    group,
    seed: index + 1
  }))
);

function kickoffFromBst(date: string, time: string) {
  const value = new Date(`${date}T${time}:00.000Z`);
  value.setUTCHours(value.getUTCHours() - 1);
  return value.toISOString();
}

type GroupFixture = {
  group: GroupLetter;
  n: number;
  home: string;
  away: string;
  bstDate: string;
  bstTime: string;
  venue: string;
};

const groupFixtures: GroupFixture[] = [
  { group: "A", n: 1, home: "mexico", away: "south-africa", bstDate: "2026-06-11", bstTime: "20:00", venue: "Mexico City, Mexico" },
  { group: "A", n: 2, home: "korea-republic", away: "czechia", bstDate: "2026-06-12", bstTime: "03:00", venue: "Guadalajara, Mexico" },
  { group: "A", n: 25, home: "czechia", away: "south-africa", bstDate: "2026-06-18", bstTime: "17:00", venue: "Atlanta, USA" },
  { group: "A", n: 28, home: "mexico", away: "korea-republic", bstDate: "2026-06-19", bstTime: "02:00", venue: "Guadalajara, Mexico" },
  { group: "A", n: 53, home: "czechia", away: "mexico", bstDate: "2026-06-25", bstTime: "02:00", venue: "Mexico City, Mexico" },
  { group: "A", n: 54, home: "south-africa", away: "korea-republic", bstDate: "2026-06-25", bstTime: "02:00", venue: "Monterrey, Mexico" },

  { group: "B", n: 3, home: "canada", away: "bosnia-herzegovina", bstDate: "2026-06-12", bstTime: "20:00", venue: "Toronto, Canada" },
  { group: "B", n: 8, home: "qatar", away: "switzerland", bstDate: "2026-06-13", bstTime: "20:00", venue: "San Francisco Bay Area, USA" },
  { group: "B", n: 26, home: "switzerland", away: "bosnia-herzegovina", bstDate: "2026-06-18", bstTime: "20:00", venue: "Los Angeles, USA" },
  { group: "B", n: 27, home: "canada", away: "qatar", bstDate: "2026-06-18", bstTime: "23:00", venue: "Vancouver, Canada" },
  { group: "B", n: 51, home: "switzerland", away: "canada", bstDate: "2026-06-24", bstTime: "20:00", venue: "Vancouver, Canada" },
  { group: "B", n: 52, home: "bosnia-herzegovina", away: "qatar", bstDate: "2026-06-24", bstTime: "20:00", venue: "Seattle, USA" },

  { group: "C", n: 5, home: "brazil", away: "morocco", bstDate: "2026-06-13", bstTime: "23:00", venue: "New York/New Jersey, USA" },
  { group: "C", n: 7, home: "haiti", away: "scotland", bstDate: "2026-06-14", bstTime: "02:00", venue: "Boston, USA" },
  { group: "C", n: 29, home: "scotland", away: "morocco", bstDate: "2026-06-19", bstTime: "23:00", venue: "Boston, USA" },
  { group: "C", n: 30, home: "brazil", away: "haiti", bstDate: "2026-06-20", bstTime: "01:30", venue: "Philadelphia, USA" },
  { group: "C", n: 49, home: "scotland", away: "brazil", bstDate: "2026-06-24", bstTime: "23:00", venue: "Miami, USA" },
  { group: "C", n: 50, home: "morocco", away: "haiti", bstDate: "2026-06-24", bstTime: "23:00", venue: "Atlanta, USA" },

  { group: "D", n: 4, home: "usa", away: "paraguay", bstDate: "2026-06-13", bstTime: "02:00", venue: "Los Angeles, USA" },
  { group: "D", n: 6, home: "australia", away: "turkiye", bstDate: "2026-06-14", bstTime: "05:00", venue: "Vancouver, Canada" },
  { group: "D", n: 31, home: "usa", away: "australia", bstDate: "2026-06-19", bstTime: "20:00", venue: "Seattle, USA" },
  { group: "D", n: 32, home: "turkiye", away: "paraguay", bstDate: "2026-06-20", bstTime: "04:00", venue: "San Francisco Bay Area, USA" },
  { group: "D", n: 59, home: "turkiye", away: "usa", bstDate: "2026-06-26", bstTime: "03:00", venue: "Los Angeles, USA" },
  { group: "D", n: 60, home: "paraguay", away: "australia", bstDate: "2026-06-26", bstTime: "03:00", venue: "San Francisco Bay Area, USA" },

  { group: "E", n: 9, home: "germany", away: "curacao", bstDate: "2026-06-14", bstTime: "18:00", venue: "Houston, USA" },
  { group: "E", n: 10, home: "cote-divoire", away: "ecuador", bstDate: "2026-06-15", bstTime: "00:00", venue: "Philadelphia, USA" },
  { group: "E", n: 33, home: "germany", away: "cote-divoire", bstDate: "2026-06-20", bstTime: "21:00", venue: "Toronto, Canada" },
  { group: "E", n: 34, home: "ecuador", away: "curacao", bstDate: "2026-06-21", bstTime: "01:00", venue: "Kansas City, USA" },
  { group: "E", n: 55, home: "curacao", away: "cote-divoire", bstDate: "2026-06-25", bstTime: "21:00", venue: "Philadelphia, USA" },
  { group: "E", n: 56, home: "ecuador", away: "germany", bstDate: "2026-06-25", bstTime: "21:00", venue: "New York/New Jersey, USA" },

  { group: "F", n: 11, home: "netherlands", away: "japan", bstDate: "2026-06-14", bstTime: "21:00", venue: "Dallas, USA" },
  { group: "F", n: 12, home: "sweden", away: "tunisia", bstDate: "2026-06-15", bstTime: "03:00", venue: "Monterrey, Mexico" },
  { group: "F", n: 35, home: "netherlands", away: "sweden", bstDate: "2026-06-20", bstTime: "18:00", venue: "Houston, USA" },
  { group: "F", n: 36, home: "tunisia", away: "japan", bstDate: "2026-06-21", bstTime: "05:00", venue: "Monterrey, Mexico" },
  { group: "F", n: 57, home: "japan", away: "sweden", bstDate: "2026-06-26", bstTime: "00:00", venue: "Dallas, USA" },
  { group: "F", n: 58, home: "tunisia", away: "netherlands", bstDate: "2026-06-26", bstTime: "00:00", venue: "Kansas City, USA" },

  { group: "G", n: 15, home: "belgium", away: "egypt", bstDate: "2026-06-15", bstTime: "20:00", venue: "Seattle, USA" },
  { group: "G", n: 16, home: "ir-iran", away: "new-zealand", bstDate: "2026-06-16", bstTime: "02:00", venue: "Los Angeles, USA" },
  { group: "G", n: 39, home: "belgium", away: "ir-iran", bstDate: "2026-06-21", bstTime: "20:00", venue: "Los Angeles, USA" },
  { group: "G", n: 40, home: "new-zealand", away: "egypt", bstDate: "2026-06-22", bstTime: "02:00", venue: "Vancouver, Canada" },
  { group: "G", n: 63, home: "egypt", away: "ir-iran", bstDate: "2026-06-27", bstTime: "04:00", venue: "Seattle, USA" },
  { group: "G", n: 64, home: "new-zealand", away: "belgium", bstDate: "2026-06-27", bstTime: "04:00", venue: "Vancouver, Canada" },

  { group: "H", n: 13, home: "spain", away: "cabo-verde", bstDate: "2026-06-15", bstTime: "17:00", venue: "Atlanta, USA" },
  { group: "H", n: 14, home: "saudi-arabia", away: "uruguay", bstDate: "2026-06-15", bstTime: "23:00", venue: "Miami, USA" },
  { group: "H", n: 37, home: "spain", away: "saudi-arabia", bstDate: "2026-06-21", bstTime: "17:00", venue: "Atlanta, USA" },
  { group: "H", n: 38, home: "uruguay", away: "cabo-verde", bstDate: "2026-06-21", bstTime: "23:00", venue: "Miami, USA" },
  { group: "H", n: 65, home: "cabo-verde", away: "saudi-arabia", bstDate: "2026-06-27", bstTime: "01:00", venue: "Houston, USA" },
  { group: "H", n: 66, home: "uruguay", away: "spain", bstDate: "2026-06-27", bstTime: "01:00", venue: "Guadalajara, Mexico" },

  { group: "I", n: 17, home: "france", away: "senegal", bstDate: "2026-06-16", bstTime: "20:00", venue: "New York/New Jersey, USA" },
  { group: "I", n: 18, home: "iraq", away: "norway", bstDate: "2026-06-16", bstTime: "23:00", venue: "Boston, USA" },
  { group: "I", n: 41, home: "france", away: "iraq", bstDate: "2026-06-22", bstTime: "22:00", venue: "Philadelphia, USA" },
  { group: "I", n: 42, home: "norway", away: "senegal", bstDate: "2026-06-23", bstTime: "01:00", venue: "New York/New Jersey, USA" },
  { group: "I", n: 61, home: "norway", away: "france", bstDate: "2026-06-26", bstTime: "20:00", venue: "Boston, USA" },
  { group: "I", n: 62, home: "senegal", away: "iraq", bstDate: "2026-06-26", bstTime: "20:00", venue: "Toronto, Canada" },

  { group: "J", n: 19, home: "argentina", away: "algeria", bstDate: "2026-06-17", bstTime: "02:00", venue: "Kansas City, USA" },
  { group: "J", n: 20, home: "austria", away: "jordan", bstDate: "2026-06-17", bstTime: "05:00", venue: "San Francisco Bay Area, USA" },
  { group: "J", n: 43, home: "argentina", away: "austria", bstDate: "2026-06-22", bstTime: "18:00", venue: "Dallas, USA" },
  { group: "J", n: 44, home: "jordan", away: "algeria", bstDate: "2026-06-23", bstTime: "04:00", venue: "San Francisco Bay Area, USA" },
  { group: "J", n: 69, home: "algeria", away: "austria", bstDate: "2026-06-28", bstTime: "03:00", venue: "Kansas City, USA" },
  { group: "J", n: 70, home: "jordan", away: "argentina", bstDate: "2026-06-28", bstTime: "03:00", venue: "Dallas, USA" },

  { group: "K", n: 23, home: "portugal", away: "congo-dr", bstDate: "2026-06-17", bstTime: "18:00", venue: "Houston, USA" },
  { group: "K", n: 24, home: "uzbekistan", away: "colombia", bstDate: "2026-06-18", bstTime: "03:00", venue: "Mexico City, Mexico" },
  { group: "K", n: 47, home: "portugal", away: "uzbekistan", bstDate: "2026-06-23", bstTime: "18:00", venue: "Houston, USA" },
  { group: "K", n: 48, home: "colombia", away: "congo-dr", bstDate: "2026-06-24", bstTime: "03:00", venue: "Guadalajara, Mexico" },
  { group: "K", n: 71, home: "colombia", away: "portugal", bstDate: "2026-06-28", bstTime: "00:30", venue: "Miami, USA" },
  { group: "K", n: 72, home: "congo-dr", away: "uzbekistan", bstDate: "2026-06-28", bstTime: "00:30", venue: "Atlanta, USA" },

  { group: "L", n: 21, home: "england", away: "croatia", bstDate: "2026-06-17", bstTime: "21:00", venue: "Dallas, USA" },
  { group: "L", n: 22, home: "ghana", away: "panama", bstDate: "2026-06-18", bstTime: "00:00", venue: "Toronto, Canada" },
  { group: "L", n: 45, home: "england", away: "ghana", bstDate: "2026-06-23", bstTime: "21:00", venue: "Boston, USA" },
  { group: "L", n: 46, home: "panama", away: "croatia", bstDate: "2026-06-24", bstTime: "00:00", venue: "Toronto, Canada" },
  { group: "L", n: 67, home: "panama", away: "england", bstDate: "2026-06-27", bstTime: "22:00", venue: "New York/New Jersey, USA" },
  { group: "L", n: 68, home: "croatia", away: "ghana", bstDate: "2026-06-27", bstTime: "22:00", venue: "Philadelphia, USA" }
];

function makeGroupMatches(): Match[] {
  return groupFixtures.map((fixture) => ({
    id: `M${fixture.n}`,
    matchNumber: fixture.n,
    phase: "group",
    group: fixture.group,
    kickoff: kickoffFromBst(fixture.bstDate, fixture.bstTime),
    venue: fixture.venue,
    homeTeamId: fixture.home,
    awayTeamId: fixture.away,
    homeScore: null,
    awayScore: null,
    status: "scheduled"
  }));
}

function seed(label: string, group?: GroupLetter, place?: 1 | 2 | 3, thirdPool?: GroupLetter[]): KnockoutSeed {
  return { type: "seed", label, group, place, thirdPool };
}

const knockoutFixtures: Array<{
  n: number;
  phase: MatchPhase;
  home: KnockoutSeed;
  away: KnockoutSeed;
  bstDate: string;
  bstTime: string;
  venue: string;
}> = [
  { n: 73, phase: "round32", home: seed("2A", "A", 2), away: seed("2B", "B", 2), bstDate: "2026-06-28", bstTime: "20:00", venue: "Los Angeles, USA" },
  { n: 74, phase: "round32", home: seed("1E", "E", 1), away: seed("3rd A/B/C/D/F", undefined, 3, ["A", "B", "C", "D", "F"]), bstDate: "2026-06-29", bstTime: "21:30", venue: "Boston, USA" },
  { n: 75, phase: "round32", home: seed("1F", "F", 1), away: seed("2C", "C", 2), bstDate: "2026-06-30", bstTime: "02:00", venue: "Monterrey, Mexico" },
  { n: 76, phase: "round32", home: seed("1C", "C", 1), away: seed("2F", "F", 2), bstDate: "2026-06-29", bstTime: "18:00", venue: "Houston, USA" },
  { n: 77, phase: "round32", home: seed("1I", "I", 1), away: seed("3rd C/D/F/G/H", undefined, 3, ["C", "D", "F", "G", "H"]), bstDate: "2026-06-30", bstTime: "22:00", venue: "New York/New Jersey, USA" },
  { n: 78, phase: "round32", home: seed("2E", "E", 2), away: seed("2I", "I", 2), bstDate: "2026-06-30", bstTime: "18:00", venue: "Dallas, USA" },
  { n: 79, phase: "round32", home: seed("1A", "A", 1), away: seed("3rd C/E/F/H/I", undefined, 3, ["C", "E", "F", "H", "I"]), bstDate: "2026-07-01", bstTime: "02:00", venue: "Mexico City, Mexico" },
  { n: 80, phase: "round32", home: seed("1L", "L", 1), away: seed("3rd E/H/I/J/K", undefined, 3, ["E", "H", "I", "J", "K"]), bstDate: "2026-07-01", bstTime: "17:00", venue: "Atlanta, USA" },
  { n: 81, phase: "round32", home: seed("1D", "D", 1), away: seed("3rd B/E/F/I/J", undefined, 3, ["B", "E", "F", "I", "J"]), bstDate: "2026-07-02", bstTime: "01:00", venue: "San Francisco Bay Area, USA" },
  { n: 82, phase: "round32", home: seed("1G", "G", 1), away: seed("3rd A/E/H/I/J", undefined, 3, ["A", "E", "H", "I", "J"]), bstDate: "2026-07-01", bstTime: "21:00", venue: "Seattle, USA" },
  { n: 83, phase: "round32", home: seed("2K", "K", 2), away: seed("2L", "L", 2), bstDate: "2026-07-03", bstTime: "00:00", venue: "Toronto, Canada" },
  { n: 84, phase: "round32", home: seed("1H", "H", 1), away: seed("2J", "J", 2), bstDate: "2026-07-02", bstTime: "20:00", venue: "Los Angeles, USA" },
  { n: 85, phase: "round32", home: seed("1B", "B", 1), away: seed("3rd E/F/G/I/J", undefined, 3, ["E", "F", "G", "I", "J"]), bstDate: "2026-07-03", bstTime: "04:00", venue: "Vancouver, Canada" },
  { n: 86, phase: "round32", home: seed("1J", "J", 1), away: seed("2H", "H", 2), bstDate: "2026-07-03", bstTime: "23:00", venue: "Miami, USA" },
  { n: 87, phase: "round32", home: seed("1K", "K", 1), away: seed("3rd D/E/I/J/L", undefined, 3, ["D", "E", "I", "J", "L"]), bstDate: "2026-07-04", bstTime: "02:30", venue: "Kansas City, USA" },
  { n: 88, phase: "round32", home: seed("2D", "D", 2), away: seed("2G", "G", 2), bstDate: "2026-07-03", bstTime: "19:00", venue: "Dallas, USA" },
  { n: 89, phase: "round16", home: seed("W74"), away: seed("W77"), bstDate: "2026-07-04", bstTime: "22:00", venue: "Philadelphia, USA" },
  { n: 90, phase: "round16", home: seed("W73"), away: seed("W75"), bstDate: "2026-07-04", bstTime: "18:00", venue: "Houston, USA" },
  { n: 91, phase: "round16", home: seed("W76"), away: seed("W78"), bstDate: "2026-07-05", bstTime: "21:00", venue: "New York/New Jersey, USA" },
  { n: 92, phase: "round16", home: seed("W79"), away: seed("W80"), bstDate: "2026-07-06", bstTime: "01:00", venue: "Mexico City, Mexico" },
  { n: 93, phase: "round16", home: seed("W83"), away: seed("W84"), bstDate: "2026-07-06", bstTime: "20:00", venue: "Dallas, USA" },
  { n: 94, phase: "round16", home: seed("W81"), away: seed("W82"), bstDate: "2026-07-07", bstTime: "01:00", venue: "Seattle, USA" },
  { n: 95, phase: "round16", home: seed("W86"), away: seed("W88"), bstDate: "2026-07-07", bstTime: "17:00", venue: "Atlanta, USA" },
  { n: 96, phase: "round16", home: seed("W85"), away: seed("W87"), bstDate: "2026-07-07", bstTime: "21:00", venue: "Vancouver, Canada" },
  { n: 97, phase: "quarter", home: seed("W89"), away: seed("W90"), bstDate: "2026-07-09", bstTime: "21:00", venue: "Boston, USA" },
  { n: 98, phase: "quarter", home: seed("W93"), away: seed("W94"), bstDate: "2026-07-10", bstTime: "20:00", venue: "Los Angeles, USA" },
  { n: 99, phase: "quarter", home: seed("W91"), away: seed("W92"), bstDate: "2026-07-11", bstTime: "22:00", venue: "Miami, USA" },
  { n: 100, phase: "quarter", home: seed("W95"), away: seed("W96"), bstDate: "2026-07-12", bstTime: "02:00", venue: "Kansas City, USA" },
  { n: 101, phase: "semi", home: seed("W97"), away: seed("W98"), bstDate: "2026-07-14", bstTime: "20:00", venue: "Dallas, USA" },
  { n: 102, phase: "semi", home: seed("W99"), away: seed("W100"), bstDate: "2026-07-15", bstTime: "20:00", venue: "Atlanta, USA" },
  { n: 103, phase: "third", home: seed("L101"), away: seed("L102"), bstDate: "2026-07-18", bstTime: "22:00", venue: "Miami, USA" },
  { n: 104, phase: "final", home: seed("W101"), away: seed("W102"), bstDate: "2026-07-19", bstTime: "20:00", venue: "New York/New Jersey, USA" }
];

function makeKnockoutMatches(): Match[] {
  return knockoutFixtures.map((fixture) => ({
    id: `M${fixture.n}`,
    matchNumber: fixture.n,
    phase: fixture.phase,
    kickoff: kickoffFromBst(fixture.bstDate, fixture.bstTime),
    venue: fixture.venue,
    homeSeed: fixture.home,
    awaySeed: fixture.away,
    homeScore: null,
    awayScore: null,
    status: "scheduled"
  }));
}

export const INITIAL_MATCHES: Match[] = [...makeGroupMatches(), ...makeKnockoutMatches()].sort(
  (a, b) => a.matchNumber - b.matchNumber
);

export function getTeam(teamId?: string | null) {
  return TEAMS.find((team) => team.id === teamId);
}
