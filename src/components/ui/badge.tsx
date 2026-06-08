import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "gold" | "green" | "red" | "slate";
};

export function Badge({ className, tone = "slate", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide",
        tone === "gold" && "bg-amber-100 text-amber-800",
        tone === "green" && "bg-emerald-100 text-emerald-800",
        tone === "red" && "bg-red-100 text-red-800",
        tone === "slate" && "bg-slate-100 text-slate-700",
        className
      )}
      {...props}
    />
  );
}
