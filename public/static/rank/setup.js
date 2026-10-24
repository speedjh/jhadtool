// 자동 생성 — ai-desk/public/setup.js 에서 (직접 고치지 말 것)
// 리워드 세팅 — 채팅으로 요청한 세팅이 어디까지 됐는지 (세팅 기록). 업무툴(jhadtool)의 '리워드 세팅' 메뉴도 이 화면을 그대로 쓴다.
//  기간(요청한 날) · 상태로 거르고, 날짜별로 묶어 보여 준다. 줄·[발주시트 이동] → 대행사 발주시트의 그 행,
//  [세팅시트 이동] → 세팅 시트 'ai비서 리워드' 탭의 그 블록(범위 선택). 세팅 중인 건이 있으면 몇 초마다 저절로 새로 고친다.
let D   // { api, esc, toast, modal, mascot, openChat? }
export function initSetup(deps) { D = deps }

const WD = ['일', '월', '화', '수', '목', '금', '토']
const S = { preset: '7d', from: '', to: '', state: '', q: '' }
const kst = () => new Date(Date.now() + 9 * 3600e3)
const ymd = (d) => d.toISOString().slice(0, 10)
const shift = (day, n) => { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return ymd(d) }
const PRESETS = [['today', '오늘'], ['yday', '어제'], ['7d', '최근 7일'], ['month', '이번 달'], ['last', '지난 달'], ['90d', '최근 90일']]
function presetRange(p) {
  const t = ymd(kst()), m = t.slice(0, 8)
  if (p === 'today') return [t, t]
  if (p === 'yday') return [shift(t, -1), shift(t, -1)]
  if (p === 'month') return [m + '01', t]
  if (p === 'last') { const end = shift(m + '01', -1); return [end.slice(0, 8) + '01', end] }
  if (p === '90d') return [shift(t, -89), t]
  return [shift(t, -6), t]
}
const TABS = [['', '전체'], ['live', '세팅 중'], ['hold', '확인 필요'], ['done', '완료'], ['fail', '못 함'], ['cancel', '안 함']]
const BADGE = { wait: 'blue', working: 'blue', hold: 'yellow', done: 'green', stopped: 'red', fail: 'red', cancel: '' }
const inTab = (r, tab) => !tab || (tab === 'live' ? ['wait', 'working'].includes(r.status.code) : tab === 'done' ? ['done', 'stopped'].includes(r.status.code) : r.status.code === tab)
const md = (d) => d ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}` : ''
const dayTitle = (d) => `${+d.slice(5, 7)}월 ${+d.slice(8, 10)}일 (${WD[new Date(d + 'T12:00:00Z').getUTCDay()]})`
const hm = (at) => String(at || '').slice(11, 16)
const kind = (k) => k === 'shop' ? '쇼핑' : '플레이스'
// 세팅 시트에서 이 건이 차지한 행 — 블록(5행)마다 시작 행이 저장돼 있다
const settingRange = (r) => { const s = r.sheet_rows || []; return s.length ? `${Math.min(...s)}~${Math.max(...s) + 4}행` : '' }
// 검색어 검증 (프리리워드와 같은 기준: 네이버 앱에서 구좌가 뜨고 10위 안) — 검색어마다 결과, 옛 기록은 통과 수만 있다
const kwVerdict = (r) => {
  const n = r.kw_n || 0, c = r.kw_checks
  if (!n) return null
  if (c?.length) { const ok = c.filter(x => x.ok).length, err = c.filter(x => !x.ok && x.error).length; return { ok, n: c.length, err, bad: c.length - ok - err } }
  return r.kw_ok == null ? { none: true, n } : { ok: r.kw_ok, n, err: 0, bad: n - r.kw_ok }
}
const verdictBadge = (v) => !v ? '' : v.none ? '<span class="badge">검증 기록 없음</span>' : v.ok === v.n ? '<span class="badge green">✓ 검증 완료</span>'
  : `<span class="badge ${v.bad ? 'red' : 'yellow'}">검증 ${v.ok}/${v.n}${v.bad ? ` · ${v.bad}개 기준 미달` : ''}${v.err ? ` · ${v.err}개 확인 못 함` : ''}</span>`
const checkLabel = (x) => x.ok ? (/단독/.test(x.reason || '') ? '단독 노출' : x.rank ? x.rank + '위' : '통과') : x.error ? '확인 못 함' : /구좌 없음|결과 없음/.test(x.reason || '') ? '구좌 없음' : x.rank ? x.rank + '위' : '10위 밖'

let timer = null
export async function setupPage(root) {
  clearTimeout(timer)
  if (!S.from) [S.from, S.to] = presetRange(S.preset)
  const { esc, mascot } = D
  if (!root.querySelector('.su-page')) root.innerHTML = `<div class="su-page"><div class="empty" style="padding:60px 0">${mascot('think', 56)}<div>세팅 기록을 불러오는 중…</div></div></div>`
  let j
  try { j = await D.api(`/api/rank/setup-log?from=${S.from}&to=${S.to}${S.q ? '&q=' + encodeURIComponent(S.q) : ''}`) }
  catch (e) { root.innerHTML = `<div class="su-page"><div class="empty" style="padding:60px 0">${mascot('warn', 56)}<div>세팅 기록을 불러오지 못했어요</div><div class="sub">${esc(e.message)}</div><button class="btn btn-ghost" data-retry style="margin-top:8px">다시 불러오기</button></div></div>`; root.querySelector('[data-retry]').onclick = () => setupPage(root); return }
  const all = j.rows, rows = all.filter(r => inTab(r, S.state))
  const cnt = (tab) => all.filter(r => inTab(r, tab)).length
  const days = [...new Set(rows.map(r => r.day))]
  const kwTxt = (r) => { const v = kwVerdict(r); return !v ? '-' : v.none ? `${v.n}개` : v.ok === v.n ? `${v.n}개 <span class="su-ok">✓ 검증 완료</span>` : `${v.ok}/${v.n} 통과` }
  const go = (url, label, sub) => url ? `<a class="su-go" href="${esc(url)}" target="_blank" rel="noopener" data-stop>${label} ↗</a>${sub ? `<div class="sub">${sub}</div>` : ''}` : '<span class="sub">-</span>'
  const orderCell = (r) => go(r.order_url, '발주시트 이동', r.order_row ? `${esc(r.order_tab || '')} ${r.order_row}행` : '')
  const settingCell = (r) => go(r.setting_url, '세팅시트 이동', settingRange(r))
  const status = (r) => `<span class="badge ${BADGE[r.status.code] || ''}">${r.status.code === 'working' ? '<i class="su-dot"></i>' : ''}${esc(r.status.label)}</span>${r.status.sub ? `<div class="sub su-sub" title="${esc(r.status.sub)}">${esc(r.status.sub)}</div>` : ''}`
  const row = (r) => `<tr class="click" data-id="${r.id}" title="${r.order_url ? '대행사 발주시트의 이 행으로 가기' : ''}">
      <td class="num su-time">${hm(r.at)}<div class="sub">${esc(r.req_by || '')}</div></td>
      <td><div class="kw">${esc(r.name || '')}</div><div class="sub">${esc(r.agency || '')}${r.order_tab ? ' · ' + esc(r.order_tab) : ''}</div></td>
      <td>${esc(r.product || '')} <span class="sub">${kind(r.kind)}</span><div class="sub num">${md(r.start_day)} ~ ${md(r.end_day)}</div></td>
      <td class="num">${r.daily ?? '-'}<span class="sub"> / ${r.total ?? '-'}</span></td>
      <td>${kwTxt(r)}${r.answer ? `<div class="sub">정답 ${esc(r.answer)}</div>` : ''}</td>
      <td class="su-st">${status(r)}</td>
      <td class="su-sheet">${orderCell(r)}</td>
      <td class="su-sheet">${settingCell(r)}</td>
      <td style="text-align:right"><button class="btn btn-sm btn-ghost" data-detail="${r.id}" data-stop>자세히</button></td></tr>`
  const sum = (list) => { const n = (c) => list.filter(r => inTab(r, c)).length; return [['done', '완료'], ['live', '세팅 중'], ['hold', '확인 필요'], ['fail', '못 함']].filter(([c]) => n(c)).map(([c, l]) => `${l} ${n(c)}`).join(' · ') }
  root.innerHTML = `<div class="su-page">
    <div class="page-header"><div><h2>리워드 세팅</h2><p>재흥이에게 채팅으로 요청한 세팅이 어디까지 됐는지 보여 줘요. 줄을 누르면 대행사 발주시트의 그 행으로, [세팅시트 이동]을 누르면 세팅 시트의 그 블록으로 바로 가요.</p></div>
      <div class="actions"><a class="btn btn-ghost" href="${esc(j.sheet)}" target="_blank" rel="noopener">세팅 시트 열기 ↗</a>${D.openChat ? '<button class="btn btn-primary" data-chat>재흥이에게 세팅 요청</button>' : ''}</div></div>
    <div class="card su-bar">
      <div class="su-presets">${PRESETS.map(([k, l]) => `<button class="${S.preset === k ? 'on' : ''}" data-preset="${k}">${l}</button>`).join('')}</div>
      <div class="su-range"><input type="date" id="suFrom" value="${S.from}" max="${S.to}"><span>~</span><input type="date" id="suTo" value="${S.to}" min="${S.from}"></div>
      <input id="suQ" class="su-q" placeholder="업체·대행사·요청자 찾기" value="${esc(S.q)}">
    </div>
    <div class="tabs su-tabs">${TABS.map(([k, l]) => `<button class="${S.state === k ? 'on' : ''}" data-tab="${k}">${l} <b class="num">${cnt(k)}</b></button>`).join('')}</div>
    ${rows.length ? days.map(d => { const list = rows.filter(r => r.day === d); return `<div class="card su-day"><div class="card-h">${dayTitle(d)}<span class="sub">${list.length}건${sum(list) ? ' — ' + sum(list) : ''}</span></div>
      <div class="table-wrap su-wrap"><table class="tbl su-tbl"><thead><tr><th>시각</th><th>업체</th><th>상품 · 기간</th><th>하루 / 총</th><th>검색어</th><th>상태</th><th>발주시트</th><th>세팅시트</th><th></th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div></div>` }).join('')
    : `<div class="card"><div class="empty">${mascot('idle', 52)}<div>${all.length ? '이 상태의 세팅이 없어요' : `${md(S.from)} ~ ${md(S.to)}에 요청한 세팅이 없어요`}</div><div class="sub">채팅에서 대행사 시트 링크와 함께 "세팅해줘"라고 하면 여기에 기록돼요.</div></div></div>`}
    ${j.live ? '<p class="sub su-live"><i class="su-dot"></i> 세팅 중인 건이 있어서 5초마다 새로 고치고 있어요.</p>' : ''}
  </div>`
  const reload = () => setupPage(root)
  root.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => { S.preset = b.dataset.preset; [S.from, S.to] = presetRange(S.preset); reload() })
  const range = () => { const f = root.querySelector('#suFrom').value, t = root.querySelector('#suTo').value; if (!f || !t) return; S.preset = ''; S.from = f <= t ? f : t; S.to = f <= t ? t : f; reload() }
  root.querySelector('#suFrom').onchange = range; root.querySelector('#suTo').onchange = range
  const qi = root.querySelector('#suQ'); qi.onkeydown = (e) => { if (e.key === 'Enter' && !e.isComposing) { S.q = qi.value.trim(); reload() } }; qi.onchange = () => { if (qi.value.trim() !== S.q) { S.q = qi.value.trim(); reload() } }
  root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { S.state = b.dataset.tab; reload() })
  root.querySelector('[data-chat]')?.addEventListener('click', () => D.openChat())
  root.querySelectorAll('[data-stop]').forEach(x => x.addEventListener('click', (e) => e.stopPropagation()))
  root.querySelectorAll('[data-detail]').forEach(b => b.onclick = () => detail(all.find(r => r.id === +b.dataset.detail)))
  root.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => { const r = all.find(x => x.id === +tr.dataset.id); const u = r?.order_url || r?.setting_url; if (u) window.open(u, '_blank', 'noopener'); else detail(r) })
  if (j.live) timer = setTimeout(() => { if (root.isConnected && root.offsetParent !== null && root.querySelector('.su-page')) setupPage(root) }, 5000)
}

function detail(r) {
  if (!r) return
  const { esc } = D
  const kv = (k, v) => v ? `<div><span>${k}</span><b>${v}</b></div>` : ''
  const set = sheetTable(r)
  D.modal(`<div class="su-detail"><h3 style="margin:0 0 4px">${esc(r.name || '')}</h3><p class="sub" style="margin:0 0 14px">${esc(r.agency || '')}${r.order_tab ? ' · ' + esc(r.order_tab) + ' 탭' : ''}${r.order_row ? ' ' + r.order_row + '행' : ''}</p>
    <div class="su-state"><span class="badge ${BADGE[r.status.code] || ''}">${esc(r.status.label)}</span>${r.status.sub ? ` <span class="sub">${esc(r.status.sub)}</span>` : ''}</div>
    <div class="su-kv">${kv('요청', `${md(r.day)} ${hm(r.at)} · ${esc(r.req_by || '-')}`)}${kv(r.status.code === 'done' || r.status.code === 'stopped' ? '세팅 끝남' : '마지막 소식', `${md((r.done_at || r.updated_at || '').slice(0, 10))} ${hm(r.done_at || r.updated_at)}`)}
      ${kv('상품', `${esc(r.product || '')} · ${kind(r.kind)}`)}${kv('기간', `${esc(r.start_day || '')} ~ ${esc(r.end_day || '')}`)}${kv('유입', `하루 ${r.daily ?? '-'}타 · 총 ${r.total ?? '-'}타`)}
      ${kv('메인키워드', esc(r.main_keyword || ''))}${kv('정답', esc(r.answer || ''))}${kv('세팅 시트', settingRange(r))}${kv('순위체크', r.rank_id ? '등록됨' : '')}${kv('진행 사유', esc(r.reason || ''))}</div>
    ${kwBlock(r)}
    ${set}
    <div class="row su-links">${r.order_url ? `<a class="btn btn-primary" href="${esc(r.order_url)}" target="_blank" rel="noopener">발주시트 이동 ↗</a>` : ''}${r.setting_url ? `<a class="btn btn-ghost" href="${esc(r.setting_url)}" target="_blank" rel="noopener">세팅시트 이동 ↗</a>` : ''}</div></div>`)
}

// 검색어 — 검색어마다 검증 결과 (순위·통과 못 한 이유)
function kwBlock(r) {
  const { esc } = D
  if (!r.keywords?.length) return ''
  const v = kwVerdict(r), by = new Map((r.kw_checks || []).map(x => [x.keyword, x]))
  const chip = (k) => { const x = by.get(k); if (!x) return `<span class="chip${v && !v.none && v.ok === v.n ? ' green' : ''}">${esc(k)}</span>`
    return `<span class="chip ${x.ok ? 'green' : x.error ? 'yellow' : 'red'}" title="${esc(x.reason || '')}">${x.ok ? '✓ ' : ''}${esc(k)} · ${esc(checkLabel(x))}</span>` }
  return `<div class="su-h">검색어 ${r.keywords.length}개 ${verdictBadge(v)}</div><div class="chips">${r.keywords.map(chip).join('')}</div>`
}

// 세팅표 — 시트처럼: 시트 행 번호, 검색어가 있는 행만, 같은 값이 이어지는 칸(앱·시작·종료·정답·업체명·일유입)은 하나로 묶음
function sheetTable(r) {
  const { esc } = D
  const rows = (r.rows || []).filter(x => String(x[8] || '').trim())
  if (!rows.length) return ''
  const COLS = [[1, '앱', 1], [2, '시작', 1], [3, '종료', 1], [8, '검색어', 0], [10, '정답', 1], [12, '업체명', 1], [13, '일유입', 1]]
  const start = r.sheet_rows?.[0], by = new Map((r.kw_checks || []).map(x => [x.keyword, x]))
  const span = (c, i) => { if (i && rows[i - 1][c] === rows[i][c]) return 0; let n = 1; while (i + n < rows.length && rows[i + n][c] === rows[i][c]) n++; return n }
  const body = rows.map((x, i) => {
    const kw = by.get(x[8])
    return `<tr>${start ? `<th class="su-rn">${start + i}</th>` : ''}${COLS.map(([c, , merge]) => {
      const n = merge ? span(c, i) : 1; if (!n) return ''
      const num = [2, 3, 13].includes(c) ? ' num' : ''
      if (c === 8) return `<td>${esc(x[8])}${kw ? ` <span class="su-kwv ${kw.ok ? 'ok' : kw.error ? 'warn' : 'bad'}">${kw.ok ? '✓ ' : ''}${esc(checkLabel(kw))}</span>` : ''}</td>`
      return `<td class="su-m${num}"${n > 1 ? ` rowspan="${n}"` : ''}>${esc(x[c])}</td>`
    }).join('')}</tr>`
  }).join('')
  return `<div class="su-h">세팅표 · 검색어 ${rows.length}줄${start ? ` <span class="sub">(세팅 시트 ${start}~${start + rows.length - 1}행)</span>` : ''}</div>
    <div class="table-wrap su-sheetwrap"><table class="su-sheet-tbl"><thead><tr>${start ? '<th class="su-rn"></th>' : ''}${COLS.map(([, h]) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`
}
