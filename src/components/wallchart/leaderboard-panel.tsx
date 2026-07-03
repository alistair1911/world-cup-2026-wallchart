"use client";

import { useState } from "react";
import { BadgeCheck, CalendarDays, MapPin, Medal, Sparkles, Star, Target, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { avatarUrl } from "@/lib/profile-data";
import { buildPlayerStatLeaders, type PlayerStatLeader } from "@/lib/player-stats";
import { buildLeaderboard } from "@/lib/predictions";
import {
  getReZeroAvatarTheme,
  getReZeroExactProgress,
  getReZeroProgress,
  type ReZeroBadge,
  type ReZeroExactBadge
} from "@/lib/rezero-progression";
import type { Match, PlayerCatalogItem, PlayerMatchStat, Prediction, UserKey } from "@/lib/types";
import { formatKickoff } from "@/lib/utils";
import { Flag } from "./flag";

type LeaderboardPanelProps = {
  matches: Match[];
  predictions: Prediction[];
  playerStats: PlayerMatchStat[];
  playerCatalog?: PlayerCatalogItem[];
  onSelectUser?: (userKey: UserKey) => void;
};

export function LeaderboardPanel({ matches, predictions, playerStats, playerCatalog = [], onSelectUser }: LeaderboardPanelProps) {
  const [selectedScorer, setSelectedScorer] = useState<PlayerStatLeader | null>(null);
  const leaderboard = buildLeaderboard(matches, predictions);
  const statLeaders = buildPlayerStatLeaders(playerStats, matches, playerCatalog);
  const topScore = Math.max(1, ...leaderboard.map((user) => user.points));

  return (
    <Panel className="overflow-hidden p-3">
      <div className="mb-2 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-cup-gold" />
        <h2 className="text-base font-black">Tata vs Lucas</h2>
      </div>
      <div className="space-y-2">
        {leaderboard.map((user, index) => {
          const progression = getReZeroProgress(user.points);
          const avatarTheme = getReZeroAvatarTheme(user.key, progression.current.level);

          return (
            <div
              key={user.key}
              role={onSelectUser ? "button" : undefined}
              tabIndex={onSelectUser ? 0 : undefined}
              onClick={() => onSelectUser?.(user.key)}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && onSelectUser) {
                  event.preventDefault();
                  onSelectUser(user.key);
                }
              }}
              className={`interactive-pop rounded-md border p-2.5 ${
                index === 0
                  ? "border-cup-gold bg-gradient-to-br from-amber-100 to-white"
                  : "border-slate-200 bg-gradient-to-br from-white to-slate-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ProgressionAvatar userName={user.displayName} rank={index + 1} isLeader={index === 0} theme={avatarTheme} />
                  <div>
                    <div className="font-black">{user.displayName}</div>
                    <div className="text-[10px] font-black uppercase text-slate-500">
                      Level {progression.current.level} - {avatarTheme.title}
                    </div>
                    {onSelectUser ? <div className="text-[9px] font-black uppercase text-cup-red">Open profile</div> : null}
                  </div>
                </div>
                <span className="text-xl font-black text-cup-red">{user.points}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cup-red via-cup-gold to-pitch-600 transition-all"
                  style={{ width: `${Math.max(8, (user.points / topScore) * 100)}%` }}
                />
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-2 text-[10px] font-bold uppercase text-slate-500">
                <span className="flex items-center gap-1">
                  <Target className="h-3 w-3 text-cup-red" />
                  {user.exact} exact
                </span>
                <span>{user.correctOutcomes} outcomes</span>
              </div>

              <ReZeroLevelCard points={user.points} />
              <ReZeroExactCard exact={user.exact} />
            </div>
          );
        })}
      </div>

      <div className="mt-3 border-t border-slate-200 pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cup-red" />
            <h3 className="text-sm font-black uppercase text-slate-600">Top Scorers</h3>
          </div>
          <span className="rounded-full bg-cup-sky px-2 py-1 text-[10px] font-black text-cup-ink">Final matches only</span>
        </div>

        <div className="space-y-3">
          <PlayerStatList
            title="Top 10 goal scorers"
            rows={statLeaders.topScorers}
            empty="No goals recorded yet."
            onSelect={setSelectedScorer}
          />
        </div>
      </div>

      {selectedScorer ? <ScorerDetailDrawer scorer={selectedScorer} onClose={() => setSelectedScorer(null)} /> : null}
    </Panel>
  );
}

function ProgressionAvatar({
  userName,
  rank,
  isLeader,
  theme
}: {
  userName: string;
  rank: number;
  isLeader: boolean;
  theme: ReturnType<typeof getReZeroAvatarTheme>;
}) {
  const initials = userName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="relative h-12 w-12 shrink-0">
      <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${theme.gradient} shadow-sm ring-2 ring-white`} />
      <div className="absolute left-1/2 top-2 h-5 w-7 -translate-x-1/2 rounded-t-full" style={{ backgroundColor: theme.hair }} />
      <div className="absolute left-1/2 top-4 h-6 w-6 -translate-x-1/2 rounded-full bg-[#f7d7bf] ring-1 ring-black/10" />
      <div className="absolute left-[17px] top-[25px] h-1 w-1 rounded-full bg-cup-ink" />
      <div className="absolute right-[17px] top-[25px] h-1 w-1 rounded-full bg-cup-ink" />
      <div className="absolute left-1/2 top-[30px] h-1 w-3 -translate-x-1/2 rounded-full bg-cup-red/70" />
      <div className="absolute bottom-1 left-1/2 h-4 w-8 -translate-x-1/2 rounded-t-full" style={{ backgroundColor: theme.outfit }} />
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase text-white">{initials}</div>
      <div className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-cup-ink px-1 text-[9px] font-black text-white ring-2 ring-white">
        {isLeader ? <Medal className="h-3 w-3 text-cup-gold" /> : rank}
      </div>
      <div className="absolute -bottom-1 left-1/2 max-w-[52px] -translate-x-1/2 rounded-full bg-white px-1.5 py-0.5 text-[8px] font-black text-cup-ink shadow-sm ring-1 ring-black/5">
        {theme.charm}
      </div>
    </div>
  );
}

function ReZeroLevelCard({ points }: { points: number }) {
  const progression = getReZeroProgress(points);

  return (
    <div className={`mt-2 rounded-md bg-gradient-to-br ${progression.current.accent} p-2 ring-1 ring-black/5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[10px] font-black uppercase text-cup-ink/70">
            <Star className="h-3 w-3 text-cup-gold" />
            Re:Zero checkpoint
          </div>
          <div className="mt-0.5 truncate text-sm font-black text-cup-ink">{progression.current.title}</div>
          <p className="mt-0.5 line-clamp-2 text-[10px] font-bold leading-4 text-slate-600">{progression.current.subtitle}</p>
        </div>
        <div className="shrink-0 rounded-md bg-white/80 px-2 py-1 text-center ring-1 ring-black/5">
          <div className="text-base font-black text-cup-red">{progression.current.level}</div>
          <div className="text-[8px] font-black uppercase text-slate-500">Level</div>
        </div>
      </div>

      <div className="mt-2">
        <div className="mb-1 flex justify-between text-[9px] font-black uppercase text-slate-500">
          <span>{progression.next ? `${progression.pointsToNext} pts to next` : "Final checkpoint"}</span>
          <span>{progression.next?.title ?? "Max level"}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/80">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 via-cup-red to-cup-gold transition-all"
            style={{ width: `${Math.max(6, progression.progress)}%` }}
          />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {progression.earned.slice(-4).map((badge) => (
          <ReZeroBadgeChip key={badge.title} badge={badge} />
        ))}
      </div>
    </div>
  );
}

function ReZeroExactCard({ exact }: { exact: number }) {
  const progression = getReZeroExactProgress(exact);
  const current = progression.current;

  return (
    <div className={`mt-2 rounded-md bg-gradient-to-br ${current?.accent ?? "from-white to-slate-50"} p-2 ring-1 ring-black/5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[10px] font-black uppercase text-cup-ink/70">
            <Target className="h-3 w-3 text-cup-red" />
            Exact score badge
          </div>
          <div className="mt-0.5 truncate text-sm font-black text-cup-ink">{current?.title ?? "Awaiting First Perfect Loop"}</div>
          <p className="mt-0.5 line-clamp-2 text-[10px] font-bold leading-4 text-slate-600">
            {current?.subtitle ?? "Hit one exact score prediction to unlock the first Re:Zero exact-score badge."}
          </p>
        </div>
        <div className="shrink-0 rounded-md bg-white/80 px-2 py-1 text-center ring-1 ring-black/5">
          <div className="text-base font-black text-cup-red">{exact}</div>
          <div className="text-[8px] font-black uppercase text-slate-500">Exact</div>
        </div>
      </div>

      <div className="mt-2">
        <div className="mb-1 flex justify-between text-[9px] font-black uppercase text-slate-500">
          <span>{progression.next ? `${progression.exactToNext} exact to next` : "Perfect track complete"}</span>
          <span>{progression.next?.title ?? "Max exact badge"}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/80">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-cup-red transition-all"
            style={{ width: `${Math.max(6, progression.progress)}%` }}
          />
        </div>
      </div>

      {progression.earned.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {progression.earned.slice(-3).map((badge) => (
            <ReZeroExactBadgeChip key={badge.title} badge={badge} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReZeroBadgeChip({ badge }: { badge: ReZeroBadge }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-white/85 px-2 py-1 text-[9px] font-black text-cup-ink ring-1 ring-black/5">
      <BadgeCheck className="h-3 w-3 shrink-0 text-cup-red" />
      <span className="truncate">{badge.title}</span>
    </span>
  );
}

function ReZeroExactBadgeChip({ badge }: { badge: ReZeroExactBadge }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-white/85 px-2 py-1 text-[9px] font-black text-cup-ink ring-1 ring-black/5">
      <Target className="h-3 w-3 shrink-0 text-blue-600" />
      <span className="truncate">{badge.title}</span>
    </span>
  );
}

function PlayerStatList({
  title,
  rows,
  empty,
  onSelect
}: {
  title: string;
  rows: PlayerStatLeader[];
  empty: string;
  onSelect: (row: PlayerStatLeader) => void;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-black uppercase text-slate-500">{title}</h4>
        <span className="text-[10px] font-black uppercase text-slate-400">G</span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-white/70 p-3 text-xs font-bold text-slate-500">
          {empty}
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.slice(0, 10).map((row, index) => (
            <button
              key={`goals-${row.playerId}`}
              type="button"
              onClick={() => onSelect(row)}
              className="interactive-pop flex w-full items-center gap-2 rounded-md bg-white px-2 py-1.5 text-left ring-1 ring-slate-200 transition hover:ring-cup-gold/60"
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cup-ink text-[9px] font-black text-white">
                {index + 1}
              </span>
              <img
                src={row.photoUrl ?? avatarUrl(row.playerName)}
                alt={`${row.playerName} portrait`}
                className="h-7 w-7 shrink-0 rounded-full object-cover object-top ring-1 ring-black/10"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-black text-cup-ink">{row.playerName}</div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                  <Flag team={row.team} />
                  <span>{row.team.code}</span>
                  <span>- {row.position}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-black text-cup-red">{row.goals}</div>
                <div className="text-[9px] font-black uppercase text-slate-400">G</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function ScorerDetailDrawer({ scorer, onClose }: { scorer: PlayerStatLeader; onClose: () => void }) {
  const portrait = scorer.photoUrl ?? avatarUrl(scorer.playerName);
  const braceCount = scorer.goalMatches.filter((match) => match.goals >= 2).length;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-cup-ink/45 backdrop-blur-[2px]">
      <button type="button" aria-label="Close scorer details" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="saved-pop relative flex h-full w-full max-w-sm flex-col overflow-y-auto bg-white shadow-2xl sm:rounded-l-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-3 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase text-cup-red">Top Scorer Details</div>
              <h3 className="mt-1 truncate text-xl font-black text-cup-ink">{scorer.playerName}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-1 text-xs font-bold text-slate-500">
                <Flag team={scorer.team} />
                <span>{scorer.team.name}</span>
                <span className="rounded-full bg-cup-sky px-2 py-0.5 text-[10px] font-black text-cup-ink">{scorer.position}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close scorer details">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="space-y-3 p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <section className="overflow-hidden rounded-lg bg-gradient-to-br from-cup-ink via-pitch-800 to-cup-red text-white shadow-sm">
            <div className="relative bg-gradient-to-br from-cup-ink via-pitch-900 to-cup-red/90">
              <img
                src={portrait}
                alt={`${scorer.playerName} portrait`}
                className="mx-auto h-72 w-full object-contain object-bottom p-2 pb-0 sm:h-80"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-cup-ink/95 via-cup-ink/45 to-transparent" />
            </div>
            <div className="relative z-[1] -mt-3 grid grid-cols-4 gap-2 p-3 pt-0">
              <ScorerMetric label="Goals" value={scorer.goals} highlight />
              <ScorerMetric label="Games" value={scorer.goalMatches.length} />
              <ScorerMetric label="Assists" value={scorer.assists} />
              <ScorerMetric label="Braces" value={braceCount} />
            </div>
          </section>

          <section className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-xs font-black uppercase text-slate-600">Goals By Match</h4>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-500">
                Final matches
              </span>
            </div>
            <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
              {scorer.goalMatches.map((goalMatch) => (
                <div key={`${scorer.playerId}-${goalMatch.matchId}`} className="rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1 text-[10px] font-black uppercase text-slate-500">
                        <span>Match {goalMatch.matchNumber}</span>
                        <span className="text-slate-300">/</span>
                        <span>{formatPhase(goalMatch.phase)}</span>
                      </div>
                      <div className="mt-1 flex min-w-0 items-center gap-1 text-sm font-black text-cup-ink">
                        {goalMatch.homeTeam ? <Flag team={goalMatch.homeTeam} /> : null}
                        <span className="truncate">{goalMatch.homeTeam?.code ?? "TBD"}</span>
                        <span className="text-slate-400">{goalMatch.homeScore ?? "-"}</span>
                        <span className="text-slate-300">-</span>
                        <span className="text-slate-400">{goalMatch.awayScore ?? "-"}</span>
                        <span className="truncate">{goalMatch.awayTeam?.code ?? "TBD"}</span>
                        {goalMatch.awayTeam ? <Flag team={goalMatch.awayTeam} /> : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3 text-cup-red" />
                          {formatKickoff(goalMatch.kickoff)}
                        </span>
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0 text-cup-red" />
                          <span className="truncate">{goalMatch.venue}</span>
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 rounded-md bg-white px-2 py-1 text-center ring-1 ring-slate-200">
                      <div className="text-base font-black text-cup-red">{goalMatch.goals}</div>
                      <div className="text-[9px] font-black uppercase text-slate-400">goal{goalMatch.goals === 1 ? "" : "s"}</div>
                    </div>
                  </div>
                  {goalMatch.assists > 0 ? (
                    <div className="mt-2 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700 ring-1 ring-emerald-100">
                      Also recorded {goalMatch.assists} assist{goalMatch.assists === 1 ? "" : "s"} in this match
                    </div>
                  ) : null}
                </div>
              ))}
              {scorer.goalMatches.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-bold text-slate-500">
                  No final-match goal details found for this player.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function ScorerMetric({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-md p-2 text-center ring-1 ${highlight ? "bg-cup-gold text-cup-ink ring-cup-gold" : "bg-white/12 text-white ring-white/20"}`}>
      <div className="text-[9px] font-black uppercase opacity-75">{label}</div>
      <div className="mt-1 text-xl font-black leading-none">{value}</div>
    </div>
  );
}

function formatPhase(phase: string) {
  if (phase === "group") {
    return "Group";
  }
  if (phase === "round32") {
    return "R32";
  }
  if (phase === "round16") {
    return "R16";
  }
  if (phase === "quarterfinal") {
    return "QF";
  }
  if (phase === "semifinal") {
    return "SF";
  }
  if (phase === "final") {
    return "Final";
  }
  return phase;
}
