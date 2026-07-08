"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Goal, Handshake, MessageCircle, Send, Sparkles, Lock, Save, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildCommentSuggestions } from "@/lib/comment-suggestions";
import { resolveFantasyPlayerOption } from "@/lib/fantasy";
import { getTeamProfile } from "@/lib/profile-data";
import { FAMILY_USERS } from "@/lib/tournament-data";
import { findPrediction, scorePrediction } from "@/lib/predictions";
import { isPredictionLocked, predictionLockTime } from "@/lib/standings";
import type {
  FamilySession,
  GroupLetter,
  Match,
  MatchComment,
  PlayerCatalogItem,
  PlayerMatchStat,
  Prediction,
  StandingRow,
  Team,
  UserKey
} from "@/lib/types";
import { clampScore, formatKickoff } from "@/lib/utils";
import { getVenueInfo } from "@/lib/venues";
import { Flag } from "./flag";
import { getMatchTeams } from "./match-card";

type MatchDrawerProps = {
  match: Match | null;
  standings: Record<GroupLetter, StandingRow[]>;
  predictions: Prediction[];
  comments: MatchComment[];
  session: FamilySession;
  onClose: () => void;
  onSaveResult: (match: Match) => Promise<void>;
  onSavePrediction: (prediction: Prediction) => Promise<void>;
  onSaveComment: (matchId: string, body: string) => Promise<void>;
  onSavePlayerStats: (matchId: string, stats: PlayerMatchStat[]) => Promise<void>;
  onSelectTeam: (teamId: string) => void;
  playerStats: PlayerMatchStat[];
  playerCatalog: PlayerCatalogItem[];
};

type PlayerStatDraft = {
  playerId: string;
  playerName: string;
  teamId: string;
  goals: string;
  assists: string;
};

function scoreToText(value: number | null) {
  return value === null ? "" : String(value);
}

function predictionTone(status: string) {
  if (status === "Exact") {
    return "gold";
  }
  if (status === "Close" || status === "Correct winner") {
    return "green";
  }
  if (status === "Pending") {
    return "slate";
  }
  return "red";
}

function predictedScoreAdvancerId(homeScore: number | null, awayScore: number | null, home: Team | null, away: Team | null) {
  if (homeScore === null || awayScore === null) {
    return null;
  }
  if (homeScore > awayScore) {
    return home?.id ?? null;
  }
  if (awayScore > homeScore) {
    return away?.id ?? null;
  }
  return null;
}

export function MatchDrawer({
  match,
  standings,
  predictions,
  comments,
  session,
  onClose,
  onSaveResult,
  onSavePrediction,
  onSaveComment,
  onSelectTeam,
  playerStats,
  playerCatalog
}: MatchDrawerProps) {
  const teams = useMemo(() => (match ? getMatchTeams(match, standings) : { home: null, away: null }), [match, standings]);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [status, setStatus] = useState<Match["status"]>("scheduled");
  const [penaltyWinnerId, setPenaltyWinnerId] = useState("");
  const [predictionHome, setPredictionHome] = useState("");
  const [predictionAway, setPredictionAway] = useState("");
  const [predictionWinnerId, setPredictionWinnerId] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [statDrafts, setStatDrafts] = useState<PlayerStatDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const ownPrediction = match ? findPrediction(predictions, session.userKey, match.id) : undefined;
  const locked = match ? isPredictionLocked(match) : true;
  const lockTime = match ? predictionLockTime(match) : null;
  const isKnockout = match ? match.phase !== "group" : false;
  const resolvedHome = teams.home as Team | null;
  const resolvedAway = teams.away as Team | null;
  const venueInfo = getVenueInfo(match?.venue ?? "");
  const hasSpain = resolvedHome?.id === "spain" || resolvedAway?.id === "spain";
  const spainProfile = hasSpain ? getTeamProfile("spain") : null;
  const yamal = spainProfile?.players.find((player) => player.name === "Lamine Yamal");
  const quickComments = useMemo(
    () => (match ? buildCommentSuggestions(match, resolvedHome, resolvedAway) : []),
    [match, resolvedHome, resolvedAway]
  );
  useEffect(() => {
    if (!match) {
      return;
    }

    setHomeScore(scoreToText(match.homeScore));
    setAwayScore(scoreToText(match.awayScore));
    setStatus(match.status);
    setPenaltyWinnerId(match.penaltyWinnerId ?? "");
    setPredictionHome(scoreToText(ownPrediction?.homeScore ?? null));
    setPredictionAway(scoreToText(ownPrediction?.awayScore ?? null));
    setPredictionWinnerId(ownPrediction?.predictedWinnerTeamId ?? "");
    setCommentBody("");
    setMessage(null);
  }, [match, ownPrediction?.homeScore, ownPrediction?.awayScore, ownPrediction?.predictedWinnerTeamId]);

  useEffect(() => {
    if (!match) {
      return;
    }

    setStatDrafts(
      playerStats
        .filter((stat) => stat.matchId === match.id && (stat.goals > 0 || stat.assists > 0))
        .map((stat) => {
          const option = resolveFantasyPlayerOption(
            { playerId: stat.playerId, playerName: stat.playerName, teamId: stat.teamId },
            playerCatalog
          );

          return {
            playerId: option?.id ?? stat.playerId,
            playerName: option?.name ?? stat.playerName,
            teamId: option?.team.id ?? stat.teamId,
            goals: stat.goals ? String(stat.goals) : "",
            assists: stat.assists ? String(stat.assists) : ""
          };
        })
    );
  }, [match, playerCatalog, playerStats]);

  if (!match) {
    return null;
  }

  const activeMatch = match;
  const homeValue = clampScore(homeScore);
  const awayValue = clampScore(awayScore);
  const predictionHomeValue = clampScore(predictionHome);
  const predictionAwayValue = clampScore(predictionAway);
  const tiedFinal = status === "final" && homeValue !== null && awayValue !== null && homeValue === awayValue;
  const canPickWinner = isKnockout && resolvedHome && resolvedAway;
  const predictionIsDraw =
    Boolean(canPickWinner) &&
    predictionHomeValue !== null &&
    predictionAwayValue !== null &&
    predictionHomeValue === predictionAwayValue;
  const inferredPredictionAdvancerId = isKnockout
    ? predictedScoreAdvancerId(predictionHomeValue, predictionAwayValue, resolvedHome, resolvedAway)
    : null;
  const inferredPredictionAdvancer = inferredPredictionAdvancerId
    ? inferredPredictionAdvancerId === resolvedHome?.id
      ? resolvedHome
      : inferredPredictionAdvancerId === resolvedAway?.id
        ? resolvedAway
        : null
    : null;

  async function handleResultSave() {
    setSaving(true);
    setMessage(null);
    try {
      const updatedMatch = {
        ...activeMatch,
        homeTeamId: activeMatch.homeTeamId ?? resolvedHome?.id,
        awayTeamId: activeMatch.awayTeamId ?? resolvedAway?.id,
        homeScore: homeValue,
        awayScore: awayValue,
        status,
        penaltyWinnerId: tiedFinal ? penaltyWinnerId || null : null,
        updatedBy: session.userKey,
        updatedAt: new Date().toISOString()
      };

      await onSaveResult(updatedMatch);
      setMessage("Result saved. Player stats sync automatically from the score provider.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save result.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePredictionSave() {
    if (locked) {
      setMessage("Predictions are locked for this match.");
      return;
    }
    if (predictionIsDraw && !predictionWinnerId) {
      setMessage("Pick who advances after extra time or penalties for this knockout draw.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const predictedWinnerTeamId = isKnockout
        ? predictionIsDraw
          ? predictionWinnerId || null
          : inferredPredictionAdvancerId
        : null;
      await onSavePrediction({
        userKey: session.userKey,
        matchId: activeMatch.id,
        homeScore: predictionHomeValue,
        awayScore: predictionAwayValue,
        predictedWinnerTeamId,
        updatedAt: new Date().toISOString()
      });
      setMessage("Prediction saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save prediction.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCommentSave(body = commentBody) {
    setSaving(true);
    setMessage(null);
    try {
      await onSaveComment(activeMatch.id, body);
      setCommentBody("");
      setMessage("Comment added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save comment.");
    } finally {
      setSaving(false);
    }
  }

  function statNumber(value: string) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(20, parsed)) : 0;
  }

  function formatCommentTime(value: string) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));
  }

  const recordedGoals = statDrafts.reduce((total, draft) => total + statNumber(draft.goals), 0);
  const recordedAssists = statDrafts.reduce((total, draft) => total + statNumber(draft.assists), 0);
  const recordedPlayers = statDrafts.filter((draft) => statNumber(draft.goals) > 0 || statNumber(draft.assists) > 0).length;
  const statDraftViews = statDrafts
    .map((draft, index) => ({
      draft,
      index,
      goals: statNumber(draft.goals),
      assists: statNumber(draft.assists)
    }))
    .sort((a, b) => {
      const aRank = a.goals > 0 ? 0 : a.assists > 0 ? 1 : 2;
      const bRank = b.goals > 0 ? 0 : b.assists > 0 ? 1 : 2;
      return aRank - bRank || b.goals - a.goals || b.assists - a.assists || a.draft.playerName.localeCompare(b.draft.playerName);
    });
  const scorerDrafts = statDraftViews.filter((item) => item.goals > 0);
  const assistDrafts = statDraftViews.filter((item) => item.goals === 0 && item.assists > 0);

  function renderStatDraftCard({
    draft,
    index,
    goals,
    assists
  }: {
    draft: PlayerStatDraft;
    index: number;
    goals: number;
    assists: number;
  }) {
    const draftTeam = draft.teamId === resolvedHome?.id ? resolvedHome : draft.teamId === resolvedAway?.id ? resolvedAway : null;

    return (
      <div
        key={`${draft.playerId}-${index}`}
        className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-50 ring-1 ring-slate-200">
            <Flag team={draftTeam} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <div className="truncate text-sm font-black text-cup-ink">{draft.playerName}</div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-500">
                {draftTeam?.code ?? "Team"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatRoleChip type="goal" value={goals} />
              <StatRoleChip type="assist" value={assists} />
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md bg-slate-50 text-center ring-1 ring-slate-200">
            <div className="min-w-11 border-r border-slate-200 px-2 py-1">
              <div className="text-sm font-black text-red-700">{goals}</div>
              <div className="text-[9px] font-black uppercase text-slate-400">G</div>
            </div>
            <div className="min-w-11 px-2 py-1">
              <div className="text-sm font-black text-emerald-700">{assists}</div>
              <div className="text-[9px] font-black uppercase text-slate-400">A</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-cup-ink/35">
      <button type="button" aria-label="Close drawer backdrop" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="saved-pop relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/96 p-4 backdrop-blur">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase text-cup-red">Match {activeMatch.matchNumber}</div>
              <h2 className="mt-2 flex flex-wrap items-center gap-2 text-xl font-black text-cup-ink">
                <TeamHeadingLink team={resolvedHome} fallback={activeMatch.homeSeed?.label ?? "TBD"} onSelectTeam={onSelectTeam} />
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-500">vs</span>
                <TeamHeadingLink team={resolvedAway} fallback={activeMatch.awaySeed?.label ?? "TBD"} onSelectTeam={onSelectTeam} />
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {formatKickoff(activeMatch.kickoff)} - {activeMatch.venue}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close match drawer">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Badge tone={activeMatch.phase === "group" ? "green" : "gold"}>{activeMatch.phase}</Badge>
            {locked ? (
              <Badge tone="red">
                <Lock className="mr-1 h-3 w-3" />
                Locked
              </Badge>
            ) : (
              <Badge tone="slate">Open</Badge>
            )}
          </div>
        </div>

        <div className="space-y-5 p-4">
          {venueInfo ? (
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <img src={venueInfo.image} alt={venueInfo.stadium} className="h-44 w-full object-cover" />
              <div className="p-3">
                <div className="text-sm font-black text-cup-ink">{venueInfo.stadium}</div>
                <div className="text-xs font-bold text-slate-500">
                  {venueInfo.city}, {venueInfo.country}
                </div>
              </div>
            </section>
          ) : null}

          {hasSpain ? (
            <section className="saved-pop overflow-hidden rounded-lg border border-cup-gold/60 bg-gradient-to-br from-red-50 via-white to-amber-50 shadow-sm">
              <img src="/players/spain-lamine-yamal-2026.jpg" alt="Lamine Yamal, Spain spotlight" className="h-48 w-full object-cover object-top" />
              <div className="p-4">
              <div className="text-xs font-black uppercase tracking-wide text-cup-red">Tata & Lucas favorite watch</div>
                <h3 className="mt-1 text-xl font-black text-cup-ink">Spain spark: Lamine Yamal</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                  When Spain is on the card, this is the family spotlight. Perfect place to call a Yamal assist, wonder goal, or
                  a Spain masterclass before kickoff.
                </p>
                {yamal ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectTeam("spain")}
                      className="rounded-md bg-cup-ink px-3 py-2 text-xs font-black text-white shadow-sm"
                    >
                      Spain profile
                    </button>
                    <Link
                      href={`/players/${yamal.id}`}
                      className="rounded-md bg-cup-gold px-3 py-2 text-xs font-black text-cup-ink shadow-sm"
                    >
                      Yamal profile
                    </Link>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase text-slate-600">Match Score</h3>
                <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                  Automatic score sync can update the final result. Manual override stays available below.
                </p>
              </div>
              <Badge tone={activeMatch.status === "live" ? "gold" : activeMatch.status === "final" ? "green" : "slate"}>
                {activeMatch.status}
              </Badge>
            </div>

            <div className="mb-3 space-y-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
              <ScoreRow team={resolvedHome} fallback={activeMatch.homeSeed?.label} score={homeValue} onSelectTeam={onSelectTeam} />
              <div className="mx-auto h-px w-full bg-slate-200" />
              <ScoreRow team={resolvedAway} fallback={activeMatch.awaySeed?.label} score={awayValue} onSelectTeam={onSelectTeam} />
            </div>

            <details className="rounded-md bg-white/50 p-2">
              <summary className="cursor-pointer text-xs font-black uppercase text-slate-400">Manual override backup</summary>
              <div className="mt-3 grid grid-cols-[1fr_72px_72px] items-center gap-2">
                <span className="truncate font-bold">
                  <span className="mr-2 inline-flex align-middle">
                    <Flag team={resolvedHome} />
                  </span>
                  {resolvedHome?.name ?? activeMatch.homeSeed?.label}
                </span>
                <Input
                  className="score-input text-center text-lg font-black"
                  inputMode="numeric"
                  value={homeScore}
                  onChange={(event) => setHomeScore(event.target.value)}
                />
                <span className="text-center text-xs font-black text-slate-400">HOME</span>
                <span className="truncate font-bold">
                  <span className="mr-2 inline-flex align-middle">
                    <Flag team={resolvedAway} />
                  </span>
                  {resolvedAway?.name ?? activeMatch.awaySeed?.label}
                </span>
                <Input
                  className="score-input text-center text-lg font-black"
                  inputMode="numeric"
                  value={awayScore}
                  onChange={(event) => setAwayScore(event.target.value)}
                />
                <span className="text-center text-xs font-black text-slate-400">AWAY</span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as Match["status"])}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-cup-gold"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="live">Live</option>
                  <option value="final">Final</option>
                </select>
                {canPickWinner && tiedFinal ? (
                  <select
                    value={penaltyWinnerId}
                    onChange={(event) => setPenaltyWinnerId(event.target.value)}
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-cup-gold"
                  >
                    <option value="">Penalty winner</option>
                    <option value={resolvedHome.id}>{resolvedHome.name}</option>
                    <option value={resolvedAway.id}>{resolvedAway.name}</option>
                  </select>
                ) : null}
              </div>
              <Button className="mt-3 w-full" onClick={handleResultSave} disabled={saving}>
                <Save className="h-4 w-4" />
                Save Manual Result
              </Button>
            </details>
          </section>

          <section className="overflow-hidden rounded-lg border border-emerald-200 bg-white shadow-sm">
            <div className="border-b border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-cup-sky p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-700">Player Stats</h3>
                  <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                    Synced scorers and assist providers that feed Mini-Fantasy points.
                  </p>
                </div>
                <Badge tone="green">Synced source</Badge>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <StatSummaryTile label="Players" value={recordedPlayers} />
                <StatSummaryTile label="Goals" value={recordedGoals} icon={<Goal className="h-3.5 w-3.5" />} tone="red" />
                <StatSummaryTile label="Assists" value={recordedAssists} icon={<Handshake className="h-3.5 w-3.5" />} tone="green" />
              </div>
            </div>

            <div className="p-4">
              {statDrafts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
                    <Goal className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-black text-cup-ink">No player stats recorded yet</div>
                  <p className="mt-1 text-xs font-bold text-slate-500">Scorers and assist providers will appear here after provider sync confirms them.</p>
                </div>
              ) : null}

              {statDrafts.length > 0 ? (
                <div className="max-h-[520px] space-y-4 overflow-y-auto pr-1">
                  {scorerDrafts.length > 0 ? (
                    <StatDraftGroup title="Goal scorers" count={scorerDrafts.length} tone="red">
                      {scorerDrafts.map(renderStatDraftCard)}
                    </StatDraftGroup>
                  ) : null}
                  {assistDrafts.length > 0 ? (
                    <StatDraftGroup title="Assist providers" count={assistDrafts.length} tone="green">
                      {assistDrafts.map(renderStatDraftCard)}
                    </StatDraftGroup>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-cup-gold/40 bg-gradient-to-br from-amber-50 to-white p-4">
            <div className="mb-3">
              <h3 className="text-sm font-black uppercase text-slate-600">{session.displayName} Prediction</h3>
              {lockTime ? (
                <p className="mt-1 text-xs font-bold text-slate-500">Locks {formatKickoff(lockTime.toISOString())}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-[1fr_72px_72px] items-center gap-2">
              <span className="truncate font-bold">{resolvedHome?.code ?? activeMatch.homeSeed?.label}</span>
              <Input
                className="score-input text-center text-lg font-black"
                inputMode="numeric"
                disabled={locked}
                value={predictionHome}
                onChange={(event) => setPredictionHome(event.target.value)}
              />
              <span />
              <span className="truncate font-bold">{resolvedAway?.code ?? activeMatch.awaySeed?.label}</span>
              <Input
                className="score-input text-center text-lg font-black"
                inputMode="numeric"
                disabled={locked}
                value={predictionAway}
                onChange={(event) => setPredictionAway(event.target.value)}
              />
              <span />
            </div>
            {isKnockout && canPickWinner ? (
              <div className="mt-3 rounded-lg bg-white p-3 ring-1 ring-cup-gold/30">
                {predictionIsDraw ? (
                  <>
                    <div className="mb-2 text-xs font-black uppercase text-cup-red">Draw after 90 minutes</div>
                    <select
                      value={predictionWinnerId}
                      disabled={locked}
                      onChange={(event) => setPredictionWinnerId(event.target.value)}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-cup-gold disabled:bg-slate-100"
                    >
                      <option value="">Who advances after extra time / penalties?</option>
                      <option value={resolvedHome.id}>{resolvedHome.name}</option>
                      <option value={resolvedAway.id}>{resolvedAway.name}</option>
                    </select>
                    <p className="mt-2 text-[11px] font-bold leading-4 text-slate-500">
                      Correct draw plus correct advancer is worth 5 points total. Draw with the wrong advancer only scores the 90-minute draw.
                    </p>
                  </>
                ) : inferredPredictionAdvancer ? (
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-black uppercase text-slate-500">Winner by your score</div>
                      <div className="mt-1 flex items-center gap-2 text-sm font-black text-cup-ink">
                        <Flag team={inferredPredictionAdvancer} />
                        {inferredPredictionAdvancer.name}
                      </div>
                    </div>
                    <Badge tone="green">Inferred</Badge>
                  </div>
                ) : (
                  <p className="text-xs font-bold leading-5 text-slate-500">
                    Enter a draw score to pick who advances after extra time or penalties. If your score backs the right team but the match is tied after 90, you still get 2 advancer points.
                  </p>
                )}
              </div>
            ) : null}
            <Button className="mt-3 w-full" onClick={handlePredictionSave} disabled={saving || locked}>
              <Check className="h-4 w-4" />
              Save Prediction
            </Button>
          </section>

          <section className="rounded-lg border border-slate-200 bg-gradient-to-br from-white to-emerald-50 p-4">
            <h3 className="mb-3 text-sm font-black uppercase text-slate-600">Prediction Results</h3>
            <div className="space-y-3">
              {FAMILY_USERS.map((user) => {
                const prediction = findPrediction(predictions, user.key as UserKey, activeMatch.id);
                const result = scorePrediction(activeMatch, prediction);
                const predictedAdvancer = prediction?.predictedWinnerTeamId
                  ? prediction.predictedWinnerTeamId === resolvedHome?.id
                    ? resolvedHome
                    : prediction.predictedWinnerTeamId === resolvedAway?.id
                      ? resolvedAway
                      : null
                  : null;

                return (
                  <div key={user.key} className="rounded-md bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-black">{user.displayName}</div>
                        <div className="text-sm text-slate-500">
                          {prediction?.homeScore ?? "-"} - {prediction?.awayScore ?? "-"}
                        </div>
                        {predictedAdvancer ? (
                          <div className="mt-1 flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
                            <Flag team={predictedAdvancer} />
                            Advances: {predictedAdvancer.code}
                          </div>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <Badge tone={predictionTone(result.status)}>{result.status}</Badge>
                        <div className="mt-1 text-lg font-black text-cup-ink">{result.points} pts</div>
                      </div>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-slate-500">{result.explanation}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-gradient-to-br from-cup-sky to-white p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase text-slate-600">
                <MessageCircle className="h-4 w-4 text-cup-red" />
                Match Comments
              </h3>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-cup-ink">{comments.length}</span>
            </div>

            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {quickComments.map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => setCommentBody(quick)}
                  className="tab-button min-h-11 rounded-md bg-white px-3 py-2 text-left text-xs font-black leading-snug text-cup-ink shadow-sm ring-1 ring-slate-200 hover:ring-cup-gold"
                >
                  {quick}
                </button>
              ))}
            </div>

            <div className="rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-200">
              <textarea
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value.slice(0, 280))}
                placeholder="Add a family comment about this match..."
                className="min-h-20 w-full resize-none rounded-md border border-slate-200 p-3 text-sm font-semibold text-cup-ink outline-none focus:border-cup-gold focus:ring-2 focus:ring-cup-gold/25"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500">{commentBody.length}/280</span>
                <Button size="sm" onClick={() => handleCommentSave()} disabled={saving || !commentBody.trim()}>
                  <Send className="h-4 w-4" />
                  Post
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {comments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-4 text-center text-sm font-bold text-slate-500">
                  <Sparkles className="mx-auto mb-2 h-5 w-5 text-cup-gold" />
                  First comment wins the vibe.
                </div>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`saved-pop rounded-lg p-3 shadow-sm ${
                      comment.userKey === "tata" ? "bg-white" : "bg-emerald-50"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-black text-cup-ink">{comment.displayName}</span>
                      <span className="text-[11px] font-bold text-slate-500">{formatCommentTime(comment.createdAt)}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">{comment.body}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          {message ? <div className="saved-pop rounded-md bg-cup-sky p-3 text-sm font-bold text-cup-ink">{message}</div> : null}
        </div>
      </aside>
    </div>
  );
}

function TeamHeadingLink({
  team,
  fallback,
  onSelectTeam
}: {
  team: Team | null;
  fallback: string;
  onSelectTeam: (teamId: string) => void;
}) {
  if (!team) {
    return <span className="rounded-lg bg-slate-100 px-3 py-2 text-cup-ink">{fallback}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => onSelectTeam(team.id)}
      className="interactive-pop inline-flex min-w-0 max-w-full items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-cup-ink ring-1 ring-slate-200 hover:ring-cup-gold"
    >
      <Flag team={team} />
      <span className="truncate">{team.name}</span>
      <UsersRound className="h-4 w-4 shrink-0 text-cup-red" />
    </button>
  );
}

function ScoreRow({
  team,
  fallback,
  score,
  onSelectTeam
}: {
  team: Team | null;
  fallback?: string;
  score: number | null;
  onSelectTeam: (teamId: string) => void;
}) {
  const content = (
    <div className="flex min-w-0 items-center gap-3">
      <Flag team={team} />
      <div className="min-w-0">
        <div className="truncate text-sm font-black text-cup-ink">{team?.name ?? fallback ?? "TBD"}</div>
        <div className="text-[10px] font-black uppercase text-slate-500">
          {team ? "Open team profile" : "Seed placeholder"}
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
      {team ? (
        <button
          type="button"
          onClick={() => onSelectTeam(team.id)}
          className="interactive-pop min-w-0 rounded-md bg-white px-3 py-2 text-left ring-1 ring-slate-200 hover:ring-cup-gold"
        >
          {content}
        </button>
      ) : (
        <div className="min-w-0 rounded-md bg-white px-3 py-2 ring-1 ring-slate-200">{content}</div>
      )}
      <div className="grid h-12 w-14 place-items-center rounded-md bg-cup-ink text-3xl font-black text-cup-gold shadow-sm">
        {score ?? "-"}
      </div>
    </div>
  );
}

function StatSummaryTile({
  label,
  value,
  icon,
  tone = "slate"
}: {
  label: string;
  value: number;
  icon?: ReactNode;
  tone?: "green" | "red" | "slate";
}) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "red"
        ? "bg-red-100 text-red-800"
        : "bg-slate-100 text-slate-700";

  return (
    <div className="rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase text-slate-500">{label}</span>
        {icon ? <span className={`grid h-6 w-6 place-items-center rounded-full ${toneClass}`}>{icon}</span> : null}
      </div>
      <div className="mt-1 text-2xl font-black leading-none text-cup-ink">{value}</div>
    </div>
  );
}

function StatRoleChip({ type, value }: { type: "goal" | "assist"; value: number }) {
  const active = value > 0;
  const isGoal = type === "goal";
  const Icon = isGoal ? Goal : Handshake;
  const label = isGoal ? "Scored" : "Assisted";
  const activeClass = isGoal ? "bg-red-100 text-red-800 ring-red-200" : "bg-emerald-100 text-emerald-800 ring-emerald-200";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black uppercase ring-1 ${
        active ? activeClass : "bg-white text-slate-400 ring-slate-200"
      }`}
    >
      <Icon className="h-3 w-3" />
      {active ? `${label} ${value}` : isGoal ? "No goal" : "No assist"}
    </span>
  );
}

function StatDraftGroup({
  title,
  count,
  tone,
  children
}: {
  title: string;
  count: number;
  tone: "green" | "red" | "slate";
  children: ReactNode;
}) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : tone === "red"
        ? "bg-red-50 text-red-700 ring-red-100"
        : "bg-slate-50 text-slate-600 ring-slate-200";

  return (
    <div className="space-y-2">
      <div className={`sticky top-0 z-[1] flex items-center justify-between rounded-md px-2 py-1 text-[10px] font-black uppercase ring-1 ${toneClass}`}>
        <span>{title}</span>
        <span>{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
