import { FAMILY_USERS } from "./tournament-data";
import { getWinnerTeamId } from "./standings";
import type { Match, Prediction, ScoreResult, UserKey } from "./types";

function outcome(home: number, away: number) {
  if (home > away) {
    return "home";
  }
  if (away > home) {
    return "away";
  }
  return "draw";
}

export function scorePrediction(match: Match, prediction?: Prediction): ScoreResult {
  if (
    !prediction ||
    match.status !== "final" ||
    match.homeScore === null ||
    match.awayScore === null ||
    prediction.homeScore === null ||
    prediction.awayScore === null
  ) {
    return {
      points: 0,
      basePoints: 0,
      knockoutBonus: 0,
      status: "Pending",
      exact: false,
      correctOutcome: false,
      explanation: "Waiting for a final score."
    };
  }

  const actualOutcome = outcome(match.homeScore, match.awayScore);
  const predictedOutcome = outcome(prediction.homeScore, prediction.awayScore);
  const actualMargin = match.homeScore - match.awayScore;
  const predictedMargin = prediction.homeScore - prediction.awayScore;

  const exact = match.homeScore === prediction.homeScore && match.awayScore === prediction.awayScore;
  const correctOutcome = actualOutcome === predictedOutcome;
  const sameMargin = actualMargin === predictedMargin;

  let basePoints = 0;
  let status: ScoreResult["status"] = "Missed";
  let explanation = "Missed the result.";

  if (exact) {
    basePoints = 5;
    status = "Exact";
    explanation = "Exact score.";
  } else if (correctOutcome && sameMargin) {
    basePoints = 3;
    status = "Close";
    explanation = actualOutcome === "draw" ? "Correct draw." : "Correct winner and margin.";
  } else if (correctOutcome) {
    basePoints = 2;
    status = "Correct winner";
    explanation = actualOutcome === "draw" ? "Correct draw result." : "Correct winner.";
  }

  const actualWinner = getWinnerTeamId(match);
  const knockoutBonus =
    match.phase !== "group" && actualWinner && prediction.predictedWinnerTeamId === actualWinner ? 2 : 0;

  return {
    points: basePoints + knockoutBonus,
    basePoints,
    knockoutBonus,
    status,
    exact,
    correctOutcome,
    explanation: knockoutBonus ? `${explanation} + knockout advancer bonus.` : explanation
  };
}

export function buildLeaderboard(matches: Match[], predictions: Prediction[]) {
  return FAMILY_USERS.map((user) => {
    const scored = predictions
      .filter((prediction) => prediction.userKey === user.key)
      .map((prediction) => {
        const match = matches.find((item) => item.id === prediction.matchId);
        return match ? scorePrediction(match, prediction) : null;
      })
      .filter((result): result is ScoreResult => Boolean(result));

    return {
      ...user,
      points: scored.reduce((sum, result) => sum + result.points, 0),
      exact: scored.filter((result) => result.exact).length,
      correctOutcomes: scored.filter((result) => result.correctOutcome).length
    };
  }).sort((a, b) => b.points - a.points || b.exact - a.exact || b.correctOutcomes - a.correctOutcomes);
}

export function findPrediction(predictions: Prediction[], userKey: UserKey, matchId: string) {
  return predictions.find((prediction) => prediction.userKey === userKey && prediction.matchId === matchId);
}
