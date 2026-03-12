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
  return crypto.createHash('sha256').update(body, 'utf8').digest('base64');
}

// ─── 토큰 캐시 (요청 단위 내에서 재사용, Vercel 인스턴스 warm 상태에서도 활용) ───
const _tokenCache = {};

async function getToken(linkId, secretKey, corpNum, env, scope) {
  const cacheKey = `${linkId}:${corpNum}:${env}:${scope.join(',')}`;
  const cached   = _tokenCache[cacheKey];

  // 만료 30초 전까지 캐시 사용
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    console.log(`[TOKEN] 캐시 사용 (만료까지 ${Math.round((cached.expiresAt - Date.now()) / 1000)}s)`);
    return cached.token;
  }

  const svcId = env === 'live' ? 'POPBILL' : 'POPBILL_TEST';
  const now   = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const ip    = '*';
  const ver   = '2.0';

  const bodyStr = JSON.stringify({ access_id: corpNum, scope });
  const md5val  = contentMd5(bodyStr);

  const resourceURI = `/${svcId}/Token`;
  const sts = ['POST', md5val, now, ip, ver, resourceURI].join('\n');
  const sig = hmacSha256Base64(secretKey, sts);

  console.log(`[TOKEN] 신규 발급 svcId=${svcId} corpNum=${corpNum}`);

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

  // 만료시각 파싱 후 캐시 저장
  // expiration 형식: "2026-03-12T18:41:30.000Z" 또는 "20260312184130"
  let expiresAt = Date.now() + 55 * 60 * 1000; // 기본 55분
  if (data.expiration) {
    const exp = new Date(data.expiration);
    if (!isNaN(exp.getTime())) expiresAt = exp.getTime();
  }
  _tokenCache[cacheKey] = { token: data.session_token, expiresAt };

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

    // ── listBankAccount ──────────────────────────────────────────────────────
    if (action === 'listBankAccount') {
      const token  = await getToken(linkId, secretKey, corpNum, env, efbScope);
      const result = await callApi(baseUrl, token, 'GET', '/EasyFin/Bank/ListBankAccount', null, null, userId);
      return res.status(result.status).json(result.data);
    }

    // ── requestJob ───────────────────────────────────────────────────────────
    if (action === 'requestJob') {
      const { bankCode, accountNumber, sDate, eDate } = payload;
      const token  = await getToken(linkId, secretKey, corpNum, env, efbScope);
      const qs = `BankCode=${encodeURIComponent(bankCode)}&AccountNumber=${encodeURIComponent(accountNumber)}&SDate=${sDate}&EDate=${eDate}`;
      const result = await callApi(baseUrl, token, 'POST', `/EasyFin/Bank/BankAccount?${qs}`, null, null, userId);
      return res.status(result.status).json(result.data);
    }

    // ── getJobState ──────────────────────────────────────────────────────────
    if (action === 'getJobState') {
      const { jobId } = payload;
      const token  = await getToken(linkId, secretKey, corpNum, env, efbScope);
      const result = await callApi(baseUrl, token, 'GET', `/EasyFin/Bank/${jobId}/State`, null, null, userId);
      return res.status(result.status).json(result.data);
    }

    // ── debugUrl: 실제 팝빌 요청 URL + 응답 그대로 반환 (진단용) ─────────────
    if (action === 'debugUrl') {
      const { jobId } = payload;
      const token = await getToken(linkId, secretKey, corpNum, env, efbScope);
      const url = `${baseUrl}/EasyFin/Bank/${jobId}?TradeType=I,O&Page=1&PerPage=10&Order=D`;
      const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
      if (userId) headers['X-PB-UserID'] = userId;
      const resp = await fetch(url, { method: 'GET', headers });
      const text = await resp.text();
      return res.status(200).json({ requestUrl: url, pbStatus: resp.status, pbBody: text.slice(0, 500) });
    }

    // ── search ───────────────────────────────────────────────────────────────
    // 팝빌 공식 REST: GET /EasyFin/Bank/{JobID}   ← /Search 없음! jobId로 끝남
    // 출처: npm popbill SDK EasyFinBankService.js
    //   targetURI = '/EasyFin/Bank/' + JobID + '?TradeType=' + ...
    if (action === 'search') {
      const { jobId, page, perPage } = payload;

      if (!jobId) {
        console.error('[SEARCH] jobId 없음');
        return res.status(400).json({ error: 'jobId 필요' });
      }

      console.log(`[SEARCH] corpNum=${corpNum} userId=${userId} jobId=${jobId}`);

      const token = await getToken(linkId, secretKey, corpNum, env, efbScope);

      const pageNum    = page    || 1;
      const perPageNum = perPage || 1000;

      // TradeType: I,O 를 콤마 구분으로 전달 (SDK 방식: TradeType=I,O)
      const qs  = `TradeType=I,O&Page=${pageNum}&PerPage=${perPageNum}&Order=D`;
      const url = `${baseUrl}/EasyFin/Bank/${jobId}?${qs}`;

      console.log(`[SEARCH] GET ${url}`);

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json'
      };
      if (userId) headers['X-PB-UserID'] = userId;

      const resp = await fetch(url, { method: 'GET', headers });
      const text = await resp.text();
      console.log(`[SEARCH] status=${resp.status} body=${text.slice(0, 500)}`);

      let data;
      try { data = JSON.parse(text); }
      catch { data = { raw: text }; }

      // 팝빌이 404를 내려도 그대로 전달 (원인 진단용)
      return res.status(resp.status).json(data);
    }

    // ── getBankAccountMgtURL ─────────────────────────────────────────────────
    if (action === 'getBankAccountMgtURL') {
      const token  = await getToken(linkId, secretKey, corpNum, env, efbScope);
      const result = await callApi(baseUrl, token, 'GET', '/EasyFin/Bank', { TG: 'BankAccount' }, null, userId);
      return res.status(200).json(result.data);
    }

    // ── issueTaxinvoice ──────────────────────────────────────────────────────
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
