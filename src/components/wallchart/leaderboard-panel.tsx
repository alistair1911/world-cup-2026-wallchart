import { BadgeCheck, Medal, Sparkles, Star, Target, Trophy } from "lucide-react";
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
import type { Match, PlayerMatchStat, Prediction, UserKey } from "@/lib/types";
import { Flag } from "./flag";

type LeaderboardPanelProps = {
  matches: Match[];
  predictions: Prediction[];
  playerStats: PlayerMatchStat[];
  onSelectUser?: (userKey: UserKey) => void;
};

export function LeaderboardPanel({ matches, predictions, playerStats, onSelectUser }: LeaderboardPanelProps) {
  const leaderboard = buildLeaderboard(matches, predictions);
  const statLeaders = buildPlayerStatLeaders(playerStats, matches);
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
            <h3 className="text-sm font-black uppercase text-slate-600">Player Stats</h3>
          </div>
          <span className="rounded-full bg-cup-sky px-2 py-1 text-[10px] font-black text-cup-ink">Final matches only</span>
        </div>

        <div className="space-y-3">
          <PlayerStatList title="Top 5 scorers" rows={statLeaders.topScorers} metric="goals" empty="No goals recorded yet." />
          <PlayerStatList title="Top 5 assists" rows={statLeaders.topAssists} metric="assists" empty="No assists recorded yet." />
        </div>
      </div>
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
  return (
    <div className="relative h-12 w-12 shrink-0">
      <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${theme.gradient} shadow-sm ring-2 ring-white`} />
      <img
        src={theme.imageSrc}
        alt={`${userName} Re:Zero avatar`}
        className="absolute inset-1 h-10 w-10 rounded-full bg-white object-contain p-0.5 ring-1 ring-black/10"
        style={{ objectPosition: theme.imagePosition }}
      />
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
  metric,
  empty
}: {
  title: string;
  rows: PlayerStatLeader[];
  metric: "goals" | "assists";
  empty: string;
}) {
  const label = metric === "goals" ? "G" : "A";

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
        <div className="space-y-1.5">
          {rows.slice(0, 5).map((row, index) => (
            <div key={`${metric}-${row.playerId}`} className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 ring-1 ring-slate-200">
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
                <div className="text-base font-black text-cup-red">{row[metric]}</div>
                <div className="text-[9px] font-black uppercase text-slate-400">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
