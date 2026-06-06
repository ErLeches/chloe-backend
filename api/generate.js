export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ status: "ok" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { type, prompt, system, user, max_tokens } = req.body || {};

  // === CLAUDE (guion, análisis, poses) ===
  if (type === "claude") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return res.status(500).json({ error: "ANTHROPIC_API_KEY no configurada en Vercel" });
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: max_tokens || 4000,
          system,
          messages: [{ role: "user", content: user }]
        })
      });
      const d = await r.json();
      if (d.error) return res.status(500).json({ error: d.error.message });
      return res.status(200).json({ text: d.content?.[0]?.text || "" });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // === REPLICATE (imágenes) ===
  if (type === "image") {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return res.status(500).json({ error: "REPLICATE_API_TOKEN no configurada en Vercel" });
    try {
      const r = await fetch(
        "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Prefer": "wait"
          },
          body: JSON.stringify({
            input: { prompt, aspect_ratio: "16:9", output_format: "webp", num_outputs: 1 }
          })
        }
      );
      const data = await r.json();
      if (data.status === "succeeded" && data.output?.[0]) {
        return res.status(200).json({ url: data.output[0] });
      }
      if (data.urls?.get) {
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const poll = await fetch(data.urls.get, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          const pd = await poll.json();
          if (pd.status === "succeeded" && pd.output?.[0]) return res.status(200).json({ url: pd.output[0] });
          if (pd.status === "failed") return res.status(500).json({ error: "Generación fallida" });
        }
      }
      return res.status(500).json({ error: "Timeout", data });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: "type debe ser 'claude' o 'image'" });
}
