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
          model: "claude-sonnet-4-5",
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

  // === DALL-E (imágenes) ===
  if (type === "image") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.status(500).json({ error: "OPENAI_API_KEY no configurada en Vercel" });
    try {
      const r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt,
          n: 1,
          size: "1792x1024",
          quality: "standard"
        })
      });
      const data = await r.json();
      if (data.error) return res.status(500).json({ error: data.error.message });
      return res.status(200).json({ url: data.data?.[0]?.url });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: "type debe ser 'claude' o 'image'" });
}
