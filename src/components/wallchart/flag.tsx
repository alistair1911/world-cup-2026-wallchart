import { flagUrlForTeam } from "@/lib/flags";
import type { Team } from "@/lib/types";

type FlagProps = {
  team?: Team | null;
};

export function Flag({ team }: FlagProps) {
  const url = flagUrlForTeam(team);

  if (!team || !url) {
    return <span className="grid h-4 w-6 shrink-0 place-items-center rounded-sm bg-slate-200 text-[9px] font-black">?</span>;
  }

  return (
    <img
      src={url}
      alt={`${team.name} flag`}
      className="h-4 w-6 shrink-0 rounded-[2px] object-cover shadow-sm ring-1 ring-black/10"
      loading="lazy"
    />
  );
}
