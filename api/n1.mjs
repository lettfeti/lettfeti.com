// Vercel Function — live torneopal data for the /n1 tracker.
// Runs the same server-side scrape (cookie challenge included) and returns the
// JSON the static app consumes. Cached at the edge so a burst of parents on
// match day doesn't hammer torneopal: fresh for `s-maxage`, served stale while
// revalidating. The static app falls back to the bundled snapshot if this 500s.
//
// Optional rosters: set the ROSTERS env var to a JSON string ({ "Team": [..] }).
import { scrape } from "../lib/torneopal.mjs";

export const config = { maxDuration: 30 };

let CACHE = null; // warm in-instance cache (Fluid Compute reuses instances)

function parseRosters() {
  try {
    return JSON.parse(process.env.ROSTERS || "{}");
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  const now = Date.now();
  // serve in-memory cache for 60s to cut latency on reused instances
  if (CACHE && now - CACHE.t < 60_000) {
    res.setHeader("x-cache", "hot");
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
    return res.status(200).json(CACHE.data);
  }
  try {
    const data = await scrape({
      turnaus: process.env.N1_TURNAUS,
      club: process.env.N1_CLUB,
      tracked: process.env.N1_TRACKED,
      rosters: parseRosters(),
    });
    CACHE = { t: now, data };
    res.setHeader("x-cache", "miss");
    // match-day vs off-day cadence comes from the data itself
    const s = Math.max(30, Math.round((data.meta.updateIntervalMin * 60) / 2));
    res.setHeader("Cache-Control", `public, s-maxage=${s}, stale-while-revalidate=900`);
    return res.status(200).json(data);
  } catch (e) {
    if (CACHE) {
      res.setHeader("x-cache", "stale-on-error");
      return res.status(200).json(CACHE.data);
    }
    return res.status(502).json({ error: "scrape_failed", message: String(e.message || e) });
  }
}
