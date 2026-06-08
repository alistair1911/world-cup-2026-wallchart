import * as React from "react";
import { cn } from "@/lib/utils";

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn("rounded-lg border border-white/80 bg-white/92 shadow-lift backdrop-blur", className)}
      {...props}
    />
  );
}
