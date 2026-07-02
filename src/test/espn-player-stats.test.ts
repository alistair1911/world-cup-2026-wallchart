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

  it("captures ESPN assists when participants are unlabelled scorer then assister", () => {
    const match = INITIAL_MATCHES.find((item) => item.homeTeamId === "belgium" && item.awayTeamId === "ir-iran")!;
    const stats = parseEspnPlayerStats([match], {
      espnEvents: [
        {
          eventId: "test-event",
          homeTeamName: "Belgium",
          awayTeamName: "Iran",
          kickoff: match.kickoff,
          competitors: [
            { id: "459", name: "Belgium" },
            { id: "469", name: "Iran" }
          ],
          details: [
            {
              scoringPlay: true,
              team: { id: "459" },
              participants: [
                { athlete: { displayName: "Romelu Lukaku" } },
                { athlete: { displayName: "Thomas Meunier" } }
              ]
            }
          ]
        }
      ]
    });

    expect(stats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ playerId: "belgium-romelu-lukaku", goals: 1, assists: 0 }),
        expect.objectContaining({ playerId: "belgium-thomas-meunier", goals: 0, assists: 1 })
      ])
    );
  });

  it("does not add fallback participant assists for penalties", () => {
    const match = INITIAL_MATCHES.find((item) => item.homeTeamId === "belgium" && item.awayTeamId === "ir-iran")!;
    const stats = parseEspnPlayerStats([match], {
      espnEvents: [
        {
          eventId: "test-event",
          homeTeamName: "Belgium",
          awayTeamName: "Iran",
          kickoff: match.kickoff,
          competitors: [
            { id: "459", name: "Belgium" },
            { id: "469", name: "Iran" }
          ],
          details: [
            {
              scoringPlay: true,
              penaltyKick: true,
              team: { id: "459" },
              participants: [
                { athlete: { displayName: "Youri Tielemans" } },
                { athlete: { displayName: "Leandro Trossard" } }
              ]
            }
          ]
        }
      ]
    });

    expect(stats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ playerId: "belgium-youri-tielemans", goals: 1, assists: 0 })
      ])
    );
    expect(stats.some((row) => row.playerId === "belgium-leandro-trossard")).toBe(false);
  });

  it("ignores placeholder scorer names from provider payloads", () => {
    const match = INITIAL_MATCHES.find((item) => item.homeTeamId === "netherlands" && item.awayTeamId === "japan")!;
    const stats = parseEspnPlayerStats([match], {
      espnEvents: [
        {
          eventId: "test-event",
          homeTeamName: "Netherlands",
          awayTeamName: "Japan",
          kickoff: match.kickoff,
          competitors: [
            { id: "449", name: "Netherlands" },
            { id: "627", name: "Japan" }
          ],
          details: [
            {
              scoringPlay: true,
              team: { id: "449" },
              athletesInvolved: [{ displayName: "Unknown" }]
            },
            {
              scoringPlay: true,
              team: { id: "627" },
              participants: [{ athlete: { displayName: "Player 583" } }]
            }
          ]
        }
      ]
    });

    expect(stats).toEqual([]);
  });
});
