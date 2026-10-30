// ============================================================
//  랜드마크: 경복궁, 광화문광장, 남산타워, 롯데월드타워, 여의도, 산
// ============================================================
function buildPalace() {
  const b = new Batch();
  const P = PALACE, x0 = 732, x1 = 868, z0 = 102, z1 = 238, WH = 4.2, T = 1.6;
  const wallMat = stdMat(0xb9ab92, 0.9), capMat = stdMat(0x3b403d, 0.8);
  const wall = (ax, az, bx, bz) => {
    const cx = (ax + bx) / 2, cz = (az + bz) / 2, w = Math.abs(bx - ax) || T, d = Math.abs(bz - az) || T;
    b.box(wallMat, w, WH, d, cx, WH / 2, cz);
    b.box(capMat, w + 0.9, 0.5, d + 0.9, cx, WH + 0.25, cz);
    addBox(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, WH + 0.5);
  };
  wall(x0, z0, x1, z0 + T); wall(x0, z0, x0 + T, z1); wall(x1 - T, z0, x1, z1);
  wall(x0, z1 - T, 784, z1); wall(816, z1 - T, x1, z1);
  // 광화문: 석축 (가운데 홍예문으로 통과)
  const gs = stdMat(0xa79f8f, 0.9);
  b.box(gs, 13.5, 6.5, 10, 790.75, 3.25, 238); addBox(784, 233, 797.5, 243, 6.5);
  b.box(gs, 13.5, 6.5, 10, 809.25, 3.25, 238); addBox(802.5, 233, 816, 243, 6.5);
  b.box(gs, 5, 2, 10, 800, 5.5, 238);
  for (const sx of [789.5, 810.5]) for (const sz of [232.9, 243.1]) b.box(M.black, 3.2, 3.6, 0.05, sx, 1.8, sz);
  hanok(b, 800, 238, 24, 7, 6.5, 3.4, 3.4, 2);
  // 현판 "光化門"
  const plaque = canvasTex(256, 96, (g) => {
    g.fillStyle = '#1a1a18'; g.fillRect(0, 0, 256, 96); g.strokeStyle = '#7a6a3a'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 90);
    g.fillStyle = '#e6c45a'; g.font = `bold 62px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('光化門', 128, 52);
  });
  const pm = new THREE.Mesh(GEO.plane, new THREE.MeshStandardMaterial({ map: plaque, roughness: 0.6, emissive: 0x332810, emissiveMap: plaque }));
  pm.scale.set(4.2, 1.6, 1); pm.position.set(800, 9.0, 241.6); scene.add(pm);
  // 흥례문 (기둥 사이로 통과)
  hanok(b, 800, 205, 22, 7, 0, 4, 3.2, 1, 0, true);
  for (const x of [789, 811]) addBox(x - 0.3, 201.5, x + 0.3, 208.5, 4);
  // 근정전 회랑 (남쪽 근정문만 열림)
  const rw = (ax, az, bx, bz) => {
    const cx = (ax + bx) / 2, cz = (az + bz) / 2, w = Math.abs(bx - ax) || 1, d = Math.abs(bz - az) || 1;
    b.box(M.lattice, w, 3.5, d, cx, 1.75, cz); addBox(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, 3.5);
    const rf = hanokRoof(Math.max(w, 2), Math.max(d, 2), 1.6, 1.2, 0.2); b.add(rf.geo, M.roofTile, cx, 3.5, cz);
  };
  rw(762, 112, 838, 113); rw(762, 112, 763, 196); rw(837, 112, 838, 196); rw(762, 195, 794, 196); rw(806, 195, 838, 196);
  hanok(b, 800, 195.5, 12, 4, 0, 3.6, 2.6, 1, 0, true);
  // 월대 + 근정전 (2층 지붕)
  b.box(M.stone, 44, 0.9, 44 - 0, 800, 0.45, 148); b.box(M.stone, 34, 0.9, 34, 800, 1.35, 148);
  hanok(b, 800, 149, 26, 16, 1.8, 6.5, 4.8, 2);
  addBox(787, 141, 813, 157, 14, 1.8);
  // 사정전, 강녕전 등 부속 건물
  hanok(b, 848, 130, 14, 9, 0, 4, 3, 1); addBox(841, 125.5, 855, 134.5, 6);
  hanok(b, 848, 172, 14, 9, 0, 4, 3, 1); addBox(841, 167.5, 855, 176.5, 6);
  hanok(b, 852, 215, 12, 8, 0, 3.6, 2.8, 1); addBox(846, 211, 858, 219, 6);
  // 경회루 (연못 위 누각)
  const L0 = LAKES[0];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) b.box(M.stone, 0.6, 2.6, 0.6, L0.x - 4.5 + i * 3, 0.4, L0.z - 7 + j * 3.5);
  b.box(M.wood, 12, 0.5, 17, L0.x, 1.9, L0.z);
  hanok(b, L0.x, L0.z, 11, 16, 2.1, 3, 3, 1);
  b.build(scene, true);
  // 궁궐 소나무
  for (let i = 0; i < 26; i++) addTree(rr(736, 758), rr(178, 232), rr(0.9, 1.3), 'park', 'pine');
  for (let i = 0; i < 22; i++) addTree(rr(842, 864), rr(140, 162), rr(0.9, 1.2), 'park', 'pine');
  for (let i = 0; i < 12; i++) addTree(rr(736, 760), rr(106, 122), rr(0.8, 1.1), 'park', 'pine');
}

function buildPlaza() {
  const b = new Batch();
  // 이순신 장군 동상
  b.box(M.granite, 5, 7, 5, 800, 3.5, 300); addBox(797.5, 297.5, 802.5, 302.5, 7);
  b.add(GEO.cyl, M.bronze, 800, 8.6, 300, 0, 1.1, 3.2, 1.1);
  b.add(GEO.cyl, M.bronze, 800, 10.9, 300, 0, 0.8, 1.6, 0.8);
  b.add(GEO.sphere, M.bronze, 800, 12.15, 300, 0, 0.45, 0.5, 0.45);
  b.add(new THREE.ConeGeometry(0.55, 0.7, 8), M.bronze, 800, 12.7, 300);
  b.box(M.bronze, 0.14, 3.4, 0.14, 800, 9.9, 301.1);
  b.box(M.bronze, 0.7, 0.2, 0.2, 800, 11.2, 301.0);
  // 세종대왕 동상
  b.box(M.granite, 9, 3.5, 7, 800, 1.75, 362); addBox(795.5, 358.5, 804.5, 365.5, 3.5);
  b.box(M.gold, 3.6, 1.2, 3.0, 800, 4.1, 362);
  b.box(M.gold, 2.6, 2.6, 1.9, 800, 5.9, 361.6);
  b.add(GEO.sphere, M.gold, 800, 7.8, 361.6, 0, 0.62, 0.7, 0.62);
  b.box(M.gold, 1.0, 0.5, 1.0, 800, 8.5, 361.6);
  // 벤치 · 화단 경계석
  for (let z = 270; z < 395; z += 18) for (const x of [770, 830]) { b.box(M.wood, 4, 0.45, 1.2, x, 0.45, z); b.box(M.darkMetal, 3.6, 0.4, 0.8, x, 0.2, z); }
  b.build(scene, true);
  for (let z = 264; z < 398; z += 10) for (const x of [744, 856]) addTree(x + rr(-1, 1), z, rr(1.0, 1.2), 'street');
}

function buildNamsan() {
  const S = NAMSAN.r * 2 + 30, N = 200;
  const geo = new THREE.PlaneGeometry(S, S, N, N).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3), c = new THREE.Color();
  const cA = new THREE.Color('#3f5a2c'), cB = new THREE.Color('#5c6e30'), cC = new THREE.Color('#7a5a2a');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + NAMSAN.x, z = pos.getZ(i) + NAMSAN.z;
    const h = hillH(x, z);
    pos.setY(i, h < 0 ? -0.6 : h);
    const n = fbm(x * 0.05, z * 0.05, 3);
    c.copy(cA).lerp(cB, n).lerp(cC, Math.max(0, fbm(x * 0.03 + 9, z * 0.03, 2) - 0.55) * 1.6);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const hill = new THREE.Mesh(geo, stdMat(0xffffff, 1, 0, { vertexColors: true }));
  hill.position.set(NAMSAN.x, 0, NAMSAN.z); hill.receiveShadow = true; hill.castShadow = true;
  scene.add(hill);
  // 숲
  for (let i = 0; i < 900; i++) {
    const a = srnd() * Math.PI * 2, d = Math.sqrt(srnd()) * (NAMSAN.r - 6);
    const x = NAMSAN.x + Math.cos(a) * d, z = NAMSAN.z + Math.sin(a) * d;
    if (d < 20 || hillH(x, z) < 1.5) continue;
    addTree(x, z, rr(0.9, 1.5), 'mountain', chance(0.3) ? 'pine' : 'broad');
  }
  // 터널 입구
  const b = new Batch();
  for (const cr of CROSSINGS) for (const end of [cr.a0, cr.a1]) {
    const out = end === cr.a0 ? -1 : 1;
    const along = end + out * 0.5;
    const px = cr.axis === 'v' ? cr.c : along, pz = cr.axis === 'v' ? along : cr.c;
    const ry = cr.axis === 'v' ? 0 : Math.PI / 2;
    const off = (lx) => cr.axis === 'v' ? [px + lx, pz] : [px, pz + lx];
    for (const s of [-1, 1]) { const [x, z] = off(s * (RH + 1.5)); b.box(M.concrete, cr.axis === 'v' ? 3 : 3, 9, 3, x, 4.5, z, ry); }
    const [tx, tz] = off(0); b.box(M.concrete, cr.axis === 'v' ? ROAD_W + 6 : 3, 2.5, cr.axis === 'v' ? 3 : ROAD_W + 6, tx, 7.75, tz);
    const [dx, dz] = cr.axis === 'v' ? [px, pz - out * 1.2] : [px - out * 1.2, pz];
    b.box(M.black, cr.axis === 'v' ? ROAD_W + 1 : 0.2, 6.6, cr.axis === 'v' ? 0.2 : ROAD_W + 1, dx, 3.3, dz);
    if (cr.axis === 'v') addBox(px - RH - 3, pz - 1.5, px + RH + 3, pz + 1.5, 9);
    else addBox(px - 1.5, pz - RH - 3, px + 1.5, pz + RH + 3, 9);
  }
  // N서울타워
  const base = NAMSAN.h - 0.8, X = NAMSAN.x, Z = NAMSAN.z;
  b.add(GEO.cyl, M.white, X, base + 4, Z, 0, 8, 8, 8);
  b.add(new THREE.CylinderGeometry(1.5, 2.8, 62, 20), M.white, X, base + 8 + 31, Z);
  b.add(GEO.cyl, M.white, X, base + 69.5, Z, 0, 6.6, 3, 6.6);
  b.add(GEO.cyl, stdMat(0x1c2a36, 0.2, 0.8), X, base + 74.5, Z, 0, 7.6, 7, 7.6);
  b.add(GEO.cyl, M.white, X, base + 79.5, Z, 0, 6.2, 3, 6.2);
  b.add(new THREE.ConeGeometry(6.2, 3, 24), M.white, X, base + 82.5, Z);
  for (let i = 0; i < 6; i++) b.add(GEO.cyl, i % 2 ? M.white : stdMat(0xc0392b, 0.6), X, base + 85.5 + i * 5, Z, 0, 0.9 - i * 0.1, 5, 0.9 - i * 0.1);
  b.build(scene, true);
  addBox(X - 8, Z - 8, X + 8, Z + 8, base + 120, base - 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 1, 3) });
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(7.7, 7.7, 1.2, 40, 1, true), ringMat);
  ring.position.set(X, base + 77.4, Z); scene.add(ring);
  const ring2 = ring.clone(); ring2.position.y = base + 71.6; scene.add(ring2);
  const topLight = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.3, 0.2) }));
  topLight.position.set(X, base + 116, Z); scene.add(topLight);
  WORLD_FX.towerRing = ringMat; WORLD_FX.towerTop = topLight.material;
}

function buildLotte() {
  // 롯데월드타워: 위로 갈수록 가늘어지는 사각 타워
  const H = 250, cx = 1600, cz = 1050;
  let g = new THREE.CylinderGeometry(1, 1, H, 4, 30).rotateY(Math.PI / 4).translate(0, H / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / H, r = 21.2 * (1 - 0.8 * Math.pow(t, 1.5));
    p.setX(i, p.getX(i) * r); p.setZ(i, p.getZ(i) * r);
  }
  g = g.toNonIndexed(); g.computeVertexNormals();
  const tower = new THREE.Mesh(g, BMAT.lotte);
  tower.position.set(cx, 0, cz); tower.castShadow = tower.receiveShadow = true; scene.add(tower);
  addBox(cx - 15, cz - 15, cx + 15, cz + 15, H);
  const b = new Batch();
  const topR = 21.2 * 0.2 / Math.SQRT2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(M.metal, 0.5, 26, 0.5, cx + sx * topR * 0.9, H + 12, cz + sz * topR * 0.9);
  b.add(new THREE.CylinderGeometry(0.15, 0.6, 24, 6), M.metal, cx, H + 36, cz);
  b.build(scene, true);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(topR * 2 + 0.6, 1, topR * 2 + 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 2.5, 4) }));
  crown.position.set(cx, H + 1, cz); scene.add(crown);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.3, 0.2) }));
  tip.position.set(cx, H + 48, cz); scene.add(tip);
  WORLD_FX.lotteCrown = crown.material;
  AVIATION.push({ x: cx, y: H + 48, z: cz });
  // 롯데몰 저층부
  addBuilding('glass', 1540, 1072, 1660, 1104, 24, '#7d8b96');
  addBuilding('office', 1545, 994, 1580, 1030, 32, '#c9c2b5');
  addBuilding('office', 1620, 994, 1662, 1028, 28, '#bdb8ae');
  for (let x = 1536; x < 1668; x += 9) addTree(x, 1066, 1.0, 'street');
  // 석촌호수 매직아일랜드 성
  const c = new Batch(), pink = stdMat(0xf2b8c6, 0.6), blue = stdMat(0x5b7fc4, 0.5), win = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.2) });
  const mx = 1566, mz = 1200;
  c.add(GEO.cyl, M.white, mx, 4, mz, 0, 3.5, 8, 3.5);
  c.add(new THREE.ConeGeometry(4.2, 7, 16), blue, mx, 11.5, mz);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.4, x = mx + Math.cos(a) * 5, z = mz + Math.sin(a) * 5;
    c.add(GEO.cyl, pink, x, 3, z, 0, 1.4, 6, 1.4); c.add(new THREE.ConeGeometry(1.8, 4, 12), blue, x, 8, z);
    c.box(win, 0.5, 0.9, 0.5, x + Math.cos(a) * 1.3, 4, z + Math.sin(a) * 1.3);
  }
  c.build(scene, true);
  addBox(mx - 8, mz - 8, mx + 8, mz + 8, 12);
  for (let a = 0; a < Math.PI * 2; a += 0.21) {
    for (const L of LAKES.slice(1)) addTree(L.x + Math.cos(a) * (L.rx + 5), L.z + Math.sin(a) * (L.rz + 5), rr(0.9, 1.2), 'park');
  }
}

function buildYeouido() {
  const z = YEOUIDO.z;
  addBuilding('gold', 628, z - 9, 652, z + 9, 118, '#e2b04e');
  addBuilding('gold', 632, z - 6, 648, z + 6, 7, '#e2b04e', 118, false);
  addBuilding('glass', 576, z - 22, 596, z - 4, 92, '#6e7a84');
  addBuilding('glass', 578, z + 4, 600, z + 20, 70, '#56636e');
  addBuilding('glass', 524, z - 16, 544, z + 2, 56, '#7b8a95');
  addBuilding('office', 600, z - 6, 620, z + 14, 30, '#c9c2b5');
  // 국회의사당
  const b = new Batch();
  b.box(M.white, 36, 9, 26, 470, 4.5, z); addBox(452, z - 13, 488, z + 13, 16);
  for (let i = 0; i < 12; i++) b.add(GEO.cyl, M.white, 455.5 + i * 2.6, 4.5, z + 13.6, 0, 0.5, 9, 0.5);
  b.box(M.white, 20, 3, 16, 470, 10.5, z);
  b.add(new THREE.SphereGeometry(9, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), stdMat(0x5f8e7c, 0.45, 0.4), 470, 12, z, 0, 1, 0.7, 1);
  b.build(scene, true);
  for (let a = 0; a < Math.PI * 2; a += 0.07) {
    const x = YEOUIDO.x + Math.cos(a) * (YEOUIDO.rx - 7), zz = z + Math.sin(a) * (YEOUIDO.rz - 5);
    if (Math.abs(x - 560) > 14) addTree(x, zz, rr(0.9, 1.3), 'park');
  }
}

function buildMountains() {
  const cx = 900, cz = 720, SA = 220, SR = 12, r0 = 1950, r1 = 3600;
  const pos = [], col = [], idx = [], c = new THREE.Color();
  const peaks = [[-Math.PI / 2, 330, 0.45], [-Math.PI / 2 - 0.5, 230, 0.25], [Math.PI / 2, 260, 0.35], [-2.4, 180, 0.3], [-0.9, 200, 0.3], [2.3, 170, 0.3]];
  for (let i = 0; i <= SA; i++) {
    const a = (i / SA) * Math.PI * 2 - Math.PI;
    let base = 110 + 130 * fbm(Math.cos(a) * 3 + 5, Math.sin(a) * 3 + 5, 4);
    for (const [pa, ph, pw] of peaks) base += ph * Math.exp(-((wrapAngle(a - pa) / pw) ** 2));
    const river = 1 - 0.85 * (Math.exp(-((wrapAngle(a) / 0.16) ** 2)) + Math.exp(-((wrapAngle(a - Math.PI) / 0.16) ** 2)));
    for (let j = 0; j <= SR; j++) {
      const t = j / SR, r = lerp(r0, r1, t);
      const bell = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.25)), 1.2);
      const h = Math.max(0, base * bell * river * (0.75 + 0.5 * fbm(Math.cos(a) * 9 + t * 4, Math.sin(a) * 9, 3)) - 4);
      pos.push(cx + Math.cos(a) * r, h - 2, cz + Math.sin(a) * r);
      c.set('#2c3a2e').lerp(new THREE.Color('#4a4a3a'), clamp(h / 400, 0, 1));
      col.push(c.r, c.g, c.b);
      if (i < SA && j < SR) { const q = i * (SR + 1) + j; idx.push(q, q + 1, q + SR + 1, q + 1, q + SR + 2, q + SR + 1); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, stdMat(0xffffff, 1, 0, { vertexColors: true, side: THREE.DoubleSide }));
  scene.add(m);
}
