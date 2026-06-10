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
4. Insert their profile rows in `profiles` with user keys `tata` and `lucas`.
5. Add these Vercel environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_TATA_EMAIL`
   - `NEXT_PUBLIC_LUCAS_EMAIL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET`
   - `SCORE_PROVIDER=api-football` and `API_FOOTBALL_KEY`, or `SCORE_FEED_URL` for a normalized score feed
6. Deploy to Vercel.

The app stores the official tournament wallchart seed in code and writes score/prediction changes to Supabase. This keeps first setup small while still making Tata and Lucas share the same live scoreboard.

## Automatic Scores

- Predictions lock automatically 5 minutes before each kickoff, or immediately when a match is marked live/final.
- The app refreshes saved scores from Supabase every 60 seconds while Tata or Lucas has the wallchart open.
- Vercel Cron calls `/api/scores/sync` every 10 minutes. Set `CRON_SECRET` in Vercel; Vercel sends it as the bearer token for the cron request.
- For API-Football, set `SCORE_PROVIDER=api-football` and `API_FOOTBALL_KEY`. The sync route reads World Cup 2026 fixtures and maps scores back to wallchart matches by team names and kickoff.
- For another provider, set `SCORE_FEED_URL` and optionally `SCORE_FEED_TOKEN`. The URL should return `matches`, `fixtures`, or `results` with fields like `matchId` or `matchNumber`, `homeScore`, `awayScore`, and `status`.

## Media Notes

- The 2026 emblem is stored at `public/brand/world-cup-2026-emblem.png`, downloaded from Wikimedia Commons via an image proxy.
- The Spain spotlight image is stored at `public/players/lamine-yamal.jpg`, downloaded from Wikimedia Commons via an image proxy.
- Stadium photos are stored in `public/stadiums/`, sourced from Wikipedia/Wikimedia lead images through the same proxy.
- Team flags are rendered from FlagCDN at runtime so Windows browsers show real flag images instead of regional-letter emoji.
