// Vercel Function — private bookshelf behind "Sign in with Google".
//   POST /api/baekur  { credential: <Google ID token from the sign-in button> }
// 1. Verifies the ID token with Google (audience = GOOGLE_CLIENT_ID, verified e-mail).
// 2. Checks the e-mail against BAEKUR_NETFONG (comma-separated allowlist).
// 3. Returns the shelf: titles and files live in a PRIVATE Vercel Blob store
//    (baekur/listi.json + the PDFs/audio/covers), handed out as links that expire in 2 hours.
//    Each entry in utgafur has a `pdf` (opens in a new tab) or `hljod` (audio, played in the page).
// Nothing about the books is in this (public) repo.
import { get, issueSignedToken, presignUrl } from "@vercel/blob";
import { createHmac, timingSafeEqual } from "node:crypto";

export const config = { maxDuration: 15 };

const VALID_MS = 2 * 60 * 60 * 1000;
const ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const COOKIE = "baekur_s";
const SESSION_DAYS = 30;

// Session cookie after the first Google sign-in, so returning visitors skip the button.
// Value: base64url(JSON {e: email, x: expiry ms}) + "." + HMAC-SHA256 (BAEKUR_SESSION_SECRET).
function sign(payload) {
  return createHmac("sha256", process.env.BAEKUR_SESSION_SECRET || "").update(payload).digest("base64url");
}
function makeSession(email) {
  const payload = Buffer.from(JSON.stringify({ e: email, x: Date.now() + SESSION_DAYS * 864e5 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
function readSession(req) {
  if (!process.env.BAEKUR_SESSION_SECRET) return null;
  const raw = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!raw) return null;
  const [payload, mac] = raw.slice(COOKIE.length + 1).split(".");
  if (!payload || !mac) return null;
  const want = Buffer.from(sign(payload)), got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString());
    return s.x > Date.now() ? String(s.e) : null;
  } catch { return null; }
}
function cookie(value, maxAge) {
  return `${COOKIE}=${value}; Path=/api/baekur; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function verifiedEmail(credential) {
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!r.ok) return null;
  const t = await r.json();
  const ok = t.aud === process.env.GOOGLE_CLIENT_ID
    && ISSUERS.has(t.iss)
    && (t.email_verified === true || t.email_verified === "true")
    && Number(t.exp) * 1000 > Date.now();
  return ok ? String(t.email || "").toLowerCase() : null;
}

function isAllowed(email) {
  return (process.env.BAEKUR_NETFONG || "")
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean)
    .includes(email);
}

// Reads the private shelf list and signs short-lived links for every cover and PDF.
export async function shelf() {
  const res = await get("baekur/listi.json", { access: "private" });
  if (!res) throw new Error("listi.json not found");
  const books = JSON.parse(await new Response(res.stream).text());
  const validUntil = Date.now() + VALID_MS;
  const token = await issueSignedToken({ pathname: "*", operations: ["get"], validUntil });
  const sign = async (pathname) =>
    (await presignUrl(token, { operation: "get", pathname, validUntil, access: "private" })).presignedUrl;
  return Promise.all(books.map(async (b) => ({
    titill: b.titill,
    lysing: b.lysing,
    kapa: await sign(b.kapa),
    utgafur: await Promise.all((b.utgafur || []).map(async (u) => ({
      heiti: u.heiti,
      ...(u.pdf ? { pdf: await sign(u.pdf) } : {}),
      ...(u.hljod ? { hljod: await sign(u.hljod) } : {}),
    }))),
  })));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (req.method !== "POST") return res.status(405).json({ error: "Notaðu POST." });

  const body = req.body || {};
  if (body.logout) {
    res.setHeader("Set-Cookie", cookie("", 0));
    return res.status(200).json({ ok: true });
  }

  let email = null;
  if (body.credential) {
    email = await verifiedEmail(body.credential).catch(() => null);
    if (!email) return res.status(401).json({ error: "Innskráning tókst ekki. Reyndu aftur." });
  } else {
    email = readSession(req);
    if (!email) return res.status(401).json({ error: "", session: false });
  }
  if (!isAllowed(email)) {
    res.setHeader("Set-Cookie", cookie("", 0));
    return res.status(403).json({ error: `${email} hefur ekki aðgang.` });
  }
  if (body.credential && process.env.BAEKUR_SESSION_SECRET) {
    res.setHeader("Set-Cookie", cookie(makeSession(email), SESSION_DAYS * 86400));
  }

  try {
    return res.status(200).json({ netfang: email, baekur: await shelf() });
  } catch (e) {
    console.error("baekur:", e);
    return res.status(500).json({ error: "Gat ekki sótt bækurnar." });
  }
}
