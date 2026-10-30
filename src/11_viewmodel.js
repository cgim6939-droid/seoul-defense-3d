// ============================================================
//  1인칭 무기 모델 (K5 권총 / K2 소총 / 산탄총) + 디지털 무늬 전투복 팔
// ============================================================
const WEAPONS = [
  { id: 'pistol', name: 'K5 권총', auto: false, dmg: 34, head: 2.2, rpm: 420, mag: 15, reload: 1.35, spread: 0.012, ads: 0.003, move: 0.02, pellets: 1, recoil: 0.028, recoilYaw: 0.008, range: 140, fov: 62, falloff: 60 },
  { id: 'rifle', name: 'K2 소총', auto: true, dmg: 25, head: 2.0, rpm: 700, mag: 30, reload: 2.1, spread: 0.02, ads: 0.004, move: 0.03, pellets: 1, recoil: 0.017, recoilYaw: 0.009, range: 260, fov: 50, falloff: 120 },
  { id: 'shotgun', name: '산탄총', auto: false, dmg: 13, head: 1.5, rpm: 75, mag: 7, shell: 0.5, spread: 0.075, ads: 0.055, move: 0.02, pellets: 10, recoil: 0.075, recoilYaw: 0.012, range: 55, fov: 66, falloff: 14 },
];
const VMS = [];
function noiseCanvas(base, specks, size = 256) {
  return (g) => {
    g.fillStyle = base; g.fillRect(0, 0, size, size);
    for (const [col, n, s0, s1] of specks) for (let i = 0; i < n; i++) { g.fillStyle = col; const s = s0 + Math.random() * (s1 - s0); g.fillRect(Math.random() * size, Math.random() * size, s, s); }
  };
}
function buildViewmodels() {
  const T = {
    metal: canvasTex(256, 256, noiseCanvas('#3c3f44', [['rgba(255,255,255,0.05)', 2500, 1, 2], ['rgba(0,0,0,0.12)', 1500, 1, 3], ['rgba(160,165,170,0.25)', 120, 1, 4]])),
    metalR: canvasTex(128, 128, noiseCanvas('#909090', [['rgba(40,40,40,0.4)', 300, 1, 5], ['rgba(220,220,220,0.3)', 400, 1, 2]], 128), { srgb: false }),
    poly: canvasTex(128, 128, noiseCanvas('#1d1e20', [['rgba(255,255,255,0.06)', 2500, 1, 2], ['rgba(0,0,0,0.3)', 1200, 1, 2]], 128)),
    camo: canvasTex(128, 128, (g) => {
      const cols = ['#56603f', '#6f7550', '#353b29', '#7d6d4c'];
      g.fillStyle = cols[0]; g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 380; i++) { g.fillStyle = cols[(Math.random() * 4) | 0]; const x = (Math.random() * 32 | 0) * 4, y = (Math.random() * 32 | 0) * 4; g.fillRect(x, y, 4 * (1 + (Math.random() * 3 | 0)), 4 * (1 + (Math.random() * 2 | 0))); }
      for (let y = 0; y < 128; y += 6) { g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, y, 128, 1); }
    }, { repeat: true }),
    glove: canvasTex(128, 128, (g) => {
      noiseCanvas('#2b2a26', [['rgba(255,255,255,0.04)', 1500, 1, 2]], 128)(g);
      g.strokeStyle = 'rgba(120,110,90,0.35)'; g.lineWidth = 1; for (let x = 12; x < 128; x += 28) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 4, 128); g.stroke(); }
    }),
    wood: canvasTex(256, 64, (g) => {
      g.fillStyle = '#5a3a24'; g.fillRect(0, 0, 256, 64);
      for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(${30 + Math.random() * 30},${18 + Math.random() * 15},10,0.5)`; g.lineWidth = 0.6 + Math.random(); g.beginPath(); let y = Math.random() * 64; g.moveTo(0, y); for (let x = 0; x <= 256; x += 16) { y += (Math.random() - 0.5) * 3; g.lineTo(x, y); } g.stroke(); }
    }),
  };
  const metal = new THREE.MeshPhysicalMaterial({ map: T.metal, bumpMap: T.metal, bumpScale: 0.8, roughnessMap: T.metalR, roughness: 0.5, metalness: 0.88, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const metalD = new THREE.MeshStandardMaterial({ map: T.metal, roughness: 0.5, metalness: 0.8, color: 0x8a8a8a });
  const poly = new THREE.MeshStandardMaterial({ map: T.poly, bumpMap: T.poly, bumpScale: 1.2, roughness: 0.72, metalness: 0.05 });
  const polyG = new THREE.MeshStandardMaterial({ map: T.poly, roughness: 0.7, metalness: 0.05, color: 0x9aa38a });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
  const glove = new THREE.MeshStandardMaterial({ map: T.glove, roughness: 0.9 });
  const sleeve = new THREE.MeshStandardMaterial({ map: T.camo, roughness: 0.95 });
  const wood = new THREE.MeshStandardMaterial({ map: T.wood, roughness: 0.55, metalness: 0.05 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.3, metalness: 1 });
  const shellRed = new THREE.MeshStandardMaterial({ color: 0x9a1c18, roughness: 0.5 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const add = (p, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); p.add(o); return o; };
  const rb = (p, m, w, h, d, x, y, z, r = 0.004, rx = 0, ry = 0, rz = 0) => add(p, new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2.1, h / 2.1, d / 2.1)), m, x, y, z, rx, ry, rz);
  const cz = (p, m, r1, r2, len, x, y, z, seg = 32, open = false) => add(p, new THREE.CylinderGeometry(r1, r2, len, seg, 1, open).rotateX(Math.PI / 2), m, x, y, z);
  const capsule = (p, m, a, b, r) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
    const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 4, 12), m);
    o.position.copy(A).add(B).multiplyScalar(0.5); o.lookAt(B); o.rotateX(Math.PI / 2); p.add(o); return o;
  };
  // 손: 손바닥 + 손가락 4개(감싸 쥠) + 엄지
  const hand = (p, at, wrapDir, fingerLen = 0.045, spread = 0.019, thumb = true) => {
    const [x, y, z] = at;
    rb(p, glove, 0.062, 0.075, 0.095, x, y, z, 0.02);
    for (let i = 0; i < 4; i++) {
      const fz = z - 0.03 + i * spread, fx = x + wrapDir * 0.035;
      capsule(p, glove, [fx, y + 0.02, fz], [fx + wrapDir * 0.012, y - fingerLen, fz - 0.006], 0.011);
    }
    if (thumb) capsule(p, glove, [x - wrapDir * 0.03, y + 0.02, z - 0.02], [x - wrapDir * 0.02, y + 0.035, z - 0.065], 0.012);
  };
  const arm = (p, wrist, elbow) => {
    capsule(p, sleeve, wrist, elbow, 0.05);
    const W = new THREE.Vector3(...wrist), E = new THREE.Vector3(...elbow);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.053, 0.053, 0.03, 14), glove);
    cuff.position.copy(W.clone().lerp(E, 0.08)); cuff.lookAt(E); cuff.rotateX(Math.PI / 2); p.add(cuff);
  };
  const flashTex = canvasTex(128, 128, (g) => {
    g.translate(64, 64);
    for (let i = 0; i < 7; i++) { g.rotate(Math.PI * 2 / 7); const gr = g.createLinearGradient(0, 0, 0, -60); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(1, 'rgba(255,160,60,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(-7, 0); g.lineTo(0, -60 - Math.random() * 6); g.lineTo(7, 0); g.fill(); }
    const r = g.createRadialGradient(0, 0, 0, 0, 0, 30); r.addColorStop(0, 'rgba(255,255,230,1)'); r.addColorStop(1, 'rgba(255,180,80,0)'); g.fillStyle = r; g.fillRect(-64, -64, 128, 128);
  }, { aniso: false });
  const mkFlash = (p, x, y, z) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, color: new THREE.Color(5, 3.6, 2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.position.set(x, y, z); s.visible = false; p.add(s); return s;
  };

  // ---------------- K5 권총 ----------------
  {
    const g = new THREE.Group(), mag = new THREE.Group(); g.add(mag);
    rb(g, metal, 0.03, 0.033, 0.19, 0, 0.031, -0.055, 0.005);
    for (let i = 0; i < 7; i++) add(g, new THREE.BoxGeometry(0.0315, 0.026, 0.002), metalD, 0, 0.031, 0.025 + i * 0.006);
    add(g, new THREE.BoxGeometry(0.002, 0.012, 0.035), dark, 0.0152, 0.036, -0.03);
    rb(g, poly, 0.028, 0.024, 0.165, 0, 0.003, -0.045, 0.004);
    rb(g, poly, 0.031, 0.105, 0.05, 0, -0.055, 0.036, 0.008, -0.25);
    for (let i = 0; i < 5; i++) add(g, new THREE.BoxGeometry(0.0322, 0.003, 0.04), rubber, 0, -0.03 - i * 0.017, 0.03 + i * 0.004, -0.25);
    add(g, new THREE.TorusGeometry(0.017, 0.0035, 6, 16, Math.PI), poly, 0, -0.012, -0.005, 0, Math.PI / 2, Math.PI);
    rb(g, metalD, 0.006, 0.016, 0.006, 0, -0.008, -0.003, 0.002, 0.2);
    rb(mag, metal, 0.026, 0.014, 0.042, 0, -0.107, 0.05, 0.003, -0.25);
    rb(g, metal, 0.028, 0.012, 0.008, 0, 0.053, 0.03, 0.002);
    rb(g, metal, 0.006, 0.012, 0.007, 0, 0.053, -0.138, 0.002);
    const dot = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.4) });
    add(g, new THREE.CircleGeometry(0.0018, 8), dot, 0, 0.055, -0.1342);
    add(g, new THREE.CircleGeometry(0.0016, 8), dot, -0.008, 0.055, 0.0345); add(g, new THREE.CircleGeometry(0.0016, 8), dot, 0.008, 0.055, 0.0345);
    cz(g, metalD, 0.008, 0.008, 0.012, 0, 0.03, -0.152); add(g, new THREE.CircleGeometry(0.0045, 10), dark, 0, 0.03, -0.1585);
    rb(g, metalD, 0.01, 0.012, 0.01, 0, 0.044, 0.04, 0.002, 0.4);
    rb(g, metalD, 0.004, 0.022, 0.009, 0, -0.02, -0.014, 0.002);
    for (let i = 0; i < 6; i++) add(g, new THREE.BoxGeometry(0.0318, 0.024, 0.0016), dark, 0, 0.031, -0.11 + i * 0.0045);
    add(g, new THREE.BoxGeometry(0.0022, 0.009, 0.026), dark, 0.0153, 0.047, -0.07);
    rb(g, metal, 0.024, 0.008, 0.045, 0, -0.016, -0.1, 0.002);
    for (let i = 0; i < 3; i++) add(g, new THREE.BoxGeometry(0.0245, 0.004, 0.004), dark, 0, -0.0118, -0.115 + i * 0.012);
    add(g, new THREE.TorusGeometry(0.006, 0.0016, 6, 12), metalD, 0, -0.108, 0.058, 0, Math.PI / 2, 0);
    for (const sx of [-1, 1]) add(g, new THREE.CylinderGeometry(0.0022, 0.0022, 0.002, 8).rotateZ(Math.PI / 2), brass, sx * 0.0148, 0.012, 0.03);
    hand(g, [0.004, -0.058, 0.05], -1, 0.05, 0.017);
    hand(g, [-0.026, -0.07, 0.03], 1, 0.045, 0.016, false);
    arm(g, [0.01, -0.09, 0.1], [0.11, -0.27, 0.44]);
    arm(g, [-0.03, -0.1, 0.07], [-0.17, -0.28, 0.38]);
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.03, -0.17); g.add(muzzle);
    VMS.push({ g, mag, muzzle, flash: mkFlash(g, 0, 0.03, -0.2), hip: new THREE.Vector3(0.14, -0.14, -0.36), ads: new THREE.Vector3(0, -0.053, -0.34), flashSize: 0.16 });
  }
  // ---------------- K2 소총 ----------------
  {
    const g = new THREE.Group(), mag = new THREE.Group(); g.add(mag);
    rb(g, metal, 0.058, 0.05, 0.34, 0, 0.022, -0.03, 0.007);
    rb(g, metal, 0.052, 0.046, 0.22, 0, -0.024, 0.0, 0.007);
    add(g, new THREE.BoxGeometry(0.002, 0.022, 0.065), dark, 0.0292, 0.024, -0.02);
    rb(g, metalD, 0.02, 0.012, 0.045, 0, 0.051, 0.12, 0.003);
    rb(g, metal, 0.032, 0.012, 0.3, 0, 0.052, -0.04, 0.003);
    for (let i = 0; i < 11; i++) add(g, new THREE.BoxGeometry(0.034, 0.006, 0.01), metalD, 0, 0.06, -0.18 + i * 0.026);
    cz(g, polyG, 0.037, 0.037, 0.26, 0, 0.004, -0.33, 18);
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.003, 0.012, 0.026), dark, s * 0.0365, 0.004, -0.25 - i * 0.032);
    for (const z of [-0.205, -0.455]) cz(g, metalD, 0.039, 0.039, 0.012, 0, 0.004, z, 18);
    rb(g, metal, 0.03, 0.034, 0.032, 0, 0.026, -0.48, 0.005);
    rb(g, metal, 0.016, 0.055, 0.018, 0, 0.055, -0.49, 0.004);
    add(g, new THREE.TorusGeometry(0.011, 0.003, 6, 14), metal, 0, 0.083, -0.49);
    cz(g, metalD, 0.0105, 0.0105, 0.33, 0, 0.004, -0.63, 12);
    cz(g, metal, 0.016, 0.016, 0.075, 0, 0.004, -0.81, 14);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; add(g, new THREE.BoxGeometry(0.004, 0.004, 0.04), dark, Math.cos(a) * 0.016, 0.004 + Math.sin(a) * 0.016, -0.82, 0, 0, a); }
    // 탄창 (곡선)
    rb(mag, metal, 0.029, 0.07, 0.072, 0, -0.08, -0.1, 0.006);
    rb(mag, metal, 0.029, 0.065, 0.07, 0, -0.142, -0.092, 0.006, 0.14);
    rb(mag, metal, 0.029, 0.06, 0.068, 0, -0.198, -0.076, 0.006, 0.28);
    rb(mag, poly, 0.034, 0.012, 0.078, 0, -0.232, -0.066, 0.004, 0.3);
    add(g, new THREE.TorusGeometry(0.03, 0.004, 6, 16, Math.PI), metal, 0, -0.05, 0.05, 0, Math.PI / 2, Math.PI);
    rb(g, metalD, 0.006, 0.02, 0.006, 0, -0.058, 0.045, 0.002, 0.25);
    rb(g, poly, 0.034, 0.11, 0.05, 0, -0.09, 0.105, 0.01, -0.32);
    for (let i = 0; i < 5; i++) add(g, new THREE.BoxGeometry(0.0352, 0.003, 0.042), rubber, 0, -0.06 - i * 0.017, 0.098 + i * 0.006, -0.32);
    rb(g, metalD, 0.01, 0.006, 0.02, 0.03, -0.012, 0.07, 0.002);
    rb(g, polyG, 0.042, 0.07, 0.22, 0, -0.008, 0.27, 0.01);
    rb(g, polyG, 0.044, 0.03, 0.12, 0, 0.032, 0.25, 0.008);
    rb(g, rubber, 0.048, 0.125, 0.026, 0, -0.022, 0.39, 0.008);
    add(g, new THREE.TorusGeometry(0.008, 0.0025, 6, 12), metal, -0.03, -0.02, 0.33, 0, Math.PI / 2, 0);
    // 도트 사이트
    rb(g, metal, 0.03, 0.02, 0.06, 0, 0.065, -0.03, 0.004);
    { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.075, 24, 1, true).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ map: T.metal, roughness: 0.4, metalness: 0.8, side: THREE.DoubleSide })); t.position.set(0, 0.083, -0.03); g.add(t); }
    for (const z of [0.0075, -0.0675]) add(g, new THREE.TorusGeometry(0.021, 0.0035, 8, 24), metal, 0, 0.083, z);
    rb(g, metalD, 0.012, 0.012, 0.016, 0.024, 0.083, -0.03, 0.003);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.0185, 24), new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.28 }));
    lens.position.set(0, 0.083, -0.066); g.add(lens);
    const dotM = new THREE.Mesh(new THREE.CircleGeometry(0.0011, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 0.4, 0.3) }));
    dotM.position.set(0, 0.083, -0.065); g.add(dotM);
    rb(g, metalD, 0.011, 0.011, 0.055, 0.04, 0.036, 0.03, 0.003);
    rb(g, metalD, 0.004, 0.022, 0.03, 0.0305, 0.002, 0.03, 0.001, 0, 0, 0.5);
    for (let i = 0; i < 4; i++) add(g, new THREE.BoxGeometry(0.036, 0.004, 0.012), dark, 0, -0.034, -0.28 - i * 0.05);
    add(g, new THREE.CylinderGeometry(0.006, 0.006, 0.01, 12).rotateZ(Math.PI / 2), metalD, 0.031, -0.01, -0.06);
    add(g, new THREE.TorusGeometry(0.012, 0.0025, 6, 14), metalD, 0, -0.005, 0.37, 0, Math.PI / 2, 0);
    rb(mag, metalD, 0.031, 0.006, 0.07, 0, -0.06, -0.1, 0.002);
    for (let i = 0; i < 3; i++) add(mag, new THREE.BoxGeometry(0.0305, 0.003, 0.05), dark, 0, -0.1 - i * 0.045, -0.094 + i * 0.012);
    for (let i = 0; i < 4; i++) add(g, new THREE.CylinderGeometry(0.0035, 0.0035, 0.003, 8).rotateZ(Math.PI / 2), metalD, 0.0295, 0.04 - (i % 2) * 0.02, 0.07 - (i >> 1) * 0.03);
    hand(g, [0.002, -0.088, 0.11], -1, 0.05, 0.017);
    hand(g, [-0.006, -0.042, -0.34], 1, 0.06, 0.02);
    arm(g, [0.01, -0.12, 0.16], [0.13, -0.29, 0.47]);
    arm(g, [-0.03, -0.08, -0.3], [-0.2, -0.28, 0.0]);
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.004, -0.86); g.add(muzzle);
    VMS.push({ g, mag, muzzle, flash: mkFlash(g, 0, 0.004, -0.88), hip: new THREE.Vector3(0.16, -0.17, -0.42), ads: new THREE.Vector3(0, -0.083, -0.33), flashSize: 0.3 });
  }
  // ---------------- 산탄총 ----------------
  {
    const g = new THREE.Group(), mag = new THREE.Group(), pump = new THREE.Group(); g.add(mag); g.add(pump);
    rb(g, metal, 0.052, 0.072, 0.25, 0, 0, 0, 0.008);
    add(g, new THREE.BoxGeometry(0.002, 0.025, 0.07), dark, 0.0265, 0.012, -0.01);
    cz(g, metalD, 0.0145, 0.0145, 0.57, 0, 0.022, -0.41, 14);
    add(g, new THREE.CircleGeometry(0.011, 12), dark, 0, 0.022, -0.6955).rotation.y = Math.PI;
    cz(g, metal, 0.013, 0.013, 0.46, 0, -0.016, -0.35, 14);
    rb(g, metal, 0.008, 0.006, 0.44, 0, 0.039, -0.42, 0.002);
    rb(pump, polyG, 0.062, 0.052, 0.17, 0, -0.016, -0.3, 0.012);
    for (let i = 0; i < 6; i++) add(pump, new THREE.BoxGeometry(0.064, 0.006, 0.008), poly, 0, 0.008, -0.37 + i * 0.026);
    rb(g, wood, 0.045, 0.085, 0.3, 0, -0.035, 0.27, 0.012, 0.12);
    rb(g, rubber, 0.05, 0.12, 0.024, 0, -0.055, 0.42, 0.008, 0.12);
    rb(g, wood, 0.034, 0.1, 0.05, 0, -0.07, 0.11, 0.01, -0.3);
    add(g, new THREE.TorusGeometry(0.026, 0.004, 6, 16, Math.PI), metal, 0, -0.04, 0.06, 0, Math.PI / 2, Math.PI);
    for (let i = 0; i < 4; i++) { cz(g, shellRed, 0.009, 0.009, 0.05, 0.03, -0.005, 0.02 - i * 0.022); cz(g, brass, 0.0095, 0.0095, 0.012, 0.03, -0.005, 0.048 - i * 0.022 - 0.0); }
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 1.5) }));
    bead.position.set(0, 0.045, -0.67); g.add(bead);
    for (const z of [-0.5, -0.65]) cz(g, metal, 0.0185, 0.0185, 0.012, 0, 0.022, z);
    cz(g, metal, 0.016, 0.016, 0.014, 0, -0.016, -0.56); cz(g, metalD, 0.014, 0.014, 0.02, 0, -0.016, -0.58);
    add(g, new THREE.BoxGeometry(0.053, 0.004, 0.06), dark, 0, -0.037, -0.04);
    rb(g, metalD, 0.012, 0.016, 0.035, 0.0275, 0.018, 0.1, 0.003);
    for (const [x, y, z] of [[0.0262, 0.02, 0.08], [0.0262, -0.012, 0.08], [0.0262, 0.02, -0.08], [0.0262, -0.012, -0.08]]) add(g, new THREE.CylinderGeometry(0.004, 0.004, 0.003, 10).rotateZ(Math.PI / 2), metalD, x, y, z);
    add(g, new THREE.TorusGeometry(0.009, 0.002, 6, 12), metalD, 0, -0.07, 0.38, 0, Math.PI / 2, 0);
    hand(g, [0.0, -0.07, 0.12], -1, 0.05, 0.017);
    const lh = new THREE.Group(); pump.add(lh);
    hand(lh, [-0.004, -0.045, -0.3], 1, 0.065, 0.02);
    arm(lh, [-0.03, -0.08, -0.26], [-0.2, -0.28, 0.02]);
    arm(g, [0.01, -0.1, 0.17], [0.12, -0.28, 0.47]);
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.022, -0.7); g.add(muzzle);
    VMS.push({ g, mag, pump, muzzle, flash: mkFlash(g, 0, 0.022, -0.75), hip: new THREE.Vector3(0.15, -0.16, -0.4), ads: new THREE.Vector3(0, -0.045, -0.35), flashSize: 0.42 });
  }
  for (const v of VMS) { v.g.visible = false; v.g.traverse(o => { o.frustumCulled = false; }); weaponScene.add(v.g); }
}
