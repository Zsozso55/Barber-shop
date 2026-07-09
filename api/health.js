// Quick diagnostic. Open https://<your-app>.vercel.app/api/health in a browser
// to confirm which model is live and whether the token is set — no secrets exposed.

const MODEL = process.env.REPLICATE_MODEL || "google/nano-banana";

export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    model: MODEL,
    usingNanoBanana: MODEL.includes("nano-banana"),
    hasToken: !!process.env.REPLICATE_API_TOKEN,
    deployedAt: new Date().toISOString(),
  });
}
