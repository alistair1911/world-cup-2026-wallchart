import { describe, expect, it } from "vitest";
import { isPredictionLocked } from "@/lib/standings";
import type { Match } from "@/lib/types";

const match: Match = {
  id: "M1",
  matchNumber: 1,
  phase: "group",
  kickoff: "2026-06-11T19:00:00.000Z",
  venue: "Mexico City",
  homeTeamId: "mexico",
  awayTeamId: "south-africa",
  homeScore: null,
  awayScore: null,
  status: "scheduled"
};

describe("isPredictionLocked", () => {
  it("allows predictions more than five minutes before kickoff while scheduled", () => {
    expect(isPredictionLocked(match, new Date("2026-06-11T18:54:59.000Z"))).toBe(false);
  });

  it("locks predictions five minutes before kickoff", () => {
    expect(isPredictionLocked(match, new Date("2026-06-11T18:55:00.000Z"))).toBe(true);
  });

  it("locks predictions when a result has started", () => {
    expect(isPredictionLocked({ ...match, status: "live" }, new Date("2026-06-10T19:00:00.000Z"))).toBe(true);
  });
});
