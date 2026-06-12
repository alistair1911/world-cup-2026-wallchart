import Link from "next/link";
import { notFound } from "next/navigation";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { Flag } from "@/components/wallchart/flag";
import { avatarUrl, getAllTeamProfiles, getTeamProfile } from "@/lib/profile-data";
import { getTeamLogo } from "@/lib/team-logo-map";
import type { Team } from "@/lib/types";
import { LiveSquadPanel } from "./live-squad-panel";

type TeamPageProps = {
  params: Promise<{ teamId: string }>;
};

export function generateStaticParams() {
  return getAllTeamProfiles().map((profile) => ({ teamId: profile.team.id }));
}

export async function generateMetadata({ params }: TeamPageProps) {
  const { teamId } = await params;
  const profile = getTeamProfile(teamId);
  return {
    title: profile ? `${profile.team.name} profile` : "Team profile"
  };
}

export default async function TeamProfilePage({ params }: TeamPageProps) {
  const { teamId } = await params;
  const profile = getTeamProfile(teamId);

  if (!profile) {
    notFound();
  }

  const federationLogo = getTeamLogo(profile.team.id);

  return (
    <main className="app-shell min-h-screen p-4 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex rounded-md bg-white/90 px-3 py-2 text-sm font-black text-cup-ink shadow-sm">
            Back to wallchart
          </Link>
          <Link
            href="/"
            aria-label="Close team profile"
            className="interactive-pop grid h-10 w-10 place-items-center rounded-full bg-cup-ink text-white shadow-lift ring-1 ring-white/40"
          >
            <X className="h-5 w-5" />
          </Link>
        </div>

        <section className="overflow-hidden rounded-lg border border-white/80 bg-white/94 shadow-lift">
          <div className="relative overflow-hidden border-b border-slate-200 bg-white p-5 text-cup-ink">
            <div className="absolute inset-0 opacity-55">
              <div className="h-full w-full bg-[linear-gradient(90deg,rgba(15,81,50,.08)_1px,transparent_1px),linear-gradient(0deg,rgba(15,81,50,.08)_1px,transparent_1px)] bg-[size:34px_34px]" />
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="relative flex min-w-0 gap-4">
                <FederationMark team={profile.team} logoUrl={federationLogo} light />
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-3">
                    <Flag team={profile.team} />
                    <Badge tone="gold">Group {profile.team.group}</Badge>
                  </div>
                  <h1 className="text-4xl font-black">{profile.team.name}</h1>
                  <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-600">{profile.style}</p>
                </div>
              </div>
              <div className="relative rounded-lg bg-cup-ink p-4 text-right text-white shadow-sm">
                <div className="text-xs font-black uppercase text-white/65">Preferred shape</div>
                <div className="text-3xl font-black text-cup-gold">{profile.formation}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <Panel className="overflow-hidden">
                <TeamPhotoBoard profile={profile} federationLogo={federationLogo} />
              </Panel>

              <Panel className="p-4">
                <h2 className="mb-3 text-sm font-black uppercase text-slate-500">Squad Watchlist</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {profile.players.map((player) => (
                    <Link
                      key={player.id}
                      href={`/players/${player.id}`}
                      className="interactive-pop flex items-center gap-3 rounded-lg border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-3"
                    >
                      <img
                        src={player.photoUrl ?? avatarUrl(player.name)}
                        alt={`${player.name} portrait`}
                        className="h-14 w-14 rounded-lg object-cover object-top ring-1 ring-black/10"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-cup-ink">{player.name}</div>
                        <div className="text-xs font-bold text-slate-500">
                          {player.position} - {player.role}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {player.traits.slice(0, 2).map((trait) => (
                            <span key={trait} className="rounded bg-cup-sky px-1.5 py-0.5 text-[10px] font-black text-cup-ink">
                              {trait}
                            </span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Panel>

              <LiveSquadPanel teamId={profile.team.id} teamName={profile.team.name} curatedPlayers={profile.players} />

              <Panel className="p-4">
                <h2 className="mb-2 text-sm font-black uppercase text-slate-500">Coach Note</h2>
                <p className="text-sm font-semibold leading-6 text-slate-600">{profile.coachNote}</p>
              </Panel>
            </div>

            <div className="space-y-4">
              <Panel className="p-4">
                <h2 className="mb-3 text-sm font-black uppercase text-slate-500">Federation</h2>
                <div className="flex items-center gap-4">
                  <FederationMark team={profile.team} logoUrl={federationLogo} light />
                  <div className="min-w-0">
                    <div className="truncate text-lg font-black text-cup-ink">{profile.team.name}</div>
                    <div className="mt-1 text-xs font-bold uppercase text-slate-500">
                      {federationLogo ? "National federation crest" : "Federation crest fallback"}
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel className="overflow-hidden p-4">
                <h2 className="mb-3 text-sm font-black uppercase text-slate-500">Formation Board</h2>
                <div className="relative min-h-[560px] overflow-hidden rounded-lg bg-gradient-to-b from-pitch-600 to-pitch-800 p-4 text-white">
                  <div className="absolute inset-x-8 top-1/2 h-px bg-white/35" />
                  <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35" />
                  <div className="absolute inset-x-0 top-4 text-center text-xs font-black uppercase text-white/60">{profile.formation}</div>
                  {profile.players.map((player, index) => (
                    <PitchPlayer key={player.id} player={player} index={index} />
                  ))}
                </div>
              </Panel>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function TeamPhotoBoard({ profile, federationLogo }: { profile: NonNullable<ReturnType<typeof getTeamProfile>>; federationLogo?: string }) {
  const featured = profile.players.slice(0, 5);

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-cup-ink via-pitch-800 to-slate-950 p-5 text-white">
      <div className="absolute inset-0 opacity-20">
        <div className="h-full w-full bg-[linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,.25)_1px,transparent_1px)] bg-[size:36px_36px]" />
      </div>
      <div className="relative">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase text-white/60">Team picture board</div>
            <div className="text-2xl font-black">{profile.team.name} watchlist</div>
          </div>
          <FederationMark team={profile.team} logoUrl={federationLogo} compact light />
        </div>
        <div className="grid grid-cols-5 items-end gap-2">
          {featured.map((player, index) => (
            <Link key={player.id} href={`/players/${player.id}`} className={`interactive-pop text-center ${index === 0 ? "scale-105" : ""}`}>
              <img
                src={player.photoUrl ?? avatarUrl(player.name)}
                alt={`${player.name} portrait`}
                className="mx-auto h-28 w-full rounded-t-lg object-cover object-top shadow-lift ring-1 ring-white/25"
              />
              <div className="rounded-b-lg bg-white/92 px-1 py-2 text-cup-ink">
                <div className="truncate text-[10px] font-black">{player.name}</div>
                <div className="text-[9px] font-black text-cup-red">{player.position}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function FederationMark({
  team,
  logoUrl,
  compact = false,
  light = false
}: {
  team: Team;
  logoUrl?: string;
  compact?: boolean;
  light?: boolean;
}) {
  const size = compact ? "h-12 w-12" : "h-20 w-20";
  const shell = light ? "bg-slate-50 ring-slate-200" : "bg-white/92 ring-white/35";

  return (
    <div className={`grid ${size} shrink-0 place-items-center rounded-lg ${shell} p-2 shadow-sm ring-1`}>
      {logoUrl ? (
        <img src={logoUrl} alt={`${team.name} federation crest`} className="max-h-full max-w-full object-contain" />
      ) : (
        <div className="text-center">
          <Flag team={team} />
          <div className={`mt-1 text-[10px] font-black ${light ? "text-cup-ink" : "text-cup-red"}`}>{team.code}</div>
        </div>
      )}
    </div>
  );
}

function pitchPosition(position: string, index: number) {
  const slots: Record<string, Array<{ left: string; top: string }>> = {
    GK: [{ left: "50%", top: "88%" }],
    CB: [
      { left: "39%", top: "72%" },
      { left: "61%", top: "72%" }
    ],
    DF: [{ left: "50%", top: "72%" }],
    LB: [{ left: "20%", top: "70%" }],
    RB: [{ left: "80%", top: "70%" }],
    DM: [{ left: "50%", top: "58%" }],
    CM: [
      { left: "36%", top: "48%" },
      { left: "64%", top: "48%" }
    ],
    AM: [{ left: "50%", top: "36%" }],
    LW: [{ left: "22%", top: "20%" }],
    RW: [{ left: "78%", top: "20%" }],
    FW: [
      { left: "42%", top: "18%" },
      { left: "58%", top: "18%" }
    ],
    ST: [{ left: "50%", top: "14%" }]
  };

  const options = slots[position] ?? [{ left: `${28 + index * 12}%`, top: "36%" }];
  return options[index % options.length];
}

function PitchPlayer({ player, index }: { player: { id: string; name: string; position: string; photoUrl?: string }; index: number }) {
  const point = pitchPosition(player.position, index);

  return (
    <Link
      href={`/players/${player.id}`}
      className="interactive-pop absolute w-24 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white/94 p-2 text-center text-cup-ink shadow-lift"
      style={{ left: point.left, top: point.top }}
    >
      <img
        src={player.photoUrl ?? avatarUrl(player.name)}
        alt={`${player.name} portrait`}
        className="mx-auto mb-1 h-10 w-10 rounded-full object-cover object-top ring-2 ring-cup-gold"
      />
      <span className="text-[10px] font-black text-cup-red">{player.position}</span>
      <span className="block truncate text-xs font-black leading-tight">{player.name}</span>
    </Link>
  );
}
