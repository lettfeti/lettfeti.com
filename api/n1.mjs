// Vercel Function — live torneopal data for the /n1 tracker.
// Runs the same server-side scrape (cookie challenge included) and returns the
// JSON the static app consumes. On MATCH DAYS results matter most, so caching is
// tight (~40s edge, ~25s in-instance) — torneopal score changes surface within
// ~1 min. Off days it caches longer to spare torneopal. Served stale on error,
// and the static app falls back to the bundled snapshot if this hard-fails.
import { scrape } from "../lib/torneopal.mjs";
import bundledVaktir from "../lib/vaktir.mjs";
import bundledBio from "../lib/bioplan.mjs";

export const config = { maxDuration: 30 };

let CACHE = null; // warm in-instance cache (Fluid Compute reuses instances)

// Tighter when a tournament day is in progress (updateIntervalMin is 5 on match
// days, 60 otherwise — derived from the fixtures in lib/torneopal.mjs).
function freshness(data) {
  const matchDay = (data?.meta?.updateIntervalMin ?? 60) <= 10;
  return { memTtl: matchDay ? 25_000 : 90_000, sMax: matchDay ? 40 : 600 };
}

export default async function handler(req, res) {
  const now = Date.now();
  if (CACHE) {
    const { memTtl, sMax } = freshness(CACHE.data);
    if (now - CACHE.t < memTtl) {
      res.setHeader("x-cache", "hot");
      res.setHeader("Cache-Control", `public, s-maxage=${sMax}, stale-while-revalidate=900`);
      return res.status(200).json(CACHE.data);
    }
  }
  try {
    const data = await scrape({
      turnaus: process.env.N1_TURNAUS,
      club: process.env.N1_CLUB,
      tracked: process.env.N1_TRACKED,
      vaktir: bundledVaktir.teams || bundledVaktir,
      bio: bundledBio,
    });
    CACHE = { t: now, data };
    res.setHeader("x-cache", "miss");
    res.setHeader("Cache-Control", `public, s-maxage=${freshness(data).sMax}, stale-while-revalidate=900`);
    return res.status(200).json(data);
  } catch (e) {
    if (CACHE) {
      res.setHeader("x-cache", "stale-on-error");
      return res.status(200).json(CACHE.data);
    }
    return res.status(502).json({ error: "scrape_failed", message: String(e.message || e) });
  }
}
