// ============================================================
//  차량 탑승 (F키): 도로의 차를 빼앗아 운전, 적을 치고 지나갈 수 있다
// ============================================================
const DRIVE = { car: null, parked: [] };
function nearCar() {
  let best = null, bd = 4.5;
  for (const ln of LANES) for (let i = 0; i < ln.cars.length; i++) {
    const c = ln.cars[i], d = Math.hypot(c.x - P.pos.x, c.z - P.pos.z);
    if (d < bd) { bd = d; best = { ln, i, c }; }
  }
  for (const p of DRIVE.parked) { const d = Math.hypot(p.x - P.pos.x, p.z - P.pos.z); if (d < bd) { bd = d; best = { parked: p }; } }
  return best;
}
function toggleDrive() {
  if (DRIVE.car) {   // 하차: 차는 그 자리에 세워 둔다
    const c = DRIVE.car, sx = Math.sin(c.h), cx = Math.cos(c.h);
    _pp.x = c.x + sx * 2.4; _pp.z = c.z + cx * 2.4; resolveCircle(_pp, 0.4, 0.4, 1.8);
    P.pos.set(_pp.x, groundH(_pp.x, _pp.z), _pp.z); P.vel.set(0, 0, 0); P.yaw = c.h - Math.PI / 2;
    DRIVE.parked.push(c); DRIVE.car = null; showWeapon(P.weapon); engine(false);
    return;
  }
  const n = nearCar(); if (!n) return;
  let c;
  if (n.parked) { c = n.parked; DRIVE.parked.splice(DRIVE.parked.indexOf(c), 1); }
  else {
    n.ln.cars.splice(n.i, 1);
    const ln = n.ln;
    const h = ln.axis === 'x' ? (ln.dir > 0 ? 0 : Math.PI) : (ln.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    c = { kind: n.c.kind, idx: n.c.idx, x: n.c.x, z: n.c.z, h, v: n.c.v, cr: n.c.cr, cg: n.c.cg, cb: n.c.cb };
  }
  c.camH = c.h; engine(true);
  DRIVE.car = c; VMS.forEach(v => v.g.visible = false); mouseDown = rmb = false; AUDIO.click(0.4, 600);
}
// 엔진 소리: 속도에 따라 음높이가 올라간다
function engine(on) {
  const A = AUDIO; if (!A.ctx) return;
  if (on && !DRIVE.eng) {
    const o = A.ctx.createOscillator(), o2 = A.ctx.createOscillator(), lp = A.ctx.createBiquadFilter(), g = A.ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'square'; lp.type = 'lowpass'; lp.frequency.value = 500; g.gain.value = 0.07;
    o.connect(lp); o2.connect(lp); lp.connect(g).connect(A.master); o.start(); o2.start();
    DRIVE.eng = { o, o2, lp, g };
  } else if (!on && DRIVE.eng) { const e = DRIVE.eng; e.g.gain.setTargetAtTime(0, A.ctx.currentTime, 0.1); setTimeout(() => { e.o.stop(); e.o2.stop(); }, 500); DRIVE.eng = null; }
}
function writeCarMatrix(c) {
  const m = carMeshes[c.kind], o = c.idx * 16, cs = Math.cos(c.h), sn = Math.sin(c.h);
  for (const arr of [m.body.instanceMatrix.array, m.lights.instanceMatrix.array]) {
    arr[o] = cs; arr[o + 1] = 0; arr[o + 2] = -sn; arr[o + 3] = 0; arr[o + 4] = 0; arr[o + 5] = 1; arr[o + 6] = 0; arr[o + 7] = 0;
    arr[o + 8] = sn; arr[o + 9] = 0; arr[o + 10] = cs; arr[o + 11] = 0; arr[o + 12] = c.x; arr[o + 13] = 0.05; arr[o + 14] = c.z; arr[o + 15] = 1;
  }
  m.body.instanceMatrix.needsUpdate = m.lights.instanceMatrix.needsUpdate = true;
}
function updateDrive(dt) {
  const c = DRIVE.car;
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const maxV = c.kind === 'bus' ? 18 : 30;
  if (f > 0) c.v = Math.min(maxV, c.v + (c.v < 0 ? 25 : 11) * dt);
  else if (f < 0) c.v = Math.max(-8, c.v - (c.v > 0 ? 25 : 7) * dt);
  else c.v = moveTo(c.v, 0, 5 * dt);
  if (keys.Space) c.v = moveTo(c.v, 0, 30 * dt);
  c.h -= s * dt * clamp(Math.abs(c.v) / 6, 0, 1) * 1.6 * Math.sign(c.v || 1);
  _pp.x = c.x + Math.cos(c.h) * c.v * dt; _pp.z = c.z - Math.sin(c.h) * c.v * dt;
  if (resolveCircle(_pp, 1.3, 0.3, 1.5) && Math.abs(c.v) > 6) { P.shake = Math.min(1, Math.abs(c.v) / 25); AUDIO.boom(c.x, 0.5, c.z, 0.25); c.v *= -0.3; }
  { const bx = _pp.x, bz = _pp.z; collideCars(_pp, 1.4);   // 다른 차와 충돌
    if (Math.hypot(_pp.x - bx, _pp.z - bz) > 0.01 && Math.abs(c.v) > 3) {
      const sp = Math.abs(c.v); P.shake = Math.min(1.2, sp / 20); AUDIO.boom(c.x, 0.5, c.z, Math.min(0.8, sp / 30));
      FX.sparks(new THREE.Vector3(c.x + Math.cos(c.h) * 2, 0.8, c.z - Math.sin(c.h) * 2), 20, null);
      if (sp > 15) FX.dust(new THREE.Vector3(c.x, 0.8, c.z), 10, null, [0.3, 0.3, 0.3]);
      c.v *= -0.25; AUDIO.horn(c.x + 3, 1, c.z);
    } }
  if (isWater(_pp.x, _pp.z)) { _pp.x = c.x; _pp.z = c.z; c.v = 0; }
  c.x = clamp(_pp.x, PLAY.x0, PLAY.x1); c.z = clamp(_pp.z, PLAY.z0, PLAY.z1);
  // 적 치기
  for (const e of ENEMIES) {
    if (e.state === 'dead' || e.T.fly || Math.abs(c.v) < 4) continue;
    if (Math.hypot(e.pos.x - c.x, e.pos.z - c.z) < 2.4) { _d.set(Math.cos(c.h), 0.3, -Math.sin(c.h)); if (damageEnemy(e, Math.abs(c.v) * 12, 'body', _d, e.pos)) hitMarker('kill'); c.v *= 0.85; }
  }
  if (DRIVE.eng) { const r = 38 + Math.abs(c.v) * 4.5 + (f ? 12 : 0); DRIVE.eng.o.frequency.value = r; DRIVE.eng.o2.frequency.value = r * 0.5; DRIVE.eng.lp.frequency.value = 300 + Math.abs(c.v) * 40; }
  if (keys.KeyH && G.time - (c.honk || 0) > 0.6) { c.honk = G.time; AUDIO.horn(c.x, 1, c.z); }
  CH.el.style.opacity = 0;
  G.speedKmh = Math.round(Math.abs(c.v) * 3.6);
  P.pos.set(c.x, groundH(c.x, c.z), c.z); P.vel.set(Math.cos(c.h) * c.v, 0, -Math.sin(c.h) * c.v);
  // 3인칭 추적 카메라
  const back = c.kind === 'bus' ? 15 : 9, hgt = c.kind === 'bus' ? 6 : 3.6;
  c.camH += wrapAngle(c.h - c.camH) * (1 - Math.exp(-4 * dt));
  const ch = c.camH, kb = back + Math.abs(c.v) * 0.08;
  P.yaw = c.h - Math.PI / 2;
  camera.position.set(c.x - Math.cos(ch) * kb, hgt + groundH(c.x, c.z), c.z + Math.sin(ch) * kb);
  camera.lookAt(c.x + Math.cos(c.h) * 4, 1.4, c.z - Math.sin(c.h) * 4);
  camera.rotateZ(-s * clamp(Math.abs(c.v) / 30, 0, 1) * 0.03);
  const fov = SETTINGS.fov + Math.abs(c.v) * 0.3;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();
}
