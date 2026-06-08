import { describe, expect, it } from "vitest";
import { INITIAL_MATCHES } from "@/lib/tournament-data";
import { formatKickoff } from "@/lib/utils";

describe("World Cup schedule", () => {
  it("shows Canada vs Bosnia and Herzegovina at 3:00 PM Eastern on Friday June 12", () => {
    const match = INITIAL_MATCHES.find((item) => item.id === "M3");

    expect(match?.homeTeamId).toBe("canada");
    expect(match?.awayTeamId).toBe("bosnia-herzegovina");
    expect(match?.kickoff).toBe("2026-06-12T19:00:00.000Z");
    expect(match ? formatKickoff(match.kickoff) : "").toBe("Fri, Jun 12, 3:00 PM EST");
  });
});
