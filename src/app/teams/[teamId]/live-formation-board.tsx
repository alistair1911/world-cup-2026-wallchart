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

function groupPlayers(players: SquadBoardPlayer[]) {
  return {
    GK: players.filter((player) => player.position === "GK"),
    DF: players.filter((player) => player.position === "DF" || ["CB", "LB", "RB"].includes(player.position)),
    MF: players.filter((player) => player.position === "MF" || ["DM", "CM", "AM"].includes(player.position)),
    FW: players.filter((player) => player.position === "FW" || ["LW", "RW", "ST"].includes(player.position))
  };
}

function parseFormation(formation: string) {
  const parts = formation
    .split("-")
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part) && part > 0);

  if (parts.length < 2) {
    return { defenders: 4, midfielders: 3, attackers: 3 };
  }

  return {
    defenders: parts[0] ?? 4,
    midfielders: parts.slice(1, -1).reduce((total, part) => total + part, 0) || parts[1] || 3,
    attackers: parts[parts.length - 1] ?? 3
  };
}

function takePlayers(players: SquadBoardPlayer[], count: number, used: Set<string>) {
  const picked = players.filter((player) => !used.has(player.key)).slice(0, count);
  picked.forEach((player) => used.add(player.key));
  return picked;
}

function comparableName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function curatedRank(curatedPlayers: PlayerProfile[]) {
  return new Map(curatedPlayers.map((player, index) => [comparableName(player.name), index]));
}

function sortByCuratedPriority(players: SquadBoardPlayer[], rank: Map<string, number>) {
  return [...players].sort((a, b) => {
    const aRank = rank.get(comparableName(a.name)) ?? 999;
    const bRank = rank.get(comparableName(b.name)) ?? 999;
    return aRank - bRank || (a.number ?? 99) - (b.number ?? 99) || a.name.localeCompare(b.name);
  });
}

function projectedLineup(players: SquadBoardPlayer[], formation: string, curatedPlayers: PlayerProfile[]) {
  const groups = groupPlayers(players);
  const shape = parseFormation(formation);
  const used = new Set<string>();
  const rank = curatedRank(curatedPlayers);

  const goalkeepers = takePlayers(sortByCuratedPriority(groups.GK, rank), 1, used);
  const defenders = takePlayers(sortByCuratedPriority(groups.DF, rank), shape.defenders, used);
  const midfielders = takePlayers(sortByCuratedPriority(groups.MF, rank), shape.midfielders, used);
  const attackers = takePlayers(sortByCuratedPriority(groups.FW, rank), shape.attackers, used);
  const selectedCount = goalkeepers.length + defenders.length + midfielders.length + attackers.length;

  if (selectedCount < 11) {
    const remaining = players.filter((player) => !used.has(player.key));
    const fillers = takePlayers(remaining, 11 - selectedCount, used);
    midfielders.push(...fillers);
  }

  return [
    { id: "FW", label: "Attack", top: "15%", players: attackers },
    { id: "MF", label: "Midfield", top: "39%", players: midfielders },
    { id: "DF", label: "Defence", top: "63%", players: defenders },
    { id: "GK", label: "Keeper", top: "84%", players: goalkeepers }
  ];
}

function SquadChip({ player }: { player: SquadBoardPlayer }) {
  const content = (
    <>
      <img
        src={player.photoUrl ?? avatarUrl(player.name)}
        alt={`${player.name} portrait`}
        className="h-9 w-9 shrink-0 rounded-full object-cover object-top ring-2 ring-cup-gold"
      />
      <div className="mt-1 min-w-0 text-center">
        <div className="truncate text-[10px] font-black leading-tight text-cup-ink">{player.name}</div>
        <div className="text-[9px] font-black uppercase text-cup-red">
          {player.number ? `#${player.number} ` : ""}
          {player.position}
        </div>
      </div>
    </>
  );

  return player.href ? (
    <Link href={player.href} className="interactive-pop block min-w-0 rounded-md bg-white/95 p-1.5 text-center shadow-sm ring-1 ring-white/50">
      {content}
    </Link>
  ) : (
    <div className="block min-w-0 rounded-md bg-white/95 p-1.5 text-center shadow-sm ring-1 ring-white/50">{content}</div>
  );
}

export function LiveFormationBoard({ teamId, formation, curatedPlayers }: LiveFormationBoardProps) {
  const { players, liveCount, loading } = useLiveSquad(teamId, curatedPlayers);
  const rows = projectedLineup(players, formation, curatedPlayers);

  return (
    <Panel className="overflow-hidden p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase text-slate-500">Formation Board</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {liveCount > 0 ? "Projected starting XI from live squad" : "Projected XI from curated watchlist"}
          </p>
        </div>
        <div className="rounded-md bg-cup-ink px-2 py-1 text-xs font-black text-cup-gold">{formation}</div>
      </div>

      <div className="relative min-h-[560px] overflow-hidden rounded-lg bg-gradient-to-b from-pitch-500 via-pitch-700 to-pitch-900 p-3 text-white">
        <div className="absolute inset-x-7 top-1/2 h-px bg-white/35" />
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35" />
        <div className="absolute inset-x-10 bottom-4 h-24 rounded-t-xl border-x border-t border-white/30" />
        <div className="absolute inset-x-10 top-4 h-24 rounded-b-xl border-x border-b border-white/30" />

        {loading ? (
          <div className="absolute inset-x-4 top-4 rounded-md bg-white/15 px-3 py-2 text-center text-xs font-black uppercase text-white/80">
            Loading squad
          </div>
        ) : null}

        {rows.map((row) => {
          return (
            <div key={row.id} className="absolute left-3 right-3 -translate-y-1/2" style={{ top: row.top }}>
              <div className="mb-1 text-center text-[10px] font-black uppercase text-white/70">
                {row.label}
              </div>
              <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${Math.max(1, row.players.length)}, minmax(0, 1fr))` }}
              >
                {row.players.map((player) => (
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
