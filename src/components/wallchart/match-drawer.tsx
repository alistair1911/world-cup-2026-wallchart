"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Lock, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FAMILY_USERS } from "@/lib/tournament-data";
import { findPrediction, scorePrediction } from "@/lib/predictions";
import { isPredictionLocked } from "@/lib/standings";
import type { FamilySession, GroupLetter, Match, Prediction, StandingRow, Team, UserKey } from "@/lib/types";
import { clampScore, formatKickoff } from "@/lib/utils";
import { getVenueInfo } from "@/lib/venues";
import { getMatchTeams } from "./match-card";

type MatchDrawerProps = {
  match: Match | null;
  standings: Record<GroupLetter, StandingRow[]>;
  predictions: Prediction[];
  session: FamilySession;
  onClose: () => void;
  onSaveResult: (match: Match) => Promise<void>;
  onSavePrediction: (prediction: Prediction) => Promise<void>;
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
  session,
  onClose,
  onSaveResult,
  onSavePrediction
}: MatchDrawerProps) {
  const teams = useMemo(() => (match ? getMatchTeams(match, standings) : { home: null, away: null }), [match, standings]);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [status, setStatus] = useState<Match["status"]>("scheduled");
  const [penaltyWinnerId, setPenaltyWinnerId] = useState("");
  const [predictionHome, setPredictionHome] = useState("");
  const [predictionAway, setPredictionAway] = useState("");
  const [predictionWinnerId, setPredictionWinnerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const ownPrediction = match ? findPrediction(predictions, session.userKey, match.id) : undefined;
  const locked = match ? isPredictionLocked(match) : true;
  const isKnockout = match ? match.phase !== "group" : false;
  const resolvedHome = teams.home as Team | null;
  const resolvedAway = teams.away as Team | null;
  const venueInfo = getVenueInfo(match?.venue ?? "");

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

          <section className="rounded-lg border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">
            <h3 className="mb-3 text-sm font-black uppercase text-slate-600">Final Score</h3>
            <div className="grid grid-cols-[1fr_72px_72px] items-center gap-2">
              <span className="truncate font-bold">
                <span className="mr-2">{resolvedHome?.flag}</span>
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
                <span className="mr-2">{resolvedAway?.flag}</span>
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
              Save Result
            </Button>
          </section>

          <section className="rounded-lg border border-cup-gold/40 bg-gradient-to-br from-amber-50 to-white p-4">
            <h3 className="mb-3 text-sm font-black uppercase text-slate-600">{session.displayName} Prediction</h3>
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

          {message ? <div className="saved-pop rounded-md bg-cup-sky p-3 text-sm font-bold text-cup-ink">{message}</div> : null}
        </div>
      </aside>
    </div>
  );
}
