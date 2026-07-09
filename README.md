# IRONHILL — Live AI Barber Demo

A shareable web demo of the AI hairstyle try-on. The prospective client opens a
URL on their phone or laptop, uploads a real selfie, picks a cut, and gets a
**real AI-generated preview** of themselves with that hairstyle — face preserved.

- **Frontend:** `public/index.html` — a single-file PWA (customer app + barber dashboard).
- **Backend:** `api/generate.js` — a Vercel serverless function that calls
  Replicate's **FLUX.1 Kontext** model to restyle the hair from a text prompt.

The Replicate API token lives only on the server, never in the browser.

---

## What you need

1. A **Replicate** account + API token → https://replicate.com/account/api-tokens
   (Replicate is pay-as-you-go; each generation costs a few US cents. Add billing
   in your Replicate account.)
2. A **Vercel** account (free Hobby plan is enough) → https://vercel.com
3. This folder (`ai-barber-live`).

---

## Deploy in ~5 minutes (no terminal needed)

1. Go to **vercel.com → Add New → Project**.
2. Upload / import this `ai-barber-live` folder (drag-and-drop, or push it to a
   GitHub repo and import that).
3. In **Settings → Environment Variables**, add:
   - **Name:** `REPLICATE_API_TOKEN`
   - **Value:** your token from Replicate (starts with `r8_...`)
4. Click **Deploy**. Vercel gives you a public URL like
   `https://ironhill-ai-barber.vercel.app` — send that to the client.

Done. `public/index.html` is served as the site; `api/generate.js` runs on demand.

---

## Run it locally first (optional)

```bash
npm i -g vercel
cd ai-barber-live
cp .env.example .env.local      # then paste your real token into .env.local
vercel dev                      # opens http://localhost:3000
```

---

## Real AI photos on the style cards (optional but recommended)

Out of the box the style-selection cards show clean drawn illustrations. To make
them **real AI-generated haircut photos**, run the generator once with your token:

```bash
cd ai-barber-live
REPLICATE_API_TOKEN=r8_your_token  npm run gen:styles
```

This creates `public/styles/fade.jpg`, `crop.jpg`, `pomp.jpg`, `buzz.jpg`,
`curl.jpg`, `slick.jpg` (6 images, a few cents total). The app picks them up
automatically; if an image is missing it falls back to the illustration. Commit
those images (or re-run before deploy) so they ship with the site.

---

## How it works

1. The browser downscales the selfie (max 1024px) and POSTs it to `/api/generate`
   with a style prompt.
2. The function calls Replicate FLUX Kontext with the image + prompt.
3. Replicate returns a photorealistic image with the new hairstyle, face intact.
4. The app shows a **Before / After** comparison, then lets the guest book.

If the backend/token isn't set up, the app quietly falls back to a stylised
"preview mode" so a live demo never shows a blank screen.

---

## Getting a good likeness (important)

The AI keeps the face far better when the **input selfie** is:
front-facing, evenly lit, no hat, no heavy filter, hair off the forehead, and
reasonably sharp. Side angles, shadows and filters are the main reason a result
"doesn't look like me". The upload screen now tells guests this.

If likeness still isn't strong enough, switch to the higher-fidelity model:
in Vercel → Settings → Environment Variables add
`REPLICATE_MODEL = black-forest-labs/flux-kontext-max`, then redeploy.

## Tuning

- **Prompts:** edit the `STYLES` array in `public/index.html` (each has a `prompt`).
  They use edit-instruction phrasing ("Change only the hairstyle… do not alter
  the face") which preserves identity much better than "give this person…".
- **Model:** set `REPLICATE_MODEL` env var (no code change needed).
- **Cost control:** consider adding a simple rate limit or a per-session cap
  before sharing the link widely.

---

## Branding

Replace the logo mark (`✂`), name (`IRONHILL`) and gold accent (`--gold`) in
`public/index.html` with the real client's brand before sending.
