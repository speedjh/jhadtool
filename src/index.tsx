import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  jhadtool_production: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS
app.use('/api/*', cors())

// ══════════════════════════════════════════
// DB API — D1 CRUD
// ══════════════════════════════════════════

// 공통 헬퍼: JSON 응답
const ok  = (c: any, data: any) => c.json({ ok: true, data })
const err = (c: any, msg: string, status = 500) => c.json({ ok: false, error: msg }, status)

// ── invoices ──────────────────────────────
app.get('/api/db/invoices', async (c) => {
  try {
    const r = await c.env.jhadtool_production.prepare('SELECT * FROM invoices ORDER BY updated_at DESC').all()
    return ok(c, r.results)
  } catch(e: any) { return err(c, e.message) }
})
app.post('/api/db/invoices', async (c) => {
  try {
    const rows = await c.req.json() as any[]
    const db = c.env.jhadtool_production
    for (const row of rows) {
      await db.prepare('INSERT OR REPLACE INTO invoices (id, data, updated_at) VALUES (?, ?, ?)')
        .bind(row.id, JSON.stringify(row.data), row.updated_at || new Date().toISOString()).run()
    }
    return ok(c, { count: rows.length })
  } catch(e: any) { return err(c, e.message) }
})
app.delete('/api/db/invoices/:id', async (c) => {
  try {
    await c.env.jhadtool_production.prepare('DELETE FROM invoices WHERE id = ?').bind(c.req.param('id')).run()
    return ok(c, null)
  } catch(e: any) { return err(c, e.message) }
})

// ── transfers ─────────────────────────────
app.get('/api/db/transfers', async (c) => {
  try {
    const r = await c.env.jhadtool_production.prepare('SELECT * FROM transfers ORDER BY updated_at DESC').all()
    return ok(c, r.results)
  } catch(e: any) { return err(c, e.message) }
})
app.post('/api/db/transfers', async (c) => {
  try {
    const rows = await c.req.json() as any[]
    const db = c.env.jhadtool_production
    for (const row of rows) {
      await db.prepare('INSERT OR REPLACE INTO transfers (id, data, updated_at) VALUES (?, ?, ?)')
        .bind(row.id, JSON.stringify(row.data), row.updated_at || new Date().toISOString()).run()
    }
    return ok(c, { count: rows.length })
  } catch(e: any) { return err(c, e.message) }
})
app.delete('/api/db/transfers/:id', async (c) => {
  try {
    await c.env.jhadtool_production.prepare('DELETE FROM transfers WHERE id = ?').bind(c.req.param('id')).run()
    return ok(c, null)
  } catch(e: any) { return err(c, e.message) }
})

// ── clients ───────────────────────────────
app.get('/api/db/clients', async (c) => {
  try {
    const r = await c.env.jhadtool_production.prepare('SELECT * FROM clients ORDER BY org ASC').all()
    return ok(c, r.results)
  } catch(e: any) { return err(c, e.message) }
})
app.post('/api/db/clients', async (c) => {
  try {
    const rows = await c.req.json() as any[]
    const db = c.env.jhadtool_production
    for (const row of rows) {
      await db.prepare(`INSERT OR REPLACE INTO clients
        (id, org, bizno, rep, email, tax_email, address, biz_type, biz_item,
         contact_name, contact_title, contact_tel, memo, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(
          row.id, row.org||'', row.bizno||'', row.rep||'', row.email||'',
          row.tax_email||'', row.address||'', row.biz_type||'', row.biz_item||'',
          row.contact_name||'', row.contact_title||'', row.contact_tel||'',
          row.memo||'', row.created_at||new Date().toISOString()
        ).run()
    }
    return ok(c, { count: rows.length })
  } catch(e: any) { return err(c, e.message) }
})
app.delete('/api/db/clients/:id', async (c) => {
  try {
    await c.env.jhadtool_production.prepare('DELETE FROM clients WHERE id = ?').bind(c.req.param('id')).run()
    return ok(c, null)
  } catch(e: any) { return err(c, e.message) }
})

// ── receivables ───────────────────────────
app.get('/api/db/receivables', async (c) => {
  try {
    const r = await c.env.jhadtool_production.prepare('SELECT * FROM receivables ORDER BY updated_at DESC').all()
    return ok(c, r.results)
  } catch(e: any) { return err(c, e.message) }
})
app.post('/api/db/receivables', async (c) => {
  try {
    const rows = await c.req.json() as any[]
    const db = c.env.jhadtool_production
    for (const row of rows) {
      await db.prepare('INSERT OR REPLACE INTO receivables (id, data, updated_at) VALUES (?, ?, ?)')
        .bind(row.id, JSON.stringify(row.data), row.updated_at || new Date().toISOString()).run()
    }
    return ok(c, { count: rows.length })
  } catch(e: any) { return err(c, e.message) }
})
app.delete('/api/db/receivables/:id', async (c) => {
  try {
    await c.env.jhadtool_production.prepare('DELETE FROM receivables WHERE id = ?').bind(c.req.param('id')).run()
    return ok(c, null)
  } catch(e: any) { return err(c, e.message) }
})

// ── users ─────────────────────────────────
app.get('/api/db/users', async (c) => {
  try {
    const r = await c.env.jhadtool_production.prepare('SELECT * FROM users ORDER BY created_at ASC').all()
    return ok(c, r.results)
  } catch(e: any) { return err(c, e.message) }
})
app.post('/api/db/users', async (c) => {
  try {
    const rows = await c.req.json() as any[]
    const db = c.env.jhadtool_production
    for (const row of rows) {
      await db.prepare('INSERT OR REPLACE INTO users (id, name, pw, role, tel, created_at) VALUES (?,?,?,?,?,?)')
        .bind(row.id, row.name||'', row.pw||'', row.role||'user', row.tel||'', row.created_at||new Date().toISOString()).run()
    }
    return ok(c, { count: rows.length })
  } catch(e: any) { return err(c, e.message) }
})
app.delete('/api/db/users/:id', async (c) => {
  try {
    await c.env.jhadtool_production.prepare('DELETE FROM users WHERE id = ?').bind(c.req.param('id')).run()
    return ok(c, null)
  } catch(e: any) { return err(c, e.message) }
})

// ── settings ──────────────────────────────
app.get('/api/db/settings', async (c) => {
  try {
    const r = await c.env.jhadtool_production.prepare("SELECT * FROM settings WHERE key = 'main'").first()
    return ok(c, r)
  } catch(e: any) { return err(c, e.message) }
})
app.post('/api/db/settings', async (c) => {
  try {
    const { value } = await c.req.json() as any
    await c.env.jhadtool_production.prepare(
      "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('main', ?, ?)"
    ).bind(JSON.stringify(value), new Date().toISOString()).run()
    return ok(c, null)
  } catch(e: any) { return err(c, e.message) }
})

// ── outsources ────────────────────────────
app.get('/api/db/outsources', async (c) => {
  try {
    const r = await c.env.jhadtool_production.prepare('SELECT * FROM outsources ORDER BY updated_at DESC').all()
    return ok(c, r.results)
  } catch(e: any) { return err(c, e.message) }
})
app.post('/api/db/outsources', async (c) => {
  try {
    const rows = await c.req.json() as any[]
    const db = c.env.jhadtool_production
    for (const row of rows) {
      await db.prepare('INSERT OR REPLACE INTO outsources (id, data, updated_at) VALUES (?, ?, ?)')
        .bind(row.id, JSON.stringify(row.data), row.updated_at || new Date().toISOString()).run()
    }
    return ok(c, { count: rows.length })
  } catch(e: any) { return err(c, e.message) }
})

// ── files ─────────────────────────────────
app.get('/api/db/files', async (c) => {
  try {
    const r = await c.env.jhadtool_production.prepare('SELECT * FROM files ORDER BY created_at DESC').all()
    return ok(c, r.results)
  } catch(e: any) { return err(c, e.message) }
})
app.post('/api/db/files', async (c) => {
  try {
    const rows = await c.req.json() as any[]
    const db = c.env.jhadtool_production
    for (const row of rows) {
      await db.prepare('INSERT OR REPLACE INTO files (id, data, created_at) VALUES (?, ?, ?)')
        .bind(row.id, JSON.stringify(row.data), row.created_at || new Date().toISOString()).run()
    }
    return ok(c, { count: rows.length })
  } catch(e: any) { return err(c, e.message) }
})

// ══════════════════════════════════════════
// POPBILL PROXY
// ══════════════════════════════════════════

function hmacSha256Base64CF(secretKey: string, str: string): Promise<string> {
  return crypto.subtle.importKey(
    'raw', Uint8Array.from(atob(secretKey), c => c.charCodeAt(0)),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  ).then(key =>
    crypto.subtle.sign('HMAC', key, new TextEncoder().encode(str))
  ).then(sig => btoa(String.fromCharCode(...new Uint8Array(sig))))
}

function contentSha256(body: string): Promise<string> {
  if (!body) return Promise.resolve('')
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
    .then(buf => btoa(String.fromCharCode(...new Uint8Array(buf))))
}

// 토큰 캐시 (메모리, Worker 인스턴스 내)
const _tokenCache: Record<string, { token: string; expiresAt: number }> = {}

async function getPopbillToken(linkId: string, secretKey: string, corpNum: string, env: string, scope: string[]) {
  const cacheKey = `${linkId}:${corpNum}:${env}:${scope.join(',')}`
  const cached = _tokenCache[cacheKey]
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token

  const svcId = env === 'live' ? 'POPBILL' : 'POPBILL_TEST'
  const now   = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const bodyStr = JSON.stringify({ access_id: corpNum, scope })
  const md5val  = await contentSha256(bodyStr)
  const resourceURI = `/${svcId}/Token`
  const sts = ['POST', md5val, now, '*', '2.0', resourceURI].join('\n')
  const sig = await hmacSha256Base64CF(secretKey, sts)

  const res = await fetch(`https://auth.linkhub.co.kr/${svcId}/Token`, {
    method: 'POST',
    headers: {
      'Authorization': `LINKHUB ${linkId} ${sig}`,
      'Content-Type': 'application/json',
      'X-LH-Version': '2.0',
      'X-LH-Date': now,
      'X-LH-Forwarded': '*'
    },
    body: bodyStr
  })
  const data = await res.json() as any
  if (!res.ok || !data.session_token) throw new Error(`토큰 발급 실패: ${JSON.stringify(data).slice(0,200)}`)

  let expiresAt = Date.now() + 55 * 60 * 1000
  if (data.expiration) {
    const exp = new Date(data.expiration)
    if (!isNaN(exp.getTime())) expiresAt = exp.getTime()
  }
  _tokenCache[cacheKey] = { token: data.session_token, expiresAt }
  return data.session_token
}

app.post('/api/popbill-proxy', async (c) => {
  try {
    const body = await c.req.json() as any
    const { linkId, secretKey, corpNum, userId, env, action, payload } = body
    if (!linkId || !secretKey) return err(c, 'linkId, secretKey 필요', 400)
    if (!corpNum) return err(c, 'corpNum 필요', 400)

    const baseUrl = env === 'live'
      ? 'https://popbill.linkhub.co.kr'
      : 'https://popbill-test.linkhub.co.kr'

    const efbScope = ['member', '180']

    async function pbCall(method: string, path: string, qs?: string) {
      const token = await getPopbillToken(linkId, secretKey, corpNum, env, efbScope)
      const url = `${baseUrl}${path}${qs ? '?' + qs : ''}`
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
      if (userId) headers['X-PB-UserID'] = userId
      const res = await fetch(url, { method, headers })
      const data = await res.json().catch(() => ({}))
      return { status: res.status, ok: res.ok, data }
    }

    if (action === 'listBankAccount') {
      const r = await pbCall('GET', '/EasyFin/Bank/ListBankAccount')
      return c.json(r.data, r.status as any)
    }
    if (action === 'requestJob') {
      const { bankCode, accountNumber, sDate, eDate } = payload
      const qs = `BankCode=${encodeURIComponent(bankCode)}&AccountNumber=${encodeURIComponent(accountNumber)}&SDate=${sDate}&EDate=${eDate}`
      const r = await pbCall('POST', `/EasyFin/Bank/BankAccount?${qs}`)
      return c.json(r.data, r.status as any)
    }
    if (action === 'getJobState') {
      const r = await pbCall('GET', `/EasyFin/Bank/${payload.jobId}/State`)
      return c.json(r.data, r.status as any)
    }
    if (action === 'search') {
      const { jobId, page, perPage } = payload
      const qs = `TradeType=I,O&Page=${page||1}&PerPage=${perPage||1000}&Order=D`
      const r = await pbCall('GET', `/EasyFin/Bank/${jobId}`, qs)
      return c.json(r.data, r.status as any)
    }
    if (action === 'getBankAccountMgtURL') {
      const r = await pbCall('GET', '/EasyFin/Bank', 'TG=BankAccount')
      return c.json(r.data, r.status as any)
    }
    if (action === 'issueTaxinvoice') {
      const taxScope = ['member', '110']
      const token = await getPopbillToken(linkId, secretKey, corpNum, env, taxScope)
      const url = `${baseUrl}/Taxinvoice`
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
      if (userId) headers['X-PB-UserID'] = userId
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))
      return c.json(data, res.status as any)
    }
    if (action === 'debugUrl') {
      const token = await getPopbillToken(linkId, secretKey, corpNum, env, efbScope)
      const url = `${baseUrl}/EasyFin/Bank/${payload.jobId}?TradeType=I,O&Page=1&PerPage=10&Order=D`
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
      if (userId) headers['X-PB-UserID'] = userId
      const resp = await fetch(url, { method: 'GET', headers })
      const text = await resp.text()
      return c.json({ requestUrl: url, pbStatus: resp.status, pbBody: text.slice(0, 500) })
    }
    return err(c, `알 수 없는 action: ${action}`, 400)
  } catch(e: any) {
    return err(c, e.message)
  }
})

// ══════════════════════════════════════════
// BOLTA PROXY
// ══════════════════════════════════════════

async function callBolta(apiKey: string, customerKey: string, env: string, method: string, path: string, payload?: any) {
  const base = env === 'live' ? 'https://api.bolta.io' : 'https://xapi.bolta.io'
  const url  = base + path
  const authToken = btoa(apiKey + ':')
  const fetchOpts: RequestInit = {
    method: method || 'GET',
    headers: {
      'Authorization': 'Basic ' + authToken,
      'Customer-Key':  customerKey,
      'Content-Type':  'application/json',
      'Accept':        'application/json'
    }
  }
  if (payload && ['POST','PUT','PATCH'].includes(method)) {
    (fetchOpts as any).body = JSON.stringify(payload)
  }
  const r    = await fetch(url, fetchOpts)
  const data = await r.json().catch(() => ({}))
  return { status: r.status, data }
}

app.post('/api/bolta-proxy', async (c) => {
  try {
    const body = await c.req.json() as any
    const { apiKey, customerKey, env, method, path, payload } = body
    if (!apiKey) return err(c, 'apiKey가 필요합니다.', 400)

    let ck = customerKey
    let workingEnv = env || 'test'

    if (!ck) {
      for (const e of [workingEnv, workingEnv === 'live' ? 'test' : 'live']) {
        const { status, data } = await callBolta(apiKey, 'dummy', e, 'GET', '/v1/customers', null)
        if (status === 200 && Array.isArray(data) && data.length > 0) {
          ck = data[0].customerKey
          workingEnv = e
          break
        }
      }
      if (!ck) return err(c, 'customerKey 자동 조회 실패', 400)
    }

    let { status, data } = await callBolta(apiKey, ck, workingEnv, method, path, payload)

    const isNotFound = status >= 400 && (
      (data as any).code === 'NOT_FOUND' ||
      ((data as any).body && (data as any).body.code === 'NOT_FOUND')
    )
    if (isNotFound && workingEnv === 'live') {
      const retry = await callBolta(apiKey, ck, 'test', method, path, payload)
      status = retry.status
      data   = retry.data
    }

    return c.json(data, status as any)
  } catch(e: any) {
    return err(c, e.message)
  }
})

// ══════════════════════════════════════════
// Static + SPA fallback
// ══════════════════════════════════════════
app.use('/static/*', serveStatic({ root: './public' }))
app.use('/*', serveStatic({ root: './public' }))

export default app
