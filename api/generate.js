// Serverless AI endpoint — runs on Vercel (Node runtime).
// Takes a selfie (data URL) + a prompt, calls an image-editing model on
// Replicate to re-style the hair while preserving the face, and returns the
// result image URL.
//
// The Replicate token stays server-side (never exposed to the browser).
// Set REPLICATE_API_TOKEN in your Vercel project's Environment Variables.
//
// Model is chosen with the REPLICATE_MODEL env var. Recommended for best face
// likeness: "google/nano-banana" (Gemini 2.5 Flash Image). Also supported:
// "black-forest-labs/flux-kontext-max" / "...-pro".

export const maxDuration = 60; // allow up to 60s for the model to finish

const MODEL = process.env.REPLICATE_MODEL || "google/nano-banana";

// Upload a data-URL image to Replicate's file store and return a hosted URL.
// If it's already a plain URL, return it unchanged.
async function toHostedUrl(image, token) {
  if (!/^data:/.test(image)) return image;
  const m = image.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return image;
  const mime = m[1] || "image/jpeg";
  const buf = Buffer.from(m[2], "base64");
  const form = new FormData();
  form.append("content", new Blob([buf], { type: mime }), "selfie.jpg");
  const r = await fetch("https://api.replicate.com/v1/files", {
    method: "POST",
    headers: { Authorization: "Bearer " + token }, // let fetch set multipart boundary
    body: form,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.detail || "Image upload failed.");
  const url = (d.urls && d.urls.get) || d.url;
  if (!url) throw new Error("Image upload returned no URL.");
  return url;
}

// Different models expect different input field names for the source photo.
function buildInput(model, prompt, image) {
  if (model.includes("nano-banana")) {
    // Google Nano Banana (Gemini image) — edit mode takes an array of images.
    return { prompt, image_input: [image], output_format: "jpg" };
  }
  // FLUX.1 Kontext family.
  return {
    prompt,
    input_image: image,
    aspect_ratio: "match_input_image",
    output_format: "jpg",
    safety_tolerance: 2,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return res.status(500).json({
      error: "Server not configured: REPLICATE_API_TOKEN is missing.",
    });
  }

  const { image, prompt } = req.body || {};
  if (!image || !prompt) {
    return res.status(400).json({ error: "Missing 'image' or 'prompt'." });
  }

  const headers = {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
  };

  try {
    // Upload the selfie to Replicate's file store first, so the model always
    // receives a real hosted image URL (data URLs are sometimes dropped, which
    // makes the model ignore the photo and invent a random face).
    const imageUrl = await toHostedUrl(image, token);

    // Kick off the prediction. "Prefer: wait" makes Replicate hold the
    // connection open and return the finished result inline when possible.
    let r = await fetch(
      `https://api.replicate.com/v1/models/${MODEL}/predictions`,
      {
        method: "POST",
        headers: { ...headers, Prefer: "wait" },
        body: JSON.stringify({ input: buildInput(MODEL, prompt, imageUrl) }),
      }
    );

    let data = await r.json();
    if (r.status >= 400) {
      return res
        .status(502)
        .json({ error: data.detail || data.error || "Replicate error." });
    }

    // If it isn't finished yet, poll the prediction URL until it is.
    let tries = 0;
    while (
      data.status &&
      !["succeeded", "failed", "canceled"].includes(data.status) &&
      tries < 25 &&
      data.urls &&
      data.urls.get
    ) {
      await new Promise((s) => setTimeout(s, 1500));
      const g = await fetch(data.urls.get, { headers });
      data = await g.json();
      tries++;
    }

    if (data.status === "failed" || data.status === "canceled") {
      return res
        .status(502)
        .json({ error: data.error || "Generation failed." });
    }

    let out = Array.isArray(data.output) ? data.output[0] : data.output;
    if (!out) {
      return res
        .status(502)
        .json({ error: "No image returned by the model.", status: data.status });
    }

    return res.status(200).json({ output: out });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unexpected error." });
  }
}
