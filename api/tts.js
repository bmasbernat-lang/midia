// Función serverless de Vercel: convierte texto en voz realista con ElevenLabs.
// La clave secreta vive en Vercel (process.env.ELEVENLABS_API_KEY), nunca en la app.
export default async function handler(req, res) {
  const key = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';

  // --- CHEQUEO (GET): permite diagnosticar desde fuera qué falla ---
  if (req.method === 'GET') {
    const out = { deployed: true, hasKey: !!key, keyStartsWith: key ? key.slice(0, 3) : null, voiceId };
    if (key) {
      try {
        const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: { 'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
          body: JSON.stringify({ text: 'ok', model_id: 'eleven_multilingual_v2' })
        });
        out.elevenStatus = r.status;
        if (r.ok) out.elevenOk = true;
        else out.elevenError = (await r.text()).slice(0, 300);
      } catch (e) { out.elevenException = String(e).slice(0, 200); }
    }
    res.status(200).json(out);
    return;
  }

  if (req.method !== 'POST') { res.status(405).json({ error: 'method' }); return; }
  if (!key) { res.status(500).json({ error: 'no_key' }); return; }

  // Leer el cuerpo de la petición (texto a decir)
  let data = req.body;
  if (!data) {
    let raw = '';
    await new Promise(r => { req.on('data', c => raw += c); req.on('end', r); });
    try { data = JSON.parse(raw || '{}'); } catch (e) { data = {}; }
  }
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { data = {}; } }

  const text = (data && data.text ? String(data.text) : '').slice(0, 600);
  if (!text) { res.status(400).json({ error: 'no_text' }); return; }

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.8 }
      })
    });
    if (!r.ok) {
      const t = await r.text();
      res.status(502).json({ error: 'tts_failed', detail: t.slice(0, 300) });
      return;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).json({ error: 'exception', detail: String(e).slice(0, 200) });
  }
}
