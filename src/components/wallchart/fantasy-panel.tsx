"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Crown, Plus, Search, ShieldCheck, Sparkles, Star, Trash2, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import {
  FANTASY_ROUND_ID,
  FANTASY_SQUAD_SIZE,
  FANTASY_STARTERS,
  buildFantasyLeaderboard,
  fantasyPlayerOptions,
  isFantasyPlayerLocked,
  validateFantasyRoster
} from "@/lib/fantasy";
import { avatarUrl } from "@/lib/profile-data";
import type { FamilySession, FantasyPlayerMatchScore, FantasyRosterSlot, Match } from "@/lib/types";
import { Flag } from "./flag";

type FantasyPanelProps = {
  session: FamilySession;
  matches: Match[];
  rosters: FantasyRosterSlot[];
  scores: FantasyPlayerMatchScore[];
  onSaveRoster: (slots: FantasyRosterSlot[]) => Promise<void>;
  onSelectPlayer: (playerId: string) => void;
  onSelectTeam: (teamId: string) => void;
};

export function FantasyPanel({
  session,
  matches,
  rosters,
  scores,
  onSaveRoster,
  onSelectPlayer,
  onSelectTeam
}: FantasyPanelProps) {
  const options = useMemo(() => fantasyPlayerOptions(), []);
  const optionMap = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);
  const leaderboard = useMemo(() => buildFantasyLeaderboard(rosters, scores), [rosters, scores]);
  const ownRoster = useMemo(
    () => rosters.filter((slot) => slot.userKey === session.userKey).sort((a, b) => a.slotIndex - b.slotIndex),
    [rosters, session.userKey]
  );
  const [draft, setDraft] = useState<FantasyRosterSlot[]>(ownRoster);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | "GK" | "DEF" | "MID" | "FWD">("ALL");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(ownRoster);
  }, [ownRoster]);

  const selectedIds = new Set(draft.map((slot) => slot.playerId));
  const visibleOptions = options
    .filter((option) => (filter === "ALL" ? true : option.fantasyPosition === filter))
    .filter((option) => {
      const text = `${option.name} ${option.team.name} ${option.team.code} ${option.position}`.toLowerCase();
      return text.includes(query.trim().toLowerCase());
    })
    .slice(0, 36);

  const starters = draft.filter((slot) => slot.isStarter).length;
  const rosterError = validateFantasyRoster(draft, matches);

  function addPlayer(playerId: string) {
    if (selectedIds.has(playerId) || draft.length >= FANTASY_SQUAD_SIZE) {
      return;
    }

    const next: FantasyRosterSlot = {
      userKey: session.userKey,
      playerId,
      roundId: FANTASY_ROUND_ID,
      slotIndex: draft.length,
      isStarter: draft.length < FANTASY_STARTERS,
      isCaptain: draft.length === 0,
      isViceCaptain: draft.length === 1,
      updatedAt: new Date().toISOString()
    };
    setDraft([...draft, next]);
  }

  function removePlayer(playerId: string) {
    const player = optionMap.get(playerId);
    if (isFantasyPlayerLocked(playerId, matches)) {
      setMessage(`${player?.name ?? "That player"} is locked for the next match.`);
      return;
    }

    const next = draft.filter((slot) => slot.playerId !== playerId).map((slot, index) => ({ ...slot, slotIndex: index }));
    if (next.length > 0 && !next.some((slot) => slot.isCaptain)) {
      next[0].isCaptain = true;
    }
    setDraft(next);
  }

  function setCaptain(playerId: string) {
    if (isFantasyPlayerLocked(playerId, matches)) {
      setMessage("Captain is locked for this player.");
      return;
    }
    setDraft(draft.map((slot) => ({ ...slot, isCaptain: slot.playerId === playerId, isViceCaptain: false })));
  }

  function toggleStarter(playerId: string) {
    if (isFantasyPlayerLocked(playerId, matches)) {
      setMessage("Starter status is locked for this player.");
      return;
    }
    setDraft((current) => {
      const currentSlot = current.find((slot) => slot.playerId === playerId);
      if (!currentSlot) {
        return current;
      }
      if (!currentSlot.isStarter && current.filter((slot) => slot.isStarter).length >= FANTASY_STARTERS) {
        setMessage(`Only ${FANTASY_STARTERS} starters are allowed.`);
        return current;
      }
      return current.map((slot) => (slot.playerId === playerId ? { ...slot, isStarter: !slot.isStarter } : slot));
    });
  }

  async function handleSave() {
    const error = validateFantasyRoster(draft, matches);
    if (error) {
      setMessage(error);
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await onSaveRoster(draft);
      setMessage("Mini-Fantasy squad saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save Mini-Fantasy squad.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel className="overflow-hidden p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-cup-gold" />
          <h2 className="text-base font-black">Mini-Fantasy</h2>
        </div>
        <Badge tone="green">{draft.length}/{FANTASY_SQUAD_SIZE}</Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {leaderboard.map((row, index) => (
          <div
            key={row.userKey}
            className={`rounded-md border p-2.5 ${
              index === 0 ? "border-cup-gold bg-gradient-to-br from-amber-100 to-white" : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-black">{row.displayName}</div>
                <div className="truncate text-[10px] font-black uppercase text-slate-500">
                  {row.captain ? `Captain ${row.captain.name}` : "No captain yet"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-cup-red">{row.points}</div>
                <div className="text-[9px] font-black uppercase text-slate-400">Fantasy pts</div>
              </div>
            </div>
            {row.bestPlayer ? (
              <div className="mt-2 flex items-center gap-2 rounded-md bg-white/80 p-2 ring-1 ring-black/5">
                <img
                  src={row.bestPlayer.photoUrl ?? avatarUrl(row.bestPlayer.name)}
                  alt={`${row.bestPlayer.name} portrait`}
                  className="h-7 w-7 rounded-full object-cover object-top"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-black">{row.bestPlayer.name}</div>
                  <div className="text-[10px] font-bold text-slate-500">Best pick - {row.bestPlayer.points} pts</div>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-gradient-to-br from-white to-cup-sky p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black uppercase text-slate-600">{session.displayName}'s Squad</h3>
            <p className="text-xs font-bold text-slate-500">{starters}/{FANTASY_STARTERS} starters, captain doubles points</p>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving || Boolean(rosterError)}>
            <Check className="h-4 w-4" />
            Save
          </Button>
        </div>

        {rosterError ? <div className="mb-2 rounded-md bg-red-50 p-2 text-xs font-bold text-red-700">{rosterError}</div> : null}
        {message ? <div className="mb-2 rounded-md bg-white p-2 text-xs font-bold text-cup-ink ring-1 ring-slate-200">{message}</div> : null}

        <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {draft.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-white/70 p-4 text-center text-xs font-bold text-slate-500">
              Pick your first player below.
            </div>
          ) : (
            draft.map((slot) => {
              const player = optionMap.get(slot.playerId);
              if (!player) {
                return null;
              }
              const locked = isFantasyPlayerLocked(player.id, matches);
              return (
                <div key={slot.playerId} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md bg-white p-2 ring-1 ring-slate-200">
                  <button type="button" onClick={() => onSelectPlayer(player.id)} className="min-w-0 text-left">
                    <div className="flex min-w-0 items-center gap-2">
                      <img
                        src={player.photoUrl ?? avatarUrl(player.name)}
                        alt={`${player.name} portrait`}
                        className="h-8 w-8 shrink-0 rounded-full object-cover object-top"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-black text-cup-ink">
                          {slot.isCaptain ? "C " : ""}
                          {player.name}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                          <Flag team={player.team} />
                          <span>{player.team.code}</span>
                          <span>{player.fantasyPosition}</span>
                          {locked ? <span className="text-cup-red">Locked</span> : null}
                        </div>
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-1">
                    <Button variant={slot.isStarter ? "secondary" : "ghost"} size="icon" onClick={() => toggleStarter(player.id)} aria-label="Toggle starter">
                      <ShieldCheck className="h-4 w-4" />
                    </Button>
                    <Button variant={slot.isCaptain ? "secondary" : "ghost"} size="icon" onClick={() => setCaptain(player.id)} aria-label="Set captain">
                      <Crown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removePlayer(player.id)} aria-label="Remove player">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-2 grid grid-cols-[1fr_auto] gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search players or teams" className="pl-9" />
          </div>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
            className="h-10 rounded-md border border-slate-200 bg-white px-2 text-xs font-black text-cup-ink"
          >
            {["ALL", "GK", "DEF", "MID", "FWD"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {visibleOptions.map((player) => {
            const selected = selectedIds.has(player.id);
            const locked = isFantasyPlayerLocked(player.id, matches);
            return (
              <div key={player.id} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md bg-white p-2 ring-1 ring-slate-200">
                <button type="button" onClick={() => onSelectTeam(player.team.id)} className="min-w-0 text-left">
                  <div className="flex min-w-0 items-center gap-2">
                    <img
                      src={player.photoUrl ?? avatarUrl(player.name)}
                      alt={`${player.name} portrait`}
                      className="h-8 w-8 rounded-full object-cover object-top"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-black text-cup-ink">{player.name}</div>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                        <Flag team={player.team} />
                        <span>{player.team.code}</span>
                        <span>{player.fantasyPosition}</span>
                        {locked ? <span className="text-cup-red">Locked</span> : null}
                      </div>
                    </div>
                  </div>
                </button>
                <Button
                  size="sm"
                  variant={selected ? "secondary" : "ghost"}
                  onClick={() => addPlayer(player.id)}
                  disabled={selected || locked || draft.length >= FANTASY_SQUAD_SIZE}
                >
                  {selected ? <Star className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-md bg-slate-50 p-2 text-[10px] font-bold text-slate-500">
        <UsersRound className="h-4 w-4 shrink-0 text-cup-red" />
        Tata and Lucas can both pick the same players. ESPN-confirmed stats update after matches.
      </div>
    </Panel>
  );
}
