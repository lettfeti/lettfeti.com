// Vercel Function — per-team calendar feed (subscribable .ics).
//   /api/ics?team=<slug>            → text/calendar (subscribe via webcal://)
//   /api/ics?team=<slug>&download=1 → forces a file download
// Built from the live scrape, so the feed always reflects the team's CURRENT
// fixtures — including knockout matches once they're drawn at the team's
// position. Subscribed calendars re-poll and update on their own.
import { scrape } from "../lib/torneopal.mjs";
import { buildICS, buildVaktirICS } from "../lib/ics.mjs";
import bundledVaktir from "../lib/vaktir.mjs";

export const config = { maxDuration: 30 };

let CACHE = null; // { t, data } — reused across requests on a warm instance

async function getData() {
  if (CACHE && Date.now() - CACHE.t < 60_000) return CACHE.data;
  const data = await scrape({
    turnaus: process.env.N1_TURNAUS,
    club: process.env.N1_CLUB,
    tracked: process.env.N1_TRACKED,
    vaktir: bundledVaktir.teams || bundledVaktir,
  });
  CACHE = { t: Date.now(), data };
  return data;
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const slug = (url.searchParams.get("team") || "").toLowerCase();
  const kind = (url.searchParams.get("kind") || "leikir").toLowerCase(); // leikir | vaktir
  const download = url.searchParams.get("download");
  if (!slug) return res.status(400).json({ error: "missing ?team=<slug>" });

  let data;
  try {
    data = await getData();
  } catch (e) {
    return res.status(502).json({ error: "scrape_failed", message: String(e.message || e) });
  }

  const team = Object.values(data.teams).find((t) => t.slug === slug && t.isClub);
  if (!team) return res.status(404).json({ error: "unknown team", slug });
  team.shortName = team.name.replace(/^Breiðablik\s*/, "Bre. ");

  const meta = {
    turnaus: data.meta.turnaus,
    location: data.meta.location,
    publicHost: req.headers.host || "www.lettfeti.com",
  };
  const ics = kind === "vaktir" ? buildVaktirICS(team, meta) : buildICS(team, meta);

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  if (download)
    res.setHeader("Content-Disposition", `attachment; filename="n1-${slug}-${kind}.ics"`);
  return res.status(200).send(ics);
}
