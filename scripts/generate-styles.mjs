// Style catalog generator — NEW consistent-model version.
// Makes ONE base model head, then generates the 6 haircuts on that SAME face,
// keeping the hair colour, the charcoal-grey t-shirt and the grey background —
// only the cut changes. Saves to public/styles/<id>.jpg.
//
// Run once (needs your Replicate token):
//   REPLICATE_API_TOKEN=r8_xxx  node scripts/generate-styles.mjs
// or:  npm run gen:styles      (FORCE=1 to regenerate everything)
//
// Uses Nano Banana (Gemini image) on Replicate for identity consistency.

import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, "..", "public", "styles");
const MODEL = "google/nano-banana";

const BASE_PROMPT =
  "Photorealistic studio headshot of a good-looking man in his early 30s, warm confident everyday look, " +
  "medium dark-brown hair, short well-groomed stubble, natural skin with real texture, wearing a plain " +
  "charcoal-grey crew-neck t-shirt, plain neutral grey background, soft even studio lighting, sharp focus, 4K. " +
  "Single portrait, front view, one face, no grid, no collage.";

const KEEP =
  " Use the base image. Same man, same face and identity, same dark-brown hair colour, same charcoal-grey " +
  "t-shirt, same grey background — only the haircut changes to ";
const TAIL =
  ". Photorealistic, vertical 3:4, front view, single portrait, one face, no grid, no collage, 4K.";

const STYLES = [
  { id: "fade",  desc: "a clean modern skin fade with a short textured top" },
  { id: "crop",  desc: "a textured French crop with faded sides and a short blunt fringe" },
  { id: "pomp",  desc: "a classic pompadour with volume and height on top and neatly tapered sides" },
  { id: "buzz",  desc: "a short uniform buzz cut clipped evenly all over" },
  { id: "curl",  desc: "a curly top with defined natural curls and tapered sides" },
  { id: "slick", desc: "a slicked-back style with a sharp mid fade on the sides" },
];

const token = process.env.REPLICATE_API_TOKEN;
if (!token) { console.error("Missing REPLICATE_API_TOKEN. Set it and re-run."); process.exit(1); }
const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };

// Run one Nano Banana prediction and return the output image URL.
async function run(input) {
  let r = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
    method: "POST",
    headers: { ...headers, Prefer: "wait" },
    body: JSON.stringify({ input }),
  });
  let data = await r.json();
  if (r.status >= 400) throw new Error(data.detail || JSON.stringify(data));
  let tries = 0;
  while (data.status && !["succeeded", "failed", "canceled"].includes(data.status) && data.urls?.get && tries < 30) {
    await new Promise((s) => setTimeout(s, 1500));
    data = await (await fetch(data.urls.get, { headers })).json();
    tries++;
  }
  if (data.status !== "succeeded") throw new Error("Generation failed: " + data.status);
  return Array.isArray(data.output) ? data.output[0] : data.output;
}

async function save(url, file) {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(file, buf);
}

await mkdir(OUT, { recursive: true });
const force = process.env.FORCE === "1";

console.log("Generating the base model head ...");
const baseUrl = await run({ prompt: BASE_PROMPT, image_input: [], output_format: "jpg", aspect_ratio: "3:4" });
await save(baseUrl, join(OUT, "_base.jpg"));
console.log("✓ base saved (public/styles/_base.jpg)");

for (const s of STYLES) {
  const file = join(OUT, s.id + ".jpg");
  if (!force && existsSync(file)) { console.log("• skip " + s.id + ".jpg (exists)"); continue; }
  let ok = false;
  for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
    try {
      const url = await run({
        prompt: KEEP + s.desc + TAIL,
        image_input: [baseUrl],       // same face every time
        output_format: "jpg",
        aspect_ratio: "3:4",
      });
      await save(url, file);
      console.log("✓ saved styles/" + s.id + ".jpg");
      ok = true;
    } catch (e) {
      console.error("✗ " + s.id + " (try " + attempt + "): " + e.message);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
console.log("Done.");
