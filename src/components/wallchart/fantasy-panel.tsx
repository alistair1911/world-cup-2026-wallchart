"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Crown, Lock, MousePointerClick, Sparkles, Trophy, Unlock, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import {
  FANTASY_SQUAD_SIZE,
  FANTASY_STARTERS,
  activeFantasyRound,
  buildFantasyLeaderboard,
  buildFantasyOverallLeaderboard,
  buildFantasyRoundResults,
  buildFantasyScoresFromMatches,
  mergeFantasyScores,
  rostersForFantasyRound,
  scoresForFantasyRound,
  type FantasyRoundId,
  type FantasyRoundResult
} from "@/lib/fantasy";
import { avatarUrl } from "@/lib/profile-data";
import { formatKickoff } from "@/lib/utils";
import type {
  FamilySession,
  FantasyPlayerMatchScore,
  FantasyRosterSlot,
  FantasyTeamSetting,
  Match,
  PlayerCatalogItem,
  PlayerMatchStat,
  UserKey
} from "@/lib/types";
import { FantasyProfileDrawer } from "./fantasy-profile-drawer";

type FantasyPanelProps = {
  session: FamilySession;
  matches: Match[];
  rosters: FantasyRosterSlot[];
  scores: FantasyPlayerMatchScore[];
  playerStats: PlayerMatchStat[];
  playerCatalog: PlayerCatalogItem[];
  teamSettings: FantasyTeamSetting[];
  onSaveRoster: (slots: FantasyRosterSlot[]) => Promise<void>;
  onSaveTeamSettings: (settings: Pick<FantasyTeamSetting, "formation">) => Promise<void>;
  onSelectPlayer: (playerId: string) => void;
  onSelectTeam: (teamId: string) => void;
};

function roundStatusLabel(round: FantasyRoundResult) {
  if (round.status === "complete") {
    return round.winner ? `${round.winner.displayName} won` : round.tied ? "Draw" : "Complete";
  }
  if (round.selectionEnabled) {
    return "Squads open";
  }
  if (round.status === "locked") {
    return "Squads locked";
  }
  return "Coming next";
}

function roundHelpText(round: FantasyRoundResult, nextRound?: FantasyRoundResult) {
  if (round.status === "complete") {
    if (nextRound?.selectionEnabled) {
      return `${nextRound.name} squads are open until ${formatKickoff(nextRound.locksAt)}.`;
    }
    return round.winner
      ? `${round.winner.displayName} takes this fantasy round.`
      : "This round finished level, so no overall point was awarded.";
  }

  if (round.selectionEnabled) {
    return `Pick your squad before ${formatKickoff(round.locksAt)}. This roster scores only ${round.name} matches.`;
  }

  if (round.status === "locked") {
    return nextRound
      ? `${round.name} is locked. ${nextRound.name} opens after all ${round.name} matches are final.`
      : `${round.name} is locked until the round is complete.`;
  }

  return `${round.name} selection opens after the previous round is complete.`;
}

export function FantasyPanel({
  session,
  matches,
  rosters,
  scores,
  playerStats,
  playerCatalog,
  teamSettings,
  onSaveRoster,
  onSaveTeamSettings,
  onSelectPlayer,
  onSelectTeam
}: FantasyPanelProps) {
  const statScores = useMemo(() => buildFantasyScoresFromMatches(matches, playerStats, playerCatalog), [matches, playerCatalog, playerStats]);
  const displayScores = useMemo(() => mergeFantasyScores(scores, statScores, playerCatalog), [playerCatalog, scores, statScores]);
  const activeRound = useMemo(() => activeFantasyRound(matches), [matches]);
  const [selectedRoundId, setSelectedRoundId] = useState<FantasyRoundId>(activeRound.id);
  const roundResults = useMemo(
    () => buildFantasyRoundResults(rosters, displayScores, matches, playerCatalog),
    [displayScores, matches, playerCatalog, rosters]
  );
  const activeRoundResult = roundResults.find((round) => round.id === activeRound.id) ?? roundResults[0];
  const selectedRound = roundResults.find((round) => round.id === selectedRoundId) ?? activeRoundResult;
  const nextRound = roundResults[roundResults.findIndex((round) => round.id === selectedRound.id) + 1];
  const selectedRosters = useMemo(() => rostersForFantasyRound(selectedRound.id, rosters), [rosters, selectedRound.id]);
  const selectedScores = useMemo(() => scoresForFantasyRound(selectedRound.id, displayScores, matches), [displayScores, matches, selectedRound.id]);
  const selectedStoredScores = useMemo(() => scoresForFantasyRound(selectedRound.id, scores, matches), [matches, scores, selectedRound.id]);
  const selectedStatScores = useMemo(() => scoresForFantasyRound(selectedRound.id, statScores, matches), [matches, selectedRound.id, statScores]);
  const leaderboard = useMemo(() => buildFantasyLeaderboard(selectedRosters, selectedScores, playerCatalog), [playerCatalog, selectedRosters, selectedScores]);
  const overallLeaderboard = useMemo(() => buildFantasyOverallLeaderboard(roundResults, activeRound.id), [activeRound.id, roundResults]);
  const ownRoster = useMemo(
    () => selectedRosters.filter((slot) => slot.userKey === session.userKey).sort((a, b) => a.slotIndex - b.slotIndex),
    [selectedRosters, session.userKey]
  );
  const [selectedFantasyUser, setSelectedFantasyUser] = useState<UserKey | null>(null);
  const ownStarters = ownRoster.filter((slot) => slot.isStarter).length;
  const ownCaptain = leaderboard.find((row) => row.userKey === session.userKey)?.captain;
  const tataWins = overallLeaderboard.find((row) => row.userKey === "tata")?.roundWins ?? 0;
  const lucasWins = overallLeaderboard.find((row) => row.userKey === "lucas")?.roundWins ?? 0;

  useEffect(() => {
    setSelectedRoundId(activeRound.id);
  }, [activeRound.id]);

  return (
    <Panel className="overflow-hidden p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-cup-gold" />
          <h2 className="text-base font-black">Mini-Fantasy</h2>
        </div>
        <Badge tone={selectedRound.selectionEnabled ? "green" : "red"}>{roundStatusLabel(selectedRound)}</Badge>
      </div>

      <div className="mb-3 rounded-lg bg-cup-ink p-3 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase text-white/55">Overall fantasy league</div>
            <div className="mt-1 text-xl font-black">Lucas {lucasWins} - {tataWins} Tata</div>
          </div>
          <Trophy className="h-7 w-7 text-cup-gold" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {overallLeaderboard.map((row) => (
            <div key={row.userKey} className="rounded-md bg-white/10 p-2 ring-1 ring-white/10">
              <div className="text-[10px] font-black uppercase text-white/55">{row.displayName}</div>
              <div className="text-sm font-black">{row.roundWins} round win{row.roundWins === 1 ? "" : "s"}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        {roundResults.map((round) => (
          <button
            key={round.id}
            type="button"
            onClick={() => setSelectedRoundId(round.id)}
            className={`rounded-md border p-2 text-left transition focus:outline-none focus:ring-2 focus:ring-cup-gold ${
              round.id === selectedRound.id ? "border-cup-red bg-white shadow-sm" : "border-slate-200 bg-slate-50 hover:bg-white"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-black">{round.shortName}</span>
              {round.selectionEnabled ? <Unlock className="h-3.5 w-3.5 text-emerald-600" /> : <Lock className="h-3.5 w-3.5 text-slate-400" />}
            </div>
            <div className="mt-1 truncate text-[10px] font-bold text-slate-500">{roundStatusLabel(round)}</div>
          </button>
        ))}
      </div>

      <div className="mb-3 rounded-md bg-slate-50 p-2 text-[11px] font-bold leading-snug text-slate-600 ring-1 ring-slate-200">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-cup-red" />
          <span>{roundHelpText(selectedRound, nextRound)}</span>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {leaderboard.map((row, index) => (
          <button
            type="button"
            key={row.userKey}
            onClick={() => setSelectedFantasyUser(row.userKey)}
            className={`group relative rounded-md border p-2.5 ${
              index === 0 ? "border-cup-gold bg-gradient-to-br from-amber-100 to-white" : "border-slate-200 bg-white"
            } text-left transition hover:-translate-y-0.5 hover:border-cup-red hover:shadow-lift focus:outline-none focus:ring-2 focus:ring-cup-gold`}
          >
            <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-cup-ink px-2 py-1 text-[9px] font-black uppercase text-white opacity-0 transition group-hover:opacity-100 group-focus:opacity-100">
              <MousePointerClick className="h-3 w-3" />
              Open
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1 truncate font-black">
                  {index === 0 ? <Trophy className="h-4 w-4 shrink-0 text-cup-gold" /> : null}
                  <span className="truncate">{row.displayName}</span>
                </div>
                <div className="truncate text-[10px] font-black uppercase text-slate-500">
                  {row.captain ? `Captain ${row.captain.name}` : "No captain yet"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-cup-red">{row.points}</div>
                <div className="text-[9px] font-black uppercase text-slate-400">{selectedRound.shortName} pts</div>
              </div>
            </div>
            {row.bestPlayer ? (
              <div className="mt-2 flex items-center gap-2 rounded-md bg-white/80 p-2 ring-1 ring-black/5">
                <img
                  src={row.bestPlayer.photoUrl ?? avatarUrl(row.bestPlayer.name)}
                  alt={`${row.bestPlayer.name} portrait`}
                  className="h-7 w-7 rounded-full object-cover object-top"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-black">{row.bestPlayer.name}</div>
                  <div className="text-[10px] font-bold text-slate-500">Best pick - {row.bestPlayer.points} pts</div>
                </div>
              </div>
            ) : null}
            <div className="mt-2 flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5 text-[10px] font-black uppercase text-slate-500 ring-1 ring-black/5">
              <span>{row.rosterSize}/{FANTASY_SQUAD_SIZE} players</span>
              <span>{selectedRound.selectionEnabled && row.userKey === session.userKey ? "Tap to edit" : "Tap to view"}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-gradient-to-br from-white to-cup-sky p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-black uppercase text-slate-600">{session.displayName}'s Squad</h3>
            <p className="truncate text-xs font-bold text-slate-500">
              {selectedRound.name}: {ownRoster.length}/{FANTASY_SQUAD_SIZE} players - {ownStarters}/{FANTASY_STARTERS} starters
              {ownCaptain ? ` - Captain ${ownCaptain.name}` : ""}
            </p>
          </div>
          <Button size="sm" onClick={() => setSelectedFantasyUser(session.userKey)}>
            <Crown className="h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-md bg-slate-50 p-2 text-[10px] font-bold text-slate-500">
        <UsersRound className="h-4 w-4 shrink-0 text-cup-red" />
        Squads reset by round. Completed round winners add one point to the overall fantasy league.
      </div>

      <FantasyProfileDrawer
        userKey={selectedFantasyUser}
        session={session}
        matches={matches}
        rosters={selectedRosters}
        scores={selectedScores}
        storedScores={selectedStoredScores}
        statScores={selectedStatScores}
        playerStats={playerStats}
        playerCatalog={playerCatalog}
        teamSettings={teamSettings}
        round={selectedRound}
        onClose={() => setSelectedFantasyUser(null)}
        onSaveRoster={onSaveRoster}
        onSaveSettings={onSaveTeamSettings}
        onSelectPlayer={onSelectPlayer}
        onSelectTeam={onSelectTeam}
      />
    </Panel>
  );
}
