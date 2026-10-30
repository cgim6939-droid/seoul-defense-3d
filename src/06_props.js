// ============================================================
//  거리 소품: 가로수, 가로등, 신호등, 간판, 아파트 동 번호
// ============================================================
const SIGNALS = []; // {i, j, axis, base}
let signalMesh = null;
const nearPlay = (x, z, m) => x > PLAY.x0 - m && x < PLAY.x1 + m && z > PLAY.z0 - m && z < PLAY.z1 + m;

function genStreetProps() {
  const sortedH = [EXT.z0, ...HZ, EXT.z1], sortedV = [EXT.x0, ...VX, EXT.x1];
  const okSpot = (x, z) => hillRaw(x, z) < -0.3 && !inR(PALACE, x, z) && !isWater(x, z);
  for (const x of VX) for (let j = 0; j < sortedH.length - 1; j++) {
    const a = sortedH[j] + RH + 10, b = sortedH[j + 1] - RH - 10;
    if (a > 650 && b < 990) continue;
    for (const s of [-1, 1]) {
      for (let z = a; z < b; z += rr(11, 15)) if (nearPlay(x, z, 110) && okSpot(x + s * (RH + 2.8), z)) addTree(x + s * (RH + 2.8), z, rr(0.85, 1.15), 'street');
      for (let z = a + (s > 0 ? 17 : 0); z < b; z += 34) if (nearPlay(x, z, 120) && okSpot(x + s * (RH + 0.7), z)) LAMPS.push({ x: x + s * (RH + 0.7), z, rot: s < 0 ? 0 : Math.PI, y: 0 });
    }
  }
  for (const z of HZ) for (let i = 0; i < sortedV.length - 1; i++) {
    const a = sortedV[i] + RH + 10, b = sortedV[i + 1] - RH - 10;
    for (const s of [-1, 1]) {
      const riverSide = (z === 665 && s > 0) || (z === 975 && s < 0);
      for (let x = a; x < b; x += rr(11, 15)) if (nearPlay(x, z, 110) && okSpot(x, z + s * (RH + 2.8)) && !(riverSide && chance(0.3))) addTree(x, z + s * (RH + 2.8), rr(0.85, 1.15), 'street');
      for (let x = a + (s > 0 ? 17 : 0); x < b; x += 34) if (nearPlay(x, z, 120) && okSpot(x, z + s * (RH + 0.7))) LAMPS.push({ x, z: z + s * (RH + 0.7), rot: s < 0 ? -Math.PI / 2 : Math.PI / 2, y: 0 });
    }
  }
  // 한강공원 숲
  for (const sgn of [-1, 1]) for (let x = EXT.x0; x < EXT.x1; x += rr(6, 11)) {
    if (!nearPlay(x, 820, 300) || bridgeIndex(x) >= 0 || Math.abs(x - VX[nearestIdx(VX, x)]) < 16) continue;
    const edge = riverZ(x) + sgn * RIVER_CUT, road = sgn < 0 ? 680 : 960;
    const w = Math.abs(road - edge);
    if (w < 9) continue;
    const z = edge + sgn * rr(9, Math.max(9.5, w - 2));
    addTree(x, z, rr(0.9, 1.4), 'park');
  }
}

function makeFoliage(pine) {
  const parts = [];
  const blobs3 = pine
    ? [[0, 5.0, 0, 1.8, 0.7], [0.9, 5.9, 0.4, 1.4, 0.6], [-0.6, 6.6, -0.3, 1.2, 0.55], [0.3, 4.3, -0.8, 1.3, 0.5]]
    : [[0, 4.6, 0, 2.3, 0.88], [1.1, 5.4, 0.5, 1.6, 0.8], [-0.9, 5.2, -0.6, 1.5, 0.8], [0.2, 6.1, -0.2, 1.3, 0.85]];
  const blobs = blobs3.slice(0, 3);
  for (const [x, y, z, s, sy] of blobs) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const k = 0.82 + 0.36 * vnoise(vx * 2.1 + x * 3 + 10, vz * 2.1 + vy * 1.7 + 20);
      p.setXYZ(i, vx * s * k + x, vy * s * sy * k + y, vz * s * k + z);
    }
    parts.push(g);
  }
  const m = mergeGeometries(parts); m.computeVertexNormals();
  return m;
}
function foliageMaterial() {
  const mat = stdMat(0xffffff, 0.9, 0, { flatShading: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.23;
        float sw = max(0.0, position.y - 3.0) * 0.035;
        transformed.x += sin(uTime * 1.3 + ph) * sw;
        transformed.z += sin(uTime * 1.1 + ph * 1.7) * sw * 0.7;
      #endif`);
  };
  mat.customProgramCacheKey = () => 'foliage';
  return mat;
}
// 인스턴스를 300m 구역으로 쪼개서 화면 밖은 그리지 않는다 (그림자 패스도 마찬가지)
const CHUNK_MESHES = [];
function chunked(list, geo, mat, fill, opt = {}) {
  const size = 300, groups = new Map(), o = new THREE.Object3D(), c = new THREE.Color();
  for (const it of list) { const k = Math.floor(it.x / size) * 1000 + Math.floor(it.z / size); let g = groups.get(k); if (!g) groups.set(k, g = []); g.push(it); }
  for (const g of groups.values()) {
    const mesh = new THREE.InstancedMesh(geo, mat, g.length);
    let sx = 0, sz = 0;
    g.forEach((it, i) => { sx += it.x; sz += it.z; const col = fill(it, o, c); mesh.setMatrixAt(i, o.matrix); if (col) mesh.setColorAt(i, col); });
    mesh.castShadow = opt.shadow !== false; mesh.receiveShadow = true;
    mesh.computeBoundingSphere(); mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    mesh.userData.cx = sx / g.length; mesh.userData.cz = sz / g.length; mesh.userData.maxD = opt.maxD || 1e9;
    scene.add(mesh); CHUNK_MESHES.push(mesh);
  }
}
let chunkT = 0;
function updateChunkVis(dt) {
  chunkT -= dt; if (chunkT > 0) return; chunkT = 0.25;
  const cx = camera.position.x, cz = camera.position.z;
  for (const m of CHUNK_MESHES) m.visible = Math.hypot(m.userData.cx - cx, m.userData.cz - cz) < m.userData.maxD + 220;
}
function buildTrees() {
  for (const pine of [false, true]) {
    const list = TREES.filter(t => (t.kind === 'pine') === pine);
    if (!list.length) continue;
    const trunkGeo = pine ? new THREE.CylinderGeometry(0.17, 0.3, 5.6, 6).translate(0, 2.8, 0) : new THREE.CylinderGeometry(0.14, 0.24, 4.6, 6).translate(0, 2.3, 0);
    const fill = (withColor) => (t, o, c) => {
      o.position.set(t.x, t.y, t.z); o.rotation.set(0, (hash2(t.x * 10, t.z * 10) * 6.28), pine ? (hash2(t.z, t.x) - 0.5) * 0.15 : 0);
      o.scale.setScalar(t.s); o.updateMatrix();
      if (!withColor) return null;
      return c.set(t.c).offsetHSL((hash2(t.x, t.z) - 0.5) * 0.03, 0, (hash2(t.z, t.x) - 0.5) * 0.1);
    };
    chunked(list, makeFoliage(pine), foliageMaterial(), fill(true), { maxD: 700 });
    chunked(list, trunkGeo, pine ? stdMat(0x5a3b2a, 0.95) : M.trunk, fill(false), { maxD: 450 });
  }
}

function buildLamps() {
  const o = new THREE.Object3D();
  const poleGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.09, 0.14, 8.6, 6).translate(0, 4.3, 0),
    new THREE.BoxGeometry(2.3, 0.12, 0.12).translate(1.1, 8.45, 0),
  ]);
  const poles = new THREE.InstancedMesh(poleGeo, stdMat(0x3a3f44, 0.5, 0.6), LAMPS.length);
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.3, 2.3) });
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.16, 0.42).translate(2.15, 8.33, 0), headMat, LAMPS.length);
  const poolTex = glowTex('rgba(255,210,150,0.9)', 'rgba(255,200,140,0)');
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0.5, 0.42, 0.32), polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(13, 13).rotateX(-Math.PI / 2), poolMat, LAMPS.length);
  LAMPS.forEach((l, i) => {
    o.position.set(l.x, l.y, l.z); o.rotation.set(0, l.rot, 0); o.scale.set(1, 1, 1); o.updateMatrix();
    poles.setMatrixAt(i, o.matrix); heads.setMatrixAt(i, o.matrix);
    o.position.set(l.x + Math.cos(l.rot) * 2.2, l.y + 0.09, l.z - Math.sin(l.rot) * 2.2); o.rotation.set(0, 0, 0); o.updateMatrix();
    pools.setMatrixAt(i, o.matrix);
  });
  poles.castShadow = true;
  for (const m of [poles, heads, pools]) { m.frustumCulled = false; scene.add(m); }
  WORLD_FX.lampHead = headMat; WORLD_FX.lampPool = poolMat;
}

function buildSignals() {
  const o = new THREE.Object3D();
  const poleGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.12, 0.15, 6.2, 8).translate(0, 3.1, 0),
    new THREE.BoxGeometry(6.2, 0.15, 0.15).translate(3.1, 6.0, 0),
    new THREE.BoxGeometry(1.6, 0.45, 0.45).translate(5.6, 5.75, 0),
  ]);
  const spots = [];
  VX.forEach((x, i) => HZ.forEach((z, j) => {
    if (!nearPlay(x, z, 200) || hillRaw(x, z) > -0.5) return;
    const c = RH + 1.5;
    spots.push({ x: x - c, z: z - c, rot: 0, i, j, axis: 0 });
    spots.push({ x: x + c, z: z + c, rot: Math.PI, i, j, axis: 0 });
    spots.push({ x: x - c, z: z + c, rot: Math.PI / 2, i, j, axis: 1 });
    spots.push({ x: x + c, z: z - c, rot: -Math.PI / 2, i, j, axis: 1 });
  }));
  const poles = new THREE.InstancedMesh(poleGeo, stdMat(0x2f3338, 0.5, 0.6), spots.length);
  const lampGeo = new THREE.CircleGeometry(0.15, 12).rotateY(Math.PI);
  signalMesh = new THREE.InstancedMesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), spots.length * 3);
  spots.forEach((s, k) => {
    o.position.set(s.x, 0, s.z); o.rotation.set(0, s.rot, 0); o.updateMatrix();
    poles.setMatrixAt(k, o.matrix);
    for (let l = 0; l < 3; l++) {
      const lx = 5.1 + l * 0.5, cs = Math.cos(s.rot), sn = Math.sin(s.rot);
      const wx = s.x + lx * cs + (-0.235) * sn, wz = s.z - lx * sn + (-0.235) * cs;
      o.position.set(wx, 5.75, wz); o.rotation.set(0, s.rot, 0); o.updateMatrix();
      signalMesh.setMatrixAt(k * 3 + l, o.matrix);
    }
    SIGNALS.push({ i: s.i, j: s.j, axis: s.axis, base: k * 3, last: -1 });
  });
  poles.castShadow = true;
  for (const m of [poles, signalMesh]) { m.frustumCulled = false; scene.add(m); }
  updateSignals(0, true);
}
// 0=적 1=황 2=녹
function signalPhase(i, j, axis, t) {
  const tt = ((t + ((i * 7 + j * 11) % 24)) % 24 + 24) % 24;
  if (axis === 0) return tt < 10 ? 2 : tt < 12.5 ? 1 : 0;
  return tt < 12.5 ? 0 : tt < 22 ? 2 : 1;
}
const SIG_COLS = [new THREE.Color(1, 0.06, 0.04), new THREE.Color(1, 0.55, 0.03), new THREE.Color(0.1, 1, 0.5)];
function updateSignals(t, force = false) {
  if (!signalMesh) return;
  const c = new THREE.Color(); let changed = false;
  for (const s of SIGNALS) {
    const ph = signalPhase(s.i, s.j, s.axis, t);
    if (ph === s.last && !force) continue;
    s.last = ph; changed = true;
    for (let l = 0; l < 3; l++) {
      const on = (l === 0 && ph === 0) || (l === 1 && ph === 1) || (l === 2 && ph === 2);
      c.copy(SIG_COLS[l]).multiplyScalar(on ? 5 : 0.05);
      signalMesh.setColorAt(s.base + l, c);
    }
  }
  if (changed) signalMesh.instanceColor.needsUpdate = true;
}

// 간판 아틀라스
const SIGN_H = [
  ['치킨', '#ffcc00', '#b71c1c'], ['노래방', '#16122a', '#ff3cac', 1], ['PC방', '#0c2340', '#4ef0ff', 1], ['편의점', '#1e7d3a', '#ffffff'],
  ['카페', '#3e2723', '#ffe0b2'], ['약국', '#f4f4f4', '#2e7d32'], ['분식', '#ff7043', '#ffffff'], ['부동산', '#1565c0', '#ffffff'],
  ['고기집', '#8e1414', '#ffeb3b'], ['호프', '#ffb300', '#3e2723'], ['미용실', '#f8bbd0', '#880e4f'], ['수학학원', '#283593', '#ffffff'],
  ['한의원', '#4e342e', '#ffd54f'], ['떡볶이', '#e53935', '#ffffff'], ['안경', '#00897b', '#ffffff'], ['24시 마트', '#5e1b8a', '#ffffff'],
];
const SIGN_V = [['노래방', '#1a1030', '#ff4fd8'], ['당구장', '#0d3b2e', '#7dffb0'], ['PC방', '#0c2340', '#4ef0ff'], ['찜질방', '#3a1a10', '#ffb347'],
  ['호프', '#2a1a05', '#ffd54f'], ['볼링장', '#101a40', '#9fb7ff'], ['치과', '#ffffff', '#1565c0'], ['학원', '#1b5e20', '#ffffff']];
function signAtlas(list, cw, ch, cols, vertical) {
  const rows = Math.ceil(list.length / cols);
  return canvasTex(cw * cols, ch * rows, (g) => {
    list.forEach(([txt, bg, fg, neon], k) => {
      const x = (k % cols) * cw, y = Math.floor(k / cols) * ch;
      g.fillStyle = bg; g.fillRect(x, y, cw, ch);
      g.strokeStyle = neon ? fg : 'rgba(255,255,255,0.5)'; g.lineWidth = neon ? 6 : 4; g.strokeRect(x + 6, y + 6, cw - 12, ch - 12);
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (neon) { g.shadowColor = fg; g.shadowBlur = 18; }
      if (vertical) {
        const chars = [...txt]; const fs = Math.min(cw * 0.7, (ch - 40) / chars.length * 0.95);
        g.font = `900 ${fs}px ${FONT_KR}`;
        chars.forEach((cc, i) => g.fillText(cc, x + cw / 2, y + 20 + fs * 0.55 + i * ((ch - 40) / chars.length)));
      } else {
        g.font = `900 ${Math.min(ch * 0.62, cw / (txt.length * 0.75))}px ${FONT_KR}`;
        g.fillText(txt, x + cw / 2, y + ch / 2 + 4);
      }
      g.shadowBlur = 0;
    });
  });
}
function buildSigns() {
  const atlasH = signAtlas(SIGN_H, 512, 128, 2, false), atlasV = signAtlas(SIGN_V, 128, 512, 8, true);
  const lists = SIGN_H.map(() => []), vlists = SIGN_V.map(() => []);
  for (const { b, sx, sz } of SIGN_SPOTS) {
    const sideLen = sx !== 0 ? b.d : b.w;
    if (sideLen < 6) continue;
    const rot = sx > 0 ? Math.PI / 2 : sx < 0 ? -Math.PI / 2 : sz > 0 ? 0 : Math.PI;
    const fx = b.x + sx * (b.w / 2 + 0.06), fz = b.z + sz * (b.d / 2 + 0.06);
    const floors = b.type === 'low' ? Math.min(3, Math.floor(b.h / 3.3) - 1) : 1;
    for (let f = 0; f < floors; f++) {
      if (f > 0 && !chance(0.55)) continue;
      const w = Math.min(sideLen * 0.85, rr(5, 9)), off = rr(-1, 1) * (sideLen - w) / 2 * 0.8;
      lists[ri(0, SIGN_H.length - 1)].push({ x: fx + (sx === 0 ? off : 0), z: fz + (sz === 0 ? off : 0), y: 3.75 + f * 3.3, w, h: 1.25, rot });
    }
    if (b.type === 'low' && b.h > 9 && chance(0.4)) {
      const tx = sx === 0 ? 1 : 0, tz = sx === 0 ? 0 : 1, e = (sideLen / 2 - 1.2) * (chance(0.5) ? 1 : -1);
      vlists[ri(0, SIGN_V.length - 1)].push({ x: fx + tx * e + sx * 0.65, z: fz + tz * e + sz * 0.65, y: Math.min(b.h - 3, 8), w: 1.1, h: 4.2, rot: rot + Math.PI / 2 });
    }
  }
  const o = new THREE.Object3D();
  const mk = (list, atlas, k, cols, rows) => {
    if (!list.length) return;
    const t = atlas.clone(); t.needsUpdate = true;
    t.repeat.set(1 / cols, 1 / rows); t.offset.set((k % cols) / cols, 1 - (Math.floor(k / cols) + 1) / rows);
    const mat = new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.6, 1.6, 1.6), side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(GEO.plane, mat, list.length);
    list.forEach((s, i) => { o.position.set(s.x, s.y, s.z); o.rotation.set(0, s.rot, 0); o.scale.set(s.w, s.h, 1); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); });
    mesh.frustumCulled = false; scene.add(mesh);
    (WORLD_FX.signs = WORLD_FX.signs || []).push(mat);
  };
  lists.forEach((l, k) => mk(l, atlasH, k, 2, 8));
  vlists.forEach((l, k) => mk(l, atlasV, k, 8, 1));
  // 아파트 동 번호 (101동 …)
  const numAtlas = canvasTex(1024, 512, (g) => {
    g.clearRect(0, 0, 1024, 512);
    for (let k = 0; k < 16; k++) {
      const x = (k % 4) * 256, y = Math.floor(k / 4) * 128;
      g.fillStyle = k % 3 === 0 ? '#2b4f7a' : k % 3 === 1 ? '#5a4a3a' : '#3d5a3a';
      g.font = `900 92px ${FONT_KR}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(101 + k), x + 128, y + 68);
    }
  });
  const nl = Array.from({ length: 16 }, () => []);
  for (const { b, n } of APT_NUMS) for (const s of [-1, 1]) nl[n].push({ x: b.x + s * (b.w / 2 + 0.07), z: b.z, y: b.h - 5, w: 9, h: 4.5, rot: s * Math.PI / 2 });
  nl.forEach((list, k) => {
    if (!list.length) return;
    const t = numAtlas.clone(); t.needsUpdate = true; t.repeat.set(0.25, 0.25); t.offset.set((k % 4) / 4, 1 - (Math.floor(k / 4) + 1) / 4);
    const mat = stdMat(0xffffff, 0.9, 0, { map: t, transparent: true, alphaTest: 0.3, polygonOffset: true, polygonOffsetFactor: -2 });
    const mesh = new THREE.InstancedMesh(GEO.plane, mat, list.length);
    list.forEach((s, i) => { o.position.set(s.x, s.y, s.z); o.rotation.set(0, s.rot, 0); o.scale.set(s.w, s.h, 1); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); });
    mesh.frustumCulled = false; scene.add(mesh);
  });
}
