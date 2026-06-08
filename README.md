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
6. Deploy to Vercel.

The app stores the official tournament wallchart seed in code and writes score/prediction changes to Supabase. This keeps first setup small while still making Tata and Lucas share the same live scoreboard.

## Media Notes

- The 2026 emblem is stored at `public/brand/world-cup-2026-emblem.png`, downloaded from Wikimedia Commons via an image proxy.
- The Spain spotlight image is stored at `public/players/lamine-yamal.jpg`, downloaded from Wikimedia Commons via an image proxy.
- Stadium photos are stored in `public/stadiums/`, sourced from Wikipedia/Wikimedia lead images through the same proxy.
- Team flags are rendered from FlagCDN at runtime so Windows browsers show real flag images instead of regional-letter emoji.
