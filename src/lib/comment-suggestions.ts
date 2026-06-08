import type { Match, Team } from "./types";

const TEAM_SPOTLIGHTS: Record<string, { player: string; angle: string }> = {
  mexico: { player: "Santiago Gimenez", angle: "box movement" },
  "south-africa": { player: "Ronwen Williams", angle: "keeper nerves" },
  "korea-republic": { player: "Son Heung-min", angle: "counter punch" },
  czechia: { player: "Patrik Schick", angle: "finishing touch" },
  canada: { player: "Alphonso Davies", angle: "left-side speed" },
  switzerland: { player: "Granit Xhaka", angle: "midfield control" },
  qatar: { player: "Akram Afif", angle: "creative spark" },
  "bosnia-herzegovina": { player: "Edin Dzeko", angle: "captain energy" },
  brazil: { player: "Vinicius Jr.", angle: "winger magic" },
  morocco: { player: "Achraf Hakimi", angle: "right-side danger" },
  haiti: { player: "Duckens Nazon", angle: "underdog punch" },
  scotland: { player: "Scott McTominay", angle: "late-box runs" },
  usa: { player: "Christian Pulisic", angle: "big-game touch" },
  paraguay: { player: "Miguel Almiron", angle: "transition speed" },
  australia: { player: "Mathew Ryan", angle: "calm saves" },
  turkiye: { player: "Arda Guler", angle: "left-foot sparkle" },
  germany: { player: "Jamal Musiala", angle: "tight-space dribbling" },
  curacao: { player: "Leandro Bacuna", angle: "set-piece bite" },
  "cote-divoire": { player: "Sebastien Haller", angle: "penalty-box threat" },
  ecuador: { player: "Moises Caicedo", angle: "ball-winning bite" },
  netherlands: { player: "Virgil van Dijk", angle: "defensive command" },
  japan: { player: "Takefusa Kubo", angle: "quick feet" },
  tunisia: { player: "Ellyes Skhiri", angle: "midfield grit" },
  sweden: { player: "Alexander Isak", angle: "smooth finishing" },
  belgium: { player: "Kevin De Bruyne", angle: "final pass" },
  egypt: { player: "Mohamed Salah", angle: "breakaway danger" },
  "ir-iran": { player: "Mehdi Taremi", angle: "penalty-box timing" },
  "new-zealand": { player: "Chris Wood", angle: "aerial pressure" },
  spain: { player: "Lamine Yamal", angle: "teenage magic" },
  "cabo-verde": { player: "Ryan Mendes", angle: "island pride" },
  "saudi-arabia": { player: "Salem Al-Dawsari", angle: "big-tournament shot" },
  uruguay: { player: "Federico Valverde", angle: "midfield thunder" },
  france: { player: "Kylian Mbappe", angle: "pure pace" },
  senegal: { player: "Sadio Mane", angle: "knockout instinct" },
  norway: { player: "Erling Haaland", angle: "goal machine watch" },
  iraq: { player: "Aymen Hussein", angle: "target-man battle" },
  argentina: { player: "Lionel Messi", angle: "last-dance magic" },
  algeria: { player: "Riyad Mahrez", angle: "silky left foot" },
  austria: { player: "David Alaba", angle: "leader mode" },
  jordan: { player: "Musa Al-Taamari", angle: "wide-run danger" },
  portugal: { player: "Cristiano Ronaldo", angle: "box-office moment" },
  uzbekistan: { player: "Eldor Shomurodov", angle: "history chase" },
  colombia: { player: "Luis Diaz", angle: "relentless wing play" },
  "congo-dr": { player: "Chancel Mbemba", angle: "defensive pride" },
  england: { player: "Jude Bellingham", angle: "midfield swagger" },
  croatia: { player: "Luka Modric", angle: "tempo control" },
  ghana: { player: "Mohammed Kudus", angle: "dribble burst" },
  panama: { player: "Adalberto Carrasquilla", angle: "midfield bite" }
};

export function buildCommentSuggestions(match: Match, home: Team | null, away: Team | null) {
  if (!home || !away) {
    return [
      `${match.homeSeed?.label ?? "Home seed"} to make a statement`,
      `${match.awaySeed?.label ?? "Away seed"} upset watch`,
      `${match.venue.split(",")[0]} bracket drama`,
      "Tata vs Lucas nervous pick"
    ];
  }

  const homeSpotlight = TEAM_SPOTLIGHTS[home.id];
  const awaySpotlight = TEAM_SPOTLIGHTS[away.id];
  const spain = home.id === "spain" ? home : away.id === "spain" ? away : null;
  const opponent = spain ? (home.id === "spain" ? away : home) : null;
  const opponentSpotlight = opponent ? TEAM_SPOTLIGHTS[opponent.id] : null;

  const ideas = spain
    ? [
        "Tata and Lucas backing Spain",
        "Lamine Yamal magic watch",
        `Spain to unlock ${opponent?.name ?? "this one"}?`,
        opponentSpotlight ? `${opponentSpotlight.player} has to answer Yamal` : `${opponent?.name ?? "Opponent"} must stop Yamal`
      ]
    : [
        `${home.name} vs ${away.name}: tight one?`,
        homeSpotlight ? `${homeSpotlight.player} ${homeSpotlight.angle}` : `${home.name} team belief`,
        awaySpotlight ? `${awaySpotlight.player} ${awaySpotlight.angle}` : `${away.name} upset chance`,
        `${match.venue.split(",")[0]} drama pick`
      ];

  return Array.from(new Set(ideas)).slice(0, 4);
}
