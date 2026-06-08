import { MapPin } from "lucide-react";
import { getVenueInfo } from "@/lib/venues";

type VenuePhotoProps = {
  venue: string;
  compact?: boolean;
};

export function VenuePhoto({ venue, compact = false }: VenuePhotoProps) {
  const info = getVenueInfo(venue);

  if (!info) {
    return (
      <span className="flex min-w-0 items-center gap-1 truncate">
        <MapPin className="h-3 w-3 shrink-0 text-cup-red" />
        <span className="truncate">{venue}</span>
      </span>
    );
  }

  return (
    <span className="group/venue relative flex min-w-0 items-center gap-1 truncate">
      <MapPin className="h-3 w-3 shrink-0 text-cup-red" />
      <span className="truncate underline decoration-cup-gold/60 decoration-2 underline-offset-2">{info.city}</span>
      <span className="pointer-events-none absolute left-0 top-6 z-30 hidden w-64 overflow-hidden rounded-lg border border-white bg-white text-left shadow-2xl group-hover/venue:block group-focus-within/venue:block">
        <img src={info.image} alt={info.stadium} className="h-32 w-full object-cover" loading="lazy" />
        <span className="block p-2">
          <span className="block text-xs font-black text-cup-ink">{info.stadium}</span>
          <span className="block text-[11px] font-bold text-slate-500">
            {info.city}, {info.country}
          </span>
        </span>
      </span>
      {!compact ? <span className="sr-only">{info.stadium}</span> : null}
    </span>
  );
}
