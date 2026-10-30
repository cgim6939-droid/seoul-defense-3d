// ============================================================
//  적 AI · 투사체 · 아이템 · 보스
// ============================================================
const ENEMIES = [], BOLTS = [], PICKUPS = [];
const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), _fd = { x: 0, z: 0 };
let flowTimer = 0;

function spawnPoint(minD, maxD, fly) {
  camera.getWorldDirection(_e1);
  const sc = spawnCenter();
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2, d = R(minD, maxD);
    const x = sc.x + Math.cos(a) * d, z = sc.z + Math.sin(a) * d;
    if (x < PLAY.x0 + 5 || x > PLAY.x1 - 5 || z < PLAY.z0 + 5 || z > PLAY.z1 - 5) continue;
    if (walkBlocked[cellOf(x, z)]) continue;
    if (!fly) { const fd = flowDistAt(x, z); if (fd < 0 || fd > 120) continue; }
    const dot = (Math.cos(a) * _e1.x + Math.sin(a) * _e1.z) / (Math.hypot(_e1.x, _e1.z) || 1);
    if (dot > 0.75 && d < 70 && i < 40) continue;
    return { x, z };
  }
  return null;
}
function spawnEnemy(type, at) {
  const T = ETYPES[type];
  const p = at || spawnPoint(type === 'boss' ? 120 : 45, type === 'boss' ? 160 : 110, T.fly);
  if (!p) return null;
  const model = buildEnemyModel(type);
  const mats = cloneMats(model.g);
  scene.add(model.g);
  const hpK = type === 'boss' ? 1 + (G.wave / 5 - 1) * 0.6 : 1 + 0.1 * tierOf();   // 웨이브가 올라가도 체력 고정 (몸 3방 규칙)
  const e = {
    id: NET.eid++, type, T, model, mats, pos: new THREE.Vector3(p.x, groundH(p.x, p.z), p.z), vel: new THREE.Vector3(), yaw: Math.atan2(P.pos.x - p.x, P.pos.z - p.z),
    hp: T.hp * hpK, maxHp: T.hp * hpK, r: T.r, h: T.h, state: 'spawn', t: 0, phase: Math.random() * 6, atk: 0, atkCd: R(0.5, 1.5),
    shootCd: R(1.5, 3), los: false, losT: Math.random() * 0.4, flash: 0, stuckT: 0, lastD: 1e9, checkT: 4, strafe: Math.random() < 0.5 ? 1 : -1,
    scaleK: 1, deadT: 0, leap: 0, hover: R(4.5, 6.5), name: T.name,
  };
  if (type === 'drone') e.pos.y += e.hover;
  if (type === 'boss') { e.pos.y = 190; e.state = 'arrive'; e.attackT = 6; e.mode = 0; e.beams = []; G.boss = e; AUDIO.bossHum(true); }
  else { FX.warp(e.pos, type === 'drone' ? [1, 0.4, 0.9] : [0.4, 1, 0.7]); AUDIO.warp(e.pos.x, e.pos.y, e.pos.z); spawnBeam(e.pos); }
  e.tier = tierOf();
  e.armed = type === 'grunt' && Math.random() < Math.min(0.7, 0.3 + 0.08 * e.tier);   // 병사 중 30%만 총을 든다
  model.g.traverse(o => { if (o.userData.gun) o.visible = e.armed; });
  model.g.position.copy(e.pos); model.g.rotation.y = e.yaw;
  ENEMIES.push(e);
  netOnEnemySpawn(e);
  return e;
}
// 전송 빔 (적이 나타날 때)
const BEAMS = [];
function spawnBeam(p) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3, 2), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(p.x, p.y + 30, p.z); scene.add(m); BEAMS.push({ m, t: 0 });
}
function updateBeams(dt) {
  for (let i = BEAMS.length - 1; i >= 0; i--) {
    const b = BEAMS[i]; b.t += dt;
    const k = b.t / 0.9; b.m.scale.set(1 - k * 0.8, 1, 1 - k * 0.8); b.m.material.opacity = 0.8 * (1 - k);
    if (k >= 1) { scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); BEAMS.splice(i, 1); }
  }
}

function rayEnemies(o, d, maxT) {
  let best = null, bt = maxT;
  for (const e of ENEMIES) {
    if (e.state === 'dead') continue;
    if (e.type === 'boss') {
      // 타원체 선체 + 코어
      for (const c of e.model.cores) {
        c.getWorldPosition(_e1);
        const t = raySphere(o, d, _e1, 2.4); if (t >= 0 && t < bt) { bt = t; best = { e, t, part: 'core', mult: 2.5 }; }
      }
      const sx = 30, sy = 6, ox = (o.x - e.pos.x) / sx, oy = (o.y - e.pos.y) / sy, oz = (o.z - e.pos.z) / sx;
      const dx = d.x / sx, dy = d.y / sy, dz = d.z / sx;
      const A = dx * dx + dy * dy + dz * dz, B = 2 * (ox * dx + oy * dy + oz * dz), C = ox * ox + oy * oy + oz * oz - 1, D = B * B - 4 * A * C;
      if (D > 0) { const t = (-B - Math.sqrt(D)) / (2 * A); if (t > 0 && t < bt) { bt = t; best = { e, t, part: 'body', mult: 1 }; } }
      continue;
    }
    const cx = e.pos.x - o.x, cy = e.pos.y + e.h * 0.5 - o.y, cz = e.pos.z - o.z;
    const along = cx * d.x + cy * d.y + cz * d.z;
    if (along < 0 || along > bt + 3) continue;
    const perp2 = cx * cx + cy * cy + cz * cz - along * along;
    if (perp2 > (e.h + 1) * (e.h + 1)) continue;
    for (const s of hitSpheres(e)) {
      _e1.set(s.x, s.y, s.z);
      const t = raySphere(o, d, _e1, s.r);
      if (t >= 0 && t < bt) { bt = t; best = { e, t, part: s.part, mult: s.mult }; }
    }
  }
  return best;
}
function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, disc = b * b - cc;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : -1;
}

function damageEnemy(e, dmg, part, dir, point) {
  if (e.state === 'dead') return false;
  if (e.state === 'arrive') dmg *= 0.3;
  if (part === 'head' && e.type !== 'boss' && e.type !== 'brute') dmg = Math.max(dmg, e.hp + 1);   // 헤드샷은 즉사
  e.hp -= dmg; e.flash = 0.07;
  FX.blood(point, dir, part === 'head' ? 10 : 5, e.type === 'drone' || e.type === 'boss' ? [1.4, 1.0, 0.5] : [0.4, 1.0, 0.3]);
  if (e.type === 'drone' || e.type === 'boss') FX.sparks(point, 5, null);
  if (e.type !== 'boss' && e.type !== 'brute') { e.vel.x += dir.x * 1.5; e.vel.z += dir.z * 1.5; e.stagger = 0.12; }
  if (Math.random() < 0.3) AUDIO.alien(e.pos.x, e.pos.y + 1, e.pos.z, 'hurt');
  if (e.hp <= 0) { killEnemy(e, part, dir); return true; }
  return false;
}
function killEnemy(e, part, dir) {
  e.state = 'dead'; e.deadT = 0; e.deadDir = dir ? Math.atan2(dir.x, dir.z) : 0;
  G.kills++;
  if (P.sk.steal) P.hp = Math.min(P.maxHp, P.hp + 3 * P.sk.steal);
  let pts = e.T.score; const head = part === 'head';
  if (head) { G.headshots++; pts += 50; }
  if (G.time - G.lastKillT < 2.5) { G.multi++; pts += G.multi * 50; } else G.multi = 0;
  G.lastKillT = G.time;
  G.score += pts;
  HUD.kill(e.name, pts, head, G.multi);
  netOnKill(e, part, dir, pts, head);
  AUDIO.alien(e.pos.x, e.pos.y + 1, e.pos.z, 'die');
  AUDIO.kill();
  FX.blood(_e1.set(e.pos.x, e.pos.y + e.h * 0.6, e.pos.z), dir || _e2.set(0, 0, 0), 25);
  if (e.type === 'drone') { explode(_e1.set(e.pos.x, e.pos.y, e.pos.z), 3, 20, false); }
  if (e.type === 'boss') { G.boss = null; e.crash = 0; AUDIO.bossHum(false); $('bossbar').classList.add('hidden'); HUD.banner('모선 격추!', `+${pts}점 · 서울 하늘이 조금 맑아졌다`); }
  const r = Math.random();
  if (e.type === 'boss') { for (let i = 0; i < 4; i++) dropPickup(e.pos.x + R(-6, 6), e.pos.z + R(-6, 6), i % 2 ? 'gren' : 'health'); }
  else if (r < (e.type === 'brute' ? 0.6 : 0.14)) dropPickup(e.pos.x, e.pos.z, 'health');
  else if (r > 0.95) dropPickup(e.pos.x, e.pos.z, 'gren');
}

function updateEnemies(dt) {
  flowTimer -= dt;
  if (flowTimer <= 0 && !ffBuild) { flowTimer = 0.35; startFlow(P.pos.x, P.pos.z, flowExtras()); }
  stepFlow(9000);
  OBSTACLES.length = 0;
  OBSTACLES.push({ x: P.pos.x, z: P.pos.z, r: 0.4, player: true });
  for (const r of remoteList()) OBSTACLES.push({ x: r.pos.x, z: r.pos.z, r: 0.4 });
  for (let i = ENEMIES.length - 1; i >= 0; i--) {
    const e = ENEMIES[i];
    e.t += dt; e.flash -= dt;
    if (e.state === 'dead') { if (updateDead(e, dt)) { scene.remove(e.model.g); disposeEnemy(e); ENEMIES.splice(i, 1); } continue; }
    TG = pickTarget(e);
    if (e.type === 'boss') updateBoss(e, dt);
    else if (e.type === 'drone') updateDrone(e, dt);
    else updateWalker(e, dt);
    if (!e.T.fly) OBSTACLES.push({ x: e.pos.x, z: e.pos.z, r: e.r });
    if (e.type !== 'boss') for (const m of e.mats) m.emissive.setRGB(e.flash > 0 ? 1.2 : 0, e.flash > 0 ? 1.2 : 0, e.flash > 0 ? 1.2 : 0);
    e.model.g.position.copy(e.pos);
    if (e.type !== 'boss') e.model.g.rotation.y = e.yaw;
  }
  // 서로 밀어내기
  for (let i = 0; i < ENEMIES.length; i++) for (let j = i + 1; j < ENEMIES.length; j++) {
    const a = ENEMIES[i], b = ENEMIES[j];
    if (a.state === 'dead' || b.state === 'dead' || a.type === 'boss' || b.type === 'boss' || !!a.T.fly !== !!b.T.fly) continue;
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, min = a.r + b.r, d2 = dx * dx + dz * dz;
    if (d2 < min * min && d2 > 1e-4) { const d = Math.sqrt(d2), k = (min - d) / d * 0.5; a.pos.x -= dx * k; a.pos.z -= dz * k; b.pos.x += dx * k; b.pos.z += dz * k; }
  }
}
const SHARED_MATS = new Set(Object.values(EMAT));
function disposeEnemy(e) {
  e.model.g.traverse(o => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material && !SHARED_MATS.has(o.material)) o.material.dispose();
  });
}

function steer(e, dt, toward = true) {
  const dx = TG.pos.x - e.pos.x, dz = TG.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1;
  e.losT -= dt;
  if (e.losT <= 0) { e.losT = 0.35; e.los = d < 70 && gridLOS(e.pos.x, e.pos.z, TG.pos.x, TG.pos.z); }
  let vx, vz;
  if (!toward) { vx = -dx / d; vz = -dz / d; }
  else if (e.los || d < 4) { vx = dx / d; vz = dz / d; }
  else if (flowDir(e.pos.x, e.pos.z, _fd)) { vx = _fd.x; vz = _fd.z; }
  else { vx = dx / d; vz = dz / d; }
  return { vx, vz, d, dx, dz };
}
function moveEnemy(e, tvx, tvz, dt, acc = 8) {
  e.vel.x = damp(e.vel.x, tvx, acc, dt); e.vel.z = damp(e.vel.z, tvz, acc, dt);
  _pp.x = e.pos.x + e.vel.x * dt; _pp.z = e.pos.z + e.vel.z * dt;
  const y0 = e.T.fly ? e.pos.y - 0.6 : e.pos.y + 0.4, y1 = e.T.fly ? e.pos.y + 0.6 : e.pos.y + e.h;
  resolveCircle(_pp, e.r, y0, y1);
  if (!e.T.fly) collideCars(_pp, e.r);
  if (isWater(_pp.x, _pp.z) && !e.T.fly) { _pp.x = e.pos.x; _pp.z = e.pos.z; }
  e.pos.x = clamp(_pp.x, PLAY.x0, PLAY.x1); e.pos.z = clamp(_pp.z, PLAY.z0, PLAY.z1);
}
function faceTo(e, ang, dt, k = 8) { e.yaw += wrapAngle(ang - e.yaw) * (1 - Math.exp(-k * dt)); }
function relocateIfStuck(e, d, dt) {
  e.checkT -= dt;
  if (e.checkT <= 0) {
    if (d > 30 && e.lastD - d < 4) { const p = spawnPoint(45, 90, false); if (p) { e.pos.set(p.x, groundH(p.x, p.z), p.z); FX.warp(e.pos); spawnBeam(e.pos); } }
    e.lastD = d; e.checkT = 5;
  }
  if (d > 260) { const p = spawnPoint(50, 100, e.T.fly); if (p) e.pos.set(p.x, groundH(p.x, p.z) + (e.T.fly ? e.hover : 0), p.z); }
}

function updateWalker(e, dt) {
  const m = e.model, isBrute = e.type === 'brute', isRunner = e.type === 'runner';
  if (e.state === 'spawn') {
    const k = smooth(clamp(e.t / 0.8, 0, 1)); m.g.scale.setScalar((isBrute ? 1.6 : 1) * k); e.scaleK = 1;
    if (e.t > 0.8) e.state = 'chase';
    return;
  }
  const st = steer(e, dt);
  e.atkCd -= dt; e.stagger = Math.max(0, (e.stagger || 0) - dt);
  let spd = e.T.speed * (1 + Math.min(0.4, G.wave * 0.02)) * (1 + 0.07 * e.tier);
  if (e.type === 'grunt' && e.armed && e.state === 'chase' && e.los && st.d < 46 && st.d > 8 && e.atkCd <= 0) {
    e.state = 'shoot'; e.burst = 3 + ((Math.random() * 2) | 0); e.bt = R(0.7, 1.1); e.strafe2 = Math.random() < 0.5 ? 1 : -1;
  }
  if (e.state === 'chase') {
    if (isRunner && e.los && st.d < 9 && st.d > 3 && e.atkCd <= 0 && e.leap <= 0) {
      e.leap = 0.55; e.atkCd = 2.2; e.hitDone = false; e.vel.x = st.dx / st.d * 13; e.vel.z = st.dz / st.d * 13; e.vy = 5.5;
      AUDIO.alien(e.pos.x, e.pos.y, e.pos.z, 'attack');
    }
    const reach = isBrute ? 3.0 : isRunner ? 1.3 : 1.8;
    if (st.d < reach && e.atkCd <= 0 && e.leap <= 0) { e.state = 'attack'; e.atk = 0; e.hitDone = false; AUDIO.alien(e.pos.x, e.pos.y + 1, e.pos.z, 'attack'); }
  }
  if (e.leap > 0) {
    e.leap -= dt; e.vy -= 22 * dt;
    _pp.x = e.pos.x + e.vel.x * dt; _pp.z = e.pos.z + e.vel.z * dt; resolveCircle(_pp, e.r, e.pos.y + 0.3, e.pos.y + 1);
    if (!isWater(_pp.x, _pp.z)) { e.pos.x = _pp.x; e.pos.z = _pp.z; }
    e.pos.y = Math.max(groundH(e.pos.x, e.pos.z), e.pos.y + e.vy * dt);
    if (!e.hitDone && Math.hypot(TG.pos.x - e.pos.x, TG.pos.z - e.pos.z) < 1.4 && Math.abs(TG.pos.y - e.pos.y) < 1.5) { e.hitDone = true; hurtTarget(10, e.pos); }
    faceTo(e, Math.atan2(e.vel.x, e.vel.z), dt, 12);
  } else if (e.state === 'shoot') {
    // 멈춰 서서 조준 → 짧게 연사. 에임은 일부러 부정확하다.
    faceTo(e, Math.atan2(st.dx, st.dz), dt, 7);
    moveEnemy(e, -st.dz / st.d * e.strafe2 * 1.3, st.dx / st.d * e.strafe2 * 1.3, dt, 6);
    e.bt -= dt;
    if (!e.los || st.d < 6 || st.d > 55) { e.state = 'chase'; e.atkCd = 1.2; }
    else if (e.bt <= 0) {
      const err = (1.1 + st.d * 0.07) * Math.max(0.5, 1 - 0.1 * e.tier), lead = st.d / 55 * 0.35;
      e.model.muzzle.getWorldPosition(_e2);
      const from = _e2.clone();
      fireBolt(from, _e1.set(TG.pos.x + TG.vel.x * lead + R(-err, err), TG.pos.y + 1.1 + R(-err * 0.6, err * 0.6), TG.pos.z + TG.vel.z * lead + R(-err, err)), 55, 20, 0.16, new THREE.Color(0.5, 4, 1.4));
      FXA.spawn(from.x, from.y, from.z, 0, 0, 0, 1.6, 4, 1.2, 0.35, 0.07, 0, 1);
      FXA.spawn(from.x, from.y, from.z, 0, 0, 0, 0.6, 2.5, 0.8, 0.8, 0.09, 0, 1);
      e.burst--; e.bt = 0.34;
      if (e.burst <= 0) { e.state = 'chase'; e.atkCd = R(3.5, 5.5) * Math.max(0.55, 1 - 0.1 * e.tier); }
    }
  } else if (e.state === 'attack') {
    e.atk += dt;
    moveEnemy(e, 0, 0, dt, 10);
    faceTo(e, Math.atan2(st.dx, st.dz), dt, 10);
    const hitT = isBrute ? 0.7 : isRunner ? 0.15 : 0.38, endT = isBrute ? 1.3 : isRunner ? 0.5 : 0.8;
    if (!e.hitDone && e.atk > hitT) {
      e.hitDone = true;
      const reach = isBrute ? 4.2 : isRunner ? 1.8 : 2.5;
      if (isBrute) { FX.dust(_e1.set(e.pos.x + Math.sin(e.yaw) * 2, e.pos.y + 0.2, e.pos.z + Math.cos(e.yaw) * 2), 20, null, [0.5, 0.46, 0.4]); AUDIO.boom(e.pos.x, e.pos.y, e.pos.z, 0.4); if (!TG.remote) P.shake = Math.max(P.shake, clamp(1 - st.d / 15, 0, 0.8)); }
      if (st.d < reach) {
        hurtTarget(isBrute ? 30 : isRunner ? 7 : 14, e.pos);
        if (isBrute) knockTarget(st.dx / st.d * 9, st.dz / st.d * 9);
      }
    }
    if (e.atk > endT) { e.state = 'chase'; e.atkCd = isBrute ? 1.2 : isRunner ? 0.5 : 0.7; }
  } else {
    const slow = e.stagger > 0 ? 0.3 : 1;
    moveEnemy(e, st.vx * spd * slow, st.vz * spd * slow, dt);
    const sp = Math.hypot(e.vel.x, e.vel.z);
    if (sp > 0.3) faceTo(e, Math.atan2(e.vel.x, e.vel.z), dt);
    relocateIfStuck(e, st.d, dt);
  }
  if (e.leap <= 0) e.pos.y = damp(e.pos.y, groundH(e.pos.x, e.pos.z), 20, dt);
  animateWalker(e, dt);
}
function animateWalker(e, dt) {
  const m = e.model, sp = Math.hypot(e.vel.x, e.vel.z);
  if (e.type === 'runner') {
    e.phase += dt * (4 + sp * 2.2);
    for (const l of m.legs) {
      const ph = e.phase + (l.userData.k % 2 === (l.userData.side > 0 ? 0 : 1) ? 0 : Math.PI);
      l.rotation.y = Math.sin(ph) * 0.45 * Math.min(1, sp / 3 + 0.2);
      l.rotation.z = Math.max(0, Math.cos(ph)) * 0.35 * l.userData.side;
    }
    m.body.position.y = 0.6 + Math.abs(Math.sin(e.phase * 2)) * 0.05;
    m.body.rotation.x = e.leap > 0 ? -0.4 : 0;
    m.head.rotation.x = e.state === 'attack' ? Math.sin(e.atk * 30) * 0.3 : 0;
    return;
  }
  const amt = Math.min(1, sp / 3);
  e.phase += dt * (2 + sp * 1.7) * (e.type === 'brute' ? 0.7 : 1);
  const s = Math.sin(e.phase);
  m.legL.rotation.x = -s * 0.65 * amt; m.legR.rotation.x = s * 0.65 * amt;
  m.legL.userData.shin.rotation.x = Math.max(0, -Math.cos(e.phase)) * 0.9 * amt;
  m.legR.userData.shin.rotation.x = Math.max(0, Math.cos(e.phase)) * 0.9 * amt;
  m.hips.position.y = 1.0 + Math.abs(Math.cos(e.phase)) * 0.06 * amt - 0.03;
  m.torso.rotation.x = 0.12 * amt + (e.stagger > 0 ? -0.3 : 0);
  m.head.rotation.y = Math.sin(e.t * 0.7) * 0.2;
  if (e.state === 'shoot') {
    m.armR.rotation.x = damp(m.armR.rotation.x, -1.42, 14, dt); m.armR.rotation.z = -0.04; m.armR.userData.fore.rotation.x = damp(m.armR.userData.fore.rotation.x, 0, 14, dt);
    m.armL.rotation.x = damp(m.armL.rotation.x, -1.05, 12, dt); m.armL.rotation.z = 0.5; m.armL.userData.fore.rotation.x = -0.9;
    m.torso.rotation.x = -0.05; m.legL.rotation.x = m.legR.rotation.x = 0;
  } else if (e.state === 'attack') {
    const k = e.type === 'brute' ? e.atk / 0.7 : e.atk / 0.38;
    const raise = k < 1 ? smooth(k) : Math.max(0, 1 - (k - 1) * 3);
    m.armL.rotation.x = m.armR.rotation.x = -2.6 * raise + (k > 1 ? 1.2 : 0);
    m.torso.rotation.x = k < 1 ? -0.2 * raise : 0.35;
  } else {
    m.armL.rotation.x = s * 0.5 * amt - 0.15; m.armR.rotation.x = -s * 0.5 * amt - 0.15;
    m.armL.rotation.z = 0.12; m.armR.rotation.z = -0.12;
    m.armL.userData.fore.rotation.x = -0.4; m.armR.userData.fore.rotation.x = -0.4;
  }
  if (m.core) m.core.scale.setScalar(1 + Math.sin(e.t * 6) * 0.15);
}
function updateDrone(e, dt) {
  const m = e.model;
  if (e.state === 'spawn') { m.g.scale.setScalar(smooth(clamp(e.t / 0.7, 0, 1))); if (e.t > 0.7) e.state = 'chase'; }
  const dx = TG.pos.x - e.pos.x, dz = TG.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1;
  let st;
  if (d > 24) st = steer(e, dt);
  else if (d < 13) st = steer(e, dt, false);
  else { st = steer(e, dt); st.vx = -dz / d * e.strafe; st.vz = dx / d * e.strafe; if (Math.random() < dt * 0.3) e.strafe *= -1; }
  moveEnemy(e, st.vx * e.T.speed * (1 + 0.05 * e.tier), st.vz * e.T.speed * (1 + 0.05 * e.tier), dt, 3);
  const gy = groundH(e.pos.x, e.pos.z) + e.hover + Math.sin(e.t * 2 + e.phase) * 0.4;
  e.pos.y = damp(e.pos.y, gy, 3, dt);
  faceTo(e, Math.atan2(dx, dz), dt, 5);
  m.ring.rotation.z += dt * 4;
  m.g.rotation.z = -e.vel.x * 0.03; m.g.rotation.x = e.vel.z * 0.03;
  relocateIfStuck(e, d, dt);
  // 사격 (발사 전 눈이 밝아짐)
  e.shootCd -= dt;
  const charge = clamp(1 - e.shootCd / 0.5, 0, 1);
  m.eye.material.color.setRGB(5 + charge * 8, 0.5 + charge * 3, 2 + charge * 3);
  if (e.shootCd <= 0 && e.state === 'chase') {
    e.shootCd = R(2.6, 4.0) * Math.max(0.55, 1 - 0.1 * e.tier);
    _e1.copy(e.pos); _e2.set(TG.pos.x, TG.pos.y + 1.3, TG.pos.z);
    const dist = _e1.distanceTo(_e2);
    if (dist < 70) {
      _e2.sub(_e1).normalize();
      const r = raycastWorld(_e1, _e2, dist);
      if (r.t >= dist - 0.5) fireBolt(e.pos, _e2.set(TG.pos.x + TG.vel.x * dist / 30 + R(-1, 1), TG.pos.y + 1.2 + R(-0.5, 0.5), TG.pos.z + TG.vel.z * dist / 30 + R(-1, 1)), 36, 20, 0.35, new THREE.Color(4, 0.6, 2.6));
    }
  }
}
function fireBolt(from, target, speed, dmg, size, col, grav = 0) {
  const dir = _e1.copy(target).sub(from).normalize();
  const s = takeSprite(col, size * 2.5);
  s.position.copy(from);
  const bolt = { pos: from.clone(), vel: dir.clone().multiplyScalar(speed), dmg, r: size, s, life: 5, col, grav };
  BOLTS.push(bolt); netOnBolt(bolt);
  AUDIO.zap(from.x, from.y, from.z);
}
function updateBolts(dt) {
  for (let i = BOLTS.length - 1; i >= 0; i--) {
    const b = BOLTS[i];
    b.life -= dt; b.vel.y -= b.grav * dt;
    b.pos.addScaledVector(b.vel, dt); b.s.position.copy(b.pos);
    FXA.spawn(b.pos.x, b.pos.y, b.pos.z, R(-0.3, 0.3), R(-0.3, 0.3), R(-0.3, 0.3), b.col.r * 0.4, b.col.g * 0.4, b.col.b * 0.4, b.r * 0.7, 0.25, 0, 1);
    let hit = b.life <= 0;
    const pd = Math.hypot(P.pos.x - b.pos.x, P.pos.y + 1.0 - b.pos.y, P.pos.z - b.pos.z);
    if (!hit && pd < 0.65 + b.r) { damagePlayer(b.dmg, b.pos); hit = true; }
    if (!hit && (pointSolid(b.pos.x, b.pos.y, b.pos.z) || b.pos.y < groundH(b.pos.x, b.pos.z))) {
      hit = true;
    }
    if (hit) {
      if (b.r > 1 && b.life > 0) explode(b.pos, 6, 40, false);
      FX.sparks(b.pos, 10, null);
      for (let k = 0; k < 10; k++) FXA.spawn(b.pos.x, b.pos.y, b.pos.z, R(-4, 4), R(-1, 4), R(-4, 4), b.col.r, b.col.g, b.col.b, 0.12, 0.35, 6, 2);
      b.s.visible = false; BOLTS.splice(i, 1);
    }
  }
}
function updateDead(e, dt) {
  e.deadT += dt;
  const m = e.model;
  if (e.type === 'boss') return updateBossDeath(e, dt);
  if (e.type === 'drone') { m.g.scale.setScalar(Math.max(0.001, 1 - e.deadT * 4)); return e.deadT > 0.3; }
  const fall = smooth(clamp(e.deadT / 0.55, 0, 1));
  if (e.type === 'runner') { m.g.rotation.z = fall * Math.PI * 0.9; m.g.position.y = e.pos.y + fall * 0.3; }
  else {
    m.g.rotation.order = 'YXZ';
    m.g.rotation.x = -fall * 1.45; m.g.position.y = e.pos.y + fall * 0.12;
    m.armL.rotation.x = m.armR.rotation.x = lerp(m.armL.rotation.x, -2.2, dt * 5);
  }
  if (e.deadT > 1.6) {
    const k = clamp((e.deadT - 1.6) / 1.2, 0, 1);
    m.g.position.y = e.pos.y - k * 0.6;
    for (const mt of e.mats) { mt.transparent = true; mt.opacity = 1 - k; }
    if (Math.random() < 0.3) FXA.spawn(e.pos.x + R(-0.5, 0.5), e.pos.y + 0.3, e.pos.z + R(-0.5, 0.5), 0, R(1, 2), 0, 0.3, 1.2, 0.5, 0.12, 0.6, -1, 1);
  }
  return e.deadT > 2.9;
}

let PICK_RES = null;
function dropPickup(x, z, kind, id) {
  if (!PICK_RES) {
    const tex = canvasTex(64, 64, (c) => { c.fillStyle = '#f4f4f2'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#d62828'; c.fillRect(24, 10, 16, 44); c.fillRect(10, 24, 44, 16); }, { aniso: false });
    PICK_RES = {
      boxGeo: new THREE.BoxGeometry(0.55, 0.35, 0.4), boxMat: stdMat(0xffffff, 0.5, 0, { map: tex, emissive: 0x331111 }),
      grenGeo: new THREE.SphereGeometry(0.1, 10, 8).scale(1, 1.25, 1), grenMat: stdMat(0x3d4a2c, 0.6, 0.3),
      glowH: new THREE.SpriteMaterial({ map: glowTexture, color: new THREE.Color(0.5, 2, 0.8), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
      glowG: new THREE.SpriteMaterial({ map: glowTexture, color: new THREE.Color(2, 1.6, 0.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
    };
  }
  const g = new THREE.Group();
  if (kind === 'health') { const box = new THREE.Mesh(PICK_RES.boxGeo, PICK_RES.boxMat); box.castShadow = true; g.add(box); }
  else for (let i = 0; i < 2; i++) { const gr = new THREE.Mesh(PICK_RES.grenGeo, PICK_RES.grenMat); gr.position.x = (i - 0.5) * 0.24; g.add(gr); }
  const glow = new THREE.Sprite(kind === 'health' ? PICK_RES.glowH : PICK_RES.glowG);
  glow.scale.setScalar(1.6); g.add(glow);
  const y = groundH(x, z);
  g.position.set(x, y + 0.6, z); scene.add(g);
  if (id === undefined) id = NET.pid++;
  PICKUPS.push({ g, kind, x, z, y, t: 0, id });
  if (isHost()) netBcast({ t: 'pk', id, kind, x, z });
}
function updatePickups(dt) {
  for (let i = PICKUPS.length - 1; i >= 0; i--) {
    const p = PICKUPS[i];
    p.t += dt;
    p.g.position.y = p.y + 0.6 + Math.sin(p.t * 2.5) * 0.12; p.g.rotation.y += dt * 1.6;
    p.g.visible = p.t < 25 || Math.floor(p.t * 6) % 2 === 0;
    const d = Math.hypot(P.pos.x - p.x, P.pos.z - p.z);
    let take = false;
    if (isClient() && d < 1.7 && P.alive && ((p.kind === 'health' && P.hp < P.maxHp) || (p.kind === 'gren' && P.grenades < 5))) { netToHost({ t: 'take', id: p.id }); scene.remove(p.g); PICKUPS.splice(i, 1); continue; }
    if (!isClient() && d < 1.7 && P.alive) {
      if (p.kind === 'health' && P.hp < P.maxHp) { P.hp = Math.min(P.maxHp, P.hp + 40); HUD.toast('+40 체력', '#7dff9a'); take = true; }
      if (p.kind === 'gren' && P.grenades < 5) { P.grenades = Math.min(5, P.grenades + 2); HUD.toast('수류탄 +2', '#ffd27a'); take = true; }
    }
    if (take) AUDIO.pickup();
    if (take || p.t > 30) { if (take && isHost()) netBcast({ t: 'pkx', id: p.id }); scene.remove(p.g); PICKUPS.splice(i, 1); }
  }
}
