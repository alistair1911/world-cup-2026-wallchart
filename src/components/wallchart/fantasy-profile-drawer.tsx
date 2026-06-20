"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Crown, GripVertical, Move, Plus, Save, Search, ShieldCheck, Star, Trash2, Trophy, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FANTASY_ROUND_ID,
  FANTASY_SQUAD_SIZE,
  FANTASY_STARTERS,
  buildFantasyLeaderboard,
  fantasyPlayerOptions,
  isFantasyPlayerLocked,
  type FantasyPlayerOption
} from "@/lib/fantasy";
import { avatarUrl } from "@/lib/profile-data";
import type {
  FamilySession,
  FantasyPlayerMatchScore,
  FantasyRosterSlot,
  FantasyTeamSetting,
  Match,
  PlayerCatalogItem,
  UserKey
} from "@/lib/types";
import { Flag } from "./flag";

type FantasyProfileDrawerProps = {
  userKey: UserKey | null;
  session: FamilySession;
  matches: Match[];
  rosters: FantasyRosterSlot[];
  scores: FantasyPlayerMatchScore[];
  playerCatalog: PlayerCatalogItem[];
  teamSettings: FantasyTeamSetting[];
  onClose: () => void;
  onSaveRoster: (slots: FantasyRosterSlot[]) => Promise<void>;
  onSaveSettings: (settings: Pick<FantasyTeamSetting, "formation">) => Promise<void>;
  onSelectPlayer: (playerId: string) => void;
  onSelectTeam: (teamId: string) => void;
};

const FORMATIONS = ["4-3-3", "4-2-3-1", "3-4-3", "3-5-2", "4-4-2", "5-3-2"] as const;

const FORMATION_LINES: Record<string, Array<{ id: string; label: string; count: number }>> = {
  "4-3-3": [
    { id: "FW", label: "Attack", count: 3 },
    { id: "MID", label: "Midfield", count: 3 },
    { id: "DEF", label: "Defence", count: 4 },
    { id: "GK", label: "Keeper", count: 1 }
  ],
  "4-2-3-1": [
    { id: "ST", label: "Striker", count: 1 },
    { id: "AM", label: "Creators", count: 3 },
    { id: "DM", label: "Double pivot", count: 2 },
    { id: "DEF", label: "Defence", count: 4 },
    { id: "GK", label: "Keeper", count: 1 }
  ],
  "3-4-3": [
    { id: "FW", label: "Attack", count: 3 },
    { id: "MID", label: "Midfield", count: 4 },
    { id: "DEF", label: "Back three", count: 3 },
    { id: "GK", label: "Keeper", count: 1 }
  ],
  "3-5-2": [
    { id: "FW", label: "Front two", count: 2 },
    { id: "MID", label: "Midfield five", count: 5 },
    { id: "DEF", label: "Back three", count: 3 },
    { id: "GK", label: "Keeper", count: 1 }
  ],
  "4-4-2": [
    { id: "FW", label: "Front two", count: 2 },
    { id: "MID", label: "Midfield four", count: 4 },
    { id: "DEF", label: "Defence", count: 4 },
    { id: "GK", label: "Keeper", count: 1 }
  ],
  "5-3-2": [
    { id: "FW", label: "Front two", count: 2 },
    { id: "MID", label: "Midfield", count: 3 },
    { id: "DEF", label: "Back five", count: 5 },
    { id: "GK", label: "Keeper", count: 1 }
  ]
};

function familyName(userKey: UserKey) {
  return userKey === "tata" ? "Tata" : "Lucas";
}

function normalizeDraftSlots(
  slots: FantasyRosterSlot[],
  optionMap: Map<string, FantasyPlayerOption>,
  userKey: UserKey | null
) {
  const seen = new Set<string>();
  const validSlots = slots
    .filter((slot) => optionMap.has(slot.playerId))
    .filter((slot) => {
      if (seen.has(slot.playerId)) {
        return false;
      }
      seen.add(slot.playerId);
      return true;
    })
    .slice(0, FANTASY_SQUAD_SIZE);
  const board: Array<FantasyRosterSlot | null> = Array.from({ length: FANTASY_STARTERS }, () => null);
  const bench: FantasyRosterSlot[] = [];
  const now = new Date().toISOString();

  function nextOpenStarterIndex() {
    return board.findIndex((slot) => !slot);
  }

  for (const slot of validSlots.sort((a, b) => a.slotIndex - b.slotIndex)) {
    const normalized = { ...slot, userKey: userKey ?? slot.userKey, updatedAt: now };
    if (slot.isStarter) {
      const preferredIndex = slot.slotIndex >= 0 && slot.slotIndex < FANTASY_STARTERS ? slot.slotIndex : -1;
      const targetIndex = preferredIndex >= 0 && !board[preferredIndex] ? preferredIndex : nextOpenStarterIndex();
      if (targetIndex >= 0) {
        board[targetIndex] = { ...normalized, slotIndex: targetIndex, isStarter: true };
        continue;
      }
    }
    bench.push({ ...normalized, isStarter: false, isCaptain: false });
  }

  return [
    ...board.filter((slot): slot is FantasyRosterSlot => Boolean(slot)),
    ...bench.slice(0, FANTASY_SQUAD_SIZE - board.filter(Boolean).length).map((slot, index) => ({
      ...slot,
      slotIndex: FANTASY_STARTERS + index,
      isStarter: false
    }))
  ];
}

function playerTotals(playerId: string, scores: FantasyPlayerMatchScore[]) {
  const rows = scores.filter((score) => score.playerId === playerId);
  return {
    points: rows.reduce((total, score) => total + score.points, 0),
    goals: rows.reduce((total, score) => total + score.goals, 0),
    assists: rows.reduce((total, score) => total + score.assists, 0),
    cleanSheets: rows.filter((score) => score.cleanSheet).length
  };
}

export function FantasyProfileDrawer({
  userKey,
  session,
  matches,
  rosters,
  scores,
  playerCatalog,
  teamSettings,
  onClose,
  onSaveRoster,
  onSaveSettings,
  onSelectPlayer,
  onSelectTeam
}: FantasyProfileDrawerProps) {
  const options = useMemo(() => fantasyPlayerOptions(playerCatalog), [playerCatalog]);
  const optionMap = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);
  const leaderboard = useMemo(() => buildFantasyLeaderboard(rosters, scores, playerCatalog), [rosters, scores, playerCatalog]);
  const setting = userKey ? teamSettings.find((team) => team.userKey === userKey) : null;
  const savedFormation = setting?.formation ?? "4-3-3";
  const savedSlots = useMemo(
    () =>
      userKey
        ? normalizeDraftSlots(
            rosters.filter((slot) => slot.userKey === userKey).sort((a, b) => a.slotIndex - b.slotIndex),
            optionMap,
            userKey
          )
        : [],
    [optionMap, rosters, userKey]
  );
  const [draft, setDraft] = useState<FantasyRosterSlot[]>(savedSlots);
  const [formation, setFormation] = useState(savedFormation);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [activeMoveId, setActiveMoveId] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [playerSearch, setPlayerSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const countryOptions = useMemo(() => {
    const teams = new Map<string, FantasyPlayerOption["team"]>();
    for (const option of options) {
      teams.set(option.team.id, option.team);
    }
    return [...teams.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [options]);
  const playerPool = useMemo(() => {
    const search = playerSearch.trim().toLowerCase();
    return options
      .filter((option) => countryFilter === "all" || option.team.id === countryFilter)
      .filter((option) => positionFilter === "all" || option.fantasyPosition === positionFilter)
      .filter((option) => !search || `${option.name} ${option.team.name} ${option.team.code}`.toLowerCase().includes(search))
      .slice(0, 80);
  }, [countryFilter, options, playerSearch, positionFilter]);

  useEffect(() => {
    setDraft(savedSlots);
  }, [savedSlots]);

  useEffect(() => {
    setFormation(savedFormation);
  }, [savedFormation]);

  if (!userKey) {
    return null;
  }

  const canEdit = userKey === session.userKey;
  const row = leaderboard.find((item) => item.userKey === userKey);
  const normalizedDraft = normalizeDraftSlots(draft, optionMap, userKey);
  const boardSlots = Array.from({ length: FANTASY_STARTERS }, (_, index) => normalizedDraft.find((slot) => slot.isStarter && slot.slotIndex === index) ?? null);
  const starterSlots = boardSlots.filter((slot): slot is FantasyRosterSlot => Boolean(slot));
  const benchSlots = normalizedDraft.filter((slot) => !slot.isStarter);
  const selectedPlayerIds = new Set(normalizedDraft.map((slot) => slot.playerId));
  const selectedTeams = new Set(
    normalizedDraft
      .map((slot) => optionMap.get(slot.playerId)?.team)
      .filter((team): team is FantasyPlayerOption["team"] => Boolean(team))
      .map((team) => team.id)
  );
  const totals = normalizedDraft.reduce(
    (total, slot) => {
      const output = playerTotals(slot.playerId, scores);
      total.points += slot.isCaptain ? output.points * 2 : output.points;
      total.goals += output.goals;
      total.assists += output.assists;
      return total;
    },
    { points: 0, goals: 0, assists: 0 }
  );

  function lockedMessage(playerId: string) {
    const player = optionMap.get(playerId);
    setMessage(`${player?.name ?? "That player"} is locked close to kickoff.`);
  }

  function moveToStarter(playerId: string, targetIndex: number) {
    if (!canEdit) {
      return;
    }
    if (isFantasyPlayerLocked(playerId, matches, new Date(), playerCatalog)) {
      lockedMessage(playerId);
      return;
    }

    const playerSlot = normalizedDraft.find((slot) => slot.playerId === playerId);
    if (!playerSlot) {
      return;
    }

    const board = Array.from(
      { length: FANTASY_STARTERS },
      (_, index) => normalizedDraft.find((slot) => slot.isStarter && slot.slotIndex === index) ?? null
    );
    const bench = normalizedDraft.filter((slot) => !slot.isStarter && slot.playerId !== playerId);
    const sourceStarterIndex = board.findIndex((slot) => slot?.playerId === playerId);
    const targetSlot = board[targetIndex];
    const movedSlot = { ...playerSlot, slotIndex: targetIndex, isStarter: true };

    if (sourceStarterIndex >= 0 && sourceStarterIndex !== targetIndex) {
      board[sourceStarterIndex] = targetSlot ? { ...targetSlot, slotIndex: sourceStarterIndex, isStarter: true } : null;
      board[targetIndex] = movedSlot;
    } else if (sourceStarterIndex >= 0) {
      board[targetIndex] = movedSlot;
    } else if (targetSlot) {
      board[targetIndex] = movedSlot;
      bench.unshift({ ...targetSlot, slotIndex: FANTASY_STARTERS, isStarter: false, isCaptain: false, isViceCaptain: false });
    } else {
      board[targetIndex] = movedSlot;
    }

    setDraft(normalizeDraftSlots([...board.filter((slot): slot is FantasyRosterSlot => Boolean(slot)), ...bench], optionMap, userKey));
    setActiveMoveId(null);
    setDraggingId(null);
    setMessage(null);
  }

  function moveToBench(playerId: string) {
    if (!canEdit) {
      return;
    }
    if (isFantasyPlayerLocked(playerId, matches, new Date(), playerCatalog)) {
      lockedMessage(playerId);
      return;
    }

    const next = normalizedDraft.map((slot) =>
      slot.playerId === playerId ? { ...slot, slotIndex: FANTASY_STARTERS, isStarter: false, isCaptain: false, isViceCaptain: false } : slot
    );
    setDraft(normalizeDraftSlots(next, optionMap, userKey));
    setActiveMoveId(null);
    setDraggingId(null);
    setMessage(null);
  }

  function pickUpPlayer(playerId: string) {
    if (!canEdit) {
      return;
    }
    if (isFantasyPlayerLocked(playerId, matches, new Date(), playerCatalog)) {
      lockedMessage(playerId);
      return;
    }

    setActiveMoveId((current) => (current === playerId ? null : playerId));
    const player = optionMap.get(playerId);
    setMessage(`Moving ${player?.name ?? "player"}. Tap a pitch slot or the bench to snap them into place.`);
  }

  function addPlayer(playerId: string) {
    if (!canEdit) {
      return;
    }
    if (selectedPlayerIds.has(playerId)) {
      setMessage("That player is already in this Mini-Fantasy squad.");
      return;
    }
    if (normalizedDraft.length >= FANTASY_SQUAD_SIZE) {
      setMessage(`Mini-Fantasy squad is full at ${FANTASY_SQUAD_SIZE} players.`);
      return;
    }
    if (isFantasyPlayerLocked(playerId, matches, new Date(), playerCatalog)) {
      lockedMessage(playerId);
      return;
    }

    const nextSlot: FantasyRosterSlot = {
      userKey,
      playerId,
      roundId: FANTASY_ROUND_ID,
      slotIndex: normalizedDraft.length,
      isStarter: starterSlots.length < FANTASY_STARTERS,
      isCaptain: normalizedDraft.length === 0,
      isViceCaptain: normalizedDraft.length === 1,
      updatedAt: new Date().toISOString()
    };

    setDraft(normalizeDraftSlots([...normalizedDraft, nextSlot], optionMap, userKey));
    setMessage("Player added. Save when the squad looks right.");
  }

  function removePlayer(playerId: string) {
    if (!canEdit) {
      return;
    }
    if (isFantasyPlayerLocked(playerId, matches, new Date(), playerCatalog)) {
      lockedMessage(playerId);
      return;
    }

    const removed = normalizedDraft.find((slot) => slot.playerId === playerId);
    const next = normalizedDraft.filter((slot) => slot.playerId !== playerId);
    if (removed?.isCaptain && next.length > 0) {
      next[0] = { ...next[0], isCaptain: true, isViceCaptain: false };
    }
    setDraft(normalizeDraftSlots(next, optionMap, userKey));
    setActiveMoveId(null);
    setDraggingId(null);
    setMessage("Player removed. Save to publish the squad.");
  }

  function setCaptain(playerId: string) {
    if (!canEdit) {
      return;
    }
    if (isFantasyPlayerLocked(playerId, matches, new Date(), playerCatalog)) {
      lockedMessage(playerId);
      return;
    }
    setDraft(normalizedDraft.map((slot) => ({ ...slot, isCaptain: slot.playerId === playerId, isViceCaptain: false })));
  }

  async function handleSave() {
    if (!canEdit) {
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await onSaveRoster(normalizedDraft);
      await onSaveSettings({ formation });
      setMessage("Fantasy formation saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save Fantasy formation.");
    } finally {
      setSaving(false);
    }
  }

  let boardIndex = 0;

  return (
    <div className="fixed inset-0 z-[65] flex justify-end bg-cup-ink/45">
      <button type="button" aria-label="Close fantasy profile backdrop" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="saved-pop relative flex h-full w-full max-w-4xl flex-col overflow-y-auto bg-slate-50 shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/96 p-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase text-cup-red">Mini-Fantasy Profile</div>
              <h2 className="mt-1 truncate text-2xl font-black text-cup-ink">{familyName(userKey)} FC</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {normalizedDraft.length} players - {formation} - {row?.captain ? `Captain ${row.captain.name}` : "No captain yet"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canEdit ? (
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  Save
                </Button>
              ) : null}
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close fantasy profile drawer">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_300px]">
          <section className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-4">
              <MiniStat label="Fantasy pts" value={totals.points} />
              <MiniStat label="Goals" value={totals.goals} />
              <MiniStat label="Assists" value={totals.assists} />
              <MiniStat label="Countries" value={selectedTeams.size} />
            </div>

            <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-600">Formation Board</h3>
                  <p className="text-xs font-bold text-slate-500">
                    {canEdit
                      ? activeMoveId
                        ? "Tap a pitch slot or the bench to place the selected player."
                        : "Tap Move or drag players; they snap into the selected slot."
                      : "Read-only squad view."}
                  </p>
                </div>
                <select
                  value={formation}
                  onChange={(event) => setFormation(event.target.value)}
                  disabled={!canEdit}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-cup-ink disabled:opacity-60"
                  aria-label="Fantasy formation"
                >
                  {FORMATIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className="relative overflow-hidden rounded-lg p-3 text-white shadow-inner ring-1 ring-pitch-950 sm:p-4"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px), repeating-linear-gradient(90deg, #0c5f3e 0 54px, #0f7149 54px 108px)"
                }}
              >
                <div className="pointer-events-none absolute inset-3 rounded-md border-2 border-white/35" />
                <div className="pointer-events-none absolute inset-0 opacity-45">
                  <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-white" />
                  <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" />
                  <div className="absolute inset-x-10 top-3 h-16 rounded-b-2xl border-x-2 border-b-2 border-white" />
                  <div className="absolute inset-x-10 bottom-3 h-16 rounded-t-2xl border-x-2 border-t-2 border-white" />
                </div>
                <div className="relative space-y-3">
                  {FORMATION_LINES[formation].map((line) => {
                    const slots = Array.from({ length: line.count }, () => {
                      const slot = boardSlots[boardIndex] ?? null;
                      const index = boardIndex;
                      boardIndex += 1;
                      return { slot, index };
                    });

                    return (
                      <div key={line.id}>
                        <div className="mb-1 text-center text-[10px] font-black uppercase text-white/60">{line.label}</div>
                        <div className="mx-auto grid max-w-3xl gap-2" style={{ gridTemplateColumns: `repeat(${line.count}, minmax(0, 1fr))` }}>
                          {slots.map(({ slot, index }) => (
                            <PitchSlot
                              key={`${line.id}-${index}`}
                              slot={slot}
                              player={slot ? optionMap.get(slot.playerId) : undefined}
                              stats={slot ? playerTotals(slot.playerId, scores) : null}
                              canEdit={canEdit}
                              draggingId={draggingId}
                              activeMoveId={activeMoveId}
                              onDragStart={setDraggingId}
                              onDrop={(playerId) => moveToStarter(playerId, index)}
                              onPickUp={pickUpPlayer}
                              onRemove={removePlayer}
                              onSelectPlayer={onSelectPlayer}
                              onSetCaptain={setCaptain}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {message ? <div className="mt-3 rounded-md bg-cup-sky p-2 text-xs font-black text-cup-ink">{message}</div> : null}
            </div>
          </section>

          <aside className="space-y-4">
            <div
              className={`rounded-lg bg-white p-4 ring-1 transition ${
                activeMoveId ? "ring-2 ring-cup-gold shadow-lift" : "ring-slate-200"
              }`}
              role={canEdit ? "button" : undefined}
              tabIndex={canEdit && activeMoveId ? 0 : undefined}
              onClick={() => {
                if (activeMoveId) {
                  moveToBench(activeMoveId);
                }
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const playerId = event.dataTransfer.getData("text/plain") || draggingId;
                if (playerId) {
                  moveToBench(playerId);
                }
              }}
            >
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-cup-red" />
                <h3 className="text-sm font-black uppercase text-slate-600">Bench</h3>
              </div>
              <div className="space-y-2">
                {benchSlots.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-bold text-slate-500">
                    Drag a starter here to bench them.
                  </div>
                ) : (
                  benchSlots.map((slot) => (
                    <BenchRow
                      key={slot.playerId}
                      slot={slot}
                      player={optionMap.get(slot.playerId)}
                      stats={playerTotals(slot.playerId, scores)}
                      canEdit={canEdit}
                      activeMoveId={activeMoveId}
                      onDragStart={setDraggingId}
                      onPickUp={pickUpPlayer}
                      onRemove={removePlayer}
                      onSelectPlayer={onSelectPlayer}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-600">Add Players</h3>
                  <p className="text-xs font-bold text-slate-500">
                    {normalizedDraft.length}/{FANTASY_SQUAD_SIZE} selected - filter by country or position.
                  </p>
                </div>
                <Badge tone={normalizedDraft.length >= FANTASY_SQUAD_SIZE ? "red" : "green"}>{FANTASY_SQUAD_SIZE - normalizedDraft.length} spots</Badge>
              </div>
              <div className="grid gap-2">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={playerSearch}
                    onChange={(event) => setPlayerSearch(event.target.value)}
                    placeholder="Search player or team"
                    className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-xs font-bold text-cup-ink outline-none focus:ring-2 focus:ring-cup-gold"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={countryFilter}
                    onChange={(event) => setCountryFilter(event.target.value)}
                    className="h-10 rounded-md border border-slate-200 bg-white px-2 text-xs font-black text-cup-ink"
                    aria-label="Filter fantasy players by country"
                  >
                    <option value="all">All countries</option>
                    {countryOptions.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.flag} {team.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={positionFilter}
                    onChange={(event) => setPositionFilter(event.target.value)}
                    className="h-10 rounded-md border border-slate-200 bg-white px-2 text-xs font-black text-cup-ink"
                    aria-label="Filter fantasy players by position"
                  >
                    <option value="all">All roles</option>
                    <option value="GK">GK</option>
                    <option value="DEF">DEF</option>
                    <option value="MID">MID</option>
                    <option value="FWD">FWD</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                {playerPool.map((player) => {
                  const selected = selectedPlayerIds.has(player.id);
                  const locked = isFantasyPlayerLocked(player.id, matches, new Date(), playerCatalog);
                  return (
                    <div
                      key={player.id}
                      className={`grid grid-cols-[1fr_auto] items-center gap-2 rounded-md p-2 ring-1 transition ${
                        selected ? "bg-emerald-50 ring-emerald-200" : "bg-slate-50 ring-slate-200 hover:bg-white"
                      }`}
                    >
                      <button type="button" onClick={() => onSelectPlayer(player.id)} className="min-w-0 text-left">
                        <div className="flex min-w-0 items-center gap-2">
                          <img
                            src={player.photoUrl ?? avatarUrl(player.name)}
                            alt={`${player.name} portrait`}
                            className="h-9 w-9 rounded-full object-cover object-top"
                          />
                          <div className="min-w-0">
                            <div className="truncate text-xs font-black text-cup-ink">{player.name}</div>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                              <Flag team={player.team} />
                              <span>{player.team.code}</span>
                              <Badge tone="green">{player.fantasyPosition}</Badge>
                              {locked ? <span className="text-cup-red">Locked</span> : null}
                            </div>
                          </div>
                        </div>
                      </button>
                      <Button
                        size="sm"
                        variant={selected ? "secondary" : "ghost"}
                        onClick={() => (selected ? removePlayer(player.id) : addPlayer(player.id))}
                        disabled={!selected && (locked || normalizedDraft.length >= FANTASY_SQUAD_SIZE)}
                        aria-label={selected ? `Remove ${player.name}` : `Add ${player.name}`}
                      >
                        {selected ? <Trash2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
              <div className="mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-cup-gold" />
                <h3 className="text-sm font-black uppercase text-slate-600">Player Stats</h3>
              </div>
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {normalizedDraft.map((slot) => {
                  const player = optionMap.get(slot.playerId);
                  if (!player) {
                    return null;
                  }
                  const stats = playerTotals(slot.playerId, scores);
                  return (
                    <button
                      key={slot.playerId}
                      type="button"
                      onClick={() => onSelectPlayer(slot.playerId)}
                      className="w-full rounded-md bg-slate-50 p-2 text-left ring-1 ring-slate-200 transition hover:bg-white"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={player.photoUrl ?? avatarUrl(player.name)}
                          alt={`${player.name} portrait`}
                          className="h-9 w-9 rounded-full object-cover object-top"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-black text-cup-ink">
                            {slot.isCaptain ? "C " : ""}
                            {player.name}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                            <Flag team={player.team} />
                            <span>{player.fantasyPosition}</span>
                            <span>{slot.isStarter ? "Starter" : "Bench"}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-cup-red">{slot.isCaptain ? stats.points * 2 : stats.points}</div>
                          <div className="text-[9px] font-black uppercase text-slate-400">pts</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </aside>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
      <div className="text-[10px] font-black uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-black text-cup-red">{value}</div>
    </div>
  );
}

function PitchSlot({
  slot,
  player,
  stats,
  canEdit,
  draggingId,
  activeMoveId,
  onDragStart,
  onDrop,
  onPickUp,
  onRemove,
  onSelectPlayer,
  onSetCaptain
}: {
  slot: FantasyRosterSlot | null;
  player?: FantasyPlayerOption;
  stats: ReturnType<typeof playerTotals> | null;
  canEdit: boolean;
  draggingId: string | null;
  activeMoveId: string | null;
  onDragStart: (playerId: string | null) => void;
  onDrop: (playerId: string) => void;
  onPickUp: (playerId: string) => void;
  onRemove: (playerId: string) => void;
  onSelectPlayer: (playerId: string) => void;
  onSetCaptain: (playerId: string) => void;
}) {
  const isTarget = Boolean(activeMoveId || draggingId);
  const isMovingThis = Boolean(slot && slot.playerId === activeMoveId);
  const canPlaceHere = Boolean(activeMoveId && activeMoveId !== slot?.playerId);

  return (
    <div
      className={`min-h-[96px] rounded-lg border p-2 text-center backdrop-blur transition ${
        isTarget
          ? "border-cup-gold bg-cup-gold/20 shadow-[inset_0_0_0_2px_rgba(214,166,71,.45)]"
          : "border-white/25 bg-white/10"
      }`}
      role={canEdit ? "button" : undefined}
      tabIndex={canEdit && isTarget ? 0 : undefined}
      onClick={() => {
        if (activeMoveId) {
          onDrop(activeMoveId);
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const playerId = event.dataTransfer.getData("text/plain") || draggingId || activeMoveId;
        if (playerId) {
          onDrop(playerId);
        }
      }}
    >
      {slot && player ? (
        <div
          draggable={canEdit}
          onDragStart={(event) => {
            event.dataTransfer.setData("text/plain", slot.playerId);
            onDragStart(slot.playerId);
          }}
          onDragEnd={() => onDragStart(null)}
          className={`group rounded-md p-1 transition ${isMovingThis ? "scale-95 opacity-70 ring-2 ring-cup-gold" : "interactive-pop"}`}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (activeMoveId && activeMoveId !== slot.playerId) {
                onDrop(activeMoveId);
                return;
              }
              onSelectPlayer(slot.playerId);
            }}
            className="w-full"
          >
            <img
              src={player.photoUrl ?? avatarUrl(player.name)}
              alt={`${player.name} portrait`}
              className="mx-auto h-11 w-11 rounded-full object-cover object-top shadow-lift ring-2 ring-white"
            />
            <div className="mt-1 truncate text-[11px] font-black text-white">{player.name}</div>
            <div className="text-[9px] font-black uppercase text-white/65">{stats?.points ?? 0} pts</div>
          </button>
          {canEdit ? (
            <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
              {canPlaceHere ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (activeMoveId) {
                      onDrop(activeMoveId);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-cup-gold px-2 py-0.5 text-[9px] font-black text-cup-ink"
                >
                  <Check className="h-3 w-3" />
                  Place here
                </button>
              ) : null}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onPickUp(slot.playerId);
                }}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black ${
                  isMovingThis ? "bg-cup-gold text-cup-ink" : "bg-white/15 text-white"
                }`}
              >
                <Move className="h-3 w-3" />
                Move
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSetCaptain(slot.playerId);
                }}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black ${
                  slot.isCaptain ? "bg-cup-gold text-cup-ink" : "bg-white/15 text-white"
                }`}
              >
                {slot.isCaptain ? <Crown className="h-3 w-3" /> : <Star className="h-3 w-3" />}
                {slot.isCaptain ? "Captain" : "Set C"}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(slot.playerId);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-black text-white"
              >
                <Trash2 className="h-3 w-3" />
                Remove
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid h-full min-h-[78px] place-items-center rounded-md border border-dashed border-white/35 bg-black/5 px-2 text-[10px] font-black uppercase text-white/70">
          {isTarget ? "Tap to place" : "Open slot"}
        </div>
      )}
    </div>
  );
}

function BenchRow({
  slot,
  player,
  stats,
  canEdit,
  activeMoveId,
  onDragStart,
  onPickUp,
  onRemove,
  onSelectPlayer
}: {
  slot: FantasyRosterSlot;
  player?: FantasyPlayerOption;
  stats: ReturnType<typeof playerTotals>;
  canEdit: boolean;
  activeMoveId: string | null;
  onDragStart: (playerId: string | null) => void;
  onPickUp: (playerId: string) => void;
  onRemove: (playerId: string) => void;
  onSelectPlayer: (playerId: string) => void;
}) {
  if (!player) {
    return null;
  }

  return (
    <div
      draggable={canEdit}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", slot.playerId);
        onDragStart(slot.playerId);
      }}
      onDragEnd={() => onDragStart(null)}
      className={`grid grid-cols-[1fr_auto] items-center gap-2 rounded-md p-2 ring-1 transition ${
        activeMoveId === slot.playerId ? "bg-amber-50 ring-cup-gold shadow-sm" : "bg-slate-50 ring-slate-200"
      }`}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onSelectPlayer(slot.playerId);
        }}
        className="min-w-0 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          <img src={player.photoUrl ?? avatarUrl(player.name)} alt={`${player.name} portrait`} className="h-9 w-9 rounded-full object-cover object-top" />
          <div className="min-w-0">
            <div className="truncate text-xs font-black text-cup-ink">{player.name}</div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
              <Flag team={player.team} />
              <Badge tone="green">{player.fantasyPosition}</Badge>
            </div>
          </div>
        </div>
      </button>
      <div className="flex items-center gap-1 text-right">
        <div>
          <div className="text-sm font-black text-cup-red">{stats.points}</div>
          <div className="text-[9px] font-black uppercase text-slate-400">pts</div>
        </div>
        {canEdit ? (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onPickUp(slot.playerId);
              }}
              className="grid h-8 w-8 place-items-center rounded-md bg-white text-slate-500 ring-1 ring-slate-200 transition hover:text-cup-red"
              aria-label={`Move ${player.name}`}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(slot.playerId);
              }}
              className="grid h-8 w-8 place-items-center rounded-md bg-white text-slate-500 ring-1 ring-slate-200 transition hover:text-cup-red"
              aria-label={`Remove ${player.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
