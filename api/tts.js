export default async function handler(req, res) {
  const key = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
  const modelFor = (lang) => lang === 'ca'
    ? (process.env.ELEVENLABS_MODEL_CA || 'eleven_v3')
    : (process.env.ELEVENLABS_MODEL_ES || 'eleven_multilingual_v2');

  async function ttsCall(model, text, lang) {
    const body = { text, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.8 } };
    if (lang) body.language_code = lang;
    return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
      body: JSON.stringify(body)
    });
  }

  if (req.method === 'GET') {
    const out = { hasKey: !!key, voiceId };
    if (key) {
      out.tests = [];
      for (const m of ['eleven_v3', 'eleven_turbo_v2_5', 'eleven_multilingual_v2']) {
        try {
          const r = await ttsCall(m, 'bon dia, com estàs', 'ca');
          const t = { model: m, status: r.status };
          if (!r.ok) t.error = (await r.text()).slice(0, 200);
          out.tests.push(t);
        } catch (e) { out.tests.push({ model: m, exception: String(e).slice(0, 150) }); }
      }
    }
    res.status(200).json(out);
    return;
  }

  if (req.method !== 'POST') { res.status(405).json({ error: 'method' }); return; }
  if (!key) { res.status(500).json({ error: 'no_key' }); return; }

  let data = req.body;
  if (!data) {
    let raw = '';
    await new Promise(r => { req.on('data', c => raw += c); req.on('end', r); });
    try { data = JSON.parse(raw || '{}'); } catch (e) { data = {}; }
  }
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { data = {}; } }

  const text = (data && data.text ? String(data.text) : '').slice(0, 600);
  const lang = (data && data.lang === 'ca') ? 'ca' : 'es';
  if (!text) { res.status(400).json({ error: 'no_text' }); return; }

  try {
    const r = await ttsCall(modelFor(lang), text, lang);
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
