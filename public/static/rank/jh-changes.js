// 리워드 › 취소 · 키워드변경 — 업무툴 화면 규칙(page-header · stats-grid · hist-tab · table-wrap · badge · modal-overlay · toast)으로 그린다.
// 흐름: 영업이 시트 행을 붙여 넣어 요청 → 쌓임 → 담당자가 하루 한 번 카톡으로 넘기고 '넘김 완료' → 매체 어드민에서 광고가 멈추면 '중단 확인됨'(자동)
// 데이터·처리는 회사 PC(리워드 AI 비서 서버)가 한다: 목록은 /api/rank/changes, 올리기·확인처럼 매체 어드민을 보는 일은 /api/rank/job 에 맡기고 결과를 기다린다.
import { api, esc, copyText } from './jh-rank.js'

const KIND = { cancel: ['취소', 'badge-red'], keyword: ['키워드변경', 'badge-yellow'] }
const STATE = { requested: ['넘길 것', 'badge-blue'], sent: ['넘김 · 확인 중', 'badge-yellow'], done: ['중단 확인됨', 'badge-green'], withdrawn: ['철회', 'badge-gray'] }
const WD = ['일', '월', '화', '수', '목', '금', '토']
const md = (d) => d ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}` : ''
const hm = (s) => String(s || '').slice(11, 16)
const who = (s) => String(s || '').replace(/^jh:/, '')
const addDay = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const sub = (t) => `<span style="font-size:12px;color:var(--text3)">${t}</span>`
const S = { preset: '30d', from: '', to: '', state: '', hk: '', kind: 'cancel', text: '', after: '' }
// 기간 고르기 — 리워드 세팅 화면과 같은 구성 (요청한 날 기준)
const kst = () => new Date(Date.now() + 9 * 3600e3)
const ymd = (d) => d.toISOString().slice(0, 10)
const PRESETS = [['today', '오늘'], ['yday', '어제'], ['7d', '최근 7일'], ['30d', '최근 30일'], ['month', '이번 달'], ['last', '지난 달'], ['90d', '최근 90일']]
function presetRange(p) {
  const t = ymd(kst()), m = t.slice(0, 8)
  if (p === 'today') return [t, t]
  if (p === 'yday') return [addDay(t, -1), addDay(t, -1)]
  if (p === '7d') return [addDay(t, -6), t]
  if (p === 'month') return [m + '01', t]
  if (p === 'last') { const end = addDay(m + '01', -1); return [end.slice(0, 8) + '01', end] }
  if (p === '90d') return [addDay(t, -89), t]
  return [addDay(t, -29), t]
}
const TABS = [['', '전체', 'accent'], ['requested', '넘길 것', 'accent'], ['sent', '넘김 · 확인 중', 'yellow'], ['done', '중단 확인됨', 'green'], ['withdrawn', '철회', 'accent']]

// ---- 업무툴 알림 · 창 (업무툴의 toast / modal-overlay 모양 그대로) ----
function toast(msg, type = 'info') {
  const box = document.getElementById('toastContainer'); if (!box) return alert(msg)
  const el = document.createElement('div'); el.className = `toast ${type}`
  el.innerHTML = `<span>${{ success: '', error: '✕', info: 'ℹ' }[type] || '•'}</span><span>${esc(msg)}</span>`
  box.appendChild(el); setTimeout(() => el.remove(), 3500)
}
function modal(title, html, { wide = false } = {}) {
  let o = document.getElementById('chgModal')
  if (!o) {
    o = document.createElement('div'); o.className = 'modal-overlay'; o.id = 'chgModal'
    o.innerHTML = '<div class="modal"><div class="modal-header"><div class="modal-title"></div><button class="modal-close" type="button">×</button></div><div class="chg-body"></div></div>'
    document.body.appendChild(o)
    o.querySelector('.modal-close').onclick = closeModal
    o.onclick = (e) => { if (e.target === o) closeModal() }
  }
  o.querySelector('.modal').classList.toggle('modal-lg', wide)
  o.querySelector('.modal-title').textContent = title
  o.querySelector('.chg-body').innerHTML = html
  o.classList.add('show')
  return o
}
function closeModal() { document.getElementById('chgModal')?.classList.remove('show') }
function confirmBox(title, msg, { ok = '확인', danger = false } = {}) {
  return new Promise((res) => {
    const o = modal(title, `<p style="margin:0 0 4px;color:var(--text2);line-height:1.6">${msg}</p>
      <div class="flex gap-2 mt-4" style="justify-content:flex-end"><button class="btn btn-ghost" data-no>취소</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${ok}</button></div>`)
    o.querySelector('[data-no]').onclick = () => { closeModal(); res(false) }
    o.querySelector('[data-yes]').onclick = () => { closeModal(); res(true) }
  })
}

// ---- 회사 PC 에 맡기고 결과 기다리기 (매체 어드민 조회는 몇십 초 걸릴 수 있음) ----
async function job(path, body) {
  const { id } = await api('/api/rank/job', { path, body })
  const until = Date.now() + 5 * 60e3
  let wait = 800
  while (Date.now() < until) {
    await new Promise(r => setTimeout(r, wait)); wait = Math.min(wait * 1.3, 2500)
    const x = await api('/api/rank/job/result?id=' + id)
    if (x.state === 'done') { if (x.status >= 400 || x.result?.error) throw new Error(x.result?.error || '처리하지 못했어요'); return x.result }
  }
  throw new Error('회사 PC가 오래 답하지 않아요 — 잠시 뒤 다시 확인해 주세요')
}

// ---- 화면 ----
const root = () => document.getElementById('page-rank-changes')
const codes = (ads) => ads?.length ? ads.map(a => `<div style="font-size:12px;color:var(--text2)">${esc(a.name)} · <strong>ID ${a.id}</strong></div>`).join('') : sub('광고 코드 없음')
const cutTxt = (r) => r.kind === 'cancel' ? (r.cut_day ? `${md(r.cut_day)}까지 구동` : '시작 전 취소') : '→ ' + esc((r.new_keywords || []).join(', '))
const empty = (msg, cols) => `<tr><td colspan="${cols}" style="text-align:center;color:var(--text3);padding:34px">${msg}</td></tr>`

export async function changesPage() {
  const el = root(); if (!el) return
  if (!S.from) [S.from, S.to] = presetRange(S.preset)
  if (!el.querySelector('.page-header')) el.innerHTML = head() + `<div class="card" style="text-align:center;color:var(--text3);padding:40px">불러오는 중…</div>`
  // 고른 기간 시작일까지 + 아직 안 넘긴 요청은 기간과 상관없이 넘겨야 하니 최소 30일은 가져온다
  const today = ymd(kst()), back = Math.min(400, Math.max(30, Math.ceil((Date.parse(today) - Date.parse(S.from)) / 864e5) + 2))
  let j
  try { j = await api('/api/rank/changes?days=' + back) }
  catch (e) { el.innerHTML = head() + `<div class="card" style="text-align:center;padding:40px"><div style="color:var(--red);font-weight:700">목록을 불러오지 못했어요</div><div style="color:var(--text3);margin-top:4px">${esc(e.message)}</div><button class="btn btn-ghost btn-sm mt-4" data-retry>다시 불러오기</button></div>`; el.querySelector('[data-retry]').onclick = changesPage; return }
  const inRange = j.rows.filter(r => r.req_day >= S.from && r.req_day <= S.to && (!S.hk || r.kind === S.hk))
  const cnt = (st) => inRange.filter(r => !st || r.state === st).length
  const allTodo = j.rows.filter(r => r.state === 'requested')   // 카톡으로 넘길 것은 기간과 상관없이 전부
  const outside = allTodo.filter(r => !inRange.includes(r)).length
  const late = allTodo.filter(r => r.late).length
  const pill = (n, c) => `<span style="font-size:11px;background:var(--${c}-dim);color:var(--${c});padding:1px 6px;border-radius:8px;margin-left:4px">${n}</span>`
  const scope = S.from === S.to ? md(S.from) : `${md(S.from)} ~ ${md(S.to)}`
  el.innerHTML = head() + `
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
      <div class="stat-card ${late ? 'red-accent' : 'blue-accent'}" data-go="requested" style="cursor:pointer"><div class="stat-label">넘길 것</div><div class="stat-value ${late ? 'red' : 'blue'}">${allTodo.length}</div><div class="stat-change" style="color:var(--text3)">${late ? `어제 이전 요청 ${late}건 아직 안 넘김` : '담당자가 오늘 카톡으로 넘길 요청 (기간 상관없이 전부)'}</div></div>
      <div class="stat-card yellow-accent" data-go="sent" style="cursor:pointer"><div class="stat-label">넘김 · 중단 확인 중</div><div class="stat-value yellow">${cnt('sent')}</div><div class="stat-change" style="color:var(--text3)">${scope} 요청 · 어드민에서 광고가 멈추면 자동 확인</div></div>
      <div class="stat-card green-accent" data-go="done" style="cursor:pointer"><div class="stat-label">중단 확인됨</div><div class="stat-value green">${cnt('done')}</div><div class="stat-change" style="color:var(--text3)">${scope} 요청</div></div>
    </div>
    ${requestCard(j)}
    <div class="card" style="padding:14px 20px"><div class="flex gap-2 items-center" style="flex-wrap:wrap">
      <div class="flex gap-2" style="flex-wrap:wrap">${PRESETS.map(([k, l]) => `<button type="button" class="btn btn-sm${S.preset === k ? ' hist-filter-mode-active' : ' btn-ghost'}" data-preset="${k}" style="border-radius:99px;padding:6px 13px;font-size:12.5px">${l}</button>`).join('')}</div>
      <div class="flex gap-2 items-center"><input type="date" id="chgFrom" value="${S.from}" max="${S.to}" style="width:150px"><span style="color:var(--text3)">~</span><input type="date" id="chgTo" value="${S.to}" min="${S.from}" max="${today}" style="width:150px"></div>
      <select id="chgKindF" style="width:150px"><option value="">취소 + 키워드변경</option><option value="cancel" ${S.hk === 'cancel' ? 'selected' : ''}>취소만</option><option value="keyword" ${S.hk === 'keyword' ? 'selected' : ''}>키워드변경만</option></select>
      <div style="flex:1"></div>
      <span style="font-size:12.5px;color:var(--text3)">${scope} · 취소 <strong style="color:var(--text)">${inRange.filter(r => r.kind === 'cancel' && r.state !== 'withdrawn').length}</strong> · 키워드변경 <strong style="color:var(--text)">${inRange.filter(r => r.kind === 'keyword' && r.state !== 'withdrawn').length}</strong></span>
    </div></div>
    <div style="display:flex;gap:0;margin:4px 0 16px;border-bottom:2px solid var(--border);overflow-x:auto">
      ${TABS.map(([k, l, c]) => `<button class="hist-tab${S.state === k ? ' hist-tab-active' : ''}" data-tab="${k}">${l}${cnt(k) ? pill(cnt(k), c) : ''}</button>`).join('')}
    </div>
    ${allTodo.length && (S.state === '' || S.state === 'requested') ? `<div class="card" style="padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="font-size:13px;color:var(--text2)">담당자: 아직 안 넘긴 요청 <strong>${allTodo.length}건</strong>을 카톡 방으로 넘긴 뒤 <strong>넘김 완료</strong>를 눌러 주세요.${outside ? ` <span style="color:var(--yellow)">(고른 기간 밖 ${outside}건 포함)</span>` : ''}</div>
      <div class="flex gap-2"><button class="btn btn-primary btn-sm" id="chgCopy">카톡 메시지 복사 (${allTodo.length}건)</button><button class="btn btn-ghost btn-sm" id="chgSent">넘김 완료</button></div></div>` : ''}
    ${S.state === 'sent' && cnt('sent') ? `<div class="flex" style="justify-content:flex-end;margin-bottom:12px"><button class="btn btn-ghost btn-sm" id="chgCheck">어드민에서 지금 확인</button></div>` : ''}
    ${dayGroups(j, inRange.filter(r => !S.state || r.state === S.state), scope)}`
  bind(el, j, allTodo)
}

function head() {
  return `<div class="page-header"><div><div class="page-title">취소 · 키워드변경</div><div class="page-sub">요청을 올리면 쌓이고, 담당자가 하루 한 번 카톡으로 넘겨요. 요청한 날은 돌고 끝나요 (당일 구동 후 환불).</div></div>
    <button class="btn btn-primary" type="button" onclick="showPage('rank-chat')" title="시트 행을 붙여 넣고 '취소해줘'·'키워드 변경해줘'라고 말해도 돼요">재흥이에게 요청</button></div>`
}

function requestCard(j) {
  const seg = (k, l, first) => `<button type="button" class="btn btn-sm${S.kind === k ? ' hist-filter-mode-active' : ''}" data-kind="${k}" style="border-radius:0;border:none;background:var(--surface);color:var(--text2);${first ? '' : 'border-left:1px solid var(--border2);'}padding:7px 16px;font-size:12.5px">${l}</button>`
  return `<div class="card">
    <div class="flex items-center" style="justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px">
      <div><div style="font-size:15px;font-weight:700">요청 올리기</div><div style="font-size:12.5px;color:var(--text3);margin-top:2px">대행사 시트에서 캠페인 행을 시작일부터 통째로 복사해 붙여 넣으세요. 여러 줄도 한 번에 돼요.</div></div>
      <div style="display:flex;border:1px solid var(--border2);border-radius:8px;overflow:hidden">${seg('cancel', '취소', true)}${seg('keyword', '키워드변경')}</div>
    </div>
    <textarea id="chgText" rows="4" placeholder="10-07&#9;10-13&#9;검단내과, 검단속편한내과 …&#9;https://m.place.naver.com/…&#9;업체명&#9;50&#9;7&#9;350" style="font-family:inherit;resize:vertical">${esc(S.text)}</textarea>
    <div class="flex gap-2 items-center mt-2" style="flex-wrap:wrap">
      <input id="chgAfter" placeholder="바뀐 검색어 (쉼표로 구분)" value="${esc(S.after)}" style="flex:1;min-width:220px;${S.kind === 'keyword' ? '' : 'display:none'}">
      <div style="flex:1"></div>
      ${j.media ? '' : `<span style="font-size:12px;color:var(--yellow)">매체 어드민 연결 전이라 광고 코드는 빠져요</span>`}
      <button class="btn btn-primary" id="chgPreview" type="button">확인하기</button>
    </div>
    <div id="chgPrev"></div>
  </div>`
}

// 요청한 날별로 묶어서: 날짜 머리(그날 건수 · 그날 카톡 메시지) + 표
function dayGroups(j, rows, scope) {
  if (!rows.length) return `<div class="table-wrap"><table><tbody>${empty(`${scope}에 ${S.state ? `'${TABS.find(t => t[0] === S.state)[1]}' ` : ''}요청이 없어요`, 1)}</tbody></table></div>`
  const days = new Map(); for (const r of rows) { if (!days.has(r.req_day)) days.set(r.req_day, []); days.get(r.req_day).push(r) }
  return [...days.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([day, rs]) => {
    rs = rs.slice().sort((a, b) => String(b.requested_at).localeCompare(String(a.requested_at)))
    const ok = rs.filter(r => r.state !== 'withdrawn'), n = (k) => ok.filter(r => r.kind === k).length
    const label = `${md(day)} (${WD[new Date(day + 'T00:00:00Z').getUTCDay()]})${day === j.today ? ' · 오늘' : ''}`
    return `<div class="table-wrap" style="margin-bottom:14px">
      <div class="flex items-center" style="justify-content:space-between;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border);flex-wrap:wrap">
        <div><strong style="font-size:14.5px">${label}</strong> <span style="font-size:12.5px;color:var(--text3);margin-left:6px">${rs.length}건 — 취소 ${n('cancel')} · 키워드변경 ${n('keyword')}${rs.length > ok.length ? ` · 철회 ${rs.length - ok.length}` : ''}</span></div>
        ${ok.length ? `<button class="btn btn-ghost btn-sm" data-hmsg="${ok.slice().reverse().map(r => r.id).join(',')}" data-label="${esc(label)}">그날 카톡 메시지</button>` : ''}
      </div>
      <div style="overflow-x:auto"><table style="table-layout:fixed;min-width:900px"><colgroup><col style="width:110px"><col><col style="width:140px"><col style="width:26%"><col style="width:190px"><col style="width:76px"></colgroup>
      <thead><tr><th>종류</th><th>캠페인</th><th>기간 · 마감</th><th>광고 코드</th><th>상태 · 요청</th><th></th></tr></thead><tbody>
      ${rs.map(r => `<tr${r.state === 'withdrawn' ? ' style="opacity:.5"' : ''}>
        <td style="white-space:nowrap"><span class="badge ${KIND[r.kind][1]}">${KIND[r.kind][0]}</span>${r.late ? '<div style="margin-top:4px"><span class="badge badge-red">미전달</span></div>' : ''}</td>
        <td><strong>${esc(r.name || r.keywords[0] || '')}</strong><br>${sub(esc(r.keywords.slice(0, 3).join(', ')) + (r.keywords.length > 3 ? ` 외 ${r.keywords.length - 3}` : ''))}${r.kind === 'keyword' ? '<br>' + sub('→ ' + esc((r.new_keywords || []).join(', '))) : ''}</td>
        <td style="font-variant-numeric:tabular-nums">${md(r.start_day)} ~ ${md(r.end_day)}<br>${sub(r.kind === 'cancel' ? (r.cut_day ? `${md(r.cut_day)}까지 구동` : '시작 전 취소') : '')}</td>
        <td>${codes(r.ads)}</td>
        <td><span class="badge ${STATE[r.state][1]}">${STATE[r.state][0]}</span><br>${sub(`${esc(who(r.requested_by))} ${hm(r.requested_at)}${r.source === 'sheet' ? ' · 시트 변경 감지' : ''}${r.sent_at ? ` · 넘김 ${md(r.sent_at.slice(0, 10))}` : ''}${r.done_at ? ` · 확인 ${md(r.done_at.slice(0, 10))}` : ''}`)}</td>
        <td>${r.state === 'requested' ? `<button class="btn btn-ghost btn-sm" data-wd="${r.id}">철회</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></div>`
  }).join('')
}

function bind(el, j, allTodo) {
  const q = (s) => el.querySelector(s)
  el.querySelectorAll('[data-tab],[data-go]').forEach(b => b.onclick = () => { S.state = b.dataset.tab ?? b.dataset.go; changesPage() })
  el.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => { S.preset = b.dataset.preset; [S.from, S.to] = presetRange(S.preset); changesPage() })
  const range = () => { const f = q('#chgFrom').value, t = q('#chgTo').value; if (!f || !t) return; S.preset = ''; [S.from, S.to] = f <= t ? [f, t] : [t, f]; changesPage() }
  q('#chgFrom').onchange = range; q('#chgTo').onchange = range
  q('#chgKindF').onchange = (e) => { S.hk = e.target.value; changesPage() }
  el.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { S.kind = b.dataset.kind; S.text = q('#chgText').value; S.after = q('#chgAfter').value
    el.querySelectorAll('[data-kind]').forEach(x => x.classList.toggle('hist-filter-mode-active', x === b)); q('#chgAfter').style.display = S.kind === 'keyword' ? '' : 'none'; q('#chgPrev').innerHTML = '' })
  q('#chgText').oninput = (e) => { S.text = e.target.value }
  q('#chgAfter').oninput = (e) => { S.after = e.target.value }
  q('#chgPreview').onclick = preview
  el.querySelectorAll('[data-hmsg]').forEach(b => b.onclick = async () => {
    b.disabled = true
    try { const r = await job('/api/changes/message', { ids: b.dataset.hmsg.split(',').map(Number) }); messageModal(`${b.dataset.label} 카톡 메시지`, '그날 올라온 요청을 카톡 방 형식으로 다시 만든 거예요 (철회한 요청 제외).', r.text) }
    catch (e) { toast(e.message, 'error') } finally { b.disabled = false }
  })
  q('#chgCopy')?.addEventListener('click', async (e) => {
    e.target.disabled = true
    try { const r = await job('/api/changes/message', { ids: allTodo.map(x => x.id) }); await copyText(r.text); toast('복사했어요 — 카톡으로 넘긴 뒤 넘김 완료를 눌러 주세요', 'success'); q('#chgSent').className = 'btn btn-primary btn-sm' }
    catch (err) { toast(err.message, 'error') } finally { e.target.disabled = false }
  })
  q('#chgSent')?.addEventListener('click', async () => {
    if (!await confirmBox('넘김 완료', `아직 안 넘긴 요청 ${allTodo.length}건을 카톡으로 넘겼나요? 넘김 완료로 표시해요.`, { ok: '넘김 완료' })) return
    try { await job('/api/changes/sent', { ids: allTodo.map(x => x.id) }); toast('넘김 완료로 표시했어요', 'success'); changesPage() } catch (e) { toast(e.message, 'error') }
  })
  q('#chgCheck')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = '어드민 확인 중…'
    try { const r = await job('/api/changes/check', {}); toast(`확인 ${r.checked}건 · 새로 중단 확인 ${r.done}건`, 'success'); changesPage() } catch (err) { toast(err.message, 'error'); e.target.disabled = false; e.target.textContent = '어드민에서 지금 확인' }
  })
  el.querySelectorAll('[data-wd]').forEach(b => b.onclick = async () => {
    if (!await confirmBox('요청 철회', '이 요청을 철회할까요? 넘기기 전이라 카톡 메시지에서 빠져요.', { ok: '철회', danger: true })) return
    try { await job('/api/changes/withdraw', { id: +b.dataset.wd }); toast('철회했어요', 'success'); changesPage() } catch (e) { toast(e.message, 'error') }
  })
}

function messageModal(title, note, text) {
  const o = modal(title, `<p style="margin:0 0 10px;font-size:13px;color:var(--text3)">${note}</p><textarea readonly rows="14" style="font-family:inherit;font-size:13px;line-height:1.6">${esc(text)}</textarea>
    <div class="flex gap-2 mt-4" style="justify-content:flex-end"><button class="btn btn-ghost" data-close-m>닫기</button><button class="btn btn-primary" data-copy>복사</button></div>`, { wide: true })
  o.querySelector('[data-close-m]').onclick = closeModal
  o.querySelector('[data-copy]').onclick = async () => { await copyText(text); toast('복사했어요', 'success') }
}

async function preview() {
  const el = root(), q = (s) => el.querySelector(s)
  const text = q('#chgText').value, after = q('#chgAfter').value, kind = S.kind
  if (!text.trim()) return toast('캠페인 행을 붙여 넣어 주세요', 'error')
  if (kind === 'keyword' && !after.trim()) return toast('바뀐 검색어를 적어 주세요', 'error')
  const b = q('#chgPreview'); b.disabled = true; b.textContent = '광고 코드 찾는 중…'
  q('#chgPrev').innerHTML = `<div style="margin-top:14px;padding:18px;text-align:center;color:var(--text3);background:var(--surface2);border-radius:var(--radius-sm)">회사 PC가 매체 어드민에서 광고 코드를 찾고 있어요…</div>`
  try {
    const p = await job('/api/changes/preview', { text, kind, after })
    const ok = p.rows.filter(r => !r.error)
    q('#chgPrev').innerHTML = `<div class="table-wrap" style="margin:14px 0 0;box-shadow:none"><table><thead><tr><th>캠페인</th><th style="width:200px">${kind === 'cancel' ? '마감' : '처리'}</th><th>광고 코드</th></tr></thead><tbody>
      ${p.rows.map(r => `<tr><td><strong>${esc(r.name || r.keywords[0] || '')}</strong><br>${sub(`${md(r.start_day)}~${md(r.end_day)} · 하루 ${r.daily ?? '?'}타`)}</td>
        <td>${r.error ? `<span style="color:var(--red);font-size:12.5px">${esc(r.error)}</span>` : kind === 'cancel' ? (r.cut ? `<strong>${md(r.cut)}</strong>까지 돌고 끝` : '시작 전 전체 취소') : '키워드변경 → ' + esc(after)}</td>
        <td>${r.error ? '' : codes(r.ads)}${r.note ? '<br>' + sub(esc(r.note)) : ''}</td></tr>`).join('')}
    </tbody></table></div>
    ${ok.length ? `<div class="flex gap-2 mt-4" style="justify-content:flex-end"><button class="btn btn-ghost" id="chgClear">지우기</button><button class="btn btn-primary" id="chgSubmit">${KIND[kind][0]} 요청 올리기 (${ok.length}건)</button></div>` : ''}`
    q('#chgClear')?.addEventListener('click', () => { S.text = S.after = ''; changesPage() })
    q('#chgSubmit')?.addEventListener('click', async (e) => {
      e.target.disabled = true; e.target.textContent = '올리는 중…'
      try {
        const r = await job('/api/changes', { text, kind, after })
        const n = r.results.filter(x => x.ok && !x.dup).length, d = r.results.filter(x => x.dup).length, bad = r.results.filter(x => !x.ok)
        toast(`${n}건 올렸어요${d ? ` · 이미 있던 ${d}건 제외` : ''}${bad.length ? ` · 실패 ${bad.length}건` : ''}`, bad.length ? 'error' : 'success')
        S.text = S.after = ''; S.state = 'requested'; if (S.to < ymd(kst())) { S.preset = '30d'; [S.from, S.to] = presetRange('30d') }; changesPage()
      } catch (err) { toast(err.message, 'error'); e.target.disabled = false; e.target.textContent = `${KIND[kind][0]} 요청 올리기 (${ok.length}건)` }
    })
  } catch (e) { q('#chgPrev').innerHTML = `<div class="alert alert-error" style="margin-top:14px">${esc(e.message)}</div>` }
  b.disabled = false; b.textContent = '확인하기'
}

window.jhChanges = changesPage
