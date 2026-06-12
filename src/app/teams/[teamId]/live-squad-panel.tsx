"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import { avatarUrl, type PlayerProfile } from "@/lib/profile-data";

type LiveSquadPlayer = {
  id: string;
  name: string;
  age: number | null;
  number: number | null;
  position: string;
  photoUrl: string | null;
};

type SquadPayload = {
  ok: boolean;
  source?: string;
  players?: LiveSquadPlayer[];
  error?: string;
};

type LiveSquadPanelProps = {
  teamId: string;
  teamName: string;
  curatedPlayers: PlayerProfile[];
};

function normalizePosition(position: string) {
  const value = position.toLowerCase();
  if (value.includes("goal")) {
    return "GK";
  }
  if (value.includes("def")) {
    return "DF";
  }
  if (value.includes("mid")) {
    return "MF";
  }
  if (value.includes("att") || value.includes("forward")) {
    return "FW";
  }
  return position || "Player";
}

export function LiveSquadPanel({ teamId, teamName, curatedPlayers }: LiveSquadPanelProps) {
  const [players, setPlayers] = useState<LiveSquadPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSquad() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/teams/${teamId}/squad`);
        const payload = (await response.json()) as SquadPayload;
        if (!isMounted) {
          return;
        }
        if (!payload.ok) {
          setError(payload.error ?? "Could not load live squad.");
          setPlayers([]);
          return;
        }
        setPlayers(payload.players ?? []);
      } catch {
        if (isMounted) {
          setError("Could not load live squad.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadSquad();
    return () => {
      isMounted = false;
    };
  }, [teamId]);

  const rows = useMemo(() => {
    if (players.length > 0) {
      return players.map((player) => ({
        key: player.id,
        name: player.name,
        number: player.number,
        position: normalizePosition(player.position),
        detail: player.age ? `${player.age} yrs` : "Squad player",
        photoUrl: player.photoUrl,
        href: null
      }));
    }

    return curatedPlayers.map((player) => ({
      key: player.id,
      name: player.name,
      number: player.shirtNumber ?? null,
      position: player.position,
      detail: player.role,
      photoUrl: player.photoUrl ?? avatarUrl(player.name),
      href: `/players/${player.id}`
    }));
  }, [curatedPlayers, players, teamId]);

  return (
    <Panel className="p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase text-slate-500">Full Squad</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {players.length > 0 ? "Loaded from API-Football with player photos." : `Curated ${teamName} watchlist shown.`}
          </p>
        </div>
        {loading ? <span className="rounded-full bg-cup-sky px-2 py-1 text-[10px] font-black text-cup-ink">Loading</span> : null}
      </div>

      {error ? <div className="mb-3 rounded-md bg-amber-50 p-2 text-xs font-bold text-amber-800">{error}</div> : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((player) => {
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
