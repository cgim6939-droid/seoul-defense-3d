// ============================================================
//  보스 (외계 모선) · 웨이브 진행
// ============================================================
const BOSS_FX = [];
function updateBoss(e, dt) {
  const m = e.model;
  m.lights.rotation.y += dt * 0.8;
  m.hull.rotation.y += dt * 0.05;
  for (const c of m.cores) c.scale.setScalar(1 + Math.sin(e.t * 5) * 0.12);
  m.hull.material.emissive.setRGB(e.flash > 0 ? 0.5 : 0, e.flash > 0 ? 0.3 : 0, e.flash > 0 ? 0.6 : 0);
  const orbit = e.t * 0.08;
  const tx = TG.pos.x + Math.cos(orbit) * 40, tz = TG.pos.z + Math.sin(orbit) * 40;
  if (e.state === 'arrive') {
    e.pos.x = damp(e.pos.x, tx, 0.5, dt); e.pos.z = damp(e.pos.z, tz, 0.5, dt);
    e.pos.y = damp(e.pos.y, 55, 0.55, dt);
    P.shake = Math.max(P.shake, 0.35);
    if (e.pos.y < 60) { e.state = 'fight'; e.attackT = 3; }
  } else {
    e.pos.x = damp(e.pos.x, clamp(tx, PLAY.x0, PLAY.x1), 0.35, dt); e.pos.z = damp(e.pos.z, clamp(tz, PLAY.z0, PLAY.z1), 0.35, dt);
    e.pos.y = 55 + Math.sin(e.t * 0.6) * 2;
    m.g.rotation.z = Math.sin(e.t * 0.4) * 0.04; m.g.rotation.x = Math.cos(e.t * 0.33) * 0.04;
    e.attackT -= dt;
    if (e.attackT <= 0) {
      const mode = e.mode++ % 3;
      if (mode === 0) {   // 플라즈마 포격
        for (let i = 0; i < 14; i++) {
          setTimeout(() => {
            if (e.state === 'dead' || G.state !== 'play') return;
            const c = m.cores[i % 4]; c.getWorldPosition(_e1);
            fireBolt(_e1.clone(), _e2.set(TG.pos.x + R(-9, 9), TG.pos.y, TG.pos.z + R(-9, 9)), 24, 0, 1.3, new THREE.Color(4, 1.2, 0.4), 4);
          }, i * 140);
        }
        e.attackT = 5;
      } else if (mode === 1) {   // 추적 빔
        for (let i = 0; i < 4; i++) setTimeout(() => { if (e.state !== 'dead' && G.state === 'play') bossBeam(TG.pos.x + TG.vel.x * 0.8, TG.pos.z + TG.vel.z * 0.8, e); }, i * 900);
        e.attackT = 6;
      } else {   // 소환
        for (let i = 0; i < 5; i++) { const p = spawnPoint(20, 45, i < 2); if (p) spawnEnemy(i < 2 ? 'drone' : 'grunt', p); }
        HUD.toast('모선이 병력을 내려보낸다!', '#e7b6ff');
        e.attackT = 7;
      }
    }
  }
  AUDIO.bossHum(true, clamp(1.4 - camera.position.distanceTo(e.pos) / 200, 0.3, 1.2));
  updateBossFX(dt);
}
function bossBeam(x, z, e) {
  if (isHost()) netBcast({ t: 'bb', x, z });
  const y = groundH(x, z);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 4, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.3, 0.6), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  ring.position.set(x, y + 0.15, z); scene.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 1, 24, 1, true).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.6, 2.5), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beam.position.set(x, y, z); beam.scale.y = Math.max(1, e.pos.y - y); scene.add(beam);
  BOSS_FX.push({ ring, beam, x, z, y, t: 0, hit: false });
}
function updateBossFX(dt) {
  for (let i = BOSS_FX.length - 1; i >= 0; i--) {
    const b = BOSS_FX[i]; b.t += dt;
    b.ring.material.opacity = b.t < 1.2 ? 0.4 + 0.5 * Math.abs(Math.sin(b.t * 10)) : 0;
    b.ring.scale.setScalar(b.t < 1.2 ? 1.6 - b.t * 0.5 : 1);
    if (b.t > 1.2 && b.t < 2.0) {
      b.beam.material.opacity = 0.85 * Math.sin(Math.PI * (b.t - 1.2) / 0.8);
      if (!b.hit) {
        b.hit = true; FX.explosion(new THREE.Vector3(b.x, b.y + 0.5, b.z), 0.8); AUDIO.boom(b.x, b.y, b.z, 1);
        if (Math.hypot(P.pos.x - b.x, P.pos.z - b.z) < 4.6) damagePlayer(32, new THREE.Vector3(b.x, b.y, b.z));
      }
    } else if (b.t >= 2.0) b.beam.material.opacity = 0;
    if (b.t > 2.1) { for (const o of [b.ring, b.beam]) { scene.remove(o); o.geometry.dispose(); o.material.dispose(); } BOSS_FX.splice(i, 1); }
  }
}
function updateBossDeath(e, dt) {
  const m = e.model;
  e.vy = (e.vy || 0) - 9 * dt;
  e.pos.y += e.vy * dt;
  m.g.rotation.z += dt * 0.25; m.g.rotation.x += dt * 0.12;
  m.g.position.copy(e.pos);
  e.boomT = (e.boomT || 0) - dt;
  if (e.boomT <= 0) { e.boomT = 0.25; const p = e.pos.clone().add(new THREE.Vector3(R(-22, 22), R(-3, 4), R(-22, 22))); FX.explosion(p, 1.2); AUDIO.boom(p.x, p.y, p.z, 1.2); }
  updateBossFX(dt);
  if (e.pos.y < groundH(e.pos.x, e.pos.z) + 4) {
    for (let i = 0; i < 6; i++) FX.explosion(e.pos.clone().add(new THREE.Vector3(R(-15, 15), 2, R(-15, 15))), 2);
    flashLight(e.pos, 300, 1.0, 0xffb060);
    AUDIO.boom(e.pos.x, e.pos.y, e.pos.z, 2.5);
    P.shake = 1.4;
    return true;
  }
  return false;
}

function pickType() {
  const n = G.wave;
  const w = [['grunt', 10], ['runner', n >= 2 ? 5 + n : 0], ['drone', n >= 4 ? 1 + n * 0.4 : 0], ['brute', n >= 4 ? 1 + n * 0.5 : 0]];
  let tot = w.reduce((s, x) => s + x[1], 0), r = Math.random() * tot;
  for (const [t, k] of w) if ((r -= k) < 0) return t;
  return 'grunt';
}
function beginWave() {
  G.wave++;
  G.toSpawn = Math.min(8 + G.wave * 3 + tierOf() * 4, 60);
  G.spawnTimer = 1.5; G.waveState = 'active';
  const loc = locationOf(P.pos.x, P.pos.z).n;
  if (G.wave % 5 === 0) {
    spawnEnemy('boss');
    G.toSpawn = Math.floor(G.toSpawn * 0.5);
    HUD.banner(`WAVE ${G.wave}`, '⚠ 외계 모선이 서울 상공에 진입했다 ⚠');
    $('bossbar').classList.remove('hidden');
  } else HUD.banner(`WAVE ${G.wave}`, `외계 병력이 ${loc} 일대로 강하 중`);
  if (G.wave > 1 && (G.wave - 1) % 3 === 0) HUD.toast(`⚠ 난이도 상승! ${tierOf() + 1}단계 — 적이 더 빠르고 단단하고 정확해집니다`, '#ff8a6a');
  AUDIO.siren();
}
function waveClear() {
  G.waveState = 'break'; G.waveTimer = 12;
  const bonus = G.wave * 200;
  G.score += bonus;
  P.grenades = Math.min(5, P.grenades + 1);
  HUD.banner('웨이브 클리어', `보너스 +${bonus}점 · 수류탄 +1 · 12초 후 다음 웨이브`);
  AUDIO.chime();
  $('bossbar').classList.add('hidden');
  netOnWaveClear();
  openSkillPick(false);
}
function updateWaves(dt) {
  if (G.waveState === 'break') {
    G.waveTimer -= dt;
    if (G.waveTimer <= 0) beginWave();
    return;
  }
  if (G.waveState !== 'active') return;
  let alive = 0;
  for (const e of ENEMIES) if (e.state !== 'dead' && e.type !== 'boss') alive++;
  if (G.toSpawn > 0) {
    G.spawnTimer -= dt;
    const cap = Math.min(4 + G.wave + tierOf(), 14);
    if (G.spawnTimer <= 0 && alive < cap) {
      const t = pickType(), first = spawnEnemy(t);
      if (first) {
        G.toSpawn--;
        const extra = t === 'brute' || G.wave < 3 ? 0 : Math.min(G.toSpawn, Math.random() < 0.3 ? 1 : 0);
        for (let i = 0; i < extra; i++) {
          const a = Math.random() * 6.28, x = first.pos.x + Math.cos(a) * R(3, 6), z = first.pos.z + Math.sin(a) * R(3, 6);
          if (!walkBlocked[cellOf(x, z)]) { spawnEnemy(pickType() === 'brute' ? 'grunt' : t, { x, z }); G.toSpawn--; }
        }
      }
      G.spawnTimer = Math.max(1.2, 3.6 - G.wave * 0.12 - tierOf() * 0.2) * R(0.8, 1.4);
    }
  } else if (alive === 0 && !G.boss && !ENEMIES.some(e => e.type === 'boss')) waveClear();
}
