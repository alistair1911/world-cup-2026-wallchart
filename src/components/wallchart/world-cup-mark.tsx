import { Sparkles } from "lucide-react";

type WorldCupMarkProps = {
  compact?: boolean;
};

export function WorldCupMark({ compact = false }: WorldCupMarkProps) {
  return (
    <div className="brand-mark flex items-center gap-3 rounded-lg bg-cup-ink px-3 py-2 text-white shadow-lift">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-black p-1 shadow-inner">
        <img src="/brand/world-cup-2026-emblem.png" alt="FIFA World Cup 2026 emblem" className="h-full w-full object-contain" />
      </span>
      <span className="relative z-10 min-w-0">
        <span className="flex items-center gap-1 text-[10px] font-black uppercase text-white/70">
          <Sparkles className="h-3 w-3 text-cup-gold" />
          Family Cup
        </span>
        <span className={`${compact ? "text-lg" : "text-2xl"} block truncate font-black leading-none`}>
          World Cup 2026
        </span>
      </span>
    </div>
  );
}
