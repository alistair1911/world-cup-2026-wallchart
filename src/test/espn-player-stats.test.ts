import { describe, expect, it } from "vitest";
import { parseEspnPlayerStats } from "@/lib/espn-player-stats";
import { INITIAL_MATCHES } from "@/lib/tournament-data";

describe("ESPN player stat parsing", () => {
  it("captures goal scorers and assists from athletesInvolved", () => {
    const match = INITIAL_MATCHES.find((item) => item.homeTeamId === "spain" && item.awayTeamId === "cabo-verde")!;
    const stats = parseEspnPlayerStats([match], {
      espnEvents: [
        {
          eventId: "test-event",
          homeTeamName: "Spain",
          awayTeamName: "Cabo Verde",
          kickoff: match.kickoff,
          competitors: [
            { id: "164", name: "Spain" },
            { id: "2597", name: "Cabo Verde" }
          ],
          details: [
            {
              scoringPlay: true,
              team: { id: "164" },
              athletesInvolved: [
                { displayName: "Lamine Yamal" },
                { displayName: "Mikel Oyarzabal" }
              ]
            }
          ]
        }
      ]
    });

    expect(stats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ playerId: "spain-lamine-yamal", goals: 1, assists: 0 }),
        expect.objectContaining({ playerId: "spain-mikel-oyarzabal", goals: 0, assists: 1 })
      ])
    );
  });

  it("captures explicit ESPN assist participants", () => {
    const match = INITIAL_MATCHES.find((item) => item.homeTeamId === "spain" && item.awayTeamId === "cabo-verde")!;
    const stats = parseEspnPlayerStats([match], {
      espnEvents: [
        {
          eventId: "test-event",
          homeTeamName: "Spain",
          awayTeamName: "Cabo Verde",
          kickoff: match.kickoff,
          competitors: [
            { id: "164", name: "Spain" },
            { id: "2597", name: "Cabo Verde" }
          ],
          details: [
            {
              scoringPlay: true,
              team: { id: "164" },
              participants: [
                { type: { displayName: "Scorer" }, athlete: { displayName: "Dani Olmo" } },
                { type: { displayName: "Assist" }, athlete: { displayName: "Pedri" } }
              ]
            }
          ]
        }
      ]
    });

    expect(stats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ playerId: "spain-dani-olmo", goals: 1, assists: 0 }),
        expect.objectContaining({ playerId: "spain-pedri", goals: 0, assists: 1 })
      ])
    );
  });
});
