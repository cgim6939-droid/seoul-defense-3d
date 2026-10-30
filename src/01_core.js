// ============================================================
//  서울 디펜스 3D — core: 렌더러, 유틸, 설정, 월드 데이터, 충돌
// ============================================================
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const $ = (id) => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).has('debug');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

// ---------- 게임 전역 상태 ----------
const G = {
  state: 'loading', time: 0, wave: 0, score: 0, kills: 0, headshots: 0, shots: 0, hits: 0,
  waveState: 'idle', waveTimer: 0, toSpawn: 0, spawnTimer: 0, boss: null, lastKillT: -9, multi: 0,
};

function fatal(msg) {
  console.error(msg);
  $('loading').classList.remove('hidden');
  $('loading').style.opacity = 1;
  $('loadErr').textContent = '오류가 발생했어요:\n' + msg;
}
window.addEventListener('error', (e) => { if (G.state === 'loading') fatal(e.message); });
window.addEventListener('unhandledrejection', (e) => { if (G.state === 'loading') fatal(String(e.reason && e.reason.stack || e.reason)); });

// ---------- 유틸 ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a), 0, 1));
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const moveTo = (a, b, s) => a < b ? Math.min(b, a + s) : Math.max(b, a - s);
const wrapAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const srnd = mulberry32(20261018);           // 맵 생성용 (항상 같은 서울)
const rr = (a, b) => a + srnd() * (b - a);
const ri = (a, b) => Math.floor(rr(a, b + 1));
const pick = (arr) => arr[(srnd() * arr.length) | 0];
const chance = (p) => srnd() < p;
const R = (a, b) => a + Math.random() * (b - a); // 게임플레이용
function hash2(x, z) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), u = smooth(x - xi), v = smooth(z - zi);
  return lerp(lerp(hash2(xi, zi), hash2(xi + 1, zi), u), lerp(hash2(xi, zi + 1), hash2(xi + 1, zi + 1), u), v);
}
function fbm(x, z, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, z * f); n += a; f *= 2.03; a *= 0.5; }
  return s / n;
}

// ---------- 설정 ----------
const SETTINGS = Object.assign({ quality: 'medium', sens: 1, volume: 0.8, fov: 78, tod: 'dusk' }, (() => {
  try { return JSON.parse(localStorage.getItem('sd3d.settings') || '{}'); } catch (e) { return {}; }
})());
function saveSettings() { try { localStorage.setItem('sd3d.settings', JSON.stringify(SETTINGS)); } catch (e) {} }
let BEST = 0;
try { BEST = +localStorage.getItem('sd3d.best') || 0; } catch (e) {}
const QUALITY = {
  low:    { pr: 0.75, shadows: false, shadowSize: 1024, bloom: false, samples: 0, shadowRange: 70 },
  medium: { pr: 1.0,  shadows: true,  shadowSize: 1536, bloom: true,  samples: 2, shadowRange: 80 },
  high:   { pr: Math.min(window.devicePixelRatio || 1, 1.5), shadows: true, shadowSize: 4096, bloom: true, samples: 4, shadowRange: 130 },
};

// ---------- 렌더러 / 씬 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(SETTINGS.fov, innerWidth / innerHeight, 0.15, 7000);
camera.rotation.order = 'YXZ';
const weaponScene = new THREE.Scene();
const weaponCam = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.01, 10);
const U = { time: { value: 0 }, lights: { value: 1 } }; // 공유 셰이더 유니폼

// ============================================================
//  서울 월드 데이터 (단위: 미터, x=동쪽, z=남쪽)
// ============================================================
const PLAY = { x0: 4, x1: 1796, z0: 4, z1: 1436 };
const EXT = { x0: -420, x1: 2220, z0: -420, z1: 1860 };
const ROAD_W = 16, RH = 8, SW = 5;
const VX = []; for (let x = -240; x <= 2000; x += 160) VX.push(x);
const HZ = [-230, -70, 90, 250, 410, 560, 665, 975, 1120, 1280, 1440, 1600, 1760];
const V_NAMES = ['', '', '양천로', '양화로', '신촌로', '마포대로', '사직로', '세종대로', '한강대로', '반포대로', '강남대로', '영동대로', '송파대로', '', ''];
const H_NAMES = ['', '', '북악산로', '율곡로', '종로', '퇴계로', '강변북로', '올림픽대로', '테헤란로', '남부순환로', '양재대로', '', ''];
const BRIDGE_NAMES = ['행주대교', '방화대교', '가양대교', '양화대교', '서강대교', '마포대교', '원효대교', '한강대교',
  '동작대교', '반포대교', '한남대교', '성수대교', '잠실대교', '청담대교', '올림픽대교'];
const BRIDGE_HW = 10.5;

// 한강
const RHW = 92, RIVER_CUT = RHW - 1.0, WATER_Y = -6;
function riverZ(x) { return 820 + 38 * Math.sin(x / 360 + 0.6) + 10 * Math.sin(x / 140); }
const YEOUIDO = { x: 560, z: riverZ(560), rx: 125, rz: 34 };
function onIsland(x, z) { const dx = (x - YEOUIDO.x) / YEOUIDO.rx, dz = (z - YEOUIDO.z) / YEOUIDO.rz; return dx * dx + dz * dz < 1; }
function bridgeIndex(x) { for (let i = 0; i < VX.length; i++) if (Math.abs(x - VX[i]) < BRIDGE_HW) return i; return -1; }
function inRiverChannel(x, z) { return Math.abs(z - riverZ(x)) < RIVER_CUT && !onIsland(x, z); }

// 랜드마크 구역
const PALACE = { x0: 728, x1: 872, z0: 98, z1: 242 };       // 경복궁
const PLAZA = { x0: 728, x1: 872, z0: 258, z1: 402 };       // 광화문광장
const NAMSAN = { x: 1120, z: 545, r: 112, h: 58 };          // 남산
const LOTTE = { x0: 1528, x1: 1672, z0: 983, z1: 1112 };    // 롯데월드타워
const SEOKCHON = { x0: 1528, x1: 1672, z0: 1128, z1: 1272 };// 석촌호수
const GANGNAM = { x0: 1200, x1: 1530, z0: 983, z1: 1450 };
const HONGDAE = { x0: 240, x1: 560, z0: 250, z1: 560 };
const DOWNTOWN = { x0: 560, x1: 1360, z0: 90, z1: 560 };
const APT_ZONES = [
  { x0: 1040, x1: 1200, z0: 975, z1: 1120 }, { x0: 1530, x1: 2220, z0: 1120, z1: 1860 },
  { x0: -420, x1: 400, z0: 975, z1: 1860 }, { x0: 1360, x1: 2220, z0: -420, z1: 250 },
];
const LAKES = [
  { x: 749, z: 150, rx: 10, rz: 22 },     // 경회루 연못
  { x: 1572, z: 1200, rx: 38, rz: 24 },   // 석촌호수 서호
  { x: 1634, z: 1198, rx: 30, rz: 25 },   // 석촌호수 동호
];
const KZONES = {
  namdaemun: { x0: 733, x1: 867, z0: 423, z1: 547, n: '숭례문', s: '중구 남대문로' },
  ddp: { x0: 1213, x1: 1347, z0: 263, z1: 397, n: '동대문디자인플라자', s: '중구 을지로' },
  stadium: { x0: 253, x1: 387, z0: 263, z1: 397, n: '서울월드컵경기장', s: '마포구 상암동' },
  bluehouse: { x0: 733, x1: 867, z0: -57, z1: 77, n: '청와대', s: '종로구 청운동' },
  bukchon: { x0: 893, x1: 1027, z0: 103, z1: 237, n: '북촌한옥마을', s: '종로구 계동' },
};
const PLATFORMS = [
  { x0: 778, x1: 822, z0: 126, z1: 170, h: 0.9 },
  { x0: 783, x1: 817, z0: 131, z1: 165, h: 1.8 },
];
const DISTRICTS = [
  { n: '은평', s: '은평구', x: 150, z: 150 }, { n: '신촌', s: '서대문구', x: 430, z: 330 }, { n: '홍대', s: '마포구 서교동', x: 300, z: 470 },
  { n: '마포', s: '마포구', x: 520, z: 600 }, { n: '광화문', s: '종로구 세종로', x: 800, z: 330 }, { n: '종로', s: '종로구', x: 1050, z: 250 },
  { n: '명동', s: '중구', x: 960, z: 450 }, { n: '동대문', s: '중구 을지로', x: 1350, z: 330 }, { n: '이태원', s: '용산구', x: 1300, z: 580 },
  { n: '용산', s: '용산구', x: 850, z: 590 }, { n: '성수', s: '성동구', x: 1600, z: 560 }, { n: '노원', s: '노원구', x: 1600, z: 120 },
  { n: '영등포', s: '영등포구', x: 300, z: 1150 }, { n: '동작', s: '동작구', x: 800, z: 1150 }, { n: '반포', s: '서초구 반포동', x: 1120, z: 1050 },
  { n: '서초', s: '서초구', x: 1000, z: 1320 }, { n: '강남', s: '강남구 역삼동', x: 1360, z: 1220 }, { n: '삼성', s: '강남구 삼성동', x: 1480, z: 1060 },
  { n: '잠실', s: '송파구 잠실동', x: 1650, z: 1080 }, { n: '송파', s: '송파구', x: 1650, z: 1360 }, { n: '관악', s: '관악구', x: 600, z: 1380 },
];
const inR = (z, x, y) => x >= z.x0 && x <= z.x1 && y >= z.z0 && y <= z.z1;

// ---------- 남산 지형 (터널로 도로가 지나감) ----------
const CROSSINGS = []; // {axis:'v'|'h', c, a0, a1} — 터널 구간
function hillRaw(x, z) {
  const d = Math.hypot(x - NAMSAN.x, z - NAMSAN.z);
  if (d >= NAMSAN.r) return -1;
  const dd = Math.max(0, d - 14) / (NAMSAN.r - 14), t = 1 - dd;
  let h = NAMSAN.h * Math.pow(t * t * (3 - 2 * t), 1.25);
  h += (fbm(x * 0.025, z * 0.025, 3) - 0.5) * 16 * t * (1 - t) * 4;
  return h - 0.8;
}
function hillH(x, z) {
  let h = hillRaw(x, z);
  if (h <= 0) return h;
  for (const c of CROSSINGS) {   // 도로가 지나가는 곳은 터널 입구까지 땅을 깎는다
    const dist = c.axis === 'v' ? Math.abs(x - c.c) : Math.abs(z - c.c);
    const along = c.axis === 'v' ? z : x;
    if (along > c.a0 && along < c.a1) continue;
    h *= sstep(RH + 1.5, RH + 10, dist);
  }
  return h;
}
function groundH(x, z) {
  let h = 0;
  const dx = x - NAMSAN.x, dz = z - NAMSAN.z;
  if (dx * dx + dz * dz < NAMSAN.r * NAMSAN.r) h = Math.max(h, hillH(x, z));
  for (const p of PLATFORMS) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) h = Math.max(h, p.h);
  return h;
}
function isWater(x, z) {
  if (z > 676 && z < 964 && inRiverChannel(x, z) && bridgeIndex(x) < 0) return true;
  for (const L of LAKES) { const dx = (x - L.x) / L.rx, dz = (z - L.z) / L.rz; if (dx * dx + dz * dz < 1) return true; }
  return false;
}
function nearestIdx(arr, v) { let b = 0, bd = Infinity; for (let i = 0; i < arr.length; i++) { const d = Math.abs(arr[i] - v); if (d < bd) { bd = d; b = i; } } return b; }
function locationOf(x, z) {
  if (z > 670 && z < 970) {
    if (onIsland(x, z)) return { n: '여의도', s: '영등포구 여의도동' };
    const b = bridgeIndex(x);
    if (b >= 0 && Math.abs(z - riverZ(x)) < RHW) return { n: BRIDGE_NAMES[b], s: '한강' };
    return { n: '한강공원', s: '한강' };
  }
  for (const k in KZONES) if (inR(KZONES[k], x, z)) return KZONES[k];
  if (inR(PALACE, x, z)) return { n: '경복궁', s: '종로구 세종로' };
  if (inR(PLAZA, x, z)) return { n: '광화문광장', s: '종로구 세종로' };
  if (Math.hypot(x - NAMSAN.x, z - NAMSAN.z) < NAMSAN.r - 10) return { n: '남산', s: 'N서울타워' };
  if (inR(LOTTE, x, z)) return { n: '롯데월드타워', s: '송파구 신천동' };
  if (inR(SEOKCHON, x, z)) return { n: '석촌호수', s: '송파구 잠실동' };
  let best = DISTRICTS[0], bd = Infinity;
  for (const d of DISTRICTS) { const dd = Math.hypot(x - d.x, z - d.z); if (dd < bd) { bd = dd; best = d; } }
  return best;
}
function roadNameAt(x, z) {
  const vi = nearestIdx(VX, x), hi = nearestIdx(HZ, z);
  if (Math.abs(x - VX[vi]) < RH + SW + 1 && V_NAMES[vi]) return V_NAMES[vi];
  if (Math.abs(z - HZ[hi]) < RH + SW + 1 && H_NAMES[hi]) return H_NAMES[hi];
  return '';
}

// ============================================================
//  충돌 박스 (공간 격자)
// ============================================================
const COLS = [];
const CG = 32, CGX = Math.ceil((EXT.x1 - EXT.x0) / CG), CGZ = Math.ceil((EXT.z1 - EXT.z0) / CG);
const cgrid = Array.from({ length: CGX * CGZ }, () => []);
let stampN = 0;
function addBox(x0, z0, x1, z1, y1, y0 = 0, tag = 'b') {
  const b = { x0, z0, x1, z1, y0, y1, s: 0, tag };
  COLS.push(b);
  const gx0 = clamp(Math.floor((x0 - EXT.x0) / CG), 0, CGX - 1), gx1 = clamp(Math.floor((x1 - EXT.x0) / CG), 0, CGX - 1);
  const gz0 = clamp(Math.floor((z0 - EXT.z0) / CG), 0, CGZ - 1), gz1 = clamp(Math.floor((z1 - EXT.z0) / CG), 0, CGZ - 1);
  for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) cgrid[gz * CGX + gx].push(b);
  return b;
}
// 원(수평)과 박스 충돌 해결: p.x/p.z를 밀어낸다
function resolveCircle(p, r, y0, y1) {
  let hit = false;
  const st = ++stampN;
  const gx0 = clamp(Math.floor((p.x - r - EXT.x0) / CG), 0, CGX - 1), gx1 = clamp(Math.floor((p.x + r - EXT.x0) / CG), 0, CGX - 1);
  const gz0 = clamp(Math.floor((p.z - r - EXT.z0) / CG), 0, CGZ - 1), gz1 = clamp(Math.floor((p.z + r - EXT.z0) / CG), 0, CGZ - 1);
  for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
    const cell = cgrid[gz * CGX + gx];
    for (let i = 0; i < cell.length; i++) {
      const b = cell[i];
      if (b.s === st) continue; b.s = st;
      if (b.y1 <= y0 || b.y0 >= y1) continue;
      const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1);
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; }
      else {
        const l = p.x - b.x0, rt = b.x1 - p.x, t = p.z - b.z0, bt = b.z1 - p.z, m = Math.min(l, rt, t, bt);
        if (m === l) p.x = b.x0 - r; else if (m === rt) p.x = b.x1 + r; else if (m === t) p.z = b.z0 - r; else p.z = b.z1 + r;
      }
    }
  }
  return hit;
}
function pointSolid(x, y, z) {
  const gx = Math.floor((x - EXT.x0) / CG), gz = Math.floor((z - EXT.z0) / CG);
  if (gx < 0 || gz < 0 || gx >= CGX || gz >= CGZ) return false;
  const cell = cgrid[gz * CGX + gx];
  for (let i = 0; i < cell.length; i++) {
    const b = cell[i];
    if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && y >= b.y0 && y <= b.y1) return true;
  }
  return false;
}
// 광선 vs 박스 (slab). 반환: 진입 t (없으면 -1), 법선은 _rn에 기록
const _rn = new THREE.Vector3();
function rayBox(ox, oy, oz, dx, dy, dz, b, maxT) {
  let tmin = 0, tmax = maxT, ax = -1, sg = 0;
  // x
  if (Math.abs(dx) < 1e-9) { if (ox < b.x0 || ox > b.x1) return -1; }
  else { let t1 = (b.x0 - ox) / dx, t2 = (b.x1 - ox) / dx, s = -1; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; s = 1; }
    if (t1 > tmin) { tmin = t1; ax = 0; sg = s; } if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
  if (Math.abs(dy) < 1e-9) { if (oy < b.y0 || oy > b.y1) return -1; }
  else { let t1 = (b.y0 - oy) / dy, t2 = (b.y1 - oy) / dy, s = -1; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; s = 1; }
    if (t1 > tmin) { tmin = t1; ax = 1; sg = s; } if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
  if (Math.abs(dz) < 1e-9) { if (oz < b.z0 || oz > b.z1) return -1; }
  else { let t1 = (b.z0 - oz) / dz, t2 = (b.z1 - oz) / dz, s = -1; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; s = 1; }
    if (t1 > tmin) { tmin = t1; ax = 2; sg = s; } if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
  _rn.set(ax === 0 ? sg : 0, ax === 1 ? sg : 0, ax === 2 ? sg : 0);
  return tmin;
}
// 월드 광선 투사: 건물 + 지면 + 수면
const RAY = { t: 0, kind: '', normal: new THREE.Vector3(), point: new THREE.Vector3() };
function raycastWorld(o, d, maxT) {
  let best = maxT, kind = '';
  const st = ++stampN;
  const lx = o.x - EXT.x0, lz = o.z - EXT.z0;
  let gx = Math.floor(lx / CG), gz = Math.floor(lz / CG);
  const sx = d.x > 0 ? 1 : -1, sz = d.z > 0 ? 1 : -1;
  const tdx = Math.abs(d.x) > 1e-9 ? Math.abs(CG / d.x) : Infinity, tdz = Math.abs(d.z) > 1e-9 ? Math.abs(CG / d.z) : Infinity;
  let tmx = Math.abs(d.x) > 1e-9 ? ((d.x > 0 ? (gx + 1) * CG : gx * CG) - lx) / d.x : Infinity;
  let tmz = Math.abs(d.z) > 1e-9 ? ((d.z > 0 ? (gz + 1) * CG : gz * CG) - lz) / d.z : Infinity;
  for (let it = 0; it < 160; it++) {
    if (gx >= 0 && gx < CGX && gz >= 0 && gz < CGZ) {
      const cell = cgrid[gz * CGX + gx];
      for (let i = 0; i < cell.length; i++) {
        const b = cell[i]; if (b.s === st) continue; b.s = st;
        const t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, b, best);
        if (t >= 0 && t < best) { best = t; kind = 'wall'; RAY.normal.copy(_rn); }
      }
    }
    const tn = Math.min(tmx, tmz);
    if (tn > best || tn > maxT) break;
    if (tmx < tmz) { gx += sx; tmx += tdx; } else { gz += sz; tmz += tdz; }
  }
  // 지면 (남산 언덕 포함)
  if (d.y < 0) {
    let tg = -o.y / d.y;
    const hx = o.x + d.x * tg, hz = o.z + d.z * tg;
    if (isWater(hx, hz)) {
      tg = (WATER_Y - o.y) / d.y;
      if (tg < best) { best = tg; kind = 'water'; RAY.normal.set(0, 1, 0); }
    } else if (tg < best) { best = tg; kind = 'ground'; RAY.normal.set(0, 1, 0); }
  }
  // 언덕: 광선을 따라 걸어가며 확인
  const ncx = NAMSAN.x - o.x, ncz = NAMSAN.z - o.z;
  const along = ncx * d.x + ncz * d.z, hl = Math.hypot(d.x, d.z) || 1;
  const perp = Math.abs(ncx * d.z - ncz * d.x) / hl;
  if (perp < NAMSAN.r && o.y + d.y * Math.max(0, along) < NAMSAN.h + 10) {
    const tEnd = Math.min(best, maxT);
    for (let t = 0.5; t < tEnd; t += 1.2) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (y < groundH(x, z)) { best = t; kind = 'ground'; RAY.normal.set(0, 1, 0); break; }
    }
  }
  RAY.t = best; RAY.kind = kind;
  RAY.point.set(o.x + d.x * best, o.y + d.y * best, o.z + d.z * best);
  return RAY;
}
