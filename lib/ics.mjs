// Build an iCalendar (RFC 5545) feed for one team's fixtures.
// Pure — used by api/ics.mjs. Iceland is UTC+0 year-round (no DST), so a
// fixture at date+time maps straight to a UTC instant (…Z).

const pad = (n) => String(n).padStart(2, "0");

// "2026-07-01","16:30" -> "20260701T163000Z"
function dtUTC(date, time) {
  const [y, mo, d] = date.split("-");
  const [h, mi] = (time || "00:00").split(":");
  return `${y}${mo}${d}T${pad(h)}${pad(mi)}00Z`;
}
// Date-only stamp "20260701"
const dateStamp = (date) => date.replaceAll("-", "");
// next calendar day (for all-day DTEND), date-only
function nextDay(date) {
  const dt = new Date(date + "T12:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + 1);
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
}
function nowStamp(now) {
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  );
}

// RFC5545 TEXT escaping
const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

// Fold lines to <=75 octets (simple, byte-aware enough for our ASCII-ish content)
function fold(line) {
  const out = [];
  let s = line;
  while (Buffer.byteLength(s, "utf8") > 75) {
    // find a cut <=75 bytes (chars are mostly 1-2 bytes; step conservatively)
    let cut = 74;
    while (Buffer.byteLength(s.slice(0, cut), "utf8") > 74) cut--;
    out.push(s.slice(0, cut));
    s = " " + s.slice(cut);
  }
  out.push(s);
  return out.join("\r\n");
}

// Parent-duty (vaktaplan) feed — one VEVENT per shift. GDPR: the upstream data
// already carries only parent first name(s) + time/role (no phones/children).
export function buildVaktirICS(team, meta, now = new Date()) {
  const host = (meta.publicHost || "www.lettfeti.com").replace(/^https?:\/\//, "");
  const v = team.vaktir || { shifts: [] };
  const calName = `Vaktaplan – ${team.name.replace(/^Breiðablik\s*/, "")}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//lettfeti.com//N1 motid vaktaplan//IS",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(calName)}`,
    `X-WR-CALDESC:${esc("Foreldravaktir " + team.name + " á N1 mótinu")}`,
    "X-WR-TIMEZONE:Atlantic/Reykjavik",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  const stamp = nowStamp(now);
  const icon = { "Svefnstjóri": "😴", "Sameiginleg vakt": "👥", "Foreldravakt": "🟢" };
  (v.shifts || []).forEach((s, i) => {
    if (!s.date || !s.start) return;
    const endDate = s.endDate || s.date;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:n1vakt-${meta.turnaus}-${s.date}-${s.start.replace(":", "")}-${i}@lettfeti.com`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`LAST-MODIFIED:${stamp}`);
    lines.push(`DTSTART:${dtUTC(s.date, s.start)}`);
    lines.push(`DTEND:${dtUTC(endDate, s.end || s.start)}`);
    const who = s.shared ? "Allir foreldrar" : s.parent || "";
    lines.push(fold(`SUMMARY:${esc(`${icon[s.role] || "🟢"} ${s.role}: ${who}`)}`));
    lines.push(fold(`DESCRIPTION:${esc(`${s.role} · ${s.start}–${s.end}`)}\\nhttps://${host}/n1#${team.slug}`));
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function buildICS(team, meta, now = new Date(), opts = {}) {
  const host = (meta.publicHost || "www.lettfeti.com").replace(/^https?:\/\//, "");
  const durationMin = opts.durationMin || 60;
  const calName = `N1 mótið – ${team.name.replace(/^Breiðablik\s*/, "")}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//lettfeti.com//N1 motid tracker//IS",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(calName)}`,
    `X-WR-CALDESC:${esc(team.name + " — leikir á N1 mótinu (" + (meta.location || "Akureyri") + ")")}`,
    "X-WR-TIMEZONE:Atlantic/Reykjavik",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  const stamp = nowStamp(now);
  for (const f of team.fixtures || []) {
    if (!f.date) continue; // unschedulable
    const uid = `n1-${meta.turnaus}-${f.id}@lettfeti.com`;
    const vs = f.isHome ? `${team.shortName || team.name} – ${f.opponent}` : `${f.opponent} – ${team.shortName || team.name}`;
    const ball = f.played ? "✅" : "⚽";
    const scorePart = f.played && f.score ? ` (${f.score})` : "";
    const summary = `${ball} ${vs}${scorePart}`;
    const loc = [f.venue, meta.location].filter(Boolean).join(", ");
    const desc = [
      `${f.isHome ? "Heimaleikur" : "Útileikur"} · Riðill ${f.lohko || team.lohkoLabel || "?"}`,
      f.no ? `Leikur nr. ${f.no}` : "",
      f.time ? `Kl. ${f.time}` : "Tími óstaðfestur",
      `https://${host}/n1#${team.slug}`,
    ]
      .filter(Boolean)
      .join("\\n");

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`LAST-MODIFIED:${stamp}`);
    if (f.time) {
      const start = dtUTC(f.date, f.time);
      const endDt = new Date(`${f.date}T${f.time}:00Z`);
      endDt.setUTCMinutes(endDt.getUTCMinutes() + durationMin);
      const end =
        `${endDt.getUTCFullYear()}${pad(endDt.getUTCMonth() + 1)}${pad(endDt.getUTCDate())}` +
        `T${pad(endDt.getUTCHours())}${pad(endDt.getUTCMinutes())}00Z`;
      lines.push(`DTSTART:${start}`);
      lines.push(`DTEND:${end}`);
    } else {
      // time TBD → all-day event on the match date
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(f.date)}`);
      lines.push(`DTEND;VALUE=DATE:${nextDay(f.date)}`);
    }
    lines.push(fold(`SUMMARY:${esc(summary)}`));
    if (loc) lines.push(fold(`LOCATION:${esc(loc)}`));
    lines.push(fold(`DESCRIPTION:${desc}`));
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
