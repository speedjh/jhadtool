// Vercel Serverless Function
// 경로: /api/bolta-proxy

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

module.exports = async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST만 허용' });
  }

  try {
    const { apiKey, customerKey, env, method, path, payload } = req.body;

    if (!apiKey || !customerKey) {
      return res.status(400).json({ error: 'apiKey와 customerKey가 필요합니다' });
    }

    const base = env === 'live' ? 'https://api.bolta.io' : 'https://xapi.bolta.io';
    const url  = `${base}${path}`;

    const fetchOpts = {
      method: method || 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
        'Customer-Key':  customerKey,
        'Content-Type':  'application/json'
      }
    };
    if (payload && method === 'POST') {
      fetchOpts.body = JSON.stringify(payload);
    }

    const r    = await fetch(url, fetchOpts);
    const text = await r.text();

    let data;
    try { data = JSON.parse(text); }
    catch { data = { raw: text }; }

    return res.status(r.status).json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
