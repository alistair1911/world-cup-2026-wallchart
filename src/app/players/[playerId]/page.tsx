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
            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <MiniFact label="Club" value={profile.player.club ?? "Watchlist"} />
              <MiniFact label="Foot" value={profile.player.foot ?? "TBD"} />
              <MiniFact label="Age" value={profile.player.age ? String(profile.player.age) : "TBD"} />
              <MiniFact label="Height" value={profile.player.height ?? "TBD"} />
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
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.player.traits.map((trait) => (
                  <span key={trait} className="rounded-full bg-cup-sky px-3 py-1 text-xs font-black text-cup-ink">
                    {trait}
                  </span>
                ))}
              </div>
            </Panel>

            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Team" value={profile.team.name} />
              <Stat label="Position" value={profile.player.position} />
              <Stat label="Formation fit" value={profile.formation} />
            </div>

            <Panel className="p-4">
              <h2 className="mb-3 text-sm font-black uppercase text-slate-500">Player Ratings</h2>
              <div className="space-y-3">
                {profile.player.stats.map((stat) => (
                  <RatingBar key={stat.label} label={stat.label} value={stat.value} />
                ))}
              </div>
            </Panel>

            <Panel className="p-4">
              <h2 className="mb-3 text-sm font-black uppercase text-slate-500">Match Notes</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Note title="Best use" body={bestUse(profile.player.position)} />
                <Note title="Prediction angle" body={`${profile.player.name} to influence ${profile.team.name}'s ${profile.player.position === "GK" ? "clean-sheet chances" : "attacking rhythm"}.`} />
              </div>
            </Panel>

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

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/12 p-2 backdrop-blur">
      <div className="text-[10px] font-black uppercase text-white/55">{label}</div>
      <div className="truncate text-sm font-black text-white">{value}</div>
    </div>
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
