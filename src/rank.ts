// ══════════════════════════════════════════
// 리워드 순위체크 (플레이스 · N 가격비교)
// - 순위 수집은 회사 PC 의 순위 서버(ai-desk)가 한다(네이버가 클라우드 IP 를 막을 수 있어서).
// - 순위 서버 → /api/rank-sync/push 로 결과를 올려 보내고(rk_* 표), 화면은 /api/rank/* 로 읽는다.
// - 화면에서 누른 등록·삭제·재검색 등은 rk_commands 에 쌓고, 순위 서버가 몇 초마다 가져가 처리한 뒤 결과를 적는다.
//   (회사 PC 로 들어가는 연결은 없다)
// - /api/rank-sync/* 는 비밀키(환경변수 RANK_SYNC_TOKEN, X-Sync-Token 헤더)가 맞을 때만.
// ══════════════════════════════════════════
import { Hono } from 'hono'

type Bindings = { jhadtool_production: D1Database; RANK_SYNC_TOKEN?: string }
const rank = new Hono<{ Bindings: Bindings }>()
const db = (c: any): D1Database => c.env.jhadtool_production

const KST = 9 * 3600e3
const kstStamp = (d = new Date()) => new Date(d.getTime() + KST).toISOString().replace('T', ' ').slice(0, 19)
const kstDay = () => kstStamp().slice(0, 10)
const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10)

// ---------- 화면: 읽기 (복사본에서 바로) ----------
const SFL: Record<string, string[]> = { all: ['t.keyword', 't.name', 't.memo', 't.client', 't.ref_id', 't.url'], url: ['t.name', 't.ref_id', 't.url'], keyword: ['t.keyword'], name: ['t.name'], memo: ['t.memo', 't.client'] }
const SST: Record<string, string> = { keyword: 't.keyword', url: 't.ref_id', name: 't.name', rank: 'CASE WHEN t.last_rank IS NULL THEN 9999 WHEN t.last_rank=0 THEN 9998 ELSE t.last_rank END', volume: 'COALESCE(t.search_volume,-1)', change: 'ABS(COALESCE(t.last_rank,0)-COALESCE(t.prev_rank,0))', recent: 't.id', reg: 't.created_at' }
const DESC_FIRST = new Set(['recent', 'change', 'volume', 'reg'])

rank.get('/api/rank/targets', async (c) => {
  try {
    const q = (k: string) => c.req.query(k) || ''
    const kind = q('kind') === 'shop' ? 'shop' : 'place'
    const limit = Math.min(+q('limit') || 20, 200), offset = +q('offset') || 0
    const w = ['t.kind=?', q('archived') === '1' ? 't.active=0' : 't.active=1'], a: any[] = [kind]
    if (q('alert') === '1') w.push('t.alert=1')
    if (q('group')) { w.push('t.group_name=?'); a.push(q('group')) }
    if (q('q')) { const cs = SFL[q('sfl')] || SFL.all; w.push('(' + cs.map(x => `${x} LIKE ?`).join(' OR ') + ')'); for (const _ of cs) a.push(`%${q('q')}%`) }
    const rf = q('rank')
    if (rf === 'out') w.push('t.last_rank=0')
    else if (/^\d+-\d+$/.test(rf)) { const [lo, hi] = rf.split('-').map(Number); w.push('t.last_rank BETWEEN ? AND ?'); a.push(lo, hi) }
    const sort = q('sort') || 'custom', dir = q('dir')
    const order = sort === 'custom' || !SST[sort] ? 'COALESCE(t.sort_order, 1e9), t.id DESC'
      : `${SST[sort]} ${dir === 'desc' || (!dir && DESC_FIRST.has(sort)) ? 'DESC' : 'ASC'}, t.id DESC`
    const D = db(c)
    const rows: any[] = (await D.prepare(`SELECT t.* FROM rk_targets t WHERE ${w.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...a, limit, offset).all()).results
    const total = ((await D.prepare(`SELECT COUNT(*) n FROM rk_targets t WHERE ${w.join(' AND ')}`).bind(...a).first()) as any)?.n || 0
    const ids = rows.map(r => r.id)
    const from = addDays(kstDay(), -31)
    // D1 은 한 문장에 값 100개까지 → 90개씩 나눠 읽는다 (100개·200개 보기, 순서 변경)
    const hist: any[] = []
    for (let i = 0; i < ids.length; i += 90) {
      const part = ids.slice(i, i + 90)
      hist.push(...(await D.prepare(`SELECT * FROM rk_history WHERE target_id IN (${part.map(() => '?').join(',')}) AND day >= ? ORDER BY day DESC`).bind(...part, from).all()).results)
    }
    for (const r of rows) r.history = hist.filter(h => h.target_id === r.id)
    const buckets = await D.prepare(`SELECT
      SUM(last_rank BETWEEN 1 AND 3) r1_3, SUM(last_rank BETWEEN 1 AND 5) r1_5, SUM(last_rank BETWEEN 1 AND 10) r1_10, SUM(last_rank BETWEEN 1 AND 20) r1_20,
      SUM(last_rank BETWEEN 6 AND 20) r6_20, SUM(last_rank BETWEEN 21 AND 50) r21_50, SUM(last_rank BETWEEN 51 AND 100) r51_100,
      SUM(last_rank BETWEEN 101 AND 200) r101_200, SUM(last_rank BETWEEN 201 AND 300) r201_300, SUM(last_rank=0) out, SUM(last_rank IS NULL) unk, COUNT(*) n
      FROM rk_targets WHERE kind=? AND active=1`).bind(kind).first()
    const groups = (await D.prepare('SELECT name FROM rk_groups WHERE kind=? ORDER BY name').bind(kind).all()).results.map((r: any) => r.name)
    // 알림 목록: 알림 켠 키워드 전체의 어제 대비 변동 요약
    const alerts = q('alert') === '1' ? (await D.prepare('SELECT id, keyword, name, last_rank, prev_rank, last_checked_at FROM rk_targets WHERE kind=? AND active=1 AND alert=1').bind(kind).all()).results : undefined
    return c.json({ rows, total, buckets, groups, crawl: await crawlMeta(D), alerts })
  } catch (e: any) { return c.json({ error: e.message }, 500) }
})

// 순위 서버 상태: 마지막 수집 상태 + 순위 서버가 마지막으로 연락한 시각(꺼져 있으면 화면에 알림)
async function crawlMeta(D: D1Database) {
  const m: any = {}
  for (const r of (await D.prepare("SELECT k, v, at FROM rk_meta WHERE k IN ('crawl','pc_seen')").all()).results as any[]) m[r.k] = r
  let cr: any = {}; try { cr = JSON.parse(m.crawl?.v || '{}') } catch {}
  const seen = m.pc_seen?.at || null
  const offline = !seen || Date.now() + KST - Date.parse(seen.replace(' ', 'T') + 'Z') > 3 * 60e3
  if (offline) return { ...cr, running: false, block: { blocked: true, reason: `순위 서버(회사 PC)가 꺼져 있어요${seen ? ' · 마지막 연결 ' + seen.slice(5, 16) : ''} — 순위는 마지막으로 받은 것까지 보여요` } }
  return cr
}

// 그룹 관리 팝업: 그룹 · 키워드 수
rank.get('/api/rank/groups', async (c) => {
  const kind = c.req.query('kind') === 'shop' ? 'shop' : 'place', D = db(c)
  const rows = (await D.prepare(`SELECT g.name, (SELECT COUNT(*) FROM rk_targets t WHERE t.kind=g.kind AND t.active=1 AND COALESCE(t.group_name,'기본')=g.name) n
    FROM rk_groups g WHERE g.kind=? ORDER BY g.name='기본' DESC, g.name`).bind(kind).all()).results as any[]
  if (!rows.some(r => r.name === '기본')) rows.unshift({ name: '기본', n: ((await D.prepare("SELECT COUNT(*) n FROM rk_targets WHERE kind=? AND active=1 AND COALESCE(group_name,'기본')='기본'").bind(kind).first()) as any)?.n || 0 })
  return c.json({ rows })
})

rank.get('/api/rank/targets/history', async (c) => {
  const id = +(c.req.query('id') || 0), D = db(c)
  const target = await D.prepare('SELECT * FROM rk_targets WHERE id=?').bind(id).first()
  if (!target) return c.json({ error: '없음' }, 404)
  const history = (await D.prepare('SELECT * FROM rk_history WHERE target_id=? ORDER BY day').bind(id).all()).results
  return c.json({ target, history })
})

rank.get('/api/rank/export.csv', async (c) => {
  const D = db(c), kind = c.req.query('kind') === 'shop' ? 'shop' : 'place', id = +(c.req.query('id') || 0)
  const cell = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  let csv: string, name: string
  if (id) {
    const t: any = await D.prepare('SELECT * FROM rk_targets WHERE id=?').bind(id).first()
    if (!t) return c.json({ error: '없음' }, 404)
    const h = (await D.prepare('SELECT * FROM rk_history WHERE target_id=? ORDER BY day DESC, source').bind(id).all()).results as any[]
    csv = '﻿날짜,출처,순위,' + (t.kind === 'place' ? '업체수,방문자리뷰,블로그리뷰' : '리뷰,찜,구매,별점') + '\n' + h.map(r => [r.day, r.source === 'desk' ? '자체' : 'adlog', r.rank === 0 ? '순위밖' : r.rank ?? '', ...(t.kind === 'place' ? [r.total, r.visitor_reviews, r.blog_reviews] : [r.review_count, r.keep_count, r.purchase_count, r.score])].map(cell).join(',')).join('\n')
    name = `rank-${String(t.keyword).replace(/[^\w가-힣]+/g, '_')}-${kstDay()}.csv`
  } else {
    const rows = (await D.prepare('SELECT * FROM rk_targets WHERE kind=? AND active=1 ORDER BY COALESCE(sort_order,1e9), id DESC').bind(kind).all()).results as any[]
    csv = '﻿번호,그룹,검색키워드,대상ID,업체/상품,월검색량,오늘순위,이전순위,메모,등록일,체크시간\n' + rows.map(r => [r.id, r.group_name, r.keyword, r.ref_id, r.name, r.search_volume, r.last_rank === 0 ? '순위밖' : r.last_rank ?? '', r.prev_rank ?? '', r.memo, String(r.created_at || '').slice(0, 10), r.last_checked_at].map(cell).join(',')).join('\n')
    name = `rank-${kind}-${kstDay()}.csv`
  }
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` } })
})

// 공개 순위 보고서 (로그인 없이 토큰만 — 내부 메모·그룹은 빼고 순위·공개 지표만)
rank.get('/api/rank/share', async (c) => {
  const D = db(c), s: any = await D.prepare('SELECT * FROM rk_shares WHERE token=?').bind(c.req.query('t') || '').first()
  if (!s) return c.json({ error: '보고서를 찾을 수 없어요' }, 404)
  if (s.expires_at < kstDay()) return c.json({ expired: true, client: s.client })
  const ts = (s.target_id
    ? await D.prepare('SELECT id, kind, keyword, name, last_rank, prev_rank, last_checked_at, search_volume FROM rk_targets WHERE id=?').bind(s.target_id).all()
    : await D.prepare('SELECT id, kind, keyword, name, last_rank, prev_rank, last_checked_at, search_volume FROM rk_targets WHERE active=1 AND (client=? OR memo=?) ORDER BY kind, keyword').bind(s.client, s.client).all()).results as any[]
  for (const t of ts) {
    const h = (await D.prepare('SELECT * FROM rk_history WHERE target_id=? ORDER BY day DESC LIMIT 90').bind(t.id).all()).results as any[]
    const byDay = new Map<string, any>(); for (const x of h) if (!byDay.has(x.day) || x.source === 'desk') byDay.set(x.day, x)
    t.history = [...byDay].sort((a, b) => a[0] < b[0] ? -1 : 1).slice(-31).map(([day, x]) => ({ day, rank: x.rank, total: x.total, visit: x.visitor_reviews, blog: x.blog_reviews, review: x.review_count, keep: x.keep_count, buy: x.purchase_count, score: x.score }))
    delete t.id
  }
  return c.json({ client: s.client, expires: s.expires_at, generated: kstStamp(), targets: ts })
})

// ---------- 화면: 쓰기 · 비교분석 → 순위 서버에 맡기고 결과를 기다림 ----------
// 순위 서버가 처리할 수 있는 것만 (주소는 순위 서버 기준, /api/rank/ → /api/)
const FORWARD = new Set(['POST /api/targets', 'POST /api/targets/bulk', 'POST /api/targets/update', 'POST /api/targets/memo', 'POST /api/targets/group', 'POST /api/groups', 'POST /api/groups/rename', 'POST /api/groups/delete',
  'POST /api/targets/order', 'POST /api/targets/delete', 'POST /api/targets/restore', 'POST /api/targets/check', 'GET /api/targets/compare', 'POST /api/share', 'GET /api/chat', 'GET /api/setup-log', 'GET /api/changes'])
const WAIT_MS = 28000
async function forward(c: any) {
  const D = db(c), path = c.req.path.replace(/^\/api\/rank\//, '/api/'), key = `${c.req.method} ${path}`
  if (!FORWARD.has(key)) return c.json({ error: 'not found' }, 404)
  const body = c.req.method === 'POST' ? await c.req.text() : null
  if (body && body.length > 200000) return c.json({ error: '내용이 너무 커요' }, 413)
  const actor = (() => { try { return decodeURIComponent(c.req.header('X-JH-User') || '').slice(0, 30) } catch { return '' } })() || '업무툴'
  const query = new URL(c.req.url).search.slice(1)
  const r = await D.prepare('INSERT INTO rk_commands(method,path,query,body,actor,created_at) VALUES(?,?,?,?,?,?)').bind(c.req.method, path, query, body, actor, kstStamp()).run()
  const id = r.meta.last_row_id
  const until = Date.now() + WAIT_MS
  while (Date.now() < until) {
    await new Promise(res => setTimeout(res, 700))
    const x: any = await D.prepare('SELECT state, status, result FROM rk_commands WHERE id=?').bind(id).first()
    if (x?.state === 'done') return new Response(x.result || '{}', { status: x.status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } })
  }
  // 시간 안에 못 가져갔으면 취소(나중에 엉뚱하게 실행되지 않게). 처리 중이면 끝나는 대로 반영된다
  const ex = await D.prepare("UPDATE rk_commands SET state='expired', done_at=? WHERE id=? AND state='queued'").bind(kstStamp(), id).run()
  if (ex.meta.changes) return c.json({ error: '순위 서버(회사 PC)가 응답하지 않아요 — PC 가 켜져 있는지 확인해 주세요' }, 503)
  return c.json({ error: '아직 처리 중이에요 — 잠시 뒤 새로고침해 주세요' }, 202)
}
// ---------- AI 비서 채팅 (재흥이) — 회사 PC 의 에이전트가 답한다 ----------
// 답이 몇 분 걸릴 수 있어서 맡기기만 하고 번호를 돌려준다 → 화면이 /api/rank/chat/result 로 기다린다
rank.post('/api/rank/chat', async (c) => {
  const D = db(c), body = await c.req.text()
  if (body.length > 20000) return c.json({ error: '메시지가 너무 길어요' }, 413)
  const actor = (() => { try { return decodeURIComponent(c.req.header('X-JH-User') || '').slice(0, 30) } catch { return '' } })() || '업무툴'
  const r = await D.prepare('INSERT INTO rk_commands(method,path,query,body,actor,created_at) VALUES(?,?,?,?,?,?)').bind('POST', '/api/chat', '', body, actor, kstStamp()).run()
  return c.json({ id: r.meta.last_row_id })
})
rank.get('/api/rank/chat/result', async (c) => {
  const x: any = await db(c).prepare("SELECT state, status, result FROM rk_commands WHERE id=? AND path='/api/chat'").bind(+(c.req.query('id') || 0)).first()
  if (!x) return c.json({ error: '없는 요청이에요' }, 404)
  if (x.state === 'expired') return c.json({ state: 'done', status: 503, result: { error: '회사 PC(재흥이)가 응답하지 않아요 — PC 가 켜져 있는지 확인해 주세요' } })
  return c.json({ state: x.state, status: x.status, result: x.result ? JSON.parse(x.result) : null })
})
rank.get('/api/rank/chat', forward)
// 리워드 세팅 — 채팅으로 요청한 세팅 기록 (회사 PC 에 있는 그대로 읽어 온다)
rank.get('/api/rank/setup-log', forward)
// 취소 · 키워드변경 — 목록은 바로, 올리기·확인은 매체 어드민을 보느라 오래 걸릴 수 있어 맡기고 기다린다 (/api/rank/job)
rank.get('/api/rank/changes', forward)
const JOBS = new Set(['POST /api/changes/preview', 'POST /api/changes', 'POST /api/changes/message', 'POST /api/changes/sent', 'POST /api/changes/withdraw', 'POST /api/changes/check'])
rank.post('/api/rank/job', async (c) => {
  const D = db(c), raw = await c.req.text()
  if (raw.length > 200000) return c.json({ error: '내용이 너무 커요' }, 413)
  let j: any = {}; try { j = JSON.parse(raw) } catch { return c.json({ error: '잘못된 요청' }, 400) }
  const path = String(j.path || '')
  if (!JOBS.has(`POST ${path}`)) return c.json({ error: 'not found' }, 404)
  const actor = (() => { try { return decodeURIComponent(c.req.header('X-JH-User') || '').slice(0, 30) } catch { return '' } })() || '업무툴'
  const r = await D.prepare('INSERT INTO rk_commands(method,path,query,body,actor,created_at) VALUES(?,?,?,?,?,?)').bind('POST', path, '', JSON.stringify(j.body || {}), actor, kstStamp()).run()
  return c.json({ id: r.meta.last_row_id })
})
rank.get('/api/rank/job/result', async (c) => {
  const D = db(c), id = +(c.req.query('id') || 0)
  const x: any = await D.prepare('SELECT state, status, result, created_at, path FROM rk_commands WHERE id=?').bind(id).first()
  if (!x || !JOBS.has(`POST ${x.path}`)) return c.json({ error: '없는 요청이에요' }, 404)
  // 30초가 지나도 회사 PC 가 가져가지 않았으면 취소 (PC 가 꺼져 있음) — 나중에 엉뚱하게 실행되지 않게
  if (x.state === 'queued' && Date.now() - Date.parse(String(x.created_at).replace(' ', 'T') + '+09:00') > 30000) {
    const ex = await D.prepare("UPDATE rk_commands SET state='expired', done_at=? WHERE id=? AND state='queued'").bind(kstStamp(), id).run()
    if (ex.meta.changes) x.state = 'expired'
  }
  if (x.state === 'expired') return c.json({ state: 'done', status: 503, result: { error: '회사 PC가 응답하지 않아요 — PC 가 켜져 있는지 확인해 주세요' } })
  return c.json({ state: x.state, status: x.status, result: x.result ? JSON.parse(x.result) : null })
})
rank.post('/api/rank/*', forward)
rank.get('/api/rank/targets/compare', forward)

// ---------- 순위 서버 전용 (비밀키) ----------
rank.use('/api/rank-sync/*', async (c, next) => {
  const want = c.env.RANK_SYNC_TOKEN
  if (!want) return c.json({ error: '연동 비밀키가 설정되지 않았어요' }, 503)
  if (c.req.header('X-Sync-Token') !== want) return c.json({ error: 'forbidden' }, 403)
  await next()
})

const TCOLS = ['id', 'kind', 'keyword', 'ref_id', 'url', 'name', 'group_name', 'memo', 'client', 'contract_start', 'contract_end', 'source', 'active', 'created_by', 'created_at',
  'last_checked_at', 'last_rank', 'prev_rank', 'last_status', 'search_volume', 'rep_keywords', 'hl_color', 'alert', 'sort_order', 'archived_at', 'item_count', 'fail_count']
const HCOLS = ['target_id', 'day', 'source', 'rank', 'depth', 'total', 'visitor_reviews', 'blog_reviews', 'keep_count', 'purchase_count', 'review_count', 'score', 'checked_at']
const upsert = (table: string, cols: string[], key: string[], extra = '') =>
  `INSERT INTO ${table}(${cols.join(',')}${extra ? ',synced_at' : ''}) VALUES(${cols.map(() => '?').join(',')}${extra ? ',?' : ''})
   ON CONFLICT(${key.join(',')}) DO UPDATE SET ${cols.filter(x => !key.includes(x)).map(x => `${x}=excluded.${x}`).join(',')}${extra ? ',synced_at=excluded.synced_at' : ''}`

rank.post('/api/rank-sync/push', async (c) => {
  try {
    const D = db(c), b: any = await c.req.json(), at = kstStamp(), st: D1PreparedStatement[] = []
    const ut = D.prepare(upsert('rk_targets', TCOLS, ['id'], 'synced'))
    for (const t of b.targets || []) st.push(ut.bind(...TCOLS.map(k => t[k] ?? null), at))
    const uh = D.prepare(upsert('rk_history', HCOLS, ['target_id', 'day', 'source']))
    for (const h of b.history || []) st.push(uh.bind(...HCOLS.map(k => h[k] ?? null)))
    if (Array.isArray(b.groups)) { st.push(D.prepare('DELETE FROM rk_groups')); const g = D.prepare('INSERT OR IGNORE INTO rk_groups(kind,name) VALUES(?,?)'); for (const x of b.groups) st.push(g.bind(x.kind, x.name)) }
    if (Array.isArray(b.shares)) { st.push(D.prepare('DELETE FROM rk_shares')); const s = D.prepare('INSERT OR REPLACE INTO rk_shares(token,client,target_id,expires_at,created_at) VALUES(?,?,?,?,?)'); for (const x of b.shares) st.push(s.bind(x.token, x.client ?? null, x.target_id ?? null, x.expires_at, x.created_at ?? null)) }
    if (b.meta) st.push(D.prepare("INSERT OR REPLACE INTO rk_meta(k,v,at) VALUES('crawl',?,?)").bind(JSON.stringify(b.meta), at))
    for (let i = 0; i < st.length; i += 200) await D.batch(st.slice(i, i + 200))
    return c.json({ ok: true, n: st.length })
  } catch (e: any) { return c.json({ error: e.message }, 500) }
})

// 할 일 가져가기 — 90초 넘게 기다린 요청은 버린다(화면은 이미 '응답 없음'으로 끝남)
rank.get('/api/rank-sync/commands', async (c) => {
  const D = db(c), now = kstStamp(), old = kstStamp(new Date(Date.now() - 90e3))
  await D.batch([
    D.prepare("UPDATE rk_meta SET at=? WHERE k='pc_seen' AND at < ?").bind(now, kstStamp(new Date(Date.now() - 30e3))),
    D.prepare("INSERT OR IGNORE INTO rk_meta(k,v,at) VALUES('pc_seen','',?)").bind(now),
    D.prepare("UPDATE rk_commands SET state='expired', done_at=? WHERE state='queued' AND created_at < ?").bind(now, old),
  ])
  const rows = (await D.prepare("UPDATE rk_commands SET state='taken', taken_at=? WHERE state='queued' RETURNING id, method, path, query, body, actor, created_at").bind(now).all()).results
  return c.json({ rows })
})
rank.post('/api/rank-sync/result', async (c) => {
  const b: any = await c.req.json()
  await db(c).prepare("UPDATE rk_commands SET state='done', done_at=?, status=?, result=? WHERE id=?").bind(kstStamp(), +b.status || 200, JSON.stringify(b.body ?? {}), +b.id).run()
  return c.json({ ok: true })
})

// ---------- 공개 순위 보고서 화면 /r/<토큰> ----------
rank.get('/r/:token', (c) => c.html(REPORT_HTML))
const REPORT_HTML = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>순위 보고서</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>body{margin:0;padding:24px 16px;background:#F2F4F6;font-family:'Pretendard Variable',Pretendard,sans-serif;color:#191F28}.wrap{max-width:860px;margin:0 auto}.card{background:#fff;border-radius:16px;padding:24px;box-shadow:0 2px 12px rgba(0,27,55,.06)}
h2{margin:0;font-size:20px}.sub{color:#8B95A1;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{padding:10px 8px;border-bottom:1px solid #E5E8EB;text-align:left;font-size:14px}th{color:#4E5968;font-weight:600}
.rank{font-weight:700}.rank.top{color:#3182F6}.rank.out{color:#8B95A1}.delta{font-size:12px;margin-left:6px}.delta.up{color:#F04452}.delta.down{color:#3182F6}.empty{text-align:center;padding:40px}</style></head>
<body><div class="wrap"><div class="card" id="r"><div class="empty">불러오는 중…</div></div><p class="sub" style="text-align:center">이 링크는 읽기 전용이에요.</p></div>
<script>
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rank=r=>r==null?'-':r===0?'<span class="rank out">순위밖</span>':'<span class="rank '+(r<=10?'top':'')+'">'+r+'위</span>';
const delta=(a,b)=>(a&&b&&a!==b)?'<span class="delta '+(a<b?'up':'down')+'">'+(a<b?'▲':'▼')+Math.abs(a-b)+'</span>':'';
function spark(h){h=h||[];const v=h.map(x=>x.rank).filter(r=>r>0);if(v.length<2)return'-';const mn=Math.min(...v),mx=Math.max(...v);const pts=h.map((x,i)=>x.rank>0?((i/(h.length-1))*120)+','+(4+((x.rank-mn)/((mx-mn)||1))*22):null).filter(Boolean);return'<svg width="120" height="30"><polyline fill="none" stroke="#3182F6" stroke-width="2" points="'+pts.join(' ')+'"/></svg>'}
(async()=>{const t=location.pathname.split('/r/')[1];const r=await fetch('/api/rank/share?t='+encodeURIComponent(t));const d=await r.json().catch(()=>({error:1}));const el=document.getElementById('r');
if(!r.ok||d.error)el.innerHTML='<div class="empty"><b>보고서를 찾을 수 없어요</b></div>';
else if(d.expired)el.innerHTML='<div class="empty"><b>링크가 만료됐어요</b><div class="sub">담당자에게 새 링크를 요청해 주세요</div></div>';
else el.innerHTML='<h2>'+esc(d.client)+' 순위 보고서</h2><div class="sub">'+esc(d.generated)+' 기준 · '+esc(d.expires)+'까지</div><table><thead><tr><th>키워드</th><th>오늘</th><th>최근 흐름</th></tr></thead><tbody>'+d.targets.map(x=>'<tr><td><div>'+esc(x.keyword)+'</div><div class="sub">'+esc(x.name||'')+'</div></td><td style="white-space:nowrap">'+rank(x.last_rank)+delta(x.last_rank,x.prev_rank)+'</td><td>'+spark(x.history)+'</td></tr>').join('')+'</tbody></table>'})();
</script></body></html>`

export default rank
