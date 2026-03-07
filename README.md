# lettfeti.com

Personal homepage for Björn Orri Guðmundsson — CEO & Founder, [Aftra](https://aftra.io).

Built with [Astro](https://astro.build) as a static site.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

## Build

```bash
npm run build
npm run preview
```

## Deploy to Vercel

1. Push this repository to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the GitHub repository
4. Vercel auto-detects Astro — no configuration needed
5. Click **Deploy**

### Custom domain

1. In Vercel dashboard → **Settings** → **Domains**
2. Add `lettfeti.com`
3. Update DNS at your registrar:
   - **A record**: `76.76.21.21`
   - **CNAME**: `cname.vercel-dns.com` (for `www` subdomain, optional)
4. Wait for SSL certificate provisioning (automatic, ~5 minutes)

## Updating your photo

Replace `public/photo.jpg` with your preferred headshot (square aspect ratio recommended, 800×800px ideal).
