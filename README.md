# LineFoundry — Consensus Engine v2

LineFoundry is an independent NFL player-prop intelligence site focused first on **what credible public betting analysts like**, before adding any paid sportsbook odds feed.

## What this build does
- Curates public analyst signals with direct source links.
- Groups matching player/market/side/line signals into consensus.
- Separates evidence/source quality from analyst performance.
- Tracks each analyst independently.
- Does **not** invent historical records.
- Starts LineFoundry's own record at 0–0.
- Only counts an analyst pick toward the LineFoundry record when the pick is explicitly captured, locked, and later settled.
- Exposes `/api/experts` for the expert leaderboard and `/api/engine` for the consensus board.

## Ranking policy
An analyst is not ranked simply because they are famous or because a published article says they have a strong record. Publicly reported records can be displayed as context, but the **LineFoundry-tracked record** is calculated only from picks we capture and settle ourselves.

Suggested minimum for a formal ranked leaderboard: 50 settled NFL prop picks. Before that, the analyst is labeled NEW/TRACKING and no winning percentage is presented as predictive proof.

## Current public Week 1 signals
The included public signals are research/demo inputs based on published Week 1 articles and are not a claim that every source has been exhaustively captured. Refresh the source list as the season progresses.

## Data / IP guardrails
Do not scrape or republish sportsbook pages without permission. Do not use sportsbook logos, player photos, screenshots, copied graphics, or site UI. Source links remain with their respective publishers. Use authorized/public feeds where their terms permit automated access.

## Run locally
```bash
npm install
npm start
```
Then open `http://localhost:3000`.

## Next production step
Add a durable database (Supabase/Postgres) for analysts, signals, locked picks, source snapshots, settlements, and audit history. Keep the market/odds provider optional.
