"use client";

import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import { avatarUrl, type PlayerProfile } from "@/lib/profile-data";
import { useLiveSquad, type SquadBoardPlayer } from "./use-live-squad";

type LiveFormationBoardProps = {
  teamId: string;
  formation: string;
  curatedPlayers: PlayerProfile[];
};

const POSITION_ROWS: Array<{
  id: "FW" | "MF" | "DF" | "GK";
  label: string;
  top: string;
}> = [
  { id: "FW", label: "Attackers", top: "18%" },
  { id: "MF", label: "Midfielders", top: "42%" },
  { id: "DF", label: "Defenders", top: "66%" },
  { id: "GK", label: "Goalkeepers", top: "86%" }
];

function groupPlayers(players: SquadBoardPlayer[]) {
  return {
    GK: players.filter((player) => player.position === "GK"),
    DF: players.filter((player) => player.position === "DF" || ["CB", "LB", "RB"].includes(player.position)),
    MF: players.filter((player) => player.position === "MF" || ["DM", "CM", "AM"].includes(player.position)),
    FW: players.filter((player) => player.position === "FW" || ["LW", "RW", "ST"].includes(player.position))
  };
}

function SquadChip({ player }: { player: SquadBoardPlayer }) {
  const content = (
    <>
      <img
        src={player.photoUrl ?? avatarUrl(player.name)}
        alt={`${player.name} portrait`}
        className="h-8 w-8 shrink-0 rounded-full object-cover object-top ring-2 ring-cup-gold"
      />
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1">
          {player.number ? <span className="text-[9px] font-black text-cup-red">#{player.number}</span> : null}
          <span className="truncate text-[10px] font-black leading-tight text-cup-ink">{player.name}</span>
        </div>
        <div className="text-[9px] font-black uppercase text-slate-500">{player.position}</div>
      </div>
    </>
  );

  return player.href ? (
    <Link href={player.href} className="interactive-pop flex min-w-0 items-center gap-1.5 rounded-md bg-white/95 p-1.5 shadow-sm ring-1 ring-white/50">
      {content}
    </Link>
  ) : (
    <div className="flex min-w-0 items-center gap-1.5 rounded-md bg-white/95 p-1.5 shadow-sm ring-1 ring-white/50">{content}</div>
  );
}

export function LiveFormationBoard({ teamId, formation, curatedPlayers }: LiveFormationBoardProps) {
  const { players, liveCount, loading } = useLiveSquad(teamId, curatedPlayers);
  const groups = groupPlayers(players);

  return (
    <Panel className="overflow-hidden p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase text-slate-500">Formation Board</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {liveCount > 0 ? `${liveCount} squad players by position` : "Curated watchlist by position"}
          </p>
        </div>
        <div className="rounded-md bg-cup-ink px-2 py-1 text-xs font-black text-cup-gold">{formation}</div>
      </div>

      <div className="relative min-h-[620px] overflow-hidden rounded-lg bg-gradient-to-b from-pitch-500 via-pitch-700 to-pitch-900 p-3 text-white">
        <div className="absolute inset-x-7 top-1/2 h-px bg-white/35" />
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35" />
        <div className="absolute inset-x-10 bottom-4 h-24 rounded-t-xl border-x border-t border-white/30" />
        <div className="absolute inset-x-10 top-4 h-24 rounded-b-xl border-x border-b border-white/30" />

        {loading ? (
          <div className="absolute inset-x-4 top-4 rounded-md bg-white/15 px-3 py-2 text-center text-xs font-black uppercase text-white/80">
            Loading squad
          </div>
        ) : null}

        {POSITION_ROWS.map((row) => {
          const rowPlayers = groups[row.id];
          return (
            <div key={row.id} className="absolute left-3 right-3" style={{ top: row.top }}>
              <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase text-white/75">
                <span>{row.label}</span>
                <span>{rowPlayers.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {rowPlayers.map((player) => (
                  <SquadChip key={`${row.id}-${player.key}`} player={player} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
