"use client";

import { useMemo, useState } from "react";
import { Crown, MousePointerClick, Sparkles, Trophy, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import {
  FANTASY_SQUAD_SIZE,
  FANTASY_STARTERS,
  buildFantasyLeaderboard,
  buildFantasyScoresFromMatches,
  mergeFantasyScores
} from "@/lib/fantasy";
import { avatarUrl } from "@/lib/profile-data";
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
  const leaderboard = useMemo(() => buildFantasyLeaderboard(rosters, displayScores, playerCatalog), [displayScores, rosters, playerCatalog]);
  const ownRoster = useMemo(
    () => rosters.filter((slot) => slot.userKey === session.userKey).sort((a, b) => a.slotIndex - b.slotIndex),
    [rosters, session.userKey]
  );
  const [selectedFantasyUser, setSelectedFantasyUser] = useState<UserKey | null>(null);
  const ownStarters = ownRoster.filter((slot) => slot.isStarter).length;
  const ownCaptain = leaderboard.find((row) => row.userKey === session.userKey)?.captain;

  return (
    <Panel className="overflow-hidden p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-cup-gold" />
          <h2 className="text-base font-black">Mini-Fantasy</h2>
        </div>
        <Badge tone="green">{ownRoster.length}/{FANTASY_SQUAD_SIZE}</Badge>
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
                <div className="text-[9px] font-black uppercase text-slate-400">Fantasy pts</div>
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
              <span>Tap to edit</span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-gradient-to-br from-white to-cup-sky p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-black uppercase text-slate-600">{session.displayName}'s Squad</h3>
            <p className="truncate text-xs font-bold text-slate-500">
              {ownRoster.length}/{FANTASY_SQUAD_SIZE} players - {ownStarters}/{FANTASY_STARTERS} starters
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
        Tata and Lucas can both pick the same players. ESPN-confirmed stats update after matches.
      </div>

      <FantasyProfileDrawer
        userKey={selectedFantasyUser}
        session={session}
        matches={matches}
        rosters={rosters}
        scores={displayScores}
        storedScores={scores}
        statScores={statScores}
        playerStats={playerStats}
        playerCatalog={playerCatalog}
        teamSettings={teamSettings}
        onClose={() => setSelectedFantasyUser(null)}
        onSaveRoster={onSaveRoster}
        onSaveSettings={onSaveTeamSettings}
        onSelectPlayer={onSelectPlayer}
        onSelectTeam={onSelectTeam}
      />
    </Panel>
  );
}
