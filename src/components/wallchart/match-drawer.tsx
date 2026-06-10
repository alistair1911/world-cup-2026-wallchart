"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, MessageCircle, Send, Sparkles, Lock, Save, X } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildCommentSuggestions } from "@/lib/comment-suggestions";
import { getTeamProfile } from "@/lib/profile-data";
import { FAMILY_USERS } from "@/lib/tournament-data";
import { findPrediction, scorePrediction } from "@/lib/predictions";
import { isPredictionLocked, predictionLockTime } from "@/lib/standings";
import type { FamilySession, GroupLetter, Match, MatchComment, Prediction, StandingRow, Team, UserKey } from "@/lib/types";
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

export function MatchDrawer({
  match,
  standings,
  predictions,
  comments,
  session,
  onClose,
  onSaveResult,
  onSavePrediction,
  onSaveComment
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

  async function handleResultSave() {
    setSaving(true);
    setMessage(null);
    try {
      await onSaveResult({
        ...activeMatch,
        homeTeamId: activeMatch.homeTeamId ?? resolvedHome?.id,
        awayTeamId: activeMatch.awayTeamId ?? resolvedAway?.id,
        homeScore: homeValue,
        awayScore: awayValue,
        status,
        penaltyWinnerId: tiedFinal ? penaltyWinnerId || null : null,
        updatedBy: session.userKey,
        updatedAt: new Date().toISOString()
      });
      setMessage("Result saved.");
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

    setSaving(true);
    setMessage(null);
    try {
      await onSavePrediction({
        userKey: session.userKey,
        matchId: activeMatch.id,
        homeScore: predictionHomeValue,
        awayScore: predictionAwayValue,
        predictedWinnerTeamId: isKnockout ? predictionWinnerId || null : null,
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

  function formatCommentTime(value: string) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-cup-ink/35">
      <button type="button" aria-label="Close drawer backdrop" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="saved-pop relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-gradient-to-br from-white to-cup-sky p-4 backdrop-blur">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase text-cup-red">Match {activeMatch.matchNumber}</div>
              <h2 className="mt-1 text-2xl font-black text-cup-ink">
                {resolvedHome?.name ?? activeMatch.homeSeed?.label ?? "TBD"} vs {resolvedAway?.name ?? activeMatch.awaySeed?.label ?? "TBD"}
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
              <img src="/players/lamine-yamal.jpg" alt="Lamine Yamal, Spain spotlight" className="h-48 w-full object-cover object-top" />
              <div className="p-4">
              <div className="text-xs font-black uppercase tracking-wide text-cup-red">Tata & Lucas favorite watch</div>
                <h3 className="mt-1 text-xl font-black text-cup-ink">Spain spark: Lamine Yamal</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                  When Spain is on the card, this is the family spotlight. Perfect place to call a Yamal assist, wonder goal, or
                  a Spain masterclass before kickoff.
                </p>
                {yamal ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href="/teams/spain"
                      className="rounded-md bg-cup-ink px-3 py-2 text-xs font-black text-white shadow-sm"
                    >
                      Spain profile
                    </Link>
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

          <section className="rounded-lg border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase text-slate-600">Score Sync</h3>
                <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                  Live/final scores update automatically from the provider. Use the top-bar Sync button to check now.
                </p>
              </div>
              <Badge tone={activeMatch.status === "live" ? "gold" : activeMatch.status === "final" ? "green" : "slate"}>
                {activeMatch.status}
              </Badge>
            </div>

            <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <div className="min-w-0 text-center">
                <div className="truncate text-sm font-black text-cup-ink">{resolvedHome?.code ?? activeMatch.homeSeed?.label}</div>
                <div className="mt-1 text-3xl font-black text-cup-ink">{homeValue ?? "-"}</div>
              </div>
              <div className="text-xs font-black uppercase text-slate-400">vs</div>
              <div className="min-w-0 text-center">
                <div className="truncate text-sm font-black text-cup-ink">{resolvedAway?.code ?? activeMatch.awaySeed?.label}</div>
                <div className="mt-1 text-3xl font-black text-cup-ink">{awayValue ?? "-"}</div>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {resolvedHome ? (
                <Link href={`/teams/${resolvedHome.id}`} className="rounded-md bg-white px-2 py-1 text-xs font-black text-cup-ink ring-1 ring-slate-200">
                  {resolvedHome.name} profile
                </Link>
              ) : null}
              {resolvedAway ? (
                <Link href={`/teams/${resolvedAway.id}`} className="rounded-md bg-white px-2 py-1 text-xs font-black text-cup-ink ring-1 ring-slate-200">
                  {resolvedAway.name} profile
                </Link>
              ) : null}
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
              <select
                value={predictionWinnerId}
                disabled={locked}
                onChange={(event) => setPredictionWinnerId(event.target.value)}
                className="mt-3 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-cup-gold disabled:bg-slate-100"
              >
                <option value="">Advancer pick</option>
                <option value={resolvedHome.id}>{resolvedHome.name}</option>
                <option value={resolvedAway.id}>{resolvedAway.name}</option>
              </select>
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

                return (
                  <div key={user.key} className="rounded-md bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-black">{user.displayName}</div>
                        <div className="text-sm text-slate-500">
                          {prediction?.homeScore ?? "-"} - {prediction?.awayScore ?? "-"}
                        </div>
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
