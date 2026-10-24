// 리워드 › 플레이스 순위 체크 · N 가격비교 순위 체크 · 리워드 세팅(세팅 기록)
// 순위 화면(rank.js)은 사내 순위 서버(ai-desk)의 화면을 그대로 가져온 것이고, 여기서는 업무툴에 맞게 창·알림만 붙인다.
// 데이터: /api/rank/* — 순위 서버가 매일 수집해 올려 둔 것. 등록·삭제·재검색은 순위 서버가 가져가 처리한다.
import { initRank, rankPage } from './rank.js'
import { initSetup, setupPage } from './setup.js'
import { mascot } from './mascot.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const me = () => { try { return typeof state !== 'undefined' && state.currentUser ? state.currentUser : null } catch { return null } }

// 창·알림은 .jh-rank 안에 둬야 순위 화면 스타일이 먹는다 (업무툴 스타일과 섞이지 않게)
let host
function hostEl() {
  if (host) return host
  host = document.createElement('div'); host.className = 'jh-rank jh-rank-host'
  host.innerHTML = '<div id="jrModal" class="modal hidden" style="z-index:9000"><div class="modal-card"><button class="x" id="jrModalX" aria-label="닫기">✕</button><div id="jrModalBody"></div></div></div><div id="jrToast" class="toast hidden" style="z-index:9100"></div>'
  document.body.appendChild(host)
  host.querySelector('#jrModalX').onclick = closeModal
  host.querySelector('#jrModal').onclick = (e) => { if (e.target.id === 'jrModal') closeModal() }
  return host
}

async function api(path, body) {
  const u = me()
  const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-JH-User': encodeURIComponent(u?.name || u?.id || '') }, body: body ? JSON.stringify(body) : undefined })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status)
  return j
}
function toast(msg, ms = 2600) { const t = hostEl().querySelector('#jrToast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('hidden'), ms) }
function modal(html) { const h = hostEl(); h.querySelector('#jrModalBody').innerHTML = html; h.querySelector('#jrModal').classList.remove('hidden') }
function closeModal() { hostEl().querySelector('#jrModal').classList.add('hidden') }
function dialog({ msg, input = false, dflt = '', ok = '확인', danger = false }) {
  return new Promise((res) => {
    const d = document.createElement('div'); d.className = 'dialog'; d.style.zIndex = 9200
    d.innerHTML = `<form class="dialog-card"><p>${esc(msg)}</p>${input ? `<textarea rows="3" style="width:100%">${esc(dflt)}</textarea>` : ''}<div class="row"><button type="button" class="btn btn-ghost" data-x>취소</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${ok}</button></div></form>`
    hostEl().appendChild(d)
    const ta = d.querySelector('textarea'); (ta || d.querySelector('.btn-primary, .btn-danger')).focus()
    const done = (v) => { d.remove(); res(v) }
    d.querySelector('[data-x]').onclick = () => done(input ? null : false)
    d.onclick = (e) => { if (e.target === d) done(input ? null : false) }
    d.querySelector('form').onsubmit = (e) => { e.preventDefault(); done(input ? (ta.value.trim() || null) : true) }
  })
}
async function copyText(s) { try { await navigator.clipboard.writeText(s) } catch { const t = document.createElement('textarea'); t.value = s; document.body.appendChild(t); t.select(); try { document.execCommand('copy') } catch {} t.remove() } }

initRank({ api, esc, toast, modal, closeModal, confirmBox: (msg, o = {}) => dialog({ msg, ...o }), askText: (msg, dflt = '') => dialog({ msg, input: true, dflt }), copyText, mascot, DEMO: false, me: me() })

/** showPage('rank-place' | 'rank-shop') 에서 부른다 */
window.jhRank = async function (page) {
  const kind = page === 'rank-shop' ? 'shop' : 'place'
  const root = document.querySelector(`#page-${page} .jh-rank-root`)
  if (!root) return
  if (!root.innerHTML.trim()) root.innerHTML = '<div class="empty" style="padding:40px;text-align:center">불러오는 중…</div>'
  try { await rankPage(kind, root) }
  catch (e) { root.innerHTML = `<div class="empty" style="padding:40px;text-align:center">${mascot('warn', 56)}<div>순위 데이터를 불러오지 못했어요</div><div class="sub">${esc(e.message)}</div></div>` }
}

// 리워드 세팅: 채팅(재흥이)으로 요청한 세팅이 어디까지 됐는지 — 회사 PC 에서 바로 읽어 온다
initSetup({ api, esc, toast, modal, mascot, openChat: () => { if (typeof showPage === 'function') showPage('rank-chat') } })
window.jhSetup = async function () {
  const root = document.querySelector('#page-rank-setup .jh-rank-root')
  if (root) await setupPage(root)
}

// 채팅(jh-chat.js)도 같은 창·알림을 쓴다
export { api, esc, toast, modal, closeModal, dialog, copyText, me }
