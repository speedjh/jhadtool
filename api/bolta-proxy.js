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
      return res.status(400).json({ error: 'apiKey와 customerKey가 필요합니다. 설정탭을 확인하세요.' });
    }

    const base = env === 'live' ? 'https://api.bolta.io' : 'https://xapi.bolta.io';
    const url  = `${base}${path}`;

    // Bolta 인증: API Key를 그대로 Basic auth username으로 사용 (비밀번호 없음)
    // Basic base64("apiKey:")
    const authToken = Buffer.from(apiKey + ':').toString('base64');

    console.log('[bolta-proxy] →', method, url);
    console.log('[bolta-proxy] customerKey앞8:', customerKey.substring(0, 8));
    console.log('[bolta-proxy] apiKey앞8:', apiKey.substring(0, 8));

    const fetchOpts = {
      method: method || 'GET',
      headers: {
        'Authorization': 'Basic ' + authToken,
        'Customer-Key':  customerKey,
        'Content-Type':  'application/json',
        'Accept':        'application/json'
      }
    };
    if (payload && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      fetchOpts.body = JSON.stringify(payload);
      console.log('[bolta-proxy] payload:', JSON.stringify(payload).substring(0, 200));
    }

    const r    = await fetch(url, fetchOpts);
    const text = await r.text();

    console.log('[bolta-proxy] ← status:', r.status, 'body앞200:', text.substring(0, 200));

    let data;
    try { data = JSON.parse(text); }
    catch { data = { raw: text }; }

    // Bolta 에러 응답 형식: { body: { message, code }, type: 'ERROR', timestamp }
    // HTTP 상태가 200이어도 실제 에러일 수 있으므로 적절한 상태 코드로 반환
    const boltaErr = data && data.type === 'ERROR';
    const statusCode = boltaErr ? (r.status >= 400 ? r.status : 400) : r.status;

    return res.status(statusCode).json(data);

  } catch (e) {
    console.error('[bolta-proxy] exception:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
