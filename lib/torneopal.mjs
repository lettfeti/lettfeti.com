// Torneopal scraper core — shared by the CLI (scripts/scrape.mjs) and the
// Vercel function (api/n1.mjs). Pure: no filesystem access. `scrape()` returns
// the full data object the static app consumes.
//
// Torneopal gates every page behind a one-shot JS "cookie challenge": the first
// request returns a tiny <script>location.replace(atob(...))</script> body plus
// a Set-Cookie (TASO_torneopal=...). Re-requesting with that cookie returns the
// real server-rendered HTML. We crack it once and reuse the cookie.

const HOST = "https://n1motid.torneopal.com";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

export const DEFAULTS = {
  host: HOST,
  turnaus: "320_0013",
  seedSeries: ["2001", "2002", "2003", "2004", "2005", "2006"],
  club: "Breiðablik",
  tracked: "Breiðablik Kristófer Ingi",
};

// ---- transport -------------------------------------------------------------
async function getSessionCookie(host, seedUrl) {
  const res = await fetch(seedUrl, { headers: { "User-Agent": UA } });
  await res.text();
  const setCookie = res.headers.get("set-cookie") || "";
  const m = setCookie.match(/TASO_torneopal=[^;]+/);
  if (!m) throw new Error("No TASO_torneopal cookie returned by challenge");
  return m[0];
}
async function getPage(host, cookie, path) {
  const res = await fetch(`${host}${path}`, {
    headers: { "User-Agent": UA, Cookie: cookie },
  });
  const html = await res.text();
  if (html.length < 500 && /location\.replace/.test(html))
    throw new Error(`Challenge not satisfied for ${path}`);
  return html;
}

// ---- tiny HTML helpers -----------------------------------------------------
const stripTags = (s) =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&ndash;/g, "–")
    .replace(/&aacute;/g, "á")
    .trim();
const cls = (html, klass) => {
  const m = html.match(new RegExp(`class='${klass}\\s*'>(.*?)</div>`, "s"));
  return m ? stripTags(m[1]) : "";
};

// ---- standings parser ------------------------------------------------------
export function parseStandings(html) {
  const groups = [];
  const headers = [];
  const headerRe = /<h3><a href='[^']*&lohko=(\d+)'>\s*([^<]+?)<\/a>/g;
  let hm;
  while ((hm = headerRe.exec(html)))
    headers.push({ idx: hm.index, lohko: hm[1], label: hm[2].trim() });

  const tableRe = /<table[^>]*sarjataulukko[^>]*>(.*?)<\/table>/gs;
  let tm;
  const tables = [];
  while ((tm = tableRe.exec(html))) tables.push({ idx: tm.index, body: tm[1] });

  for (const t of tables) {
    let label = "",
      lohko = "";
    for (const h of headers)
      if (h.idx < t.idx) {
        label = h.label;
        lohko = h.lohko;
      }
    const rows = [];
    const rowRe = /<tr([^>]*)>(.*?)<\/tr>/gs;
    let rm;
    while ((rm = rowRe.exec(t.body))) {
      const attrs = rm[1],
        cells = rm[2];
      const idM = attrs.match(/id=(\d+)/);
      if (!idM) continue;
      const qualLine = /jatkoviiva/.test(attrs);
      const pos = stripTags(
        (cells.match(/jatkoonselite[^>]*>(.*?)<\/td>/s) || [])[1] || ""
      );
      const name = (cells.match(/class='lohko_joukkue'[^>]*>(.*?)<\/td>/s) || [])[1];
      const num = (k) => {
        const m = cells.match(new RegExp(`class='[^']*${k}'>(.*?)</td>`, "s"));
        return m ? stripTags(m[1]) : "";
      };
      const [gf, ga] = num("lohko_maalit").split("-").map((x) => parseInt(x, 10));
      rows.push({
        teamId: idM[1],
        pos: parseInt(pos, 10) || null,
        name: stripTags(name || ""),
        played: parseInt(num("lohko_otteluita"), 10) || 0,
        won: parseInt(num("lohko_voittoja"), 10) || 0,
        drawn: parseInt(num("lohko_tasan"), 10) || 0,
        lost: parseInt(num("lohko-havio"), 10) || 0,
        gf: Number.isFinite(gf) ? gf : 0,
        ga: Number.isFinite(ga) ? ga : 0,
        gd: (Number.isFinite(gf) ? gf : 0) - (Number.isFinite(ga) ? ga : 0),
        points: parseInt(num("lohko-pisteet"), 10) || 0,
        qualLine,
      });
    }
    rows.forEach((r, i) => {
      if (!r.pos) r.pos = i + 1;
    });
    if (rows.length) groups.push({ lohko, label, rows });
  }
  return groups;
}

// ---- fixtures parser -------------------------------------------------------
function parseIcelandicDate(label) {
  const m = label && label.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
export function parseFixtures(html, seriesName) {
  const i = html.indexOf("class='matchlist");
  if (i < 0) return [];
  const end = html.indexOf("</ul>", i);
  const seg = html.slice(i, end > 0 ? end : undefined);
  const matches = [];
  let curDate = null;
  // A played match's <li> class becomes 'match  played homewin|draw|awaywin'
  // (extra classes), so match `class='match…'` loosely and read the result from
  // both the class and the ml_tulosklo score.
  const tokenRe =
    /<li class='title'>([^<]+)<\/li>|<a href='\/taso\/ottelu\.php\?ottelu=(\d+)'>\s*<li class='match([^']*)'>(.*?)<\/li>\s*<\/a>/gs;
  let tk;
  while ((tk = tokenRe.exec(seg))) {
    if (tk[1]) {
      curDate = tk[1].trim();
      continue;
    }
    const liClasses = tk[3] || "";
    const body = tk[4];
    const tulosklo = cls(body, "ml_tulosklo");
    const isScore = /\d+\s*[-–]\s*\d+/.test(tulosklo);
    const tbd = /^-{1,2}:?-{0,2}$/.test(tulosklo.replace(/\s/g, ""));
    const played = /\bplayed\b/.test(liClasses) || isScore;
    matches.push({
      id: tk[2],
      series: seriesName,
      no: cls(body, "ml_ottelunro"),
      lohko: cls(body, "ml_lohkosijat"),
      venue: cls(body, "ml_kenttanimi"),
      date: parseIcelandicDate(curDate),
      dateLabel: curDate,
      time: isScore || tbd ? null : tulosklo,
      scheduled: !tbd && !!tulosklo,
      home: cls(body, "ml_kotisiisti"),
      away: cls(body, "ml_vierassiisti"),
      score: isScore ? tulosklo.replace(/\s/g, "") : null,
      played,
    });
  }
  return matches;
}

function discoverSeries(html, turnaus) {
  const re = new RegExp(`sarja\\.php\\?turnaus=${turnaus}&sarja=(\\w+)'>([^<]+)<`, "g");
  const out = {};
  let m;
  while ((m = re.exec(html))) out[m[1]] = m[2].trim();
  return out;
}

// ---- projection ------------------------------------------------------------
function projectGroup(rows, remainingByTeam, advance) {
  const e = rows.map((r) => {
    const rem = remainingByTeam[r.teamId] ?? 0;
    return { ...r, rem, maxPts: r.points + rem * 3, minPts: r.points };
  });
  return e.map((t) => {
    const above = e.filter((o) => o.teamId !== t.teamId && o.minPts > t.maxPts).length;
    const below = e.filter((o) => o.teamId !== t.teamId && o.maxPts < t.minPts).length;
    const bestPos = above + 1;
    const worstPos = rows.length - below;
    const started = e.some((o) => o.played > 0);
    const clinchedAdvance = worstPos <= advance;
    const eliminated = bestPos > advance;
    let status, tone;
    if (!started) {
      status = "Riðill ekki hafinn";
      tone = "idle";
    } else if (clinchedAdvance && bestPos === 1 && worstPos === 1) {
      status = "Riðilsmeistari — öruggt";
      tone = "win";
    } else if (clinchedAdvance) {
      status = "Komin áfram — öruggt sæti";
      tone = "win";
    } else if (eliminated) {
      status = "Úr leik í riðlakeppni";
      tone = "out";
    } else {
      status = `Berst um sæti (getur endað ${bestPos}.–${worstPos}.)`;
      tone = "live";
    }
    return {
      teamId: t.teamId,
      bestPos,
      worstPos,
      maxPts: t.maxPts,
      minPts: t.minPts,
      remaining: t.rem,
      advance,
      clinchedAdvance,
      eliminated,
      started,
      status,
      tone,
    };
  });
}

// "Breiðablik Kristófer Ingi" -> "kristofer-ingi" (drop club prefix, transliterate)
export function teamSlug(name, club = "Breiðablik") {
  const map = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ý: "y", þ: "th", ð: "d", æ: "ae", ö: "o" };
  return name
    .replace(new RegExp("^" + club + "\\s*"), "")
    .toLowerCase()
    .replace(/[áéíóúýþðæö]/g, (c) => map[c] || c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nextUpdateMs(matches, now) {
  const today = now.toISOString().slice(0, 10);
  const isMatchDay = matches.some((m) => m.date === today);
  return (isMatchDay ? 2 : 60) * 60 * 1000; // tight refresh promise on match days (live results)
}

// ---- main scrape -----------------------------------------------------------
export async function scrape(opts = {}) {
  // Drop undefined overrides so `{ turnaus: undefined }` doesn't clobber defaults.
  const defined = Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined));
  const cfg = { ...DEFAULTS, ...defined };
  // NOTE: player rosters are intentionally NOT published (GDPR — children's names).
  const vaktir = cfg.vaktir || {};
  const seedUrl = `${cfg.host}/taso/sarja.php?turnaus=${cfg.turnaus}&sarja=${cfg.seedSeries[0]}`;
  const cookie = await getSessionCookie(cfg.host, seedUrl);

  const firstHtml = await getPage(
    cfg.host,
    cookie,
    `/taso/sarja.php?turnaus=${cfg.turnaus}&sarja=${cfg.seedSeries[0]}`
  );
  const discovered = discoverSeries(firstHtml, cfg.turnaus);
  const seriesCodes = Array.from(new Set([...cfg.seedSeries, ...Object.keys(discovered)]));

  // Sequential on purpose: firing all series concurrently makes torneopal
  // re-issue its JS cookie challenge under load ("Challenge not satisfied").
  // This runs in the background after the snapshot paints, so latency is hidden.
  const series = [];
  const allMatches = [];
  for (const code of seriesCodes) {
    const name = discovered[code] || code;
    const standingsHtml =
      code === cfg.seedSeries[0]
        ? firstHtml
        : await getPage(cfg.host, cookie, `/taso/sarja.php?turnaus=${cfg.turnaus}&sarja=${code}`);
    const fixturesHtml = await getPage(
      cfg.host,
      cookie,
      `/taso/sarja.php?turnaus=${cfg.turnaus}&sarja=${code}&ottelut=1`
    );
    series.push({ code, name, groups: parseStandings(standingsHtml) });
    allMatches.push(...parseFixtures(fixturesHtml, name));
  }

  const sortMatches = (a) =>
    a.sort((x, y) =>
      (x.date || "9") === (y.date || "9")
        ? (x.time || "99").localeCompare(y.time || "99")
        : (x.date || "9").localeCompare(y.date || "9")
    );
  sortMatches(allMatches);

  const remainingByGroup = {};
  for (const s of series)
    for (const g of s.groups) {
      const key = `${s.code}|${g.lohko}`;
      remainingByGroup[key] = {};
      const names = new Set(g.rows.map((r) => r.name));
      const gm = allMatches.filter((m) => m.series === s.name && names.has(m.home) && names.has(m.away));
      for (const r of g.rows)
        remainingByGroup[key][r.teamId] = gm.filter(
          (m) => !m.played && (m.home === r.name || m.away === r.name)
        ).length;
    }

  const teams = {};
  for (const s of series)
    for (const g of s.groups) {
      const key = `${s.code}|${g.lohko}`;
      const advance = Math.max(...g.rows.filter((r) => r.qualLine).map((r) => r.pos), 2);
      const projById = Object.fromEntries(
        projectGroup(g.rows, remainingByGroup[key], advance).map((p) => [p.teamId, p])
      );
      for (const r of g.rows) {
        const name = r.name;
        const isClub = name.startsWith(cfg.club);
        let fixtures, nextMatch;
        if (isClub) {
          fixtures = sortMatches(
            allMatches.filter((m) => m.series === s.name && (m.home === name || m.away === name))
          ).map((m) => ({
            id: m.id,
            no: m.no,
            date: m.date,
            dateLabel: m.dateLabel,
            time: m.time,
            scheduled: m.scheduled,
            played: m.played,
            score: m.score,
            opponent: m.home === name ? m.away : m.home,
            isHome: m.home === name,
            venue: m.venue,
            venuePlace: (m.venue.split(" - ")[1] || m.venue).trim(),
            lohko: m.lohko,
          }));
          nextMatch = fixtures.find((m) => !m.played) || null;
        }
        teams[r.teamId] = {
          ...r,
          series: s.code,
          seriesName: s.name,
          lohko: g.lohko,
          lohkoLabel: g.label,
          advance,
          isClub,
          isTracked: name === cfg.tracked,
          ...(isClub && { slug: teamSlug(name, cfg.club), vaktir: vaktir[name] || null, fixtures, nextMatch }),
          projection: projById[r.teamId],
        };
      }
    }

  const clubTeams = Object.values(teams)
    .filter((t) => t.isClub)
    .sort((a, b) => a.seriesName.localeCompare(b.seriesName) || a.name.localeCompare(b.name));

  const now = new Date();
  const nextMs = nextUpdateMs(allMatches, now);

  return {
    meta: {
      tournament: "N1 mótið",
      location: "Akureyri",
      host: cfg.host,
      turnaus: cfg.turnaus,
      club: cfg.club,
      tracked: cfg.tracked,
      generatedAt: now.toISOString(),
      nextUpdate: new Date(now.getTime() + nextMs).toISOString(),
      updateIntervalMin: nextMs / 60000,
      seriesCount: series.length,
      teamCount: Object.keys(teams).length,
      clubSquadCount: clubTeams.length,
      dates: Array.from(new Set(allMatches.filter((m) => m.date).map((m) => m.date))).sort(),
    },
    series,
    teams,
    clubTeams: clubTeams.map((t) => t.teamId),
    matches: allMatches,
  };
}
