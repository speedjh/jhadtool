// Vercel Serverless Function
// 경로: /api/popbill-proxy
const crypto = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

function hmacSha256Base64(secretKey, str) {
  return crypto.createHmac('sha256', Buffer.from(secretKey, 'base64'))
    .update(str, 'utf8').digest('base64');
}

function contentMd5(body) {
  if (!body) return '';
  // 팝빌 공식문서: openssl dgst -sha256 (MD5가 아닌 SHA-256)
  return crypto.createHash('sha256').update(body, 'utf8').digest('base64');
}

async function getToken(linkId, secretKey, corpNum, env, scope) {
  const svcId = env === 'live' ? 'POPBILL' : 'POPBILL_TEST';
  const now   = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const ip    = '*';
  const ver   = '2.0';

  const bodyStr = JSON.stringify({ access_id: corpNum, scope });
  const md5val  = contentMd5(bodyStr);

  const resourceURI = `/${svcId}/Token`;
  const sts = ['POST', md5val, now, ip, ver, resourceURI].join('\n');
  const sig = hmacSha256Base64(secretKey, sts);

  console.log(`[TOKEN] svcId=${svcId} corpNum=${corpNum} scope=${JSON.stringify(scope)}`);
  console.log(`[TOKEN] StringToSign=\n${sts}`);

  const res = await fetch(`https://auth.linkhub.co.kr/${svcId}/Token`, {
    method: 'POST',
    headers: {
      'Authorization':  `LINKHUB ${linkId} ${sig}`,
      'Content-Type':   'application/json',
      'X-LH-Version':   ver,
      'X-LH-Date':      now,
      'X-LH-Forwarded': ip
    },
    body: bodyStr
  });

  const text = await res.text();
  console.log(`[TOKEN] status=${res.status} body=${text.slice(0, 300)}`);

  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`토큰 파싱 실패 (${res.status}): ${text.slice(0, 200)}`); }

  if (!res.ok || !data.session_token)
    throw new Error(`토큰 발급 실패 (${res.status}): ${text.slice(0, 200)}`);

  console.log(`[TOKEN] 발급 성공 만료=${data.expiration}`);
  return data.session_token;
}

async function callApi(baseUrl, token, method, path, queryParams, bodyPayload, userId) {
  let url = baseUrl + path;
  if (queryParams) {
    const qs = new URLSearchParams(queryParams).toString();
    if (qs) url += '?' + qs;
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type':  'application/json'
  };
  if (userId) headers['X-PB-UserID'] = userId;

  const opts = { method, headers };
  if (bodyPayload && (method === 'POST' || method === 'PUT'))
    opts.body = JSON.stringify(bodyPayload);

  console.log(`[API] ${method} ${url}`);
  const res  = await fetch(url, opts);
  const text = await res.text();
  console.log(`[API] status=${res.status} body=${text.slice(0, 500)}`);

  let data;
  try { data = JSON.parse(text); }
  catch { data = { raw: text }; }

  return { status: res.status, ok: res.ok, data };
}

module.exports = async function handler(req, res) {
  // CORS 헤더 항상 설정
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST만 허용' });
  }

  try {
    const { linkId, secretKey, corpNum, userId, env, action, payload } = req.body;

    console.log(`[PROXY] action=${action} corpNum=${corpNum} env=${env} userId=${userId}`);

    if (!linkId || !secretKey)
      return res.status(400).json({ error: 'linkId, secretKey 필요' });
    if (!corpNum)
      return res.status(400).json({ error: 'corpNum(사업자번호) 필요' });

    const baseUrl = env === 'live'
      ? 'https://popbill.linkhub.co.kr'
      : 'https://popbill-test.linkhub.co.kr';

    const efbScope = ['member', '180'];
    const taxScope = ['member', '110'];

    if (action === 'listBankAccount') {
      const token  = await getToken(linkId, secretKey, corpNum, env, efbScope);
      const result = await callApi(baseUrl, token, 'GET', '/EasyFin/Bank/ListBankAccount', null, null, userId);
      return res.status(result.status).json(result.data);
    }

    if (action === 'requestJob') {
      const { bankCode, accountNumber, sDate, eDate } = payload;
      const token  = await getToken(linkId, secretKey, corpNum, env, efbScope);
      const result = await callApi(baseUrl, token, 'POST', '/EasyFin/Bank/BankAccount',
        { BankCode: bankCode, AccountNumber: accountNumber, SDate: sDate, EDate: eDate },
        null, userId);
      return res.status(result.status).json(result.data);
    }

    if (action === 'getJobState') {
      const { jobId } = payload;
      const token  = await getToken(linkId, secretKey, corpNum, env, efbScope);
      const result = await callApi(baseUrl, token, 'GET', `/EasyFin/Bank/${jobId}/State`, null, null, userId);
      return res.status(result.status).json(result.data);
    }

    if (action === 'search') {
      const { jobId, tradeType, page, perPage } = payload;
      const token  = await getToken(linkId, secretKey, corpNum, env, efbScope);
      const qs = { TradeType: tradeType || 'I', Page: page || 1, PerPage: perPage || 1000 };
      const result = await callApi(baseUrl, token, 'GET', `/EasyFin/Bank/${jobId}/Search`, qs, null, userId);
      return res.status(result.status).json(result.data);
    }

    if (action === 'getBankAccountMgtURL') {
      const token  = await getToken(linkId, secretKey, corpNum, env, efbScope);
      const result = await callApi(baseUrl, token, 'GET', '/EasyFin/Bank', { TG: 'BankAccount' }, null, userId);
      return res.status(200).json(result.data);
    }

    if (action === 'issueTaxinvoice') {
      const token  = await getToken(linkId, secretKey, corpNum, env, taxScope);
      const result = await callApi(baseUrl, token, 'POST', '/Taxinvoice', null, payload, userId);
      return res.status(result.status).json(result.data);
    }

    return res.status(400).json({ error: `알 수 없는 action: ${action}` });

  } catch (e) {
    console.error('[PROXY ERROR]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
