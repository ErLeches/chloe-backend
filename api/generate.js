export default async function handler(req, res) {
  // CORS headers — must be set before anything else
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Max-Age", "86400");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Health check
  if (req.method === "GET") {
    return res.status(200).json({ status: "ok" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "Prompt requerido" });
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "API token no configurado en Vercel" });
  }

  try {
    const response = await fetch(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "Prefer": "wait"
        },
        body: JSON.stringify({
          input: {
            prompt: prompt,
            aspect_ratio: "16:9",
            output_format: "webp",
            num_outputs: 1
          }
        })
      }
    );

    const data = await response.json();

    if (data.status === "succeeded" && data.output?.[0]) {
      return res.status(200).json({ url: data.output[0] });
    }

    // Poll if not ready yet
    if (data.urls?.get) {
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const poll = await fetch(data.urls.get, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const pd = await poll.json();
        if (pd.status === "succeeded" && pd.output?.[0]) {
          return res.status(200).json({ url: pd.output[0] });
        }
        if (pd.status === "failed") {
          return res.status(500).json({ error: "Generación fallida en Replicate" });
        }
      }
      return res.status(500).json({ error: "Timeout esperando imagen" });
    }

    return res.status(500).json({ error: "Respuesta inesperada de Replicate", data });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
