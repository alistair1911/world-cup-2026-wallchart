# World Cup 2026 Family Wallchart

A private Next.js wallchart for Tata and Lucas to enter World Cup scores, make score predictions, and track a family leaderboard.

## Local Run

```powershell
npm.cmd install
npm.cmd run dev
```

If Supabase env vars are empty, the app runs in local demo mode with the passcode from `NEXT_PUBLIC_FAMILY_DEMO_PASSCODE`.

## Production Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Create two Supabase Auth users using the emails in `.env.example`.
4. Insert their profile rows in `profiles` with user keys `tata` and `lucas`, or let the app create/repair them on first login.
5. Add these Vercel environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_TATA_EMAIL`
   - `NEXT_PUBLIC_LUCAS_EMAIL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET`
   - `SCORE_PROVIDER=api-football` and `API_FOOTBALL_KEY`, or `SCORE_FEED_URL` for a normalized score feed
   - Optional API-Sports tuning: `API_FOOTBALL_HOST=v3.football.api-sports.io`, `API_FOOTBALL_LEAGUE_ID=1`, `API_FOOTBALL_SEASON=2026`
   - Optional LLM sync: `SCORE_PROVIDER=openrouter-llm`, `OPENROUTER_API_KEY`, and `OPENROUTER_MODEL=inclusionai/ring-2.6-1t`
6. Deploy to Vercel.

The app stores the official tournament wallchart seed in code and writes score/prediction changes to Supabase. This keeps first setup small while still making Tata and Lucas share the same live scoreboard.

After adding or changing Vercel environment variables, redeploy the latest production deployment so the server route sees the new values.

If Tata cannot see Lucas predictions or comments, confirm production has `SUPABASE_SERVICE_ROLE_KEY` set and ask Lucas to log out/in once. The app uses that key server-side to attach Lucas's saved rows to the shared `profiles` identity.

If saving says `permission denied for table profiles`, run `supabase/schema.sql` again in the Supabase SQL editor. The current schema includes the table grants and profile insert policy needed by shared mode.

## Automatic Scores

- Predictions lock automatically 5 minutes before each kickoff, or immediately when a match is marked live/final.
- The app refreshes saved scores from Supabase every 60 seconds while Tata or Lucas has the wallchart open.
- Tata and Lucas can press the top-bar `Sync` button to fetch provider scores immediately.
- Vercel Hobby allows daily cron jobs, so Vercel Cron calls `/api/scores/sync` once per day. Tata and Lucas can use the top-bar `Sync` button for live checks during match days.
- For API-Sports/API-Football v3, set `SCORE_PROVIDER=api-football` and `API_FOOTBALL_KEY`. The default host is `v3.football.api-sports.io`; league `1` and season `2026` are used unless overridden.
- For OpenRouter, set `SCORE_PROVIDER=openrouter-llm`, `OPENROUTER_API_KEY`, and `OPENROUTER_MODEL=inclusionai/ring-2.6-1t`. The route asks OpenRouter for confirmed live/final scores for matches near the current time and only accepts valid JSON.
- For another provider, set `SCORE_FEED_URL` and optionally `SCORE_FEED_TOKEN`. The URL should return `matches`, `fixtures`, or `results` with fields like `matchId` or `matchNumber`, `homeScore`, `awayScore`, and `status`.

Do not commit real API keys. Add them only in Vercel project environment variables.

## Team And Player Profiles

- Team profile pages live at `/teams/[teamId]`.
- Player profile pages live at `/players/[playerId]`.
- Profile data is a starter squad watchlist with formation/style notes. Official 2026 squads and lineups should be reviewed closer to the tournament.
- Spain and Lamine Yamal have a richer family-favorite profile treatment.

## Media Notes

- The 2026 emblem is stored at `public/brand/world-cup-2026-emblem.png`, downloaded from Wikimedia Commons via an image proxy.
- The Spain spotlight image is stored at `public/players/lamine-yamal.jpg`, downloaded from Wikimedia Commons via an image proxy.
- Player portraits are stored in `public/players/` when a usable Wikipedia/Wikimedia thumbnail is available. Run `npm run download:player-images` to refresh the generated `src/lib/player-photo-map.ts` map.
- Federation logos are stored in `public/federations/` when a usable Wikipedia/Wikimedia thumbnail is available. Run `npm run download:federation-logos` to refresh the generated `src/lib/team-logo-map.ts` map.
- Stadium photos are stored in `public/stadiums/`, sourced from Wikipedia/Wikimedia lead images through the same proxy.
- Team flags are rendered from FlagCDN at runtime so Windows browsers show real flag images instead of regional-letter emoji.
- Player goals and assists are stored in `public.player_match_stats`; run the current `supabase/schema.sql` after pulling changes before saving shared player-stat rows.
