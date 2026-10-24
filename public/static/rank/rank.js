// 자동 생성 — ai-desk/public/rank.js 에서 (직접 고치지 말 것)
// 플레이스 순위 · 가격비교 순위 화면 — adlog 순위체크 화면과 같은 구성
//  키워드 등록 바 → 순위 구간 → 보기/출력 설정 → 작업 버튼 → 정렬 → 2줄 표(일별 순위) → 관리 버튼(메모·재검색·보고서·비교·이전 순위·다운·알림)
//  보기·출력 설정은 이 브라우저에만 저장(localStorage). 데이터 변경은 모두 서버 API(감사 로그 남음).
let D   // app.js 에서 넘겨주는 공용 도구 { api, esc, toast, modal, closeModal, confirmBox, askText, copyText, mascot, DEMO, me }
export function initRank(deps) { D = deps }

const WD = ['일', '월', '화', '수', '목', '금', '토']
const store = { get(k, d) { try { const v = localStorage.getItem('rank-' + k); return v == null ? d : JSON.parse(v) } catch { return d } }, set(k, v) { try { localStorage.setItem('rank-' + k, JSON.stringify(v)) } catch {} } }
const RS = { place: { q: '', sfl: 'all', group: '', rank: '', sort: 'custom', dir: '', offset: 0, rows: 20, archived: false, alert: false }, shop: { q: '', sfl: 'all', group: '', rank: '', sort: 'custom', dir: '', offset: 0, rows: 20, archived: false, alert: false } }
const PREF_DEFAULT = { place: { view: 'basic', pct: 0, review: 1, blog: 1, visit: 1, vol: 1, mon: 0, comp: 0, cap: 0, wm: 0 }, shop: { view: 'basic', review: 1, cap: 0, wm: 0 } }
const pref = (kind) => ({ ...PREF_DEFAULT[kind], ...store.get('pref-' + kind, {}) })
const setPref = (kind, p) => store.set('pref-' + kind, p)
const HL = ['#E03131', '#1C7ED6', '#2F9E44', '#F08C00', '#7048E8', '#E8590C', '#C2255C', '#0C8599', '#495057', '#FFE3E3', '#D0EBFF', '#D3F9D8', '#FFF3BF', '#E5DBFF', '#FFE8CC', '#FFDEEB', '#C5F6FA']
const fmt = (n) => n == null ? '-' : Number(n).toLocaleString('ko-KR')
// 월 검색량: 검색광고 API 가 '< 10' 으로 주는 값은 0 으로 저장돼 있다
const vol = (n) => n == null ? '-' : +n === 0 ? '< 10' : fmt(n)
const dayLbl = (d) => { const w = new Date(d + 'T12:00:00Z').getUTCDay(); return `${d.slice(5)}<span class="${w === 0 ? 'sun' : w === 6 ? 'sat' : ''}">(${WD[w]})</span>` }
const mUrl = (kw, kind) => kind === 'shop' ? 'https://m.search.naver.com/search.naver?where=m_shop&query=' + encodeURIComponent(kw) : 'https://m.search.naver.com/search.naver?where=m&query=' + encodeURIComponent(kw)
const pUrl = (kw, kind) => kind === 'shop' ? 'https://search.shopping.naver.com/search/all?query=' + encodeURIComponent(kw) : 'https://map.naver.com/p/search/' + encodeURIComponent(kw)
const targetUrl = (t) => t.kind === 'shop' ? 'https://search.shopping.naver.com/catalog/' + t.ref_id : (t.url || 'https://m.place.naver.com/place/' + t.ref_id + '/home')

// 하루 1칸: 자체 수집 우선, 없으면 adlog 기록(점선)
function byDay(history) {
  const m = new Map()
  for (const h of history || []) { const c = m.get(h.day); if (!c || (h.source === 'desk' && c.source !== 'desk')) m.set(h.day, h) }
  return [...m.values()].sort((a, b) => a.day < b.day ? 1 : -1)
}
// 순위 없음(플레이스 300위 · 가격비교 320위 안에 없음)은 adlog 처럼 '-'
const rankTxt = (h) => h.rank == null || h.rank === 0 ? '-' : h.rank + '위'
const inPeriod = (t, day) => t.hl_color && t.contract_start && t.contract_end && day >= t.contract_start && day <= t.contract_end

function dayCell(t, h, p) {
  const kind = t.kind, hl = inPeriod(t, h.day)
  const lines = []
  if (kind === 'place') {
    // 백분율(adlog '백분율') = 전체 업체 중 몇 % 안에 드는지
    if (p.pct && h.rank > 0 && h.total) lines.push(`상위 ${Math.max(0.1, Math.round(h.rank / h.total * 1000) / 10)}%`)
    if (p.review && p.blog && h.blog_reviews != null) lines.push(`블 ${fmt(h.blog_reviews)}개`)
    if (p.review && p.visit && h.visitor_reviews != null) lines.push(`방 ${fmt(h.visitor_reviews)}개`)
    if (p.vol && p.mon && t.search_volume != null) lines.push(`월 ${vol(t.search_volume)}건`)
    if (p.vol && p.comp && h.total != null) lines.push(`업체 ${fmt(h.total)}개`)
  } else if (p.review && h.rank) {
    if (h.review_count != null) lines.push(`리뷰 ${fmt(h.review_count)}개`)
    if (h.keep_count != null) lines.push(`찜 ${fmt(h.keep_count)}개`)
    if (h.purchase_count != null) lines.push(`구매 ${fmt(h.purchase_count)}개`)
    if (h.score != null) lines.push(`별점 ${h.score}`)
  }
  const style = hl ? (HL.indexOf(t.hl_color) >= 9 ? `background:${t.hl_color}` : `box-shadow:inset 0 0 0 2px ${t.hl_color}`) : ''
  return `<div class="adl-day ${h.source === 'desk' ? '' : 'ext'}" style="${style}" title="${h.source === 'desk' ? '자체 수집 ' + D.esc(h.checked_at || '') : 'adlog 기록'}"><span class="d">${dayLbl(h.day)}</span><b>${rankTxt(h, kind)}</b>${lines.map(l => `<i>${l}</i>`).join('')}</div>`
}

// ---------------- 목록 화면 ----------------
const ROOTS = {}   // 다시 그릴 때(rankPage(kind)) 쓸 자리 — 업무툴처럼 화면 자리가 #view 가 아닐 때도 맞게
export async function rankPage(kind, root) {
  const { api, esc } = D
  if (root) ROOTS[kind] = root
  const v = root || ROOTS[kind] || document.querySelector('#view .page-root'), st = RS[kind], isPlace = kind === 'place', p = pref(kind)
  const qs = new URLSearchParams({ kind, q: st.q, sfl: st.sfl, group: st.group, rank: st.rank, sort: st.sort, dir: st.dir, offset: st.offset, limit: st.rows })
  if (st.archived) qs.set('archived', '1'); if (st.alert) qs.set('alert', '1')
  const j = await api('/api/rank/targets?' + qs)
  if (!v.isConnected) return
  const b = j.buckets || {}, pages = Math.max(1, Math.ceil(j.total / st.rows)), page = Math.floor(st.offset / st.rows) + 1
  const BK = [['1-3', '1~3위', b.r1_3, 'c-blue'], ['1-5', '1~5위', b.r1_5, 'c-red'], ['1-10', '1~10위', b.r1_10, 'c-red'], ['1-20', '1~20위', b.r1_20, 'c-red'], ['6-20', '6~20위', b.r6_20, 'c-green'], ['21-50', '21~50위', b.r21_50, 'c-green'], ['51-100', '51~100위', b.r51_100, ''], ['101-200', '101~200위', b.r101_200, ''], ['201-300', '201~300위', b.r201_300, ''], ['out', '순위밖', b.out, '']]
  const SORTS = isPlace ? [['keyword', '검색 키워드'], ['url', 'URL주소'], ['name', '업체명'], ['rank', '순위'], ['volume', '월검색량']] : [['keyword', '검색 키워드'], ['url', '상품링크'], ['rank', '순위']]
  const SFL = isPlace ? [['all', '전체'], ['url', '업체명 또는 URL'], ['keyword', '키워드'], ['name', '플레이스명'], ['memo', '메모']] : [['all', '전체'], ['url', '상품 또는 URL'], ['keyword', '키워드'], ['name', '상품명'], ['memo', '메모·판매처']]
  const chip = (k, l, on, cls = '') => `<button type="button" class="adl-chip ${on ? 'on' : ''} ${cls}" data-pref="${k}">${l}</button>`
  const pager = () => { const s = Math.max(1, Math.min(page - 2, pages - 4)), e = Math.min(pages, s + 4); let h = ''; for (let i = s; i <= e; i++) h += `<button class="pg ${i === page ? 'on' : ''}" data-pg="${i}">${i}</button>`; return `<div class="adl-pager">${page > 1 ? '<button class="pg" data-pg="1">«</button><button class="pg" data-pg="' + (page - 1) + '">‹</button>' : ''}${h}${page < pages ? '<button class="pg" data-pg="' + (page + 1) + '">›</button><button class="pg" data-pg="' + pages + '">»</button>' : ''}</div>` }
  const cr = j.crawl || {}
  const status = cr.running ? `오늘 수집 중 ${cr.done}/${cr.total}` : cr.block?.blocked ? `네이버가 잠시 막아서 쉬는 중 (${esc(cr.block.reason || '')})` : cr.due ? `오늘 수집 대기 ${cr.due}개 · 오후 1시 이후 자동` : '오늘 수집 완료'

  v.innerHTML = `<div class="adl ${p.cap ? 'cap' : ''}">
  <div class="adl-page-h"><h2>${isPlace ? '플레이스 순위 체크' : 'N 가격비교 순위 체크'}</h2><span class="adl-status ${cr.block?.blocked ? 'warn' : ''}">● ${status}</span></div>
  <div class="adl-guide"><details><summary>가이드</summary><ul>
    ${isPlace ? `<li>플레이스 URL은 <b>https://m.place.naver.com/~</b> 로 시작하는 전체 주소 또는 숫자 ID를 넣어 주세요. 업체명이 바뀌어도 순위체크가 돼요.</li>
    <li>네이버 모바일 플레이스 목록 화면과 같은 순서로, 300위까지 · 매일 오후 1시 이후 자동으로 체크해요 (2026-10-12 adlog 대조 99% 일치).</li>
    <li>점선 칸 = adlog 기록(자체 수집 전 날짜). 블 = 블로그 리뷰, 방 = 방문자 리뷰.</li>` : `<li>상품링크는 가격비교(카탈로그) 주소나 상품번호(nvMid)를 넣어 주세요.</li>
    <li>광고·슈퍼적립을 뺀 일반 노출 순위예요. 모바일 쇼핑 탭(키워드마다 30~70위)에서 먼저 찾고, 없으면 가격비교 검색에서 320위까지 더 찾아요. 그래도 없으면 "-"로 표시해요.</li>
    <li>쇼핑 검색 페이지는 자동 접속마다 보안문자가 떠서 우회하지 않아요 — adlog의 100위대 순위는 adlog 기록(점선)으로만 보여요.</li>`}</ul></details></div>

  <div class="adl-reg"><div class="adl-reg-h"><b>키워드 등록</b><span>순위를 추적할 ${isPlace ? '키워드와 플레이스 URL' : '검색 키워드와 상품링크'}을 등록하세요</span></div>
    <form class="adl-reg-b" id="regForm">
      <label><span>그룹 선택</span><select name="group">${['기본', ...j.groups.filter(g => g !== '기본')].map(g => `<option ${st.group === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></label>
      <label class="grow"><span>검색 키워드</span><div class="adl-in"><input name="keyword" required placeholder="${isPlace ? '예: 강남 맛집, 홍대 카페' : '검색 키워드'}"></div></label>
      <label class="grow2"><span>${isPlace ? '플레이스 URL' : '상품링크'}</span><div class="adl-in"><input name="url" required placeholder="${isPlace ? 'https://m.place.naver.com/place/12345678' : '상품링크 또는 상품번호'}"></div></label>
      <button class="adl-btn dark big">등록</button></form></div>

  ${isPlace ? `<div class="adl-buckets">${BK.map(([k, l, n, c]) => `<button class="adl-bk ${st.rank === k ? 'on' : ''}" data-r="${k}"><span>${l}</span><b class="${c}">${fmt(n || 0)}개</b></button>`).join('')}</div>` : ''}
  ${st.alert ? alertPanel(j.alerts || [], kind) : ''}

  <div class="adl-panel">
    <div class="adl-row"><span>${st.archived ? '삭제한 키워드' : st.alert ? '알림 받는 키워드' : '전체'} <b class="c-green">${fmt(j.total)}</b>건</span>
      <select id="grp"><option value="">전체 그룹</option>${j.groups.map(g => `<option ${st.group === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
      ${st.rank ? `<button class="adl-chip on" data-r="">구간: ${esc(st.rank)} ✕</button>` : ''}</div>
    <div class="adl-row wrap">
      <span class="lbl">보기</span><div class="adl-seg">${[['basic', '기본형'], ['card', '카드형'], ['list', '리스트형'], ['chart', '차트형']].map(([k, l]) => `<button type="button" data-view="${k}" class="${p.view === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${isPlace ? `<span class="sep"></span><span class="lbl">순위</span><div class="adl-seg">${[[0, '기본'], [1, '백분율']].map(([k, l]) => `<button type="button" data-pct="${k}" class="${(p.pct ? 1 : 0) === k ? 'on' : ''}" title="${k ? '전체 업체 중 상위 몇 %인지 같이 보여요' : '순위만'}">${l}</button>`).join('')}</div>` : ''}
      <span class="sep"></span><span class="lbl">출력</span>
      ${isPlace ? `${chip('review', '리뷰수', p.review, 'green')}${chip('vol', '월검색/업체수', p.vol, 'green')}<span class="sep"></span>${chip('blog', '블', p.blog, 'blue')}${chip('visit', '방', p.visit, 'blue')}${chip('mon', '월', p.mon, 'blue')}${chip('comp', '업', p.comp, 'blue')}` : chip('review', '리뷰수', p.review, 'green')}
      <span class="sep"></span>${chip('cap', '캡쳐모드', p.cap)}${chip('wm', '워터마크', p.wm)}
    </div>
  </div>

  <div class="adl-actions">
    <div class="adl-btns">
      <button class="adl-btn light" data-act="all">전체목록</button>
      <button class="adl-btn green" data-act="gadd">그룹추가</button>
      <button class="adl-btn dark" data-act="gchg">그룹변경</button>
      <button class="adl-btn outline" data-act="memo">선택 메모</button>
      <button class="adl-btn dgreen" data-act="down">전체다운</button>
      <button class="adl-btn green" data-act="bulk">대량등록</button>
      <button class="adl-btn dark" data-act="recheck">선택 재검색요청</button>
      <button class="adl-btn teal" data-act="order">순서 변경</button>
      <button class="adl-btn yellow" data-act="alerts">알림 목록</button>
      <button class="adl-btn red" data-act="del">선택삭제</button>
      <button class="adl-btn light" data-act="trash">${st.archived ? '← 목록으로' : '삭제 키워드'}</button>
      ${pager()}
    </div>
    <form class="adl-search" id="sf"><select name="sfl">${SFL.map(([k, l]) => `<option value="${k}" ${st.sfl === k ? 'selected' : ''}>${l}</option>`).join('')}</select><input name="q" value="${esc(st.q)}" placeholder="검색어를 입력해주세요"><button class="adl-btn outline">검색</button>
      <select id="rows">${[20, 50, 100].map(n => `<option value="${n}" ${st.rows === n ? 'selected' : ''}>${n}개</option>`).join('')}</select></form>
  </div>

  <div class="adl-sortbar"><label><input type="checkbox" id="all"> 전체선택</label><span>정렬:</span>${SORTS.map(([k, l]) => `<a data-sort="${k}" class="${st.sort === k ? 'on' : ''}">${l}<em data-dir="asc" class="${st.sort === k && st.dir !== 'desc' ? 'on' : ''}">↑</em><em data-dir="desc" class="${st.sort === k && st.dir === 'desc' ? 'on' : ''}">↓</em></a>`).join('<i>|</i>')}${st.sort !== 'custom' ? '<a data-sort="custom">기본 순서</a>' : ''}</div>

  <div class="adl-body ${p.wm ? 'wm' : ''}">${j.rows.length ? (p.view === 'card' ? cardView(j.rows, kind) : p.view === 'list' ? listView(j.rows, kind, st) : p.view === 'chart' ? chartView(j.rows, kind) : basicView(j.rows, kind, p, st, j.total)) : `<div class="adl-empty">${st.archived ? '삭제한 키워드가 없어요' : '등록된 키워드가 없어요'}</div>`}</div>
  <div class="adl-actions bottom"><div class="adl-btns">${pager()}</div></div>
  </div>`
  bind(v, kind, j)
}

// 알림 목록 위 요약 — 알림 켠 키워드 전체의 어제 대비 오르내림 (adlog 문자/텔레그램 알림 대신 업무툴 안에서 보기)
function alertPanel(list, kind) {
  const { esc } = D
  if (!list.length) return `<div class="adl-panel"><div class="adl-row"><b>알림 받는 키워드가 아직 없어요</b><span class="sub">키워드 오른쪽 [알림받기]를 누르면 여기 모여서 매일 순위 변동을 보여 줘요.</span></div></div>`
  const ch = (t) => t.last_rank && t.prev_rank ? t.prev_rank - t.last_rank : 0
  const up = list.filter(t => ch(t) > 0), down = list.filter(t => ch(t) < 0), out = list.filter(t => t.last_rank === 0)
  const moved = [...list].filter(t => ch(t) || (t.last_rank === 0 && t.prev_rank)).sort((a, b) => Math.abs(ch(b)) - Math.abs(ch(a))).slice(0, 12)
  const r = (n) => n == null || n === 0 ? '-' : n + '위'
  return `<div class="adl-panel"><div class="adl-row wrap"><b>알림 받는 키워드 ${list.length}개</b><span>오늘 <b class="c-red">상승 ${up.length}</b> · <b class="c-blue">하락 ${down.length}</b> · 순위밖 ${out.length} · 그대로 ${list.length - up.length - down.length - out.length}</span></div>
    ${moved.length ? `<div class="adl-row wrap" style="gap:6px 14px">${moved.map(t => { const d = ch(t); return `<span><a class="kw" data-prev="${t.id}">${esc(t.keyword)}</a> <span class="mute">${esc(t.name || '')}</span> ${r(t.prev_rank)} → <b>${r(t.last_rank)}</b> ${d ? `<em class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</em>` : ''}</span>` }).join('')}</div>` : '<div class="adl-row"><span class="sub">어제와 순위가 같아요</span></div>'}</div>`
}

function basicView(rows, kind, p, st, total) {
  const { esc } = D, isPlace = kind === 'place'
  return `<div class="adl-tbl-wrap"><table class="adl-tbl"><thead>
    <tr><th rowspan="2" class="w-no">No</th><th rowspan="2" class="w-grp">그룹</th><th class="w-kw">검색 키워드</th><th class="w-url"><span class="fl">${isPlace ? '플레이스 URL주소' : '상품정보'}</span><span class="fr">${isPlace ? '플레이스 업체명' : ''}</span></th><th class="w-vol">${isPlace ? '월 검색량' : '월 검색량 / 상품수'}</th><th class="w-reg">등록일</th><th rowspan="2" class="w-mng">관리</th></tr>
    <tr><th colspan="2">순위</th><th>메모</th><th>체크시간</th></tr></thead>
    ${rows.map((t, i) => {
      const days = byDay(t.history), open = st.open?.has(t.id), shown = open ? days : days.slice(0, 6)
      const status = /^unsupported/.test(t.last_status || '') ? `<div class="adl-warn">확인 불가 — ${esc(t.last_status.replace(/^unsupported: /, ''))}</div>` : /^(error|blocked)/.test(t.last_status || '') ? '<div class="adl-warn red">마지막 체크 실패 — 재검색요청을 눌러 보세요</div>' : ''
      const no = st.archived ? '' : total - st.offset - i
      return `<tbody class="adl-item" data-id="${t.id}">
      <tr><td rowspan="2" class="c"><input type="checkbox" class="sel" value="${t.id}"><br>${no}</td><td rowspan="2" class="c cap-blur">${esc(t.group_name || '기본')}</td>
        <td><a class="kw" href="${mUrl(t.keyword, kind)}" target="_blank" rel="noopener">${esc(t.keyword)}</a> <a class="mp" href="${mUrl(t.keyword, kind)}" target="_blank" rel="noopener" title="모바일 검색">ⓜ</a><a class="mp" href="${pUrl(t.keyword, kind)}" target="_blank" rel="noopener" title="PC 검색">ⓟ</a>${t.alert ? ' <span class="adl-tag">알림</span>' : ''}</td>
        <td class="cap-blur">${isPlace ? `<span class="url">${esc(targetUrl(t))}</span><span class="fr"><a href="${esc(targetUrl(t))}" target="_blank" rel="noopener">${esc(t.name || '')}</a><span class="id">(${esc(t.ref_id)})</span></span>` : `<div>상품정보 : ${esc(t.ref_id)}</div><a href="${esc(targetUrl(t))}" target="_blank" rel="noopener">${esc(t.name || '')}</a>`}</td>
        <td class="c vol">${t.search_volume != null ? `<b class="c-green">월 ${vol(t.search_volume)}건</b>` : '<span class="mute">월 -</span>'} ${isPlace ? (days[0]?.total != null ? `<span class="mute">업체 ${fmt(days[0].total)}개</span>` : '') : (t.item_count != null ? `<span class="mute">${fmt(t.item_count)}개</span>` : '')}${isPlace && t.rep_keywords ? `<div class="rep cap-blur">[ ${esc(t.rep_keywords)} ]</div>` : ''}</td>
        <td class="c num">${esc(String(t.created_at || '').slice(0, 10))}</td>
        <td rowspan="2" class="mng">${mngBtns(t)}</td></tr>
      <tr class="tr2"><td colspan="2">${status}<div class="adl-days">${shown.map(h => dayCell(t, h, p)).join('') || '<span class="mute">아직 체크 전이에요</span>'}</div>${days.length > 6 ? `<button class="adl-more" data-more="${t.id}">${open ? '접기' : '더보기'}</button>` : ''}</td>
        <td class="memo cap-blur">${esc(t.memo || '')}${t.contract_end ? `<div class="mute">기간 ${esc(t.contract_start || '')} ~ ${esc(t.contract_end)}</div>` : ''}</td>
        <td class="c num">${t.last_checked_at ? esc(t.last_checked_at.slice(0, 10)) + '<br>' + esc(t.last_checked_at.slice(11, 19)) : '-'}</td></tr></tbody>` }).join('')}
  </table></div>`
}
function mngBtns(t) {
  if (RS[t.kind].archived) return `<button class="adl-btn green sm" data-restore="${t.id}">복구</button>`
  return `<div class="adl-mng"><button class="adl-btn outline sm" data-memo="${t.id}">${t.kind === 'place' ? '메모/알림' : '메모'}</button><button class="adl-btn dark sm" data-recheck="${t.id}">재검색요청</button>
  <button class="adl-btn indigo sm" data-report="${t.id}">브랜딩 보고서</button><button class="adl-btn olive sm" data-cmp="${t.id}">순위 비교분석</button>
  <button class="adl-btn pink sm" data-prev="${t.id}">이전 순위</button><button class="adl-btn dgreen sm" data-down="${t.id}">다운</button>
  <button class="adl-btn ${t.alert ? 'blue' : 'outline'} sm" data-alert="${t.id}" title="켜면 매일 1번 이 키워드 순위를 알림으로 받아요">${t.alert ? '알림 켜짐' : '알림받기'}</button></div>`
}
function cardView(rows, kind) {
  const { esc } = D
  return `<div class="adl-cards">${rows.map(t => { const d = byDay(t.history), h = d[0] || {}, y = d[1] || {}
    const ch = h.rank && y.rank ? y.rank - h.rank : 0
    return `<div class="adl-card" data-id="${t.id}"><label class="ck"><input type="checkbox" class="sel" value="${t.id}"></label>
      <div class="k">${esc(t.keyword)}</div><div class="n cap-blur">${esc(t.name || t.ref_id)}</div>
      <div class="r"><b>${h.rank == null ? '-' : h.rank === 0 ? '밖' : h.rank}</b><span>위</span>${ch ? `<em class="${ch > 0 ? 'up' : 'down'}">${ch > 0 ? '▲' : '▼'}${Math.abs(ch)}</em>` : ''}</div>
      ${spark(d.slice(0, 14).reverse(), 220, 44)}
      <div class="m cap-blur">${esc(t.group_name || '기본')} · ${esc(t.memo || '')}</div>
      <div class="b"><button class="adl-btn outline sm" data-prev="${t.id}">이전 순위</button><button class="adl-btn indigo sm" data-report="${t.id}">보고서</button></div></div>` }).join('')}</div>`
}
function listView(rows, kind, st) {
  const { esc } = D
  return `<div class="adl-tbl-wrap"><table class="adl-tbl list"><thead><tr><th></th><th>그룹</th><th>검색 키워드</th><th>${kind === 'place' ? '업체명' : '상품명'}</th><th>오늘</th><th>어제</th><th>변동</th><th>월 검색량</th><th>메모</th><th>체크시간</th></tr></thead><tbody>
  ${rows.map(t => { const d = byDay(t.history), h = d[0] || {}, y = d[1] || {}, ch = h.rank && y.rank ? y.rank - h.rank : 0
    return `<tr class="adl-item" data-id="${t.id}"><td><input type="checkbox" class="sel" value="${t.id}"></td><td class="cap-blur">${esc(t.group_name || '기본')}</td><td><a class="kw" data-prev="${t.id}">${esc(t.keyword)}</a></td><td class="cap-blur ellip">${esc(t.name || '')}</td>
      <td class="c"><b>${rankTxt(h, kind)}</b></td><td class="c mute">${rankTxt(y, kind)}</td><td class="c">${ch ? `<em class="${ch > 0 ? 'up' : 'down'}">${ch > 0 ? '▲' : '▼'}${Math.abs(ch)}</em>` : '-'}</td>
      <td class="c">${vol(t.search_volume)}</td><td class="cap-blur ellip">${esc(t.memo || '')}</td><td class="c num mute">${esc(String(t.last_checked_at || '').slice(5, 16))}</td></tr>` }).join('')}</tbody></table></div>`
}
function chartView(rows, kind) {
  const { esc } = D
  return `<div class="adl-cards chart">${rows.map(t => { const d = byDay(t.history).slice(0, 31).reverse(), h = d[d.length - 1] || {}
    return `<div class="adl-card wide" data-id="${t.id}"><label class="ck"><input type="checkbox" class="sel" value="${t.id}"></label><div class="k">${esc(t.keyword)} <span class="r-inline">${rankTxt(h, kind)}</span></div><div class="n cap-blur">${esc(t.name || t.ref_id)}</div>${lineChart([{ pts: d.map(x => ({ x: x.day, y: x.rank || null })), color: '#3182F6' }], { w: 520, h: 150, invert: true })}</div>` }).join('')}</div>`
}

// ---------------- 그림 ----------------
function spark(days, W = 120, H = 30) {
  const v = days.map(x => x.rank).filter(r => r > 0); if (v.length < 2) return `<div class="spark-empty" style="height:${H}px"></div>`
  const mn = Math.min(...v), mx = Math.max(...v)
  const pts = days.map((x, i) => x.rank > 0 ? `${(i / Math.max(1, days.length - 1)) * (W - 8) + 4},${4 + ((x.rank - mn) / ((mx - mn) || 1)) * (H - 8)}` : null).filter(Boolean)
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none"><polyline fill="none" stroke="#3182F6" stroke-width="2" vector-effect="non-scaling-stroke" points="${pts.join(' ')}"/></svg>`
}
// 여러 선 그래프 (순위는 위가 1위 → invert)
function lineChart(series, { w = 820, h = 220, invert = false, unit = '' } = {}) {
  const xs = [...new Set(series.flatMap(s => s.pts.map(p => p.x)))].sort()
  const vals = series.flatMap(s => s.pts.map(p => p.y)).filter(y => y != null)
  if (!vals.length || !xs.length) return '<div class="adl-empty sm">그래프로 보여 줄 기록이 아직 없어요</div>'
  let mn = Math.min(...vals), mx = Math.max(...vals); if (mn === mx) { mn = Math.max(invert ? 1 : 0, mn - 2); mx = mx + 2 }   // 순위 축에 0위가 찍히지 않게
  const pad = { l: 40, r: 16, t: 14, b: 26 }, X = (i) => pad.l + (xs.length === 1 ? (w - pad.l - pad.r) / 2 : i * (w - pad.l - pad.r) / (xs.length - 1))
  const Y = (y) => { const f = (y - mn) / (mx - mn || 1); return invert ? pad.t + f * (h - pad.t - pad.b) : h - pad.b - f * (h - pad.t - pad.b) }
  const ticks = [...new Set([0, .25, .5, .75, 1].map(f => Math.round(mn + f * (mx - mn))))]
  const step = Math.max(1, Math.ceil(xs.length / 10))
  return `<svg class="adl-chart" viewBox="0 0 ${w} ${h}" width="100%">
    ${ticks.map(t => `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(t)}" y2="${Y(t)}" class="grid"/><text x="${pad.l - 6}" y="${Y(t) + 4}" text-anchor="end" class="ax">${t}${unit}</text>`).join('')}
    ${xs.map((x, i) => i % step === 0 || i === xs.length - 1 ? `<text x="${X(i)}" y="${h - 6}" text-anchor="middle" class="ax">${x.slice(5)}</text>` : '').join('')}
    ${series.map(s => { const pts = s.pts.map(p => p.y == null ? null : [X(xs.indexOf(p.x)), Y(p.y), p.y]).filter(Boolean)
      return `<polyline fill="none" stroke="${s.color}" stroke-width="2.2" ${s.dash ? 'stroke-dasharray="5 4"' : ''} points="${pts.map(p => p[0] + ',' + p[1]).join(' ')}"/>${pts.map(p => `<g><rect x="${p[0] - (String(p[2]).length * 3.6 + 5)}" y="${p[1] - 9}" width="${String(p[2]).length * 7.2 + 10}" height="16" rx="3" fill="${s.color}"/><text x="${p[0]}" y="${p[1] + 3}" text-anchor="middle" class="lbl">${p[2]}</text></g>`).join('')}` }).join('')}
  </svg>`
}

// ---------------- 이벤트 ----------------
function bind(v, kind, j) {
  const { api, toast, modal, closeModal, confirmBox, esc } = D, st = RS[kind], $ = (s) => v.querySelector(s), $$ = (s) => [...v.querySelectorAll(s)]
  const again = () => rankPage(kind)
  const sel = () => $$('.sel:checked').map(x => +x.value)
  const row = (id) => j.rows.find(r => r.id === id)
  $('#regForm').onsubmit = async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)), btn = e.target.querySelector('button')
    btn.disabled = true; btn.textContent = '확인 중…'
    try { const r = await api('/api/rank/targets', { kind, ...f }); if (!r.ok) throw new Error(r.error)
      if (r.dup) toast('이미 등록된 키워드예요'); else { toast('등록했어요 — 바로 순위를 확인할게요'); await api('/api/rank/targets/check', { ids: [r.id] }) }
      st.offset = 0; again() } catch (err) { toast('' + err.message); btn.disabled = false; btn.textContent = '등록' }
  }
  $$('[data-r]').forEach(x => x.onclick = () => { st.rank = st.rank === x.dataset.r ? '' : x.dataset.r; st.offset = 0; again() })
  $('#grp').onchange = (e) => { st.group = e.target.value; st.offset = 0; again() }
  $$('[data-view]').forEach(x => x.onclick = () => { const p = pref(kind); p.view = x.dataset.view; setPref(kind, p); again() })
  $$('[data-pct]').forEach(x => x.onclick = () => { const p = pref(kind); p.pct = +x.dataset.pct; setPref(kind, p); again() })
  $$('[data-pref]').forEach(x => x.onclick = () => { const p = pref(kind), k = x.dataset.pref; p[k] = p[k] ? 0 : 1
    if (k === 'review' && p.review && kind === 'place' && !p.blog && !p.visit) { p.blog = 1; p.visit = 1 }
    if ((k === 'blog' || k === 'visit') && p[k]) p.review = 1
    if (k === 'vol' && p.vol && !p.mon && !p.comp) { p.mon = 1; p.comp = 1 }
    if ((k === 'mon' || k === 'comp') && p[k]) p.vol = 1
    setPref(kind, p); again() })
  $('#sf').onsubmit = (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); st.q = f.q.trim(); st.sfl = f.sfl; st.offset = 0; again() }
  $('#rows').onchange = (e) => { st.rows = +e.target.value; st.offset = 0; again() }
  $$('[data-pg]').forEach(x => x.onclick = () => { st.offset = (+x.dataset.pg - 1) * st.rows; again(); v.scrollIntoView?.({ block: 'start' }) })
  $$('[data-sort]').forEach(a => a.onclick = (e) => { const d = e.target.dataset.dir; const k = a.dataset.sort
    if (k === 'custom') { st.sort = 'custom'; st.dir = '' } else { st.dir = d || (st.sort === k && st.dir !== 'desc' ? 'desc' : 'asc'); st.sort = k } st.offset = 0; again() })
  $('#all').onchange = (e) => $$('.sel').forEach(x => x.checked = e.target.checked)
  $$('[data-more]').forEach(b => b.onclick = () => { st.open ||= new Set(); const id = +b.dataset.more; st.open.has(id) ? st.open.delete(id) : st.open.add(id); again() })

  const acts = {
    all: () => { Object.assign(st, { q: '', sfl: 'all', group: '', rank: '', sort: 'custom', dir: '', offset: 0, archived: false, alert: false }); again() },
    gadd: () => groupModal(kind, again),
    gchg: () => { const ids = sel(); if (!ids.length) return toast('그룹을 바꿀 키워드를 고르세요')
      modal(`<h3 class="mh">그룹 변경 · ${ids.length}개</h3><form id="gc" class="mf"><label class="field"><span>옮길 그룹</span><select name="group">${['기본', ...j.groups.filter(g => g !== '기본')].map(g => `<option>${esc(g)}</option>`).join('')}</select></label><button class="btn btn-primary">변경</button></form>`)
      document.querySelector('#gc').onsubmit = async (e) => { e.preventDefault(); try { await api('/api/rank/targets/group', { ids, group: new FormData(e.target).get('group') }); closeModal(); toast('그룹을 바꿨어요'); again() } catch (err) { toast('' + err.message) } } },
    memo: () => { const ids = sel(); if (!ids.length) return toast('메모를 넣을 키워드를 체크하세요')
      const one = ids.length === 1 ? row(ids[0]) : null
      modal(`<h3 class="mh">선택 메모 · ${ids.length}개</h3><form id="mf" class="mf"><div class="adl-seg wide" id="mmode"><button type="button" data-m="replace" class="on">바꾸기</button><button type="button" data-m="append">뒤에 덧붙이기</button><button type="button" data-m="clear">지우기</button></div>
        <p class="sub" id="mhint">고른 키워드의 메모를 모두 아래 내용으로 바꿔요.</p><textarea name="memo" rows="5" style="width:100%" placeholder="예: 10/16 세팅 완료 · 담당 김OO">${esc(one?.memo || '')}</textarea><div class="row" style="margin-top:10px"><button class="btn btn-primary">적용</button></div></form>`)
      let mode = 'replace'; const hint = { replace: '고른 키워드의 메모를 모두 아래 내용으로 바꿔요.', append: '기존 메모는 두고 다음 줄에 아래 내용을 덧붙여요.', clear: '고른 키워드의 메모를 모두 지워요.' }
      document.querySelectorAll('#mmode button').forEach(b => b.onclick = () => { mode = b.dataset.m; document.querySelectorAll('#mmode button').forEach(x => x.classList.toggle('on', x === b)); document.querySelector('#mhint').textContent = hint[mode]; document.querySelector('#mf textarea').disabled = mode === 'clear' })
      document.querySelector('#mf').onsubmit = async (e) => { e.preventDefault(); const memo = new FormData(e.target).get('memo') || ''
        if (mode === 'clear' && !await confirmBox(`${ids.length}개의 메모를 모두 지울까요?`, { ok: '지우기', danger: true })) return
        try { const r = await api('/api/rank/targets/memo', { ids, mode, memo }); closeModal(); toast(`메모를 ${r.n}개에 적용했어요`); again() } catch (err) { toast('' + err.message) } } },
    down: () => download(`/api/rank/export.csv?kind=${kind}`),
    bulk: () => { modal(`<h3 class="mh">대량등록</h3><p class="sub">한 줄에 하나씩: <b>키워드 ⇥ ${kind === 'place' ? '플레이스 URL' : '상품링크(nvMid)'} ⇥ 그룹 ⇥ 메모</b><br>엑셀에서 열을 그대로 복사해 붙이거나, 엑셀 파일을 골라 주세요 (최대 300줄, 없는 그룹은 새로 만들어져요).</p>
      <div class="row" style="gap:8px;margin:8px 0"><button type="button" class="adl-btn dgreen sm" id="bs">샘플 파일 다운</button><label class="adl-btn outline sm" style="cursor:pointer">엑셀 파일 선택<input type="file" id="bf" accept=".xlsx,.xls,.csv" hidden></label><span class="sub" id="bfn"></span></div><textarea id="bt" rows="10" style="width:100%" placeholder="${kind === 'place' ? '강남 맛집\thttps://m.place.naver.com/restaurant/1234567\t기본\t크래머리' : '두피쿨링 탈모샴푸\t91185658687\t기본\t포인트코퍼레이션'}"></textarea><div class="row" style="margin-top:10px"><button class="btn btn-primary" id="bg">등록</button></div><div id="bo" class="sub" style="margin-top:8px"></div>`)
      document.querySelector('#bs').onclick = () => {
        const rows = kind === 'place' ? [['검색 키워드', '플레이스 URL', '그룹', '메모'], ['강남 맛집', 'https://m.place.naver.com/restaurant/1234567/home', '기본', '크래머리']] : [['검색 키워드', '상품링크(nvMid)', '그룹', '메모'], ['두피쿨링 탈모샴푸', '91185658687', '기본', '포인트코퍼레이션']]
        const csv = '﻿' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\r\n')
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `대량등록-샘플-${kind === 'place' ? '플레이스' : '가격비교'}.csv`; a.click() }
      document.querySelector('#bf').onchange = async (e) => {
        const f = e.target.files[0]; if (!f) return
        try { await loadXLSX(); const wb = window.XLSX.read(await f.arrayBuffer()); const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' })
          const lines = rows.map(r => r.slice(0, 4).map(c => String(c).replace(/[\t\r\n]+/g, ' ').trim())).filter(r => r[0] && r[1] && !/^검색\s*키워드$/.test(r[0]))
          document.querySelector('#bt').value = lines.map(r => r.join('\t')).join('\n'); document.querySelector('#bfn').textContent = `${f.name} · ${lines.length}줄 읽음 — 확인 후 [등록]` }
        catch (err) { toast('파일을 읽지 못했어요: ' + err.message) } }
      document.querySelector('#bg').onclick = async () => { try { const r = await api('/api/rank/targets/bulk', { kind, text: document.querySelector('#bt').value }); if (!r.ok) throw new Error(r.error); document.querySelector('#bo').innerHTML = `신규 ${r.added} · 중복 ${r.dup} · 실패 ${r.failed.length}${r.failed.length ? '<br>' + r.failed.map(f => `${f.line}줄 ${esc(f.keyword || '')}: ${esc(f.error)}`).join('<br>') : ''}`; again() } catch (e) { document.querySelector('#bo').textContent = '' + e.message } } },
    recheck: () => recheck(sel()),
    order: () => orderModal(kind, j),
    alerts: () => { st.alert = !st.alert; st.archived = false; st.offset = 0; again() },
    del: async () => { const ids = sel(); if (!ids.length) return toast('삭제할 키워드를 고르세요')
      if (!await confirmBox(`${ids.length}개를 삭제할까요?\n순위 이력은 남고, '삭제 키워드'에서 다시 복구할 수 있어요.`, { ok: '삭제', danger: true })) return
      try { await api('/api/rank/targets/delete', { ids }); toast('삭제했어요'); again() } catch (e) { toast('' + e.message) } },
    trash: () => { st.archived = !st.archived; st.alert = false; st.offset = 0; again() },
  }
  // 버튼이 조용히 실패하지 않게 — 오류는 알림으로
  $$('[data-act]').forEach(b => b.onclick = async () => { try { await acts[b.dataset.act]() } catch (e) { toast('' + e.message) } })
  async function recheck(ids) {
    if (!ids.length) return toast('재검색할 키워드를 고르세요'); if (ids.length > 20) return toast('한 번에 20개까지 바로 재검색해요')
    toast(`${ids.length}개 재검색 중…`, 30000)
    try { const r = await api('/api/rank/targets/check', { ids }); const ok = r.results.filter(x => x.ok).length; toast(`재검색 완료: 성공 ${ok}${ok < ids.length ? ` · 실패 ${ids.length - ok}` : ''}`); again() } catch (e) { toast('' + e.message) }
  }
  $$('[data-recheck]').forEach(b => b.onclick = () => recheck([+b.dataset.recheck]))
  $$('[data-memo]').forEach(b => b.onclick = () => memoModal(row(+b.dataset.memo), again))
  const safe = (p) => p.catch(e => toast('' + e.message))
  $$('[data-report]').forEach(b => b.onclick = () => safe(reportModal(+b.dataset.report)))
  $$('[data-cmp]').forEach(b => b.onclick = () => safe(compareModal(+b.dataset.cmp)))
  $$('[data-prev]').forEach(b => b.onclick = (e) => { e.preventDefault(); safe(prevModal(+b.dataset.prev)) })
  $$('[data-down]').forEach(b => b.onclick = () => download(`/api/rank/export.csv?id=${b.dataset.down}`))
  $$('[data-alert]').forEach(b => b.onclick = async () => { const t = row(+b.dataset.alert); try { await api('/api/rank/targets/update', { id: t.id, alert: !t.alert }); toast(t.alert ? '알림을 껐어요' : '알림을 켰어요 — [알림 목록]에서 매일 순위 변동을 볼 수 있어요'); again() } catch (e) { toast('' + e.message) } })
  $$('[data-restore]').forEach(b => b.onclick = async () => { await api('/api/rank/targets/restore', { ids: [+b.dataset.restore] }); toast('복구했어요'); again() })
}

function download(path) {
  if (D.DEMO) return D.toast('데모에서는 내려받기를 막아 두었어요')
  const a = document.createElement('a'); a.href = path; a.download = ''; document.body.appendChild(a); a.click(); a.remove()
}

// ---------------- 메모 / 알림 / 기간강조 (adlog '메모 및 문자알림') ----------------
function memoModal(t, after) {
  const { api, modal, closeModal, toast, esc } = D
  let color = t.hl_color || '', alert = !!t.alert
  modal(`<div class="adl-modal"><h3 class="mh">메모 및 알림 <small>${esc(t.keyword)}</small></h3>
    <div class="fld"><b>알림 방식 선택</b><div class="adl-seg wide" id="am"><button type="button" data-a="0" class="${alert ? '' : 'on'}">알림 끔</button><button type="button" data-a="1" class="${alert ? 'on' : ''}">사내 알림 (매일 1회 순위)</button></div>
      <p class="sub">켜면 위쪽 [알림 목록]에 모아서, 매일 수집이 끝나면 어제보다 오르고 내린 순위를 한눈에 보여 줘요. 순위가 크게 떨어지면 담당 영업에게도 따로 알려요.</p></div>
    <div class="fld"><b>기간 설정</b> <span class="sub">(기간강조에만 쓰여요 · 계약 기간을 넣어 두면 종료 3일 전 알림도 가요)</span>
      <div class="row"><input type="date" id="cs" value="${esc(t.contract_start || '')}"><span>~</span><input type="date" id="ce" value="${esc(t.contract_end || '')}"></div><p class="sub" id="cn"></p></div>
    <div class="fld"><b>기간강조</b> <span class="sub">(위 기간 안의 순위 칸에 색을 칠해요)</span><div class="adl-pal">${['', ...HL].map(c => `<button type="button" data-c="${c}" class="${c === color ? 'on' : ''}" style="${c ? 'background:' + (HL.indexOf(c) >= 9 ? c : 'transparent') + ';border-color:' + c : ''}">${c ? '' : '✕'}</button>`).join('')}</div></div>
    <div class="fld"><b>메모</b><textarea id="mm" rows="6">${esc(t.memo || '')}</textarea></div>
    <div class="row c"><button class="adl-btn dark" id="ms">저장</button><button class="adl-btn outline" id="mc">내용지우기</button></div></div>`)
  const q = (s) => document.querySelector(s)
  const cnt = () => { const a = q('#cs').value, b = q('#ce').value; q('#cn').textContent = a && b ? `총 ${Math.round((new Date(b) - new Date(a)) / 864e5) + 1}일` : '총 0일, 기간강조가 설정됩니다' }
  cnt(); q('#cs').onchange = cnt; q('#ce').onchange = cnt
  document.querySelectorAll('#am button').forEach(b => b.onclick = () => { alert = b.dataset.a === '1'; document.querySelectorAll('#am button').forEach(x => x.classList.toggle('on', x === b)) })
  document.querySelectorAll('.adl-pal button').forEach(b => b.onclick = () => { color = b.dataset.c; document.querySelectorAll('.adl-pal button').forEach(x => x.classList.toggle('on', x === b)) })
  q('#mc').onclick = () => { q('#mm').value = '' }
  q('#ms').onclick = async () => {
    if (q('#cs').value && q('#ce').value && q('#cs').value > q('#ce').value) return toast('시작일이 종료일보다 늦어요')
    try { await api('/api/rank/targets/update', { id: t.id, memo: q('#mm').value.trim(), contractStart: q('#cs').value, contractEnd: q('#ce').value, hlColor: color, alert }); closeModal(); toast('저장했어요'); after() } catch (e) { toast('' + e.message) }
  }
}

// ---------------- 이전 순위 ----------------
export async function prevModal(id) {
  const { api, modal, esc } = D
  const j = await api('/api/rank/targets/history?id=' + id), t = j.target, place = t.kind === 'place'
  const days = byDay(j.history)
  const delta = (a, b, inv) => { if (a == null || b == null || a === b) return '<span class="mute">-</span>'; const d = a - b; const up = inv ? d < 0 : d > 0; return `<span class="${up ? 'up' : 'down'}">${inv ? (d < 0 ? '▲' : '▼') + Math.abs(d) : (d > 0 ? '+' : '') + d}</span>` }
  const adlogDays = new Set(j.history.filter(h => h.source === 'adlog').map(h => h.day)), deskDays = new Set(j.history.filter(h => h.source === 'desk').map(h => h.day))
  modal(`<div class="adl-modal wide"><h3 class="mh"><a href="${mUrl(t.keyword, t.kind)}" target="_blank" rel="noopener">${esc(t.keyword)}</a> &gt; ${esc(t.name || t.ref_id)}</h3>
    ${lineChart([{ pts: days.filter(x => x.source === 'desk').map(x => ({ x: x.day, y: x.rank || null })), color: '#3182F6' }, { pts: j.history.filter(x => x.source === 'adlog').map(x => ({ x: x.day, y: x.rank || null })), color: '#ADB5BD', dash: true }], { invert: true, h: 200 })}
    <p class="sub">파란선 = 자체 수집 · 회색 점선 = adlog 기록 (${adlogDays.size}일)${deskDays.size && adlogDays.size ? ' · 같은 날 둘 다 있으면 자체 수집을 보여요' : ''}</p>
    <div class="adl-tbl-wrap"><table class="adl-tbl list"><thead><tr><th>날짜</th><th>순위</th>${place ? '<th>방문자리뷰</th><th>블로그리뷰</th><th>업체수</th>' : '<th>리뷰</th><th>찜</th><th>구매</th><th>별점</th>'}<th>출처</th></tr></thead><tbody>
    ${days.map((h, i) => { const p = days[i + 1] || {}
      return `<tr><td class="c num">${dayLbl(h.day)}</td><td class="c"><b>${rankTxt(h, t.kind)}</b> ${h.rank && p.rank ? delta(h.rank, p.rank, true) : ''}</td>
      ${place ? `<td class="r num">${fmt(h.visitor_reviews)} ${delta(h.visitor_reviews, p.visitor_reviews)}</td><td class="r num">${fmt(h.blog_reviews)} ${delta(h.blog_reviews, p.blog_reviews)}</td><td class="r num">${fmt(h.total)}</td>`
        : `<td class="r num">${fmt(h.review_count)} ${delta(h.review_count, p.review_count)}</td><td class="r num">${fmt(h.keep_count)}</td><td class="r num">${fmt(h.purchase_count)}</td><td class="r num">${h.score ?? '-'}</td>`}
      <td class="c mute">${h.source === 'desk' ? '자체' : 'adlog'}</td></tr>` }).join('') || `<tr><td colspan="7" class="c mute">기록이 없어요</td></tr>`}</tbody></table></div></div>`)
}

// ---------------- 순위 비교분석 ----------------
async function compareModal(id, day = '', base = '') {
  const { api, modal, esc } = D
  const j = await api(`/api/rank/targets/compare?id=${id}&day=${day}&base=${base}`), t = j.target, place = t.kind === 'place'
  // 네이버 목록 응답의 블로그 리뷰 수가 비어(0) 오는 경우가 있어, 전부 0이면 칸을 숨긴다 (우리 업체 블로그 리뷰는 상세에서 따로 수집)
  const blogOk = (j.items || []).some(x => x.b > 0)
  const head = `<h3 class="mh">[${esc(j.day || '-')}] 『${esc(t.keyword)}』 <small>${place ? '플레이스' : '가격비교'} 순위 비교분석</small></h3>`
  if (!j.items?.length) return modal(`<div class="adl-modal">${head}<div class="adl-empty">${D.mascot('think', 52)}<div>아직 비교할 노출 목록이 없어요.<br>오늘 수집부터 키워드별 ${place ? '300위' : '쇼핑 탭'} 목록을 날마다 저장해요 — 내일부터 전날과 비교할 수 있어요.</div></div></div>`)
  const opt = (sel, list) => list.map(d => `<option ${d === sel ? 'selected' : ''}>${d}</option>`).join('')
  const ch = (x) => x.pr == null ? '<span class="new">NEW</span>' : x.pr === x.r ? '<span class="mute">-</span>' : x.pr > x.r ? `<span class="up">▲${x.pr - x.r}</span>` : `<span class="down">▼${x.r - x.pr}</span>`
  const dl = (n) => n ? `<div class="${n > 0 ? 'down-s' : 'up-s'}">${n > 0 ? '+' : ''}${n}</div>` : ''
  modal(`<div class="adl-modal wide">${head}
    <div class="row adl-cmp-bar"><label>출력일 <select id="cd">${opt(j.day, j.days)}</select></label><label>비교일 <select id="cb"><option value="">없음</option>${opt(j.baseDay, j.days.filter(d => d < j.day))}</select></label>
      <span class="sub">갱신시간 : ${esc(j.checkedAt || '')}</span><span class="sp"></span><button class="adl-btn outline sm" id="cm">내 순위로</button></div>
    <div class="adl-tbl-wrap tall"><table class="adl-tbl list cmp"><thead><tr><th>순위</th><th>변동</th><th>${place ? '업체명 / 카테고리' : '상품명 / 판매처'}</th>${place ? `<th>방문자리뷰</th>${blogOk ? '<th>블로그리뷰</th>' : ''}` : '<th>리뷰</th><th>찜</th><th>구매</th><th>별점</th><th>가격</th>'}</tr></thead><tbody>
    ${j.items.map(x => `<tr class="${x.mine ? 'mine' : ''}"><td class="c"><b>${x.r}</b></td><td class="c">${j.baseDay ? ch(x) : ''}</td>
      <td><a href="${place ? 'https://m.place.naver.com/place/' + esc(x.id) + '/home' : 'https://search.shopping.naver.com/catalog/' + esc(x.id)}" target="_blank" rel="noopener">${esc(x.n)}</a> ${x.mine ? '<span class="adl-tag blue">우리</span>' : ''}<div class="mute">${esc(x.c || '')} · ${esc(x.id)}</div></td>
      ${place ? `<td class="r num">${fmt(x.v)}${dl(x.dv)}</td>${blogOk ? `<td class="r num">${fmt(x.b)}${dl(x.db)}</td>` : ''}` : `<td class="r num">${fmt(x.rv)}${dl(x.drv)}</td><td class="r num">${fmt(x.k)}</td><td class="r num">${fmt(x.p)}</td><td class="r num">${x.s ?? '-'}</td><td class="r num">${x.pr ? fmt(x.pr) + '원' : '-'}</td>`}</tr>`).join('')}
    </tbody></table></div><p class="sub">${place ? '네이버 모바일 플레이스 목록(최대 300위) 그대로예요. 리뷰 증감은 비교일 대비.' : '광고 제외 일반 노출만, 모바일 쇼핑 탭이 보여 준 깊이까지예요.'}</p></div>`)
  const q = (s) => document.querySelector(s)
  q('#cd').onchange = () => compareModal(id, q('#cd').value, '')
  q('#cb').onchange = () => compareModal(id, q('#cd').value, q('#cb').value)
  q('#cm').onclick = () => document.querySelector('.cmp tr.mine')?.scrollIntoView({ block: 'center' })
  setTimeout(() => q('#cm')?.click(), 50)
}

// ---------------- 브랜딩 보고서 ----------------
async function reportModal(id, period = 'month') {
  const { api, modal, esc, toast, copyText } = D
  const j = await api('/api/rank/targets/history?id=' + id), t = j.target, place = t.kind === 'place'
  const all = byDay(j.history).reverse()
  const today = all.length ? all[all.length - 1].day : ''
  const from = period === 'month' ? today.slice(0, 8) + '01' : period === '7' ? addDays(today, -6) : addDays(today, -29)
  const days = all.filter(h => h.day >= from)
  modal(`<div class="adl-modal wide"><div class="row" style="justify-content:space-between"><button class="adl-btn green sm" id="rs">공유하기</button>
      <select id="rp">${[['month', '당월기준'], ['7', '최근 7일'], ['30', '최근 30일']].map(([k, l]) => `<option value="${k}" ${k === period ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="adl-report" id="rep"><div class="wmk">재흥광고기획</div>
      <h3>${place ? '플레이스' : 'N 가격비교'} 순위 체크 브랜딩 보고서</h3>
      <dl><dt>검색 키워드</dt><dd>${esc(t.keyword)}</dd><dt>${place ? '업체명/URL' : '상품명'}</dt><dd>${esc(t.name || t.ref_id)}</dd>
        ${t.search_volume != null ? `<dt>월 조회수</dt><dd>${vol(t.search_volume)}건</dd>` : ''}${place && all.length && all[all.length - 1].total != null ? `<dt>업체수</dt><dd>${fmt(all[all.length - 1].total)}개</dd>` : !place && t.item_count != null ? `<dt>업체수</dt><dd>${fmt(t.item_count)}개</dd>` : ''}
        ${place && t.rep_keywords ? `<dt>대표키워드</dt><dd>${esc(t.rep_keywords)}</dd>` : ''}</dl>
      <div class="adl-days rep">${days.slice().reverse().map(h => `<div class="adl-day"><span class="d">${dayLbl(h.day)}</span><b>${rankTxt(h, t.kind)}</b>${place ? `${h.blog_reviews != null ? `<i>블 ${fmt(h.blog_reviews)}개</i>` : ''}${h.visitor_reviews != null ? `<i>방 ${fmt(h.visitor_reviews)}개</i>` : ''}` : ''}</div>`).join('') || '<span class="mute">기간 안 기록이 없어요</span>'}</div>
      <div class="adl-rep-card"><b>${place ? '플레이스' : 'N 가격비교'} 순위 체크</b>${lineChart([{ pts: days.map(h => ({ x: h.day, y: h.rank || null })), color: '#1E88E5' }], { invert: true, h: 230 })}</div>
      ${place ? `<div class="adl-rep-card"><b>방문/블로그 리뷰 수</b> <span class="legend"><i style="background:#C62828"></i>방문자 리뷰 <i style="background:#3949AB"></i>블로그 리뷰</span>${lineChart([{ pts: days.map(h => ({ x: h.day, y: h.visitor_reviews })), color: '#C62828' }, { pts: days.map(h => ({ x: h.day, y: h.blog_reviews })), color: '#3949AB' }], { h: 230 })}</div>` : ''}
      <div class="row foot"><span>재흥광고기획</span><span>${esc(today)}</span></div></div>
    <div class="row" style="margin-top:10px"><button class="adl-btn indigo" id="ri1">브랜딩 보고서 이미지로 다운</button><button class="adl-btn indigo" id="ri2">브랜딩 보고서 이미지로 다운 (워터마크 X)</button></div></div>`)
  const q = (s) => document.querySelector(s)
  q('#rp').onchange = () => reportModal(id, q('#rp').value)
  q('#rs').onclick = async () => { try { const r = await api('/api/rank/share', { targetId: id }); const url = location.origin + '/r/' + r.token
    if (D.DEMO) { toast('데모라 링크 대신 미리보기만 돼요'); return }
    await copyText(url); toast('공유 링크를 복사했어요 (' + r.expires + '까지)') } catch (e) { toast('' + e.message) } }
  const shot = async (wm) => {
    if (D.DEMO) return toast('데모에서는 내려받기를 막아 두었어요')
    try { await loadH2C(); const el = q('#rep'); el.classList.toggle('nowm', !wm); const c = await window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff' }); el.classList.remove('nowm')
      const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = `보고서-${t.keyword}-${today}.png`; a.click() } catch (e) { toast('이미지 만들기 실패: ' + e.message) }
  }
  q('#ri1').onclick = () => shot(true); q('#ri2').onclick = () => shot(false)
}
function loadXLSX() {
  if (window.XLSX) return Promise.resolve()
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = res; s.onerror = () => rej(new Error('엑셀 읽기 도구를 불러오지 못했어요')); document.head.appendChild(s) })
}
function addDays(d, n) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
function loadH2C() {
  if (window.html2canvas) return Promise.resolve()
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'; s.onload = res; s.onerror = () => rej(new Error('불러오기 실패')); document.head.appendChild(s) })
}

// ---------------- 그룹 관리 (adlog 는 따로 메뉴지만, 여기선 순위 화면 안에서 바로) ----------------
async function groupModal(kind, after) {
  const { api, modal, toast, esc, confirmBox, askText } = D
  modal('<div class="adl-modal"><h3 class="mh">그룹 관리</h3><div class="adl-empty sm">불러오는 중…</div></div>')
  const draw = async () => {
    const { rows } = await api('/api/rank/groups?kind=' + kind)
    modal(`<div class="adl-modal"><h3 class="mh">그룹 관리 <small>키워드를 묶어 보는 이름이에요 (대행사·담당자별 등)</small></h3>
      <form id="gf" class="row" style="gap:8px;margin:6px 0 14px"><input name="name" required maxlength="40" placeholder="새 그룹 이름 (예: 크래머리 트래픽)" style="flex:1"><button class="adl-btn dark">추가</button></form>
      <div class="adl-tbl-wrap"><table class="adl-tbl list"><thead><tr><th>그룹</th><th>키워드</th><th></th></tr></thead><tbody>
      ${rows.map(g => `<tr><td>${esc(g.name)}</td><td class="c num">${fmt(g.n)}개</td><td class="c">${g.name === '기본' ? '<span class="mute">기본 그룹</span>' : `<button class="adl-btn outline sm" data-gren="${esc(g.name)}">이름 바꾸기</button> <button class="adl-btn red sm" data-gdel="${esc(g.name)}">삭제</button>`}</td></tr>`).join('')}
      </tbody></table></div><p class="sub">그룹을 지우면 그 안의 키워드는 '기본' 그룹으로 옮겨져요 (키워드는 지워지지 않아요).</p></div>`)
    const q = (s) => document.querySelector(s)
    q('#gf').onsubmit = async (e) => { e.preventDefault(); try { await api('/api/rank/groups', { kind, name: new FormData(e.target).get('name') }); toast('그룹을 추가했어요'); await draw(); after() } catch (err) { toast('' + err.message) } }
    document.querySelectorAll('[data-gren]').forEach(b => b.onclick = async () => { const from = b.dataset.gren, to = await askText(`'${from}' 그룹의 새 이름`, from); if (!to || to === from) return
      try { await api('/api/rank/groups/rename', { kind, from, to }); toast('이름을 바꿨어요'); await draw(); after() } catch (err) { toast('' + err.message) } })
    document.querySelectorAll('[data-gdel]').forEach(b => b.onclick = async () => { const name = b.dataset.gdel
      if (!await confirmBox(`'${name}' 그룹을 지울까요?\n안의 키워드는 '기본' 그룹으로 옮겨져요.`, { ok: '삭제', danger: true })) return
      try { await api('/api/rank/groups/delete', { kind, name }); toast('그룹을 지웠어요'); await draw(); after() } catch (err) { toast('' + err.message) } })
  }
  await draw()
}

// ---------------- 순서 변경 ----------------
async function orderModal(kind, j) {
  const { api, modal, closeModal, toast, esc } = D
  modal('<div class="adl-modal"><h3 class="mh">순서 변경</h3><div class="adl-empty sm">불러오는 중…</div></div>')
  const all = await api(`/api/rank/targets?kind=${kind}&limit=200&sort=custom`)
  let ids = all.rows.map(r => r.id); const by = new Map(all.rows.map(r => [r.id, r]))
  const draw = () => { document.querySelector('#ol').innerHTML = ids.map((id, i) => `<li data-id="${id}" draggable="true"><span class="h">≡</span><b>${i + 1}</b> ${esc(by.get(id).keyword)} <span class="mute">${esc(by.get(id).name || '')}</span><span class="sp"></span><button data-u="${i}">▲</button><button data-d="${i}">▼</button><button data-t="${i}">맨 위</button></li>`).join('')
    document.querySelectorAll('#ol [data-u]').forEach(b => b.onclick = () => { const i = +b.dataset.u; if (i > 0) { [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; draw() } })
    document.querySelectorAll('#ol [data-d]').forEach(b => b.onclick = () => { const i = +b.dataset.d; if (i < ids.length - 1) { [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]]; draw() } })
    document.querySelectorAll('#ol [data-t]').forEach(b => b.onclick = () => { const i = +b.dataset.t; ids.unshift(ids.splice(i, 1)[0]); draw() })
    let drag = null
    document.querySelectorAll('#ol li').forEach(li => { li.ondragstart = () => { drag = +li.dataset.id }; li.ondragover = (e) => e.preventDefault(); li.ondrop = () => { const to = ids.indexOf(+li.dataset.id), from = ids.indexOf(drag); if (from < 0 || to < 0) return; ids.splice(to, 0, ids.splice(from, 1)[0]); draw() } })
  }
  modal(`<div class="adl-modal"><h3 class="mh">순서 변경 <small>위에서부터 이 순서로 보여요 (최대 200개)</small></h3>${all.total > 200 ? `<p class="sub">키워드가 ${all.total}개라 앞 200개만 바꿀 수 있어요.</p>` : ''}<ol class="adl-order" id="ol"></ol><div class="row c"><button class="adl-btn dark" id="os">저장</button><button class="adl-btn outline" id="or">등록순으로 초기화</button></div></div>`)
  draw()
  document.querySelector('#os').onclick = async () => { await api('/api/rank/targets/order', { kind, ids }); closeModal(); toast('순서를 저장했어요'); RS[kind].sort = 'custom'; rankPage(kind) }
  document.querySelector('#or').onclick = async () => { await api('/api/rank/targets/order', { kind, ids: [] }); closeModal(); toast('등록순으로 되돌렸어요'); rankPage(kind) }
}
