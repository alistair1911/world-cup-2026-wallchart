import { Panel } from "@/components/ui/panel";
import type { GroupLetter, Match, StandingRow } from "@/lib/types";
import { Flag } from "./flag";
import { MatchCard } from "./match-card";

type GroupPanelProps = {
  group: GroupLetter;
  rows: StandingRow[];
  matches: Match[];
  standings: Record<GroupLetter, StandingRow[]>;
  onSelectMatch: (match: Match) => void;
  commentCounts?: Record<string, number>;
};

const groupThemes: Record<GroupLetter, string> = {
  A: "from-red-600 to-red-500",
  B: "from-sky-600 to-blue-500",
  C: "from-emerald-700 to-green-500",
  D: "from-indigo-700 to-blue-600",
  E: "from-stone-800 to-amber-700",
  F: "from-orange-600 to-amber-500",
  G: "from-slate-800 to-slate-600",
  H: "from-fuchsia-700 to-rose-500",
  I: "from-cyan-700 to-sky-500",
  J: "from-red-700 to-orange-500",
  K: "from-violet-700 to-indigo-500",
  L: "from-lime-700 to-emerald-500"
};

export function GroupPanel({ group, rows, matches, standings, onSelectMatch, commentCounts = {} }: GroupPanelProps) {
  return (
    <Panel className="interactive-pop overflow-hidden">
      <div className={`flex items-center justify-between bg-gradient-to-r ${groupThemes[group]} px-3 py-2 text-white`}>
        <h2 className="text-sm font-black tracking-wide">Group {group}</h2>
        <span className="text-[11px] font-bold text-white/70">P GD PTS</span>
      </div>
      <div className="p-3">
        <table className="mb-3 w-full table-fixed text-xs">
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.team.id}
                className={`border-b border-slate-100 last:border-0 ${index < 2 ? "bg-emerald-50/70" : ""} ${
                  index === 2 ? "bg-amber-50/70" : ""
                }`}
              >
                <td className="w-6 rounded-l py-1 pl-1 font-black text-slate-400">{index + 1}</td>
                <td className="truncate py-1 font-bold">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Flag team={row.team} />
                    <span className="truncate">{row.team.code}</span>
                  </span>
                </td>
                <td className="w-7 py-1 text-center">{row.played}</td>
                <td className="w-9 py-1 text-center">{row.goalDifference}</td>
                <td className="w-9 rounded-r py-1 text-center font-black">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="space-y-2">
          {matches.map((match) => (
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
      </div>
    </Panel>
  );
}
