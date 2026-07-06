import { describe, expect, it } from "vitest";
import { scorePrediction } from "@/lib/predictions";
import type { Match, Prediction } from "@/lib/types";

const baseMatch: Match = {
  id: "M1",
  matchNumber: 1,
  phase: "group",
  kickoff: "2026-06-11T19:00:00.000Z",
  venue: "Mexico City",
  homeTeamId: "mexico",
  awayTeamId: "south-africa",
  homeScore: 2,
  awayScore: 1,
  status: "final"
};

function prediction(homeScore: number, awayScore: number): Prediction {
  return {
    userKey: "tata",
    matchId: "M1",
    homeScore,
    awayScore
  };
}

describe("scorePrediction", () => {
  it("awards 5 points for an exact score", () => {
    expect(scorePrediction(baseMatch, prediction(2, 1)).points).toBe(5);
  });

  it("awards 3 points for correct winner and margin", () => {
    expect(scorePrediction(baseMatch, prediction(3, 2)).points).toBe(3);
  });

  it("awards 2 points for correct winner only", () => {
    expect(scorePrediction(baseMatch, prediction(4, 1)).points).toBe(2);
  });

  it("awards 0 points when the outcome is wrong, even with one exact team score", () => {
    const result = scorePrediction(baseMatch, prediction(2, 3));

    expect(result.points).toBe(0);
    expect(result.status).toBe("Missed");
  });

  it("does not add an advancer bonus for a normal knockout win prediction", () => {
    const knockout: Match = {
      ...baseMatch,
      phase: "round32",
      homeTeamId: "england",
      awayTeamId: "mexico",
      homeScore: 3,
      awayScore: 2,
      penaltyWinnerId: null
    };

    expect(
      scorePrediction(knockout, {
        ...prediction(1, 0),
        predictedWinnerTeamId: "england"
      }).points
    ).toBe(3);
  });

  it("awards 5 points for a knockout draw with the correct post-90 advancer", () => {
    const knockout: Match = {
      ...baseMatch,
      phase: "round32",
      homeScore: 2,
      awayScore: 2,
      penaltyWinnerId: "mexico"
    };

    expect(
      scorePrediction(knockout, {
        ...prediction(1, 1),
        predictedWinnerTeamId: "mexico"
      }).points
    ).toBe(5);
  });

  it("does not award the post-90 advancer bonus unless a knockout draw was predicted", () => {
    const knockout: Match = {
      ...baseMatch,
      phase: "round32",
      homeScore: 1,
      awayScore: 1,
      penaltyWinnerId: "mexico"
    };

    const result = scorePrediction(knockout, {
      ...prediction(2, 1),
      predictedWinnerTeamId: "mexico"
    });

    expect(result.points).toBe(0);
    expect(result.knockoutBonus).toBe(0);
  });
});
