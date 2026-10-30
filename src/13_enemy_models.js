// ============================================================
//  외계인 모델 — 관절별로 지오메트리를 합치고 타입별로 캐시한다
//  (한 마리당 드로우콜 ~15개, 스폰할 때 새 지오메트리를 만들지 않음 → 렉 방지)
// ============================================================
const alienTex = canvasTex(256, 256, (g) => {
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {           // 얼룩무늬
    const v = 150 + Math.random() * 100, r = 2 + Math.random() * 9;
    g.fillStyle = `rgba(${v},${v},${v},0.35)`; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, r, 0, 6.29); g.fill();
  }
  g.strokeStyle = 'rgba(90,90,90,0.35)'; g.lineWidth = 1.2;  // 핏줄 / 패널 라인
  for (let i = 0; i < 40; i++) {
    let x = Math.random() * 256, y = Math.random() * 256; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 40; y += Math.random() * 30; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 3000; i++) { const v = Math.random() * 255; g.fillStyle = `rgba(${v},${v},${v},0.08)`; g.fillRect(Math.random() * 256, Math.random() * 256, 1, 1); }
}, { repeat: true });
const EMAT = {
  body: new THREE.MeshStandardMaterial({ vertexColors: true, map: alienTex, roughness: 0.5, metalness: 0.25 }),
  drone: new THREE.MeshStandardMaterial({ vertexColors: true, map: alienTex, roughness: 0.3, metalness: 0.8 }),
  eye: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 4, 1.4) }), eyeR: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.4, 1.6) }),
  core: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.4, 0.4) }), cyan: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3, 4) }),
};
const ETYPES = {
  grunt:  { name: '외계 병사', hp: 70, speed: 3.6, r: 0.45, h: 2.0, score: 100 },
  runner: { name: '크롤러', hp: 40, speed: 8.0, r: 0.55, h: 1.0, score: 120 },
  drone:  { name: '감시 드론', hp: 60, speed: 5.0, r: 0.7, h: 1.2, score: 150, fly: true },
  brute:  { name: '브루트', hp: 420, speed: 2.7, r: 1.0, h: 3.3, score: 350 },
  boss:   { name: '외계 모선', hp: 7000, speed: 4, r: 30, h: 10, score: 5000, fly: true },
};
// 적 한 마리마다 재질을 (종류별 1개씩만) 복제 → 피격 번쩍임/사망 페이드용
function cloneMats(root) {
  const map = new Map();
  root.traverse(o => {
    if (!o.isMesh || !o.material.isMeshStandardMaterial) return;
    if (!map.has(o.material)) map.set(o.material, o.material.clone());
    o.material = map.get(o.material);
  });
  return [...map.values()];
}

// ---------- 지오메트리 조립 도구 ----------
const EGEO = {};
const _mm = new THREE.Matrix4(), _mq = new THREE.Quaternion(), _me = new THREE.Euler(), _mv = new THREE.Vector3(), _ms = new THREE.Vector3(), _mc = new THREE.Color();
function P_(geo, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  geo.dispose();
  g.applyMatrix4(_mm.compose(_mv.set(x, y, z), _mq.setFromEuler(_me.set(rx, ry, rz)), _ms.set(sx, sy, sz)));
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  _mc.set(col);
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = _mc.r; c[i * 3 + 1] = _mc.g; c[i * 3 + 2] = _mc.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
function cachedGeo(key, build) {
  if (!EGEO[key]) { const list = build(); const g = mergeGeometries(list); list.forEach(x => x.dispose()); g.userData.shared = true; EGEO[key] = g; }
  return EGEO[key];
}
const sph = (r, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);
const capG = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
const cylG = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
const coneG = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
const rbox = (w, h, d, r = 0.03) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
function piece(parent, key, mat, build, shadow = false) {
  const m = new THREE.Mesh(cachedGeo(key, build), mat); m.castShadow = shadow; parent.add(m); return m;
}

// ---------- 외계 병사 / 브루트 ----------
function makeHumanoid(big) {
  const K = big ? 'B' : 'G';
  const C = big
    ? { skin: '#6a4f78', skin2: '#8a6f92', armor: '#5c2b2b', acc: '#8a4a3a', bone: '#e0d0b0' }
    : { skin: '#6f7d5c', skin2: '#93a27a', armor: '#2f2b3c', acc: '#4f4a66', bone: '#d8cfb0' };
  const glow = big ? EMAT.eyeR : EMAT.eye, body = EMAT.body;
  const g = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 1.0; g.add(hips);
  piece(hips, K + 'pelvis', body, () => [
    P_(sph(0.22), C.skin, 0, 0, 0, 0, 0, 0, 1.3, 0.8, 1),
    P_(cylG(0.27, 0.25, 0.1, 16), C.armor, 0, 0.06, 0),
    P_(rbox(0.16, 0.12, 0.06), C.acc, 0, 0.05, 0.25),
    P_(rbox(0.2, 0.26, 0.05), C.armor, 0, -0.12, 0.2, -0.15), P_(rbox(0.2, 0.24, 0.05), C.armor, 0, -0.12, -0.2, 0.15),
  ], true);
  const torso = new THREE.Group(); hips.add(torso);
  piece(torso, K + 'torso', body, () => {
    const L = [
      P_(cylG(0.23, 0.19, 0.32, 14), C.skin2, 0, 0.22, 0, 0, 0, 0, 1, 1, 0.8),
      P_(sph(0.3, 18, 14), C.skin, 0, 0.58, 0, 0, 0, 0, 1.15, 1, 0.8),
      P_(rbox(0.5, 0.34, 0.12, 0.04), C.armor, 0, 0.6, 0.2, -0.12),
      P_(rbox(0.42, 0.08, 0.1, 0.03), C.acc, 0, 0.42, 0.2, -0.05),
      P_(rbox(0.36, 0.4, 0.16, 0.05), C.armor, 0, 0.6, -0.22),
      P_(cylG(0.09, 0.11, 0.22, 10), C.skin, 0, 0.86, 0),
      P_(new THREE.TorusGeometry(0.15, 0.04, 6, 14), C.armor, 0, 0.82, 0, Math.PI / 2),
    ];
    for (const y of [0.13, 0.22, 0.31]) L.push(P_(new THREE.TorusGeometry(0.205, 0.022, 6, 18), C.skin, 0, y, 0, Math.PI / 2, 0, 0, 1, 0.8, 1));
    for (const s of [-1, 1]) {
      L.push(P_(rbox(0.16, 0.3, 0.3, 0.04), C.armor, s * 0.27, 0.56, 0.02));
      L.push(P_(rbox(big ? 0.34 : 0.27, 0.14, big ? 0.36 : 0.3, 0.05), C.acc, s * 0.4, 0.8, 0, 0, 0, -s * 0.35));
      if (big) for (let i = 0; i < 3; i++) L.push(P_(coneG(0.04, 0.22, 6), C.bone, s * (0.36 + i * 0.06), 0.92, -0.06 + i * 0.06, 0, 0, -s * 0.5));
    }
    for (let i = 0; i < (big ? 6 : 4); i++) L.push(P_(coneG(big ? 0.05 : 0.035, big ? 0.24 : 0.16, 6), C.acc, 0, 0.35 + i * 0.12, -0.31, -1.0));
    return L;
  }, true);
  piece(torso, K + 'torsoGlow', glow, () => {
    const L = [P_(sph(0.04, 8, 6), '#fff', 0, 0.7, -0.31)];
    for (let i = 0; i < 3; i++) L.push(P_(new THREE.BoxGeometry(0.3 - i * 0.05, 0.018, 0.01), '#fff', 0, 0.52 + i * 0.06, 0.268, -0.12));
    for (const s of [-1, 1]) L.push(P_(cylG(0.022, 0.022, 0.42, 6), '#fff', s * 0.2, 0.74, -0.2, 0, 0, s * 1.1));
    return L;
  });
  let core = null;
  if (big) { core = new THREE.Mesh(cachedGeo('Bcore', () => [P_(sph(0.15, 14, 10), '#fff')]), EMAT.core); core.position.set(0, 0.58, 0.28); torso.add(core); }
  const head = new THREE.Group(); head.position.y = 0.92; torso.add(head);
  piece(head, K + 'head', body, () => {
    const prof = [[0, -0.14], [0.09, -0.13], [0.14, -0.06], [0.17, 0.04], [0.2, 0.14], [0.21, 0.24], [0.18, 0.33], [0.11, 0.39], [0, 0.41]].map(([x, y]) => new THREE.Vector2(x, y));
    const L = [
      P_(new THREE.LatheGeometry(prof, 18), C.skin, 0, 0.08, -0.04, -0.5, 0, 0, 0.95, 1, 1),
      P_(sph(0.12, 12, 10), C.skin2, 0, -0.02, 0.1, 0, 0, 0, 1, 0.8, 1.1),
      P_(rbox(0.05, 0.03, 0.34, 0.012), C.armor, 0, 0.28, -0.08, -0.6),
    ];
    for (const s of [-1, 1]) L.push(P_(coneG(0.028, 0.15, 6), C.bone, s * 0.06, -0.11, 0.17, Math.PI * 0.82, 0, s * 0.25));
    if (big) for (const s of [-1, 1]) { L.push(P_(coneG(0.06, 0.34, 8), C.bone, s * 0.17, 0.2, -0.02, -0.4, 0, -s * 0.9)); L.push(P_(coneG(0.035, 0.2, 6), C.bone, s * 0.32, 0.36, -0.08, -0.9, 0, -s * 0.3)); }
    return L;
  }, true);
  piece(head, K + 'eyes', glow, () => [
    P_(sph(0.055, 10, 8), '#fff', -0.085, 0.04, 0.17, 0, 0, 0.4, 1.6, 0.75, 0.6),
    P_(sph(0.055, 10, 8), '#fff', 0.085, 0.04, 0.17, 0, 0, -0.4, 1.6, 0.75, 0.6),
    P_(sph(0.024, 8, 6), '#fff', 0, 0.15, 0.17),
  ]);
  let muzzle = null;
  const mkArm = (s) => {
    const arm = new THREE.Group(); arm.position.set(s * 0.42, 0.74, 0); torso.add(arm);
    piece(arm, K + 'upper' + s, body, () => [
      P_(sph(0.1, 12, 8), C.acc, 0, 0, 0), P_(capG(0.075, 0.32), C.skin, 0, -0.24, 0),
      P_(sph(0.085, 10, 8), C.armor, 0, -0.46, 0), P_(rbox(0.12, 0.18, 0.12, 0.03), C.armor, s * 0.03, -0.2, 0),
    ]);
    const fore = new THREE.Group(); fore.position.y = -0.48; arm.add(fore);
    piece(fore, K + 'fore' + s, body, () => {
      const L = [P_(capG(0.068, 0.26), C.skin, 0, -0.2, 0), P_(rbox(0.15, 0.22, 0.15, 0.04), C.armor, 0, -0.17, 0),
        P_(sph(0.07, 10, 8), C.skin2, 0, -0.4, 0, 0, 0, 0, 1, 1.1, 0.8)];
      for (let i = -1; i <= 1; i++) L.push(P_(capG(0.018, 0.08), C.skin, i * 0.035, -0.47, 0.03));
      return L;
    });
    piece(fore, K + 'claw' + s, glow, () => {
      const L = []; for (let i = -1; i <= 1; i++) L.push(P_(coneG(0.02, big ? 0.24 : 0.18, 6), '#fff', i * 0.035, -0.58, 0.04, Math.PI + 0.25, 0, i * 0.15));
      L.push(P_(new THREE.BoxGeometry(0.02, 0.16, 0.01), '#fff', s * 0.076, -0.17, 0.05)); return L;
    });
    if (s === 1 && !big) {   // 외계 광선총: 팔뚝 끝(-y 방향)으로 뻗는다
      const gunA = piece(fore, 'Ggun', body, () => [
        P_(rbox(0.1, 0.5, 0.15, 0.035), C.armor, 0, -0.7, 0), P_(rbox(0.07, 0.3, 0.07, 0.02), C.acc, 0, -0.64, 0.1),
        P_(cylG(0.028, 0.034, 0.42, 8), C.armor, 0, -1.05, 0), P_(rbox(0.07, 0.15, 0.07, 0.02), C.acc, 0, -0.52, -0.1, 0.3),
        P_(coneG(0.03, 0.14, 6), C.bone, 0, -0.95, 0.09, Math.PI), P_(rbox(0.12, 0.1, 0.2, 0.03), C.armor, 0, -0.9, 0),
      ], true);
      gunA.userData.gun = true;
      const gunB = piece(fore, 'GgunGlow', glow, () => [
        P_(new THREE.BoxGeometry(0.014, 0.34, 0.014), '#fff', 0.052, -0.7, 0), P_(new THREE.BoxGeometry(0.014, 0.34, 0.014), '#fff', -0.052, -0.7, 0),
        P_(sph(0.03, 8, 6), '#fff', 0, -1.27, 0), P_(sph(0.035, 8, 6), '#fff', 0, -0.9, 0.105),
      ]);
      gunB.userData.gun = true;
      muzzle = new THREE.Object3D(); muzzle.position.set(0, -1.3, 0); fore.add(muzzle);
    }
    arm.userData.fore = fore; return arm;
  };
  const mkLeg = (s) => {
    const leg = new THREE.Group(); leg.position.set(s * 0.16, 0, 0); hips.add(leg);
    piece(leg, K + 'thigh' + s, body, () => [P_(capG(0.1, 0.3), C.skin, 0, -0.23, 0), P_(rbox(0.16, 0.24, 0.08, 0.03), C.armor, 0, -0.22, 0.1, -0.05)], true);
    const shin = new THREE.Group(); shin.position.y = -0.48; leg.add(shin);
    piece(shin, K + 'shin' + s, body, () => {
      const L = [P_(sph(0.09, 10, 8), C.acc, 0, 0, 0.06, 0, 0, 0, 1, 1, 0.8), P_(rbox(0.15, 0.36, 0.15, 0.04), C.armor, 0, -0.2, 0, 0, 0, 0, 1, 1, 1),
        P_(capG(0.07, 0.26), C.skin, 0, -0.2, -0.04), P_(rbox(0.16, 0.08, 0.3, 0.03), C.armor, 0, -0.45, 0.06)];
      for (let i = -1; i <= 1; i++) L.push(P_(coneG(0.022, 0.09, 6), C.bone, i * 0.05, -0.46, 0.24, Math.PI / 2));
      return L;
    }, true);
    leg.userData.shin = shin; return leg;
  };
  const aL = mkArm(-1), aR = mkArm(1), lL = mkLeg(-1), lR = mkLeg(1);
  return { g, hips, torso, head, armL: aL, armR: aR, legL: lL, legR: lR, core, muzzle };
}

// ---------- 크롤러 (6족 보행 벌레) ----------
function makeRunner() {
  const C = { shell: '#3b2f4c', shell2: '#55406a', skin: '#7a6a5a', belly: '#a08f7a', bone: '#e0d6c0' };
  const g = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 0.6; g.add(body);
  piece(body, 'Rbody', EMAT.body, () => {
    const L = [
      P_(sph(0.38, 16, 12), C.shell, 0, 0.06, 0.15, 0, 0, 0, 1, 0.55, 1.1),
      P_(sph(0.42, 16, 12), C.shell2, 0, 0.09, -0.2, 0, 0, 0, 1.05, 0.6, 1),
      P_(sph(0.36, 16, 12), C.shell, 0, 0.12, -0.6, 0.15, 0, 0, 0.9, 0.62, 1.2),
      P_(sph(0.3, 14, 10), C.belly, 0, -0.08, -0.1, 0, 0, 0, 1, 0.4, 1.6),
    ];
    for (let i = 0; i < 3; i++) L.push(P_(new THREE.TorusGeometry(0.3 - i * 0.03, 0.025, 6, 16), C.shell2, 0, 0.13 + i * 0.02, -0.45 - i * 0.15, Math.PI / 2 + 0.15, 0, 0, 1, 1.2, 0.6));
    for (let i = 0; i < 5; i++) L.push(P_(coneG(0.045, 0.2, 6), C.bone, 0, 0.3 - i * 0.01, 0.2 - i * 0.2, -0.5));
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) L.push(P_(rbox(0.06, 0.14, 0.2, 0.02), C.shell2, s * 0.36, 0.06, 0.2 - i * 0.3, 0, 0, s * 0.5));
    L.push(P_(coneG(0.08, 0.35, 8), C.bone, 0, 0.12, -1.0, -Math.PI / 2 - 0.3));
    return L;
  }, true);
  piece(body, 'RbodyGlow', EMAT.eye, () => {
    const L = []; for (let i = 0; i < 4; i++) L.push(P_(sph(0.055 - i * 0.006, 8, 6), '#fff', 0, 0.3 - i * 0.02, 0.05 - i * 0.22));
    L.push(P_(sph(0.06, 8, 6), '#fff', 0, 0.14, -1.18)); return L;
  });
  const head = new THREE.Group(); head.position.set(0, 0.02, 0.5); body.add(head);
  piece(head, 'Rhead', EMAT.body, () => {
    const L = [P_(sph(0.2, 14, 10), C.skin, 0, 0, 0, 0, 0, 0, 1, 0.75, 1.1), P_(rbox(0.3, 0.06, 0.18, 0.025), C.shell, 0, 0.12, -0.02)];
    for (const s of [-1, 1]) { L.push(P_(coneG(0.04, 0.26, 6), C.bone, s * 0.1, -0.06, 0.24, Math.PI / 2 + 0.3, 0, -s * 0.5)); L.push(P_(coneG(0.02, 0.3, 5), C.bone, s * 0.08, 0.1, 0.05, -0.9, 0, -s * 0.6)); }
    return L;
  });
  piece(head, 'Reyes', EMAT.eyeR, () => {
    const L = [];
    for (const s of [-1, 1]) { L.push(P_(sph(0.05, 8, 6), '#fff', s * 0.08, 0.05, 0.18)); L.push(P_(sph(0.032, 8, 6), '#fff', s * 0.14, 0.02, 0.14)); }
    return L;
  });
  const legs = [];
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1, k = i % 3;
    const pivot = new THREE.Group(); pivot.position.set(side * 0.3, -0.02, 0.25 - k * 0.32); body.add(pivot);
    piece(pivot, 'Rleg' + side, EMAT.body, () => [
      P_(sph(0.065, 8, 6), C.shell2, 0, 0, 0),
      P_(rbox(0.44, 0.06, 0.06, 0.02), C.shell, side * 0.2, 0.13, 0, 0, 0, side * 0.6),
      P_(sph(0.05, 8, 6), C.shell2, side * 0.38, 0.26, 0),
      P_(cylG(0.035, 0.012, 0.66, 6), C.bone, side * 0.48, -0.06, 0, 0, 0, side * -0.33),
    ], i === 0 || i === 5);
    pivot.userData = { side, k }; legs.push(pivot);
  }
  return { g, body, head, legs };
}

// ---------- 감시 드론 ----------
function makeDrone() {
  const C = { hull: '#4a5060', plate: '#2c303a', acc: '#7a8494' };
  const g = new THREE.Group();
  piece(g, 'Dcore', EMAT.drone, () => {
    const L = [
      P_(sph(0.36, 20, 14), C.hull), P_(new THREE.TorusGeometry(0.36, 0.045, 8, 28), C.plate, 0, 0, 0, Math.PI / 2),
      P_(sph(0.22, 14, 8), C.acc, 0, 0.26, 0, 0, 0, 0, 1, 0.45, 1),
      P_(new THREE.TorusGeometry(0.15, 0.035, 8, 20), C.plate, 0, 0, 0.3),
      P_(cylG(0.13, 0.17, 0.12, 14), C.plate, 0, -0.33, 0),
    ];
    for (const s of [-1, 1]) {
      L.push(P_(rbox(0.12, 0.34, 0.3, 0.04), C.plate, s * 0.38, 0, 0));
      L.push(P_(cylG(0.012, 0.012, 0.36, 5), C.acc, s * 0.14, 0.42, -0.1, -0.3, 0, s * 0.3));
    }
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; L.push(P_(rbox(0.06, 0.46, 0.24, 0.02), C.plate, Math.cos(a) * 0.38, -0.3, Math.sin(a) * 0.38, 0, -a, 0)); }
    return L;
  }, true);
  piece(g, 'DcoreGlow', EMAT.cyan, () => [
    P_(cylG(0.1, 0.1, 0.04, 12), '#fff', 0, -0.4, 0), P_(sph(0.025, 6, 4), '#fff', -0.23, 0.58, -0.2), P_(sph(0.025, 6, 4), '#fff', 0.23, 0.58, -0.2),
  ]);
  const ring = new THREE.Group(); ring.rotation.x = Math.PI / 2; g.add(ring);
  piece(ring, 'Dring', EMAT.drone, () => {
    const L = [P_(new THREE.TorusGeometry(0.66, 0.06, 8, 32), C.plate)];
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; L.push(P_(rbox(0.14, 0.14, 0.18, 0.03), C.acc, Math.cos(a) * 0.66, Math.sin(a) * 0.66, 0)); }
    return L;
  });
  piece(ring, 'DringGlow', EMAT.cyan, () => [P_(new THREE.TorusGeometry(0.66, 0.022, 6, 32), '#fff', 0, 0, 0.06)]);
  const eye = new THREE.Mesh(cachedGeo('Deye', () => [P_(sph(0.12, 12, 10), '#fff')]), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.5, 2) }));
  eye.position.z = 0.31; g.add(eye);
  return { g, ring, eye };
}

function makeBoss() {
  const g = new THREE.Group();
  const prof = [[0, -5], [9, -5.4], [20, -3.8], [28, -1.2], [30.5, 0], [29, 1.4], [20, 3.6], [11, 5.6], [0, 6.4]].map(([x, y]) => new THREE.Vector2(x, y));
  const hullMat = stdMat(0x3a3e48, 0.35, 0.85);
  const hull = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), hullMat); hull.castShadow = true; g.add(hull);
  const panel = new THREE.Mesh(new THREE.TorusGeometry(24, 0.35, 6, 64), stdMat(0x22252c, 0.5, 0.8)); panel.rotation.x = Math.PI / 2; panel.position.y = 2.6; g.add(panel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(30, 0.55, 8, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 3.5, 4.5) })); rim.rotation.x = Math.PI / 2; g.add(rim);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(8.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x402060, emissive: 0x5a1a8a, emissiveIntensity: 1.5, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.85 }));
  dome.position.y = 5.8; g.add(dome);
  const lights = new THREE.Group(); g.add(lights);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const l = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), i % 2 ? EMAT.eyeR : EMAT.core); l.position.set(Math.cos(a) * 26, -1.6, Math.sin(a) * 26); lights.add(l); }
  const cores = [];
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; const c = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 1.2, 0.4) })); c.position.set(Math.cos(a) * 13, -4.8, Math.sin(a) * 13); g.add(c); cores.push(c); }
  const emitter = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 1.6, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.5, 2.5) })); emitter.position.y = -5.4; g.add(emitter);
  return { g, hull, lights, cores, hullMat, dome };
}
function buildEnemyModel(type) {
  if (type === 'grunt') return makeHumanoid(false);
  if (type === 'brute') { const m = makeHumanoid(true); m.g.scale.setScalar(1.6); return m; }
  if (type === 'runner') return makeRunner();
  if (type === 'drone') return makeDrone();
  return makeBoss();
}
// 피격 판정 구 (발 위치 기준, yaw 회전 고려)
function hitSpheres(e) {
  const s = e.scaleK, out = e._hs || (e._hs = []);
  out.length = 0;
  const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw);
  const add = (fwd, y, r, part, mult) => out.push({ x: e.pos.x + fx * fwd, y: e.pos.y + y, z: e.pos.z + fz * fwd, r, part, mult });
  if (e.type === 'grunt' || e.type === 'brute') {
    const k = e.type === 'brute' ? 1.6 : 1, lean = e.model.torso.rotation.x;
    add(0.1 * k + lean * 0.9 * k, 2.0 * k * s, 0.27 * k, 'head', 2);
    if (e.type === 'brute') add(0.3 * k, 1.55 * k * s, 0.2 * k, 'core', 2.5);
    add(0.05 * k, 1.5 * k * s, 0.38 * k, 'body', 1);
    add(0, 1.0 * k * s, 0.34 * k, 'body', 1);
    add(0, 0.5 * k * s, 0.32 * k, 'legs', 1);
  } else if (e.type === 'runner') {
    add(0.55, 0.62, 0.3, 'head', 1.8); add(0, 0.6, 0.55, 'body', 1);
  } else if (e.type === 'drone') {
    add(0, 0, 0.75, 'body', 1);
  }
  return out;
}
