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

  it("awards 1 point for one exact team score when outcome is wrong", () => {
    expect(scorePrediction(baseMatch, prediction(2, 3)).points).toBe(1);
  });

  it("adds knockout advancer bonus", () => {
    const knockout: Match = {
      ...baseMatch,
      phase: "round32",
      penaltyWinnerId: null
    };

    expect(
      scorePrediction(knockout, {
        ...prediction(3, 2),
        predictedWinnerTeamId: "mexico"
      }).points
    ).toBe(5);
  });
});
