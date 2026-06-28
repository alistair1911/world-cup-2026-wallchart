import { describe, expect, it } from "vitest";
import { buildStandings, resolveSeed } from "@/lib/standings";
import { GROUPS, INITIAL_MATCHES, TEAMS } from "@/lib/tournament-data";
import type { GroupLetter, KnockoutSeed, StandingRow, Team } from "@/lib/types";

function standingRow(team: Team, points: number): StandingRow {
  return {
    team,
    played: 3,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: points,
    goalsAgainst: 0,
    goalDifference: points,
    points
  };
}

function standingsWithThirdPlaceQualifiers(qualifyingGroups: GroupLetter[]) {
  return Object.fromEntries(
    GROUPS.map((group) => {
      const teams = TEAMS.filter((team) => team.group === group);
      const qualifierIndex = qualifyingGroups.indexOf(group);
      const thirdPlacePoints = qualifierIndex === -1 ? 1 : 40 - qualifierIndex;

      return [
        group,
        [
          standingRow(teams[0], 60),
          standingRow(teams[1], 50),
          standingRow(teams[2], thirdPlacePoints),
          standingRow(teams[3], 0)
        ]
      ];
    })
  ) as Record<GroupLetter, StandingRow[]>;
}

function thirdSeed(label: string, thirdPool: GroupLetter[]): KnockoutSeed {
  return { type: "seed", label, place: 3, thirdPool };
}

describe("buildStandings", () => {
  it("updates points and goal difference from final group scores", () => {
    const matches = INITIAL_MATCHES.map((match) => {
      if (match.id === "M1") {
        return { ...match, homeScore: 2, awayScore: 0, status: "final" as const };
      }
      if (match.id === "M2") {
        return { ...match, homeScore: 1, awayScore: 1, status: "final" as const };
      }
      return match;
    });

    const groupA = buildStandings(matches).A;

    expect(groupA[0].team.id).toBe("mexico");
    expect(groupA[0].points).toBe(3);
    expect(groupA[0].goalDifference).toBe(2);
    expect(groupA.find((row) => row.team.id === "korea-republic")?.points).toBe(1);
    expect(groupA.find((row) => row.team.id === "czechia")?.points).toBe(1);
  });
});

describe("resolveSeed", () => {
  it("uses the FIFA third-place assignment table instead of reusing the best eligible third-place team", () => {
    const standings = standingsWithThirdPlaceQualifiers(["B", "D", "E", "F", "I", "J", "K", "L"]);
    const thirdPlaceSeeds = [
      thirdSeed("3rd C/E/F/H/I", ["C", "E", "F", "H", "I"]),
      thirdSeed("3rd E/F/G/I/J", ["E", "F", "G", "I", "J"]),
      thirdSeed("3rd B/E/F/I/J", ["B", "E", "F", "I", "J"]),
      thirdSeed("3rd A/B/C/D/F", ["A", "B", "C", "D", "F"]),
      thirdSeed("3rd A/E/H/I/J", ["A", "E", "H", "I", "J"]),
      thirdSeed("3rd C/D/F/G/H", ["C", "D", "F", "G", "H"]),
      thirdSeed("3rd D/E/I/J/L", ["D", "E", "I", "J", "L"]),
      thirdSeed("3rd E/H/I/J/K", ["E", "H", "I", "J", "K"])
    ];

    const resolvedGroups = thirdPlaceSeeds.map((seed) => resolveSeed(seed, standings)?.group);

    expect(resolvedGroups).toEqual(["E", "J", "B", "D", "I", "F", "L", "K"]);
    expect(new Set(resolvedGroups).size).toBe(8);
  });

  it("keeps unresolved third-place slots as seed labels when the qualifying group combination is not in the table", () => {
    const standings = standingsWithThirdPlaceQualifiers(["A", "B", "C", "D", "E", "F", "G", "H"]);

    expect(resolveSeed(thirdSeed("3rd C/D/F/G/H", ["C", "D", "F", "G", "H"]), standings)).toBeNull();
  });
});
