import { describe, expect, it } from "vitest";
import {
  FANTASY_ROUND_ID,
  buildFantasyLeaderboard,
  buildFantasyOverallLeaderboard,
  buildFantasyRoundResults,
  buildFantasyScoresFromMatches,
  fantasyFormationLimitMessage,
  fantasyRoundStates,
  eligibleTeamIdsForFantasyRound,
  fantasyOptionMap,
  fantasyPlayerTotals,
  fantasyPlayerOptions,
  fantasyScoreIdsForPlayer,
  isFantasyKnockoutRound,
  mergeFantasyScores,
  normalizeFantasyRosterSlots,
  normalizeFantasyPosition,
  rostersForFantasyRound,
  scoresForFantasyRound,
  resolveFantasyPlayerOption,
  scoreFantasyPlayerMatch,
  trimFantasyRosterToFormation,
  validateFantasyRoster
} from "@/lib/fantasy";
import { applyKnownPlayerStatCorrections } from "@/lib/fantasy-stat-corrections";
import { COMPLETE_SQUAD_MINIMUM, mergePlayerCatalog } from "@/lib/player-catalog";
import { getAllPlayerProfiles } from "@/lib/profile-data";
import { INITIAL_MATCHES } from "@/lib/tournament-data";
import type { FantasyPlayerMatchScore, FantasyRosterSlot, PlayerCatalogItem, PlayerMatchStat } from "@/lib/types";

describe("mini-fantasy scoring", () => {
  it("scores goals by fantasy position and adds assists and clean sheets", () => {
    expect(scoreFantasyPlayerMatch({ position: "FWD", goals: 1 }).points).toBe(4);
    expect(scoreFantasyPlayerMatch({ position: "MID", goals: 1, assists: 1, cleanSheet: true }).points).toBe(9);
    expect(scoreFantasyPlayerMatch({ position: "DEF", goals: 1, cleanSheet: true }).points).toBe(10);
    expect(scoreFantasyPlayerMatch({ position: "GK", cleanSheet: true, penaltySaves: 1 }).points).toBe(9);
    expect(scoreFantasyPlayerMatch({ position: "FWD", goals: 1, yellowCards: 1, penaltyMisses: 1 }).points).toBe(1);
    expect(scoreFantasyPlayerMatch({ position: "DEF", teamResult: "win", goalsConceded: 1 }).points).toBe(3);
    expect(scoreFantasyPlayerMatch({ position: "GK", cleanSheet: true, teamResult: "draw", goalsConceded: 0 }).points).toBe(5);
  });

  it("normalizes player positions into fantasy buckets", () => {
    expect(normalizeFantasyPosition("GK")).toBe("GK");
    expect(normalizeFantasyPosition("RB")).toBe("DEF");
    expect(normalizeFantasyPosition("CM")).toBe("MID");
    expect(normalizeFantasyPosition("LW")).toBe("FWD");
  });

  it("limits future knockout fantasy picks to teams still alive", () => {
    const matches = INITIAL_MATCHES.map((match) => {
      if (match.id === "M73") {
        return {
          ...match,
          homeTeamId: "south-africa",
          awayTeamId: "canada",
          homeScore: 0,
          awayScore: 1,
          status: "final" as const
        };
      }
      if (match.id === "M90") {
        return {
          ...match,
          homeTeamId: "canada"
        };
      }
      return match;
    });

    const eligible = eligibleTeamIdsForFantasyRound(matches, {
      id: "round16",
      phases: ["round16"],
      matchCount: 8
    });

    expect(eligible.has("canada")).toBe(true);
    expect(eligible.has("south-africa")).toBe(false);
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
    expect(yamalOptions[0].photoUrl).toBe("/players/spain-lamine-yamal-2026.jpg");

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

    expect(yamal?.photoUrl).toBe("/players/spain-lamine-yamal-2026.jpg");
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
    expect(yamal?.points).toBe(9);

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
      points: 18,
      captainPoints: 9
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
    expect(resolveFantasyPlayerOption({ playerId: "spain-362150" })?.id).toBe("spain-lamine-yamal");
    expect(buildFantasyLeaderboard(legacyRoster, espnScores)[0]).toMatchObject({
      userKey: "tata",
      points: 18,
      captainPoints: 9
    });
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
      points: 18,
      captainPoints: 9
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
      points: 18,
      captainPoints: 9
    });
  });

  it("keeps legacy global rosters as Group Stage rosters and separates round scoring", () => {
    const matches = INITIAL_MATCHES.map((match) =>
      match.phase === "group" ? { ...match, status: "final" as const, homeScore: 0, awayScore: 0 } : match
    );
    const rosters: FantasyRosterSlot[] = [
      {
        userKey: "lucas",
        playerId: "spain-lamine-yamal",
        roundId: "global",
        slotIndex: 0,
        isStarter: true,
        isCaptain: false,
        isViceCaptain: false
      },
      {
        userKey: "tata",
        playerId: "argentina-lionel-messi",
        roundId: "global",
        slotIndex: 0,
        isStarter: true,
        isCaptain: false,
        isViceCaptain: false
      },
      {
        userKey: "tata",
        playerId: "england-harry-kane",
        roundId: "round32",
        slotIndex: 0,
        isStarter: true,
        isCaptain: false,
        isViceCaptain: false
      }
    ];
    const scores: FantasyPlayerMatchScore[] = [
      {
        matchId: "M37",
        playerId: "spain-lamine-yamal",
        teamId: "spain",
        points: 4,
        goals: 1,
        assists: 0,
        cleanSheet: false,
        yellowCards: 0,
        redCards: 0,
        ownGoals: 0,
        penaltySaves: 0,
        penaltyMisses: 0,
        breakdown: { goals: 4 },
        status: "confirmed"
      },
      {
        matchId: "M73",
        playerId: "england-harry-kane",
        teamId: "england",
        points: 8,
        goals: 2,
        assists: 0,
        cleanSheet: false,
        yellowCards: 0,
        redCards: 0,
        ownGoals: 0,
        penaltySaves: 0,
        penaltyMisses: 0,
        breakdown: { goals: 8 },
        status: "confirmed"
      }
    ];

    expect(rostersForFantasyRound("group", rosters).map((slot) => slot.roundId)).toEqual(["group", "group"]);
    expect(scoresForFantasyRound("group", scores, matches)).toHaveLength(1);
    expect(scoresForFantasyRound("round32", scores, matches)).toHaveLength(1);

    const roundResults = buildFantasyRoundResults(rosters, scores, matches);
    const groupRound = roundResults.find((round) => round.id === "group");
    const overall = buildFantasyOverallLeaderboard(roundResults, "group");

    expect(groupRound).toMatchObject({
      status: "complete",
      winner: expect.objectContaining({ userKey: "lucas", points: 4 })
    });
    expect(overall.find((row) => row.userKey === "lucas")).toMatchObject({ roundWins: 1 });
    expect(overall.find((row) => row.userKey === "tata")).toMatchObject({ roundWins: 0 });
  });

  it("opens future knockout squads before each round kickoff", () => {
    const states = fantasyRoundStates(INITIAL_MATCHES, new Date("2026-06-20T12:00:00.000Z"));
    const editableRounds = states.filter((round) => round.selectionEnabled).map((round) => round.id);

    expect(editableRounds).toEqual(["round32", "round16", "quarter", "semi", "final"]);
  });

  it("limits knockout fantasy squads to 11 players", () => {
    const slots: FantasyRosterSlot[] = Array.from({ length: 12 }, (_item, index) => ({
      userKey: "tata",
      playerId: `player-${index}`,
      roundId: "round32",
      slotIndex: index,
      isStarter: index < 11,
      isCaptain: index === 0,
      isViceCaptain: index === 1
    }));

    expect(validateFantasyRoster(slots, INITIAL_MATCHES)).toBe("Pick no more than 11 players.");
    expect(normalizeFantasyRosterSlots(slots, "tata", "round32")).toHaveLength(11);
  });

  it("treats every post-group fantasy round as knockout-only squad selection", () => {
    expect(isFantasyKnockoutRound("group")).toBe(false);
    expect(isFantasyKnockoutRound("round32")).toBe(true);
    expect(isFantasyKnockoutRound("round16")).toBe(true);
    expect(isFantasyKnockoutRound("quarter")).toBe(true);
    expect(isFantasyKnockoutRound("semi")).toBe(true);
    expect(isFantasyKnockoutRound("final")).toBe(true);
  });

  it("uses the newest duplicate player stat instead of preserving inflated older rows", () => {
    const match = {
      ...INITIAL_MATCHES.find((item) => item.id === "M3")!,
      homeTeamId: "canada",
      awayTeamId: "qatar",
      homeScore: 3,
      awayScore: 0,
      status: "final" as const
    };
    const scores = buildFantasyScoresFromMatches(
      [match],
      [
        {
          matchId: "M3",
          playerId: "canada-8489",
          playerName: "Jonathan David",
          teamId: "canada",
          goals: 9,
          assists: 0,
          updatedAt: "2026-06-20T10:00:00.000Z"
        },
        {
          matchId: "M3",
          playerId: "canada-jonathan-david",
          playerName: "Jonathan David",
          teamId: "canada",
          goals: 3,
          assists: 0,
          updatedAt: "2026-06-20T11:00:00.000Z"
        }
      ]
    );

    expect(scores.find((score) => score.playerId === "canada-jonathan-david")).toMatchObject({ goals: 3 });
  });

  it("allows every curated player from every team to receive fantasy points", () => {
    const profiles = getAllPlayerProfiles();
    const stats = profiles.map(({ player, team }, index) => {
      const match = INITIAL_MATCHES.find((item) => item.homeTeamId === team.id || item.awayTeamId === team.id);
      return {
        matchId: match?.id ?? `team-${team.id}`,
        playerId: `${team.id}-provider-${index}`,
        playerName: player.name,
        teamId: team.id,
        goals: 1,
        assists: 1
      } satisfies PlayerMatchStat;
    });
    const scores = buildFantasyScoresFromMatches(INITIAL_MATCHES, stats);
    const missing = profiles
      .filter(({ player }) => fantasyPlayerTotals(player.id, scores).points <= 0)
      .map(({ player, team }) => `${team.id}:${player.name}`);

    expect(missing).toEqual([]);
  });

  it("awards final-match team context points to catalog players", () => {
    const match = {
      ...INITIAL_MATCHES.find((item) => item.homeTeamId === "spain" && item.awayTeamId === "cabo-verde")!,
      status: "final" as const,
      homeScore: 2,
      awayScore: 0
    };
    const playerCatalog: PlayerCatalogItem[] = [
      { id: "spain-unai-simon", teamId: "spain", name: "Unai Simon", position: "Goalkeeper" }
    ];

    expect(buildFantasyScoresFromMatches([match], []).find((score) => score.playerId === "spain-unai-simon")).toBeUndefined();
    expect(buildFantasyScoresFromMatches([match], [], playerCatalog).find((score) => score.playerId === "spain-unai-simon")).toMatchObject({
      points: 6,
      cleanSheet: true,
      breakdown: expect.objectContaining({ cleanSheet: 4, teamResult: 2 })
    });

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
      ],
      playerCatalog
    );

    expect(scores.find((score) => score.playerId === "spain-unai-simon")).toMatchObject({
      points: 6,
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
    const scores: FantasyPlayerMatchScore[] = [
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
      },
      {
        matchId: "m-provider-usa",
        playerId: "usa-christian-pulisic",
        teamId: "usa",
        points: 3,
        goals: 0,
        assists: 1,
        cleanSheet: false,
        yellowCards: 0,
        redCards: 0,
        ownGoals: 0,
        penaltySaves: 0,
        penaltyMisses: 0,
        breakdown: { assists: 3 },
        status: "confirmed" as const
      }
    ];

    expect(resolveFantasyPlayerOption({ playerId: "argentina-45843" })?.id).toBe("argentina-lionel-messi");
    expect(resolveFantasyPlayerOption({ playerId: "argentina-154" })?.id).toBe("argentina-lionel-messi");
    expect(resolveFantasyPlayerOption({ playerId: "canada-8489" })?.id).toBe("canada-jonathan-david");
    expect(resolveFantasyPlayerOption({ playerId: "england-184" })?.id).toBe("england-harry-kane");
    expect(resolveFantasyPlayerOption({ playerId: "usa-225607" })?.id).toBe("usa-christian-pulisic");
    expect(fantasyPlayerTotals("argentina-45843", scores)).toMatchObject({
      points: 15,
      goals: 3
    });
    expect(fantasyPlayerTotals("argentina-154", scores)).toMatchObject({
      points: 15,
      goals: 3
    });
    expect(fantasyPlayerTotals("usa-225607", scores)).toMatchObject({
      points: 3,
      assists: 1
    });
    expect(
      fantasyPlayerTotals("canada-8489", [
        {
          matchId: "m-provider-canada",
          playerId: "canada-jonathan-david",
          teamId: "canada",
          points: 12,
          goals: 3,
          assists: 0,
          cleanSheet: false,
          yellowCards: 0,
          redCards: 0,
          ownGoals: 0,
          penaltySaves: 0,
          penaltyMisses: 0,
          breakdown: { goals: 12 },
          status: "confirmed" as const
        }
      ])
    ).toMatchObject({
      points: 12,
      goals: 3
    });
    expect(
      buildFantasyLeaderboard(
        [
          {
            userKey: "tata",
            playerId: "argentina-154",
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

  it("applies user-confirmed scorer corrections when production stats are missing", () => {
    const matches = INITIAL_MATCHES.map((match) => {
      if (match.id === "M19") {
        return { ...match, status: "final" as const, homeScore: 3, awayScore: 1 };
      }
      if (match.id === "M3") {
        return { ...match, status: "final" as const, homeScore: 3, awayScore: 0 };
      }
      if (match.id === "M37") {
        return { ...match, status: "final" as const, homeScore: 4, awayScore: 0 };
      }
      if (match.id === "M39") {
        return { ...match, status: "final" as const, homeScore: 0, awayScore: 0 };
      }
      return match;
    });
    const playerCatalog = [
      {
        id: "belgium-730",
        teamId: "belgium",
        name: "T. Courtois",
        position: "Goalkeeper"
      },
      {
        id: "ir-iran-2682",
        teamId: "ir-iran",
        name: "A. Beiranvand",
        position: "Goalkeeper"
      }
    ];
    const stats = applyKnownPlayerStatCorrections(matches, [], playerCatalog, new Date("2026-06-22T12:00:00.000Z"));
    const scores = buildFantasyScoresFromMatches(matches, stats, playerCatalog);

    expect(stats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ playerId: "argentina-lionel-messi", goals: 3 }),
        expect.objectContaining({ playerId: "canada-jonathan-david", goals: 3 }),
        expect.objectContaining({ playerId: "spain-lamine-yamal", goals: 1 }),
        expect.objectContaining({ playerId: "belgium-730", goals: 0, assists: 0 }),
        expect.objectContaining({ playerId: "ir-iran-2682", goals: 0, assists: 0 })
      ])
    );
    expect(fantasyPlayerTotals("argentina-lionel-messi", scores)).toMatchObject({
      points: 17,
      goals: 3
    });
    expect(fantasyPlayerTotals("canada-8489", scores)).toMatchObject({
      points: 14,
      goals: 3
    });
    expect(fantasyPlayerTotals("spain-362150", scores)).toMatchObject({
      points: 6,
      goals: 1
    });
    expect(fantasyPlayerTotals("belgium-730", scores, playerCatalog)).toMatchObject({
      points: 5,
      cleanSheets: 1
    });
    expect(fantasyPlayerTotals("ir-iran-2682", scores, playerCatalog)).toMatchObject({
      points: 5,
      cleanSheets: 1
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
      points: 17,
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

  it("keeps future knockout rosters position-free even when formation would normally be over cap", () => {
    const playerCatalog: PlayerCatalogItem[] = [
      { id: "gk-1", teamId: "canada", name: "Keeper One", position: "Goalkeeper" },
      { id: "def-1", teamId: "canada", name: "Defender One", position: "Defender" },
      { id: "def-2", teamId: "canada", name: "Defender Two", position: "Defender" },
      { id: "def-3", teamId: "canada", name: "Defender Three", position: "Defender" },
      { id: "mid-1", teamId: "canada", name: "Mid One", position: "Midfielder" },
      { id: "mid-2", teamId: "canada", name: "Mid Two", position: "Midfielder" },
      { id: "mid-3", teamId: "canada", name: "Mid Three", position: "Midfielder" },
      { id: "fwd-1", teamId: "canada", name: "Forward One", position: "Forward" },
      { id: "fwd-2", teamId: "canada", name: "Forward Two", position: "Forward" },
      { id: "fwd-3", teamId: "canada", name: "Forward Three", position: "Forward" },
      { id: "fwd-4", teamId: "canada", name: "Forward Four", position: "Forward" }
    ];
    const slots = playerCatalog.map((player, index) => ({
      userKey: "lucas" as const,
      playerId: player.id,
      roundId: "round16",
      slotIndex: index,
      isStarter: true,
      isCaptain: index === 0,
      isViceCaptain: index === 1
    }));

    const trimmed = trimFantasyRosterToFormation(slots, "3-4-3", playerCatalog, "round16");

    expect(trimmed).toHaveLength(11);
    expect(trimmed.some((slot) => slot.playerId === "fwd-4")).toBe(true);
    expect(trimmed.filter((slot) => slot.playerId.startsWith("fwd-"))).toHaveLength(4);
    expect(validateFantasyRoster(trimmed, INITIAL_MATCHES, new Date("2026-07-03T12:00:00.000Z"), playerCatalog, "round16", "3-4-3")).toBeNull();
  });

  it("does not block over-cap additions in any round", () => {
    const playerCatalog: PlayerCatalogItem[] = [
      { id: "fwd-1", teamId: "spain", name: "Forward One", position: "Forward" },
      { id: "fwd-2", teamId: "spain", name: "Forward Two", position: "Forward" },
      { id: "fwd-3", teamId: "spain", name: "Forward Three", position: "Forward" },
      { id: "fwd-4", teamId: "spain", name: "Forward Four", position: "Forward" }
    ];
    const slots: FantasyRosterSlot[] = playerCatalog.slice(0, 3).map((player, index) => ({
      userKey: "tata",
      playerId: player.id,
      roundId: "round16",
      slotIndex: index,
      isStarter: true,
      isCaptain: index === 0,
      isViceCaptain: index === 1
    }));

    expect(fantasyFormationLimitMessage("fwd-4", slots, "4-3-3", playerCatalog, "round16")).toBeNull();
    expect(fantasyFormationLimitMessage("fwd-4", slots, "4-3-3", playerCatalog, "round32")).toBeNull();
  });

  it("lets Lucas keep selected Spain players without special position-cap exceptions", () => {
    const playerCatalog: PlayerCatalogItem[] = [
      { id: "spain-unai-simon", teamId: "spain", name: "Unai Simon", position: "Goalkeeper" },
      { id: "spain-pau-cubarsi", teamId: "spain", name: "Pau Cubarsi", position: "Defender" },
      { id: "spain-marc-cucurella", teamId: "spain", name: "Marc Cucurella", position: "Defender" },
      { id: "spain-mikel-merino", teamId: "spain", name: "Mikel Merino", position: "Midfielder" },
      { id: "def-1", teamId: "canada", name: "Defender One", position: "Defender" },
      { id: "def-2", teamId: "canada", name: "Defender Two", position: "Defender" },
      { id: "def-3", teamId: "canada", name: "Defender Three", position: "Defender" },
      { id: "mid-1", teamId: "canada", name: "Mid One", position: "Midfielder" },
      { id: "fwd-1", teamId: "canada", name: "Forward One", position: "Forward" },
      { id: "fwd-2", teamId: "canada", name: "Forward Two", position: "Forward" },
      { id: "fwd-3", teamId: "canada", name: "Forward Three", position: "Forward" }
    ];
    const slots = playerCatalog.map((player, index) => ({
      userKey: "lucas" as const,
      playerId: player.id,
      roundId: "round16",
      slotIndex: index,
      isStarter: true,
      isCaptain: index === 0,
      isViceCaptain: index === 1
    }));

    const trimmed = trimFantasyRosterToFormation(slots, "3-4-3", playerCatalog, "round16");

    expect(trimmed).toHaveLength(11);
    expect(trimmed.map((slot) => slot.playerId)).toEqual(expect.arrayContaining([
      "spain-unai-simon",
      "spain-pau-cubarsi",
      "spain-marc-cucurella",
      "spain-mikel-merino"
    ]));
    expect(trimmed.filter((slot) => slot.playerId.includes("def") || slot.playerId.includes("cubarsi") || slot.playerId.includes("cucurella"))).toHaveLength(5);
  });

  it("allows Tata and Lucas to add the same over-cap position mix", () => {
    const playerCatalog: PlayerCatalogItem[] = [
      { id: "spain-marc-cucurella", teamId: "spain", name: "Marc Cucurella", position: "Defender" },
      { id: "def-1", teamId: "canada", name: "Defender One", position: "Defender" },
      { id: "def-2", teamId: "canada", name: "Defender Two", position: "Defender" },
      { id: "def-3", teamId: "canada", name: "Defender Three", position: "Defender" }
    ];
    const slots: FantasyRosterSlot[] = playerCatalog.slice(1).map((player, index) => ({
      userKey: "lucas",
      playerId: player.id,
      roundId: "round16",
      slotIndex: index,
      isStarter: true,
      isCaptain: index === 0,
      isViceCaptain: index === 1
    }));

    expect(fantasyFormationLimitMessage("spain-marc-cucurella", slots, "3-4-3", playerCatalog, "round16", "lucas")).toBeNull();
    expect(fantasyFormationLimitMessage("spain-marc-cucurella", slots, "3-4-3", playerCatalog, "round16", "tata")).toBeNull();
  });
});
