// Vercel Function — private bookshelf behind "Sign in with Google".
//   POST /api/baekur  { credential: <Google ID token from the sign-in button> }
// 1. Verifies the ID token with Google (audience = GOOGLE_CLIENT_ID, verified e-mail).
// 2. Checks the e-mail against BAEKUR_NETFONG (comma-separated allowlist).
// 3. Returns the shelf: titles and files live in a PRIVATE Vercel Blob store
//    (baekur/listi.json + the PDFs/covers), handed out as links that expire in 2 hours.
// Nothing about the books is in this (public) repo.
import { get, issueSignedToken, presignUrl } from "@vercel/blob";

export const config = { maxDuration: 15 };

const VALID_MS = 2 * 60 * 60 * 1000;
const ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

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
    utgafur: await Promise.all((b.utgafur || []).map(async (u) => ({ heiti: u.heiti, pdf: await sign(u.pdf) }))),
  })));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (req.method !== "POST") return res.status(405).json({ error: "Notaðu POST." });

  const credential = req.body && req.body.credential;
  if (!credential) return res.status(400).json({ error: "Vantar innskráningu." });

  const email = await verifiedEmail(credential).catch(() => null);
  if (!email) return res.status(401).json({ error: "Innskráning tókst ekki. Reyndu aftur." });
  if (!isAllowed(email)) return res.status(403).json({ error: `${email} hefur ekki aðgang.` });

  try {
    return res.status(200).json({ netfang: email, baekur: await shelf() });
  } catch (e) {
    console.error("baekur:", e);
    return res.status(500).json({ error: "Gat ekki sótt bækurnar." });
  }
}
