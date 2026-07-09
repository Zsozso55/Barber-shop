// One-off generator: creates 6 photorealistic haircut reference images with
// Replicate FLUX, and saves them to public/styles/<id>.jpg so the customer app
// shows real AI photos on the style-selection cards.
//
// Run once (needs your Replicate token):
//   REPLICATE_API_TOKEN=r8_xxx  node scripts/generate-styles.mjs
// or, if you have a .env.local:  npm run gen:styles
//
// Cost: 6 images on FLUX schnell = a few US cents total.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, "..", "public", "styles");

// Text-to-image model (fast + cheap). Swap for a higher-quality model if you like.
const MODEL = "black-forest-labs/flux-schnell";

const BASE =
  "Professional barbershop portrait photograph, front-facing headshot of a young man, " +
  "studio lighting, neutral grey background, sharp focus, photorealistic, high detail. Hairstyle: ";

const STYLES = [
  { id: "fade",  desc: "modern skin fade with a short textured crop on top" },
  { id: "crop",  desc: "textured French crop with a short blunt fringe and faded sides" },
  { id: "pomp",  desc: "classic pompadour with volume on top and neatly tapered sides" },
  { id: "buzz",  desc: "short uniform buzz cut" },
  { id: "curl",  desc: "natural curly top with tapered sides" },
  { id: "slick", desc: "slicked-back hair with a sharp mid fade" },
];

const token = process.env.REPLICATE_API_TOKEN;
if (!token) {
  console.error("Missing REPLICATE_API_TOKEN. Set it and re-run.");
  process.exit(1);
}

const headers = {
  Authorization: "Bearer " + token,
  "Content-Type": "application/json",
};

async function generate(style) {
  let r = await fetch(
    `https://api.replicate.com/v1/models/${MODEL}/predictions`,
    {
      method: "POST",
      headers: { ...headers, Prefer: "wait" },
      body: JSON.stringify({
        input: {
          prompt: BASE + style.desc,
          aspect_ratio: "3:4",
          output_format: "jpg",
          num_outputs: 1,
        },
      }),
    }
  );
  let data = await r.json();
  if (r.status >= 400) throw new Error(data.detail || JSON.stringify(data));

  let tries = 0;
  while (
    data.status &&
    !["succeeded", "failed", "canceled"].includes(data.status) &&
    data.urls?.get &&
    tries < 30
  ) {
    await new Promise((s) => setTimeout(s, 1500));
    data = await (await fetch(data.urls.get, { headers })).json();
    tries++;
  }
  if (data.status !== "succeeded") throw new Error("Generation failed: " + data.status);

  const url = Array.isArray(data.output) ? data.output[0] : data.output;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(join(OUT, style.id + ".jpg"), buf);
  console.log("✓ saved styles/" + style.id + ".jpg");
}

await mkdir(OUT, { recursive: true });
console.log("Generating 6 style images with " + MODEL + " ...");
for (const s of STYLES) {
  try { await generate(s); }
  catch (e) { console.error("✗ " + s.id + ": " + e.message); }
}
console.log("Done.");
