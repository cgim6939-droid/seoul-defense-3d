// ============================================================
//  플레이어: 입력, 이동, 사격, 수류탄
// ============================================================
const P = {
  pos: new THREE.Vector3(800, 0, 335), vel: new THREE.Vector3(), yaw: 0, pitch: 0, onGround: true, jumpHeld: false,
  hp: 100, maxHp: 100, lastHurt: -99, alive: true, step: 0, land: 0, kick: 0, ads: 0, sprint: 0, weapon: 1,
  sk: { dmg: 0, rate: 0, crit: 0, reload: 0, hp: 0, regen: 0, steal: 0, speed: 0, gren: 0, light: 0, aura: 0, pulse: 0 },
  switchT: 0, switchTo: -1, grenades: 3, throwT: 0, deathT: 0, shake: 0, roll: 0, eyeY: 1.65, swayX: 0, swayY: 0, recoilV: 0,
};
const WST = WEAPONS.map(w => ({ ammo: w.mag, reload: 0, cool: 0, pumpT: 0, sounds: 0 }));
const keys = {};
let mouseDown = false, rmb = false, fireQueued = 0, mdx = 0, mdy = 0;
const locked = () => document.pointerLockElement === renderer.domElement;
function requestLock() {
  if (DEBUG) return;
  try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
}
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (G.state !== 'play' || e.repeat) return;
  if (e.code === 'Digit1') switchWeapon(0);
  if (e.code === 'Digit2') switchWeapon(1);
  if (e.code === 'Digit3') switchWeapon(2);
  if (e.code === 'KeyR') startReload();
  if (e.code === 'KeyG') throwGrenade();
  if (e.code === 'KeyM') toggleMap();
  if (e.code === 'KeyF') toggleDrive();
  if (e.code === 'KeyP' || (e.code === 'Escape' && !locked())) pauseGame();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = rmb = false; });
document.addEventListener('mousemove', (e) => { if (locked() && G.state === 'play') { mdx += e.movementX; mdy += e.movementY; } });
renderer.domElement.addEventListener('mousedown', (e) => {
  if (G.state !== 'play') return;
  if (!locked() && !DEBUG) { requestLock(); return; }
  if (e.button === 0) { mouseDown = true; fireQueued = 0.15; }
  if (e.button === 2) rmb = true;
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; if (e.button === 2) rmb = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => { if (G.state === 'play' && MAPV.open) { MAPV.zoom = clamp(MAPV.zoom * (e.deltaY > 0 ? 0.85 : 1.18), 1, 4); return; } if (G.state === 'play') switchWeapon((P.weapon + (e.deltaY > 0 ? 1 : 2)) % 3); }, { passive: true });

function switchWeapon(i) {
  if (i === P.weapon || P.switchT > 0 || !P.alive) return;
  P.switchTo = i; P.switchT = 0.5;
  WST[P.weapon].reload = 0;
  AUDIO.click(0.2, 1500);
}
function startReload() {
  const w = WEAPONS[P.weapon], st = WST[P.weapon];
  if (st.reload > 0 || st.ammo >= w.mag || P.switchT > 0) return;
  st.reload = (w.shell ? w.shell + 0.25 : w.reload) / (1 + 0.15 * P.sk.reload); st.rmax = st.reload; st.sounds = 0;
  if (!w.shell) AUDIO.click(0.3, 1800);
}
function showWeapon(i) { VMS.forEach((v, k) => v.g.visible = k === i); }

const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _up = new THREE.Vector3(), _tmp = new THREE.Vector3(), _mz = new THREE.Vector3();
const _pp = { x: 0, z: 0 };
function updatePlayer(dt) {
  if (!P.alive) { updateDeath(dt); return; }
  if (DRIVE.car) { mdx = mdy = 0; updateDrive(dt); return; }
  // 시선
  const zoom = camera.fov / SETTINGS.fov;
  const sens = 0.0021 * SETTINGS.sens * (0.4 + 0.6 * zoom);
  P.yaw -= mdx * sens; P.pitch = clamp(P.pitch - mdy * sens, -1.52, 1.52);
  P.swayX = damp(P.swayX, clamp(-mdx * 0.0006, -0.04, 0.04), 10, dt);
  P.swayY = damp(P.swayY, clamp(mdy * 0.0006, -0.04, 0.04), 10, dt);
  mdx = mdy = 0;
  // 이동
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const wantSprint = (keys.ShiftLeft || keys.ShiftRight) && f > 0 && !mouseDown && P.ads < 0.3;
  P.sprint = damp(P.sprint, wantSprint ? 1 : 0, 9, dt);
  const speed = (wantSprint ? 8.4 : P.ads > 0.5 ? 3.4 : 5.4) * (1 + 0.08 * P.sk.speed);
  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  let wx = -sy * f + cy * s, wz = -cy * f - sy * s;
  const wl = Math.hypot(wx, wz); if (wl > 0) { wx = wx / wl * speed; wz = wz / wl * speed; }
  const acc = P.onGround ? 12 : 2.5;
  P.vel.x = damp(P.vel.x, wx, acc, dt); P.vel.z = damp(P.vel.z, wz, acc, dt);
  if (keys.Space && P.onGround && !P.jumpHeld) { P.vel.y = 6.8; P.onGround = false; AUDIO.step(1.5); }
  P.jumpHeld = !!keys.Space;
  P.vel.y -= 22 * dt;
  _pp.x = P.pos.x + P.vel.x * dt; _pp.z = P.pos.z + P.vel.z * dt;
  resolveCircle(_pp, 0.4, P.pos.y + 0.45, P.pos.y + 1.8);
  collideCars(_pp, 0.4);
  if (isWater(_pp.x, _pp.z)) { if (!isWater(_pp.x, P.pos.z)) _pp.z = P.pos.z; else if (!isWater(P.pos.x, _pp.z)) _pp.x = P.pos.x; else { _pp.x = P.pos.x; _pp.z = P.pos.z; } }
  P.pos.x = clamp(_pp.x, PLAY.x0, PLAY.x1); P.pos.z = clamp(_pp.z, PLAY.z0, PLAY.z1);
  P.pos.y += P.vel.y * dt;
  const gh = groundH(P.pos.x, P.pos.z);
  if (P.pos.y <= gh) {
    if (!P.onGround && P.vel.y < -5) { P.land = Math.min(1, -P.vel.y / 12); AUDIO.land(); }
    P.pos.y = gh; P.vel.y = 0; P.onGround = true;
  } else if (P.onGround && P.pos.y - gh < 0.6 && P.vel.y <= 0) { P.pos.y = gh; P.vel.y = 0; }
  else P.onGround = false;
  // 발걸음 · 흔들림
  const hs = Math.hypot(P.vel.x, P.vel.z);
  if (P.onGround && hs > 0.6) {
    const prev = P.step; P.step += hs * dt * 1.25;
    if (Math.floor(prev / Math.PI) !== Math.floor(P.step / Math.PI)) AUDIO.step(hs > 7 ? 1.3 : 1);
  }
  P.land = damp(P.land, 0, 6, dt);
  P.shake = Math.max(0, P.shake - dt * 2.2);
  if (G.time - P.lastHurt > 5 && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + 5 * dt);
  updateWeapon(dt, hs);
  updateCamera(dt, hs, s);
}

function updateCamera(dt, hs, strafe) {
  const bobK = P.onGround ? clamp(hs / 5.4, 0, 1.6) * (1 - P.ads * 0.8) : 0;
  const bobY = Math.sin(P.step * 2) * 0.04 * bobK, bobX = Math.cos(P.step) * 0.03 * bobK;
  const targetEye = P.pos.y + 1.65;
  P.eyeY = targetEye > P.eyeY ? damp(P.eyeY, targetEye, 14, dt) : targetEye;
  P.roll = damp(P.roll, -strafe * 0.012 - P.swayX * 0.6, 8, dt);
  P.recoilV = damp(P.recoilV, 0, 10, dt);
  const sh = P.shake * P.shake;
  camera.position.set(P.pos.x + Math.cos(P.yaw) * bobX, P.eyeY + bobY - P.land * 0.12, P.pos.z - Math.sin(P.yaw) * bobX);
  camera.rotation.set(P.pitch + P.recoilV + R(-1, 1) * sh * 0.02, P.yaw + R(-1, 1) * sh * 0.02, P.roll + R(-1, 1) * sh * 0.01);
  const w = WEAPONS[P.weapon];
  const fov = lerp(SETTINGS.fov * (1 + P.sprint * 0.07), w.fov, P.ads);
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov; camera.updateProjectionMatrix();
    PARTICLE_SCALE.value = renderer.getDrawingBufferSize(_v2).y / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
  }
  camera.updateMatrixWorld();
  // 무기 화면 조명 방향을 카메라 공간으로
  wSun.position.copy(G.lightDir || sunDir).applyQuaternion(_q.copy(camera.quaternion).invert()).multiplyScalar(5);
}
const _v2 = new THREE.Vector2(), _q = new THREE.Quaternion();

function updateWeapon(dt, hs) {
  const w = WEAPONS[P.weapon], st = WST[P.weapon], vm = VMS[P.weapon];
  st.cool -= dt; fireQueued -= dt;
  if (P.switchT > 0) {
    P.switchT -= dt;
    if (P.switchT <= 0.25 && P.switchTo >= 0) { P.weapon = P.switchTo; P.switchTo = -1; showWeapon(P.weapon); AUDIO.click(0.25, 1200); }
  }
  const sw = P.switchT > 0 ? (P.switchTo >= 0 ? 1 - (P.switchT - 0.25) / 0.25 : P.switchT / 0.25) : 0;
  const busy = P.switchT > 0 || P.throwT > 0;
  P.ads = moveTo(P.ads, rmb && !busy && P.sprint < 0.5 && (st.reload <= 0 || w.shell) ? 1 : 0, dt / 0.14);
  // 재장전
  if (st.reload > 0) {
    st.reload -= dt;
    if (w.shell) {
      if (st.reload <= 0) { st.ammo++; AUDIO.click(0.35, 900); st.reload = st.ammo < w.mag ? w.shell / (1 + 0.15 * P.sk.reload) : 0; if (!st.reload) st.pumpT = 0.4; }
    } else {
      const p = 1 - st.reload / (st.rmax || w.reload);
      if (st.sounds === 0 && p > 0.25) { st.sounds = 1; AUDIO.click(0.35, 1300); }
      if (st.sounds === 1 && p > 0.7) { st.sounds = 2; AUDIO.click(0.45, 1700); }
      if (st.reload <= 0) { st.ammo = w.mag; AUDIO.click(0.4, 2400); }
    }
  }
  if (st.pumpT > 0) { const before = st.pumpT; st.pumpT -= dt; if (before > 0.2 && st.pumpT <= 0.2) AUDIO.click(0.4, 700); }
  // 사격
  const trigger = w.auto ? mouseDown : fireQueued > 0;
  if (trigger && !busy && P.sprint < 0.6) {
    if (st.ammo > 0 && st.cool <= 0 && st.pumpT <= 0 && (st.reload <= 0 || w.shell)) { st.reload = 0; fire(w, st, vm, hs); fireQueued = 0; }
    else if (st.ammo === 0 && st.cool <= 0 && st.reload <= 0) { AUDIO.dry(); startReload(); fireQueued = 0; st.cool = 0.3; }
  }
  // 무기 위치 애니메이션
  const target = _tmp.copy(vm.hip).lerp(vm.ads, P.ads);
  const bk = P.onGround ? clamp(hs / 5.4, 0, 1.6) * (1 - P.ads * 0.85) : 0.2;
  let x = target.x + Math.sin(P.step) * 0.012 * bk + P.swayX * (1 - P.ads * 0.7);
  let y = target.y - Math.abs(Math.cos(P.step)) * 0.012 * bk + P.swayY * (1 - P.ads * 0.7) - P.land * 0.04 + Math.sin(G.time * 1.6) * 0.002 * (1 - P.ads);
  let z = target.z + P.kick * 0.06 * (1 - P.ads * 0.5);
  let rx = P.kick * 0.14 * (1 - P.ads * 0.6), ry = 0, rz = 0;
  x += P.sprint * -0.06; y += P.sprint * -0.05; rx += P.sprint * -0.25; ry += P.sprint * 0.7; rz += P.sprint * 0.25;
  let rl = 0;
  if (st.reload > 0 && !w.shell) { const p = 1 - st.reload / (st.rmax || w.reload); rl = Math.sin(Math.PI * clamp(p * 1.15, 0, 1)); }
  if (st.reload > 0 && w.shell) rl = 0.6;
  x -= rl * 0.03; y -= rl * 0.06; rx += rl * 0.35; rz += rl * 0.5;
  y -= (sw + P.throwT * 1.5) * 0.35;
  vm.g.position.set(x, y, z); vm.g.rotation.set(rx, ry, rz);
  if (vm.mag) {
    const mp = st.reload > 0 && !w.shell ? Math.sin(Math.PI * clamp((1 - st.reload / (st.rmax || w.reload)) * 1.3 - 0.1, 0, 1)) : 0;
    vm.mag.position.y = -mp * 0.22;
  }
  if (vm.pump) vm.pump.position.z = st.pumpT > 0 ? Math.sin(Math.PI * clamp(1 - st.pumpT / 0.4, 0, 1)) * 0.09 : 0;
  P.kick = damp(P.kick, 0, 14, dt);
  if (vm.flash.visible && (vm.flashT -= dt) <= 0) vm.flash.visible = false;
  // 크로스헤어
  const spread = currentSpread(w, hs);
  const gap = 6 + spread * 900;
  CH.t.style.transform = `translateY(${-gap - 9}px)`; CH.b.style.transform = `translateY(${gap}px)`;
  CH.l.style.transform = `translateX(${-gap - 9}px)`; CH.r.style.transform = `translateX(${gap}px)`;
  CH.el.style.opacity = P.ads > 0.6 ? 0 : 1 - P.sprint;
}
function currentSpread(w, hs) {
  return lerp(w.spread, w.ads, P.ads) + w.move * clamp(hs / 5.4, 0, 1.5) + (P.onGround ? 0 : 0.03);
}

const _o = new THREE.Vector3(), _d = new THREE.Vector3();
function fire(w, st, vm, hs) {
  st.ammo--; st.cool = 60 / (w.rpm * (1 + 0.12 * P.sk.rate)); G.shots++;
  if (w.shell) st.pumpT = 0.55;
  camera.getWorldDirection(_fwd);
  _right.set(1, 0, 0).applyQuaternion(camera.quaternion); _up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  vm.muzzle.getWorldPosition(_mz).applyMatrix4(camera.matrixWorld);
  const spread = currentSpread(w, hs);
  let anyHit = 0, anyHead = false, anyKill = false;
  for (let i = 0; i < w.pellets; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
    _d.copy(_fwd).addScaledVector(_right, Math.cos(a) * r).addScaledVector(_up, Math.sin(a) * r).normalize();
    _o.copy(camera.position);
    const res = traceShot(_o, _d, w.range);
    if (i < 4 || Math.random() < 0.4) spawnTracer(_mz, res.point);
    if (res.enemy) {
      const fall = w.pellets > 1 && res.t > w.falloff ? Math.max(0.35, 1 - (res.t - w.falloff) / w.falloff) : 1;
      let dmg = w.dmg * (res.part === 'head' ? w.head : res.mult) * fall * (1 + 0.15 * P.sk.dmg);
      const crit = P.sk.crit > 0 && Math.random() < 0.1 * P.sk.crit; if (crit) dmg *= 2;
      const k = damageEnemy(res.enemy, dmg, res.part, _d, res.point);
      anyHit++; if (res.part === 'head' || crit) anyHead = true; if (k) anyKill = true;
    } else impactFX(res);
  }
  if (anyHit) { G.hits++; hitMarker(anyKill ? 'kill' : anyHead ? 'head' : ''); AUDIO.hit(anyHead); }
  const adsK = lerp(1, 0.55, P.ads);
  P.pitch += w.recoil * 0.55 * adsK; P.recoilV += w.recoil * 0.6 * adsK;
  P.yaw += (Math.random() - 0.5) * w.recoilYaw * adsK;
  P.kick = Math.min(1.4, P.kick + (w.shell ? 1.3 : 0.8));
  vm.flash.visible = true; vm.flashT = 0.045; vm.flash.material.rotation = Math.random() * 6.28; vm.flash.scale.setScalar(vm.flashSize * R(0.8, 1.2) * (1 - P.ads * 0.45));
  FXA.spawn(_mz.x, _mz.y, _mz.z, 0, 0, 0, 2.2, 1.5, 0.7, w.shell ? 0.14 : 0.08, 0.04, 0, 0);
  AUDIO.shot(w.id);
  if (!w.shell) {
    _right.multiplyScalar(R(1.5, 2.5)); _up.multiplyScalar(R(1, 2));
    FXA.spawn(_mz.x, _mz.y, _mz.z, _right.x + _up.x, _right.y + _up.y, _right.z + _up.z, 1.6, 1.1, 0.4, 0.03, 0.5, 9.8, 0.5);
  }
  if (st.ammo === 0 && !w.shell) setTimeout(() => { if (WST[P.weapon] === st && st.ammo === 0) startReload(); }, 350);
}
const SHOT = { t: 0, point: new THREE.Vector3(), normal: new THREE.Vector3(), kind: '', enemy: null, part: '', mult: 1 };
function traceShot(o, d, range) {
  const r = raycastWorld(o, d, range);
  SHOT.t = r.t; SHOT.kind = r.kind; SHOT.normal.copy(r.normal); SHOT.enemy = null;
  const tc = rayCars(o, d, SHOT.t);
  if (tc < SHOT.t) { SHOT.t = tc; SHOT.kind = 'car'; SHOT.normal.copy(d).negate(); }
  const he = rayEnemies(o, d, SHOT.t);
  if (he) { SHOT.t = he.t; SHOT.enemy = he.e; SHOT.part = he.part; SHOT.mult = he.mult; SHOT.kind = 'enemy'; }
  SHOT.point.copy(o).addScaledVector(d, SHOT.t);
  return SHOT;
}
function impactFX(res) {
  if (!res.kind) return;
  const p = res.point;
  if (res.kind === 'water') { FX.splash(p); return; }
  if (res.kind === 'car') { FX.sparks(p, 8, res.normal); AUDIO.click(0.15, 4200); return; }
  FX.sparks(p, 4, res.normal);
  FX.dust(p, 3, res.normal, res.kind === 'ground' ? [0.42, 0.4, 0.36] : [0.6, 0.58, 0.54]);
  spawnDecal(p, res.normal);
}

// 수류탄
const GRENADES = [];
let grenadeGeo, grenadeMat;
function throwGrenade() {
  if (P.grenades <= 0 || P.throwT > 0 || !P.alive) return;
  P.grenades--; P.throwT = 0.45;
  if (!grenadeGeo) { grenadeGeo = new THREE.SphereGeometry(0.07, 10, 8).scale(1, 1.25, 1); grenadeMat = stdMat(0x3d4a2c, 0.6, 0.3); }
  const m = new THREE.Mesh(grenadeGeo, grenadeMat); m.castShadow = true; scene.add(m);
  camera.getWorldDirection(_fwd);
  const g = { m, pos: camera.position.clone().addScaledVector(_fwd, 0.5).add(new THREE.Vector3(0, -0.15, 0)), vel: _fwd.clone().multiplyScalar(17).add(new THREE.Vector3(0, 4.5, 0)).add(P.vel), fuse: 2.3, spin: R(5, 10) };
  GRENADES.push(g);
  AUDIO.click(0.3, 900);
}
function updateGrenades(dt) {
  P.throwT = Math.max(0, P.throwT - dt);
  for (let i = GRENADES.length - 1; i >= 0; i--) {
    const g = GRENADES[i];
    g.vel.y -= 18 * dt;
    const steps = 3;
    for (let s = 0; s < steps; s++) {
      const nx = g.pos.x + g.vel.x * dt / steps, ny = g.pos.y + g.vel.y * dt / steps, nz = g.pos.z + g.vel.z * dt / steps;
      if (pointSolid(nx, ny, g.pos.z)) { g.vel.x *= -0.4; } else g.pos.x = nx;
      if (pointSolid(g.pos.x, ny, nz)) { g.vel.z *= -0.4; } else g.pos.z = nz;
      const gh = groundH(g.pos.x, g.pos.z) + 0.08;
      if (isWater(g.pos.x, g.pos.z) && ny < WATER_Y + 0.5) { g.fuse = Math.min(g.fuse, 0.05); }
      if (ny < gh && !isWater(g.pos.x, g.pos.z)) { g.pos.y = gh; if (g.vel.y < -2) AUDIO.click(0.12, 600); g.vel.y *= -0.35; g.vel.x *= 0.7; g.vel.z *= 0.7; }
      else g.pos.y = ny;
    }
    g.m.position.copy(g.pos); g.m.rotation.x += g.spin * dt;
    g.fuse -= dt;
    if (g.fuse <= 0) { explode(g.pos, 9 * (1 + 0.2 * P.sk.gren), 170 * (1 + 0.25 * P.sk.gren), true); scene.remove(g.m); GRENADES.splice(i, 1); }
  }
}
function explode(p, radius, dmg, byPlayer) {
  FX.explosion(p, radius > 10 ? 1.6 : 1);
  AUDIO.boom(p.x, p.y, p.z, radius > 10 ? 1.5 : 1);
  spawnDecal(new THREE.Vector3(p.x, groundH(p.x, p.z) + 0.03, p.z), new THREE.Vector3(0, 1, 0), radius * 0.35);
  const dpl = p.distanceTo(camera.position);
  P.shake = Math.max(P.shake, clamp(1.4 - dpl / 30, 0, 1.2));
  for (const e of ENEMIES) {
    if (e.state === 'dead') continue;
    const d = Math.hypot(e.pos.x - p.x, e.pos.y + e.h * 0.5 - p.y, e.pos.z - p.z);
    if (d < radius + e.r) {
      _d.set(e.pos.x - p.x, 0.4, e.pos.z - p.z).normalize();
      if (damageEnemy(e, dmg * (1 - d / (radius + e.r)) + 10, 'body', _d, e.pos)) {}
      if (byPlayer) hitMarker('');
    }
  }
  if (dpl < radius * 0.75) damagePlayer((byPlayer ? 40 : 60) * (1 - dpl / (radius * 0.75)), p);
}

function damagePlayer(amount, from) {
  if (!P.alive || G.state !== 'play') return;
  if (P.god) amount = 0;
  P.hp -= amount; P.lastHurt = G.time;
  P.shake = Math.max(P.shake, clamp(amount / 30, 0.3, 1));
  HUD.hurt(amount, from);
  AUDIO.hurt();
  if (P.hp <= 0) { P.hp = 0; P.alive = false; P.deathT = 0; onPlayerDeath(); }
}
function updateDeath(dt) {
  P.deathT += dt;
  const k = smooth(clamp(P.deathT / 1.2, 0, 1));
  camera.position.set(P.pos.x, lerp(P.pos.y + 1.65, P.pos.y + 0.35, k), P.pos.z);
  camera.rotation.set(lerp(P.pitch, -0.12, k), P.yaw, lerp(0, 0.45, k));
  for (const v of VMS) v.g.position.y = lerp(v.g.position.y, -0.8, dt * 3);
  camera.updateMatrixWorld();
}
