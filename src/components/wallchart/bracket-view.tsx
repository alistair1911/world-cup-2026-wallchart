import { Panel } from "@/components/ui/panel";
import type { GroupLetter, Match, MatchPhase, StandingRow } from "@/lib/types";
import { MatchCard } from "./match-card";

const phaseColumns: Array<{ phase: MatchPhase; title: string; theme: string }> = [
  { phase: "round32", title: "Round of 32", theme: "from-sky-600 to-blue-500" },
  { phase: "round16", title: "Round of 16", theme: "from-indigo-700 to-blue-600" },
  { phase: "quarter", title: "Quarter-finals", theme: "from-amber-600 to-orange-500" },
  { phase: "semi", title: "Semi-finals", theme: "from-red-700 to-rose-500" },
  { phase: "final", title: "Final", theme: "from-cup-gold to-amber-300" }
];

type BracketViewProps = {
  matches: Match[];
  standings: Record<GroupLetter, StandingRow[]>;
  onSelectMatch: (match: Match) => void;
  commentCounts?: Record<string, number>;
};

export function BracketView({ matches, standings, onSelectMatch, commentCounts = {} }: BracketViewProps) {
  return (
    <div className="grid min-w-[980px] grid-cols-5 gap-3">
      {phaseColumns.map((column) => {
        const columnMatches = matches.filter((match) => match.phase === column.phase);

        return (
          <Panel key={column.phase} className="overflow-hidden p-0">
            <h2 className={`mb-3 bg-gradient-to-r ${column.theme} px-3 py-2 text-center text-sm font-black uppercase text-white`}>
              {column.title}
            </h2>
            <div className="space-y-3 p-3 pt-0">
              {columnMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  standings={standings}
                  onSelect={onSelectMatch}
                  compact
                  commentCount={commentCounts[match.id] ?? 0}
                />
              ))}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
