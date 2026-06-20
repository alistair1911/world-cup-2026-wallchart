import { describe, expect, it } from "vitest";
import {
  FANTASY_ROUND_ID,
  buildFantasyLeaderboard,
  buildFantasyScoresFromMatches,
  fantasyOptionMap,
  fantasyPlayerOptions,
  normalizeFantasyRosterSlots,
  normalizeFantasyPosition,
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
