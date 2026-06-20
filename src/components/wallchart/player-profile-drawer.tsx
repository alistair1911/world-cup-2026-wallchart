"use client";

import { Plus, Star, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { fantasyScoreIdsForPlayer } from "@/lib/fantasy";
import { avatarUrl, getPlayerProfile } from "@/lib/profile-data";
import type { FantasyPlayerMatchScore, FantasyRosterSlot, PlayerCatalogItem } from "@/lib/types";
import { Badge } from "../ui/badge";
import { Flag } from "./flag";

type PlayerProfileDrawerProps = {
  playerId: string | null;
  onClose: () => void;
  onSelectTeam?: (teamId: string) => void;
  onAddFantasyPlayer?: (playerId: string) => void;
  fantasyRosters?: FantasyRosterSlot[];
  fantasyScores?: FantasyPlayerMatchScore[];
  playerCatalog?: PlayerCatalogItem[];
};

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/12 p-2 backdrop-blur">
      <div className="text-[10px] font-black uppercase text-white/55">{label}</div>
      <div className="truncate text-sm font-black text-white">{value}</div>
    </div>
  );
}

function RatingBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-black">
        <span className="text-slate-600">{label}</span>
        <span className="text-cup-red">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-cup-red to-cup-gold" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs font-black uppercase text-cup-red">{title}</div>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{body}</p>
    </div>
  );
}

function bestUse(position: string) {
  if (position === "GK") {
    return "Watch distribution under pressure and whether the back line trusts the short pass.";
  }
  if (["CB", "DF", "LB", "RB", "DM"].includes(position)) {
    return "Track duels, recovery runs, and how often the player starts attacks after winning the ball.";
  }
  if (["CM", "AM"].includes(position)) {
    return "Watch touches between the lines, tempo changes, and passes into the box.";
  }
  return "Watch first five yards, 1v1 moments, and shots or cutbacks after receiving wide.";
}

export function PlayerProfileDrawer({
  playerId,
  onClose,
  onSelectTeam,
  onAddFantasyPlayer,
  fantasyRosters = [],
  fantasyScores = [],
  playerCatalog = []
}: PlayerProfileDrawerProps) {
  const profile = playerId ? getPlayerProfile(playerId) : null;

  if (!playerId || !profile) {
    return null;
  }

  const portrait = profile.player.photoUrl ?? avatarUrl(profile.player.name);
  const fantasyIds = new Set(fantasyScoreIdsForPlayer(profile.player.id, playerCatalog));
  const selectedBy = fantasyRosters.filter((slot) => fantasyIds.has(slot.playerId)).map((slot) => slot.userKey);
  const fantasyRows = fantasyScores.filter((score) => fantasyIds.has(score.playerId));
  const fantasyTotal = fantasyRows.reduce((total, score) => total + score.points, 0);
  const fantasyGoals = fantasyRows.reduce((total, score) => total + score.goals, 0);
  const fantasyAssists = fantasyRows.reduce((total, score) => total + score.assists, 0);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-cup-ink/45">
      <button type="button" aria-label="Close player profile backdrop" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="saved-pop relative flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/96 p-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase text-cup-red">Player Profile</div>
              <h2 className="mt-1 truncate text-2xl font-black text-cup-ink">{profile.player.name}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {profile.team.name} - {profile.player.position} - {profile.formation}
              </p>
              {selectedBy.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedBy.map((userKey) => (
                    <Badge key={userKey} tone="gold">
                      Picked by {userKey === "tata" ? "Tata" : "Lucas"}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close player profile drawer">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <section className="grid overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm sm:grid-cols-[230px_1fr]">
            <div className="bg-gradient-to-br from-cup-ink via-pitch-800 to-cup-red p-4 text-white">
              <img src={portrait} alt={`${profile.player.name} portrait`} className="h-64 w-full rounded-lg object-cover object-top shadow-lift" />
              <div className="mt-4 flex items-center gap-2">
                <Flag team={profile.team} />
                <Badge tone="gold">{profile.team.code}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <MiniFact label="Club" value={profile.player.club ?? "Watchlist"} />
                <MiniFact label="Foot" value={profile.player.foot ?? "TBD"} />
                <MiniFact label="Age" value={profile.player.age ? String(profile.player.age) : "TBD"} />
                <MiniFact label="Height" value={profile.player.height ?? "TBD"} />
              </div>
              {onAddFantasyPlayer ? (
                <Button className="mt-4 w-full" variant="secondary" onClick={() => onAddFantasyPlayer(profile.player.id)}>
                  {selectedBy.length > 0 ? <Star className="h-4 w-4 text-cup-gold" /> : <Plus className="h-4 w-4" />}
                  Add to Mini-Fantasy
                </Button>
              ) : null}
            </div>

            <div className="space-y-4 p-4">
              <Panel className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-black uppercase text-slate-500">
                    <Trophy className="h-4 w-4 text-cup-gold" />
                    Fantasy Output
                  </h3>
                  <Badge tone={fantasyRows.some((row) => row.status === "needs_review") ? "gold" : "green"}>
                    {fantasyRows.some((row) => row.status === "needs_review") ? "Review" : "ESPN"}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <MiniStat label="Pts" value={fantasyTotal} />
                  <MiniStat label="Goals" value={fantasyGoals} />
                  <MiniStat label="Assists" value={fantasyAssists} />
                </div>
              </Panel>

              <Panel className="p-4">
                <h3 className="mb-2 text-sm font-black uppercase text-slate-500">Role</h3>
                <p className="text-sm font-bold leading-6 text-slate-700">{profile.player.role}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.player.traits.map((trait) => (
                    <span key={trait} className="rounded-full bg-cup-sky px-3 py-1 text-xs font-black text-cup-ink">
                      {trait}
                    </span>
                  ))}
                </div>
              </Panel>

              <Panel className="p-4">
                <h3 className="mb-3 text-sm font-black uppercase text-slate-500">Player Ratings</h3>
                <div className="space-y-3">
                  {profile.player.stats.map((stat) => (
                    <RatingBar key={stat.label} label={stat.label} value={stat.value} />
                  ))}
                </div>
              </Panel>
            </div>
          </section>

          <Panel className="p-4">
            <h3 className="mb-3 text-sm font-black uppercase text-slate-500">Match Notes</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Note title="Best use" body={bestUse(profile.player.position)} />
              <Note
                title="Prediction angle"
                body={`${profile.player.name} to influence ${profile.team.name}'s ${
                  profile.player.position === "GK" ? "clean-sheet chances" : "attacking rhythm"
                }.`}
              />
            </div>
          </Panel>

          {onSelectTeam ? (
            <Button
              variant="secondary"
              onClick={() => {
                onClose();
                onSelectTeam(profile.team.id);
              }}
            >
              Back to {profile.team.name}
            </Button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-50 p-2 ring-1 ring-slate-200">
      <div className="text-lg font-black text-cup-red">{value}</div>
      <div className="text-[10px] font-black uppercase text-slate-500">{label}</div>
    </div>
  );
}
