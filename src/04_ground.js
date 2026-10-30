// ============================================================
//  지면 · 도로 · 한강 · 다리
// ============================================================
const LAMPS = [];     // {x,z,rot,y}
const WATER = {};

function computeCrossings() {
  // 남산을 관통하는 도로마다 터널 입구 위치 계산
  for (const x of VX) {
    if (Math.abs(x - NAMSAN.x) >= NAMSAN.r - 5) continue;
    let a0 = null, a1 = null;
    for (let z = NAMSAN.z - NAMSAN.r; z < NAMSAN.z; z += 0.5) if (hillRaw(x, z) >= 6) { a0 = z; break; }
    for (let z = NAMSAN.z + NAMSAN.r; z > NAMSAN.z; z -= 0.5) if (hillRaw(x, z) >= 6) { a1 = z; break; }
    if (a0 !== null && a1 !== null) CROSSINGS.push({ axis: 'v', c: x, a0, a1 });
  }
  for (const z of HZ) {
    if (Math.abs(z - NAMSAN.z) >= NAMSAN.r - 5) continue;
    let a0 = null, a1 = null;
    for (let x = NAMSAN.x - NAMSAN.r; x < NAMSAN.x; x += 0.5) if (hillRaw(x, z) >= 6) { a0 = x; break; }
    for (let x = NAMSAN.x + NAMSAN.r; x > NAMSAN.x; x -= 0.5) if (hillRaw(x, z) >= 6) { a1 = x; break; }
    if (a0 !== null && a1 !== null) CROSSINGS.push({ axis: 'h', c: z, a0, a1 });
  }
}

function buildGround() {
  const cw = EXT.x1 - EXT.x0, ch = EXT.z1 - EXT.z0;
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d');
  const X = (x) => x - EXT.x0, Z = (z) => z - EXT.z0;
  g.fillStyle = '#8a8781'; g.fillRect(0, 0, cw, ch);
  for (let i = 0; i < 90000; i++) {
    const v = Math.random() < 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${0.03 + Math.random() * 0.04})`;
    g.fillRect(Math.random() * cw, Math.random() * ch, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  for (const b of BLOCKS) {
    const col = { palace: '#c8b894', plaza: '#b9b4aa', lotte: '#a9a59d', lake: '#5b7440' }[b.kind] || (b.kind.startsWith('landmark') ? (b.kind.endsWith('stadium') ? '#6e7d55' : b.kind.endsWith('bukchon') ? '#a9a08a' : '#b4afa4') : '#7c7972');
    g.fillStyle = col; g.fillRect(X(b.x0), Z(b.z0), b.x1 - b.x0, b.z1 - b.z0);
  }
  for (const p of PARKS) {
    g.fillStyle = '#56703c'; g.fillRect(X(p.x0), Z(p.z0), p.x1 - p.x0, p.z1 - p.z0);
    g.fillStyle = '#a89a80'; g.fillRect(X((p.x0 + p.x1) / 2 - 1), Z(p.z0), 2, p.z1 - p.z0);
  }
  // 광화문광장: 화강석 + 가운데 잔디띠
  g.fillStyle = '#c9c3b6'; g.fillRect(X(760), Z(PLAZA.z0), 80, PLAZA.z1 - PLAZA.z0);
  g.fillStyle = '#5f7a40'; g.fillRect(X(784), Z(PLAZA.z0 + 8), 6, PLAZA.z1 - PLAZA.z0 - 16); g.fillRect(X(810), Z(PLAZA.z0 + 8), 6, PLAZA.z1 - PLAZA.z0 - 16);
  // 경복궁 박석길
  g.fillStyle = '#a49c8c'; g.fillRect(X(796), Z(110), 8, 132);
  // 남산 기슭
  g.fillStyle = '#4c6634'; g.beginPath(); g.arc(X(NAMSAN.x), Z(NAMSAN.z), NAMSAN.r, 0, Math.PI * 2); g.fill();
  // 한강공원 (잔디 + 자전거길)
  for (const sgn of [-1, 1]) {
    g.fillStyle = '#58733e'; g.beginPath();
    const roadEdge = sgn < 0 ? 665 + RH + SW : 975 - RH - SW;
    g.moveTo(0, Z(roadEdge));
    for (let x = EXT.x0; x <= EXT.x1; x += 8) g.lineTo(X(x), Z(riverZ(x) + sgn * RIVER_CUT));
    g.lineTo(cw, Z(roadEdge)); g.closePath(); g.fill();
    g.strokeStyle = '#8f5a4a'; g.lineWidth = 3; g.beginPath();
    for (let x = EXT.x0; x <= EXT.x1; x += 8) {
      const ze = riverZ(x) + sgn * (RIVER_CUT + 7);
      const zz = sgn < 0 ? Math.max(ze, roadEdge + 2) : Math.min(ze, roadEdge - 2);
      x === EXT.x0 ? g.moveTo(X(x), Z(zz)) : g.lineTo(X(x), Z(zz));
    }
    g.stroke();
  }
  // 강물 / 호수 구멍
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  for (let x = EXT.x0; x <= EXT.x1; x += 4) g.lineTo(X(x), Z(riverZ(x) - RIVER_CUT));
  for (let x = EXT.x1; x >= EXT.x0; x -= 4) g.lineTo(X(x), Z(riverZ(x) + RIVER_CUT));
  g.closePath(); g.fill();
  for (const L of LAKES) { g.beginPath(); g.ellipse(X(L.x), Z(L.z), L.rx - 0.5, L.rz - 0.5, 0, 0, Math.PI * 2); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  // 여의도
  g.fillStyle = '#58733e'; g.beginPath(); g.ellipse(X(YEOUIDO.x), Z(YEOUIDO.z), YEOUIDO.rx, YEOUIDO.rz, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#85827b'; g.beginPath(); g.ellipse(X(YEOUIDO.x), Z(YEOUIDO.z), YEOUIDO.rx - 16, YEOUIDO.rz - 10, 0, 0, Math.PI * 2); g.fill();
  // 석촌호수 매직아일랜드
  g.fillStyle = '#5b7440'; g.beginPath(); g.arc(X(1566), Z(1200), 9, 0, Math.PI * 2); g.fill();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = MAX_ANISO;
  const mat = stdMat(0xffffff, 0.95, 0, { map: tex, alphaTest: 0.5 });
  // 보도블럭 디테일 (월드 좌표로 반복되는 타일 패턴을 곱한다)
  const detail = canvasTex(256, 256, (g2) => {
    g2.fillStyle = '#c8c8c8'; g2.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) {
      const v = 185 + Math.random() * 50, off = (y % 2) * 32;
      g2.fillStyle = `rgb(${v},${v - 2},${v - 6})`; g2.fillRect(((x * 64 + off) % 256) + 1, y * 32 + 1, 62, 30);
      if (x * 64 + off + 64 > 256) g2.fillRect(-1 + ((x * 64 + off) % 256) - 256, y * 32 + 1, 62, 30);
    }
    for (let i = 0; i < 4000; i++) { const v = Math.random() * 255; g2.fillStyle = `rgba(${v},${v},${v},0.08)`; g2.fillRect(Math.random() * 256, Math.random() * 256, 1, 1); }
  }, { repeat: true, srgb: false });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uDetail = { value: detail };
    sh.fragmentShader = 'uniform sampler2D uDetail;' + String.fromCharCode(10) + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      { vec3 dt = texture2D(uDetail, vMapUv * vec2(${cw / 4}.0, ${ch / 4}.0)).rgb;
        diffuseColor.rgb *= mix(vec3(1.0), dt * 1.25, 0.8); }`);
  };
  mat.customProgramCacheKey = () => 'ground';
  const geo = new THREE.PlaneGeometry(cw, ch).rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(geo, mat);
  ground.position.set(EXT.x0 + cw / 2, 0, EXT.z0 + ch / 2);
  ground.receiveShadow = true;
  scene.add(ground);
  // 바깥 땅 (도시 경계 너머) — 강줄기만 비워둔다
  const outerMat = stdMat(0x4e4c48, 1);
  const outer = (x0, z0, x1, z1) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), outerMat);
    m.position.set((x0 + x1) / 2, -0.03, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m);
  };
  outer(-6000, -6000, 8000, EXT.z0); outer(-6000, EXT.z1, 8000, 8000);
  outer(-6000, EXT.z0, EXT.x0, 676); outer(-6000, 964, EXT.x0, EXT.z1);
  outer(EXT.x1, EXT.z0, 8000, 676); outer(EXT.x1, 964, 8000, EXT.z1);
}

function roadTexture() {
  return canvasTex(128, 256, (g) => {
    g.fillStyle = '#34373b'; g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 2500; i++) { const v = 30 + Math.random() * 40; g.fillStyle = `rgba(${v},${v},${v + 4},0.5)`; g.fillRect(Math.random() * 128, Math.random() * 256, 1, 1); }
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(14, 0, 14, 256); g.fillRect(100, 0, 14, 256); g.fillRect(44, 0, 14, 256); g.fillRect(70, 0, 14, 256);
    g.fillStyle = '#d9b43a'; g.fillRect(61, 0, 2, 256); g.fillRect(65, 0, 2, 256);   // 중앙선 (황색 복선)
    g.fillStyle = '#e8e8e8';
    for (let y = 0; y < 256; y += 64) { g.fillRect(34, y, 2, 24); g.fillRect(92, y, 2, 24); } // 차선
    g.fillRect(4, 0, 2, 256); g.fillRect(122, 0, 2, 256);
  }, { repeat: true });
}
function crossTexture() {
  return canvasTex(192, 192, (g) => {
    g.fillStyle = '#34373b'; g.fillRect(0, 0, 192, 192);
    for (let i = 0; i < 3000; i++) { const v = 30 + Math.random() * 40; g.fillStyle = `rgba(${v},${v},${v + 4},0.5)`; g.fillRect(Math.random() * 192, Math.random() * 192, 1, 1); }
    g.fillStyle = '#e8e8e8';
    for (let i = 0; i < 16; i++) {
      const p = 34 + i * 8;
      g.fillRect(p, 2, 4, 26); g.fillRect(p, 164, 4, 26);     // 북/남 횡단보도
      g.fillRect(2, p, 26, 4); g.fillRect(164, p, 26, 4);     // 서/동
    }
    g.fillRect(32, 30, 64, 3); g.fillRect(96, 159, 64, 3); g.fillRect(30, 96, 3, 64); g.fillRect(159, 32, 3, 64); // 정지선
    g.clearRect(0, 0, 32, 32); g.clearRect(160, 0, 32, 32); g.clearRect(0, 160, 32, 32); g.clearRect(160, 160, 32, 32);
  });
}

function buildRoads() {
  const pos = [], uv = [], nrm = [], idx = [];
  const quad = (x0, z0, x1, z1, y, alongX) => {
    const b = pos.length / 3;
    pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
    for (let i = 0; i < 4; i++) nrm.push(0, 1, 0);
    if (alongX) { const L = (x1 - x0) / 32; uv.push(0, 0, 0, L, 1, L, 1, 0); }
    else { const L = (z1 - z0) / 32; uv.push(0, 0, 1, 0, 1, L, 0, L); }
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  };
  for (const x of VX) quad(x - RH, EXT.z0, x + RH, EXT.z1, 0.04, false);
  for (const z of HZ) quad(EXT.x0, z - RH, EXT.x1, z + RH, 0.05, true);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = stdMat(0xffffff, 0.88, 0, { map: roadTexture(), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const roads = new THREE.Mesh(geo, mat); roads.receiveShadow = true; scene.add(roads);
  // 교차로
  const imat = stdMat(0xffffff, 0.88, 0, { map: crossTexture(), alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const ig = new THREE.PlaneGeometry(24, 24).rotateX(-Math.PI / 2);
  const inter = new THREE.InstancedMesh(ig, imat, VX.length * HZ.length);
  const o = new THREE.Object3D(); let n = 0;
  for (const x of VX) for (const z of HZ) { o.position.set(x, 0.07, z); o.updateMatrix(); inter.setMatrixAt(n++, o.matrix); }
  inter.receiveShadow = true; inter.frustumCulled = false; scene.add(inter);
  // 연석
  const curbs = [];
  const segs = (list, cross) => {
    const out = []; const sorted = [...cross].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length - 1; i++) out.push([sorted[i] + RH, sorted[i + 1] - RH]);
    return out;
  };
  for (const x of VX) for (const [a, b] of segs(null, [EXT.z0 - RH, ...HZ, EXT.z1 + RH])) {
    if (a > 660 && b < 980) continue;
    for (const s of [-1, 1]) curbs.push([x + s * (RH + 0.15), (a + b) / 2, 0.3, b - a]);
  }
  for (const z of HZ) for (const [a, b] of segs(null, [EXT.x0 - RH, ...VX, EXT.x1 + RH])) {
    for (const s of [-1, 1]) {
      if ((z === 665 && s > 0) || (z === 975 && s < 0)) continue;
      curbs.push([(a + b) / 2, z + s * (RH + 0.15), b - a, 0.3]);
    }
  }
  const cm = new THREE.InstancedMesh(GEO.boxB, stdMat(0xb5b0a6, 0.8), curbs.length);
  curbs.forEach((c, i) => { o.position.set(c[0], 0, c[1]); o.scale.set(c[2], 0.16, c[3]); o.updateMatrix(); cm.setMatrixAt(i, o.matrix); });
  cm.receiveShadow = true; cm.frustumCulled = false; scene.add(cm);
}

function waterNormalTex() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S);
  const waves = [[3, 1, 0.5], [1, 4, 0.4], [5, -2, 0.25], [-4, 6, 0.18], [9, 3, 0.1], [2, -9, 0.1], [13, 7, 0.06]];
  const hgt = (x, y) => { let h = 0; for (const [a, b, amp] of waves) h += amp * Math.sin(2 * Math.PI * (a * x + b * y) / S + a * 1.7); return h; };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = hgt(x + 1, y) - hgt(x - 1, y), dy = hgt(x, y + 1) - hgt(x, y - 1);
    const n = new THREE.Vector3(-dx * 6, -dy * 6, 1).normalize();
    const i = (y * S + x) * 4;
    img.data[i] = (n.x * 0.5 + 0.5) * 255; img.data[i + 1] = (n.y * 0.5 + 0.5) * 255; img.data[i + 2] = (n.z * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = MAX_ANISO;
  return t;
}
function fenceMaterial() {
  const t = canvasTex(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64); g.fillStyle = '#c9ccce';
    g.fillRect(0, 2, 64, 5); g.fillRect(0, 30, 64, 3); g.fillRect(0, 60, 64, 4);
    for (let x = 2; x < 64; x += 8) g.fillRect(x, 2, 3, 62);
  }, { repeat: true });
  return stdMat(0xffffff, 0.5, 0.6, { map: t, alphaTest: 0.5, side: THREE.DoubleSide });
}
// 폴리라인을 따라 수직 띠 (벽/난간)
function vStrip(pts, y0, y1, uScale = 1) {
  const pos = [], uv = [], idx = [];
  let L = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    pos.push(pts[i][0], y0, pts[i][1], pts[i][0], y1, pts[i][1]);
    uv.push(L / uScale, 0, L / uScale, 1);
    if (i) { const b = (i - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// 폴리라인을 따라 수평 띠
function hStrip(pts, offA, offB, y) {
  const pos = [], idx = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], r0 = pts[Math.max(i - 1, 0)];
    let tx = q[0] - r0[0], tz = q[1] - r0[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const nx = -tz, nz = tx;
    pos.push(p[0] + nx * offA, y, p[1] + nz * offA, p[0] + nx * offB, y, p[1] + nz * offB);
    if (i) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function buildRiver() {
  const wn = waterNormalTex(); wn.repeat.set(1100, 24);
  const wmat = stdMat(0x0f2430, 0.14, 0.2, { normalMap: wn, normalScale: new THREE.Vector2(0.22, 0.22), envMapIntensity: 1.0 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(14000, 300).rotateX(-Math.PI / 2), wmat);
  water.position.set(900, WATER_Y, 820); water.receiveShadow = true; scene.add(water);
  WATER.normal = wn; WATER.mat = wmat;
  // 호수 (경회루 연못, 석촌호수)
  const lmat = stdMat(0x1d3a3f, 0.05, 0.1, { normalMap: wn, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 1.2 });
  for (const L of LAKES) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), lmat);
    m.scale.set(L.rx, 1, L.rz); m.position.set(L.x, -0.9, L.z); scene.add(m);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 40, 1, true), M.stone);
    wall.material = stdMat(0x8f887a, 0.9, 0, { side: THREE.BackSide });
    wall.scale.set(L.rx - 0.4, 1.2, L.rz - 0.4); wall.position.set(L.x, -0.55, L.z); scene.add(wall);
  }
  // 제방 벽 + 갓돌 + 난간
  const wallMat = stdMat(0x8a857b, 0.95, 0, { side: THREE.DoubleSide });
  const capMat = stdMat(0xb8b2a6, 0.8);
  const fence = fenceMaterial();
  for (const sgn of [-1, 1]) {
    const pts = [];
    for (let x = EXT.x0 - 60; x <= EXT.x1 + 60; x += 4) pts.push([x, riverZ(x) + sgn * RIVER_CUT]);
    const w = new THREE.Mesh(vStrip(pts, WATER_Y - 1.5, 0.02), wallMat); w.receiveShadow = true; scene.add(w);
    // 다리 구간을 피해서 갓돌/난간을 끊어 그린다
    let run = [];
    const flush = () => {
      if (run.length > 1) {
        const cap = new THREE.Mesh(hStrip(run, sgn > 0 ? -0.3 : 1.4, sgn > 0 ? 1.4 : -0.3, 0.08), capMat);
        cap.receiveShadow = true; scene.add(cap);
        const fp = run.map(p => [p[0], p[1] + sgn * 0.6]);
        const f = new THREE.Mesh(vStrip(fp, 0.08, 1.15, 1.2), fence); scene.add(f);
      }
      run = [];
    };
    for (let x = EXT.x0; x <= EXT.x1; x += 2) {
      if (bridgeIndex(x) >= 0 || Math.abs(x - VX[nearestIdx(VX, x)]) < BRIDGE_HW + 0.5) { flush(); continue; }
      run.push([x, riverZ(x) + sgn * RIVER_CUT]);
    }
    flush();
  }
  // 여의도 둘레
  const ip = [];
  for (let a = 0; a <= Math.PI * 2 + 0.001; a += Math.PI / 90) ip.push([YEOUIDO.x + Math.cos(a) * YEOUIDO.rx, YEOUIDO.z + Math.sin(a) * YEOUIDO.rz]);
  scene.add(new THREE.Mesh(vStrip(ip, WATER_Y - 1.5, 0.02), wallMat));
}

function buildBridges() {
  const batch = new Batch();
  const deckMat = stdMat(0x8d8f90, 0.85), pierMat = stdMat(0x7d7b76, 0.95), archMat = stdMat(0x9fb3c8, 0.45, 0.5);
  const fence = fenceMaterial();
  const fountainJets = [];
  VX.forEach((x, i) => {
    const zc = riverZ(x), zN = zc - RIVER_CUT - 4, zS = zc + RIVER_CUT + 4, L = zS - zN;
    batch.box(deckMat, BRIDGE_HW * 2, 1.6, L, x, -0.82, (zN + zS) / 2);
    batch.box(deckMat, BRIDGE_HW * 2 - 3, 0.8, L, x, -2.0, (zN + zS) / 2);
    for (const s of [-1, 1]) batch.box(M.concrete, 2.4, 0.2, L - 8, x + s * (RH + 1.2), 0.08, (zN + zS) / 2);
    for (let z = zN + 30; z < zS - 20; z += 42) {
      if (onIsland(x, z)) continue;
      batch.box(pierMat, 15, Math.abs(WATER_Y) + 1, 3, x, (WATER_Y - 2 - 1.6) / 2, z);
    }
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(vStrip([[x + s * (BRIDGE_HW - 0.1), zN + 4], [x + s * (BRIDGE_HW - 0.1), zS - 4]], 0.15, 1.3, 1.2), fence);
      scene.add(f);
      for (let z = zN + 10; z < zS - 6; z += 32) LAMPS.push({ x: x + s * (RH + 1.6), z, rot: s < 0 ? 0 : Math.PI, y: 0.18 });
    }
    // 아치교 (한강대교, 동작대교)
    if (BRIDGE_NAMES[i] === '한강대교' || BRIDGE_NAMES[i] === '동작대교') {
      for (const s of [-1, 1]) {
        const pts = [];
        for (let t = 0; t <= 1.0001; t += 0.05) pts.push(new THREE.Vector3(x + s * (BRIDGE_HW - 0.5), 0.2 + 24 * Math.sin(Math.PI * t), zc - 62 + 124 * t));
        const curve = new THREE.CatmullRomCurve3(pts);
        batch.add(new THREE.TubeGeometry(curve, 40, 0.55, 6), archMat);
        for (let t = 0.1; t < 0.95; t += 0.065) batch.box(archMat, 0.12, 24 * Math.sin(Math.PI * t), 0.12, x + s * (BRIDGE_HW - 0.5), 12 * Math.sin(Math.PI * t), zc - 62 + 124 * t);
      }
      for (let t = 0.25; t < 0.8; t += 0.12) batch.box(archMat, BRIDGE_HW * 2 - 1, 0.4, 0.4, x, 24 * Math.sin(Math.PI * t), zc - 62 + 124 * t);
    }
    if (BRIDGE_NAMES[i] === '반포대교') for (const s of [-1, 1]) for (let z = zN + 12; z < zS - 12; z += 3) fountainJets.push([x + s * (BRIDGE_HW + 0.3), -1.4, z, s]);
  });
  batch.build(scene, true);
  buildFountain(fountainJets);
}

// 반포대교 달빛무지개분수
function buildFountain(jets) {
  const PER = 26, N = jets.length * PER;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N * 4);
  let k = 0;
  for (const [x, y, z, s] of jets) for (let i = 0; i < PER; i++, k++) {
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
    seed[k * 4] = i / PER; seed[k * 4 + 1] = s; seed[k * 4 + 2] = Math.random(); seed[k * 4 + 3] = z;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.time, uScale: PARTICLE_SCALE, uOn: { value: 1 } },
    vertexShader: `attribute vec4 aSeed; uniform float uTime; uniform float uScale; varying vec3 vCol; varying float vA;
      vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0,4,2),6.0)-3.0)-1.0,0.0,1.0); }
      void main(){
        float T = 1.6; float t = mod(uTime * 0.55 + aSeed.x * T + aSeed.z * 0.05, T);
        vec3 p = position;
        float v0 = 10.0 + aSeed.z * 1.5;
        p.x += aSeed.y * v0 * 0.85 * t;
        p.y += 2.5 * t - 4.9 * t * t;
        vCol = hue(fract(aSeed.w * 0.004 + uTime * 0.05)) * 2.2 + 0.25;
        vA = smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(T * 0.7, T, t));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (0.9 + t * 0.9) * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float uOn; varying vec3 vCol; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        gl_FragColor = vec4(vCol, smoothstep(0.5, 0.0, d) * vA * 0.55 * uOn);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
  WORLD_FX.fountain = mat;
}

// 한강 유람선
const BOATS = [];
function buildBoats() {
  const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.8, 1.1) });
  const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 2.2, 3.0) });
  WORLD_FX.boatWin = winMat; WORLD_FX.boatLight = lightMat;
  for (let i = 0; i < 3; i++) {
    const b = new Batch(), grp = new THREE.Group();
    b.box(M.white, 30, 2.2, 8, 0, 1.1, 0); b.box(stdMat(0x24364a, 0.6), 30.4, 0.5, 8.4, 0, 0.25, 0);
    b.box(M.white, 20, 2.2, 6.5, -2, 3.3, 0); b.box(M.white, 10, 1.8, 5.5, -3, 5.3, 0);
    b.box(winMat, 19, 0.9, 6.6, -2, 3.5, 0); b.box(winMat, 9, 0.7, 5.6, -3, 5.4, 0);
    b.add(new THREE.ConeGeometry(4, 6, 4, 1).rotateZ(-Math.PI / 2).rotateX(Math.PI / 4), M.white, 17.5, 1.1, 0, 0, 1, 0.37, 1.4);
    for (let x = -14; x <= 14; x += 2) b.box(lightMat, 0.25, 0.25, 0.25, x, 6.4 - Math.abs(x) * 0.12, 0);
    b.build(grp, true);
    scene.add(grp);
    BOATS.push({ grp, x: -300 + i * 900, dir: i % 2 ? -1 : 1, lane: i % 2 ? 26 : -26, speed: 4 + i * 0.6 });
  }
}
function updateBoats(dt) {
  for (const b of BOATS) {
    b.x += b.dir * b.speed * dt;
    if (b.x > 2400) b.x = -600; if (b.x < -600) b.x = 2400;
    const z = riverZ(b.x) + b.lane, z2 = riverZ(b.x + b.dir * 5) + b.lane;
    b.grp.position.set(b.x, WATER_Y, z);
    b.grp.rotation.y = Math.atan2(-(z2 - z), b.dir * 5) + Math.sin(G.time * 0.7 + b.x) * 0.01;
  }
}
