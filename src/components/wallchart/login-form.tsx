"use client";

import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { isSupabaseMode, signInFamily } from "@/lib/auth";
import type { UserKey } from "@/lib/types";
import { WorldCupMark } from "./world-cup-mark";

export function LoginForm() {
  const router = useRouter();
  const [userKey, setUserKey] = useState<UserKey>("tata");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInFamily(userKey, password);
      router.replace("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell grid min-h-screen place-items-center p-4">
      <Panel className="saved-pop w-full max-w-md overflow-hidden p-5">
        <div className="mb-5">
          <WorldCupMark />
          <p className="mt-3 text-center text-sm font-bold text-slate-600">
            Private wallchart, score tracker, and Tata vs Lucas prediction game.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
            {(["tata", "lucas"] as UserKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setUserKey(key)}
                className={`tab-button h-11 rounded-md text-sm font-black ${
                  userKey === key ? "bg-white text-cup-ink shadow-sm ring-1 ring-cup-gold/40" : "text-slate-500"
                }`}
              >
                {key === "tata" ? "Tata" : "Lucas"}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-slate-500">Password</span>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <Button className="w-full" disabled={loading}>
            <LockKeyhole className="h-4 w-4" />
            Sign In
          </Button>
        </form>

        {!isSupabaseMode() ? (
          <div className="mt-4 rounded-md bg-cup-sky p-3 text-center text-xs font-bold text-cup-ink">Local demo mode</div>
        ) : null}
        {error ? <div className="mt-4 rounded-md bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
      </Panel>
    </main>
  );
}
