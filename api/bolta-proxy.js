// Vercel Serverless Function
// 경로: /api/bolta-proxy

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

async function callBolta(apiKey, customerKey, env, method, path, payload) {
  const base = env === 'live' ? 'https://api.bolta.io' : 'https://xapi.bolta.io';
  const url  = `${base}${path}`;
  const authToken = Buffer.from(apiKey + ':').toString('base64');

  const fetchOpts = {
    method: method || 'GET',
    headers: {
      'Authorization': 'Basic ' + authToken,
      'Customer-Key':  customerKey,   // 그대로 전달 (CustomerKey_xxx 형식 유지)
      'Content-Type':  'application/json',
      'Accept':        'application/json'
    }
  };
  if (payload && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    fetchOpts.body = JSON.stringify(payload);
  }

  const r    = await fetch(url, fetchOpts);
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); }
  catch { data = { raw: text }; }

  return { status: r.status, data };
}

module.exports = async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'POST만 허용' });

  try {
    const { apiKey, customerKey, env, method, path, payload } = req.body;

    if (!apiKey) return res.status(400).json({ error: 'apiKey가 필요합니다.' });

    // customerKey가 없으면 /v1/customers 자동 조회로 획득
    let ck = customerKey;
    let workingEnv = env || 'test';

    if (!ck) {
      // 두 환경 모두 시도
      for (const e of [workingEnv, workingEnv === 'live' ? 'test' : 'live']) {
        const { status, data } = await callBolta(apiKey, 'dummy', e, 'GET', '/v1/customers', null);
        if (status === 200 && Array.isArray(data) && data.length > 0) {
          ck = data[0].customerKey;
          workingEnv = e;
          console.log('[bolta-proxy] customerKey 자동획득:', ck, 'env:', e);
          break;
        }
      }
      if (!ck) return res.status(400).json({ error: 'customerKey를 자동 조회하지 못했습니다. 설정탭에서 직접 입력해주세요.' });
    }

    console.log('[bolta-proxy] →', method, path, '| env:', workingEnv, '| ck앞12:', ck.substring(0, 12));

    // 1차 시도
    let { status, data } = await callBolta(apiKey, ck, workingEnv, method, path, payload);

    // NOT_FOUND이고 live 환경이면 → test로 자동 재시도
    const isNotFound = status >= 400 && (
      (data.body && data.body.code === 'NOT_FOUND') ||
      data.code === 'NOT_FOUND'
    );

    if (isNotFound && workingEnv === 'live') {
      console.log('[bolta-proxy] live NOT_FOUND → test 자동 재시도');
      const retry = await callBolta(apiKey, ck, 'test', method, path, payload);
      status = retry.status;
      data   = retry.data;
      console.log('[bolta-proxy] test 재시도 결과:', status);
    }

    // /v1/customers 조회처럼 customerKey 자동획득 요청이면 전체 데이터 반환
    const boltaErr = data && data.type === 'ERROR';
    const statusCode = boltaErr ? (status >= 400 ? status : 400) : status;

    return res.status(statusCode).json(data);

  } catch (e) {
    console.error('[bolta-proxy] exception:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
