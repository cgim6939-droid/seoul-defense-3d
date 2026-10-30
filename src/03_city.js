// ============================================================
//  도시 생성: 블록 → 필지 → 건물 (아파트, 오피스, 유리타워, 저층 상가)
// ============================================================
const BLD = { office: [], glass: [], apt: [], low: [], gold: [], lotte: [] };
const BLOCKS = [], PARKS = [], ROOFPROPS = [], AVIATION = [], CROSSES = [], TREES = [], SIGN_SPOTS = [], APT_NUMS = [];
const PAL = {
  office: ['#a7a39b', '#bdb8ae', '#8f949a', '#c9c2b5', '#9fa7ae', '#b3aa9b', '#7e858c', '#d0ccc4', '#a49a8c'],
  glass: ['#56636e', '#6e7a84', '#46525c', '#7b8a95', '#3f4a52', '#5c6f7a'],
  apt: ['#e8e4dc', '#ded8cc', '#f0ece4', '#d9d3c5', '#e4ddd0', '#e9e1d3'],
  low: ['#b9a08a', '#c7b299', '#a98f7a', '#d4c3ad', '#9e9488', '#c9b6a6', '#8d7b6a', '#b0a59a', '#c4a484', '#a5644a', '#d8d0c4', '#8f6e5a'],
};
const TREE_COLS = {
  ginkgo: ['#e3b11f', '#f0c330', '#d9a21b', '#e8bb2a'], maple: ['#b8321f', '#d0471f', '#c23b22', '#e0582a'],
  zelkova: ['#b8692a', '#c98a3a', '#a65f2a', '#d19a45'], green: ['#4f7a33', '#61873a', '#47702f', '#5a7f3c'],
};
function treeColor(mix) {
  const r = srnd();
  let set = 'green';
  if (mix === 'street') set = r < 0.45 ? 'ginkgo' : r < 0.6 ? 'maple' : r < 0.85 ? 'zelkova' : 'green';
  else if (mix === 'park') set = r < 0.25 ? 'ginkgo' : r < 0.45 ? 'maple' : r < 0.65 ? 'zelkova' : 'green';
  else if (mix === 'mountain') set = r < 0.12 ? 'ginkgo' : r < 0.32 ? 'maple' : r < 0.5 ? 'zelkova' : 'green';
  return pick(TREE_COLS[set]);
}
function addTree(x, z, s = 1, mix = 'street', kind = 'broad') {
  TREES.push({ x, z, s, c: kind === 'pine' ? pick(['#2f5a2b', '#36622e', '#2a4f27']) : treeColor(mix), kind, y: groundH(x, z) });
}
function addBuilding(type, x0, z0, x1, z1, h, color, y0 = 0, collide = true) {
  const b = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h, y0, c: color, type };
  BLD[type].push(b);
  if (collide) addBox(x0, z0, x1, z1, y0 + h, y0);
  return b;
}
function lotBlocked(x0, z0, x1, z1) {
  const nx = clamp(NAMSAN.x, x0, x1), nz = clamp(NAMSAN.z, z0, z1);
  if (Math.hypot(nx - NAMSAN.x, nz - NAMSAN.z) < NAMSAN.r + 6) return true;
  return false;
}
function blockZone(cx, cz) {
  if (inR(GANGNAM, cx, cz)) return 'glass';
  if (inR(HONGDAE, cx, cz)) return 'low';
  if (inR(DOWNTOWN, cx, cz)) return 'down';
  for (const a of APT_ZONES) if (inR(a, cx, cz)) return 'apt';
  const n = hash2(cx | 0, cz | 0);
  const outside = cx < PLAY.x0 || cx > PLAY.x1 || cz < PLAY.z0 || cz > PLAY.z1;
  if (outside) return n < 0.45 ? 'apt' : n < 0.8 ? 'mixed' : 'down';
  return n < 0.18 ? 'apt' : n < 0.75 ? 'mixed' : 'down';
}
function roofDetails(b) {
  const top = b.y0 + b.h;
  const n = b.type === 'apt' ? 0 : ri(0, 3);
  for (let i = 0; i < n; i++) {
    const w = rr(1.5, Math.min(6, b.w * 0.4)), d = rr(1.5, Math.min(6, b.d * 0.4)), h = rr(1, 3.5);
    ROOFPROPS.push({ x: b.x + rr(-1, 1) * (b.w / 2 - w / 2 - 1), z: b.z + rr(-1, 1) * (b.d / 2 - d / 2 - 1), y: top, w, h, d });
  }
  if (b.type === 'apt') {
    const k = Math.max(1, Math.round(b.w / 22));
    for (let i = 0; i < k; i++) ROOFPROPS.push({ x: b.x - b.w / 2 + (i + 0.5) * b.w / k, z: b.z, y: top, w: 4, h: 3, d: 5 });
  }
  if (top > 70) {
    if (top > 120) for (const sx of [-1, 1]) for (const sz of [-1, 1]) AVIATION.push({ x: b.x + sx * (b.w / 2 - 1), y: top + 0.4, z: b.z + sz * (b.d / 2 - 1) });
    else AVIATION.push({ x: b.x, y: top + 1.5, z: b.z });
    ROOFPROPS.push({ x: b.x, z: b.z, y: top, w: 0.4, h: 1.2, d: 0.4 });
  }
}
function signSpot(b) {
  if (b.h > 60 || b.type === 'glass' || b.type === 'apt') return;
  if (b.x < PLAY.x0 - 150 || b.x > PLAY.x1 + 150 || b.z < PLAY.z0 - 150 || b.z > PLAY.z1 + 150) return;
  const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [sx, sz] of sides) {
    const ex = b.x + sx * (b.w / 2 + 7), ez = b.z + sz * (b.d / 2 + 7);
    const vi = nearestIdx(VX, ex), hi = nearestIdx(HZ, ez);
    const onRoad = (sx !== 0 && Math.abs(ex - VX[vi]) < RH + SW + 2) || (sz !== 0 && Math.abs(ez - HZ[hi]) < RH + SW + 2);
    if (onRoad) SIGN_SPOTS.push({ b, sx, sz });
  }
}
function genLots(blk, kind) {
  const P = { low: [12, 24, 0.8, 2], mixed: [16, 32, 1.5, 3.5], down: [22, 42, 2, 5], glass: [26, 50, 3, 7] }[kind];
  let x = blk.x0;
  while (blk.x1 - x > P[0] * 0.7) {
    let w = rr(P[0], P[1]); if (blk.x1 - (x + w) < P[0] * 0.7) w = blk.x1 - x;
    let z = blk.z0;
    while (blk.z1 - z > P[0] * 0.7) {
      let d = rr(P[0], P[1]); if (blk.z1 - (z + d) < P[0] * 0.7) d = blk.z1 - z;
      makeLot(x, z, x + w, z + d, kind, P);
      z += d;
    }
    x += w;
  }
}
function makeLot(x0, z0, x1, z1, kind, P) {
  if (lotBlocked(x0, z0, x1, z1)) return;
  if (kind !== 'glass' && chance(0.07)) {
    PARKS.push({ x0: x0 + 1, z0: z0 + 1, x1: x1 - 1, z1: z1 - 1 });
    const n = Math.max(2, ((x1 - x0) * (z1 - z0) / 70) | 0);
    for (let i = 0; i < n; i++) addTree(rr(x0 + 3, x1 - 3), rr(z0 + 3, z1 - 3), rr(0.8, 1.3), 'park');
    return;
  }
  const s = rr(P[2], P[3]);
  const bx0 = x0 + s, bz0 = z0 + s, bx1 = x1 - s, bz1 = z1 - s;
  if (bx1 - bx0 < 6 || bz1 - bz0 < 6) return;
  let type, h;
  if (kind === 'low') { type = 'low'; h = ri(2, 6) * 3.3 + 0.6; }
  else if (kind === 'mixed') { if (chance(0.55)) { type = 'low'; h = ri(3, 7) * 3.3 + 0.6; } else { type = 'office'; h = ri(5, 16) * 3.6; } }
  else if (kind === 'down') { if (chance(0.35)) { type = 'glass'; h = ri(12, 32) * 3.8; } else { type = 'office'; h = ri(7, 24) * 3.6; } }
  else { if (chance(0.75)) { type = 'glass'; h = ri(15, 48) * 3.8; } else { type = 'office'; h = ri(10, 26) * 3.6; } }
  const base = addBuilding(type, bx0, bz0, bx1, bz1, h, pick(PAL[type]));
  let b = base;
  if ((type === 'glass' || type === 'office') && h > 45 && chance(0.45)) {
    const k = rr(0.55, 0.8), w = (bx1 - bx0) * k, d = (bz1 - bz0) * k;
    b = addBuilding(type, b.x - w / 2, b.z - d / 2, b.x + w / 2, b.z + d / 2, h * rr(0.25, 0.55), b.c, h, false);
  }
  roofDetails(b);
  signSpot(base);
  if ((type === 'low' || type === 'office') && b.h < 35 && chance(0.025)) CROSSES.push({ x: b.x + rr(-2, 2), y: b.y0 + b.h, z: b.z + rr(-2, 2), r: pick([0, Math.PI / 2]) });
}
function genApartments(blk) {
  const depth = 12.5, gap = rr(24, 30), width = blk.x1 - blk.x0;
  const nCols = width > 110 ? 2 : 1;
  const len = (width - 12 - (nCols - 1) * 14) / nCols;
  let z = blk.z0 + 6, num = 101 + ri(0, 3);
  while (z + depth < blk.z1 - 6) {
    for (let c = 0; c < nCols; c++) {
      const l = len * rr(0.82, 1), x0 = blk.x0 + 6 + c * (len + 14) + (len - l) / 2;
      const floors = ri(12, 25), h = floors * 2.9 + 1;
      const b = addBuilding('apt', x0, z, x0 + l, z + depth, h, pick(PAL.apt));
      roofDetails(b);
      if (b.x > PLAY.x0 - 300 && b.x < PLAY.x1 + 300 && b.z > PLAY.z0 - 300 && b.z < PLAY.z1 + 300)
        APT_NUMS.push({ b, n: (num++ - 101) % 16 });
    }
    for (let x = blk.x0 + 8; x < blk.x1 - 8; x += rr(9, 14)) if (chance(0.6)) addTree(x, z + depth + gap * rr(0.3, 0.7), rr(0.8, 1.2), 'park');
    z += depth + gap;
  }
}
function genCity() {
  const xs = [EXT.x0, ...VX, EXT.x1], zs = [EXT.z0, ...HZ, EXT.z1];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    if (zs[j] === 665) continue; // 한강
    const x0 = xs[i] + (i > 0 ? RH + SW : 0), x1 = xs[i + 1] - (i < xs.length - 2 ? RH + SW : 0);
    const z0 = zs[j] + (j > 0 ? RH + SW : 0), z1 = zs[j + 1] - (j < zs.length - 2 ? RH + SW : 0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const blk = { x0, z0, x1, z1, kind: '' };
    BLOCKS.push(blk);
    if (inR(PALACE, cx, cz)) { blk.kind = 'palace'; continue; }
    if (inR(PLAZA, cx, cz)) { blk.kind = 'plaza'; continue; }
    if (inR(LOTTE, cx, cz)) { blk.kind = 'lotte'; continue; }
    { let kz = null; for (const k in KZONES) if (inR(KZONES[k], cx, cz)) kz = k; if (kz) { blk.kind = 'landmark_' + kz; continue; } }
    if (inR(SEOKCHON, cx, cz)) { blk.kind = 'lake'; continue; }
    blk.kind = blockZone(cx, cz);
    if (blk.kind === 'apt') genApartments(blk); else genLots(blk, blk.kind);
  }
  // 도시 외곽(안개 너머) 저밀도 건물
  for (let i = 0; i < 2600; i++) {
    const a = srnd() * Math.PI * 2, r = rr(1500, 1950);
    const x = 900 + Math.cos(a) * r, z = 720 + Math.sin(a) * r;
    if (x > EXT.x0 - 30 && x < EXT.x1 + 30 && z > EXT.z0 - 30 && z < EXT.z1 + 30) continue;
    if (z > 640 && z < 1000) continue;
    const w = rr(18, 45), d = rr(14, 40), apt = chance(0.5);
    addBuilding(apt ? 'apt' : 'office', x - w / 2, z - d / 2, x + w / 2, z + d / 2, apt ? ri(12, 24) * 2.9 : rr(12, 70), pick(apt ? PAL.apt : PAL.office), 0, false);
  }
}

function buildBuildingMeshes() {
  const o = new THREE.Object3D(), c = new THREE.Color();
  for (const type of Object.keys(BLD)) {
    const list = BLD[type];
    if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(GEO.boxB, BMAT[type], list.length);
    list.forEach((b, i) => {
      o.position.set(b.x, b.y0, b.z); o.rotation.set(0, 0, 0); o.scale.set(b.w, b.h, b.d); o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix); mesh.setColorAt(i, c.set(b.c));
    });
    mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
    scene.add(mesh);
  }
  // 옥상 구조물
  const rp = new THREE.InstancedMesh(GEO.boxB, M.roofProp, ROOFPROPS.length);
  ROOFPROPS.forEach((p, i) => { o.position.set(p.x, p.y, p.z); o.scale.set(p.w, p.h, p.d); o.updateMatrix(); rp.setMatrixAt(i, o.matrix); });
  rp.castShadow = true; rp.receiveShadow = true; rp.frustumCulled = false; scene.add(rp);
  // 항공 장애등 (깜빡임)
  const avMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.15, 0.1) });
  const av = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 8, 6), avMat, Math.max(1, AVIATION.length));
  AVIATION.forEach((p, i) => { o.position.set(p.x, p.y, p.z); o.scale.set(1, 1, 1); o.updateMatrix(); av.setMatrixAt(i, o.matrix); });
  av.frustumCulled = false; scene.add(av);
  WORLD_FX.aviation = avMat;
  // 교회 네온 십자가
  const crossGeo = mergeGeometries([
    new THREE.BoxGeometry(0.35, 5, 0.35).translate(0, 2.5 + 2, 0), new THREE.BoxGeometry(2.6, 0.35, 0.35).translate(0, 5.6, 0)]);
  const crossMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.25, 0.25) });
  const cr = new THREE.InstancedMesh(crossGeo, crossMat, Math.max(1, CROSSES.length));
  CROSSES.forEach((p, i) => { o.position.set(p.x, p.y, p.z); o.rotation.set(0, p.r, 0); o.scale.set(1, 1, 1); o.updateMatrix(); cr.setMatrixAt(i, o.matrix); });
  cr.frustumCulled = false; scene.add(cr);
  const crossPole = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 2, 0.2).translate(0, 1, 0), M.darkMetal, Math.max(1, CROSSES.length));
  CROSSES.forEach((p, i) => { o.position.set(p.x, p.y, p.z); o.rotation.set(0, 0, 0); o.updateMatrix(); crossPole.setMatrixAt(i, o.matrix); });
  crossPole.frustumCulled = false; scene.add(crossPole);
  WORLD_FX.crosses = crossMat;
  o.rotation.set(0, 0, 0);
}
const WORLD_FX = {};
