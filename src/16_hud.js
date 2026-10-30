// ============================================================
//  HUD: 체력/탄약, 미니맵, 나침반, 배너, 킬피드, 피격 방향
// ============================================================
const CH = { el: $('crosshair'), t: document.querySelector('#crosshair .t'), b: document.querySelector('#crosshair .b'), l: document.querySelector('#crosshair .l'), r: document.querySelector('#crosshair .r') };
let miniImg = null;
const MM_SCALE = 0.5;
const LANDMARKS = [
  { n: 'N서울타워', x: NAMSAN.x, z: NAMSAN.z }, { n: '롯데타워', x: 1600, z: 1050 }, { n: '경복궁', x: 800, z: 170 },
  { n: '63빌딩', x: 640, z: YEOUIDO.z }, { n: '광화문', x: 800, z: 330 },
  { n: '숭례문', x: 800, z: 485 }, { n: 'DDP', x: 1280, z: 330 }, { n: '월드컵경기장', x: 320, z: 330 }, { n: '청와대', x: 800, z: 45 },
];
function buildMinimap() {
  const W = (EXT.x1 - EXT.x0) * MM_SCALE, H = (EXT.z1 - EXT.z0) * MM_SCALE;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), X = (x) => (x - EXT.x0) * MM_SCALE, Z = (z) => (z - EXT.z0) * MM_SCALE;
  g.fillStyle = '#20252c'; g.fillRect(0, 0, W, H);
  for (const b of BLOCKS) { g.fillStyle = b.kind === 'palace' ? '#5a4d33' : b.kind === 'plaza' ? '#4a4a48' : '#2a3038'; g.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * MM_SCALE, (b.z1 - b.z0) * MM_SCALE); }
  for (const p of PARKS) { g.fillStyle = '#2c4228'; g.fillRect(X(p.x0), Z(p.z0), (p.x1 - p.x0) * MM_SCALE, (p.z1 - p.z0) * MM_SCALE); }
  g.fillStyle = '#2f4a2a';
  g.beginPath(); for (let x = EXT.x0; x <= EXT.x1; x += 8) g.lineTo(X(x), Z(678)); for (let x = EXT.x1; x >= EXT.x0; x -= 8) g.lineTo(X(x), Z(962)); g.fill();
  g.fillStyle = '#1d4a6e'; g.beginPath();
  for (let x = EXT.x0; x <= EXT.x1; x += 8) g.lineTo(X(x), Z(riverZ(x) - RIVER_CUT));
  for (let x = EXT.x1; x >= EXT.x0; x -= 8) g.lineTo(X(x), Z(riverZ(x) + RIVER_CUT));
  g.fill();
  for (const L of LAKES) { g.beginPath(); g.ellipse(X(L.x), Z(L.z), L.rx * MM_SCALE, L.rz * MM_SCALE, 0, 0, 6.29); g.fill(); }
  g.fillStyle = '#2f4a2a'; g.beginPath(); g.ellipse(X(YEOUIDO.x), Z(YEOUIDO.z), YEOUIDO.rx * MM_SCALE, YEOUIDO.rz * MM_SCALE, 0, 0, 6.29); g.fill();
  g.fillStyle = '#35552c'; g.beginPath(); g.arc(X(NAMSAN.x), Z(NAMSAN.z), NAMSAN.r * MM_SCALE, 0, 6.29); g.fill();
  g.fillStyle = '#59616b';
  for (const x of VX) g.fillRect(X(x - RH), 0, ROAD_W * MM_SCALE, H);
  for (const z of HZ) g.fillRect(0, Z(z - RH), W, ROAD_W * MM_SCALE);
  g.fillStyle = '#47505c';
  for (const t of Object.keys(BLD)) for (const b of BLD[t]) if (b.y0 === 0) g.fillRect(X(b.x - b.w / 2), Z(b.z - b.d / 2), b.w * MM_SCALE, b.d * MM_SCALE);
  miniImg = c;
}
const mmCtx = $('minimap').getContext('2d'), cpCtx = $('compass').getContext('2d');
function drawMinimap() {
  const S = 190, R0 = 95, zoom = 1.25, h = -P.yaw;
  const g = mmCtx;
  g.clearRect(0, 0, S, S);
  g.save(); g.beginPath(); g.arc(R0, R0, R0 - 1, 0, 6.29); g.clip();
  g.fillStyle = 'rgba(12,16,22,0.85)'; g.fillRect(0, 0, S, S);
  g.translate(R0, R0); g.rotate(-h); g.scale(zoom, zoom);
  g.globalAlpha = 0.92;
  g.drawImage(miniImg, -(P.pos.x - EXT.x0) * MM_SCALE, -(P.pos.z - EXT.z0) * MM_SCALE);
  g.globalAlpha = 1;
  const toM = (x, z) => [(x - P.pos.x) * MM_SCALE, (z - P.pos.z) * MM_SCALE];
  for (const p of PICKUPS) { const [x, z] = toM(p.x, p.z); g.fillStyle = p.kind === 'health' ? '#6dff8a' : '#ffd27a'; g.fillRect(x - 2, z - 2, 4, 4); }
  for (const e of ENEMIES) {
    if (e.state === 'dead') continue;
    const [x, z] = toM(e.pos.x, e.pos.z);
    g.fillStyle = e.type === 'boss' ? '#d66bff' : e.type === 'drone' ? '#ff6bd0' : '#ff4545';
    g.beginPath(); g.arc(x, z, e.type === 'boss' ? 7 : e.type === 'brute' ? 3.4 : 2.4, 0, 6.29); g.fill();
  }
  for (const r of remoteList()) { const [x, z] = toM(r.pos.x, r.pos.z); g.fillStyle = SLOT_COLORS[r.slot % 4]; g.beginPath(); g.arc(x, z, 3.4, 0, 6.29); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke(); }
  g.restore();
  // 플레이어 화살표 + 북쪽 표시
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(R0, R0 - 8); g.lineTo(R0 + 5.5, R0 + 6); g.lineTo(R0, R0 + 3); g.lineTo(R0 - 5.5, R0 + 6); g.closePath(); g.fill();
  const na = -h - Math.PI / 2;
  g.font = `900 13px ${FONT_KR}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#ff8a6a'; g.fillText('N', R0 + Math.cos(na) * (R0 - 12), R0 + Math.sin(na) * (R0 - 12));
}
function drawCompass() {
  const g = cpCtx, W = 560, H = 46, span = 150, h = THREE.MathUtils.radToDeg(-P.yaw);
  g.clearRect(0, 0, W, H);
  const grad = g.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(0.2, 'rgba(0,0,0,0.35)'); grad.addColorStop(0.8, 'rgba(0,0,0,0.35)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 8, W, 22);
  const names = { 0: '북', 45: '북동', 90: '동', 135: '남동', 180: '남', 225: '남서', 270: '서', 315: '북서' };
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let d = 0; d < 360; d += 15) {
    let rel = ((d - h) % 360 + 540) % 360 - 180;
    if (Math.abs(rel) > span / 2) continue;
    const x = W / 2 + rel / span * W, a = 1 - Math.abs(rel) / (span / 2);
    g.globalAlpha = a;
    if (names[d] !== undefined) { g.font = `900 ${d % 90 ? 12 : 15}px ${FONT_KR}`; g.fillStyle = d === 0 ? '#ff8a6a' : '#fff'; g.fillText(names[d], x, 19); }
    else { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x - 0.5, 14, 1, 9); }
  }
  for (const l of LANDMARKS) {
    const b = THREE.MathUtils.radToDeg(Math.atan2(l.x - P.pos.x, -(l.z - P.pos.z)));
    const rel = ((b - h) % 360 + 540) % 360 - 180;
    if (Math.abs(rel) > span / 2) continue;
    const x = W / 2 + rel / span * W;
    g.globalAlpha = 1 - Math.abs(rel) / (span / 2) * 0.7;
    g.fillStyle = '#ffd27a'; g.beginPath(); g.moveTo(x, 31); g.lineTo(x + 4, 36); g.lineTo(x, 41); g.lineTo(x - 4, 36); g.fill();
    g.font = `700 10px ${FONT_KR}`; g.fillStyle = '#ffe2b8'; g.fillText(l.n, x, 4 + 0);
  }
  if (G.boss) {
    const b = THREE.MathUtils.radToDeg(Math.atan2(G.boss.pos.x - P.pos.x, -(G.boss.pos.z - P.pos.z)));
    const rel = ((b - h) % 360 + 540) % 360 - 180;
    const x = W / 2 + clamp(rel / span, -0.5, 0.5) * W;
    g.globalAlpha = 1; g.fillStyle = '#d66bff'; g.beginPath(); g.arc(x, 36, 5, 0, 6.29); g.fill();
  }
  g.globalAlpha = 1; g.fillStyle = '#ffb347'; g.fillRect(W / 2 - 1, 6, 2, 26);
}

let bannerTimer = 0, locTimer = 0, lastLoc = '', locCand = '', locCandT = 0;
const HUD = {
  banner(big, sub, dur = 3.6) {
    $('bannerBig').textContent = big; $('bannerSub').textContent = sub || '';
    $('banner').classList.add('show'); bannerTimer = dur;
  },
  toast(txt, color) {
    const d = document.createElement('div'); d.className = 'kf'; d.style.borderLeftColor = color || '#fff'; d.textContent = txt;
    $('killfeed').prepend(d); setTimeout(() => d.style.opacity = 0, 2500); setTimeout(() => d.remove(), 3100);
  },
  kill(name, pts, head, multi) {
    const d = document.createElement('div'); d.className = 'kf' + (head ? ' hs' : '');
    const tag = multi >= 1 ? ['', ' · 더블 킬', ' · 트리플 킬', ' · 멀티 킬'][Math.min(3, multi)] || ' · 멀티 킬' : '';
    d.textContent = `${head ? '헤드샷 ' : ''}${name} 처치  +${pts}${tag}`;
    $('killfeed').prepend(d);
    while ($('killfeed').children.length > 6) $('killfeed').lastChild.remove();
    setTimeout(() => d.style.opacity = 0, 3500); setTimeout(() => d.remove(), 4100);
  },
  hurt(amount, from) {
    const v = $('vignette'); v.style.transition = 'none'; v.style.opacity = clamp(amount / 25, 0.35, 1);
    requestAnimationFrame(() => { v.style.transition = 'opacity .8s'; v.style.opacity = 0; });
    if (from) {
      const ang = Math.atan2(from.x - P.pos.x, -(from.z - P.pos.z)) + P.yaw;
      const d = document.createElement('div'); d.className = 'dmgdir'; d.style.transform = `rotate(${ang}rad)`;
      $('dmgdirs').appendChild(d); setTimeout(() => d.style.opacity = 0, 600); setTimeout(() => d.remove(), 1400);
    }
  },
};
let hitT = 0;
function hitMarker(kind) {
  const h = $('hitmarker'); h.className = kind; h.style.opacity = 1; hitT = kind === 'kill' ? 0.35 : 0.18;
  h.style.transform = `scale(${kind === 'kill' ? 1.3 : 1})`;
}
let hudFrame = 0;
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function updateHUD(dt) {
  hitT -= dt; if (hitT <= 0) $('hitmarker').style.opacity = 0;
  bannerTimer -= dt; if (bannerTimer <= 0) $('banner').classList.remove('show');
  const w = WEAPONS[P.weapon], st = WST[P.weapon];
  setText('hpTxt', String(Math.ceil(P.hp)));
  const fill = $('hpFill'); fill.style.width = (P.hp / P.maxHp * 100) + '%'; fill.classList.toggle('low', P.hp < 35);
  $('lowhp').style.opacity = P.hp < 35 ? (0.4 + 0.3 * Math.sin(G.time * 5)) * (1 - P.hp / 35) : 0;
  setText('wName', w.name);
  const ammoKey = `${st.ammo}|${w.mag}`;
  if (hudCache.ammo !== ammoKey) { hudCache.ammo = ammoKey; $('wAmmo').innerHTML = `${st.ammo}<small> / ${w.mag}</small>`; $('wAmmo').classList.toggle('empty', st.ammo === 0); }
  for (let i = 0; i < 3; i++) $('slot' + i).classList.toggle('on', i === (P.switchTo >= 0 ? P.switchTo : P.weapon));
  setText('grenTxt', `수류탄 ×${P.grenades}  [G]`);
  let hint = '';
  if (st.reload > 0) hint = '재장전 중…';
  else if (st.ammo === 0) hint = 'R 키로 재장전';
  else if (st.ammo <= Math.ceil(w.mag * 0.25)) hint = '탄약 부족';
  if (DRIVE.car) hint = `${G.speedKmh || 0} km/h   ·   W/S 가속·후진 · A/D 핸들 · Space 브레이크 · H 경적 · F 하차`;
  else if (nearCar()) hint = 'F 키로 차량 탑승';
  setText('hint', hint);
  let alive = 0; for (const e of ENEMIES) if (e.state !== 'dead') alive++;
  const waveHtml = `WAVE ${G.wave}<span class="tier">난이도 ${tierOf() + 1}</span><small>${G.waveState === 'break' ? `다음 웨이브 ${Math.ceil(G.waveTimer)}초` : `남은 적 ${alive + G.toSpawn}`}</small>`;
  if (hudCache.waveHtml !== waveHtml) { hudCache.waveHtml = waveHtml; $('waveTxt').innerHTML = waveHtml; }
  setText('scoreTxt', `${G.score.toLocaleString()}점`);
  setText('objTxt', G.boss ? '모선의 주황색 코어를 노려라' : G.waveState === 'break' ? '숨을 고르고 정비하라 · 체력이 회복된다' : '외계인으로부터 서울을 지켜라');
  if (G.boss) $('bossFill').style.width = (Math.max(0, G.boss.hp) / G.boss.maxHp * 100) + '%';
  // 위치
  const loc = locationOf(P.pos.x, P.pos.z);
  setText('locname', loc.n); setText('roadname', roadNameAt(P.pos.x, P.pos.z) || loc.s);
  if (loc.n !== locCand) { locCand = loc.n; locCandT = 0; }
  locCandT += dt;
  if (locCandT > 1.2 && locCand !== lastLoc && bannerTimer < -0.3) {
    lastLoc = locCand;
    $('locBig').textContent = loc.n; $('locSub').textContent = '서울특별시 · ' + loc.s;
    $('locpop').classList.add('show'); locTimer = 3;
  }
  locTimer -= dt; if (locTimer <= 0) $('locpop').classList.remove('show');
  if ((hudFrame++ & 1) === 0) { drawMinimap(); drawCompass(); }
  if (MAPV.open && (hudFrame & 1)) drawBigMap();
}
