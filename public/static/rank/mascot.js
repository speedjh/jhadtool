// 챗봇 캐릭터 "재흥이" — 동그란 몸통의 꼬마 로봇. mood: idle | think | happy | warn
export function mascot(mood = 'idle', size = 40) {
  const eyes = {
    idle: '<ellipse class="eye" cx="38" cy="47" rx="5" ry="6.5"/><ellipse class="eye" cx="62" cy="47" rx="5" ry="6.5"/><circle cx="40" cy="44.5" r="1.8" fill="#fff"/><circle cx="64" cy="44.5" r="1.8" fill="#fff"/>',
    think: '<ellipse class="eye" cx="40" cy="44" rx="5" ry="6"/><ellipse class="eye" cx="64" cy="44" rx="5" ry="6"/><circle cx="42" cy="41" r="1.8" fill="#fff"/><circle cx="66" cy="41" r="1.8" fill="#fff"/>',
    happy: '<path d="M32 48 q6 -8 12 0" class="eyeline"/><path d="M56 48 q6 -8 12 0" class="eyeline"/>',
    warn: '<ellipse class="eye" cx="38" cy="48" rx="5" ry="5"/><ellipse class="eye" cx="62" cy="48" rx="5" ry="5"/><path d="M31 38 l12 4 M69 38 l-12 4" class="eyeline"/>',
  }[mood] || ''
  const mouth = {
    idle: '<path d="M44 59 q6 5 12 0" class="mouth"/>',
    think: '<circle cx="52" cy="61" r="2.6" class="mouthfill"/>',
    happy: '<path d="M41 57 q9 11 18 0 z" class="mouthfill"/>',
    warn: '<path d="M44 62 q6 -4 12 0" class="mouth"/>',
  }[mood] || ''
  return `<svg class="mascot m-${mood}" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="재흥이">
    <g class="m-body">
      <line x1="50" y1="14" x2="50" y2="24" class="ant"/><circle cx="50" cy="11" r="5" class="bulb"/>
      <rect x="14" y="22" width="72" height="62" rx="30" class="head"/>
      <rect x="22" y="31" width="56" height="42" rx="21" class="face"/>
      ${eyes}${mouth}
      <ellipse cx="29" cy="62" rx="5" ry="3" class="blush"/><ellipse cx="71" cy="62" rx="5" ry="3" class="blush"/>
      <rect x="6" y="46" width="9" height="18" rx="4.5" class="ear"/><rect x="85" y="46" width="9" height="18" rx="4.5" class="ear"/>
      <path d="M38 84 h24 v6 q0 4 -4 4 h-16 q-4 0 -4 -4z" class="neck"/>
    </g>
    ${mood === 'think' ? '<g class="dots"><circle cx="78" cy="16" r="3"/><circle cx="87" cy="10" r="3.6"/><circle cx="96" cy="4" r="4"/></g>' : ''}
    ${mood === 'happy' ? '<g class="sparks"><path d="M88 18 l3 -7 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3z"/></g>' : ''}
  </svg>`
}
