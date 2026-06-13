"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { LiveFormationBoard } from "@/app/teams/[teamId]/live-formation-board";
import { LiveSquadPanel } from "@/app/teams/[teamId]/live-squad-panel";
import { avatarUrl, getTeamProfile } from "@/lib/profile-data";
import { getTeamLogo } from "@/lib/team-logo-map";
import type { Team } from "@/lib/types";
import { Badge } from "../ui/badge";
import { Flag } from "./flag";

type TeamProfileDrawerProps = {
  teamId: string | null;
  onClose: () => void;
};

function FederationMark({ team, logoUrl }: { team: Team; logoUrl?: string }) {
  return (
    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-slate-50 p-2 shadow-sm ring-1 ring-slate-200">
      {logoUrl ? (
        <img src={logoUrl} alt={`${team.name} federation crest`} className="max-h-full max-w-full object-contain" />
      ) : (
        <div className="text-center">
          <Flag team={team} />
          <div className="mt-1 text-[10px] font-black text-cup-ink">{team.code}</div>
        </div>
      )}
    </div>
  );
}

export function TeamProfileDrawer({ teamId, onClose }: TeamProfileDrawerProps) {
  const profile = teamId ? getTeamProfile(teamId) : null;

  if (!teamId || !profile) {
    return null;
  }

  const federationLogo = getTeamLogo(profile.team.id);
  const featured = profile.players.slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-cup-ink/35">
      <button type="button" aria-label="Close team profile backdrop" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="saved-pop relative flex h-full w-full max-w-3xl flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/96 p-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <FederationMark team={profile.team} logoUrl={federationLogo} />
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <Flag team={profile.team} />
                  <Badge tone="gold">Group {profile.team.group}</Badge>
                </div>
                <h2 className="truncate text-2xl font-black text-cup-ink">{profile.team.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-600">{profile.style}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close team profile drawer">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <Panel className="overflow-hidden">
            <div className="relative overflow-hidden bg-gradient-to-br from-cup-ink via-pitch-800 to-slate-950 p-4 text-white">
              <div className="absolute inset-0 opacity-20">
                <div className="h-full w-full bg-[linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,.25)_1px,transparent_1px)] bg-[size:36px_36px]" />
              </div>
              <div className="relative">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase text-white/60">Team picture board</div>
                    <div className="text-xl font-black">{profile.team.name} watchlist</div>
                  </div>
                  <div className="rounded-md bg-white/90 px-2 py-1 text-xs font-black text-cup-ink">{profile.formation}</div>
                </div>
                <div className="grid grid-cols-5 items-end gap-2">
                  {featured.map((player, index) => (
                    <div key={player.id} className={`text-center ${index === 0 ? "scale-105" : ""}`}>
                      <img
                        src={player.photoUrl ?? avatarUrl(player.name)}
                        alt={`${player.name} portrait`}
                        className="mx-auto h-24 w-full rounded-t-lg object-cover object-top shadow-lift ring-1 ring-white/25"
                      />
                      <div className="rounded-b-lg bg-white/92 px-1 py-2 text-cup-ink">
                        <div className="truncate text-[10px] font-black">{player.name}</div>
                        <div className="text-[9px] font-black text-cup-red">{player.position}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <LiveFormationBoard teamId={profile.team.id} formation={profile.formation} curatedPlayers={profile.players} />

          <LiveSquadPanel teamId={profile.team.id} teamName={profile.team.name} curatedPlayers={profile.players} />

          <Panel className="p-4">
            <h3 className="mb-2 text-sm font-black uppercase text-slate-500">Coach Note</h3>
            <p className="text-sm font-semibold leading-6 text-slate-600">{profile.coachNote}</p>
          </Panel>
        </div>
      </aside>
    </div>
  );
}
