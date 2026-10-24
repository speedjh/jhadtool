// 자동 생성 — ai-desk/public/chat.js 에서 (직접 고치지 말 것)
// AI 비서 채팅 화면 — 이 업무툴(app.js)과 사내 업무툴(jhadtool, scripts/build-jhadtool.mjs)이 같이 쓴다.
// 공용 도구는 initChat 으로 받는다: { api, esc, toast, modal, askText, copyText, mascot, DEMO, session, openChat, go, refreshBell, histModal, rankHtml, delta, won, daysHtml, reportCard, openReport }
let D, api, esc, toast, askText, copyText, mascot, DEMO, histModal, rankHtml, delta, won, daysHtml, reportCard, openReport
export function initChat(deps) { D = deps; ({ api, esc, toast, askText, copyText, mascot, DEMO, histModal, rankHtml, delta, won, daysHtml, reportCard, openReport } = deps) }
const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]
const STARTERS = [['시트로 세팅', 'https://docs.google.com/spreadsheets/d/… 세팅해줘', '시트 링크 붙여 넣고 "세팅해줘" — 물어보면 "네"'], ['세팅할 것', '세팅할 거 보여줘', '시작일 빠른 순으로 정리'], ['대행사 등록', '대행사 등록 크래머리 https://docs.google.com/spreadsheets/d/…', '시트 링크만 주시면 자동으로 지켜볼게요'], ['키워드 미리 확인', '키워드 확인 가평 맛집 https://m.place.naver.com/restaurant/1829721672', '받기 전에 구좌·순위 확인']]
const SUGGEST = ['세팅할 거 보여줘', '오늘 취소건', '알림', '미정산 알려줘', '진행 중 유입 몇 타야?', '보고서', '도움말']
function moodOf(text) { if (/^(||)/.test(text)) return 'warn'; if (/^(||||||)/.test(text)) return 'happy'; return 'idle' }
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
const hm = (at) => { const t = at ? new Date(at.replace(' ', 'T') + '+09:00') : new Date(); return t.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Seoul' }) }

export async function chatPage(v) {
  v.innerHTML = `<div class="chat-page"><div class="chat-scroll" id="chatLog"></div>
    <div class="chat-foot"><div class="suggest" id="suggest">${SUGGEST.map(s => `<button data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <form class="composer" id="chatForm"><textarea id="chatText" rows="1" placeholder="재흥이에게 물어보세요"></textarea><button class="send" id="sendBtn" aria-label="보내기">↑</button></form></div></div>`
  const log = $('#chatLog')
  const j = await api('/api/rank/chat?session=' + encodeURIComponent(D.session()))
  if (!v.isConnected) return
  if (!j.messages.length) welcome(log)
  else { log.insertAdjacentHTML('beforeend', `<div class="chat-day">${new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</div>`); for (const m of j.messages) addMsg(log, m.role, m.text, m.data, m.at); const lastRow = log.lastElementChild; $$('.kr-card', log).forEach(c => { if (!lastRow?.contains(c)) c.classList.add('kr-done') }) }
  const ta = $('#chatText'); const autoGrow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px' }
  $('#chatForm').onsubmit = (e) => { e.preventDefault(); const t = ta.value; ta.value = ''; autoGrow(); send(t) }
  ta.oninput = autoGrow
  ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#chatForm').requestSubmit() } }
  $('#suggest').onclick = (e) => { const b = e.target.closest('button'); if (b) send(b.dataset.q) }
  log.scrollTop = log.scrollHeight
  if (matchMedia('(min-width: 961px)').matches) ta.focus()
}
function welcome(log) {
  log.innerHTML = `<div class="welcome">${mascot('happy', 92)}<h2>안녕하세요, 재흥이예요!</h2><p>대행사 시트 링크와 함께 "세팅해줘"라고 하면 정리해서 여쭤보고, "네" 한 번에 세팅 시트·순위 등록까지 해요.</p>
    <div class="starters">${STARTERS.map(([t, q, d]) => `<button class="starter" data-q="${esc(q)}"><b>${t}</b><span>${d}</span></button>`).join('')}</div></div>`
  $$('.starter', log).forEach(b => b.onclick = () => { if (b.dataset.q.includes('…')) { const ta = $('#chatText'); ta.value = b.dataset.q.replace('https://docs.google.com/spreadsheets/d/…', ''); ta.focus(); ta.setSelectionRange(0, 0) } else send(b.dataset.q) })
}
function addMsg(log, role, text, data, at) {
  $('.welcome', log)?.remove()
  const row = document.createElement('div')
  row.className = 'msg-row ' + (role === 'user' ? 'user' : 'bot')
  if (role === 'user') row.innerHTML = `<span class="msg-time">${hm(at)}</span><div class="msg-col"><div class="bubble">${md(text)}</div></div>`
  else {
    row.innerHTML = `<div class="ava">${mascot(role === 'typing' ? 'think' : moodOf(text), 36)}</div><div class="msg-col"><div class="msg-name">재흥이</div>${role === 'typing' ? '<div class="bubble typing"><i></i><i></i><i></i></div>' : `<div class="bubble">${md(text)}</div>`}</div>${role === 'typing' ? '' : `<span class="msg-time">${hm(at)}</span>`}`
    const col = $('.msg-col', row)
    if (data?.cards?.length) col.appendChild(renderCards(data.cards))
    if (data?.actions?.length) {
      const q = document.createElement('div'); q.className = 'qr'
      for (const x of data.actions) {
        const b = document.createElement('button'); b.textContent = x.label; if (x.style === 'primary') b.className = 'primary'
        b.onclick = async () => { if (x.href) { D.go(x.href); return } let cmd = x.cmd; if (x.needNote) { const n = await askText('내용을 적어 주세요'); if (!n) return; cmd += n } send(cmd) }
        q.appendChild(b)
      }
      col.appendChild(q)
    }
  }
  log.appendChild(row); log.scrollTop = log.scrollHeight
  return row
}
// ---------------- 키워드 로봇 (프리리워드 [키워드 로봇에게 맡기기] 화면을 채팅 카드로) ----------------
const KR_ROBOT = `<svg viewBox="0 0 120 120" class="kr-robot" aria-hidden="true">
  <defs><linearGradient id="krg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b9dff"/><stop offset="1" stop-color="#6b5cff"/></linearGradient></defs>
  <line x1="60" y1="10" x2="60" y2="24" stroke="#6b5cff" stroke-width="3" stroke-linecap="round"/><circle class="kr-ant" cx="60" cy="9" r="6" fill="#ffd43b"/>
  <rect x="22" y="22" width="76" height="56" rx="20" fill="url(#krg)"/><rect x="31" y="31" width="58" height="38" rx="13" fill="#eaf2ff"/>
  <ellipse class="kr-eye" cx="47" cy="47" rx="5" ry="6.5" fill="#1b2a4a"/><ellipse class="kr-eye" cx="73" cy="47" rx="5" ry="6.5" fill="#1b2a4a"/>
  <circle cx="49" cy="44.5" r="1.6" fill="#fff"/><circle cx="75" cy="44.5" r="1.6" fill="#fff"/>
  <circle cx="38" cy="57" r="4" fill="#ffb3c7" opacity=".8"/><circle cx="82" cy="57" r="4" fill="#ffb3c7" opacity=".8"/>
  <rect class="kr-mouth" x="54" y="57" width="12" height="3.2" rx="1.6" fill="#1b2a4a"/>
  <rect x="34" y="80" width="52" height="30" rx="12" fill="url(#krg)"/><circle cx="60" cy="95" r="9" fill="#eaf2ff"/>
  <g class="kr-lens"><circle cx="58.5" cy="93.5" r="4.2" fill="none" stroke="#3182f6" stroke-width="2.2"/><line x1="61.5" y1="96.5" x2="65" y2="100" stroke="#3182f6" stroke-width="2.4" stroke-linecap="round"/></g>
  <rect x="18" y="84" width="14" height="8" rx="4" fill="#6b5cff"/><rect class="kr-arm-r" x="88" y="84" width="14" height="8" rx="4" fill="#6b5cff"/></svg>`
const KR_TALK = ['업체 정보를 살펴보는 중이에요…', '네이버 앱에서 몇 위인지 보는 중이에요…', '하나씩 꼼꼼히 확인하고 있어요', '구좌가 뜨는지 보고 있어요…', '10위 안에 드는 것만 골라 드릴게요!']
// 찾는 중 (서버가 한 번에 답하므로 진행은 움직이는 막대로 보여 준다)
function kwRobotWorking() {
  const el = document.createElement('div'); el.className = 'mcard kr-card kr-work'
  el.innerHTML = `<div class="kr-head">${KR_ROBOT}<div class="kr-bubble">${KR_TALK[0]}</div></div><div class="kr-progress"><i></i></div><div class="kr-body"><div class="kr-empty">찾는 대로 여기에 보여 드릴게요</div></div>`
  let i = 0; const b = $('.kr-bubble', el); const h = setInterval(() => { if (!el.isConnected) return clearInterval(h); b.textContent = KR_TALK[++i % KR_TALK.length] }, 2600)
  return el
}
function kwRobotCard(c) {
  const el = document.createElement('div'); el.className = 'mcard kr-card ' + (c.list.length ? 'kr-happy' : 'kr-sad')
  const sel = new Set((c.rec || []).map(k => c.list.findIndex(x => x.keyword === k)).filter(i => i >= 0))
  const badge = (x) => `<span class="kr-badge ${x.rank <= 3 ? 'kr-b1' : x.rank <= 7 ? 'kr-b2' : 'kr-b3'}">${x.rank ? x.rank + '위' : '-'}</span>`
  const groups = [['지난 캠페인에 쓴 것', x => x.prior], ['일반 키워드', x => !x.prior && !x.brand], ['업체명 포함', x => !x.prior && x.brand]]
  const say = (h) => { $('.kr-bubble', el).innerHTML = h }
  const draw = () => {
    $('.kr-body', el).innerHTML = c.list.length ? groups.map(([t, f]) => { const rows = c.list.map((x, i) => [x, i]).filter(([x]) => f(x)).sort((a, b) => (a[0].rank || 99) - (b[0].rank || 99))
      return rows.length ? `<div class="kr-group">${t} · ${rows.length}개</div>` + rows.map(([x, i]) => `<label class="kr-row${sel.has(i) ? ' kr-on' : ''}" data-i="${i}"><span class="kr-no">${i + 1}</span><input type="checkbox"${sel.has(i) ? ' checked' : ''}><span class="kr-kw">${esc(x.keyword)}</span>${x.brand ? '<span class="kr-chip">업체명</span>' : ''}${badge(x)}</label>`).join('') : '' }).join('')
      : `<div class="kr-empty">${esc(c.message || '10위 안에 드는 검색어를 못 찾았어요')}</div>`
    $('.kr-stats', el).innerHTML = `<span>확인 <b>${c.checked}</b>개</span><span>찾음 <b>${c.list.length}</b>개</span><span>선택 <b>${sel.size}/${c.max}</b></span>`
    const ap = $('.kr-apply', el); ap.disabled = !sel.size; ap.textContent = sel.size ? `선택한 ${sel.size}개 ${c.applyLabel || '넣기'}` : '키워드를 골라 주세요'
  }
  el.innerHTML = `<div class="kr-head">${KR_ROBOT}<div class="kr-bubble"></div></div><div class="kr-stats"></div><div class="kr-progress"><i style="width:${c.list.length ? 100 : 0}%"></i></div><div class="kr-body"></div>
    <div class="kr-foot"><button type="button" class="kr-more">더 찾아줘</button><button type="button" class="kr-apply" disabled></button></div>`
  say(c.list.length ? `<b>${esc(c.name)}</b> 검색어 <b>${c.list.length}개</b> 찾았어요! 마음에 드는 걸 골라 주세요.<br><small>${c.mode === 'shop' ? '네이버쇼핑 일반 노출(광고 제외)' : '네이버 모바일 플레이스'} 순위는 지금 기준이에요. 세팅할 때 한 번 더 확인해요.${c.blocked ? ' 네이버가 잠시 막아서 중간에 멈췄어요.' : ''}</small>`
    : `이번엔 10위 안에 드는 걸 못 찾았어요. <b>더 찾아줘</b>를 누르거나 채팅으로 직접 적어 주세요.`)
  draw()
  $('.kr-body', el).onclick = (e) => { const r = e.target.closest('.kr-row'); if (!r || el.classList.contains('kr-done')) return; e.preventDefault(); const i = +r.dataset.i
    if (sel.has(i)) sel.delete(i); else if (sel.size >= c.max) { say(`한 번에 <b>${c.max}개</b>까지 넣을 수 있어요. 다른 걸 빼고 골라 주세요.`); return } else sel.add(i); draw() }
  $('.kr-apply', el).onclick = () => { if (!sel.size) return; el.classList.add('kr-done'); send([...sel].sort((a, b) => a - b).map(i => i + 1).join(' ') + '번') }
  $('.kr-more', el).onclick = () => { el.classList.add('kr-done'); send('더 찾아 줘') }
  return el
}
function renderCards(cards) {
  const w = document.createElement('div'); w.className = 'cards'
  for (const c of cards) {
    const el = document.createElement('div'); el.className = 'mcard'
    if (c.type === 'order') el.innerHTML = `<div class="t">${esc(c.title)}</div><div class="s">${esc(c.sub || '')}</div><div class="chips">${(c.kws || []).slice(0, 8).map(k => `<span class="chip">${esc(k)}</span>`).join('')}${c.paid === 0 ? `<span class="chip red">미정산 ${won(c.amount)}</span>` : c.paid === 1 ? '<span class="chip green">정산됨</span>' : ''}</div>`
    else if (c.type === 'setting') {
      const rows = c.rows || []
      el.innerHTML = `<div class="t">세팅표 · ${rows.length}행</div><div style="overflow-x:auto;margin-top:8px"><table class="set"><tr><th>앱</th><th>시작</th><th>종료</th><th>검색어</th><th>정답</th><th>업체명</th><th>일유입</th><th>미션</th></tr>${rows.map(r => `<tr><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[8])}</td><td>${esc(r[10])}</td><td>${esc(r[12])}</td><td>${esc(r[13])}</td><td>${r[9] ? `<details><summary>보기</summary><div style="white-space:pre-wrap;max-width:300px">${esc(r[9])}</div></details>` : ''}</td></tr>`).join('')}</table></div>${c.candidates?.length ? `<div class="s" style="margin-top:6px">다른 명소 후보: ${c.candidates.slice(0, 8).map(esc).join(', ')}</div>` : ''}`
    } else if (c.type === 'sheetMap') {
      // 처음 보는 시트 형식 — 재흥이가 고른 열 + 그 열로 읽은 앞 몇 건 + 검산에서 걸린 것
      const ck = c.check || {}, n = (v) => v != null && Number.isFinite(v)
      el.innerHTML = `<div class="t">'${esc(c.tab)}' 탭 — 재흥이가 읽은 열 (머리글 ${c.headerRow}행)</div>
        <div style="overflow-x:auto;margin-top:8px"><table class="set"><tr><th>열</th><th>시트 머리글</th><th>재흥이가 본 뜻</th></tr>${(c.columns || []).map(x => `<tr><td>${esc(x.col)}</td><td>${esc(x.header || '(빈 칸)')}</td><td>${esc(x.label)}</td></tr>`).join('')}</table></div>
        ${ck.sample?.length ? `<div class="t" style="margin-top:12px">이렇게 읽혀요 (앞 ${ck.sample.length}건 · 전체 ${ck.campaigns}건)</div><div style="overflow-x:auto;margin-top:6px"><table class="set"><tr><th>행</th><th>업체</th><th>상품</th><th>기간</th><th>일 / 총</th><th>금액</th><th>단가</th><th>검색어</th></tr>${ck.sample.map(x => `<tr><td>${x.row}</td><td>${esc(x.name || '')}</td><td>${esc(x.product || '')}</td><td>${esc((x.start || '').slice(5))}~${esc((x.end || '').slice(5))}</td><td>${x.daily ?? '-'} / ${x.total ?? '-'}</td><td>${n(x.amount) ? won(x.amount) : '-'}${n(x.amountVat) ? `<div class="s">VAT 포함 ${won(x.amountVat)}</div>` : ''}</td><td>${x.unit != null ? x.unit + '원' : '-'}</td><td>${esc((x.keywords || []).join(', '))}</td></tr>`).join('')}</table></div>` : ''}
        ${ck.problems?.length ? `<div class="s" style="color:var(--red);margin-top:8px">${ck.problems.map(esc).join('<br>')}</div>` : ''}
        ${c.reason ? `<div class="s" style="margin-top:8px">${esc(c.reason)}</div>` : ''}${c.doubts?.length ? `<div class="s" style="margin-top:4px">재흥이가 헷갈린 점: ${c.doubts.map(esc).join(' / ')}</div>` : ''}`
    } else if (c.type === 'image') { el.replaceWith(); w.appendChild(reportCard(c.url, c.caption, c.title)); continue }
    else if (c.type === 'kwRobot') { w.appendChild(kwRobotCard(c)); continue }
    else if (c.type === 'kakao') { el.innerHTML = `<div class="t">카톡에 붙여 넣을 메시지</div><textarea class="tsv" readonly style="min-height:220px">${esc(c.text)}</textarea><div class="qr"><button class="primary">복사</button></div>`; el.querySelector('button').onclick = async () => { await copyText(c.text); toast('복사했어요 — 카톡 방에 붙여 넣어 주세요') } }
    else if (c.type === 'tsv') { el.innerHTML = `<div class="t">세팅 시트 붙여넣기용 (A열부터)</div><textarea class="tsv" readonly>${esc(c.tsv)}</textarea><div class="qr"><button class="primary">복사</button></div>`; el.querySelector('button').onclick = async () => { await copyText(c.tsv); toast('복사했어요 — 세팅 시트 \'ai비서 리워드\' 탭 A열에 붙여 주세요') } }
    else if (c.type === 'rank') { el.innerHTML = `<div class="t"><span class="badge">${c.kind === 'shop' ? '쇼핑' : '플레이스'}</span> ${esc(c.keyword)} <span class="s">${esc(c.name || '')}</span></div><div class="row" style="margin:6px 0">${rankHtml(c.last)} ${delta(c.last, c.prev)} <span class="sub">${esc(c.memo || '')}</span></div>${daysHtml(c.history)}`; el.style.cursor = 'pointer'; el.onclick = () => histModal(c.id) }
    else if (c.type === 'link') { const url = location.origin + c.url; el.innerHTML = `<div class="t">${esc(c.label)}</div><div class="s" style="word-break:break-all">${esc(DEMO ? '(데모) ' + c.url : url)}</div><div class="qr"><button class="primary">링크 복사</button><button>열어 보기</button></div>`; const [cp, op] = $$('button', el); cp.onclick = async () => { await copyText(url); toast('링크를 복사했어요') }; op.onclick = () => openReport(c.url) }
    else el.textContent = JSON.stringify(c)
    w.appendChild(el)
  }
  return w
}
export async function send(text) {
  text = String(text || '').trim(); if (!text) return
  await D.openChat()
  const log = $('#chatLog'); if (!log) return
  // 검색어를 찾는 요청이면 점 세 개 대신 일하는 키워드 로봇을 보여 준다 (20~40초 걸림)
  const lastBtns = [...$$('.msg-row.bot', log)].pop()?.querySelectorAll('.qr button') || []
  const kwAsk = /(키워드|검색어).*(짜|만들|추천|뽑|생성|찾아)/.test(text) && !/확인|체크|검증|변경/.test(text) || /^더\s*(찾아|짜)/.test(text) || text === '네, 키워드 짜 주세요' ||
    (/^(네|넹|넵|예|응|좋아요?)(?=$|[\s,.!~])/.test(text) && [...lastBtns].some(b => /키워드 짜/.test(b.textContent)))
  $$('.kr-card', log).forEach(c => c.classList.add('kr-done'))   // 새 말을 보내면 지난 로봇 카드는 고르기 끝
  addMsg(log, 'user', text)
  const th = addMsg(log, 'typing', '')
  if (kwAsk) { const b = $('.bubble.typing', th); b.replaceWith(kwRobotWorking()); log.scrollTop = log.scrollHeight }
  $('#sendBtn').disabled = true
  try { const r = await api('/api/rank/chat', { session: D.session(), text }); th.remove(); addMsg(log, 'bot', r.text, r) }
  catch (e) { th.remove(); addMsg(log, 'bot', '' + e.message) }
  finally { const b = $('#sendBtn'); if (b) b.disabled = false; D.refreshBell() }
}
