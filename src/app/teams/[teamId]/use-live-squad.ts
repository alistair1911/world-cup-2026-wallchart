"use client";

import { useEffect, useMemo, useState } from "react";
import { avatarUrl, type PlayerProfile } from "@/lib/profile-data";

export type LiveSquadPlayer = {
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

type CachedSquad = {
  savedAt: number;
  players: LiveSquadPlayer[];
};

const COMPLETE_SQUAD_MINIMUM = 11;
const SQUAD_CACHE_DAYS = 7;
const SQUAD_CACHE_MS = SQUAD_CACHE_DAYS * 24 * 60 * 60 * 1000;

export type SquadBoardPlayer = {
  key: string;
  name: string;
  number: number | null;
  position: string;
  detail: string;
  photoUrl: string | null;
  href: string | null;
};

export function normalizeSquadPosition(position: string) {
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

function squadCacheKey(teamId: string) {
  return `wc26:squad:${teamId}`;
}

function readCachedSquad(teamId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(squadCacheKey(teamId));
    if (!value) {
      return null;
    }

    const cached = JSON.parse(value) as CachedSquad;
    if (!Array.isArray(cached.players) || cached.players.length < COMPLETE_SQUAD_MINIMUM) {
      return null;
    }

    if (Date.now() - cached.savedAt > SQUAD_CACHE_MS) {
      window.localStorage.removeItem(squadCacheKey(teamId));
      return null;
    }

    return cached.players;
  } catch {
    return null;
  }
}

function writeCachedSquad(teamId: string, players: LiveSquadPlayer[]) {
  if (typeof window === "undefined" || players.length < COMPLETE_SQUAD_MINIMUM) {
    return;
  }

  try {
    window.localStorage.setItem(
      squadCacheKey(teamId),
      JSON.stringify({
        savedAt: Date.now(),
        players
      } satisfies CachedSquad)
    );
  } catch {
    // If storage is unavailable, the curated squad still keeps the board usable.
  }
}

export function useLiveSquad(teamId: string, curatedPlayers: PlayerProfile[]) {
  const [players, setPlayers] = useState<LiveSquadPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSquad() {
      const cachedPlayers = readCachedSquad(teamId);
      if (cachedPlayers) {
        setPlayers(cachedPlayers);
        setLoading(false);
        return;
      }

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
        const nextPlayers = payload.players ?? [];
        if (nextPlayers.length >= COMPLETE_SQUAD_MINIMUM) {
          writeCachedSquad(teamId, nextPlayers);
          setPlayers(nextPlayers);
          return;
        }

        setPlayers([]);
        if (nextPlayers.length > 0) {
          setError(`API-Football only returned ${nextPlayers.length} players, so the saved watchlist is shown.`);
        }
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

  const rows = useMemo<SquadBoardPlayer[]>(() => {
    if (players.length > 0) {
      return players.map((player) => ({
        key: player.id,
        name: player.name,
        number: player.number,
        position: normalizeSquadPosition(player.position),
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
  }, [curatedPlayers, players]);

  return {
    players: rows,
    liveCount: players.length,
    loading,
    error
  };
}
