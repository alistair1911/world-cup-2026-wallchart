import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { Flag } from "@/components/wallchart/flag";
import { avatarUrl, getAllTeamProfiles, getTeamProfile } from "@/lib/profile-data";

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

  const forwards = profile.players.filter((player) => ["ST", "LW", "RW", "FW"].includes(player.position));
  const midfielders = profile.players.filter((player) => ["AM", "CM", "DM"].includes(player.position));
  const defenders = profile.players.filter((player) => ["GK", "CB", "LB", "RB", "DF"].includes(player.position));

  return (
    <main className="app-shell min-h-screen p-4 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <Link href="/" className="inline-flex rounded-md bg-white/90 px-3 py-2 text-sm font-black text-cup-ink shadow-sm">
          Back to wallchart
        </Link>

        <section className="overflow-hidden rounded-lg border border-white/80 bg-white/94 shadow-lift">
          <div className="bg-gradient-to-r from-cup-ink via-pitch-700 to-cup-red p-5 text-white">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <Flag team={profile.team} />
                  <Badge tone="gold">Group {profile.team.group}</Badge>
                </div>
                <h1 className="text-4xl font-black">{profile.team.name}</h1>
                <p className="mt-2 max-w-2xl text-sm font-semibold text-white/78">{profile.style}</p>
              </div>
              <div className="rounded-lg bg-white/12 p-4 text-right backdrop-blur">
                <div className="text-xs font-black uppercase text-white/65">Preferred shape</div>
                <div className="text-3xl font-black text-cup-gold">{profile.formation}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
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
                        className="h-14 w-14 rounded-lg object-cover ring-1 ring-black/10"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-cup-ink">{player.name}</div>
                        <div className="text-xs font-bold text-slate-500">
                          {player.position} - {player.role}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Panel>

              <Panel className="p-4">
                <h2 className="mb-2 text-sm font-black uppercase text-slate-500">Coach Note</h2>
                <p className="text-sm font-semibold leading-6 text-slate-600">{profile.coachNote}</p>
              </Panel>
            </div>

            <Panel className="overflow-hidden p-4">
              <h2 className="mb-3 text-sm font-black uppercase text-slate-500">Formation Board</h2>
              <div className="relative min-h-[470px] overflow-hidden rounded-lg bg-gradient-to-b from-pitch-600 to-pitch-800 p-4 text-white">
                <div className="absolute inset-x-8 top-1/2 h-px bg-white/35" />
                <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35" />
                <FormationLine players={forwards} top="12%" />
                <FormationLine players={midfielders} top="43%" />
                <FormationLine players={defenders} top="74%" />
              </div>
            </Panel>
          </div>
        </section>
      </div>
    </main>
  );
}

function FormationLine({ players, top }: { players: Array<{ id: string; name: string; position: string }>; top: string }) {
  const visible = players.length > 0 ? players : [{ id: top, name: "Team shape", position: "XI" }];

  return (
    <div className="absolute left-4 right-4 flex justify-around gap-2" style={{ top }}>
      {visible.map((player) => (
        <Link
          key={player.id}
          href={player.id === top ? "#" : `/players/${player.id}`}
          className="grid min-h-16 w-24 place-items-center rounded-lg bg-white/92 p-2 text-center text-cup-ink shadow-lift"
        >
          <span className="text-[10px] font-black text-cup-red">{player.position}</span>
          <span className="line-clamp-2 text-xs font-black leading-tight">{player.name}</span>
        </Link>
      ))}
    </div>
  );
}
