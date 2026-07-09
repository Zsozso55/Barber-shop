// Serverless AI endpoint — runs on Vercel (Node runtime).
// Takes a selfie (data URL) + a prompt, calls Replicate FLUX.1 Kontext to
// re-style the hair while preserving the face, and returns the result image URL.
//
// The Replicate token stays server-side (never exposed to the browser).
// Set REPLICATE_API_TOKEN in your Vercel project's Environment Variables.

export const maxDuration = 60; // allow up to 60s for the model to finish

const MODEL = "black-forest-labs/flux-kontext-pro";

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
    // Kick off the prediction. "Prefer: wait" makes Replicate hold the
    // connection open and return the finished result inline when possible.
    let r = await fetch(
      `https://api.replicate.com/v1/models/${MODEL}/predictions`,
      {
        method: "POST",
        headers: { ...headers, Prefer: "wait" },
        body: JSON.stringify({
          input: {
            prompt,
            input_image: image, // data URL is accepted directly
            aspect_ratio: "match_input_image",
            output_format: "jpg",
            safety_tolerance: 2,
          },
        }),
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
