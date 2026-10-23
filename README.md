# Island Arena — 3D Multiplayer Battle Royale

An original browser-based 3D battle-royale prototype inspired by the survival-shooter genre. It does not include PUBG/BGMI branding or copyrighted game assets.

## Architecture
- **Client:** Next.js, React and Three.js — third-person camera, 3D island, controls, HUD, loot and combat.
- **Realtime:** Cloudflare Workers + Durable Objects — room lifecycle, WebSockets, player snapshots, teams, combat events, loot and safe zone.
- **Persistence:** MongoDB Atlas — player profiles, match summaries, statistics and leaderboard; never use the database as the per-frame movement channel.
- **Web app/API:** Vercel Git deployment and Next.js route handlers.

## Included in this starter
- A 3D island with water, simple houses, trees, cover and weapon/medical loot.
- Multiplayer room joining and synchronized player movement.
- Teams, shooting, health, eliminations, pickup/drop and reload events.
- A shrinking safe zone and out-of-zone damage.
- Persistent match/leaderboard API routes, enabled by setting `MONGODB_URI`.
- Local development settings and deployment examples without credentials.

This is a **playable prototype starter**, not a production-ready commercial battle royale. A full-scale game still needs animated character assets, mobile performance work, matchmaking, identity/authentication, anti-cheat, authoritative movement/combat validation, load testing, monitoring, moderation and operational capacity planning.

## Requirements
- Node.js 22+
- A MongoDB Atlas connection string for the dedicated application database user (optional for local 3D play, required for persistent stats).
- A Cloudflare account with Workers and Durable Objects enabled for online play.
- Vercel linked to the GitHub repository.

## Live deployment

- Web app: https://island-arena.vercel.app
- Realtime Worker health: https://island-arena-realtime.island-arena-mrrehan8779255248.workers.dev/health
- App health endpoint: https://island-arena.vercel.app/api/health
- Leaderboard API: https://island-arena.vercel.app/api/leaderboard

The current Vercel deployment was uploaded directly and reached READY. The Vercel GitHub integration is not connected yet, so pushes to `main` will not automatically redeploy until that integration is installed and linked.

## Run locally
1. Copy `.env.example` to `.env.local` and set values you have.
2. From the repository root:
   ```bash
   npm install
   npm run dev
   ```
3. In a second terminal:
   ```bash
   npm run worker:dev
   ```
4. Set `NEXT_PUBLIC_GAME_SERVER_URL=ws://localhost:8787` for the local Worker, then open http://localhost:3000. If you change the file, restart the Next.js dev server.

## Controls
- **W/A/S/D:** move
- **Shift:** sprint
- **Mouse:** aim/look (click the scene to capture pointer)
- **Left click:** shoot
- **E:** pick up nearby loot
- **G:** drop selected item
- **R:** reload
- **1 / 2:** switch weapon slot
- **Esc:** release pointer

## Environment variables
- `NEXT_PUBLIC_GAME_SERVER_URL`: deployed Worker WebSocket URL. The current Worker is `wss://island-arena-realtime.island-arena-mrrehan8779255248.workers.dev`; local development uses `ws://localhost:8787`.
- `MONGODB_URI`: MongoDB URI for the dedicated `islandarena` application database user.
- `MONGODB_DB`: optional database name (defaults to `islandarena`).
- `MATCH_INGEST_SECRET`: optional secret for protected ingestion routes; generate and store only in the host settings.
- `CLOUDFLARE_ACCOUNT_ID`: only needed for deployment tooling if not auto-detected.

Never commit `.env.local`, database passwords, Cloudflare API tokens or other secrets.

## Deployment
1. Connect the repository to Vercel; its Git integration builds the Next.js app on pushes.
2. From `cloudflare/`, run `npm install` then `npm run deploy` after authenticating Wrangler and confirming the Durable Object migration.
3. Configure `NEXT_PUBLIC_GAME_SERVER_URL` and `MONGODB_URI` in Vercel project environment settings, then redeploy.
4. Use a least-privilege Atlas database user and a narrowly scoped network access rule appropriate for your hosting egress. Do not expose MongoDB directly to browser code.

## Security
The server validates basic actions and damage, but competitive production needs stronger movement/aim validation, authenticated accounts, abuse prevention, rate limits, observability, penetration testing and load tests. Never trust a client-reported result or score.
