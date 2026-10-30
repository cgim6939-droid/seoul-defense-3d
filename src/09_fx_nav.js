// ============================================================
//  이펙트 (파티클, 예광탄, 탄흔, 섬광) · 길찾기 (플로우 필드)
// ============================================================
const PARTICLE_SCALE = { value: 400 };
class Particles {
  constructor(max, additive) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.alpha = new Float32Array(max); this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max); this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.grow = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aColor', this.aCol); g.setAttribute('aSize', this.aSize); g.setAttribute('aAlpha', this.aAlpha);
    g.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: PARTICLE_SCALE },
      vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha; uniform float uScale; varying vec3 vC; varying float vA;
        void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(aSize * uScale / -mv.z, 0.0, 300.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
          gl_FragColor = vec4(vC, smoothstep(0.5, ${additive ? '0.0' : '0.25'}, d) * vA);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 3 : 2;
    scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, r, g, b, size, life, grav = 0, drag = 0, grow = 0) {
    let i = this.n;
    if (i >= this.max) i = (Math.random() * this.max) | 0; else this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.size[i] = size; this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav; this.drag[i] = drag; this.grow[i] = grow; this.alpha[i] = 1;
  }
  update(dt) {
    let n = this.n;
    for (let i = 0; i < n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        n--;
        if (i !== n) {
          for (let k = 0; k < 3; k++) { this.pos[i * 3 + k] = this.pos[n * 3 + k]; this.vel[i * 3 + k] = this.vel[n * 3 + k]; this.col[i * 3 + k] = this.col[n * 3 + k]; }
          this.size[i] = this.size[n]; this.life[i] = this.life[n]; this.maxLife[i] = this.maxLife[n]; this.grav[i] = this.grav[n]; this.drag[i] = this.drag[n]; this.grow[i] = this.grow[n];
        }
        i--; continue;
      }
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, t * 2.5);
    }
    this.n = n;
    this.points.geometry.setDrawRange(0, n);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
  }
}
let FXA, FXN;   // 가산(불꽃) / 일반(연기·먼지·피)
function initFX() {
  FXA = new Particles(3000, true);
  FXN = new Particles(2500, false);
}
const FX = {
  sparks(p, n, nrm) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(R(-1, 1), R(-0.2, 1), R(-1, 1)).normalize().multiplyScalar(R(3, 9));
      if (nrm) v.addScaledVector(nrm, 5);
      FXA.spawn(p.x, p.y, p.z, v.x, v.y, v.z, 3, 2.1, 1.0, R(0.04, 0.08), R(0.15, 0.35), 12, 2);
    }
  },
  dust(p, n, nrm, col = [0.55, 0.52, 0.48]) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(R(-1, 1), R(0, 1.2), R(-1, 1)).multiplyScalar(R(0.5, 2));
      if (nrm) v.addScaledVector(nrm, R(1, 3));
      FXN.spawn(p.x, p.y, p.z, v.x, v.y, v.z, col[0], col[1], col[2], R(0.15, 0.35), R(0.5, 1.1), -0.3, 2.5, 0.9);
    }
  },
  blood(p, dir, n, col = [0.35, 1.0, 0.25]) {
    for (let i = 0; i < n; i++) {
      FXN.spawn(p.x, p.y, p.z, dir.x * R(1, 5) + R(-2, 2), R(0, 3), dir.z * R(1, 5) + R(-2, 2), col[0] * 0.5, col[1] * 0.5, col[2] * 0.5, R(0.06, 0.16), R(0.4, 0.8), 9.8, 1);
      FXA.spawn(p.x, p.y, p.z, dir.x * R(0.5, 3) + R(-1, 1), R(-1, 2), dir.z * R(0.5, 3) + R(-1, 1), col[0] * 0.6, col[1] * 0.6, col[2] * 0.6, R(0.05, 0.1), R(0.2, 0.4), 6, 1);
    }
  },
  splash(p) {
    for (let i = 0; i < 14; i++) FXN.spawn(p.x, p.y, p.z, R(-1.5, 1.5), R(3, 7), R(-1.5, 1.5), 0.7, 0.8, 0.85, R(0.08, 0.2), R(0.5, 0.9), 12, 0.5);
  },
  explosion(p, big = 1) {
    for (let i = 0; i < 60 * big; i++) {
      const v = new THREE.Vector3(R(-1, 1), R(-0.3, 1), R(-1, 1)).normalize().multiplyScalar(R(4, 16) * big);
      FXA.spawn(p.x, p.y, p.z, v.x, v.y, v.z, 4, R(1.4, 2.4), 0.5, R(0.3, 0.9) * big, R(0.25, 0.7), 2, 3, 1.5);
    }
    for (let i = 0; i < 30 * big; i++) {
      const v = new THREE.Vector3(R(-1, 1), R(0.2, 1.4), R(-1, 1)).multiplyScalar(R(1, 5) * big);
      const s = R(0.14, 0.25);
      FXN.spawn(p.x, p.y, p.z, v.x, v.y, v.z, s, s, s * 1.05, R(1.0, 2.2) * big, R(1.4, 3.2), -0.6, 1.5, 2.2 * big);
    }
    for (let i = 0; i < 30 * big; i++) {
      const v = new THREE.Vector3(R(-1, 1), R(0.5, 1.5), R(-1, 1)).normalize().multiplyScalar(R(8, 20));
      FXA.spawn(p.x, p.y, p.z, v.x, v.y, v.z, 3, 1.6, 0.6, R(0.05, 0.1), R(0.6, 1.4), 14, 0.5);
    }
    flashLight(p, 60 * big, 0.35, 0xffa050);
  },
  warp(p, col = [0.4, 1.0, 0.7]) {
    for (let i = 0; i < 40; i++) {
      const a = R(0, Math.PI * 2), r = R(0.3, 1.5);
      FXA.spawn(p.x + Math.cos(a) * r, p.y + R(0, 0.3), p.z + Math.sin(a) * r, 0, R(3, 12), 0, col[0] * 2, col[1] * 2, col[2] * 2, R(0.08, 0.2), R(0.4, 1.0), -2, 1);
    }
  },
};

// 섬광용 포인트 라이트 (개수 고정 → 셰이더 재컴파일 없음)
const FLASH_LIGHTS = [];
const fakeLight = () => ({ position: new THREE.Vector3(), color: new THREE.Color(), distance: 0, intensity: 0 });   // 진짜 조명 대신 번쩍이는 입자로 표현 (렉 방지)
for (let i = 0; i < 3; i++) FLASH_LIGHTS.push({ l: fakeLight(), t: 0, dur: 1, peak: 0 });
const muzzleLight = fakeLight();
function flashLight(p, peak, dur, color) {
  const f = FLASH_LIGHTS.reduce((a, b) => (a.t <= b.t ? a : b));
  f.l.position.copy(p); f.l.color.set(color); f.t = dur; f.dur = dur; f.peak = peak; f.l.distance = 18 + peak * 0.5;
  const k = Math.min(1, peak / 80); FXA.spawn(p.x, p.y, p.z, 0, 0, 0, 4 * k, 2.4 * k, 1.1 * k, 2 + peak * 0.06, dur * 0.8, 0, 0);
}
function updateFlashLights(dt) {
  for (const f of FLASH_LIGHTS) { f.t = Math.max(0, f.t - dt); f.l.intensity = f.peak * (f.t / f.dur) ** 2; }
  muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 900);
}

// 예광탄
const TRACERS = [];
const tracerGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, -0.5);
function initTracers() {
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.visible = false; m.frustumCulled = false; scene.add(m); TRACERS.push({ m, t: 0 });
  }
}
function spawnTracer(a, b, col) {
  const tr = TRACERS.find(t => t.t <= 0) || TRACERS[0];
  const len = a.distanceTo(b);
  tr.m.position.copy(a); tr.m.lookAt(b); tr.m.scale.set(0.025, 0.025, len);
  tr.m.material.color.copy(col || new THREE.Color(4, 3, 1.6));
  tr.m.visible = true; tr.t = 0.05; tr.m.material.opacity = 1;
}
function updateTracers(dt) {
  for (const t of TRACERS) if (t.t > 0) { t.t -= dt; t.m.material.opacity = Math.max(0, t.t / 0.05); if (t.t <= 0) t.m.visible = false; }
}
// 탄흔 데칼
const DECALS = [];
let decalI = 0;
function initDecals() {
  const tex = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    gr.addColorStop(0, 'rgba(10,10,10,1)'); gr.addColorStop(0.3, 'rgba(25,22,20,0.9)'); gr.addColorStop(0.6, 'rgba(40,36,32,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }, { aniso: false });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  for (let i = 0; i < 140; i++) { const m = new THREE.Mesh(GEO.plane, mat); m.visible = false; scene.add(m); DECALS.push(m); }
}
const _dn = new THREE.Vector3();
function spawnDecal(p, n, size = 0.22) {
  const m = DECALS[decalI++ % DECALS.length];
  m.position.copy(p).addScaledVector(n, 0.02);
  _dn.copy(m.position).add(n); m.lookAt(_dn);
  m.rotateZ(Math.random() * 6.28);
  m.scale.setScalar(size * R(0.8, 1.3)); m.visible = true;
}
// 발광 스프라이트 풀 (플라즈마 탄 등)
const SPRITES = [];
let glowTexture;
function initSprites() {
  glowTexture = glowTex();
  for (let i = 0; i < 80; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.visible = false; scene.add(s); SPRITES.push(s);
  }
}
function takeSprite(col, size) {
  const s = SPRITES.find(x => !x.visible) || SPRITES[0];
  s.material.color.copy(col); s.scale.setScalar(size); s.visible = true; s.material.opacity = 1;
  return s;
}

// ============================================================
//  보행 격자 + 플로우 필드 (적이 건물을 돌아서 플레이어에게 온다)
// ============================================================
const NG = 2, NGX = Math.ceil((PLAY.x1 + 4) / NG), NGZ = Math.ceil((PLAY.z1 + 4) / NG);
const walkBlocked = new Uint8Array(NGX * NGZ);
// 플로우 필드는 버퍼 두 개로 나눠 여러 프레임에 걸쳐 계산한다 (끊김 방지)
const FF = [0, 1].map(() => ({ dist: new Int32Array(NGX * NGZ), stamp: new Int32Array(NGX * NGZ), gen: 0 }));
const ffQueue = new Int32Array(NGX * NGZ);
let ffCur = 0, ffBuild = null;
function buildWalkGrid() {
  for (let gz = 0; gz < NGZ; gz++) for (let gx = 0; gx < NGX; gx++) {
    const x = gx * NG + 1, z = gz * NG + 1;
    if (x < PLAY.x0 || x > PLAY.x1 || z < PLAY.z0 || z > PLAY.z1 || isWater(x, z)) walkBlocked[gz * NGX + gx] = 1;
  }
  for (const b of COLS) {
    if (b.y0 > 1.5) continue;
    const gx0 = Math.max(0, Math.floor((b.x0 - 0.6) / NG)), gx1 = Math.min(NGX - 1, Math.floor((b.x1 + 0.6) / NG));
    const gz0 = Math.max(0, Math.floor((b.z0 - 0.6) / NG)), gz1 = Math.min(NGZ - 1, Math.floor((b.z1 + 0.6) / NG));
    for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) walkBlocked[gz * NGX + gx] = 1;
  }
}
const cellOf = (x, z) => clamp(Math.floor(z / NG), 0, NGZ - 1) * NGX + clamp(Math.floor(x / NG), 0, NGX - 1);
function startFlow(px, pz, extras) {
  const buf = FF[1 - ffCur]; buf.gen++;
  let start = cellOf(px, pz);
  if (walkBlocked[start]) {
    search: for (let r = 1; r < 6; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const c = cellOf(px + dx * NG, pz + dz * NG); if (!walkBlocked[c]) { start = c; break search; }
    }
  }
  ffQueue[0] = start; buf.stamp[start] = buf.gen; buf.dist[start] = 0;
  let tail = 1;
  if (extras) for (const q of extras) {
    let c = cellOf(q.x, q.z);
    if (walkBlocked[c]) { let ok = false; search2: for (let r = 1; r < 6; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const cc = cellOf(q.x + dx * NG, q.z + dz * NG); if (!walkBlocked[cc]) { c = cc; ok = true; break search2; } } if (!ok) continue; }
    if (buf.stamp[c] === buf.gen) continue;
    ffQueue[tail++] = c; buf.stamp[c] = buf.gen; buf.dist[c] = 0;
  }
  ffBuild = { buf, head: 0, tail };
}
function stepFlow(budget) {
  if (!ffBuild) return;
  const { buf } = ffBuild, dist = buf.dist, stamp = buf.stamp, gen = buf.gen, MAXD = 160;
  let head = ffBuild.head, tail = ffBuild.tail, n = 0;
  while (head < tail && n < budget) {
    const c = ffQueue[head++], d = dist[c]; n++;
    if (d >= MAXD) continue;
    const cx = c % NGX, cz = (c / NGX) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= NGX || nz >= NGZ) continue;
      const nb = nz * NGX + nx;
      if (stamp[nb] === gen || walkBlocked[nb]) continue;
      if (dx && dz && (walkBlocked[cz * NGX + nx] || walkBlocked[nz * NGX + cx])) continue;
      stamp[nb] = gen; dist[nb] = d + 1; ffQueue[tail++] = nb;
    }
  }
  ffBuild.head = head; ffBuild.tail = tail;
  if (head >= tail) { ffCur = 1 - ffCur; ffBuild = null; }
}
function computeFlow(px, pz) { startFlow(px, pz); stepFlow(Infinity); }
function flowDir(x, z, out) {
  const F = FF[ffCur], c = cellOf(x, z);
  if (F.stamp[c] !== F.gen) return false;
  const cx = c % NGX, cz = (c / NGX) | 0;
  let best = F.dist[c], bx = 0, bz = 0;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dz) continue;
    const nx = cx + dx, nz = cz + dz;
    if (nx < 0 || nz < 0 || nx >= NGX || nz >= NGZ) continue;
    const n = nz * NGX + nx;
    if (F.stamp[n] !== F.gen || walkBlocked[n]) continue;
    if (dx && dz && (walkBlocked[cz * NGX + nx] || walkBlocked[nz * NGX + cx])) continue;
    const dd = F.dist[n] + (dx && dz ? 0.4 : 0);
    if (dd < best) { best = dd; bx = dx; bz = dz; }
  }
  if (!bx && !bz) return false;
  const tx = (cx + bx + 0.5) * NG - x, tz = (cz + bz + 0.5) * NG - z, l = Math.hypot(tx, tz) || 1;
  out.x = tx / l; out.z = tz / l;
  return true;
}
function flowDistAt(x, z) { const F = FF[ffCur], c = cellOf(x, z); return F.stamp[c] === F.gen ? F.dist[c] : -1; }
function gridLOS(x0, z0, x1, z1) {
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 1.0);
  for (let i = 1; i < n; i++) { const t = i / n; if (walkBlocked[cellOf(lerp(x0, x1, t), lerp(z0, z1, t))]) return false; }
  return true;
}
