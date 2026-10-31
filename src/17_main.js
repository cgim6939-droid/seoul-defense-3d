// ============================================================
//  메뉴 · 게임 흐름 · 메인 루프 · 초기화
// ============================================================
function show(id, on) { $(id).classList.toggle('hidden', !on); }
function fadeTo(v) { $('fade').style.opacity = v; }
function syncSettingsUI() {
  for (const [seg, key] of [['segQuality', 'quality'], ['segTod', 'tod']])
    for (const b of $(seg).querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === SETTINGS[key]);
  $('rngSens').value = SETTINGS.sens; $('rngFov').value = SETTINGS.fov; $('rngVol').value = SETTINGS.volume;
}
function bindUI() {
  $('btnStart').onclick = () => show('modeSel', true);
  $('cardSurvival').onclick = () => startGame();
  $('cardMulti').onclick = () => { mpSync(); show('mpSet', true); };
  const mpSegs = [['segMpMode', 'mpMode', 'create'], ['segMpMax', 'mpMax', '2']];
  const mpSync = () => {
    $('mpName').value = SETTINGS.mpName || '';
    for (const [id, key, def] of mpSegs) for (const b of $(id).querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === (SETTINGS[key] || def));
    const join = (SETTINGS.mpMode || 'create') === 'join';
    $('rowMpCode').classList.toggle('hidden', !join); $('rowMpMax').classList.toggle('hidden', join);
    $('btnMpGo').textContent = join ? '방 참가' : '방 만들기'; $('mpMsg').textContent = '';
  };
  for (const [id, key] of mpSegs) $(id).onclick = (e) => { const v = e.target.dataset && e.target.dataset.v; if (!v) return; SETTINGS[key] = v; saveSettings(); mpSync(); };
  $('mpName').oninput = (e) => { SETTINGS.mpName = e.target.value; saveSettings(); };
  $('btnMpGo').onclick = async () => {
    const name = (SETTINGS.mpName || '').trim(), join = (SETTINGS.mpMode || 'create') === 'join';
    if (!name) { $('mpMsg').textContent = '닉네임을 먼저 입력해 주세요.'; $('mpName').focus(); return; }
    const code = $('mpCode').value.trim();
    if (join && code.length < 6) { $('mpMsg').textContent = '6자리 방 코드를 입력해 주세요.'; $('mpCode').focus(); return; }
    $('btnMpGo').disabled = true; $('mpMsg').textContent = join ? '방에 접속하는 중…' : '방을 만드는 중…';
    try { if (join) await netJoin(code, name); else await netHost(name, +(SETTINGS.mpMax || 2)); $('mpMsg').textContent = ''; }
    catch (e) { netCleanup(); $('mpMsg').textContent = (e && e.message) || '연결에 실패했어요.'; }
    $('btnMpGo').disabled = false;
  };
  $('btnLobbyStart').onclick = () => hostStartMatch();
  $('btnLobbyLeave').onclick = () => { netLeave(); show('mpSet', true); };
  $('btnCopyCode').onclick = () => { try { navigator.clipboard.writeText(NET.code); $('btnCopyCode').textContent = '복사됨!'; setTimeout(() => $('btnCopyCode').textContent = '복사', 1200); } catch (e) {} };
  $('btnMpBack').onclick = () => show('mpSet', false);
  $('btnModeBack').onclick = () => show('modeSel', false);
  $('btnRetry').onclick = () => startGame();
  let settingsFrom = 'title';
  $('btnSettings').onclick = () => { settingsFrom = 'title'; syncSettingsUI(); show('settings', true); };
  $('btnPauseSettings').onclick = () => { settingsFrom = 'pause'; syncSettingsUI(); show('pause', false); show('settings', true); };
  $('btnSettingsClose').onclick = () => { show('settings', false); if (settingsFrom === 'pause') show('pause', true); saveSettings(); };
  for (const [seg, key] of [['segQuality', 'quality'], ['segTod', 'tod']]) {
    $(seg).onclick = (e) => {
      const v = e.target.dataset && e.target.dataset.v; if (!v) return;
      SETTINGS[key] = v; syncSettingsUI(); saveSettings();
      if (key === 'quality') applyQuality(); else applyTOD(v);
    };
  }
  $('rngSens').oninput = (e) => { SETTINGS.sens = +e.target.value; saveSettings(); };
  $('rngFov').oninput = (e) => { SETTINGS.fov = +e.target.value; saveSettings(); };
  $('rngVol').oninput = (e) => { SETTINGS.volume = +e.target.value; AUDIO.setVolume(SETTINGS.volume); saveSettings(); };
  $('btnResume').onclick = () => resumeGame();
  $('btnQuit').onclick = () => toTitle();
  $('btnOverTitle').onclick = () => toTitle();
  $('pause').addEventListener('click', (e) => { if (e.target.id === 'pause') resumeGame(); });
  document.addEventListener('pointerlockchange', () => {
    if (!locked() && G.state === 'play' && P.alive) pauseGame();
    if (locked() && G.state === 'paused') { G.state = 'play'; show('pause', false); }
  });
}
function clearWorld() {
  for (const e of ENEMIES) { scene.remove(e.model.g); disposeEnemy(e); }
  ENEMIES.length = 0;
  for (const b of BOLTS) b.s.visible = false; BOLTS.length = 0;
  for (const p of PICKUPS) scene.remove(p.g); PICKUPS.length = 0;
  for (const g of GRENADES) scene.remove(g.m); GRENADES.length = 0;
  for (const b of BOSS_FX) { scene.remove(b.ring); scene.remove(b.beam); } BOSS_FX.length = 0;
  G.boss = null; AUDIO.bossHum(false);
  if (DRIVE.car) { DRIVE.parked.push(DRIVE.car); DRIVE.car = null; }
}
async function startGame() {
  AUDIO.init();
  requestLock();
  fadeTo(1);
  await sleep(450);
  clearWorld();
  Object.assign(G, { wave: 0, score: 0, kills: 0, headshots: 0, shots: 0, hits: 0, waveState: 'break', waveTimer: 7, toSpawn: 0, multi: 0, lastKillT: -9 });
  resetSkills();
  Object.assign(P, { hp: 100, maxHp: 100, alive: true, yaw: 0, pitch: 0.02, weapon: 1, switchT: 0, switchTo: -1, grenades: 3, lastHurt: -99, kick: 0, ads: 0, land: 0, shake: 0 });
  P.pos.set(800 + (NET.on ? ([0, -3, 3, -6][NET.slot] || 0) : 0), 0, 340); P.vel.set(0, 0, 0); P.eyeY = 1.65;
  document.body.classList.remove('spectating'); NET.ps = NET.sn = NET.st = 0;
  WST.forEach((s, i) => { s.ammo = WEAPONS[i].mag; s.reload = 0; s.cool = 0; s.pumpT = 0; });
  showWeapon(1);
  lastLoc = locationOf(800, 340).n; locCand = lastLoc;
  show('skillPick', false); show('title', false); show('modeSel', false); show('mpSet', false); show('over', false); show('pause', false); show('settings', false); show('hud', true); closeMap();
  $('bossbar').classList.add('hidden');
  G.state = 'play';
  computeFlow(P.pos.x, P.pos.z);
  updatePlayer(0.016);
  updateShadowCam(P.pos.x, P.pos.z); renderFrame(); renderFrame(); await nextFrame();
  lastT = performance.now();
  fadeTo(0);
  openSkillPick(true);
  setTimeout(() => HUD.banner('광화문 광장', '외계 함대가 접근 중이다 — 7초 후 첫 공격', 4.5), 600);
}
function pauseGame() {
  if (G.state !== 'play') return;
  G.state = 'paused'; mouseDown = rmb = false; closeMap();
  $('pauseMsg').textContent = '계속하기를 누르면 다시 시작합니다.';
  show('pause', true);
  if (document.pointerLockElement) document.exitPointerLock();
}
function resumeGame() {
  if (G.state !== 'paused') return;
  if (DEBUG) { G.state = 'play'; show('pause', false); return; }
  try {
    const p = renderer.domElement.requestPointerLock();
    if (p && p.catch) p.catch(() => { $('pauseMsg').textContent = '잠시 후 다시 클릭해 주세요.'; });
  } catch (e) {}
}
function onPlayerDeath() {
  engine(false);
  if (DRIVE.car) { DRIVE.parked.push(DRIVE.car); DRIVE.car = null; }
  mouseDown = rmb = false; closeMap();
  if (NET.on) { netLocalDeath(); return; }
  setTimeout(showGameOver, 2600);
}
function showGameOver() {
  show('skillPick', false); show('pause', false); show('bigmap', false); closeMap();
  $('btnRetry').classList.toggle('hidden', NET.on);
    G.state = 'over';
    if (document.pointerLockElement) document.exitPointerLock();
    const best = G.score > BEST; if (best) { BEST = G.score; try { localStorage.setItem('sd3d.best', BEST); } catch (e) {} }
    const loc = locationOf(P.pos.x, P.pos.z).n;
    $('overMsg').textContent = `${loc}에서 쓰러졌다… ${best ? '★ 최고 기록 갱신!' : `최고 기록 ${BEST.toLocaleString()}점`}`;
    $('stScore').textContent = G.score.toLocaleString(); $('stWave').textContent = G.wave; $('stKills').textContent = G.kills;
    $('stAcc').textContent = `${G.shots ? Math.round(G.hits / G.shots * 100) : 0}% · ${G.headshots}`;
    show('over', true); show('hud', false);
    AUDIO.bossHum(false);
}
function toTitle() {
  if (NET.on) netLeave();
  fadeTo(1);
  setTimeout(() => {
    clearWorld(); G.state = 'title';
    show('pause', false); show('over', false); show('hud', false); show('title', true);
    VMS.forEach(v => v.g.visible = false);
    $('bestTxt').textContent = BEST ? `최고 기록 ${BEST.toLocaleString()}점` : '';
    fadeTo(0);
  }, 500);
}

// 타이틀 화면: 노을 진 서울 위를 천천히 도는 시네마틱 카메라
function titleCamera(t) {
  const a = t * 0.035 + 2.2;
  camera.position.set(1150 + Math.cos(a) * 520, 120 + Math.sin(t * 0.05) * 25, 700 + Math.sin(a) * 430);
  camera.fov = 55; camera.updateProjectionMatrix();
  camera.lookAt(1120, 50, 640);
  camera.updateMatrixWorld();
}

let lastT = performance.now(), fpsAcc = 0, fpsN = 0, shadowTick = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { $('fps').textContent = `${Math.round(fpsN / fpsAcc)} fps`; fpsAcc = 0; fpsN = 0; }
  const mpLive = NET.on && (G.state === 'paused' || G.state === 'skill');
  if (!mpLive && (G.state === 'paused' || G.state === 'loading' || G.state === 'skill')) { if (G.state !== 'loading') renderFrame(); return; }
  G.time += dt; U.time.value = G.time;
  updateSignals(tclock()); animateFlags(G.time);
  updateBoats(dt);
  WATER.normal.offset.x += dt * 0.006; WATER.normal.offset.y += dt * 0.003;
  const blink = Math.sin(G.time * 3) > 0.3 ? 1 : 0.15;
  WORLD_FX.aviation.color.setRGB(5 * blink, 0.15 * blink, 0.1 * blink);
  WORLD_FX.towerTop.color.setRGB(6 * blink, 0.3 * blink, 0.2 * blink);
  WORLD_FX.towerRing.color.setHSL((G.time * 0.03) % 1, 0.8, 0.5).multiplyScalar(4 * Math.max(0.3, U.lights.value));
  const T0 = performance.now();
  let T1 = T0, T2 = T0;
  if (G.state === 'play' || G.state === 'over' || mpLive) {
    if (G.state === 'play') { updatePlayer(dt); if (!isClient()) updateWaves(dt); updateSkills(dt); }
    else if (G.state === 'over') updateDeath(dt);
    else if (!isClient()) updateWaves(dt);
    netTick(dt); updateRemotes(dt); updateTeam(dt);
    T1 = performance.now();
    if (isClient()) updateNetEnemies(dt); else updateEnemies(dt);
    updateBolts(dt); updateGrenades(dt); updatePickups(dt); updateBeams(dt);
    T2 = performance.now();
    if (G.state === 'play' || mpLive) updateHUD(dt);
    updateShadowCam(P.pos.x, P.pos.z);
  } else {
    titleCamera(G.time);
    updateShadowCam(1120, 640);
  }
  updateTraffic(dt); updateChunkVis(dt); adaptResolution(dt);
  updateFlashLights(dt); updateTracers(dt);
  FXA.update(dt); FXN.update(dt);
  const T3 = performance.now();
  if ((shadowTick ^= 1)) renderer.shadowMap.needsUpdate = true;
  renderFrame();
  const T4 = performance.now();
  if (DEBUG) { const tot = T4 - T0; if (tot > (PERF.worst.tot || 0)) PERF.worst = { tot: +tot.toFixed(1), player: +(T1 - T0).toFixed(1), enemies: +(T2 - T1).toFixed(1), hudfx: +(T3 - T2).toFixed(1), render: +(T4 - T3).toFixed(1), gap: +(dt * 1000).toFixed(1) }; }
}
const PERF = { worst: {} };

async function init() {
  const steps = [];
  const step = async (msg, p) => { $('loadMsg').textContent = msg; $('loadBar').style.width = (p * 100) + '%'; await nextFrame(); await nextFrame(); };
  await step('글꼴 불러오는 중…', 0.03);
  try { await Promise.race([Promise.all([document.fonts.load(`900 64px "Noto Sans KR"`), document.fonts.load(`64px "Black Han Sans"`)]), sleep(3000)]); } catch (e) {}
  await step('남산과 한강 지형을 만드는 중…', 0.08);
  computeCrossings();
  await step('서울 도심을 짓는 중…', 0.15);
  genCity(); buildYeouido(); buildLotte();
  await step('도로와 한강을 까는 중…', 0.3);
  buildGround(); buildRoads(); buildRiver(); buildBridges(); buildBoats();
  await step('경복궁과 광화문을 세우는 중…', 0.42);
  buildPalace(); buildPlaza(); buildKorea(); buildNamsan(); buildMountains();
  await step('빌딩 불을 켜는 중…', 0.55);
  buildBuildingMeshes();
  await step('가로수와 간판을 다는 중…', 0.65);
  genStreetProps(); buildTrees(); buildLamps(); buildSignals(); buildSigns();
  await step('차량을 도로에 내보내는 중…', 0.75);
  buildTraffic();
  await step('외계인 길찾기 지도를 그리는 중…', 0.82);
  buildWalkGrid(); buildMinimap();
  initFX(); initTracers(); initDecals(); initSprites(); buildViewmodels(); initSkillFX();
  await step('노을을 칠하는 중…', 0.9);
  applyQuality(); applyTOD(SETTINGS.tod);
  bindUI();
  await step('셰이더 준비 중…', 0.95);
  // 처음 등장할 때 끊기지 않도록 미리 컴파일
  // 카메라 바로 앞(그림자 범위 안)에 적·이펙트·무기를 한 번씩 그려서 그림자 셰이더까지 전부 컴파일
  titleCamera(0);
  const wdir = camera.getWorldDirection(new THREE.Vector3());
  const wp = camera.position.clone().addScaledVector(wdir, 25);
  const warm = ['grunt', 'runner', 'drone', 'brute', 'boss'].map((t, i) => {
    const m = buildEnemyModel(t); cloneMats(m.g);
    m.g.position.copy(t === 'boss' ? camera.position.clone().addScaledVector(wdir, 200) : wp.clone().add(new THREE.Vector3((i - 1.5) * 3, 0, 0)));
    scene.add(m.g); return m;
  });
  updateShadowCam(wp.x, wp.z);
  FX.explosion(wp, 1); FX.sparks(wp, 10, null); FX.dust(wp, 5, null); FX.splash(wp); FX.warp(wp);
  spawnTracer(camera.position.clone().addScaledVector(wdir, 2), wp);
  const ws = takeSprite(new THREE.Color(4, 1, 2), 1); ws.position.copy(wp);
  spawnBeam(wp); spawnDecal(wp, new THREE.Vector3(0, 1, 0));
  VMS.forEach(v => { v.g.visible = true; v.flash.visible = true; });
  renderer.compile(scene, camera); renderer.compile(weaponScene, weaponCam);
  renderFrame(); renderFrame();
  warm.forEach(m => { scene.remove(m.g); m.g.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); });
  VMS.forEach(v => { v.g.visible = false; v.flash.visible = false; });
  ws.visible = false; FXA.n = 0; FXN.n = 0; FXA.update(0); FXN.update(0);
  TRACERS.forEach(t => { t.t = 0; t.m.visible = false; }); DECALS.forEach(d => d.visible = false);
  BEAMS.forEach(b => scene.remove(b.m)); BEAMS.length = 0;
  for (const f of FLASH_LIGHTS) { f.t = 0; f.l.intensity = 0; }
  G.state = 'title';
  show('title', true);
  $('bestTxt').textContent = BEST ? `최고 기록 ${BEST.toLocaleString()}점` : '';
  $('loading').style.opacity = 0;
  setTimeout(() => show('loading', false), 900);
  if (DEBUG) show('fps', true);
  lastT = performance.now();
  requestAnimationFrame(loop);
}
init().catch((e) => fatal(e && e.stack || String(e)));

// 테스트용 디버그 훅 (?debug)
window.__SD = {
  G, P, SETTINGS, startGame, spawnEnemy, applyTOD, applyQuality,
  info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, cars: carsTotal, trees: TREES.length, lamps: LAMPS.length, cols: COLS.length, enemies: ENEMIES.length, state: G.state }),
  look: (x, y, z, yaw, pitch) => { P.pos.set(x, y, z); P.yaw = yaw; P.pitch = pitch; P.eyeY = y + 1.65; },
  fire: (on) => { mouseDown = on; fireQueued = on ? 0.2 : 0; },
  aim: (on) => { rmb = on; },
  key: (code, on) => { keys[code] = on; },
  toCar: () => { let b = null, bd = 1e9; for (const ln of LANES) for (const c of ln.cars) { const d = Math.hypot(c.x - 880, c.z - 330); if (d < bd) { bd = d; b = c; } } P.pos.set(b.x + 2, 0, b.z); return [b.x, b.z]; },
  drive: () => !!DRIVE.car,
  carsNear: () => { const o = []; for (const ln of LANES) for (const c of ln.cars) { if (Math.abs(c.x - 800) < 150 && Math.abs(c.z - 340) < 150) o.push(c.uid + ':' + c.x.toFixed(0) + ',' + c.z.toFixed(0)); } return o.sort().join(' '); },
  mpHost: (n, m, c) => netHost(n || 'Host', m || 2, c).then(() => NET.code),
  mpJoin: (c, n) => netJoin(c, n || 'Guest').then(() => 'joined'),
  mpStart: () => { hostStartMatch(); return 'start'; },
  net: () => JSON.stringify({ on: NET.on, role: NET.role, code: NET.code, players: NET.players.map(p => p.name), remotes: [...NET.remotes.values()].map(r => r.name + ':' + r.pos.x.toFixed(0) + ',' + r.pos.z.toFixed(0)), started: NET.started, trErr: NET.trErr, toff: +NET.toff.toFixed(2), state: G.state, enemies: ENEMIES.length, wave: G.wave, ws: G.waveState }),
  pick: (i) => chooseSkill(SKST.cards[i]),
  sk: () => JSON.stringify(P.sk) + ' tier=' + tierOf() + ' state=' + G.state,
  setWave: (n) => { G.wave = n; },
  armedStats: () => { let a = 0, g = 0; for (const e of ENEMIES) if (e.type === 'grunt') { g++; if (e.armed) a++; } return a + '/' + g; },
  trisBy: () => { const out = {}; scene.traverse(o => { if (!o.isMesh && !o.isPoints) return; const g = o.geometry; if (!g) return; const t = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); const key = (o.isInstancedMesh ? 'inst:' : 'mesh:') + (o.material.name || o.material.type) + ':' + Math.round(g.attributes.position.count) ; out[key] = (out[key] || 0) + t; }); return Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + '=' + Math.round(v)).join(' | '); },
  bolts: () => BOLTS.length,
  states: () => ENEMIES.map(e => e.type + ':' + e.state + ':' + Math.round(Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z)) + ':bt' + (e.bt || 0).toFixed(2) + ':b' + e.burst + ':los' + e.los + ':cd' + e.atkCd.toFixed(1)).join(' '),
  dmg: (e, d, part) => damageEnemy(e, d, part, new THREE.Vector3(0, 0, 1), new THREE.Vector3(e.pos.x, e.pos.y + 1, e.pos.z)),
  map: (on, z = 1) => { MAPV.zoom = z; on ? openMap() : closeMap(); },
  enemies: () => ENEMIES.filter(e => e.state !== 'dead' && e.state !== 'spawn').map(e => ({ x: e.pos.x, y: e.pos.y + (e.type === 'boss' ? -4 : e.T.fly ? 0 : e.h * 0.6), z: e.pos.z, type: e.type })),
  perf: () => { const w = PERF.worst; PERF.worst = {}; return w; },
  prof: () => {
    const t = (f, n = 30) => { const a = performance.now(); for (let i = 0; i < n; i++) f(); return +((performance.now() - a) / n).toFixed(2); };
    return { traffic: t(() => updateTraffic(0.016)), signals: t(() => updateSignals(G.time, true), 5), flow: t(() => computeFlow(P.pos.x, P.pos.z), 10),
      hud: t(() => updateHUD(0.016)), fx: t(() => { FXA.update(0.016); FXN.update(0.016); }), render: t(() => renderFrame(), 10), enemies: t(() => updateEnemies(0.016), 10) };
  },
  stats: () => ({ wave: G.wave, ws: G.waveState, kills: G.kills, score: G.score, toSpawn: G.toSpawn, hp: Math.round(P.hp), fps: $('fps').textContent, parts: FXA.n + FXN.n }),
};
