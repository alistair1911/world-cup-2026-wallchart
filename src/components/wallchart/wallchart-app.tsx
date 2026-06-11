"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, LogOut, RefreshCw, Trophy, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { getCurrentSession, isSupabaseMode, signOutFamily } from "@/lib/auth";
import { buildLeaderboard } from "@/lib/predictions";
import { buildStandings } from "@/lib/standings";
import { GROUPS } from "@/lib/tournament-data";
import {
  ensureProfile,
  loadTournamentState,
  migrateLocalFamilyData,
  saveComment,
  saveMatchResult,
  savePrediction,
  syncLiveScores
} from "@/lib/store";
import type { FamilySession, GroupLetter, Match, MatchComment, PlayerMatchStat, Prediction } from "@/lib/types";
import { formatKickoff } from "@/lib/utils";
import { BracketView } from "./bracket-view";
import { GroupPanel } from "./group-panel";
import { LeaderboardPanel } from "./leaderboard-panel";
import { MatchDrawer } from "./match-drawer";
import { TodayPanel } from "./today-panel";
import { WorldCupMark } from "./world-cup-mark";

type MobileTab = "today" | "groups" | "bracket" | "leaderboard";

function nextMatch(matches: Match[]) {
  return matches
    .filter((match) => match.status !== "final")
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())[0];
}

function groupMatches(matches: Match[], group: GroupLetter) {
  return matches.filter((match) => match.phase === "group" && match.group === group);
}

export function WallchartApp() {
  const router = useRouter();
  const [session, setSession] = useState<FamilySession | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [comments, setComments] = useState<MatchComment[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerMatchStat[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("today");

  const refreshTournamentState = useCallback(async () => {
    setRefreshing(true);
    try {
      const state = await loadTournamentState();
      setMatches(state.matches);
      setPredictions(state.predictions);
      setComments(state.comments);
      setPlayerStats(state.playerStats);
      setError(state.error ?? null);
      setLastRefreshed(new Date());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;

    async function boot() {
      const current = await getCurrentSession();
      if (!alive) {
        return;
      }

      if (!current) {
        router.replace("/login");
        return;
      }

      setSession(current);
      let profileError: string | null = null;
      let migrationMessage: string | null = null;
      try {
        await ensureProfile(current);
        const migrated = await migrateLocalFamilyData(current);
        const migratedItems = migrated.predictions + migrated.comments;
        if (migratedItems > 0) {
          migrationMessage = `Moved ${migratedItems} saved local item${migratedItems === 1 ? "" : "s"} into shared mode.`;
        }
      } catch (error) {
        profileError = error instanceof Error ? error.message : "Could not prepare shared profile.";
      }

      const state = await loadTournamentState();
      if (!alive) {
        return;
      }

      setMatches(state.matches);
      setPredictions(state.predictions);
      setComments(state.comments);
      setPlayerStats(state.playerStats);
      setError(profileError || state.error || null);
      setSyncMessage(migrationMessage);
      setLastRefreshed(new Date());
      setLoading(false);
    }

    boot();

    return () => {
      alive = false;
    };
  }, [router]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const timer = window.setInterval(() => {
      refreshTournamentState().catch(() => {
        setError("Could not refresh live scores.");
      });
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [refreshTournamentState, session]);

  useEffect(() => {
    setSelectedMatch((current) => (current ? matches.find((match) => match.id === current.id) ?? current : current));
  }, [matches]);

  const standings = useMemo(() => buildStandings(matches), [matches]);
  const leaderboard = useMemo(() => buildLeaderboard(matches, predictions), [matches, predictions]);
  const upcoming = useMemo(() => nextMatch(matches), [matches]);
  const commentCounts = useMemo(
    () =>
      comments.reduce<Record<string, number>>((counts, comment) => {
        counts[comment.matchId] = (counts[comment.matchId] ?? 0) + 1;
        return counts;
      }, {}),
    [comments]
  );

  async function handleLogout() {
    await signOutFamily();
    router.replace("/login");
  }

  async function handleSaveResult(updated: Match) {
    if (!session) {
      return;
    }

    await saveMatchResult(session, updated);
    setMatches((current) => current.map((match) => (match.id === updated.id ? updated : match)));
    setSelectedMatch(updated);
  }

  async function handleSavePrediction(updated: Prediction) {
    if (!session) {
      return;
    }

    await savePrediction(session, updated);
    setPredictions((current) => [
      ...current.filter((prediction) => !(prediction.userKey === updated.userKey && prediction.matchId === updated.matchId)),
      updated
    ]);
  }

  async function handleSaveComment(matchId: string, body: string) {
    if (!session) {
      return;
    }

    const comment = await saveComment(session, matchId, body);
    setComments((current) => [...current, comment]);
  }

  async function handleSyncScores() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await syncLiveScores();
      await refreshTournamentState();
      const updated = result.updated?.length ?? 0;
      setSyncMessage(updated > 0 ? `Synced ${updated} score update${updated === 1 ? "" : "s"}.` : "Sync checked. No live/final scores yet.");
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Could not sync live scores.");
    } finally {
      setSyncing(false);
    }
  }

  if (loading || !session) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <Panel className="p-6 text-center">
          <Trophy className="mx-auto mb-3 h-8 w-8 text-cup-gold" />
          <div className="text-sm font-black uppercase text-slate-500">Loading wallchart</div>
        </Panel>
      </main>
    );
  }

  const leftGroups = GROUPS.slice(0, 6);
  const rightGroups = GROUPS.slice(6);

  return (
    <main className="app-shell min-h-screen p-3 lg:p-5">
      <header className="mb-4 overflow-hidden rounded-lg border border-white/80 bg-white/92 p-3 shadow-lift backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 lg:min-w-[290px]">
            <WorldCupMark />
          </div>
          <div className="grid gap-2 sm:grid-cols-4 lg:min-w-[800px]">
            <div className="interactive-pop rounded-md bg-gradient-to-br from-cup-sky to-white px-3 py-2 ring-1 ring-white">
              <div className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
                <CalendarDays className="h-3 w-3" />
                Next
              </div>
              <div className="truncate text-sm font-black">
                {upcoming ? `M${upcoming.matchNumber} - ${formatKickoff(upcoming.kickoff)}` : "Complete"}
              </div>
            </div>
            <div className="interactive-pop rounded-md bg-gradient-to-br from-amber-100 to-white px-3 py-2 ring-1 ring-white">
              <div className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
                <Trophy className="h-3 w-3" />
                Leader
              </div>
              <div className="truncate text-sm font-black">
                {leaderboard[0]?.displayName} - {leaderboard[0]?.points} pts
              </div>
            </div>
            <div className="interactive-pop flex items-center justify-between gap-2 rounded-md bg-gradient-to-br from-emerald-100 to-white px-3 py-2 ring-1 ring-white">
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
                  <UserRound className="h-3 w-3" />
                  Signed in
                </div>
                <div className="truncate text-sm font-black">{session.displayName}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Log out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
            <div className="interactive-pop flex items-center justify-between gap-2 rounded-md bg-gradient-to-br from-white to-cup-sky px-3 py-2 ring-1 ring-white">
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
                  <RefreshCw className="h-3 w-3" />
                  Auto scores
                </div>
                <div className="truncate text-sm font-black">
                  {syncMessage || (lastRefreshed
                    ? `Checked ${lastRefreshed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                    : "Ready")}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSyncScores}
                disabled={refreshing || syncing}
                aria-label="Sync live scores"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing || syncing ? "animate-spin" : ""}`} />
                Sync
              </Button>
            </div>
          </div>
        </div>
        {!isSupabaseMode() ? (
          <div className="mt-3 rounded-md bg-amber-100 p-2 text-sm font-black text-amber-900 ring-1 ring-amber-300">
            Local demo mode: comments and predictions are only saved in this browser. Add Supabase env vars in Vercel for Tata
            and Lucas to share the same data.
          </div>
        ) : null}
        {error ? <div className="mt-3 rounded-md bg-red-50 p-2 text-sm font-bold text-red-700">{error}</div> : null}
      </header>

      <section className="hidden grid-cols-[330px_minmax(780px,1fr)_330px] gap-4 lg:grid">
        <div className="space-y-4">
          {leftGroups.map((group) => (
            <GroupPanel
              key={group}
              group={group}
              rows={standings[group]}
              matches={groupMatches(matches, group)}
              standings={standings}
              onSelectMatch={setSelectedMatch}
              commentCounts={commentCounts}
            />
          ))}
        </div>
        <div className="wall-scroll overflow-x-auto pb-3">
          <BracketView
            matches={matches}
            standings={standings}
            onSelectMatch={setSelectedMatch}
            commentCounts={commentCounts}
          />
        </div>
        <div className="space-y-4">
          <LeaderboardPanel matches={matches} predictions={predictions} playerStats={playerStats} />
          {rightGroups.map((group) => (
            <GroupPanel
              key={group}
              group={group}
              rows={standings[group]}
              matches={groupMatches(matches, group)}
              standings={standings}
              onSelectMatch={setSelectedMatch}
              commentCounts={commentCounts}
            />
          ))}
        </div>
      </section>

      <section className="lg:hidden">
        <div className="mb-3 grid grid-cols-4 rounded-lg bg-cup-ink p-1">
          {(["today", "groups", "bracket", "leaderboard"] as MobileTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMobileTab(tab)}
              className={`tab-button h-9 rounded-md text-xs font-black capitalize ${
                mobileTab === tab ? "bg-white text-cup-ink shadow-sm" : "text-white/70"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {mobileTab === "today" ? (
          <TodayPanel
            matches={matches}
            standings={standings}
            onSelectMatch={setSelectedMatch}
            commentCounts={commentCounts}
          />
        ) : null}
        {mobileTab === "groups" ? (
          <div className="space-y-4">
            {GROUPS.map((group) => (
              <GroupPanel
                key={group}
                group={group}
                rows={standings[group]}
                matches={groupMatches(matches, group)}
                standings={standings}
                onSelectMatch={setSelectedMatch}
                commentCounts={commentCounts}
              />
            ))}
          </div>
        ) : null}
        {mobileTab === "bracket" ? (
          <div className="wall-scroll overflow-x-auto pb-3">
            <BracketView
              matches={matches}
              standings={standings}
              onSelectMatch={setSelectedMatch}
              commentCounts={commentCounts}
            />
          </div>
        ) : null}
        {mobileTab === "leaderboard" ? (
          <LeaderboardPanel matches={matches} predictions={predictions} playerStats={playerStats} />
        ) : null}
      </section>

      <MatchDrawer
        match={selectedMatch}
        standings={standings}
        predictions={predictions}
        comments={selectedMatch ? comments.filter((comment) => comment.matchId === selectedMatch.id) : []}
        session={session}
        onClose={() => setSelectedMatch(null)}
        onSaveResult={handleSaveResult}
        onSavePrediction={handleSavePrediction}
        onSaveComment={handleSaveComment}
      />
    </main>
  );
}
