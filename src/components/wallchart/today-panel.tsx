import { CalendarDays } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import type { GroupLetter, Match, StandingRow } from "@/lib/types";
import { MatchCard } from "./match-card";

type TodayPanelProps = {
  matches: Match[];
  standings: Record<GroupLetter, StandingRow[]>;
  onSelectMatch: (match: Match) => void;
  commentCounts?: Record<string, number>;
};

export function TodayPanel({ matches, standings, onSelectMatch, commentCounts = {} }: TodayPanelProps) {
  const upcoming = matches
    .filter((match) => match.status !== "final")
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
    .slice(0, 8);

  return (
    <Panel className="overflow-hidden p-4">
      <div className="mb-3 flex items-center gap-2 rounded-md bg-cup-ink px-3 py-2 text-white">
        <CalendarDays className="h-5 w-5 text-cup-gold" />
        <h2 className="text-base font-black">Next Matches</h2>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {upcoming.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            standings={standings}
            onSelect={onSelectMatch}
            commentCount={commentCounts[match.id] ?? 0}
          />
        ))}
      </div>
    </Panel>
  );
}
