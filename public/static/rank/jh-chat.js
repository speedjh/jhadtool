// 리워드 › AI 비서 재흥이
// 채팅 화면(chat.js)은 사내 순위 서버(ai-desk)의 것을 그대로 가져왔고, 답은 회사 PC 의 에이전트가 만든다.
// 보낸 말은 /api/rank/chat 에 맡기고(회사 PC 가 몇 초마다 가져감) /api/rank/chat/result 로 답을 기다린다.
import { initChat, chatPage } from './chat.js'
import { prevModal } from './rank.js'
import { mascot } from './mascot.js'
import { api as api0, esc, toast, modal, dialog, copyText } from './jh-rank.js'

const WAIT_MS = 6 * 60e3
async function api(path, body) {
  if (path !== '/api/rank/chat' || !body) return api0(path, body)
  const { id } = await api0('/api/rank/chat', body)
  const until = Date.now() + WAIT_MS
  for (let wait = 1200; Date.now() < until; wait = Math.min(wait + 300, 2500)) {
    await new Promise(r => setTimeout(r, wait))
    const x = await api0('/api/rank/chat/result?id=' + id)
    if (x.state === 'queued' && Date.now() > until - WAIT_MS + 20000) throw new Error('회사 PC(재흥이)가 응답하지 않아요 — PC 가 켜져 있는지 확인해 주세요')
    if (x.state === 'done') { if (x.status >= 400 || x.result?.error) throw new Error(x.result?.error || 'HTTP ' + x.status); return x.result }
  }
  throw new Error('답이 너무 오래 걸려요 — 잠시 뒤 화면을 다시 열어 보면 답이 와 있을 수 있어요')
}
const rankHtml = (r) => r == null ? '<span class="rank out">-</span>' : r === 0 ? '<span class="rank out">-</span>' : `<span class="rank ${r <= 5 ? 'top' : r <= 10 ? 'mid' : ''}">${r}위</span>`
const delta = (a, b) => (a && b && a !== b) ? `<span class="delta ${a < b ? 'up' : 'down'}">${a < b ? '▲' : '▼'}${Math.abs(a - b)}</span>` : ''
const won = (n) => (Number(n) || 0).toLocaleString('ko-KR') + '원'
function daysHtml(h = [], n = 7) {
  const byDay = {}; for (const x of h) (byDay[x.day] ||= {})[x.source] = x
  return `<div class="days">${Object.keys(byDay).sort().reverse().slice(0, n).map(d => { const v = byDay[d].desk || byDay[d].adlog; const r = v.rank == null ? '?' : v.rank === 0 ? '밖' : v.rank
    return `<div class="day ${byDay[d].desk ? '' : 'adlog'}" title="${byDay[d].desk ? '자체 수집' : 'adlog 기록'}">${d.slice(5)}<b>${r}</b></div>` }).join('')}</div>`
}
function reportCard(img, caption, title) {
  const el = document.createElement('div'); el.className = 'card report-shot'
  if (!img) { el.innerHTML = `<div class="card-h">${esc(title)}</div><p class="sub">그림이 커서 여기서는 못 보여 드려요 — 회사 PC 업무툴에서 확인해 주세요.</p>`; return el }
  el.innerHTML = `<div class="card-h">${esc(title)}</div><img src="${esc(img)}" alt="유입 보고서 캡처" style="max-width:100%">${caption ? `<textarea class="tsv" readonly style="min-height:72px">${esc(caption)}</textarea>` : ''}
    <div class="row" style="margin-top:8px"><button class="btn btn-sm btn-primary" data-ci>이미지 복사</button>${caption ? '<button class="btn btn-sm" data-ct>문구 복사</button>' : ''}<a class="btn btn-sm btn-ghost" href="${esc(img)}" download="${esc(title || 'report')}.png">이미지 저장</a></div>`
  el.querySelector('[data-ci]').onclick = async () => { try { const blob = await (await fetch(img)).blob(); await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]); toast('이미지를 복사했어요 — 카톡에 붙여 넣어 주세요') } catch { toast('이 브라우저에선 이미지 복사가 안 돼요 — 이미지 저장을 눌러 주세요') } }
  el.querySelector('[data-ct]')?.addEventListener('click', async () => { await copyText(caption); toast('문구를 복사했어요') })
  return el
}
const root = () => document.querySelector('#page-rank-chat .jh-rank-root')
async function openChat() { if (!document.querySelector('#page-rank-chat.active') && typeof showPage === 'function') showPage('rank-chat'); for (let i = 0; i < 30 && !root()?.querySelector('#chatForm'); i++) await new Promise(r => setTimeout(r, 100)) }

initChat({ api, esc, toast, modal, askText: (msg, dflt = '') => dialog({ msg, input: true, dflt }), copyText, mascot, DEMO: false,
  session: () => 'me', openChat, go: () => toast('그 화면은 회사 PC 업무툴에 있어요'), refreshBell: () => {},
  histModal: (id) => prevModal(id).catch(e => toast('' + e.message)), rankHtml, delta, won, daysHtml, reportCard, openReport: (p) => window.open(p, '_blank') })

/** showPage('rank-chat') 에서 부른다 */
window.jhChat = async function (force) {
  const el = root(); if (!el) return
  if (!force && el.querySelector('#chatForm')) return            // 쓰던 대화는 그대로 둔다
  el.innerHTML = '<div class="empty" style="padding:40px;text-align:center">불러오는 중…</div>'
  try { await chatPage(el); addRefresh(el) }
  catch (e) {
    el.innerHTML = `<div class="empty" style="padding:40px;text-align:center">${mascot('warn', 56)}<div>재흥이를 불러오지 못했어요</div><div class="sub">${esc(e.message)}</div><div style="margin-top:12px"><button class="btn btn-sm btn-primary" data-jc-reload>다시 불러오기</button></div></div>`
    el.querySelector('[data-jc-reload]').onclick = () => window.jhChat(true)
  }
}
// 채팅 영역만 새로 불러오기 — F5 없이 회사 PC 가 늦게 보낸 답까지 다시 받아 온다 (적던 글은 남겨 둠)
function addRefresh(el) {
  const page = el.querySelector('.chat-page'); if (!page || page.querySelector('.jc-refresh')) return
  const b = document.createElement('button')
  b.type = 'button'; b.className = 'btn btn-sm btn-ghost jc-refresh'; b.title = '대화 새로고침'; b.textContent = '↻ 새로고침'
  b.style.cssText = 'position:absolute;top:8px;right:12px;z-index:5'
  page.style.position = 'relative'
  b.onclick = async () => {
    const draft = el.querySelector('#chatText')?.value || ''
    b.disabled = true
    await window.jhChat(true)
    const ta = el.querySelector('#chatText'); if (ta && draft) ta.value = draft
    toast('대화를 새로 불러왔어요')
  }
  page.prepend(b)
}

// ---- 어느 화면에서든 오른쪽 아래에 따라다니는 재흥이 버튼 → 누르면 AI 비서 채팅으로 ----
// 로그인 전 · 채팅 화면에서는 숨긴다
;(function fab() {
  const st = document.createElement('style')
  st.textContent = `.jh-fab{position:fixed;right:24px;bottom:24px;z-index:900;display:flex;align-items:center;gap:0;height:58px;padding:0 6px;border:1px solid var(--border);border-radius:99px;background:var(--surface);box-shadow:0 8px 28px rgba(0,27,55,.16);cursor:pointer;transition:transform .15s,box-shadow .15s,gap .2s}
.jh-fab{--m-head:#3182F6;--m-face:#F4F8FF;--m-eye:#191F28;--m-blush:#FF9FB3;--m-bulb:#FFC93C}
html.dark .jh-fab{--m-head:#4D9AFF;--m-face:#E9F1FF}
.jh-fab:hover{transform:translateY(-2px);box-shadow:0 12px 34px rgba(0,27,55,.22);gap:8px}
.jh-fab .jh-fab-m{width:46px;height:46px;display:grid;place-items:center}
.jh-fab .jh-fab-t{max-width:0;overflow:hidden;white-space:nowrap;font-weight:700;font-size:13.5px;color:var(--text);transition:max-width .25s,padding .25s}
.jh-fab:hover .jh-fab-t{max-width:180px;padding-left:12px}
.jh-fab.hide{display:none}
@media (max-width:900px){.jh-fab{right:16px;bottom:16px}}`
  document.head.appendChild(st)
  const b = document.createElement('button')
  b.type = 'button'; b.className = 'jh-fab hide'; b.title = '재흥이에게 물어보기'
  b.innerHTML = `<span class="jh-fab-t">재흥이에게 물어보기</span><span class="jh-fab-m jh-rank">${mascot('idle', 44)}</span>`
  b.onclick = () => openChat()
  document.body.appendChild(b)
  const sync = () => {
    const app = document.getElementById('appWrap')
    const on = app && app.style.display !== 'none' && !document.querySelector('#page-rank-chat.active')
    b.classList.toggle('hide', !on)
  }
  setInterval(sync, 400); sync()
})()
