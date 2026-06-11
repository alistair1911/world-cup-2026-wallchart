import { Medal, Sparkles, Target, Trophy } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { avatarUrl } from "@/lib/profile-data";
import { buildPlayerStatLeaders, type PlayerStatLeader } from "@/lib/player-stats";
import { buildLeaderboard } from "@/lib/predictions";
import type { Match, PlayerMatchStat, Prediction } from "@/lib/types";
import { Flag } from "./flag";

type LeaderboardPanelProps = {
  matches: Match[];
  predictions: Prediction[];
  playerStats: PlayerMatchStat[];
};

export function LeaderboardPanel({ matches, predictions, playerStats }: LeaderboardPanelProps) {
  const leaderboard = buildLeaderboard(matches, predictions);
  const statLeaders = buildPlayerStatLeaders(playerStats, matches);
  const topScore = Math.max(1, ...leaderboard.map((user) => user.points));

  return (
    <Panel className="overflow-hidden p-4">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-cup-gold" />
        <h2 className="text-base font-black">Tata vs Lucas</h2>
      </div>
      <div className="space-y-3">
        {leaderboard.map((user, index) => (
          <div
            key={user.key}
            className={`interactive-pop rounded-md border p-3 ${
              index === 0
                ? "border-cup-gold bg-gradient-to-br from-amber-100 to-white"
                : "border-slate-200 bg-gradient-to-br from-white to-slate-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full text-xs font-black text-white ${
                    index === 0 ? "bg-cup-gold text-cup-ink" : "bg-cup-ink"
                  }`}
                >
                  {index === 0 ? <Medal className="h-4 w-4" /> : index + 1}
                </span>
                <span className="font-black">{user.displayName}</span>
              </div>
              <span className="text-2xl font-black text-cup-red">{user.points}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cup-red via-cup-gold to-pitch-600 transition-all"
                style={{ width: `${Math.max(8, (user.points / topScore) * 100)}%` }}
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-bold uppercase text-slate-500">
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3 text-cup-red" />
                {user.exact} exact
              </span>
              <span>{user.correctOutcomes} outcomes</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cup-red" />
            <h3 className="text-sm font-black uppercase text-slate-600">Player Stats</h3>
          </div>
          <span className="rounded-full bg-cup-sky px-2 py-1 text-[10px] font-black text-cup-ink">Final matches only</span>
        </div>

        <div className="space-y-4">
          <PlayerStatList title="Top scorers" rows={statLeaders.topScorers} metric="goals" empty="No goals recorded yet." />
          <PlayerStatList title="Top assists" rows={statLeaders.topAssists} metric="assists" empty="No assists recorded yet." />
          <PlayerStatList
            title="Goal involvements"
            rows={statLeaders.topInvolvements}
            metric="involvements"
            empty="Add player stats from a completed match."
          />
        </div>
      </div>
    </Panel>
  );
}

function PlayerStatList({
  title,
  rows,
  metric,
  empty
}: {
  title: string;
  rows: PlayerStatLeader[];
  metric: "goals" | "assists" | "involvements";
  empty: string;
}) {
  const label = metric === "goals" ? "G" : metric === "assists" ? "A" : "G+A";

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-black uppercase text-slate-500">{title}</h4>
        <span className="text-[10px] font-black uppercase text-slate-400">{label}</span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-white/70 p-3 text-xs font-bold text-slate-500">
          {empty}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 10).map((row, index) => (
            <div key={`${metric}-${row.playerId}`} className="flex items-center gap-2 rounded-md bg-white p-2 ring-1 ring-slate-200">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cup-ink text-[10px] font-black text-white">
                {index + 1}
              </span>
              <img
                src={row.photoUrl ?? avatarUrl(row.playerName)}
                alt={`${row.playerName} portrait`}
                className="h-8 w-8 shrink-0 rounded-full object-cover object-top ring-1 ring-black/10"
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
                <div className="text-lg font-black text-cup-red">{row[metric]}</div>
                <div className="text-[9px] font-black uppercase text-slate-400">
                  {row.goals}G {row.assists}A
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
