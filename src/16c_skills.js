// ============================================================
//  레벨업 스킬 (탕탕특공대 스타일): 웨이브를 깰 때마다 3개 중 1개 선택
//  패시브(강화) + 자동 발동 스킬(번개 · 불꽃 오라 · 충격파)
// ============================================================
const SKILLS = [
  { id: 'dmg', icon: '💥', name: '화력 강화', max: 6, desc: l => `총 데미지 +15% (누적 +${l * 15}%)` },
  { id: 'rate', icon: '⚡', name: '속사', max: 5, desc: l => `연사 속도 +12% (누적 +${l * 12}%)` },
  { id: 'crit', icon: '🎯', name: '급소 사격', max: 5, desc: l => `치명타 확률 ${l * 10}% (데미지 2배)` },
  { id: 'reload', icon: '🔄', name: '빠른 재장전', max: 4, desc: l => `재장전 속도 +${l * 15}%` },
  { id: 'hp', icon: '❤️', name: '강인한 체력', max: 5, desc: l => `최대 체력 +20 · 즉시 20 회복 (현재 최대 ${100 + l * 20})` },
  { id: 'regen', icon: '🩹', name: '자가 치유', max: 4, desc: l => `체력이 매초 ${(l * 1.5).toFixed(1)}씩 자동 회복` },
  { id: 'steal', icon: '🧛', name: '전리품 회복', max: 4, desc: l => `외계인 처치 시 체력 +${l * 3}` },
  { id: 'speed', icon: '👟', name: '신속', max: 4, desc: l => `이동 속도 +${l * 8}%` },
  { id: 'gren', icon: '💣', name: '폭약 전문가', max: 4, desc: l => `수류탄 +2 · 폭발 범위 +${l * 20}% · 피해 +${l * 25}%` },
  { id: 'light', icon: '🌩️', name: '번개 소환', max: 5, kind: 'active', desc: l => `자동으로 가까운 적 ${1 + (l >> 1)}명에게 번개 · ${Math.max(1, 3.6 - 0.45 * l).toFixed(1)}초마다 (피해 ${45 + 20 * l})` },
  { id: 'aura', icon: '🔥', name: '불꽃 오라', max: 5, kind: 'active', desc: l => `주변 ${(3.5 + 0.7 * l).toFixed(1)}m 안의 적에게 지속 피해 (틱당 ${7 + 4 * l})` },
  { id: 'pulse', icon: '🌀', name: '충격파', max: 5, kind: 'active', desc: l => `${Math.max(4, 9 - l)}초마다 반경 ${(8 + 1.8 * l).toFixed(0)}m 충격파 · 피해 ${35 + 15 * l}` },
];
const SKST = { light: 2, auraT: 0, pulse: 5, ring: null, pulseRing: null, pulseT: 9, pulseR: 0, cards: [] };
function tierOf() { return Math.floor((G.wave - 1) / 3); }
function resetSkills() {
  for (const s of SKILLS) P.sk[s.id] = 0;
  P.maxHp = 100; SKST.light = 2; SKST.auraT = 0; SKST.pulse = 5; SKST.pulseT = 9;
  if (SKST.ring) SKST.ring.visible = false; if (SKST.pulseRing) SKST.pulseRing.visible = false;
  renderSkillBar();
}
function initSkillFX() {
  const mk = (r0, col) => new THREE.Mesh(new THREE.RingGeometry(r0, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  SKST.ring = mk(0.8, new THREE.Color(3, 1.1, 0.3)); SKST.pulseRing = mk(0.9, new THREE.Color(1.2, 2.4, 4));
  for (const r of [SKST.ring, SKST.pulseRing]) { r.visible = false; r.frustumCulled = false; scene.add(r); }
}
function renderSkillBar() {
  $('skillBar').innerHTML = SKILLS.filter(s => P.sk[s.id] > 0).map(s => `<div class="skb" title="${s.name}">${s.icon}<b>${P.sk[s.id]}</b></div>`).join('');
}
function openSkillPick(first) {
  const pool = SKILLS.filter(s => P.sk[s.id] < s.max), picks = [];
  if (!pool.length) return false;
  while (picks.length < 3 && pool.length) picks.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
  $('skTitle').textContent = first ? '시작 스킬 선택' : `LEVEL ${G.wave} 클리어! 스킬 선택`;
  $('skSub').textContent = '하나를 골라 강해지세요  ·  마우스 클릭 또는 1 · 2 · 3 키';
  const box = $('skCards'); box.innerHTML = ''; SKST.cards = picks.map(s => s.id);
  picks.forEach((s, i) => {
    const lv = P.sk[s.id], d = document.createElement('button');
    d.className = 'scard' + (s.kind === 'active' ? ' act' : '');
    d.innerHTML = `<div class="sk-key">${i + 1}</div><div class="sk-ic">${s.icon}</div><div class="sk-nm">${s.name}</div><div class="sk-lv">${lv ? `Lv.${lv} → Lv.${lv + 1}` : 'NEW · Lv.1'}${s.kind === 'active' ? ' · 자동 발동' : ''}</div><div class="sk-ds">${s.desc(lv + 1)}</div>`;
    d.onclick = () => chooseSkill(s.id); box.appendChild(d);
  });
  G.state = 'skill'; mouseDown = rmb = false; closeMap();
  show('skillPick', true);
  if (document.pointerLockElement) document.exitPointerLock();
  return true;
}
function chooseSkill(id) {
  if (G.state !== 'skill') return;
  P.sk[id]++;
  if (id === 'hp') { P.maxHp += 20; P.hp = Math.min(P.maxHp, P.hp + 20); }
  if (id === 'gren') P.grenades = Math.min(9, P.grenades + 2);
  if (id === 'light') SKST.light = Math.min(SKST.light, 1);
  show('skillPick', false); renderSkillBar(); AUDIO.chime();
  G.state = 'play'; requestLock();
}
addEventListener('keydown', (e) => {
  if (G.state !== 'skill') return;
  const i = { Digit1: 0, Digit2: 1, Digit3: 2 }[e.code];
  if (i !== undefined && SKST.cards[i]) chooseSkill(SKST.cards[i]);
});

const _sd = new THREE.Vector3(), _sp = new THREE.Vector3();
function nearEnemies(r) {
  const out = [];
  for (const e of ENEMIES) { if (e.state === 'dead' || e.state === 'spawn') continue; const d = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z); if (d < r + (e.type === 'boss' ? 30 : 0)) out.push([d, e]); }
  return out.sort((a, b) => a[0] - b[0]).map(x => x[1]);
}
function skillHit(e, dmg) {
  _sp.set(e.pos.x, e.pos.y + e.h * 0.5, e.pos.z); _sd.set(e.pos.x - P.pos.x, 0.2, e.pos.z - P.pos.z).normalize();
  return damageEnemy(e, dmg, 'body', _sd, _sp);
}
function updateSkills(dt) {
  if (!P.alive) return;
  const sk = P.sk;
  if (sk.regen && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + sk.regen * 1.5 * dt);
  if (sk.light) {
    SKST.light -= dt;
    if (SKST.light <= 0) {
      SKST.light = Math.max(1, 3.6 - 0.45 * sk.light);
      const targets = nearEnemies(48).slice(0, 1 + (sk.light >> 1));
      for (const e of targets) {
        const hit = new THREE.Vector3(e.pos.x, e.pos.y + e.h * 0.5, e.pos.z), top = new THREE.Vector3(e.pos.x + R(-4, 4), e.pos.y + 70, e.pos.z + R(-4, 4));
        const tr = spawnTracer(top, hit, new THREE.Color(3, 4, 9)); if (tr) { tr.m.scale.x = tr.m.scale.y = 0.35; tr.t = 0.12; }
        FX.sparks(hit, 14, null); flashLight(hit, 50, 0.18, 0x9fb7ff); AUDIO.zap(hit.x, hit.y, hit.z);
        skillHit(e, 45 + 20 * sk.light);
      }
    }
  }
  const ring = SKST.ring;
  if (sk.aura) {
    const rad = 3.5 + 0.7 * sk.aura;
    ring.visible = true; ring.position.set(P.pos.x, P.pos.y + 0.12, P.pos.z);
    ring.scale.set(rad, 1, rad); ring.material.opacity = 0.35 + 0.2 * Math.sin(G.time * 6);
    SKST.auraT -= dt;
    if (SKST.auraT <= 0) {
      SKST.auraT = 0.35;
      for (const e of nearEnemies(rad + 2)) {
        if (Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < rad + e.r && Math.abs(e.pos.y - P.pos.y) < 6) skillHit(e, 7 + 4 * sk.aura);
      }
      for (let i = 0; i < 5; i++) { const a = Math.random() * 6.28; FXA.spawn(P.pos.x + Math.cos(a) * rad * R(0.3, 1), P.pos.y + 0.2, P.pos.z + Math.sin(a) * rad * R(0.3, 1), 0, R(1, 3), 0, 3, 1.2, 0.3, R(0.1, 0.2), R(0.3, 0.6), -1, 1); }
    }
  } else if (ring) ring.visible = false;
  const pr = SKST.pulseRing;
  if (sk.pulse) {
    SKST.pulse -= dt;
    if (SKST.pulse <= 0) {
      SKST.pulse = Math.max(4, 9 - sk.pulse); SKST.pulseT = 0; SKST.pulseR = 8 + 1.8 * sk.pulse;
      for (const e of nearEnemies(SKST.pulseR + 2)) {
        skillHit(e, 35 + 15 * sk.pulse);
        if (e.type !== 'boss' && e.state !== 'dead') { const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz) || 1; e.vel.x += dx / d * 9; e.vel.z += dz / d * 9; e.stagger = 0.4; }
      }
      FX.dust(_sp.set(P.pos.x, P.pos.y + 0.3, P.pos.z), 24, null, [0.6, 0.7, 0.9]); AUDIO.boom(P.pos.x, P.pos.y, P.pos.z, 0.5); P.shake = Math.max(P.shake, 0.35);
    }
  }
  if (pr) {
    SKST.pulseT += dt;
    if (SKST.pulseT < 0.5) { const k = SKST.pulseT / 0.5; pr.visible = true; pr.position.set(P.pos.x, P.pos.y + 0.2, P.pos.z); pr.scale.set(SKST.pulseR * k, 1, SKST.pulseR * k); pr.material.opacity = 0.8 * (1 - k); }
    else pr.visible = false;
  }
}
