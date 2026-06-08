import { getTeam } from "@/lib/tournament-data";
import type { Team } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Flag } from "./flag";

type TeamLineProps = {
  team?: Team | null;
  seedLabel?: string;
  align?: "left" | "right";
  compact?: boolean;
};

export function TeamLine({ team, seedLabel, align = "left", compact = false }: TeamLineProps) {
  const displayTeam = team || getTeam(seedLabel);

  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5",
        align === "right" && "flex-row-reverse text-right",
        compact ? "text-xs" : "text-sm"
      )}
    >
      <Flag team={displayTeam} />
      <span className="truncate font-semibold">{displayTeam?.code ?? seedLabel ?? "TBD"}</span>
    </span>
  );
}
