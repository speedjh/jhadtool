// Vercel Serverless Function - 볼타 웹훅 수신
// 경로: /api/bolta-webhook
// 볼타 대시보드 API 키 설정에서 웹훅 수신 URL을 https://jhadtool.vercel.app/api/bolta-webhook 으로 설정

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

const SUPABASE_URL = 'https://vkjujogdlxztzsscrrzu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZranVqb2dkbHh6dHpzc2Nycnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDQxMzEsImV4cCI6MjA4NzUyMDEzMX0.hkYH4lDQnbfRcuWoxdim3P1_LxmdcDhI_l1mnt3q4PA';

// Supabase에서 txId(issuanceKey)로 invoice 찾아서 ntsConfirmNum 업데이트
async function updateInvoiceNtsNum(issuanceKey, ntsConfirmNum, status) {
  try {
    // invoices 테이블에서 data->>'txId' = issuanceKey 인 row 찾기
    const searchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/invoices?select=id,data`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const rows = await searchRes.json();
    if (!Array.isArray(rows)) {
      console.error('[webhook] Supabase 조회 실패', rows);
      return false;
    }

    // txId가 일치하는 row 찾기
    const target = rows.find(r => r.data && r.data.txId === issuanceKey);
    if (!target) {
      console.log('[webhook] issuanceKey 일치하는 invoice 없음:', issuanceKey);
      return false;
    }

    // data 업데이트: ntsConfirmNum, boltaStatus 추가
    const newData = {
      ...target.data,
      ntsConfirmNum: ntsConfirmNum || target.data.ntsConfirmNum,
      boltaStatus: status || target.data.boltaStatus
    };

    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/invoices?id=eq.${target.id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ data: newData })
      }
    );

    console.log('[webhook] Supabase 업데이트 완료:', updateRes.status, issuanceKey, ntsConfirmNum);
    return updateRes.ok;
  } catch (e) {
    console.error('[webhook] Supabase 업데이트 오류:', e.message);
    return false;
  }
}

module.exports = async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET 요청 = 웹훅 URL 확인용 (볼타 대시보드에서 연결 테스트)
  if (req.method === 'GET') {
    return res.status(200).json({ 
      ok: true, 
      message: '볼타 웹훅 수신 엔드포인트 정상 동작 중',
      url: 'https://jhadtool.vercel.app/api/bolta-webhook'
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 허용' });

  try {
    const body = req.body;
    console.log('[볼타 웹훅 수신]', JSON.stringify(body).substring(0, 500));

    // 볼타 웹훅 이벤트 구조:
    // { event: 'TAX_INVOICE_ISSUED', data: { issuanceKey, ntsConfirmNum, status, ... } }
    // { event: 'TAX_INVOICE_ISSUE_PROCESSING', data: { issuanceKey, status: 'PROCESSING', ... } }
    const event = body.event || body.type || '';
    const data  = body.data || body;

    const issuanceKey   = data.issuanceKey || data.id || null;
    const ntsConfirmNum = data.ntsConfirmNum || data.confirmNum || null;
    const status        = data.status || (event.includes('ISSUED') ? 'ISSUED' : event.includes('PROCESSING') ? 'PROCESSING' : null);

    console.log('[볼타 웹훅]', { event, issuanceKey, ntsConfirmNum, status });

    if (issuanceKey) {
      await updateInvoiceNtsNum(issuanceKey, ntsConfirmNum, status);
    }

    // 볼타는 200 응답 받아야 웹훅 성공으로 처리
    return res.status(200).json({ received: true, event, issuanceKey });

  } catch (e) {
    console.error('[webhook] 처리 오류:', e.message);
    return res.status(200).json({ received: true, error: e.message }); // 200 유지 (볼타 재시도 방지)
  }
};
