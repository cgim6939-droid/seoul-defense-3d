// ============================================================
//  한국의 명소 추가: 숭례문, 동대문디자인플라자, 서울월드컵경기장, 청와대, 북촌 한옥마을, 태극기, 해태상
// ============================================================
const FLAGS = [];
function taegeukgiTex() {
  return canvasTex(300, 200, (g) => {
    g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, 300, 200);
    g.translate(150, 100);
    g.fillStyle = '#cd2e3a'; g.beginPath(); g.arc(0, 0, 40, Math.PI, 0); g.fill();
    g.fillStyle = '#0047a0'; g.beginPath(); g.arc(0, 0, 40, 0, Math.PI); g.fill();
    g.fillStyle = '#cd2e3a'; g.beginPath(); g.arc(-20, 0, 20, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0047a0'; g.beginPath(); g.arc(20, 0, 20, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#cd2e3a'; g.beginPath(); g.arc(-20, 0, 20, Math.PI, 0); g.fill();
    g.fillStyle = '#0047a0'; g.beginPath(); g.arc(20, 0, 20, 0, Math.PI); g.fill();
    // 4괘 (건 곤 감 리)
    const tri = (ang, pattern) => {
      g.save(); g.rotate(ang); g.translate(0, -78); g.fillStyle = '#111';
      for (let i = 0; i < 3; i++) {
        const y = (i - 1) * 9;
        if (pattern[i]) g.fillRect(-18, y - 3, 36, 6);
        else { g.fillRect(-18, y - 3, 15, 6); g.fillRect(3, y - 3, 15, 6); }
      }
      g.restore();
    };
    const a = Math.atan2(100, 150) - Math.PI / 2;  // 대각선 방향
    for (const [sx, sy, pat] of [[-1, -1, [1, 1, 1]], [1, 1, [0, 0, 0]], [1, -1, [0, 1, 0]], [-1, 1, [1, 0, 1]]]) {
      g.save(); g.translate(sx * 110, sy * 62); g.rotate(Math.atan2(sy * 62, sx * 110) + Math.PI / 2); g.translate(0, 78); tri(0, pat); g.restore();
    }
  }, { aniso: false });
}
function addFlag(x, z, h = 9, rot = 0) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, h, 8), M.metal); pole.position.set(x, h / 2, z); scene.add(pole);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), M.gold); ball.position.set(x, h + 0.1, z); scene.add(ball);
  const hinge = new THREE.Group(); hinge.position.set(x, h - 1.4, z); hinge.rotation.y = rot; scene.add(hinge);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 2.2, 8, 1).translate(1.65, 0, 0), FLAGS.mat); flag.castShadow = false; hinge.add(flag);
  FLAGS.push({ hinge, base: rot, ph: Math.random() * 6 });
}
function animateFlags(t) { for (const f of FLAGS) f.hinge.rotation.y = f.base + Math.sin(t * 2.2 + f.ph) * 0.28; }

function buildNamdaemun() {
  const b = new Batch(), cx = 800, cz = 485, stone = stdMat(0x9a9484, 0.9), dark = stdMat(0x2b2a26, 0.9);
  b.box(stone, 12, 7, 14, 791, 3.5, cz); b.box(stone, 12, 7, 14, 809, 3.5, cz); b.box(stone, 6.2, 2.2, 14, 800, 5.9, cz);
  addBox(785, cz - 7, 797, cz + 7, 7); addBox(803, cz - 7, 815, cz + 7, 7);
  for (const [x0, x1] of [[733, 785], [815, 867]]) {
    const w = x1 - x0, mx = (x0 + x1) / 2;
    b.box(stone, w, 6, 5, mx, 3, cz); addBox(x0, cz - 2.5, x1, cz + 2.5, 6);
    for (let x = x0 + 1.5; x < x1 - 1; x += 3.6) for (const s of [-1, 1]) b.box(stone, 2, 1.1, 1.0, x, 6.55, cz + s * 2);
  }
  b.box(dark, 6, 0.2, 14, 800, 0.1, cz);
  hanok(b, cx, cz, 26, 11, 7, 4.4, 4.8, 2);
  addBox(787, cz - 5.5, 813, cz + 5.5, 17, 7);
  b.build(scene, true);
  const plaque = canvasTex(256, 96, (g) => {
    g.fillStyle = '#16140f'; g.fillRect(0, 0, 256, 96); g.strokeStyle = '#8a7438'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 90);
    g.fillStyle = '#e8c860'; g.font = 'bold 60px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('崇禮門', 128, 52);
  });
  for (const s of [1, -1]) {
    const pm = new THREE.Mesh(GEO.plane, new THREE.MeshStandardMaterial({ map: plaque, roughness: 0.6, emissive: 0x302510, emissiveMap: plaque }));
    pm.scale.set(4.4, 1.7, 1); pm.position.set(cx, 10.6, cz + s * 5.4); pm.rotation.y = s > 0 ? 0 : Math.PI; scene.add(pm);
  }
  for (let i = 0; i < 8; i++) addTree(rr(740, 860), rr(430, 470), rr(1, 1.3), 'park', 'pine');
  addFlag(776, 500, 9, 0.2); addFlag(824, 500, 9, 0.2);
}

function buildDDP() {
  const cx = 1280, cz = 330, b = new Batch(), silver = stdMat(0xe6eaf0, 0.2, 0.95);
  const blobs = [[0, 7, 0, 62, 9, 42, 0.15], [-30, 10, 22, 30, 12, 22, -0.4], [30, 9, -22, 34, 10, 22, 0.5], [-8, 5, -6, 46, 7, 30, 0], [40, 6, 18, 22, 8, 16, 0.8], [-42, 6, -14, 20, 7, 14, -0.6], [8, 12, 16, 24, 8, 14, 0.2]];
  for (const [x, y, z, sx, sy, sz, ry] of blobs) b.add(GEO.sphere, silver, cx + x, y, cz + z, ry, sx, sy, sz);
  b.build(scene, true);
  const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.6, 4) });
  for (const [y, rx, rz] of [[12, 51, 35], [8.4, 60, 41], [15, 33, 23]]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 96).rotateX(Math.PI / 2), led); r.scale.set(rx, 1, rz); r.position.set(cx, y, cz); scene.add(r);
  }
  WORLD_FX.ddpLed = led;
  addBox(cx - 58, cz - 40, cx + 58, cz + 40, 14);
  for (let i = 0; i < 10; i++) addTree(1226 + i * 11, 272, 1, 'street');
}

function buildStadium() {
  const cx = 320, cz = 330, KZ = 0.85, scene_add = (m) => { m.scale.z = KZ; m.position.set(cx, 0, cz); scene.add(m); return m; };
  const seatTex = canvasTex(128, 128, (g) => {
    g.fillStyle = '#2f5fb5'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 8) for (let x = 0; x < 128; x += 8) { g.fillStyle = (x + y) % 16 ? '#dfe6f2' : '#c0392b'; if ((x * 7 + y * 3) % 5 < 2) g.fillRect(x + 1, y + 1, 6, 6); }
  }, { repeat: true });
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([[41, 0.1], [44, 2], [54, 11], [59, 17], [61, 19]].map(([x, y]) => new THREE.Vector2(x, y)), 72), stdMat(0xffffff, 0.8, 0, { map: seatTex, side: THREE.DoubleSide }));
  seatTex.repeat.set(36, 3); bowl.castShadow = bowl.receiveShadow = true; scene_add(bowl);
  const wall = new THREE.Mesh(new THREE.LatheGeometry([[61, 19.2], [63, 19.2], [63, 0], [61, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 72), stdMat(0xd8dce2, 0.6, 0.2, { side: THREE.DoubleSide }));
  wall.castShadow = true; scene_add(wall);
  const pitchTex = canvasTex(256, 256, (g) => { for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#3a7d3c' : '#2f6e33'; g.fillRect(0, i * 25.6, 256, 25.6); } g.strokeStyle = '#eee'; g.lineWidth = 3; g.strokeRect(14, 14, 228, 228); g.beginPath(); g.moveTo(14, 128); g.lineTo(242, 128); g.stroke(); g.beginPath(); g.arc(128, 128, 30, 0, 6.29); g.stroke(); });
  const pitch = new THREE.Mesh(new THREE.CircleGeometry(40.5, 48).rotateX(-Math.PI / 2), stdMat(0xffffff, 0.95, 0, { map: pitchTex })); pitch.position.y = 0.12; pitch.receiveShadow = true; scene_add(pitch);
  const roof = new THREE.Mesh(new THREE.LatheGeometry([[44, 23], [58, 25], [64, 24]].map(([x, y]) => new THREE.Vector2(x, y)), 72), stdMat(0xf2f4f7, 0.5, 0.1, { side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
  roof.castShadow = true; scene_add(roof);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(61, 0.35, 6, 96).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 2.4, 4) })); rim.position.y = 19.6; scene_add(rim);
  const b = new Batch(), mast = stdMat(0xe8ebee, 0.4, 0.5);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, x = cx + Math.cos(a) * 66, z = cz + Math.sin(a) * 66 * KZ;
    b.add(GEO.cyl, mast, x, 17, z, 0, 0.55, 34, 0.55);
    b.add(GEO.cyl, mast, (x + cx + Math.cos(a) * 52) / 2, 29, (z + cz + Math.sin(a) * 52 * KZ) / 2, -a, 0.12, 1, 0.12, 0, 0);
  }
  b.build(scene, true);
  addBox(cx - 64, cz - 55, cx + 64, cz + 55, 20);
}

function buildBluehouse() {
  const b = new Batch(), cz = 48;
  b.box(M.granite, 64, 0.6, 34, 800, 0.3, 52);
  hanok(b, 800, cz, 44, 20, 0.6, 6.5, 7.5, 2, 0, false, M.roofBlue);
  hanok(b, 758, cz + 3, 16, 12, 0.6, 4, 4, 1, 0, false, M.roofBlue);
  hanok(b, 842, cz + 3, 16, 12, 0.6, 4, 4, 1, 0, false, M.roofBlue);
  for (let x = 768; x <= 832; x += 8) b.add(GEO.cyl, M.white, x, 3.5, cz + 11, 0, 0.45, 6.5, 0.45);
  b.build(scene, true);
  addBox(776, cz - 10, 824, cz + 10, 16); addBox(750, cz - 3, 766, cz + 9, 8); addBox(834, cz - 3, 850, cz + 9, 8);
  for (let i = 0; i < 14; i++) addTree(rr(740, 860), rr(8, 28), rr(1, 1.4), 'park', 'pine');
  addFlag(782, 66, 9, 0.2); addFlag(818, 66, 9, 0.2);
}

function buildBukchon() {
  const b = new Batch(), wall = stdMat(0xa59b86, 0.95);
  for (let gx = 0; gx < 5; gx++) for (let gz = 0; gz < 4; gz++) {
    const x = 909 + gx * 26 + rr(-1.5, 1.5), z = 119 + gz * 32 + rr(-2, 2);
    if (chance(0.12)) { addTree(x, z, 1.3, 'park', chance(0.5) ? 'pine' : 'broad'); continue; }
    const w = rr(10, 14), d = rr(7, 9);
    hanok(b, x, z, w, d, 0, 3.0, 2.8, 1, 0);
    addBox(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 6);
    b.box(wall, w + 6, 1.7, 0.6, x, 0.85, z + d / 2 + 3.4); addBox(x - w / 2 - 3, z + d / 2 + 3.1, x + w / 2 + 3, z + d / 2 + 3.7, 1.7);
    b.box(wall, 0.6, 1.7, 6.6, x - w / 2 - 3, 0.85, z + d / 2 + 0.2); b.box(wall, 0.6, 1.7, 6.6, x + w / 2 + 3, 0.85, z + d / 2 + 0.2);
  }
  b.build(scene, true);
}

function buildHaechi() {
  const b = new Batch(), st = stdMat(0xb4ad9c, 0.85);
  for (const s of [-1, 1]) {
    const x = 800 + s * 15, z = 252;
    b.box(st, 3.2, 1.4, 3.6, x, 0.7, z); b.box(st, 2.2, 2.0, 2.8, x, 2.4, z);
    b.add(GEO.sphere, st, x, 4.0, z + 0.4, 0, 0.9, 0.9, 0.9); b.add(GEO.sphere, st, x, 3.1, z + 0.9, 0, 0.7, 0.9, 0.9);
    for (const k of [-0.7, 0.7]) b.add(GEO.sphere, st, x + k, 4.5, z + 0.3, 0, 0.18, 0.4, 0.18);
    addBox(x - 1.6, z - 1.8, x + 1.6, z + 1.8, 4);
  }
  b.build(scene, true);
}

function buildKorea() {
  const tex = taegeukgiTex();
  FLAGS.mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide });
  buildNamdaemun(); buildDDP(); buildStadium(); buildBluehouse(); buildBukchon(); buildHaechi();
  addFlag(784, 254, 10, 0.15); addFlag(816, 254, 10, 0.15);
  for (const z of [285, 320, 355, 390]) for (const x of [742, 858]) addFlag(x, z, 8, x < 800 ? 0.2 : Math.PI - 0.2);
}
