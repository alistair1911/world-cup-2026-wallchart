import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
};

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-cup-gold disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-cup-red text-white hover:bg-red-700",
        variant === "secondary" && "bg-white text-cup-ink ring-1 ring-slate-200 hover:bg-slate-50",
        variant === "ghost" && "text-slate-700 hover:bg-white/70",
        variant === "danger" && "bg-slate-900 text-white hover:bg-slate-700",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "icon" && "h-9 w-9 p-0",
        className
      )}
      {...props}
    />
  );
}
