// ============================================================
//  전체 지도 (M 키)
// ============================================================
const MAPV = { open: false, zoom: 1 };
const bigCv = $('mapCanvas'), bigCtx = bigCv.getContext('2d');
function toggleMap() { MAPV.open ? closeMap() : openMap(); }
function openMap() { if (G.state !== 'play') return; MAPV.open = true; show('bigmap', true); drawBigMap(); }
function closeMap() { MAPV.open = false; show('bigmap', false); }
const MAP_LABELS = [];
function mapLabels() {
  if (MAP_LABELS.length) return MAP_LABELS;
  for (const d of DISTRICTS) MAP_LABELS.push({ t: d.n, x: d.x, z: d.z, k: 'district' });
  const lm = [['경복궁', 800, 160], ['광화문광장', 800, 330], ['N서울타워', NAMSAN.x, NAMSAN.z], ['남산', NAMSAN.x, NAMSAN.z + 42], ['롯데월드타워', 1600, 1050],
    ['석촌호수', 1600, 1200], ['63빌딩', 640, YEOUIDO.z], ['국회의사당', 470, YEOUIDO.z], ['여의도', 560, YEOUIDO.z - 40],
    ['숭례문', 800, 485], ['동대문디자인플라자', 1280, 330], ['서울월드컵경기장', 320, 330], ['청와대', 800, 45], ['북촌한옥마을', 960, 170]];
  for (const [t, x, z] of lm) MAP_LABELS.push({ t, x, z, k: 'landmark' });
  VX.forEach((x, i) => { if (x > 0 && x < 1800) MAP_LABELS.push({ t: BRIDGE_NAMES[i], x, z: riverZ(x) + (i % 2 ? 30 : -30), k: 'bridge' }); });
  VX.forEach((x, i) => { if (V_NAMES[i]) MAP_LABELS.push({ t: V_NAMES[i], x, z: 520 + (i % 3) * 300 + 70, k: 'road', v: true }); });
  HZ.forEach((z, i) => { if (H_NAMES[i]) MAP_LABELS.push({ t: H_NAMES[i], x: 160 + (i % 4) * 420, z, k: 'road' }); });
  MAP_LABELS.push({ t: '한 강', x: 1240, z: riverZ(1240), k: 'river' });
  return MAP_LABELS;
}
function drawBigMap() {
  const W = Math.min(innerWidth - 80, 1500), H = Math.min(innerHeight - 140, 1100);
  if (bigCv.width !== W || bigCv.height !== H) { bigCv.width = W; bigCv.height = H; }
  const g = bigCtx;
  const fit = Math.min(W / (PLAY.x1 - PLAY.x0 + 80), H / (PLAY.z1 - PLAY.z0 + 80));
  const s = fit * MAPV.zoom;               // 화면 px / 월드 m
  const k = Math.min(1, (MAPV.zoom - 1) * 1.5); // 확대할수록 플레이어 중심으로
  const halfW = W / 2 / s, halfH = H / 2 / s;
  const fitC = (c, lo, hi, half) => (hi - lo <= half * 2 ? (lo + hi) / 2 : clamp(c, lo + half, hi - half));
  const cx = MAPV.zoom <= 1.01 ? 900 : fitC(lerp(900, P.pos.x, k), EXT.x0, EXT.x1, halfW);
  const cz = MAPV.zoom <= 1.01 ? 720 : fitC(lerp(720, P.pos.z, k), EXT.z0, EXT.z1, halfH);
  const sx = (x) => W / 2 + (x - cx) * s, sz = (z) => H / 2 + (z - cz) * s;
  g.clearRect(0, 0, W, H);
  g.save();
  g.beginPath(); if (g.roundRect) g.roundRect(0, 0, W, H, 14); else g.rect(0, 0, W, H); g.clip();
  g.fillStyle = '#151a20'; g.fillRect(0, 0, W, H);
  g.drawImage(miniImg, sx(EXT.x0), sz(EXT.z0), (EXT.x1 - EXT.x0) * s, (EXT.z1 - EXT.z0) * s);
  g.strokeStyle = 'rgba(255,180,80,0.5)'; g.setLineDash([8, 6]); g.lineWidth = 1.5;
  g.strokeRect(sx(PLAY.x0), sz(PLAY.z0), (PLAY.x1 - PLAY.x0) * s, (PLAY.z1 - PLAY.z0) * s); g.setLineDash([]);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const L of mapLabels()) {
    const x = sx(L.x), y = sz(L.z);
    if (x < -80 || y < -40 || x > W + 80 || y > H + 40) continue;
    if (L.k === 'district') { g.font = `900 ${Math.round(16 + 6 * MAPV.zoom)}px ${FONT_KR}`; g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillText(L.t, x, y); }
    else if (L.k === 'river') { g.font = `900 ${Math.round(18 + 6 * MAPV.zoom)}px ${FONT_KR}`; g.fillStyle = 'rgba(140,190,255,0.45)'; g.fillText(L.t, x, y); }
    else if (L.k === 'landmark') {
      g.fillStyle = '#ffd27a'; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 5, y); g.lineTo(x, y + 6); g.lineTo(x - 5, y); g.fill();
      g.font = `700 ${12 + Math.round(MAPV.zoom)}px ${FONT_KR}`; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(L.t, x, y - 14);
      g.fillStyle = '#ffe9c4'; g.fillText(L.t, x, y - 14);
    } else if (MAPV.zoom > 1.4 || L.k === 'bridge') {
      g.font = `500 ${10 + Math.round(MAPV.zoom)}px ${FONT_KR}`; g.fillStyle = L.k === 'bridge' ? 'rgba(190,220,255,0.85)' : 'rgba(220,220,220,0.7)';
      g.save(); g.translate(x, y); if (L.v) g.rotate(-Math.PI / 2); g.fillText(L.t, 0, 0); g.restore();
    }
  }
  for (const p of PICKUPS) { g.fillStyle = p.kind === 'health' ? '#6dff8a' : '#ffd27a'; g.fillRect(sx(p.x) - 3, sz(p.z) - 3, 6, 6); }
  for (const e of ENEMIES) {
    if (e.state === 'dead') continue;
    const x = sx(e.pos.x), y = sz(e.pos.z);
    if (e.type === 'boss') {
      g.fillStyle = 'rgba(214,107,255,0.25)'; g.beginPath(); g.arc(x, y, 30 * s, 0, 6.29); g.fill();
      g.fillStyle = '#d66bff'; g.beginPath(); g.arc(x, y, 8, 0, 6.29); g.fill();
      g.font = `900 13px ${FONT_KR}`; g.fillText('모선', x, y - 16);
    } else { g.fillStyle = e.type === 'drone' ? '#ff6bd0' : '#ff4545'; g.beginPath(); g.arc(x, y, e.type === 'brute' ? 5 : 3.5, 0, 6.29); g.fill(); }
  }
  for (const r of remoteList()) {
    const x = sx(r.pos.x), y = sz(r.pos.z), col = SLOT_COLORS[r.slot % 4];
    g.fillStyle = col; g.beginPath(); g.arc(x, y, 6, 0, 6.29); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
    g.font = `900 12px ${FONT_KR}`; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(r.name, x, y - 14); g.fillStyle = col; g.fillText(r.name, x, y - 14);
  }
  const px = sx(P.pos.x), py = sz(P.pos.z);
  const pulse = 10 + (G.time * 12) % 14;
  g.strokeStyle = `rgba(255,255,255,${0.6 - (pulse - 10) / 28})`; g.lineWidth = 2; g.beginPath(); g.arc(px, py, pulse, 0, 6.29); g.stroke();
  g.save(); g.translate(px, py); g.rotate(-P.yaw);
  g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 9); g.lineTo(0, 4); g.lineTo(-8, 9); g.closePath(); g.fill(); g.stroke();
  g.restore();
  g.font = `900 16px ${FONT_KR}`; g.fillStyle = '#ff8a6a'; g.fillText('N', W - 30, 30);
  g.beginPath(); g.moveTo(W - 30, 42); g.lineTo(W - 25, 54); g.lineTo(W - 35, 54); g.fill();
  const m100 = 100 * s; g.fillStyle = '#ddd'; g.fillRect(W - 30 - m100, H - 26, m100, 3);
  g.font = `500 11px ${FONT_KR}`; g.fillText('100m', W - 30 - m100 / 2, H - 38);
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2);
}
