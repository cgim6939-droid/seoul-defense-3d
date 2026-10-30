// ============================================================
//  멀티 플레이 (협동 서바이벌): WebRTC P2P (PeerJS 중계 서버로 연결만 맺고 이후엔 플레이어끼리 직접 통신)
//  - 방장(host)이 적/웨이브를 시뮬레이션하고, 참가자(client)는 상태를 받아 보여준다.
//  - 참가자의 사격은 방장에게 "맞았다"고 알려서 처리한다.
// ============================================================
const NET = {
  on: false, role: null, peer: null, conns: new Map(), hostConn: null, myId: 'H', code: '', max: 4, started: false,
  players: [], remotes: new Map(), eid: 1, pid: 1, ps: 0, sn: 0, st: 0, myName: '', err: '', ready: false, slot: 0,
};
const NET_PREFIX = 'sdef3d-';
const SLOT_COLORS = ['#4da3ff', '#ffb347', '#7dff9a', '#ff7de0'];
let TG = { pos: P.pos, vel: P.vel, remote: null };   // 지금 AI가 노리는 대상
const TYPE_CODE = ['grunt', 'runner', 'drone', 'brute', 'boss'];
const STATE_CODE = ['spawn', 'chase', 'attack', 'shoot', 'arrive', 'fight'];
const isHost = () => NET.on && NET.role === 'host';
const isClient = () => NET.on && NET.role === 'client';

// ---------- 전송 ----------
function netSend(conn, m) { try { if (conn && conn.open) conn.send(m); } catch (e) {} }
function netBcast(m, exceptId) { for (const [id, c] of NET.conns) if (id !== exceptId) netSend(c, m); }
function netToHost(m) { netSend(NET.hostConn, m); }
function netSendTo(id, m) { netSend(NET.conns.get(id), m); }
function loadPeerLib() {
  return new Promise((res, rej) => {
    if (window.Peer) return res();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = () => res(); s.onerror = () => rej(new Error('연결 라이브러리를 불러오지 못했어요. 인터넷을 확인해 주세요.'));
    document.head.appendChild(s);
  });
}
const rndCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[(Math.random() * 32) | 0]).join('');
function netCleanup() {
  for (const r of NET.remotes.values()) { scene.remove(r.g); }
  NET.remotes.clear();
  try { if (NET.peer) NET.peer.destroy(); } catch (e) {}
  Object.assign(NET, { on: false, role: null, peer: null, hostConn: null, started: false, players: [], ready: false, err: '', code: '' });
  NET.conns.clear();
  renderTeam();
}
function netLeave() { netCleanup(); show('mpLobby', false); }

// ---------- 방 만들기 / 참가 ----------
async function netHost(name, max, forced) {
  await loadPeerLib();
  NET.myName = name; NET.max = max; NET.role = 'host'; NET.myId = 'H'; NET.slot = 0;
  for (let tries = 0; tries < 6; tries++) {
    const code = (tries === 0 && forced) ? forced : rndCode();
    try {
      await new Promise((res, rej) => {
        const peer = new Peer(NET_PREFIX + code, { debug: 0 });
        const to = setTimeout(() => { try { peer.destroy(); } catch (e) {} rej(new Error('timeout')); }, 9000);
        peer.on('open', () => { clearTimeout(to); NET.peer = peer; NET.code = code; res(); });
        peer.on('error', (e) => { clearTimeout(to); try { peer.destroy(); } catch (x) {} rej(e); });
      });
      break;
    } catch (e) { if (e && e.type === 'unavailable-id') continue; if (tries >= 5 || !(e && e.message === 'timeout')) throw new Error('연결 서버에 접속하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
  }
  if (!NET.peer) throw new Error('방을 만들지 못했어요.');
  NET.on = true; NET.started = false;
  NET.players = [{ id: 'H', name, slot: 0 }];
  NET.peer.on('connection', hostAccept);
  NET.peer.on('disconnected', () => { try { NET.peer.reconnect(); } catch (e) {} });
  renderLobby();
}
function hostAccept(conn) {
  conn.on('open', () => {
    if (NET.started) { netSend(conn, { t: 'deny', why: '이미 게임이 시작된 방이에요.' }); setTimeout(() => conn.close(), 300); return; }
    if (NET.players.length >= NET.max) { netSend(conn, { t: 'deny', why: '방이 가득 찼어요.' }); setTimeout(() => conn.close(), 300); return; }
    NET.conns.set(conn.peer, conn);
  });
  conn.on('data', (m) => hostOnMsg(conn, m));
  conn.on('close', () => hostDrop(conn.peer));
  conn.on('error', () => hostDrop(conn.peer));
}
function hostDrop(id) {
  if (!NET.conns.has(id) && !NET.players.some(p => p.id === id)) return;
  NET.conns.delete(id);
  const p = NET.players.find(x => x.id === id);
  NET.players = NET.players.filter(x => x.id !== id);
  const r = NET.remotes.get(id); if (r) { scene.remove(r.g); NET.remotes.delete(id); }
  if (p && NET.on) { HUD.toast(`${p.name} 님이 나갔어요`, '#ff9a8a'); }
  if (!NET.started) broadcastLobby(); else { hostCheckOver(); renderTeam(); }
}
function broadcastLobby() { netBcast({ t: 'lobby', players: NET.players, max: NET.max }); renderLobby(); }
function hostOnMsg(conn, m) {
  const id = conn.peer;
  if (m.t === 'hello') {
    if (NET.players.some(p => p.id === id)) return;
    const used = new Set(NET.players.map(p => p.slot)); let slot = 0; while (used.has(slot)) slot++;
    NET.players.push({ id, name: String(m.name || '플레이어').slice(0, 12), slot });
    netSend(conn, { t: 'welcome', id, slot });
    broadcastLobby();
  } else if (m.t === 'ps') {
    let r = NET.remotes.get(id); if (!r) { const p = NET.players.find(x => x.id === id); if (!p) return; r = ensureRemote(id, p.name, p.slot); }
    applyRemoteState(r, m);
  } else if (m.t === 'hit') {
    const e = ENEMIES.find(x => x.id === m.id);
    if (e && e.state !== 'dead') damageEnemy(e, m.dmg, m.part, new THREE.Vector3(m.dx, 0.3, m.dz), new THREE.Vector3(m.x, m.y, m.z));
  } else if (m.t === 'take') {
    const i = PICKUPS.findIndex(p => p.id === m.id);
    if (i >= 0) { const p = PICKUPS[i]; scene.remove(p.g); PICKUPS.splice(i, 1); netBcast({ t: 'pkx', id: m.id }); netSend(conn, { t: 'gain', kind: p.kind }); }
  } else if (m.t === 'dead') {
    const r = NET.remotes.get(id); if (r) { r.alive = false; r.hp = 0; }
    HUD.toast(`${(NET.players.find(p => p.id === id) || {}).name || '동료'} 님이 쓰러졌다`, '#ff8a8a');
    hostCheckOver();
  } else if (m.t === 'fx') {
    netBcast(m, id); handleFx(m);
  }
}
async function netJoin(code, name) {
  await loadPeerLib();
  NET.myName = name; NET.role = 'client'; NET.code = code.toUpperCase();
  await new Promise((res, rej) => {
    const peer = new Peer({ debug: 0 });
    let settled = false;
    const fail = (msg) => { if (settled) return; settled = true; try { peer.destroy(); } catch (e) {} rej(new Error(msg)); };
    const to = setTimeout(() => fail('방을 찾지 못했어요. 코드를 확인해 주세요.'), 14000);
    peer.on('error', (e) => { clearTimeout(to); fail(e && e.type === 'peer-unavailable' ? '그런 방이 없어요. 코드를 다시 확인해 주세요.' : '연결 서버에 접속하지 못했어요.'); });
    peer.on('open', (myid) => {
      NET.myId = myid;
      const conn = peer.connect(NET_PREFIX + NET.code, { reliable: true });
      conn.on('open', () => {
        clearTimeout(to); if (settled) return; settled = true;
        NET.peer = peer; NET.hostConn = conn; NET.on = true;
        netSend(conn, { t: 'hello', name });
        res();
      });
      conn.on('data', clientOnMsg);
      conn.on('close', () => { if (NET.on && NET.role === 'client') clientLost('방장과의 연결이 끊어졌어요.'); });
      conn.on('error', () => {});
    });
  });
  renderLobby();
}
function clientLost(msg) {
  const was = G.state;
  netCleanup(); show('mpLobby', false);
  if (was !== 'title') { toTitle(); }
  setTimeout(() => alert(msg), 600);
}

// ---------- 로비 UI ----------
function renderLobby() {
  show('mpLobby', true); show('mpSet', false); show('modeSel', false);
  $('lobbyCode').textContent = NET.code || '------';
  const rows = [];
  for (let i = 0; i < NET.max; i++) {
    const p = NET.players[i];
    rows.push(p ? `<div class="lp" style="border-color:${SLOT_COLORS[p.slot % 4]}"><i style="background:${SLOT_COLORS[p.slot % 4]}"></i><b>${escapeHtml(p.name)}</b>${p.id === 'H' ? '<em>방장</em>' : ''}${p.id === NET.myId ? '<em class="me">나</em>' : ''}</div>` : '<div class="lp empty">대기 중…</div>');
  }
  $('lobbyList').innerHTML = rows.join('');
  const host = isHost();
  $('btnLobbyStart').classList.toggle('hidden', !host);
  $('lobbyMsg').textContent = host ? (NET.players.length < 2 ? '친구에게 방 코드를 알려주세요. (혼자서도 시작할 수 있어요)' : '모두 모이면 시작하세요!') : '방장이 시작하기를 기다리는 중…';
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- 게임 시작 / 클라이언트 메시지 ----------
function hostStartMatch() {
  if (!isHost() || NET.started) return;
  NET.started = true;
  const slots = {}; NET.players.forEach(p => slots[p.id] = p.slot);
  netBcast({ t: 'start', slots, players: NET.players });
  NET.slot = 0;
  show('mpLobby', false);
  startGame();
}
function clientOnMsg(m) {
  switch (m.t) {
    case 'deny': NET.err = m.why; $('mpMsg').textContent = m.why; netCleanup(); show('mpLobby', false); show('mpSet', true); break;
    case 'welcome': NET.myId = m.id; NET.slot = m.slot; break;
    case 'lobby': NET.players = m.players; NET.max = m.max; if (!NET.started) renderLobby(); break;
    case 'start': NET.started = true; NET.players = m.players; NET.slot = m.slots[NET.myId] || 0; show('mpLobby', false); startGame(); break;
    case 'st': G.wave = m.wave; G.waveState = m.ws; G.waveTimer = m.wt; G.toSpawn = m.ts; G.score = m.score; G.kills = m.kills; break;
    case 'es': netEnemySpawn(m); break;
    case 'en': netEnemySnapshot(m.e); break;
    case 'ek': netEnemyKill(m); break;
    case 'bo': netBolt(m); break;
    case 'bb': bossBeam(m.x, m.z, { pos: { y: 55 } }); break;
    case 'pk': dropPickup(m.x, m.z, m.kind, m.id); break;
    case 'pkx': { const i = PICKUPS.findIndex(p => p.id === m.id); if (i >= 0) { scene.remove(PICKUPS[i].g); PICKUPS.splice(i, 1); } break; }
    case 'gain': if (m.kind === 'health') { P.hp = Math.min(P.maxHp, P.hp + 40); HUD.toast('+40 체력', '#7dff9a'); } else { P.grenades = Math.min(5, P.grenades + 2); HUD.toast('수류탄 +2', '#ffd27a'); } AUDIO.pickup(); break;
    case 'hurt': { if (G.state === 'play' || G.state === 'paused' || G.state === 'skill') { damagePlayer(m.dmg, _e1.set(m.x, 0, m.z)); if (m.kx) { P.vel.x += m.kx; P.vel.z += m.kz; P.vel.y = 4; P.onGround = false; } } break; }
    case 'pl': applyPlayersList(m.p); break;
    case 'bn': HUD.banner(m.big, m.sub, m.dur); break;
    case 'clear': netOnClear(m); break;
    case 'revive': revivePlayer(); break;
    case 'over': netGameOver(m); break;
    case 'fx': handleFx(m); break;
  }
}

// ---------- 다른 플레이어(아바타) ----------
function makeSoldier(color) {
  const g = new THREE.Group(), c = new THREE.Color(color);
  const camo = new THREE.MeshStandardMaterial({ color: 0x55603f, roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.6, metalness: 0.5 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc99a7a, roughness: 0.8 }), band = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.2) });
  const body = new THREE.Group(); g.add(body);
  const mk = (geo, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  mk(new THREE.CapsuleGeometry(0.2, 0.5, 4, 10), camo, 0, 1.2, 0).scale.set(1.15, 1, 0.8);
  mk(new THREE.BoxGeometry(0.46, 0.34, 0.2), dark, 0, 1.28, 0.12);
  mk(new THREE.SphereGeometry(0.17, 14, 10), skin, 0, 1.78, 0);
  mk(new THREE.SphereGeometry(0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), camo, 0, 1.82, 0);
  mk(new THREE.BoxGeometry(0.44, 0.05, 0.05), band, 0, 1.6, 0.02);   // 팀 색 띠
  const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-0.13, 0.85, 0); legR.position.set(0.13, 0.85, 0); body.add(legL, legR);
  for (const l of [legL, legR]) { mk(new THREE.CapsuleGeometry(0.09, 0.62, 4, 8), camo, 0, -0.4, 0, l); mk(new THREE.BoxGeometry(0.16, 0.09, 0.3), dark, 0, -0.78, 0.06, l); }
  const aim = new THREE.Group(); aim.position.set(0, 1.45, 0); body.add(aim);    // 상체 + 총 (조준 각도에 따라 기울인다)
  mk(new THREE.CapsuleGeometry(0.075, 0.4, 4, 8), camo, -0.27, -0.05, 0.12, aim).rotation.x = -1.3;
  mk(new THREE.CapsuleGeometry(0.075, 0.4, 4, 8), camo, 0.27, -0.05, 0.12, aim).rotation.x = -1.3;
  mk(new THREE.BoxGeometry(0.07, 0.1, 0.8), dark, 0.05, -0.05, 0.5, aim);
  mk(new THREE.BoxGeometry(0.09, 0.14, 0.2), camo, 0.05, -0.05, 0.05, aim);
  return { g, body, legL, legR, aim };
}
function nameSprite(name, color) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const x = cv.getContext('2d'); x.font = `900 30px ${FONT_KR}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,0.85)'; x.strokeText(name, 128, 32); x.fillStyle = color; x.fillText(name, 128, 32);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(1.8, 0.45, 1); s.position.y = 2.35; s.renderOrder = 5; return s;
}
function ensureRemote(id, name, slot) {
  let r = NET.remotes.get(id); if (r) return r;
  const col = SLOT_COLORS[slot % 4], m = makeSoldier(col);
  m.g.add(nameSprite(name, col)); scene.add(m.g);
  r = { id, name, slot, g: m.g, body: m.body, legL: m.legL, legR: m.legR, aim: m.aim, pos: new THREE.Vector3(800, 0, 340), vel: new THREE.Vector3(), tpos: new THREE.Vector3(800, 0, 340), yaw: 0, tyaw: 0, pitch: 0, hp: 100, alive: true, drv: false, phase: 0, weapon: 1, last: 0 };
  NET.remotes.set(id, r); renderTeam(); return r;
}
function applyRemoteState(r, m) {
  r.tpos.set(m.x, m.y, m.z); r.tyaw = m.yaw; r.pitch = m.pitch; r.hp = m.hp; r.alive = !!m.al; r.drv = !!m.dr; r.weapon = m.w; r.last = G.time;
  r.maxHp = m.mh || 100;
}
function applyPlayersList(list) {
  for (const a of list) {
    const [id, name, slot, x, y, z, yaw, pitch, w, hp, al, dr, mh] = a;
    if (id === NET.myId) continue;
    const r = ensureRemote(id, name, slot); applyRemoteState(r, { x, y, z, yaw, pitch, w, hp, al, dr, mh });
  }
  // 목록에 없는 아바타 정리
  for (const id of [...NET.remotes.keys()]) if (id !== NET.myId && !list.some(a => a[0] === id)) { const r = NET.remotes.get(id); scene.remove(r.g); NET.remotes.delete(id); renderTeam(); }
}
function updateRemotes(dt) {
  for (const r of NET.remotes.values()) {
    const ox = r.pos.x, oz = r.pos.z;
    r.pos.x = damp(r.pos.x, r.tpos.x, 14, dt); r.pos.y = damp(r.pos.y, r.tpos.y, 14, dt); r.pos.z = damp(r.pos.z, r.tpos.z, 14, dt);
    if (Math.hypot(r.tpos.x - r.pos.x, r.tpos.z - r.pos.z) > 25) r.pos.copy(r.tpos);
    r.vel.x = damp(r.vel.x, (r.pos.x - ox) / Math.max(dt, 1e-3), 8, dt); r.vel.z = damp(r.vel.z, (r.pos.z - oz) / Math.max(dt, 1e-3), 8, dt);
    r.yaw += wrapAngle(r.tyaw - r.yaw) * (1 - Math.exp(-14 * dt));
    r.g.visible = !r.drv;
    r.g.position.copy(r.pos); r.g.rotation.y = r.yaw + Math.PI;
    const sp = Math.hypot(r.vel.x, r.vel.z);
    r.phase += dt * (3 + sp * 1.6);
    const a = Math.min(1, sp / 4), s = Math.sin(r.phase);
    r.legL.rotation.x = -s * 0.7 * a; r.legR.rotation.x = s * 0.7 * a;
    r.aim.rotation.x = -r.pitch * 0.8;
    if (!r.alive) { r.body.rotation.x = damp(r.body.rotation.x, -1.5, 8, dt); r.body.position.y = damp(r.body.position.y, 0.25, 8, dt); }
    else { r.body.rotation.x = damp(r.body.rotation.x, 0, 8, dt); r.body.position.y = damp(r.body.position.y, 0, 8, dt); }
  }
}
// 목록(AI·미니맵용)
function remoteList() { return NET.on ? [...NET.remotes.values()] : []; }
function alivePlayers() {
  const out = [];
  if (P.alive) out.push({ id: NET.myId, pos: P.pos, vel: P.vel, remote: null });
  if (isHost()) for (const r of NET.remotes.values()) if (r.alive) out.push({ id: r.id, pos: r.pos, vel: r.vel, remote: r });
  return out;
}
function pickTarget(e) {
  if (!isHost()) return { pos: P.pos, vel: P.vel, remote: null };
  let best = null, bd = 1e9;
  for (const p of alivePlayers()) { const d = (p.pos.x - e.pos.x) ** 2 + (p.pos.z - e.pos.z) ** 2; if (d < bd) { bd = d; best = p; } }
  return best || { pos: P.pos, vel: P.vel, remote: null };
}
function spawnCenter() {
  if (!isHost()) return P.pos;
  const a = alivePlayers(); return a.length ? a[(Math.random() * a.length) | 0].pos : P.pos;
}
function flowExtras() { return isHost() ? alivePlayers().filter(p => p.remote).map(p => p.pos) : null; }
function hurtTarget(dmg, from) {
  if (TG.remote) netSendTo(TG.remote.id, { t: 'hurt', dmg, x: from.x, z: from.z });
  else damagePlayer(dmg, from);
}
function knockTarget(kx, kz) {
  if (TG.remote) netSendTo(TG.remote.id, { t: 'hurt', dmg: 0, x: 0, z: 0, kx, kz });
  else { P.vel.x += kx; P.vel.z += kz; P.vel.y = 4; P.onGround = false; }
}

// ---------- 적 복제 ----------
function netOnEnemySpawn(e) {
  if (!isHost()) return;
  netBcast({ t: 'es', id: e.id, type: e.type, armed: e.armed ? 1 : 0 });
}
function makeNetEnemy(id, type, armed) {
  const T = ETYPES[type], model = buildEnemyModel(type), mats = cloneMats(model.g);
  scene.add(model.g);
  const e = { id, net: true, type, T, model, mats, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, tyaw: 0, tpos: new THREE.Vector3(), hp: T.hp, maxHp: T.hp, r: T.r, h: T.h,
    state: 'spawn', nst: 'spawn', t: 0, phase: Math.random() * 6, atk: 0, flash: 0, scaleK: 1, deadT: 0, leap: 0, hover: 5, name: T.name, tier: 0, armed: !!armed, stagger: 0, init: false };
  model.g.traverse(o => { if (o.userData.gun) o.visible = !!armed; });
  if (type === 'boss') { G.boss = e; AUDIO.bossHum(true); $('bossbar').classList.remove('hidden'); }
  else { /* 등장 연출은 첫 스냅샷에서 */ }
  ENEMIES.push(e);
  return e;
}
function netEnemySpawn(m) { if (!ENEMIES.some(e => e.id === m.id)) makeNetEnemy(m.id, TYPE_CODE[m.type] || m.type, m.armed); }
function netEnemySnapshot(list) {
  for (const a of list) {
    const [id, ty, x, y, z, yaw, st, hp, mh, fl] = a;
    let e = ENEMIES.find(q => q.id === id);
    if (!e) e = makeNetEnemy(id, TYPE_CODE[ty], fl & 1);
    if (e.state === 'dead') continue;
    e.tpos.set(x, y, z); e.tyaw = yaw; e.nst = STATE_CODE[st] || 'chase'; e.hp = hp; e.maxHp = mh; e.leap = fl & 2 ? 0.3 : 0;
    if (!e.init) { e.init = true; e.pos.copy(e.tpos); e.yaw = yaw; if (e.type !== 'boss') { FX.warp(e.pos, e.type === 'drone' ? [1, 0.4, 0.9] : [0.4, 1, 0.7]); AUDIO.warp(e.pos.x, e.pos.y, e.pos.z); spawnBeam(e.pos); } }
  }
  // 목록에서 사라진(죽었는데 kill 메시지를 놓친) 적 정리
  for (let i = ENEMIES.length - 1; i >= 0; i--) { const e = ENEMIES[i]; if (e.net && e.state !== 'dead' && e.init && !list.some(a => a[0] === e.id)) { scene.remove(e.model.g); disposeEnemy(e); if (G.boss === e) { G.boss = null; AUDIO.bossHum(false); $('bossbar').classList.add('hidden'); } ENEMIES.splice(i, 1); } }
}
function netEnemyKill(m) {
  const e = ENEMIES.find(q => q.id === m.id);
  HUD.kill(m.name, m.pts, m.head, m.multi); G.score = m.score; G.kills = m.kills;
  if (!e || e.state === 'dead') return;
  e.state = 'dead'; e.deadT = 0; e.deadDir = Math.atan2(m.dx, m.dz);
  AUDIO.alien(e.pos.x, e.pos.y + 1, e.pos.z, 'die');
  FX.blood(_e1.set(e.pos.x, e.pos.y + e.h * 0.6, e.pos.z), _e2.set(m.dx, 0, m.dz), 25);
  if (e.type === 'drone') explodeFX(_e1.set(e.pos.x, e.pos.y, e.pos.z), 3);
  if (e.type === 'boss') { G.boss = null; e.crash = 0; AUDIO.bossHum(false); $('bossbar').classList.add('hidden'); }
}
function updateNetEnemies(dt) {
  OBSTACLES.length = 0; OBSTACLES.push({ x: P.pos.x, z: P.pos.z, r: 0.4, player: true });
  let bossDead = false;
  for (let i = ENEMIES.length - 1; i >= 0; i--) {
    const e = ENEMIES[i];
    e.t += dt; e.flash -= dt;
    if (e.state === 'dead') { if (e.type === 'boss') bossDead = true; if (updateDead(e, dt)) { scene.remove(e.model.g); disposeEnemy(e); ENEMIES.splice(i, 1); } continue; }
    if (!e.init) continue;
    const ox = e.pos.x, oz = e.pos.z, k = e.type === 'boss' ? 4 : 14;
    e.pos.x = damp(e.pos.x, e.tpos.x, k, dt); e.pos.y = damp(e.pos.y, e.tpos.y, k, dt); e.pos.z = damp(e.pos.z, e.tpos.z, k, dt);
    e.vel.x = damp(e.vel.x, (e.pos.x - ox) / Math.max(dt, 1e-3), 10, dt); e.vel.z = damp(e.vel.z, (e.pos.z - oz) / Math.max(dt, 1e-3), 10, dt);
    e.yaw += wrapAngle(e.tyaw - e.yaw) * (1 - Math.exp(-12 * dt));
    if (e.nst !== e.state) { e.state = e.nst; e.atk = 0; }
    if (e.state === 'attack') e.atk += dt;
    e.stagger = Math.max(0, e.stagger - dt);
    const m = e.model;
    if (e.type === 'boss') {
      m.lights.rotation.y += dt * 0.8; m.hull.rotation.y += dt * 0.05;
      for (const c of m.cores) c.scale.setScalar(1 + Math.sin(e.t * 5) * 0.12);
      m.hull.material.emissive.setRGB(e.flash > 0 ? 0.5 : 0, e.flash > 0 ? 0.3 : 0, e.flash > 0 ? 0.6 : 0);
      AUDIO.bossHum(true, clamp(1.4 - camera.position.distanceTo(e.pos) / 200, 0.3, 1.2));
    } else if (e.type === 'drone') {
      m.ring.rotation.z += dt * 4; m.g.rotation.z = -e.vel.x * 0.03; m.g.rotation.x = e.vel.z * 0.03;
      if (e.state === 'spawn') m.g.scale.setScalar(smooth(clamp(e.t / 0.7, 0, 1)));
    } else {
      if (e.state === 'spawn') m.g.scale.setScalar((e.type === 'brute' ? 1.6 : 1) * smooth(clamp(e.t / 0.8, 0, 1)));
      animateWalker(e, dt);
      OBSTACLES.push({ x: e.pos.x, z: e.pos.z, r: e.r });
    }
    if (e.type !== 'boss') for (const mt of e.mats) mt.emissive.setRGB(e.flash > 0 ? 1.2 : 0, e.flash > 0 ? 1.2 : 0, e.flash > 0 ? 1.2 : 0);
    m.g.position.copy(e.pos);
    if (e.type !== 'boss') m.g.rotation.y = e.yaw;
  }
  if (!bossDead) updateBossFX(dt);
}
// 적에게 피해 (참가자는 방장에게 보고하고 연출만 한다)
function dmgEnemy(e, dmg, part, dir, point) {
  if (!isClient()) return damageEnemy(e, dmg, part, dir, point);
  if (e.state === 'dead') return false;
  netToHost({ t: 'hit', id: e.id, dmg, part, dx: dir.x, dz: dir.z, x: point.x, y: point.y, z: point.z });
  e.flash = 0.07;
  FX.blood(point, dir, part === 'head' ? 10 : 5, e.type === 'drone' || e.type === 'boss' ? [1.4, 1.0, 0.5] : [0.4, 1.0, 0.3]);
  if (e.type === 'drone' || e.type === 'boss') FX.sparks(point, 5, null);
  if (Math.random() < 0.3) AUDIO.alien(e.pos.x, e.pos.y + 1, e.pos.z, 'hurt');
  return false;
}
function netOnKill(e, part, dir, pts, head) {
  if (!isHost()) return;
  netBcast({ t: 'ek', id: e.id, part, dx: dir ? dir.x : 0, dz: dir ? dir.z : 0, name: e.name, pts, head, multi: G.multi, score: G.score, kills: G.kills });
}
function netBolt(m) {
  const col = new THREE.Color(m.c[0], m.c[1], m.c[2]), s = takeSprite(col, m.size * 2.5);
  const pos = new THREE.Vector3(m.x, m.y, m.z); s.position.copy(pos);
  BOLTS.push({ pos, vel: new THREE.Vector3(m.vx, m.vy, m.vz), dmg: m.dmg, r: m.size, s, life: 5, col, grav: m.grav });
  AUDIO.zap(m.x, m.y, m.z);
}
function netOnBolt(b) {
  if (isHost()) netBcast({ t: 'bo', x: b.pos.x, y: b.pos.y, z: b.pos.z, vx: b.vel.x, vy: b.vel.y, vz: b.vel.z, size: b.r, dmg: b.dmg, grav: b.grav, c: [b.col.r, b.col.g, b.col.b] });
}

// ---------- 다른 플레이어의 사격/폭발 연출 ----------
function netShotFx(from, to, weapon) { if (NET.on) { const m = { t: 'fx', k: 's', id: NET.myId, w: weapon, a: [from.x, from.y, from.z], b: [to.x, to.y, to.z] }; if (isHost()) netBcast(m); else netToHost(m); } }
function netExplosionFx(p, radius) { if (NET.on) { const m = { t: 'fx', k: 'e', id: NET.myId, a: [p.x, p.y, p.z], r: radius }; if (isHost()) netBcast(m); else netToHost(m); } }
function handleFx(m) {
  if (m.id === NET.myId) return;
  if (m.k === 's') { spawnTracer(_e1.set(...m.a), _e2.set(...m.b)); AUDIO.at(m.a[0], m.a[1], m.a[2], 0.8, 0.4, 14); FXA.spawn(m.a[0], m.a[1], m.a[2], 0, 0, 0, 2.2, 1.5, 0.7, 0.1, 0.04, 0, 0); }
  else if (m.k === 'e') { explodeFX(_e1.set(...m.a), m.r); }
}

// ---------- 방장 → 모두: 상태 동기화 ----------
function netTick(dt) {
  if (!NET.on || !NET.started) return;
  NET.ps -= dt;
  if (NET.ps <= 0) {
    NET.ps = 1 / 15;
    const me = [NET.myId, NET.myName, NET.slot, +P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2), +P.yaw.toFixed(3), +P.pitch.toFixed(3), P.weapon, Math.round(P.hp), P.alive ? 1 : 0, DRIVE.car ? 1 : 0, P.maxHp];
    if (isHost()) {
      const list = [me];
      for (const r of NET.remotes.values()) list.push([r.id, r.name, r.slot, +r.tpos.x.toFixed(2), +r.tpos.y.toFixed(2), +r.tpos.z.toFixed(2), +r.tyaw.toFixed(3), +r.pitch.toFixed(3), r.weapon, Math.round(r.hp), r.alive ? 1 : 0, r.drv ? 1 : 0, r.maxHp || 100]);
      netBcast({ t: 'pl', p: list });
    } else netToHost({ t: 'ps', x: me[3], y: me[4], z: me[5], yaw: me[6], pitch: me[7], w: me[8], hp: me[9], al: me[10], dr: me[11], mh: me[12] });
  }
  if (!isHost()) return;
  NET.sn -= dt;
  if (NET.sn <= 0) {
    NET.sn = 1 / 12;
    const list = [];
    for (const e of ENEMIES) {
      if (e.state === 'dead') continue;
      list.push([e.id, TYPE_CODE.indexOf(e.type), +e.pos.x.toFixed(2), +e.pos.y.toFixed(2), +e.pos.z.toFixed(2), +e.yaw.toFixed(2), Math.max(0, STATE_CODE.indexOf(e.state)), Math.round(e.hp), Math.round(e.maxHp), (e.armed ? 1 : 0) | (e.leap > 0 ? 2 : 0)]);
    }
    netBcast({ t: 'en', e: list });
  }
  NET.st -= dt;
  if (NET.st <= 0) { NET.st = 0.25; netBcast({ t: 'st', wave: G.wave, ws: G.waveState, wt: +G.waveTimer.toFixed(1), ts: G.toSpawn, score: G.score, kills: G.kills }); }
}
function netOnWaveClear() {
  if (!isHost()) return;
  netBcast({ t: 'clear', score: G.score });
  // 쓰러진 동료 부활
  for (const r of NET.remotes.values()) if (!r.alive) netSendTo(r.id, { t: 'revive' });
  if (!P.alive) revivePlayer();
}
function netOnClear(m) {
  G.waveState = 'break'; G.score = m.score; P.grenades = Math.min(5, P.grenades + 1);
  AUDIO.chime(); $('bossbar').classList.add('hidden');
  if (P.alive) openSkillPick(false);
}
function revivePlayer() {
  if (P.alive) return;
  P.alive = true; P.hp = Math.max(60, P.maxHp * 0.6); P.deathT = 0; P.lastHurt = G.time; P.pitch = 0.02;
  const mates = isHost() ? [...NET.remotes.values()].filter(r => r.alive) : [...NET.remotes.values()].filter(r => r.alive);
  const base = mates.length ? mates[0].pos : { x: 800, z: 340 };
  P.pos.set(base.x + 2, groundH(base.x + 2, base.z), base.z + 2); P.vel.set(0, 0, 0);
  showWeapon(P.weapon); HUD.toast('다시 일어났다!', '#7dff9a'); AUDIO.chime();
  document.body.classList.remove('spectating');
}
// ---------- 사망 / 게임 오버 ----------
function netLocalDeath() {
  document.body.classList.add('spectating');
  HUD.banner('쓰러졌다…', '다음 웨이브를 클리어하면 부활해요', 4);
  if (isHost()) { hostCheckOver(); } else netToHost({ t: 'dead' });
}
function hostCheckOver() {
  if (!isHost() || !NET.started || G.state === 'over') return;
  const anyAlive = P.alive || [...NET.remotes.values()].some(r => r.alive);
  if (anyAlive) return;
  const m = { t: 'over', score: G.score, wave: G.wave, kills: G.kills, hs: G.headshots };
  netBcast(m); setTimeout(() => showGameOver(), 1800);
}
function netGameOver(m) {
  G.score = m.score; G.wave = m.wave; G.kills = m.kills; G.headshots = m.hs;
  setTimeout(() => showGameOver(), 1800);
}
// ---------- 팀 패널 ----------
function renderTeam() {
  const box = $('team'); if (!box) return;
  if (!NET.on || !NET.started) { box.innerHTML = ''; return; }
  box.innerHTML = [...NET.remotes.values()].map(r => `<div class="tm" style="border-left-color:${SLOT_COLORS[r.slot % 4]}"><span>${escapeHtml(r.name)}${r.alive ? '' : ' · 쓰러짐'}</span><div class="tb"><i style="width:${r.alive ? Math.max(0, Math.min(100, r.hp / (r.maxHp || 100) * 100)) : 0}%;background:${SLOT_COLORS[r.slot % 4]}"></i></div></div>`).join('');
}
let teamT = 0;
function updateTeam(dt) { teamT -= dt; if (teamT <= 0) { teamT = 0.4; renderTeam(); } }
// HUD 배너는 방장 것만 모두에게 전달
(function hookHud() {
  const hb = HUD.banner;
  HUD.banner = function (big, sub, dur) { hb.call(HUD, big, sub, dur); if (isHost() && NET.started) netBcast({ t: 'bn', big, sub, dur }); };
})();
