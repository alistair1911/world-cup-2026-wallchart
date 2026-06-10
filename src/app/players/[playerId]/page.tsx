import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { Flag } from "@/components/wallchart/flag";
import { avatarUrl, getAllPlayerProfiles, getPlayerProfile } from "@/lib/profile-data";

type PlayerPageProps = {
  params: Promise<{ playerId: string }>;
};

export function generateStaticParams() {
  return getAllPlayerProfiles().map(({ player }) => ({ playerId: player.id }));
}

export async function generateMetadata({ params }: PlayerPageProps) {
  const { playerId } = await params;
  const profile = getPlayerProfile(playerId);
  return {
    title: profile ? `${profile.player.name} profile` : "Player profile"
  };
}

export default async function PlayerProfilePage({ params }: PlayerPageProps) {
  const { playerId } = await params;
  const profile = getPlayerProfile(playerId);

  if (!profile) {
    notFound();
  }

  const portrait = profile.player.photoUrl ?? avatarUrl(profile.player.name);

  return (
    <main className="app-shell min-h-screen p-4 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap gap-2">
          <Link href="/" className="inline-flex rounded-md bg-white/90 px-3 py-2 text-sm font-black text-cup-ink shadow-sm">
            Back to wallchart
          </Link>
          <Link
            href={`/teams/${profile.team.id}`}
            className="inline-flex rounded-md bg-white/90 px-3 py-2 text-sm font-black text-cup-ink shadow-sm"
          >
            {profile.team.name} profile
          </Link>
        </div>

        <section className="grid overflow-hidden rounded-lg border border-white/80 bg-white/94 shadow-lift lg:grid-cols-[380px_1fr]">
          <div className="bg-gradient-to-br from-cup-ink via-pitch-800 to-cup-red p-5 text-white">
            <img src={portrait} alt={`${profile.player.name} portrait`} className="h-80 w-full rounded-lg object-cover shadow-lift" />
            <div className="mt-4 flex items-center gap-2">
              <Flag team={profile.team} />
              <Badge tone="gold">{profile.team.code}</Badge>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div>
              <div className="text-xs font-black uppercase text-cup-red">Player Profile</div>
              <h1 className="mt-1 text-4xl font-black text-cup-ink">{profile.player.name}</h1>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                {profile.team.name} - {profile.player.position} - {profile.formation}
              </p>
            </div>

            <Panel className="p-4">
              <h2 className="mb-2 text-sm font-black uppercase text-slate-500">Role</h2>
              <p className="text-base font-bold leading-7 text-slate-700">{profile.player.role}</p>
            </Panel>

            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Team" value={profile.team.name} />
              <Stat label="Position" value={profile.player.position} />
              <Stat label="Formation fit" value={profile.formation} />
            </div>

            {profile.player.id.includes("lamine-yamal") ? (
              <Panel className="saved-pop border-cup-gold/60 bg-gradient-to-br from-amber-50 to-white p-4">
                <h2 className="mb-2 text-sm font-black uppercase text-cup-red">Tata & Lucas Favorite</h2>
                <p className="text-sm font-semibold leading-6 text-slate-700">
                  Yamal gets the special family spotlight: use this page before Spain games to make assist, goal, and
                  player-of-the-match predictions.
                </p>
              </Panel>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Panel className="p-3">
      <div className="text-[10px] font-black uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-black text-cup-ink">{value}</div>
    </Panel>
  );
}
