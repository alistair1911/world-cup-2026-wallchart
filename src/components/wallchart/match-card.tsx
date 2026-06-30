import { MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { resolveSeed } from "@/lib/standings";
import { getTeam } from "@/lib/tournament-data";
import type { GroupLetter, Match, StandingRow, Team } from "@/lib/types";
import { formatKickoff } from "@/lib/utils";
import { TeamLine } from "./team-line";
import { VenuePhoto } from "./venue-photo";

type MatchCardProps = {
  match: Match;
  standings: Record<GroupLetter, StandingRow[]>;
  onSelect: (match: Match) => void;
  compact?: boolean;
  commentCount?: number;
};

export function getMatchTeams(match: Match, standings: Record<GroupLetter, StandingRow[]>) {
  const home = getTeam(match.homeTeamId) ?? resolveSeed(match.homeSeed, standings);
  const away = getTeam(match.awayTeamId) ?? resolveSeed(match.awaySeed, standings);
  return { home, away };
}

export function MatchCard({ match, standings, onSelect, compact = false, commentCount = 0 }: MatchCardProps) {
  const { home, away } = getMatchTeams(match, standings);
  const scoreReady = match.homeScore !== null && match.awayScore !== null;
  const final = match.status === "final";
  const penaltyWinner = final && scoreReady && match.homeScore === match.awayScore ? getTeam(match.penaltyWinnerId) : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(match)}
      className={`interactive-pop w-full rounded-md border p-2 text-left shadow-sm ${
        final
          ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
          : "border-slate-200 bg-white hover:border-cup-gold"
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase text-slate-500">
        <span className="rounded bg-cup-ink px-1.5 py-0.5 text-white">M{match.matchNumber}</span>
        <VenuePhoto venue={match.venue} compact={compact} />
        <Badge tone={match.status === "final" ? "green" : match.status === "live" ? "gold" : "slate"}>
          {match.status}
        </Badge>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-center gap-2">
        <div className="min-w-0 space-y-1">
          <TeamLine team={home as Team | null} seedLabel={match.homeSeed?.label} compact={compact} />
          <TeamLine team={away as Team | null} seedLabel={match.awaySeed?.label} compact={compact} />
        </div>
        <div className="grid w-9 gap-1 text-center text-sm font-black text-cup-ink">
          <span className={`score-chip rounded px-1 ${final ? "score-chip-final bg-cup-gold" : "bg-slate-100"}`}>
            {scoreReady ? match.homeScore : "-"}
          </span>
          <span className={`score-chip rounded px-1 ${final ? "score-chip-final bg-cup-gold" : "bg-slate-100"}`}>
            {scoreReady ? match.awayScore : "-"}
          </span>
        </div>
      </div>
      {penaltyWinner ? (
        <div className="mt-2 rounded bg-cup-ink px-2 py-1 text-[10px] font-black uppercase text-cup-gold">
          Pens: {penaltyWinner.name}
        </div>
      ) : null}
      {!compact ? (
        <div className="mt-2 flex items-center justify-between gap-2 rounded bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
          <span className="truncate">{formatKickoff(match.kickoff)}</span>
          {commentCount > 0 ? (
            <span className="saved-pop inline-flex shrink-0 items-center gap-1 rounded-full bg-cup-gold px-2 py-0.5 text-cup-ink">
              <MessageCircle className="h-3 w-3" />
              {commentCount}
            </span>
          ) : null}
        </div>
      ) : commentCount > 0 ? (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-cup-gold px-2 py-0.5 text-[10px] font-black text-cup-ink">
          <MessageCircle className="h-3 w-3" />
          {commentCount}
        </div>
      ) : null}
    </button>
  );
}
