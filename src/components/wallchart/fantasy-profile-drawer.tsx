"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Crown, Gauge, GripVertical, Move, Plus, Save, Search, ShieldCheck, Sparkles, Star, Trash2, Trophy, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FANTASY_SCORING_RULES,
  buildFantasyLeaderboard,
  eligibleTeamIdsForFantasyRound,
  fantasyOptionMap,
  fantasyPlayerOptions,
  fantasyPlayerTotals,
  isFantasyKnockoutRound,
  normalizeFantasyRosterSlots,
  type FantasyRoundResult,
  type FantasyPlayerOption
} from "@/lib/fantasy";
import { formatKickoff } from "@/lib/utils";
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
  round: FantasyRoundResult;
  onClose: () => void;
  onSaveRoster: (slots: FantasyRosterSlot[]) => Promise<void>;
  onSaveSettings: (settings: Pick<FantasyTeamSetting, "formation">) => Promise<void>;
  onSelectPlayer: (playerId: string) => void;
  onSelectTeam: (teamId: string) => void;
};

const FORMATIONS = ["4-3-3", "4-2-3-1", "3-4-3", "3-5-2", "4-4-2", "5-3-2"] as const;
const EMPTY_PLAYER_TOTALS = {
  points: 0,
  goals: 0,
  assists: 0,
  cleanSheets: 0
};

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

function validFormation(value: string | null | undefined) {
  return value && FORMATION_LINES[value] ? value : "4-3-3";
}

function normalizeDraftSlots(
  slots: FantasyRosterSlot[],
  optionMap: Map<string, FantasyPlayerOption>,
  userKey: UserKey | null,
  round: FantasyRoundResult
) {
  const seen = new Set<string>();
  const canonicalSlots = slots
    .filter((slot) => {
      const canonicalId = optionMap.get(slot.playerId)?.id ?? slot.playerId;
      if (seen.has(canonicalId)) {
        return false;
      }
      seen.add(canonicalId);
      return true;
    })
    .slice(0, round.squadSize)
    .map((slot) => ({
      ...slot,
      playerId: optionMap.get(slot.playerId)?.id ?? slot.playerId,
      roundId: round.id,
      userKey: userKey ?? slot.userKey,
      isCaptain: slot.isStarter ? slot.isCaptain : false,
      isViceCaptain: slot.isStarter ? slot.isViceCaptain : false
    }));

  return normalizeFantasyRosterSlots(canonicalSlots, userKey ?? undefined, round.id);
}

function normalizeAndTrimDraftSlots(
  slots: FantasyRosterSlot[],
  optionMap: Map<string, FantasyPlayerOption>,
  userKey: UserKey | null,
  round: FantasyRoundResult
) {
  return normalizeDraftSlots(slots, optionMap, userKey, round);
}

function buildBoardSlots(slots: FantasyRosterSlot[], starterSize: number) {
  const board: Array<FantasyRosterSlot | null> = Array.from({ length: starterSize }, () => null);
  const overflow: FantasyRosterSlot[] = [];

  for (const slot of slots
    .filter((item) => item.isStarter)
    .sort((a, b) => a.slotIndex - b.slotIndex)) {
    if (slot.slotIndex >= 0 && slot.slotIndex < starterSize && !board[slot.slotIndex]) {
      board[slot.slotIndex] = { ...slot, slotIndex: slot.slotIndex, isStarter: true };
    } else {
      overflow.push(slot);
    }
  }

  for (const slot of overflow) {
    const openIndex = board.findIndex((item) => !item);
    if (openIndex < 0) {
      break;
    }
    board[openIndex] = { ...slot, slotIndex: openIndex, isStarter: true };
  }

  return board;
}

function rosterSignature(slots: FantasyRosterSlot[], formation: string) {
  return `${formation}:${slots
    .map((slot) => [slot.playerId, slot.slotIndex, slot.isStarter ? 1 : 0, slot.isCaptain ? 1 : 0, slot.isViceCaptain ? 1 : 0].join(":"))
    .join("|")}`;
}

export function FantasyProfileDrawer({
  userKey,
  session,
  matches,
  rosters,
  scores,
  playerCatalog,
  teamSettings,
  round,
  onClose,
  onSaveRoster,
  onSaveSettings,
  onSelectPlayer,
  onSelectTeam
}: FantasyProfileDrawerProps) {
  const options = useMemo(() => fantasyPlayerOptions(playerCatalog), [playerCatalog]);
  const optionMap = useMemo(() => fantasyOptionMap(playerCatalog), [playerCatalog]);
  const leaderboard = useMemo(() => buildFantasyLeaderboard(rosters, scores, playerCatalog), [rosters, scores, playerCatalog]);
  const setting = userKey ? teamSettings.find((team) => team.userKey === userKey) : null;
  const savedFormation = validFormation(setting?.formation);
  const savedSlots = useMemo(
    () =>
      userKey
        ? normalizeAndTrimDraftSlots(
            rosters.filter((slot) => slot.userKey === userKey).sort((a, b) => a.slotIndex - b.slotIndex),
            optionMap,
            userKey,
            round
          )
        : [],
    [optionMap, rosters, round, userKey]
  );
  const [draft, setDraft] = useState<FantasyRosterSlot[]>(savedSlots);
  const [formation, setFormation] = useState(savedFormation);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [activeMoveId, setActiveMoveId] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [playerSearch, setPlayerSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const lastSavedKeyRef = useRef("");
  const eligibleTeamIds = useMemo(() => eligibleTeamIdsForFantasyRound(matches, round), [matches, round]);
  const availableOptions = useMemo(
    () => (eligibleTeamIds.size > 0 ? options.filter((option) => eligibleTeamIds.has(option.team.id)) : options),
    [eligibleTeamIds, options]
  );
  const countryOptions = useMemo(() => {
    const teams = new Map<string, FantasyPlayerOption["team"]>();
    for (const option of availableOptions) {
      teams.set(option.team.id, option.team);
    }
    return [...teams.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [availableOptions]);
  const playerPool = useMemo(() => {
    const search = playerSearch.trim().toLowerCase();
    return availableOptions
      .filter((option) => countryFilter === "all" || option.team.id === countryFilter)
      .filter((option) => positionFilter === "all" || option.fantasyPosition === positionFilter)
      .filter((option) => !search || `${option.name} ${option.team.name} ${option.team.code}`.toLowerCase().includes(search))
      .slice(0, 80);
  }, [availableOptions, countryFilter, playerSearch, positionFilter]);
  const canEdit = Boolean(userKey && userKey === session.userKey && round.selectionEnabled);
  const squadSize = round.squadSize;
  const starterSize = round.starterSize;
  const hasBench = squadSize > starterSize;
  const normalizedDraft = useMemo(
    () => normalizeAndTrimDraftSlots(draft, optionMap, userKey, round),
    [draft, optionMap, round, userKey]
  );
  const autoSaveKey = useMemo(() => rosterSignature(normalizedDraft, formation), [formation, normalizedDraft]);
  const eligibleTeamCount = countryOptions.length;
  const totalTeamCount = useMemo(() => new Set(options.map((option) => option.team.id)).size, [options]);
  const hiddenTeamCount = Math.max(0, totalTeamCount - eligibleTeamCount);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!userKey || !mounted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted, userKey]);

  useEffect(() => {
    setDraft(savedSlots);
    setDirty(false);
    lastSavedKeyRef.current = rosterSignature(savedSlots, savedFormation);
  }, [savedFormation, savedSlots]);

  useEffect(() => {
    setFormation(savedFormation);
  }, [savedFormation]);

  useEffect(() => {
    if (countryFilter !== "all" && !countryOptions.some((team) => team.id === countryFilter)) {
      setCountryFilter("all");
    }
  }, [countryFilter, countryOptions]);

  useEffect(() => {
    if (!canEdit || !dirty || !userKey) {
      return;
    }

    if (lastSavedKeyRef.current === autoSaveKey) {
      setDirty(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setSaving(true);
      try {
        await onSaveSettings({ formation });
        await onSaveRoster(normalizedDraft);
        lastSavedKeyRef.current = autoSaveKey;
        setDirty(false);
        setMessage("Autosaved.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not autosave Mini-Fantasy.");
      } finally {
        setSaving(false);
      }
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [autoSaveKey, canEdit, dirty, formation, normalizedDraft, onSaveRoster, onSaveSettings, userKey]);

  const draftStats = useMemo(() => {
    const map = new Map<string, ReturnType<typeof fantasyPlayerTotals>>();
    for (const slot of normalizedDraft) {
      if (!map.has(slot.playerId)) {
        map.set(slot.playerId, fantasyPlayerTotals(slot.playerId, scores, playerCatalog));
      }
    }
    return map;
  }, [normalizedDraft, playerCatalog, scores]);

  if (!userKey) {
    return null;
  }

  const row = leaderboard.find((item) => item.userKey === userKey);
  const boardSlots = buildBoardSlots(normalizedDraft, starterSize);
  const starterSlots = boardSlots.filter((slot): slot is FantasyRosterSlot => Boolean(slot));
  const formationLines = FORMATION_LINES[formation] ?? FORMATION_LINES["4-3-3"];
  const benchSlots = normalizedDraft.filter((slot) => !slot.isStarter);
  const selectedPlayerIds = new Set(normalizedDraft.map((slot) => slot.playerId));
  const takenByOtherUser = new Map(
    isFantasyKnockoutRound(round.id)
      ? rosters
          .filter((slot) => slot.userKey !== userKey)
          .map((slot) => [optionMap.get(slot.playerId)?.id ?? slot.playerId, familyName(slot.userKey)] as const)
      : []
  );
  const selectedTeams = new Set(
    normalizedDraft
      .map((slot) => optionMap.get(slot.playerId)?.team)
      .filter((team): team is FantasyPlayerOption["team"] => Boolean(team))
      .map((team) => team.id)
  );
  const totals = normalizedDraft.reduce(
    (total, slot) => {
      const output = draftStats.get(slot.playerId) ?? EMPTY_PLAYER_TOTALS;
      total.points += slot.isCaptain ? output.points * 2 : output.points;
      total.goals += output.goals;
      total.assists += output.assists;
      return total;
    },
    { points: 0, goals: 0, assists: 0 }
  );

  function moveToStarter(playerId: string, targetIndex: number) {
    if (!canEdit) {
      return;
    }

    const playerSlot = normalizedDraft.find((slot) => slot.playerId === playerId);
    if (!playerSlot) {
      return;
    }

    const board = buildBoardSlots(normalizedDraft, starterSize);
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
      if (hasBench) {
        bench.unshift({ ...targetSlot, slotIndex: starterSize, isStarter: false, isCaptain: false, isViceCaptain: false });
      } else {
        board[sourceStarterIndex >= 0 ? sourceStarterIndex : targetIndex] = movedSlot;
      }
    } else {
      board[targetIndex] = movedSlot;
    }

    setDraft(normalizeDraftSlots([...board.filter((slot): slot is FantasyRosterSlot => Boolean(slot)), ...bench], optionMap, userKey, round));
    setActiveMoveId(null);
    setDraggingId(null);
    setDirty(true);
    setMessage("Autosaving board...");
  }

  function moveToBench(playerId: string) {
    if (!canEdit) {
      return;
    }
    if (!hasBench) {
      setMessage(`${round.name} uses 11 players, so every selected player starts.`);
      return;
    }

    const next = normalizedDraft.map((slot) =>
      slot.playerId === playerId ? { ...slot, slotIndex: starterSize, isStarter: false, isCaptain: false, isViceCaptain: false } : slot
    );
    setDraft(normalizeDraftSlots(next, optionMap, userKey, round));
    setActiveMoveId(null);
    setDraggingId(null);
    setDirty(true);
    setMessage("Autosaving bench...");
  }

  function pickUpPlayer(playerId: string) {
    if (!canEdit) {
      return;
    }

    setActiveMoveId((current) => (current === playerId ? null : playerId));
    const player = optionMap.get(playerId);
    setMessage(`Moving ${player?.name ?? "player"}. Tap a pitch slot or the bench to snap them into place.`);
  }

  function addPlayer(playerId: string) {
    if (!canEdit || !userKey) {
      return;
    }
    if (selectedPlayerIds.has(playerId)) {
      setMessage("That player is already in this Mini-Fantasy squad.");
      return;
    }
    const takenBy = takenByOtherUser.get(playerId);
    if (takenBy) {
      setMessage(`${optionMap.get(playerId)?.name ?? "That player"} is already selected by ${takenBy} for ${round.name}.`);
      return;
    }
    if (normalizedDraft.length >= squadSize) {
      setMessage(`Mini-Fantasy squad is full at ${squadSize} players.`);
      return;
    }
    const starterCount = normalizedDraft.filter((slot) => slot.isStarter).length;
    const starterIndex = boardSlots.findIndex((slot) => !slot);
    const addAsStarter = starterCount < starterSize || !hasBench;

    const nextSlot: FantasyRosterSlot = {
      userKey,
      playerId,
      roundId: round.id,
      slotIndex: addAsStarter ? Math.max(0, starterIndex) : starterSize + benchSlots.length,
      isStarter: addAsStarter,
      isCaptain: normalizedDraft.length === 0,
      isViceCaptain: normalizedDraft.length === 1,
      updatedAt: new Date().toISOString()
    };

    setDraft(normalizeDraftSlots([...normalizedDraft, nextSlot], optionMap, userKey, round));
    setDirty(true);
    setMessage(addAsStarter ? "Player added to the pitch. Autosaving..." : "Player added to bench. Autosaving...");
  }

  function removePlayer(playerId: string) {
    if (!canEdit) {
      return;
    }

    const removed = normalizedDraft.find((slot) => slot.playerId === playerId);
    if (!removed) {
      return;
    }

    if (removed.isStarter && hasBench) {
      const next = normalizedDraft.map((slot) =>
        slot.playerId === playerId ? { ...slot, slotIndex: starterSize, isStarter: false, isCaptain: false, isViceCaptain: false } : slot
      );
      setDraft(normalizeDraftSlots(next, optionMap, userKey, round));
      setMessage("Player moved to bench. Autosaving...");
    } else {
      const next = normalizedDraft.filter((slot) => slot.playerId !== playerId);
      if (removed.isCaptain && next.length > 0) {
        next[0] = { ...next[0], isCaptain: true, isViceCaptain: false };
      }
      setDraft(normalizeDraftSlots(next, optionMap, userKey, round));
      setMessage("Player removed from squad. Autosaving...");
    }

    setActiveMoveId(null);
    setDraggingId(null);
    setDirty(true);
  }

  function setCaptain(playerId: string) {
    if (!canEdit) {
      return;
    }
    setDraft(normalizedDraft.map((slot) => ({ ...slot, isCaptain: slot.playerId === playerId, isViceCaptain: false })));
    setDirty(true);
    setMessage("Autosaving captain...");
  }

  async function handleSave() {
    if (!canEdit) {
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await onSaveSettings({ formation });
      await onSaveRoster(normalizedDraft);
      lastSavedKeyRef.current = rosterSignature(normalizedDraft, formation);
      setDirty(false);
      setMessage("Fantasy squad saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save Fantasy squad.");
    } finally {
      setSaving(false);
    }
  }

  let boardIndex = 0;

  const drawer = (
    <div className="fixed inset-0 z-[999] flex justify-end overflow-hidden bg-cup-ink/55 backdrop-blur-sm">
      <button type="button" aria-label="Close fantasy profile backdrop" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="saved-pop relative flex h-dvh max-h-dvh w-full max-w-7xl flex-col overflow-hidden bg-slate-50 shadow-2xl sm:rounded-l-2xl">
        <div className="shrink-0 border-b border-slate-200 bg-white/96 p-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase text-cup-red">Mini-Fantasy Profile</div>
              <h2 className="mt-1 truncate text-2xl font-black text-cup-ink">{familyName(userKey)} FC</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {round.name}: {normalizedDraft.length}/{squadSize} players - {starterSlots.length}/{starterSize} starters - Layout {formation} -{" "}
                {row?.captain ? `Captain ${row.captain.name}` : "No captain yet"}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                  {round.selectionEnabled
                  ? `Selection locks ${formatKickoff(round.locksAt)}.`
                  : round.status === "complete"
                    ? "Round complete. This squad is saved as the historical round roster."
                    : "Round locked because its first match has already started."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {userKey === session.userKey ? (
                <Button size="sm" onClick={handleSave} disabled={saving || !canEdit}>
                  {saving ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving" : canEdit ? (dirty ? "Autosaving" : "Saved") : "Locked"}
                </Button>
              ) : null}
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close fantasy profile drawer">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="space-y-4">
            <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cup-gold" />
                    <h3 className="text-sm font-black uppercase text-slate-600">Squad Board</h3>
                  </div>
                  <p className="text-xs font-bold text-slate-500">
                  {canEdit
                      ? activeMoveId
                        ? "Tap a pitch slot or the bench to place the selected player."
                        : "Formation is only a visual layout; any role mix is allowed."
                      : `${round.name} is read-only right now.`}
                  </p>
                </div>
                <select
                  value={formation}
                  onChange={(event) => {
                    const nextFormation = event.target.value;
                    setFormation(nextFormation);
                    setDraft((current) => normalizeAndTrimDraftSlots(current, optionMap, userKey, round));
                    setDirty(true);
                    setMessage("Autosaving layout...");
                  }}
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
                className="relative overflow-hidden rounded-xl p-3 text-white shadow-inner ring-1 ring-pitch-950 sm:p-5"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px), repeating-linear-gradient(90deg, #0c5f3e 0 54px, #0f7149 54px 108px)"
                }}
              >
                <div className="absolute right-3 top-3 z-[1] rounded-full bg-cup-ink/75 px-3 py-1 text-[10px] font-black uppercase text-cup-gold ring-1 ring-white/20">
                  {starterSlots.length}/{starterSize} on pitch
                </div>
                <div className="pointer-events-none absolute inset-3 rounded-md border-2 border-white/35" />
                <div className="pointer-events-none absolute inset-0 opacity-45">
                  <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-white" />
                  <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" />
                  <div className="absolute inset-x-10 top-3 h-16 rounded-b-2xl border-x-2 border-b-2 border-white" />
                  <div className="absolute inset-x-10 bottom-3 h-16 rounded-t-2xl border-x-2 border-t-2 border-white" />
                </div>
                <div className="relative flex min-h-[620px] flex-col justify-between gap-3 pt-7 sm:min-h-[660px]">
                  {formationLines.map((line) => {
                    const slots = Array.from({ length: line.count }, () => {
                      const slot = boardSlots[boardIndex] ?? null;
                      const index = boardIndex;
                      boardIndex += 1;
                      return { slot, index };
                    });

                    return (
                      <div key={line.id} className="w-full">
                        <div className="mb-1 flex items-center gap-2">
                          <div className="rounded-full bg-white/15 px-2 py-1 text-[9px] font-black uppercase text-white/75 ring-1 ring-white/20">
                            {line.id}
                          </div>
                          <div className="text-[9px] font-black uppercase text-white/45">{line.label}</div>
                        </div>
                        <div
                          className={`mx-auto grid w-full gap-2 sm:gap-3 ${line.count === 1 ? "max-w-60" : "max-w-none"}`}
                          style={{ gridTemplateColumns: `repeat(${line.count}, minmax(0, 1fr))` }}
                        >
                          {slots.map(({ slot, index }) => (
                            <PitchSlot
                              key={`${line.id}-${index}`}
                              slot={slot}
                              player={slot ? optionMap.get(slot.playerId) : undefined}
                              stats={slot ? draftStats.get(slot.playerId) ?? EMPTY_PLAYER_TOTALS : null}
                              compact={line.count === 1}
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

          <aside className="space-y-3">
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
                {!hasBench ? (
                  <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-bold text-slate-500">
                    This round uses 11 players, so every pick starts.
                  </div>
                ) : benchSlots.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-bold text-slate-500">
                    Drag a starter here to bench them.
                  </div>
                ) : (
                  benchSlots.map((slot) => (
                    <BenchRow
                      key={slot.playerId}
                      slot={slot}
                      player={optionMap.get(slot.playerId)}
                      stats={draftStats.get(slot.playerId) ?? EMPTY_PLAYER_TOTALS}
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

            <ScoringRulesPanel />

            <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-600">Add Players</h3>
                  <p className="text-xs font-bold text-slate-500">
                    {normalizedDraft.length}/{squadSize} selected - {eligibleTeamCount} team{eligibleTeamCount === 1 ? "" : "s"} still selectable.
                  </p>
                </div>
                <Badge tone={normalizedDraft.length >= squadSize ? "red" : "green"}>{squadSize - normalizedDraft.length} spots</Badge>
              </div>
              <div className="mb-3 rounded-md bg-emerald-50 p-2 text-[11px] font-bold leading-snug text-emerald-800 ring-1 ring-emerald-100">
                The player list follows the bracket. Eliminated teams are hidden as the tournament progresses
                {hiddenTeamCount > 0 ? ` (${hiddenTeamCount} hidden now).` : "."}
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
                    <option value="all">All alive teams</option>
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
                  const locked = !round.selectionEnabled;
                  const takenBy = takenByOtherUser.get(player.id);
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
                              {takenBy ? <span className="text-cup-red">Taken by {takenBy}</span> : null}
                              {locked ? <span className="text-cup-red">Locked</span> : null}
                            </div>
                          </div>
                        </div>
                      </button>
                      <Button
                        size="sm"
                        variant={selected ? "secondary" : "ghost"}
                        onClick={() => (selected ? removePlayer(player.id) : addPlayer(player.id))}
                        disabled={!canEdit || (!selected && (locked || Boolean(takenBy) || normalizedDraft.length >= squadSize))}
                        aria-label={selected ? `Remove ${player.name}` : `Add ${player.name}`}
                      >
                        {selected ? <Trash2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </div>
                  );
                })}
                {playerPool.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-bold text-slate-500">
                    No eligible players match these filters. Eliminated teams are hidden for {round.name}.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
              <div className="mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-cup-gold" />
                <h3 className="text-sm font-black uppercase text-slate-600">Player Stats</h3>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {normalizedDraft.map((slot) => {
                  const player = optionMap.get(slot.playerId);
                  if (!player) {
                    return null;
                  }
                  const stats = draftStats.get(slot.playerId) ?? EMPTY_PLAYER_TOTALS;
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
                          <div className="mt-1 flex flex-wrap gap-1 text-[9px] font-black uppercase text-slate-500">
                            <span className="rounded-full bg-white px-1.5 py-0.5 ring-1 ring-slate-200">G {stats.goals}</span>
                            <span className="rounded-full bg-white px-1.5 py-0.5 ring-1 ring-slate-200">A {stats.assists}</span>
                            {stats.cleanSheets > 0 ? (
                              <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-emerald-700 ring-1 ring-emerald-100">CS {stats.cleanSheets}</span>
                            ) : null}
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

          <div className="grid gap-2 sm:grid-cols-4 lg:col-span-2">
            <MiniStat label="Fantasy pts" value={totals.points} />
            <MiniStat label="Goals" value={totals.goals} />
            <MiniStat label="Assists" value={totals.assists} />
            <MiniStat label="Countries" value={selectedTeams.size} />
          </div>
        </div>
      </aside>
    </div>
  );

  return mounted ? createPortal(drawer, document.body) : null;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gradient-to-br from-white to-cup-sky p-3 shadow-sm ring-1 ring-slate-200">
      <div className="text-[10px] font-black uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-black text-cup-red">{value}</div>
    </div>
  );
}

function ScoringRulesPanel() {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex items-start gap-2">
        <Gauge className="mt-0.5 h-4 w-4 text-cup-red" />
        <div>
          <h3 className="text-sm font-black uppercase text-slate-700">Scoring Rules</h3>
          <p className="mt-1 text-xs font-bold leading-snug text-slate-500">
            Defender and keeper value comes from clean sheets, wins, draws, and low goals conceded, not only goals.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {FANTASY_SCORING_RULES.map((rule) => (
          <div key={rule.label} className="rounded-md bg-slate-50 p-2 ring-1 ring-slate-200">
            <div className="text-[9px] font-black uppercase text-slate-500">{rule.label}</div>
            <div className="mt-1 text-[11px] font-black leading-tight text-cup-ink">{rule.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PitchSlot({
  slot,
  player,
  stats,
  compact,
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
  stats: ReturnType<typeof fantasyPlayerTotals> | null;
  compact?: boolean;
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
  const playerName = player?.name ?? slot?.playerId.split("-").slice(1).join(" ") ?? "Player";
  const playerPortrait = player?.photoUrl ?? avatarUrl(playerName);

  return (
    <div
      className={`${compact ? "min-h-[100px]" : "min-h-[124px]"} rounded-lg border p-2 text-center backdrop-blur transition ${
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
      {slot ? (
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
              src={playerPortrait}
              alt={`${playerName} portrait`}
              className={`${compact ? "h-10 w-10" : "h-11 w-11"} mx-auto rounded-full object-cover object-top shadow-lift ring-2 ring-white`}
            />
            <div className="mt-1 truncate text-[11px] font-black capitalize leading-tight text-white">{playerName}</div>
            <div className="text-[9px] font-black uppercase text-white/65">{stats?.points ?? 0} pts</div>
          </button>
          {canEdit ? (
            <div className="mt-2 grid grid-cols-3 gap-1">
              {canPlaceHere ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (activeMoveId) {
                      onDrop(activeMoveId);
                    }
                  }}
                  className="col-span-3 inline-flex h-8 items-center justify-center gap-1 rounded-md bg-cup-gold px-2 text-[10px] font-black uppercase text-cup-ink shadow-sm"
                  title="Place player here"
                >
                  <Check className="h-3 w-3" />
                  Place
                </button>
              ) : null}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onPickUp(slot.playerId);
                }}
                className={`grid h-8 min-w-0 place-items-center rounded-md text-[9px] font-black ${
                  isMovingThis ? "bg-cup-gold text-cup-ink" : "bg-white/15 text-white"
                }`}
                title="Move player"
                aria-label={`Move ${playerName}`}
              >
                <Move className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSetCaptain(slot.playerId);
                }}
                className={`grid h-8 min-w-0 place-items-center rounded-md text-[9px] font-black ${
                  slot.isCaptain ? "bg-cup-gold text-cup-ink" : "bg-white/15 text-white"
                }`}
                title={slot.isCaptain ? "Captain selected" : "Set captain"}
                aria-label={slot.isCaptain ? `${playerName} is captain` : `Set ${playerName} as captain`}
              >
                {slot.isCaptain ? <Crown className="h-4 w-4" /> : <Star className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(slot.playerId);
                }}
                className="grid h-8 min-w-0 place-items-center rounded-md bg-white/15 text-[9px] font-black text-white"
                title="Move to bench"
                aria-label={`Move ${playerName} to bench`}
              >
                <ShieldCheck className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className={`${compact ? "min-h-[60px]" : "min-h-[78px]"} grid h-full place-items-center rounded-md border border-dashed border-white/35 bg-black/5 px-2 text-[10px] font-black uppercase text-white/70`}
        >
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
  stats: ReturnType<typeof fantasyPlayerTotals>;
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
