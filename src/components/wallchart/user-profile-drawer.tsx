"use client";

import { BadgeCheck, CalendarDays, Target, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildLeaderboard, findPrediction, scorePrediction } from "@/lib/predictions";
import {
  getReZeroAvatarTheme,
  getReZeroExactProgress,
  getReZeroProgress,
  REZERO_BADGES,
  REZERO_EXACT_BADGES
} from "@/lib/rezero-progression";
import { getTeam } from "@/lib/tournament-data";
import type { Match, Prediction, UserKey } from "@/lib/types";
import { formatKickoff } from "@/lib/utils";

type UserProfileDrawerProps = {
  userKey: UserKey | null;
  matches: Match[];
  predictions: Prediction[];
  onClose: () => void;
};

export function UserProfileDrawer({ userKey, matches, predictions, onClose }: UserProfileDrawerProps) {
  if (!userKey) {
    return null;
  }

  const leaderboardUser = buildLeaderboard(matches, predictions).find((user) => user.key === userKey);
  if (!leaderboardUser) {
    return null;
  }

  const pointProgress = getReZeroProgress(leaderboardUser.points);
  const exactProgress = getReZeroExactProgress(leaderboardUser.exact);
  const avatarTheme = getReZeroAvatarTheme(userKey, pointProgress.current.level);
  const history = buildPredictionHistory(userKey, matches, predictions);

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close user profile backdrop" className="absolute inset-0 cursor-default bg-cup-ink/55" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-3xl flex-col overflow-y-auto bg-slate-50 shadow-2xl">
        <div className={`sticky top-0 z-10 overflow-hidden border-b border-slate-200 bg-gradient-to-br ${avatarTheme.gradient} p-4 shadow-sm`}>
          <img
            src={avatarTheme.backdropSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-20"
            style={{ objectPosition: "50% 35%" }}
          />
          <div className="absolute inset-0 bg-white/50" />
          <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <LargeProgressionAvatar userName={leaderboardUser.displayName} userKey={userKey} level={pointProgress.current.level} />
              <div className="min-w-0">
                <div className="text-xs font-black uppercase text-cup-red">Family Profile</div>
                <h2 className="truncate text-3xl font-black text-cup-ink">{leaderboardUser.displayName}</h2>
                <p className="mt-1 text-sm font-bold text-slate-600">{avatarTheme.title}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close user profile drawer">
              <X className="h-5 w-5" />
            </Button>
          </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <section className="grid gap-3 sm:grid-cols-3">
            <MiniStat label="Points" value={leaderboardUser.points} />
            <MiniStat label="Exact Scores" value={leaderboardUser.exact} />
            <MiniStat label="Outcomes" value={leaderboardUser.correctOutcomes} />
          </section>

          <section className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-cup-gold" />
              <h3 className="text-sm font-black uppercase text-slate-600">Re:Zero Level Track</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <div>
                <div className="text-xl font-black text-cup-ink">{pointProgress.current.title}</div>
                <p className="mt-1 text-sm font-bold leading-6 text-slate-600">{pointProgress.current.subtitle}</p>
                <ProgressBar value={pointProgress.progress} />
                <div className="mt-2 text-xs font-black uppercase text-slate-500">
                  {pointProgress.next ? `${pointProgress.pointsToNext} points to ${pointProgress.next.title}` : "Final checkpoint reached"}
                </div>
              </div>
              <div className="rounded-md bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="text-xs font-black uppercase text-slate-500">Current Level</div>
                <div className="mt-1 text-5xl font-black text-cup-red">{pointProgress.current.level}</div>
              </div>
            </div>
          </section>

          <section className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-5 w-5 text-cup-red" />
              <h3 className="text-sm font-black uppercase text-slate-600">Exact Score Badge Track</h3>
            </div>
            <div className="text-xl font-black text-cup-ink">{exactProgress.current?.title ?? "Awaiting First Perfect Loop"}</div>
            <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
              {exactProgress.current?.subtitle ?? "Hit one exact score prediction to unlock the first perfect-score badge."}
            </p>
            <ProgressBar value={exactProgress.progress} color="from-blue-500 via-violet-500 to-cup-red" />
            <div className="mt-2 text-xs font-black uppercase text-slate-500">
              {exactProgress.next ? `${exactProgress.exactToNext} exact score${exactProgress.exactToNext === 1 ? "" : "s"} to ${exactProgress.next.title}` : "Exact badge track complete"}
            </div>
          </section>

          <section className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
            <div className="mb-3 flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-cup-red" />
              <h3 className="text-sm font-black uppercase text-slate-600">Badge Collection</h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {REZERO_BADGES.map((badge) => (
                <BadgeRow
                  key={badge.title}
                  title={badge.title}
                  detail={`${badge.minPoints}+ pts`}
                  earned={leaderboardUser.points >= badge.minPoints}
                  imageSrc={badgeImageFor(badge.title)}
                />
              ))}
              {REZERO_EXACT_BADGES.map((badge) => (
                <BadgeRow
                  key={badge.title}
                  title={badge.title}
                  detail={`${badge.minExact}+ exact`}
                  earned={leaderboardUser.exact >= badge.minExact}
                  imageSrc={badgeImageFor(badge.title)}
                />
              ))}
            </div>
          </section>

          <section className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-cup-red" />
              <h3 className="text-sm font-black uppercase text-slate-600">Prediction History</h3>
            </div>
            <div className="space-y-2">
              {history.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm font-bold text-slate-500">
                  No completed prediction history yet.
                </div>
              ) : (
                history.slice(0, 12).map((item) => (
                  <div key={item.match.id} className="rounded-md bg-slate-50 p-3 ring-1 ring-slate-200">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-cup-ink">{item.title}</div>
                        <div className="text-[10px] font-black uppercase text-slate-500">{formatKickoff(item.match.kickoff)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-cup-red">{item.result.points}</div>
                        <div className="text-[9px] font-black uppercase text-slate-500">pts</div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                      <span>Prediction: {item.prediction.homeScore}-{item.prediction.awayScore}</span>
                      <span>Final: {item.match.homeScore}-{item.match.awayScore}</span>
                      <span className="font-black text-cup-ink">{item.result.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function buildPredictionHistory(userKey: UserKey, matches: Match[], predictions: Prediction[]) {
  return matches
    .filter((match) => match.status === "final")
    .map((match) => {
      const prediction = findPrediction(predictions, userKey, match.id);
      if (!prediction) {
        return null;
      }

      const home = match.homeTeamId ? getTeam(match.homeTeamId)?.name : match.homeSeed?.label;
      const away = match.awayTeamId ? getTeam(match.awayTeamId)?.name : match.awaySeed?.label;

      return {
        match,
        prediction,
        result: scorePrediction(match, prediction),
        title: `${home ?? "Home"} vs ${away ?? "Away"}`
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => new Date(b.match.kickoff).getTime() - new Date(a.match.kickoff).getTime());
}

function LargeProgressionAvatar({ userName, userKey, level }: { userName: string; userKey: UserKey; level: number }) {
  const theme = getReZeroAvatarTheme(userKey, level);

  return (
    <div className="relative h-24 w-24 shrink-0">
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${theme.gradient} shadow-lift ring-2 ring-white`} />
      <img
        src={theme.imageSrc}
        alt={`${userName} Re:Zero avatar`}
        className="absolute inset-2 h-20 w-20 rounded-xl bg-white object-contain p-1 ring-1 ring-black/10"
        style={{ objectPosition: theme.imagePosition }}
      />
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white px-2 py-1 text-[10px] font-black text-cup-ink shadow-sm ring-1 ring-black/5">
        {theme.charm}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
      <div className="text-xs font-black uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-black text-cup-red">{value}</div>
    </div>
  );
}

function ProgressBar({ value, color = "from-violet-500 via-cup-red to-cup-gold" }: { value: number; color?: string }) {
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all`} style={{ width: `${Math.max(6, value)}%` }} />
    </div>
  );
}

function badgeImageFor(title: string) {
  const value = title.toLowerCase();
  if (value.includes("rem") || value.includes("blue")) {
    return "/rezero/REM_Character.PNG";
  }
  if (value.includes("emilia") || value.includes("hope")) {
    return "/rezero/Emilia_Character.PNG";
  }
  if (value.includes("return") || value.includes("loop") || value.includes("rookie")) {
    return "/rezero/Natsuki_Subaru_Character.PNG";
  }
  if (value.includes("trial") || value.includes("witch") || value.includes("royal") || value.includes("knight")) {
    return "/rezero/Shaula_Character.PNG";
  }
  return "/rezero/rezero5.PNG";
}

function BadgeRow({ title, detail, earned, imageSrc }: { title: string; detail: string; earned: boolean; imageSrc: string }) {
  return (
    <div className={`rounded-md p-3 ring-1 ${earned ? "bg-white ring-cup-gold/50" : "bg-slate-50 opacity-60 ring-slate-200"}`}>
      <div className="flex items-center gap-2">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-white ring-1 ring-black/10">
          <img src={imageSrc} alt="" className="h-full w-full bg-white object-contain p-0.5" style={{ objectPosition: "50% 18%" }} />
          <div className="absolute right-0 top-0 rounded-bl bg-white/85 p-0.5">
            <BadgeCheck className={`h-3 w-3 ${earned ? "text-cup-red" : "text-slate-300"}`} />
          </div>
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-black text-cup-ink">{title}</div>
          <div className="text-[10px] font-black uppercase text-slate-500">{earned ? "Unlocked" : detail}</div>
        </div>
      </div>
    </div>
  );
}
