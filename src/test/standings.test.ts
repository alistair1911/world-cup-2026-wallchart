import { describe, expect, it } from "vitest";
import { buildStandings } from "@/lib/standings";
import { INITIAL_MATCHES } from "@/lib/tournament-data";

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
