import { describe, expect, it } from "vitest";
import {
  FANTASY_ROUND_ID,
  buildFantasyLeaderboard,
  buildFantasyScoresFromMatches,
  fantasyOptionMap,
  fantasyPlayerTotals,
  fantasyPlayerOptions,
  fantasyScoreIdsForPlayer,
  mergeFantasyScores,
  normalizeFantasyRosterSlots,
  normalizeFantasyPosition,
  resolveFantasyPlayerOption,
  scoreFantasyPlayerMatch,
  validateFantasyRoster
} from "@/lib/fantasy";
import { COMPLETE_SQUAD_MINIMUM, mergePlayerCatalog } from "@/lib/player-catalog";
import { INITIAL_MATCHES } from "@/lib/tournament-data";
import type { FantasyRosterSlot, PlayerMatchStat } from "@/lib/types";

describe("mini-fantasy scoring", () => {
  it("scores goals by fantasy position and adds assists and clean sheets", () => {
    expect(scoreFantasyPlayerMatch({ position: "FWD", goals: 1 }).points).toBe(4);
    expect(scoreFantasyPlayerMatch({ position: "MID", goals: 1, assists: 1, cleanSheet: true }).points).toBe(9);
    expect(scoreFantasyPlayerMatch({ position: "DEF", goals: 1, cleanSheet: true }).points).toBe(10);
    expect(scoreFantasyPlayerMatch({ position: "GK", cleanSheet: true, penaltySaves: 1 }).points).toBe(9);
    expect(scoreFantasyPlayerMatch({ position: "FWD", goals: 1, yellowCards: 1, penaltyMisses: 1 }).points).toBe(1);
  });

  it("normalizes player positions into fantasy buckets", () => {
    expect(normalizeFantasyPosition("GK")).toBe("GK");
    expect(normalizeFantasyPosition("RB")).toBe("DEF");
    expect(normalizeFantasyPosition("CM")).toBe("MID");
    expect(normalizeFantasyPosition("LW")).toBe("FWD");
  });

  it("includes full player catalog rows in fantasy options", () => {
    const options = fantasyPlayerOptions([
      {
        id: "spain-test-goalkeeper",
        teamId: "spain",
        name: "Test Goalkeeper",
        position: "Goalkeeper",
        photoUrl: null
      }
    ]);

    expect(options).toEqual(expect.arrayContaining([expect.objectContaining({ id: "spain-test-goalkeeper", fantasyPosition: "GK" })]));
  });

  it("does not duplicate curated watchlist players when ESPN/catalog has the same player", () => {
    const options = fantasyPlayerOptions([
      {
        id: "spain-362150",
        teamId: "spain",
        name: "Lamine Yamal",
        position: "Forward",
        shirtNumber: 19
      }
    ]);
    const yamalOptions = options.filter((option) => option.team.id === "spain" && option.name === "Lamine Yamal");

    expect(yamalOptions).toHaveLength(1);
    expect(yamalOptions[0].id).toBe("spain-362150");
    expect(yamalOptions[0].aliasIds).toContain("spain-lamine-yamal");
    expect(yamalOptions[0].photoUrl).toBe("/players/lamine-yamal.jpg");

    const optionMap = fantasyOptionMap([
      {
        id: "spain-362150",
        teamId: "spain",
        name: "Lamine Yamal",
        position: "Forward",
        shirtNumber: 19
      }
    ]);
    expect(optionMap.get("spain-lamine-yamal")?.id).toBe("spain-362150");
  });

  it("keeps every team fantasy-eligible and replaces bad Czechia rows with ESPN rows", () => {
    const merged = mergePlayerCatalog(
      [
        {
          id: "czechia-wrong-player",
          teamId: "czechia",
          name: "Wrong Czechia Player",
          position: "Forward"
        }
      ],
      Array.from({ length: COMPLETE_SQUAD_MINIMUM }, (_item, index) => ({
        id: `czechia-espn-${index}`,
        teamId: "czechia",
        name: `Czechia ESPN Player ${index + 1}`,
        position: index === 0 ? "Goalkeeper" : index < 6 ? "Defender" : index < 11 ? "Midfielder" : "Forward"
      }))
    );

    const czechiaPlayers = merged.filter((player) => player.teamId === "czechia");
    const canadaPlayers = merged.filter((player) => player.teamId === "canada");

    expect(czechiaPlayers.length).toBeGreaterThanOrEqual(COMPLETE_SQUAD_MINIMUM);
    expect(czechiaPlayers.some((player) => player.name === "Wrong Czechia Player")).toBe(false);
    expect(canadaPlayers.length).toBeGreaterThanOrEqual(COMPLETE_SQUAD_MINIMUM);
  });

  it("fills duplicate catalog photos from curated team profile photos", () => {
    const merged = mergePlayerCatalog([
      {
        id: "spain-362150",
        teamId: "spain",
        name: "Lamine Yamal",
        position: "Forward",
        photoUrl: null
      }
    ]);
    const yamal = merged.find((player) => player.id === "spain-362150");

    expect(yamal?.photoUrl).toBe("/players/lamine-yamal.jpg");
  });

  it("builds player match scores from final matches and captain leaderboard totals", () => {
    const match = {
      ...INITIAL_MATCHES.find((item) => item.homeTeamId === "spain" && item.awayTeamId === "cabo-verde")!,
      status: "final" as const,
      homeScore: 2,
      awayScore: 0
    };
    const stats: PlayerMatchStat[] = [
      {
        matchId: match.id,
        playerId: "spain-lamine-yamal",
        playerName: "Lamine Yamal",
        teamId: "spain",
        goals: 1,
        assists: 1
      }
    ];
    const scores = buildFantasyScoresFromMatches([match], stats);
    const yamal = scores.find((score) => score.playerId === "spain-lamine-yamal");
    expect(yamal?.points).toBe(7);

    const roster: FantasyRosterSlot[] = [
      {
        userKey: "tata",
        playerId: "spain-lamine-yamal",
        roundId: FANTASY_ROUND_ID,
        slotIndex: 0,
        isStarter: true,
        isCaptain: true,
        isViceCaptain: false
      }
    ];

    expect(buildFantasyLeaderboard(roster, scores)[0]).toMatchObject({
      userKey: "tata",
      points: 14,
      captainPoints: 7
    });

    const legacyRoster: FantasyRosterSlot[] = [
      {
        userKey: "tata",
        playerId: "spain-lamine-yamal",
        roundId: FANTASY_ROUND_ID,
        slotIndex: 0,
        isStarter: true,
        isCaptain: true,
        isViceCaptain: false
      }
    ];
    const espnScores = [{ ...scores[0]!, playerId: "spain-362150" }];
    expect(
      buildFantasyLeaderboard(legacyRoster, espnScores, [
        {
          id: "spain-362150",
          teamId: "spain",
          name: "Lamine Yamal",
          position: "Forward",
          shirtNumber: 19
        }
      ])[0]
    ).toMatchObject({
      userKey: "tata",
      points: 14,
      captainPoints: 7
    });

    const espnRoster: FantasyRosterSlot[] = [
      {
        userKey: "tata",
        playerId: "spain-362150",
        roundId: FANTASY_ROUND_ID,
        slotIndex: 0,
        isStarter: true,
        isCaptain: true,
        isViceCaptain: false
      }
    ];
    expect(
      buildFantasyLeaderboard(espnRoster, scores, [
        {
          id: "spain-362150",
          teamId: "spain",
          name: "Lamine Yamal",
          position: "Forward",
          shirtNumber: 19
        }
      ])[0]
    ).toMatchObject({
      userKey: "tata",
      points: 14,
      captainPoints: 7
    });
  });

  it("does not award fallback clean-sheet points to untracked squad players", () => {
    const match = {
      ...INITIAL_MATCHES.find((item) => item.homeTeamId === "spain" && item.awayTeamId === "cabo-verde")!,
      status: "final" as const,
      homeScore: 2,
      awayScore: 0
    };

    expect(buildFantasyScoresFromMatches([match], []).find((score) => score.playerId === "spain-unai-simon")).toBeUndefined();

    const scores = buildFantasyScoresFromMatches(
      [match],
      [
        {
          matchId: match.id,
          playerId: "spain-unai-simon",
          playerName: "Unai Simon",
          teamId: "spain",
          goals: 0,
          assists: 0
        }
      ]
    );

    expect(scores.find((score) => score.playerId === "spain-unai-simon")).toMatchObject({
      points: 4,
      cleanSheet: true
    });
  });

  it("awards goal and assist points from player stats before a match is final", () => {
    const match = {
      ...INITIAL_MATCHES.find((item) => item.homeTeamId === "usa" && item.awayTeamId === "paraguay")!,
      status: "live" as const,
      homeScore: 1,
      awayScore: 0
    };

    const scores = buildFantasyScoresFromMatches(
      [match],
      [
        {
          matchId: match.id,
          playerId: "usa-christian-pulisic",
          playerName: "Christian Pulisic",
          teamId: "usa",
          goals: 0,
          assists: 1
        }
      ]
    );

    expect(scores.find((score) => score.playerId === "usa-christian-pulisic")).toMatchObject({
      points: 3,
      assists: 1,
      cleanSheet: false
    });
  });

  it("matches player stats by team and player name when provider ids differ", () => {
    const messiMatch = {
      ...INITIAL_MATCHES.find((item) => item.homeTeamId === "argentina" && item.awayTeamId === "algeria")!,
      status: "live" as const,
      homeScore: 3,
      awayScore: 1
    };
    const pulisicMatch = {
      ...INITIAL_MATCHES.find((item) => item.homeTeamId === "usa" && item.awayTeamId === "paraguay")!,
      status: "live" as const,
      homeScore: 1,
      awayScore: 0
    };

    const scores = buildFantasyScoresFromMatches(
      [messiMatch, pulisicMatch],
      [
        {
          matchId: messiMatch.id,
          playerId: "argentina-messi",
          playerName: "Lionel Messi",
          teamId: "argentina",
          goals: 3,
          assists: 0
        },
        {
          matchId: pulisicMatch.id,
          playerId: "usa-pulisic",
          playerName: "Christian Pulisic",
          teamId: "usa",
          goals: 0,
          assists: 1
        }
      ]
    );

    expect(scores.find((score) => score.playerId === "argentina-lionel-messi")).toMatchObject({
      points: 15,
      goals: 3
    });
    expect(scores.find((score) => score.playerId === "usa-christian-pulisic")).toMatchObject({
      points: 3,
      assists: 1
    });
  });

  it("generates unique canonical player aliases across teams", () => {
    expect(resolveFantasyPlayerOption({ teamId: "argentina", playerName: "L. Messi" })?.id).toBe("argentina-lionel-messi");
    expect(resolveFantasyPlayerOption({ teamId: "england", playerName: "Kane" })?.id).toBe("england-harry-kane");
    expect(resolveFantasyPlayerOption({ teamId: "canada", playerName: "J. David" })?.id).toBe("canada-jonathan-david");

    expect(fantasyScoreIdsForPlayer("argentina-lionel-messi")).toEqual(
      expect.arrayContaining(["argentina-lionel-messi", "argentina-l-messi", "argentina-messi"])
    );
    expect(fantasyScoreIdsForPlayer("england-harry-kane")).toEqual(
      expect.arrayContaining(["england-harry-kane", "england-h-kane", "england-kane"])
    );
  });

  it("scores star players from reliable canonical aliases for any team", () => {
    const messiMatch = {
      ...INITIAL_MATCHES.find((item) => item.homeTeamId === "argentina" && item.awayTeamId === "algeria")!,
      status: "live" as const,
      homeScore: 3,
      awayScore: 1
    };
    const kaneMatch = {
      ...INITIAL_MATCHES.find((item) => item.homeTeamId === "england" && item.awayTeamId === "croatia")!,
      status: "live" as const,
      homeScore: 2,
      awayScore: 0
    };
    const scores = buildFantasyScoresFromMatches(
      [messiMatch, kaneMatch],
      [
        {
          matchId: messiMatch.id,
          playerId: "argentina-l-messi",
          playerName: "L. Messi",
          teamId: "argentina",
          goals: 3,
          assists: 0
        },
        {
          matchId: kaneMatch.id,
          playerId: "england-kane",
          playerName: "Kane",
          teamId: "england",
          goals: 2,
          assists: 0
        }
      ]
    );

    expect(scores.find((score) => score.playerId === "argentina-lionel-messi")).toMatchObject({
      points: 15,
      goals: 3
    });
    expect(scores.find((score) => score.playerId === "england-harry-kane")).toMatchObject({
      points: 8,
      goals: 2
    });
  });

  it("merges provider middle-name catalog rows with curated fantasy stars", () => {
    const playerCatalog = [
      {
        id: "argentina-45843",
        teamId: "argentina",
        name: "Lionel Andres Messi",
        position: "Forward"
      },
      {
        id: "england-39836",
        teamId: "england",
        name: "Harry Edward Kane",
        position: "Forward"
      }
    ];
    const messiMatch = {
      ...INITIAL_MATCHES.find((item) => item.homeTeamId === "argentina" && item.awayTeamId === "algeria")!,
      status: "live" as const,
      homeScore: 3,
      awayScore: 1
    };
    const kaneMatch = {
      ...INITIAL_MATCHES.find((item) => item.homeTeamId === "england" && item.awayTeamId === "croatia")!,
      status: "live" as const,
      homeScore: 2,
      awayScore: 0
    };
    const scores = buildFantasyScoresFromMatches(
      [messiMatch, kaneMatch],
      [
        {
          matchId: messiMatch.id,
          playerId: "argentina-45843",
          playerName: "Lionel Andres Messi",
          teamId: "argentina",
          goals: 3,
          assists: 0
        },
        {
          matchId: kaneMatch.id,
          playerId: "england-kane",
          playerName: "Kane",
          teamId: "england",
          goals: 2,
          assists: 0
        }
      ],
      playerCatalog
    );

    expect(fantasyScoreIdsForPlayer("argentina-lionel-messi", playerCatalog)).toEqual(
      expect.arrayContaining(["argentina-45843", "argentina-lionel-messi", "argentina-messi"])
    );
    expect(scores.find((score) => fantasyScoreIdsForPlayer("argentina-lionel-messi", playerCatalog).includes(score.playerId))).toMatchObject({
      points: 12,
      goals: 3
    });
    expect(scores.find((score) => fantasyScoreIdsForPlayer("england-harry-kane", playerCatalog).includes(score.playerId))).toMatchObject({
      points: 8,
      goals: 2
    });
    expect(fantasyPlayerTotals("argentina-lionel-messi", scores, playerCatalog)).toMatchObject({
      points: 12,
      goals: 3
    });
    expect(
      buildFantasyLeaderboard(
        [
          {
            userKey: "tata",
            playerId: "argentina-lionel-messi",
            roundId: FANTASY_ROUND_ID,
            slotIndex: 0,
            isStarter: true,
            isCaptain: false,
            isViceCaptain: false
          }
        ],
        scores,
        playerCatalog
      ).find((row) => row.userKey === "tata")
    ).toMatchObject({
      points: 12
    });
  });

  it("scores legacy manual stat rows with team names and player-name ids", () => {
    const match = {
      ...INITIAL_MATCHES.find((item) => item.homeTeamId === "argentina" && item.awayTeamId === "algeria")!,
      status: "live" as const,
      homeScore: 3,
      awayScore: 1
    };
    const scores = buildFantasyScoresFromMatches(
      [match],
      [
        {
          matchId: match.id,
          playerId: "Lionel Messi",
          playerName: "Messi, Lionel",
          teamId: "Argentina",
          goals: 3,
          assists: 0
        }
      ]
    );

    expect(scores.find((score) => score.playerId === "argentina-lionel-messi")).toMatchObject({
      points: 15,
      goals: 3
    });
  });

  it("scores provider-shaped stat rows when names uniquely identify the player", () => {
    const match = {
      ...INITIAL_MATCHES.find((item) => item.homeTeamId === "argentina" && item.awayTeamId === "algeria")!,
      status: "live" as const,
      homeScore: 3,
      awayScore: 1
    };
    const scores = buildFantasyScoresFromMatches(
      [match],
      [
        {
          matchId: match.id,
          playerId: "45843",
          playerName: "Lionel Messi",
          teamId: "202",
          goals: 3,
          assists: 0
        }
      ]
    );

    expect(resolveFantasyPlayerOption({ playerId: "45843", playerName: "Lionel Messi", teamId: "202" })?.id).toBe(
      "argentina-lionel-messi"
    );
    expect(scores.find((score) => score.playerId === "argentina-lionel-messi")).toMatchObject({
      points: 15,
      goals: 3
    });
    expect(fantasyPlayerTotals("argentina-lionel-messi", scores)).toMatchObject({
      points: 15,
      goals: 3
    });
  });

  it("scores fantasy rosters saved with provider ids when catalog rows are unavailable", () => {
    const scores = [
      {
        matchId: "m-provider",
        playerId: "argentina-lionel-messi",
        teamId: "argentina",
        points: 15,
        goals: 3,
        assists: 0,
        cleanSheet: false,
        yellowCards: 0,
        redCards: 0,
        ownGoals: 0,
        penaltySaves: 0,
        penaltyMisses: 0,
        breakdown: { goals: 15 },
        status: "confirmed" as const
      }
    ];

    expect(resolveFantasyPlayerOption({ playerId: "argentina-45843" })?.id).toBe("argentina-lionel-messi");
    expect(fantasyPlayerTotals("argentina-45843", scores)).toMatchObject({
      points: 15,
      goals: 3
    });
    expect(
      buildFantasyLeaderboard(
        [
          {
            userKey: "tata",
            playerId: "argentina-45843",
            roundId: FANTASY_ROUND_ID,
            slotIndex: 0,
            isStarter: true,
            isCaptain: false,
            isViceCaptain: false
          }
        ],
        scores
      ).find((row) => row.userKey === "tata")
    ).toMatchObject({
      points: 15
    });
  });

  it("scores stat rows even when the match id is provider-shaped", () => {
    const scores = buildFantasyScoresFromMatches(
      INITIAL_MATCHES,
      [
        {
          matchId: "provider-argentina-messi-legacy",
          playerId: "Lionel Messi",
          playerName: "Messi, Lionel",
          teamId: "Argentina",
          goals: 3,
          assists: 0
        }
      ]
    );

    expect(scores.find((score) => score.playerId === "argentina-lionel-messi")).toMatchObject({
      matchId: "provider-argentina-messi-legacy",
      points: 15,
      goals: 3
    });
  });

  it("scores resolved stat goals even when match participants are stale", () => {
    const staleMatch = {
      ...INITIAL_MATCHES.find((item) => item.homeTeamId === "mexico" && item.awayTeamId === "south-africa")!,
      status: "final" as const,
      homeScore: 1,
      awayScore: 0
    };
    const scores = buildFantasyScoresFromMatches(
      [staleMatch],
      [
        {
          matchId: staleMatch.id,
          playerId: "argentina-lionel-messi",
          playerName: "Lionel Messi",
          teamId: "argentina",
          goals: 3,
          assists: 0
        }
      ]
    );

    expect(scores.find((score) => score.playerId === "argentina-lionel-messi")).toMatchObject({
      points: 15,
      goals: 3
    });
    expect(fantasyPlayerTotals("argentina-lionel-messi", scores)).toMatchObject({
      points: 15,
      goals: 3
    });
  });

  it("scores Lucas roster players from shortened stat names", () => {
    const messiMatch = {
      ...INITIAL_MATCHES.find((item) => item.homeTeamId === "argentina" && item.awayTeamId === "algeria")!,
      status: "live" as const,
      homeScore: 3,
      awayScore: 1
    };
    const davidMatch = {
      ...INITIAL_MATCHES.find((item) => item.homeTeamId === "canada")!,
      status: "live" as const,
      homeScore: 3,
      awayScore: 0
    };
    const pulisicMatch = {
      ...INITIAL_MATCHES.find((item) => item.homeTeamId === "usa" && item.awayTeamId === "paraguay")!,
      status: "live" as const,
      homeScore: 1,
      awayScore: 0
    };
    const scores = buildFantasyScoresFromMatches(
      [messiMatch, davidMatch, pulisicMatch],
      [
        {
          matchId: messiMatch.id,
          playerId: "argentina-messi",
          playerName: "Messi",
          teamId: "argentina",
          goals: 3,
          assists: 0
        },
        {
          matchId: davidMatch.id,
          playerId: "canada-j-david",
          playerName: "J. David",
          teamId: "canada",
          goals: 3,
          assists: 0
        },
        {
          matchId: pulisicMatch.id,
          playerId: "usa-pulisic",
          playerName: "Pulisic",
          teamId: "usa",
          goals: 0,
          assists: 1
        }
      ]
    );

    const roster: FantasyRosterSlot[] = [
      {
        userKey: "lucas",
        playerId: "argentina-lionel-messi",
        roundId: FANTASY_ROUND_ID,
        slotIndex: 0,
        isStarter: true,
        isCaptain: false,
        isViceCaptain: false
      },
      {
        userKey: "lucas",
        playerId: "canada-jonathan-david",
        roundId: FANTASY_ROUND_ID,
        slotIndex: 1,
        isStarter: true,
        isCaptain: false,
        isViceCaptain: false
      },
      {
        userKey: "lucas",
        playerId: "usa-christian-pulisic",
        roundId: FANTASY_ROUND_ID,
        slotIndex: 2,
        isStarter: true,
        isCaptain: true,
        isViceCaptain: false
      }
    ];

    expect(scores.find((score) => score.playerId === "argentina-lionel-messi")).toMatchObject({
      points: 15,
      goals: 3
    });
    expect(scores.find((score) => score.playerId === "canada-jonathan-david")).toMatchObject({
      points: 12,
      goals: 3
    });
    expect(buildFantasyLeaderboard(roster, scores).find((row) => row.userKey === "lucas")).toMatchObject({
      points: 33,
      captainPoints: 3
    });
  });

  it("lets current stat-derived fantasy scores replace stale stored rows", () => {
    const match = {
      ...INITIAL_MATCHES.find((item) => item.homeTeamId === "argentina" && item.awayTeamId === "algeria")!,
      status: "final" as const,
      homeScore: 3,
      awayScore: 1
    };
    const derived = buildFantasyScoresFromMatches(
      [match],
      [
        {
          matchId: match.id,
          playerId: "argentina-lionel-messi",
          playerName: "Lionel Messi",
          teamId: "argentina",
          goals: 3,
          assists: 0
        }
      ]
    );
    const staleStored = [{ ...derived[0]!, points: 0, goals: 0, breakdown: {} }];

    expect(mergeFantasyScores(staleStored, derived).find((score) => score.playerId === "argentina-lionel-messi")).toMatchObject({
      points: 15,
      goals: 3
    });
  });

  it("repairs stored fantasy score rows that have goals but stale zero points", () => {
    const repaired = mergeFantasyScores(
      [
        {
          matchId: "m19",
          playerId: "Lionel Messi",
          teamId: "Argentina",
          points: 0,
          goals: 3,
          assists: 0,
          cleanSheet: false,
          yellowCards: 0,
          redCards: 0,
          ownGoals: 0,
          penaltySaves: 0,
          penaltyMisses: 0,
          breakdown: {},
          status: "confirmed"
        }
      ],
      []
    );

    expect(repaired[0]).toMatchObject({
      playerId: "argentina-lionel-messi",
      teamId: "argentina",
      points: 15,
      goals: 3,
      breakdown: expect.objectContaining({ goals: 15 })
    });
  });

  it("rejects duplicate fantasy roster players", () => {
    const slots: FantasyRosterSlot[] = [
      {
        userKey: "lucas",
        playerId: "spain-lamine-yamal",
        roundId: FANTASY_ROUND_ID,
        slotIndex: 0,
        isStarter: true,
        isCaptain: true,
        isViceCaptain: false
      },
      {
        userKey: "lucas",
        playerId: "spain-lamine-yamal",
        roundId: FANTASY_ROUND_ID,
        slotIndex: 1,
        isStarter: true,
        isCaptain: false,
        isViceCaptain: true
      }
    ];

    expect(validateFantasyRoster(slots, INITIAL_MATCHES, new Date("2026-06-01T12:00:00.000Z"))).toContain("duplicate");
  });

  it("keeps all 15 players when a starter is moved to a fifth bench spot", () => {
    const slots: FantasyRosterSlot[] = [
      ...Array.from({ length: 10 }, (_item, index) => ({
        userKey: "tata" as const,
        playerId: `starter-${index}`,
        roundId: FANTASY_ROUND_ID,
        slotIndex: index,
        isStarter: true,
        isCaptain: index === 0,
        isViceCaptain: false
      })),
      ...Array.from({ length: 5 }, (_item, index) => ({
        userKey: "tata" as const,
        playerId: index === 4 ? "usa-christian-pulisic" : `bench-${index}`,
        roundId: FANTASY_ROUND_ID,
        slotIndex: 11 + index,
        isStarter: false,
        isCaptain: false,
        isViceCaptain: false
      }))
    ];

    const normalized = normalizeFantasyRosterSlots(slots, "tata");
    const slotIndexes = new Set(normalized.map((slot) => slot.slotIndex));

    expect(normalized).toHaveLength(15);
    expect(slotIndexes).toHaveLength(15);
    expect(normalized.filter((slot) => !slot.isStarter)).toHaveLength(5);
    expect(normalized.some((slot) => slot.playerId === "usa-christian-pulisic")).toBe(true);
    expect(normalized.every((slot) => slot.slotIndex >= 0 && slot.slotIndex < 15)).toBe(true);
  });
});
