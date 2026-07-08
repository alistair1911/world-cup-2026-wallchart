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

function predictedKnockoutWinnerTeamId(match: Match, prediction: Prediction, predictedOutcome: "home" | "away" | "draw") {
  if (predictedOutcome === "home") {
    return match.homeTeamId ?? null;
  }
  if (predictedOutcome === "away") {
    return match.awayTeamId ?? null;
  }
  return prediction.predictedWinnerTeamId ?? null;
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
  const isKnockout = match.phase !== "group";
  const actualWinner = getWinnerTeamId(match);
  const predictedKnockoutWinner = isKnockout ? predictedKnockoutWinnerTeamId(match, prediction, predictedOutcome) : null;
  const correctKnockoutAdvancer = Boolean(actualWinner && predictedKnockoutWinner === actualWinner);

  const rawExact = match.homeScore === prediction.homeScore && match.awayScore === prediction.awayScore;
  const exact = rawExact && (!isKnockout || actualOutcome !== "draw" || correctKnockoutAdvancer);
  const correctOutcome = actualOutcome === predictedOutcome;
  const sameMargin = actualMargin === predictedMargin;

  let basePoints = 0;
  let status: ScoreResult["status"] = "Missed";
  let explanation = "Missed the result.";

  if (isKnockout && actualOutcome === "draw") {
    if (predictedOutcome === "draw") {
      basePoints = 3;
      status = correctKnockoutAdvancer && rawExact ? "Exact" : "Close";
      explanation = correctKnockoutAdvancer
        ? rawExact
          ? "Exact 90-minute draw and correct advancer."
          : "Correct 90-minute draw and correct advancer."
        : rawExact
          ? "Exact 90-minute score, but wrong advancer."
          : "Correct 90-minute draw, but wrong advancer.";
    } else if (correctKnockoutAdvancer) {
      status = "Correct winner";
      explanation = "Correct team to advance after the knockout draw.";
    }
  } else if (exact) {
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

  const knockoutBonus =
    isKnockout && actualOutcome === "draw" && predictedOutcome === "draw" && correctKnockoutAdvancer ? 2 : 0;
  const knockoutAdvancerOnlyPoints =
    isKnockout && actualOutcome === "draw" && predictedOutcome !== "draw" && correctKnockoutAdvancer ? 2 : 0;

  return {
    points: basePoints + knockoutBonus + knockoutAdvancerOnlyPoints,
    basePoints,
    knockoutBonus: knockoutBonus + knockoutAdvancerOnlyPoints,
    status,
    exact,
    correctOutcome,
    explanation:
      knockoutBonus > 0
        ? `${explanation} + knockout advancer bonus.`
        : knockoutAdvancerOnlyPoints > 0
          ? `${explanation} + correct advancer.`
          : explanation
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
