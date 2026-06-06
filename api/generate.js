export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ status: "ok", message: "Backend funcionando" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt requerido" });

  try {
    const r = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Prefer": "wait"
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: "16:9",
          output_format: "webp",
          num_outputs: 1
        }
      })
    });

    const data = await r.json();

    if (data.status === "succeeded") {
      return res.status(200).json({ url: data.output?.[0] });
    }

    // Poll si no está listo
    if (data.urls?.get) {
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const poll = await fetch(data.urls.get, {
          headers: { "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}` }
        });
        const pd = await poll.json();
        if (pd.status === "succeeded") return res.status(200).json({ url: pd.output?.[0] });
        if (pd.status === "failed") return res.status(500).json({ error: "Generación fallida" });
      }
    }

    return res.status(500).json({ error: "Timeout" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
