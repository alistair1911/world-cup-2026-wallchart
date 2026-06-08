import { Medal, Target, Trophy } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { buildLeaderboard } from "@/lib/predictions";
import type { Match, Prediction } from "@/lib/types";

type LeaderboardPanelProps = {
  matches: Match[];
  predictions: Prediction[];
};

export function LeaderboardPanel({ matches, predictions }: LeaderboardPanelProps) {
  const leaderboard = buildLeaderboard(matches, predictions);
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
    </Panel>
  );
}
