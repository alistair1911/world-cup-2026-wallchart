import { TEAMS, getTeam } from "./tournament-data";
import type { Team } from "./types";

export type PlayerProfile = {
  id: string;
  name: string;
  teamId: string;
  position: string;
  role: string;
  club?: string;
  age?: number;
  foot?: "Left" | "Right" | "Both";
  height?: string;
  traits: string[];
  stats: Array<{ label: string; value: number }>;
  shirtNumber?: number;
  photoUrl?: string;
};

export type TeamProfile = {
  team: Team;
  formation: string;
  style: string;
  coachNote: string;
  players: PlayerProfile[];
};

const positionStats: Record<string, Array<{ label: string; value: number }>> = {
  GK: [
    { label: "Reflexes", value: 86 },
    { label: "Handling", value: 82 },
    { label: "Kicking", value: 78 },
    { label: "Command", value: 84 }
  ],
  CB: [
    { label: "Defending", value: 87 },
    { label: "Aerial", value: 84 },
    { label: "Recovery", value: 79 },
    { label: "Passing", value: 74 }
  ],
  DF: [
    { label: "Defending", value: 82 },
    { label: "Physical", value: 80 },
    { label: "Recovery", value: 78 },
    { label: "Passing", value: 70 }
  ],
  LB: [
    { label: "Pace", value: 88 },
    { label: "Crossing", value: 80 },
    { label: "Recovery", value: 82 },
    { label: "Stamina", value: 86 }
  ],
  RB: [
    { label: "Pace", value: 87 },
    { label: "Crossing", value: 79 },
    { label: "Recovery", value: 82 },
    { label: "Stamina", value: 85 }
  ],
  DM: [
    { label: "Control", value: 88 },
    { label: "Ball wins", value: 87 },
    { label: "Passing", value: 86 },
    { label: "Composure", value: 90 }
  ],
  CM: [
    { label: "Passing", value: 86 },
    { label: "Engine", value: 84 },
    { label: "Control", value: 85 },
    { label: "Pressing", value: 80 }
  ],
  AM: [
    { label: "Creativity", value: 88 },
    { label: "Dribbling", value: 86 },
    { label: "Vision", value: 87 },
    { label: "Shooting", value: 78 }
  ],
  LW: [
    { label: "Pace", value: 89 },
    { label: "Dribbling", value: 88 },
    { label: "Chance creation", value: 84 },
    { label: "Finishing", value: 79 }
  ],
  RW: [
    { label: "Pace", value: 89 },
    { label: "Dribbling", value: 88 },
    { label: "Chance creation", value: 84 },
    { label: "Finishing", value: 79 }
  ],
  FW: [
    { label: "Movement", value: 85 },
    { label: "Finishing", value: 83 },
    { label: "Pressing", value: 78 },
    { label: "Link play", value: 80 }
  ],
  ST: [
    { label: "Finishing", value: 87 },
    { label: "Movement", value: 84 },
    { label: "Strength", value: 81 },
    { label: "Box instinct", value: 88 }
  ]
};

const playerDetails: Record<string, Partial<Pick<PlayerProfile, "club" | "age" | "foot" | "height" | "traits">>> = {
  "spain-lamine-yamal": {
    club: "Barcelona",
    age: 18,
    foot: "Left",
    height: "1.80 m",
    traits: ["Family favorite", "1v1 threat", "Cut inside", "Final pass"]
  },
  "spain-rodri": {
    club: "Manchester City",
    age: 30,
    foot: "Right",
    height: "1.91 m",
    traits: ["Tempo control", "Press resistance", "Switches play"]
  },
  "spain-pedri": {
    club: "Barcelona",
    age: 23,
    foot: "Right",
    height: "1.74 m",
    traits: ["Between lines", "Composure", "Quick combinations"]
  },
  "spain-nico-williams": {
    club: "Athletic Club",
    age: 23,
    foot: "Right",
    height: "1.81 m",
    traits: ["Direct winger", "Explosive carry", "Back-post danger"]
  },
  "spain-unai-simon": {
    club: "Athletic Club",
    age: 29,
    foot: "Right",
    height: "1.90 m",
    traits: ["Build-up keeper", "Big saves", "Box command"]
  }
};

const statBoosts: Record<string, Partial<Record<string, number>>> = {
  "spain-lamine-yamal": { Pace: 92, Dribbling: 94, "Chance creation": 91, Finishing: 83 },
  "spain-rodri": { Control: 95, "Ball wins": 91, Passing: 94, Composure: 96 },
  "spain-pedri": { Passing: 91, Engine: 84, Control: 92, Pressing: 80 },
  "spain-nico-williams": { Pace: 94, Dribbling: 89, "Chance creation": 85, Finishing: 82 },
  "spain-unai-simon": { Reflexes: 86, Handling: 83, Kicking: 86, Command: 84 }
};

const featuredPlayers: Record<string, Array<Omit<PlayerProfile, "id" | "teamId" | "traits" | "stats">>> = {
  mexico: [
    { name: "Santiago Gimenez", position: "ST", role: "Penalty-box striker" },
    { name: "Edson Alvarez", position: "DM", role: "Ball-winning shield" },
    { name: "Hirving Lozano", position: "RW", role: "Direct runner" }
  ],
  "south-africa": [
    { name: "Ronwen Williams", position: "GK", role: "Shot-stopping leader" },
    { name: "Teboho Mokoena", position: "CM", role: "Long-range threat" },
    { name: "Percy Tau", position: "FW", role: "Creative forward" }
  ],
  "korea-republic": [
    { name: "Son Heung-min", position: "LW", role: "Counterattack finisher" },
    { name: "Kim Min-jae", position: "CB", role: "Defensive anchor" },
    { name: "Lee Kang-in", position: "AM", role: "Left-foot creator" }
  ],
  czechia: [
    { name: "Patrik Schick", position: "ST", role: "Clinical finisher" },
    { name: "Tomas Soucek", position: "CM", role: "Aerial midfield threat" },
    { name: "Antonin Barak", position: "AM", role: "Set-piece quality" }
  ],
  canada: [
    { name: "Alphonso Davies", position: "LB", role: "Explosive left-side runner" },
    { name: "Jonathan David", position: "ST", role: "Calm box finisher" },
    { name: "Stephen Eustaquio", position: "CM", role: "Tempo setter" }
  ],
  switzerland: [
    { name: "Granit Xhaka", position: "CM", role: "Midfield controller" },
    { name: "Manuel Akanji", position: "CB", role: "Progressive defender" },
    { name: "Breel Embolo", position: "ST", role: "Power forward" }
  ],
  qatar: [
    { name: "Akram Afif", position: "LW", role: "Creative spark" },
    { name: "Almoez Ali", position: "ST", role: "Tournament scorer" },
    { name: "Hassan Al-Haydos", position: "AM", role: "Experienced connector" }
  ],
  "bosnia-herzegovina": [
    { name: "Edin Dzeko", position: "ST", role: "Captain and target striker" },
    { name: "Miralem Pjanic", position: "CM", role: "Passing rhythm" },
    { name: "Ermedin Demirovic", position: "FW", role: "Pressing forward" }
  ],
  brazil: [
    { name: "Vinicius Jr.", position: "LW", role: "1v1 winger" },
    { name: "Rodrygo", position: "FW", role: "Flexible attacker" },
    { name: "Bruno Guimaraes", position: "CM", role: "Midfield bite" }
  ],
  morocco: [
    { name: "Achraf Hakimi", position: "RB", role: "Right-side accelerator" },
    { name: "Sofyan Amrabat", position: "DM", role: "Midfield screen" },
    { name: "Youssef En-Nesyri", position: "ST", role: "Aerial finisher" }
  ],
  haiti: [
    { name: "Duckens Nazon", position: "ST", role: "Main goal threat" },
    { name: "Frantzdy Pierrot", position: "FW", role: "Power runner" },
    { name: "Jean-Kevin Duverne", position: "DF", role: "Defensive balance" }
  ],
  scotland: [
    { name: "Scott McTominay", position: "CM", role: "Late-box runner" },
    { name: "Andrew Robertson", position: "LB", role: "Crossing captain" },
    { name: "John McGinn", position: "CM", role: "Pressing engine" }
  ],
  usa: [
    { name: "Christian Pulisic", position: "LW", role: "Big-game attacker" },
    { name: "Weston McKennie", position: "CM", role: "Box-to-box runner" },
    { name: "Tyler Adams", position: "DM", role: "Pressing captain" }
  ],
  paraguay: [
    { name: "Miguel Almiron", position: "AM", role: "Transition runner" },
    { name: "Julio Enciso", position: "FW", role: "Long-shot threat" },
    { name: "Gustavo Gomez", position: "CB", role: "Defensive leader" }
  ],
  australia: [
    { name: "Mathew Ryan", position: "GK", role: "Veteran organizer" },
    { name: "Jackson Irvine", position: "CM", role: "Midfield leader" },
    { name: "Craig Goodwin", position: "LW", role: "Delivery specialist" }
  ],
  turkiye: [
    { name: "Arda Guler", position: "AM", role: "Left-foot magic" },
    { name: "Hakan Calhanoglu", position: "CM", role: "Set-piece controller" },
    { name: "Kenan Yildiz", position: "FW", role: "Young attacker" }
  ],
  germany: [
    { name: "Jamal Musiala", position: "AM", role: "Tight-space dribbler" },
    { name: "Florian Wirtz", position: "AM", role: "Final-third creator" },
    { name: "Joshua Kimmich", position: "CM", role: "Tempo organizer" }
  ],
  curacao: [
    { name: "Leandro Bacuna", position: "CM", role: "Set-piece bite" },
    { name: "Juninho Bacuna", position: "CM", role: "Forward passing" },
    { name: "Cuco Martina", position: "DF", role: "Back-line experience" }
  ],
  "cote-divoire": [
    { name: "Sebastien Haller", position: "ST", role: "Penalty-box finisher" },
    { name: "Franck Kessie", position: "CM", role: "Midfield power" },
    { name: "Simon Adingra", position: "LW", role: "Wide spark" }
  ],
  ecuador: [
    { name: "Moises Caicedo", position: "CM", role: "Ball-winning force" },
    { name: "Piero Hincapie", position: "CB", role: "Left-foot defender" },
    { name: "Kendry Paez", position: "AM", role: "Teenage creator" }
  ],
  netherlands: [
    { name: "Virgil van Dijk", position: "CB", role: "Defensive commander" },
    { name: "Cody Gakpo", position: "FW", role: "Inside-forward threat" },
    { name: "Xavi Simons", position: "AM", role: "Creative connector" }
  ],
  japan: [
    { name: "Takefusa Kubo", position: "RW", role: "Quick-foot creator" },
    { name: "Kaoru Mitoma", position: "LW", role: "1v1 winger" },
    { name: "Wataru Endo", position: "DM", role: "Midfield balance" }
  ],
  tunisia: [
    { name: "Ellyes Skhiri", position: "CM", role: "Midfield grit" },
    { name: "Youssef Msakni", position: "FW", role: "Veteran spark" },
    { name: "Hannibal Mejbri", position: "CM", role: "Pressing energy" }
  ],
  sweden: [
    { name: "Alexander Isak", position: "ST", role: "Smooth finisher" },
    { name: "Dejan Kulusevski", position: "RW", role: "Carry-and-create winger" },
    { name: "Viktor Gyokeres", position: "ST", role: "Power striker" }
  ],
  belgium: [
    { name: "Kevin De Bruyne", position: "CM", role: "Final-pass master" },
    { name: "Jeremy Doku", position: "LW", role: "1v1 chaos" },
    { name: "Romelu Lukaku", position: "ST", role: "Power finisher" }
  ],
  egypt: [
    { name: "Mohamed Salah", position: "RW", role: "Breakaway danger" },
    { name: "Omar Marmoush", position: "FW", role: "Mobile scorer" },
    { name: "Mohamed Elneny", position: "CM", role: "Midfield experience" }
  ],
  "ir-iran": [
    { name: "Mehdi Taremi", position: "ST", role: "Penalty-box timing" },
    { name: "Sardar Azmoun", position: "ST", role: "Second-striker link" },
    { name: "Alireza Jahanbakhsh", position: "RW", role: "Wide experience" }
  ],
  "new-zealand": [
    { name: "Chris Wood", position: "ST", role: "Aerial pressure" },
    { name: "Liberato Cacace", position: "LB", role: "Left-side runner" },
    { name: "Marko Stamenic", position: "CM", role: "Midfield bite" }
  ],
  spain: [
    { name: "Lamine Yamal", position: "RW", role: "Family favorite and electric creator", shirtNumber: 19, photoUrl: "/players/lamine-yamal.jpg" },
    { name: "Rodri", position: "DM", role: "Control tower" },
    { name: "Pedri", position: "CM", role: "Tempo artist" },
    { name: "Nico Williams", position: "LW", role: "Direct winger" },
    { name: "Unai Simon", position: "GK", role: "Build-up goalkeeper" }
  ],
  "cabo-verde": [
    { name: "Ryan Mendes", position: "FW", role: "Island-pride attacker" },
    { name: "Bebe", position: "FW", role: "Set-piece striker" },
    { name: "Logan Costa", position: "CB", role: "Defensive presence" }
  ],
  "saudi-arabia": [
    { name: "Salem Al-Dawsari", position: "LW", role: "Big-tournament shot" },
    { name: "Saleh Al-Shehri", position: "ST", role: "Penalty-box forward" },
    { name: "Mohammed Kanno", position: "CM", role: "Midfield size" }
  ],
  uruguay: [
    { name: "Federico Valverde", position: "CM", role: "Midfield thunder" },
    { name: "Darwin Nunez", position: "ST", role: "Relentless runner" },
    { name: "Ronald Araujo", position: "CB", role: "Recovery defender" }
  ],
  france: [
    { name: "Kylian Mbappe", position: "LW", role: "Pure pace" },
    { name: "Antoine Griezmann", position: "AM", role: "Between-lines brain" },
    { name: "Aurelien Tchouameni", position: "DM", role: "Midfield platform" }
  ],
  senegal: [
    { name: "Sadio Mane", position: "LW", role: "Knockout instinct" },
    { name: "Kalidou Koulibaly", position: "CB", role: "Defensive captain" },
    { name: "Nicolas Jackson", position: "ST", role: "Vertical runner" }
  ],
  norway: [
    { name: "Erling Haaland", position: "ST", role: "Goal machine" },
    { name: "Martin Odegaard", position: "CM", role: "Left-foot conductor" },
    { name: "Alexander Sorloth", position: "ST", role: "Second striker threat" }
  ],
  iraq: [
    { name: "Aymen Hussein", position: "ST", role: "Target-man battle" },
    { name: "Ali Jasim", position: "LW", role: "Dribble outlet" },
    { name: "Zidane Iqbal", position: "CM", role: "Passing promise" }
  ],
  argentina: [
    { name: "Lionel Messi", position: "AM", role: "Last-dance magic" },
    { name: "Julian Alvarez", position: "FW", role: "Pressing scorer" },
    { name: "Emiliano Martinez", position: "GK", role: "Penalty drama king" }
  ],
  algeria: [
    { name: "Riyad Mahrez", position: "RW", role: "Silky left foot" },
    { name: "Ismael Bennacer", position: "CM", role: "Midfield rhythm" },
    { name: "Amine Gouiri", position: "FW", role: "Flexible attacker" }
  ],
  austria: [
    { name: "David Alaba", position: "CB", role: "Leader mode" },
    { name: "Marcel Sabitzer", position: "CM", role: "Late runs" },
    { name: "Christoph Baumgartner", position: "AM", role: "High-press creator" }
  ],
  jordan: [
    { name: "Musa Al-Taamari", position: "RW", role: "Wide-run danger" },
    { name: "Yazan Al-Naimat", position: "ST", role: "Penalty-box movement" },
    { name: "Nizar Al-Rashdan", position: "CM", role: "Midfield bite" }
  ],
  portugal: [
    { name: "Cristiano Ronaldo", position: "ST", role: "Box-office moment" },
    { name: "Bruno Fernandes", position: "AM", role: "Chance creator" },
    { name: "Bernardo Silva", position: "RW", role: "Control and craft" }
  ],
  uzbekistan: [
    { name: "Eldor Shomurodov", position: "ST", role: "History chase" },
    { name: "Abbosbek Fayzullaev", position: "AM", role: "Creative spark" },
    { name: "Abdukodir Khusanov", position: "CB", role: "Defensive promise" }
  ],
  colombia: [
    { name: "Luis Diaz", position: "LW", role: "Relentless wing play" },
    { name: "James Rodriguez", position: "AM", role: "Set-piece artist" },
    { name: "Jhon Duran", position: "ST", role: "Power finisher" }
  ],
  "congo-dr": [
    { name: "Chancel Mbemba", position: "CB", role: "Defensive pride" },
    { name: "Yoane Wissa", position: "FW", role: "Direct attacker" },
    { name: "Cedric Bakambu", position: "ST", role: "Penalty-box veteran" }
  ],
  england: [
    { name: "Jude Bellingham", position: "AM", role: "Midfield swagger" },
    { name: "Harry Kane", position: "ST", role: "Complete striker" },
    { name: "Bukayo Saka", position: "RW", role: "Right-side balance" }
  ],
  croatia: [
    { name: "Luka Modric", position: "CM", role: "Tempo control" },
    { name: "Josko Gvardiol", position: "CB", role: "Left-side defender" },
    { name: "Mateo Kovacic", position: "CM", role: "Press escape" }
  ],
  ghana: [
    { name: "Mohammed Kudus", position: "AM", role: "Dribble burst" },
    { name: "Thomas Partey", position: "CM", role: "Midfield power" },
    { name: "Inaki Williams", position: "ST", role: "Vertical runner" }
  ],
  panama: [
    { name: "Adalberto Carrasquilla", position: "CM", role: "Midfield bite" },
    { name: "Michael Amir Murillo", position: "RB", role: "Wide engine" },
    { name: "Jose Fajardo", position: "ST", role: "Box striker" }
  ]
};

const formationByGroup = ["4-3-3", "4-2-3-1", "3-4-2-1", "4-4-2"];

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function playerId(teamId: string, playerName: string) {
  return `${teamId}-${slugify(playerName)}`;
}

export function avatarUrl(name: string) {
  const params = new URLSearchParams({
    name,
    background: "0f5132",
    color: "ffffff",
    bold: "true",
    size: "512"
  });
  return `https://ui-avatars.com/api/?${params.toString()}`;
}

function statsFor(id: string, position: string) {
  const base = positionStats[position] ?? positionStats.FW;
  const boosts = statBoosts[id] ?? {};
  return base.map((stat) => ({ ...stat, value: boosts[stat.label] ?? stat.value }));
}

function traitsFor(id: string, position: string, role: string) {
  const details = playerDetails[id];
  if (details?.traits?.length) {
    return details.traits;
  }

  const positionTrait = ["GK", "CB", "DF", "LB", "RB"].includes(position)
    ? "Defensive reliability"
    : ["DM", "CM", "AM"].includes(position)
      ? "Midfield influence"
      : "Final-third threat";

  return [positionTrait, role, "Tournament watch"];
}

export function getTeamProfile(teamId: string): TeamProfile | null {
  const team = getTeam(teamId);
  if (!team) {
    return null;
  }

  const players = (featuredPlayers[team.id] ?? []).map((player) => {
    const id = playerId(team.id, player.name);
    const details = playerDetails[id] ?? {};

    return {
      ...player,
      ...details,
      id,
      teamId: team.id,
      traits: traitsFor(id, player.position, player.role),
      stats: statsFor(id, player.position)
    };
  });

  return {
    team,
    formation: team.id === "spain" ? "4-3-3" : formationByGroup[(team.seed + team.group.charCodeAt(0)) % formationByGroup.length],
    style:
      team.id === "spain"
        ? "High-possession, quick wide overloads, and Yamal isolation on the right."
        : "Compact tournament setup with quick transitions and set-piece chances.",
    coachNote:
      team.id === "spain"
        ? "Tata and Lucas watchlist: get Yamal facing forward early, then let Spain control the rhythm."
        : "Starter profile data; official 2026 squads and lineups should be reviewed closer to kickoff.",
    players
  };
}

export function getAllTeamProfiles() {
  return TEAMS.map((team) => getTeamProfile(team.id)).filter((profile): profile is TeamProfile => Boolean(profile));
}

export function getPlayerProfile(id: string) {
  for (const profile of getAllTeamProfiles()) {
    const player = profile.players.find((item) => item.id === id);
    if (player) {
      return { player, team: profile.team, formation: profile.formation };
    }
  }

  return null;
}

export function getAllPlayerProfiles() {
  return getAllTeamProfiles().flatMap((profile) =>
    profile.players.map((player) => ({
      player,
      team: profile.team,
      formation: profile.formation
    }))
  );
}
