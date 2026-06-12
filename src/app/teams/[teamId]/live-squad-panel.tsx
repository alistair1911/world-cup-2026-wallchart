"use client";

import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import { avatarUrl, type PlayerProfile } from "@/lib/profile-data";
import { useLiveSquad } from "./use-live-squad";

type LiveSquadPanelProps = {
  teamId: string;
  teamName: string;
  curatedPlayers: PlayerProfile[];
};

export function LiveSquadPanel({ teamId, teamName, curatedPlayers }: LiveSquadPanelProps) {
  const { players, liveCount, loading, error } = useLiveSquad(teamId, curatedPlayers);

  return (
    <Panel className="p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase text-slate-500">Full Squad</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {liveCount > 0 ? "Loaded from API-Football with player photos." : `Curated ${teamName} watchlist shown.`}
          </p>
        </div>
        {loading ? <span className="rounded-full bg-cup-sky px-2 py-1 text-[10px] font-black text-cup-ink">Loading</span> : null}
      </div>

      {error ? <div className="mb-3 rounded-md bg-amber-50 p-2 text-xs font-bold text-amber-800">{error}</div> : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((player) => {
          const content = (
            <>
              <img
                src={player.photoUrl ?? avatarUrl(player.name)}
                alt={`${player.name} portrait`}
                className="h-12 w-12 shrink-0 rounded-lg object-cover object-top ring-1 ring-black/10"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  {player.number ? <span className="text-[10px] font-black text-cup-red">#{player.number}</span> : null}
                  <div className="truncate text-xs font-black text-cup-ink">{player.name}</div>
                </div>
                <div className="mt-1 text-[10px] font-bold text-slate-500">
                  {player.position} - {player.detail}
                </div>
              </div>
            </>
          );

          return player.href ? (
            <Link key={player.key} href={player.href} className="interactive-pop flex items-center gap-2 rounded-md bg-white p-2 ring-1 ring-slate-200">
              {content}
            </Link>
          ) : (
            <div key={player.key} className="flex items-center gap-2 rounded-md bg-white p-2 ring-1 ring-slate-200">
              {content}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
