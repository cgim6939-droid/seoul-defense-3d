// ============================================================
//  교통: 차선별 차량 흐름 + 신호 대기 + 앞차 간격 + 사람 앞에서 정지
// ============================================================
const LANES = [];
const CAR_BY_UID = [];
const CAR_TYPES = {
  sedan: { len: 4.6, wid: 1.85, hgt: 1.5 },
  bus: { len: 11, wid: 2.5, hgt: 3.2 },
};
const CAR_COLORS = ['#f2f2f0', '#f2f2f0', '#e8e8e6', '#1c1c1e', '#1c1c1e', '#8e9399', '#6b7076', '#b9bec4', '#22324f', '#7a1f22', '#3a4a3a'];
const BUS_COLORS = ['#1e5bb8', '#1e5bb8', '#3aa14b', '#3aa14b', '#d6332a', '#e8b11a'];
const carMeshes = {};
let carsTotal = 0;
const OBSTACLES = []; // 이번 프레임의 보행 주체 (플레이어, 적)

function carGeometry(kind, simple = false) {
  const W = [1, 1, 1], GL = [0.03, 0.05, 0.08], DK = [0.05, 0.05, 0.055], TY = [0.02, 0.02, 0.02], CH = [0.6, 0.62, 0.65], RM = [0.75, 0.77, 0.8];
  const body = [], lights = [];
  const put = (arr, geo, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') g.deleteAttribute(k);
    arr.push(g);
  };
  const rb = (w, h, d, r = 0.06) => new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2.1, h / 2.1, d / 2.1));
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const wheel = (x, y, z, R_, wd) => {
    put(body, new THREE.CylinderGeometry(R_, R_, wd, 12).rotateX(Math.PI / 2), TY, x, y, z);
    put(body, new THREE.CylinderGeometry(R_ * 0.62, R_ * 0.62, wd + 0.03, 10).rotateX(Math.PI / 2), RM, x, y, z);
    put(body, new THREE.CylinderGeometry(R_ * 0.18, R_ * 0.18, wd + 0.05, 6).rotateX(Math.PI / 2), DK, x, y, z);
  };
  const HL = [1, 0.95, 0.85], RED = [1, 0.04, 0.02];
  if (simple) {   // 멀리 있는 차용: 상자 몇 개
    if (kind === 'sedan') {
      put(body, box(4.5, 0.62, 1.84), W, 0, 0.62, 0); put(body, box(2.4, 0.6, 1.66), GL, -0.25, 1.35, 0); put(body, box(2.1, 0.07, 1.6), W, -0.25, 1.69, 0);
      put(body, box(4.2, 0.3, 1.7), DK, 0, 0.3, 0);
      for (const s of [-1, 1]) put(lights, box(0.08, 0.14, 0.45), HL, 2.27, 0.84, s * 0.66), put(lights, box(0.08, 0.14, 0.5), RED, -2.27, 0.86, s * 0.62);
    } else {
      put(body, box(11, 2.3, 2.5), W, 0, 1.6, 0); put(body, box(10.4, 0.95, 2.54), GL, -0.2, 2.15, 0); put(body, box(10.6, 0.5, 2.3), DK, 0, 0.5, 0);
      for (const s of [-1, 1]) put(lights, box(0.08, 0.2, 0.5), HL, 5.52, 0.9, s * 0.85), put(lights, box(0.08, 0.3, 0.3), RED, -5.52, 1.0, s * 0.9);
      put(lights, box(0.05, 0.35, 1.8), [1.0, 0.6, 0.1], 5.54, 3.0, 0);
    }
    return { body: mergeGeometries(body), lights: mergeGeometries(lights) };
  }
  if (kind === 'sedan') {
    put(body, rb(4.5, 0.55, 1.84, 0.12), W, 0, 0.66, 0);
    put(body, rb(1.7, 0.16, 1.74, 0.06), W, 1.45, 1.0, 0, 0, 0, -0.06);
    put(body, rb(1.1, 0.14, 1.74, 0.06), W, -1.75, 1.02, 0, 0, 0, 0.03);
    put(body, rb(2.4, 0.58, 1.66, 0.18), GL, -0.25, 1.38, 0);
    put(body, rb(2.1, 0.07, 1.6, 0.03), W, -0.25, 1.7, 0);
    for (const s of [-1, 1]) {
      put(body, rb(0.1, 0.62, 0.07, 0.02), W, 0.93, 1.38, s * 0.8, 0, 0, 0.45);
      put(body, rb(0.1, 0.58, 0.07, 0.02), W, -0.2, 1.38, s * 0.82);
      put(body, rb(0.1, 0.62, 0.07, 0.02), W, -1.43, 1.38, s * 0.8, 0, 0, -0.5);
      put(body, rb(0.2, 0.1, 0.12, 0.03), W, 0.78, 1.12, s * 1.0);
      put(body, box(0.025, 0.5, 0.01), DK, 0.7, 0.72, s * 0.925); put(body, box(0.025, 0.5, 0.01), DK, -0.75, 0.72, s * 0.925);
      put(body, box(0.18, 0.025, 0.012), CH, 0.45, 0.88, s * 0.926); put(body, box(0.18, 0.025, 0.012), CH, -1.05, 0.88, s * 0.926);
    }
    put(body, rb(0.28, 0.34, 1.8, 0.1), DK, 2.2, 0.45, 0); put(body, rb(0.28, 0.34, 1.8, 0.1), DK, -2.2, 0.47, 0);
    put(body, rb(0.06, 0.18, 1.0, 0.02), CH, 2.27, 0.7, 0);
    put(body, rb(3.0, 0.1, 1.9, 0.03), DK, 0, 0.38, 0); put(body, rb(4.2, 0.3, 1.7, 0.05), DK, 0, 0.3, 0);
    for (const x of [1.4, -1.4]) for (const s of [-1, 1]) wheel(x, 0.34, s * 0.86, 0.34, 0.24);
    for (const s of [-1, 1]) {
      put(lights, rb(0.08, 0.14, 0.42, 0.02), HL, 2.27, 0.84, s * 0.66);
      put(lights, rb(0.07, 0.05, 0.3, 0.02), [0.7, 0.9, 1], 2.27, 0.72, s * 0.66);
      put(lights, rb(0.08, 0.14, 0.5, 0.02), RED, -2.27, 0.86, s * 0.62);
    }
    put(lights, box(0.05, 0.05, 0.6), RED, -2.28, 0.92, 0);
  } else {
    put(body, rb(11, 2.3, 2.5, 0.25), W, 0, 1.6, 0);
    put(body, rb(10.4, 0.95, 2.54, 0.1), GL, -0.2, 2.15, 0);
    put(body, rb(0.12, 1.3, 2.2, 0.05), GL, 5.48, 1.95, 0);
    put(body, rb(10.8, 0.12, 2.4, 0.05), W, 0, 2.8, 0);
    put(body, rb(2.6, 0.3, 1.5, 0.1), CH, -1.6, 3.02, 0); put(body, rb(1.4, 0.24, 1.2, 0.08), CH, 2.4, 2.98, 0);
    put(body, rb(10.6, 0.5, 2.3, 0.1), DK, 0, 0.5, 0);
    put(body, rb(0.3, 0.4, 2.45, 0.1), DK, 5.45, 0.55, 0); put(body, rb(0.3, 0.4, 2.45, 0.1), DK, -5.45, 0.55, 0);
    for (const s of [-1, 1]) {
      put(body, box(1.4, 1.7, 0.05), GL, 3.6, 1.5, s * 1.27); put(body, box(0.04, 1.7, 0.06), CH, 3.6, 1.5, s * 1.28);
      put(body, rb(0.3, 0.14, 0.14, 0.04), W, 5.2, 1.7, s * 1.45);
      put(body, box(8.6, 0.05, 0.02), [0.9, 0.6, 0.1], -0.3, 1.2, s * 1.255);
    }
    for (const x of [3.6, -3.2]) for (const s of [-1, 1]) wheel(x, 0.5, s * 1.1, 0.5, 0.36);
    for (const s of [-1, 1]) {
      put(lights, rb(0.08, 0.2, 0.5, 0.02), HL, 5.52, 0.9, s * 0.85);
      put(lights, rb(0.08, 0.3, 0.3, 0.02), RED, -5.52, 1.0, s * 0.9);
    }
    put(lights, box(0.05, 0.35, 1.8), [1.0, 0.6, 0.1], 5.54, 3.0, 0);
  }
  return { body: mergeGeometries(body), lights: mergeGeometries(lights) };
}

function buildTraffic() {
  const mk = (axis, c, dir, s0, s1, speed, cross) => {
    const stops = cross.map(v => v * dir - RH - 4.8).sort((a, b) => a - b).map(s => ({ s, v: dir > 0 ? s + RH + 4.8 : -(s + RH + 4.8) }));
    LANES.push({ axis, c, dir, s0, s1, speed, stops, cars: [], idx: LANES.length });
  };
  VX.forEach((x, i) => {
    for (const off of [1.9, 5.6]) {
      mk('z', x - off, 1, EXT.z0, EXT.z1, 13, HZ);
      mk('z', x + off, -1, -EXT.z1, -EXT.z0, 13, HZ);
    }
  });
  HZ.forEach((z) => {
    const sp = (z === 665 || z === 975) ? 19 : 13;
    for (const off of [1.9, 5.6]) {
      mk('x', z + off, 1, EXT.x0, EXT.x1, sp, VX);
      mk('x', z - off, -1, -EXT.x1, -EXT.x0, sp, VX);
    }
  });
  for (const ln of LANES) {
    for (const st of ln.stops) {
      st.i = ln.axis === 'z' ? nearestIdx(VX, ln.c) : nearestIdx(VX, st.v);
      st.j = ln.axis === 'z' ? nearestIdx(HZ, st.v) : nearestIdx(HZ, ln.c);
    }
    let s = ln.s0 + rr(0, 60);
    while (s < ln.s1 - 20) {
      const kind = chance(0.09) ? 'bus' : 'sedan';
      const taxi = kind === 'sedan' && chance(0.14);
      ln.cars.push({ s, v: ln.speed * 0.8, kind, len: CAR_TYPES[kind].len, pref: rr(0.85, 1.1), col: kind === 'bus' ? pick(BUS_COLORS) : taxi ? '#f08a24' : pick(CAR_COLORS), idx: 0, blocked: 0, honk: 0, x: 0, z: 0 });
      s += rr(117, 267);
    }
  }
  const counts = { sedan: 0, bus: 0 };
  for (const ln of LANES) for (const c of ln.cars) c.idx = counts[c.kind]++;
  { let uid = 0; for (const ln of LANES) for (const c of ln.cars) { c.uid = uid++; c.lane = ln; CAR_BY_UID.push(c); } }
  carsTotal = counts.sedan + counts.bus;
  const c = new THREE.Color();
  const CAPS = { sedan: { near: 220, far: 900 }, bus: { near: 40, far: 160 } };
  const bodyMat = stdMat(0xffffff, 0.32, 0.55, { vertexColors: true });
  const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(3, 3, 3) });
  for (const kind of ['sedan', 'bus']) for (const lod of ['near', 'far']) {
    const g = carGeometry(kind, lod === 'far'), cap = CAPS[kind][lod];
    const body = new THREE.InstancedMesh(g.body, bodyMat, cap), lights = new THREE.InstancedMesh(g.lights, lightMat, cap);
    body.castShadow = lod === 'near'; body.receiveShadow = true;
    body.setColorAt(0, c.set('#ffffff')); body.instanceColor.setUsage(THREE.DynamicDrawUsage);
    body.count = lights.count = 0;
    for (const m of [body, lights]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
    carMeshes[kind + lod] = { body, lights, n: 0, cap };
  }
  for (const ln of LANES) for (const car of ln.cars) { c.set(car.col); car.cr = c.r; car.cg = c.g; car.cb = c.b; }
  WORLD_FX.carLights = [lightMat];
}

function laneCarPos(ln, car) {
  if (ln.axis === 'z') { car.x = ln.c; car.z = car.s * ln.dir; }
  else { car.x = car.s * ln.dir; car.z = ln.c; }
}
function updateTraffic(dt) {
  const t = tclock(), px = P.pos.x, pz = P.pos.z;
  for (const ln of LANES) {
    const cars = ln.cars, n = cars.length;
    for (let k = n - 1; k >= 0; k--) {
      const car = cars[k];
      let vmax = ln.speed * car.pref;
      // 신호
      for (let si = 0; si < ln.stops.length; si++) {
        const st = ln.stops[si], dist = st.s - car.s - car.len / 2;
        if (dist < -0.5) continue;
        if (dist > 70) break;
        const ph = signalPhase(st.i, st.j, ln.axis === 'z' ? 0 : 1, t);
        if (ph === 0 || (ph === 1 && dist > car.v * 1.1)) vmax = Math.min(vmax, Math.sqrt(Math.max(0, 2 * 5 * (dist - 0.3))));
        break;
      }
      // 앞차
      const ahead = k < n - 1 ? cars[k + 1] : null;
      if (ahead) {
        const gap = ahead.s - car.s - (ahead.len + car.len) / 2 - 2.5;
        vmax = Math.min(vmax, Math.sqrt(Math.max(0, 2 * 6 * gap)));
      }
      // 보행자/플레이어/적
      laneCarPos(ln, car);
      car.blocked = Math.max(0, car.blocked - dt);
      if (Math.abs(car.x - px) < 250 && Math.abs(car.z - pz) < 250) {
        for (const ob of OBSTACLES) {
          const lat = ln.axis === 'z' ? ob.x - ln.c : ob.z - ln.c;
          if (Math.abs(lat) > 1.6 + ob.r) continue;
          const along = (ln.axis === 'z' ? ob.z : ob.x) * ln.dir - car.s - car.len / 2;
          if (along < -1 || along > 28) continue;
          vmax = Math.min(vmax, Math.sqrt(Math.max(0, 2 * 8 * (along - 3))));
          if (ob.player && car.v < 0.5) {
            car.blocked += dt * 2;
            if (car.blocked > 2.5 && G.time - car.honk > 6) { car.honk = G.time; AUDIO.horn(car.x, 1, car.z); }
          }
        }
      }
      car.v = car.v < vmax ? Math.min(vmax, car.v + 3.2 * dt) : Math.max(vmax, car.v - 14 * dt);
      if (car.v < 0) car.v = 0;
      car.s += car.v * dt;
    }
    // 끝까지 간 차는 맨 뒤로
    while (cars.length && cars[cars.length - 1].s > ln.s1) {
      const car = cars.pop();
      const tail = cars.length ? cars[0].s : ln.s1;
      car.s = Math.min(ln.s0, tail - 18); car.v = ln.speed * 0.7;
      cars.unshift(car);
    }
  }
  // 카메라 근처의 차만 인스턴스에 채운다 (가까우면 정교한 모델, 멀면 단순 모델, 아주 멀면 안 그림)
  const cx = camera.position.x, cz = camera.position.z, NEAR2 = 120 * 120, FAR2 = 420 * 420;
  for (const k in carMeshes) carMeshes[k].n = 0;
  const putCar = (car, h) => {
    const dx = car.x - cx, dz = car.z - cz, d2 = dx * dx + dz * dz;
    if (d2 > FAR2) return;
    const m = carMeshes[car.kind + (d2 < NEAR2 ? 'near' : 'far')];
    if (m.n >= m.cap) return;
    const a = m.body.instanceMatrix.array, o = m.n * 16, cs = Math.cos(h), sn = Math.sin(h);
    a[o] = cs; a[o + 1] = 0; a[o + 2] = -sn; a[o + 3] = 0; a[o + 4] = 0; a[o + 5] = 1; a[o + 6] = 0; a[o + 7] = 0;
    a[o + 8] = sn; a[o + 9] = 0; a[o + 10] = cs; a[o + 11] = 0; a[o + 12] = car.x; a[o + 13] = 0.05; a[o + 14] = car.z; a[o + 15] = 1;
    const ca = m.body.instanceColor.array; ca[m.n * 3] = car.cr; ca[m.n * 3 + 1] = car.cg; ca[m.n * 3 + 2] = car.cb;
    m.n++;
  };
  for (const ln of LANES) {
    const h = ln.axis === 'x' ? (ln.dir > 0 ? 0 : Math.PI) : (ln.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    for (const car of ln.cars) { laneCarPos(ln, car); putCar(car, h); }
  }
  for (const car of DRIVE.parked) putCar(car, car.h);
  if (DRIVE.car) putCar(DRIVE.car, DRIVE.car.h);
  for (const r of remoteList()) if (r.drv && r.ci) {   // 친구가 운전 중인 차
    const o = r.carObj || (r.carObj = {});
    o.x = r.pos.x; o.z = r.pos.z; o.kind = r.ci[0] ? 'bus' : 'sedan'; o.cr = r.ci[2]; o.cg = r.ci[3]; o.cb = r.ci[4];
    r.ch = r.ch === undefined ? r.ci[1] : r.ch + wrapAngle(r.ci[1] - r.ch) * 0.3;
    putCar(o, r.ch);
  }
  for (const k in carMeshes) {
    const m = carMeshes[k];
    m.body.count = m.lights.count = m.n;
    m.lights.instanceMatrix.array.set(m.body.instanceMatrix.array.subarray(0, m.n * 16));
    m.body.instanceMatrix.needsUpdate = m.lights.instanceMatrix.needsUpdate = m.body.instanceColor.needsUpdate = true;
  }
}
// 플레이어/적과 차량의 충돌 (차를 밀어낼 수는 없다)
function collideCars(p, r) {
  for (const ln of LANES) {
    const lat = ln.axis === 'z' ? p.x - ln.c : p.z - ln.c;
    if (Math.abs(lat) > 3 + r) continue;
    for (const car of ln.cars) {
      const ty = CAR_TYPES[car.kind];
      const hx = ln.axis === 'x' ? car.len / 2 : ty.wid / 2, hz = ln.axis === 'x' ? ty.wid / 2 : car.len / 2;
      const dx = p.x - car.x, dz = p.z - car.z;
      if (Math.abs(dx) > hx + r || Math.abs(dz) > hz + r) continue;
      const cx = clamp(dx, -hx, hx), cz = clamp(dz, -hz, hz);
      const ox = dx - cx, oz = dz - cz, d = Math.hypot(ox, oz);
      if (d > 1e-4 && d < r) { p.x += ox / d * (r - d); p.z += oz / d * (r - d); }
      else if (d <= 1e-4) {
        const px = hx + r - Math.abs(dx), pz = hz + r - Math.abs(dz);
        if (px < pz) p.x += Math.sign(dx || 1) * px; else p.z += Math.sign(dz || 1) * pz;
      }
    }
  }
}
// 총알이 차에 맞는지
function rayCars(o, d, maxT) {
  let best = maxT;
  for (const ln of LANES) for (const car of ln.cars) {
    if (Math.abs(car.x - o.x) > maxT + 6 || Math.abs(car.z - o.z) > maxT + 6) continue;
    const ty = CAR_TYPES[car.kind];
    const hx = ln.axis === 'x' ? car.len / 2 : ty.wid / 2, hz = ln.axis === 'x' ? ty.wid / 2 : car.len / 2;
    const t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, { x0: car.x - hx, x1: car.x + hx, z0: car.z - hz, z1: car.z + hz, y0: 0, y1: ty.hgt }, best);
    if (t >= 0 && t < best) best = t;
  }
  return best;
}
