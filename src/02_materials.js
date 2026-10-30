// ============================================================
//  재질 · 텍스처 · 지오메트리 헬퍼
// ============================================================
const FONT_KR = "'Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif";
const FONT_DISPLAY = "'Black Han Sans','Noto Sans KR','Malgun Gothic',sans-serif";

function stdMat(color, rough = 0.85, metal = 0, extra = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra));
}
function canvasTex(w, h, draw, opt = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (opt.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opt.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = opt.aniso === false ? 1 : MAX_ANISO;
  return t;
}
function glowTex(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  return canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, inner); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }, { aniso: false });
}
function f1(v) { return Number(v).toFixed(4); }

// 창문이 절차적으로 그려지는 건물 재질 (월드 좌표 기반, 인스턴싱 지원)
function windowMaterial(p) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: p.rough ?? 0.85, metalness: p.metal ?? 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLights = U.lights;
    const defs = `#define WIN_W ${f1(p.winW)}\n#define FLOOR_H ${f1(p.floorH)}\n#define WX0 ${f1(p.wx0)}\n#define WX1 ${f1(p.wx1)}\n` +
      `#define WY0 ${f1(p.wy0)}\n#define WY1 ${f1(p.wy1)}\n#define LIT_P ${f1(p.lit)}\n#define EMIT ${f1(p.emit)}\n#define STORE ${f1(p.store)}\n` +
      `#define GLASS_COL vec3(${p.glass.map(f1).join(',')})\n#define GLASS_METAL ${f1(p.glassMetal)}\n#define ROOF_DARK ${f1(p.roofDark ?? 0.72)}\n`;
    sh.vertexShader = 'varying vec3 vWP;\nvarying vec3 vWN;\nvarying vec2 vSeed;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec4 bwp = vec4(transformed, 1.0);
        vec3 bn = objectNormal;
        #ifdef USE_INSTANCING
          bwp = instanceMatrix * bwp;
          bn = mat3(instanceMatrix) * bn;
          vSeed = instanceMatrix[3].xz;
        #else
          vSeed = vec2(0.0);
        #endif
        vWP = (modelMatrix * bwp).xyz;
        vWN = normalize(mat3(modelMatrix) * bn);
      }`);
    sh.fragmentShader = defs + 'uniform float uLights;\nvarying vec3 vWP;\nvarying vec3 vWN;\nvarying vec2 vSeed;\nfloat gWin = 0.0;\nvec3 gLit = vec3(0.0);\n' +
      'float bHash(vec2 q){ q = fract(q * vec2(123.34, 456.21)); q += dot(q, q + 45.32); return fract(q.x * q.y); }\n' +
      sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 an = abs(vWN);
          float side = 1.0 - step(0.5, an.y);
          float u = an.x > an.z ? vWP.z : vWP.x;
          vec2 cell = vec2(u / WIN_W, vWP.y / FLOOR_H);
          vec2 id = floor(cell);
          vec2 fr = fract(cell);
          vec2 fw = fwidth(cell);
          float wx = smoothstep(WX0 - fw.x, WX0 + fw.x, fr.x) * (1.0 - smoothstep(WX1 - fw.x, WX1 + fw.x, fr.x));
          float wy = smoothstep(WY0 - fw.y, WY0 + fw.y, fr.y) * (1.0 - smoothstep(WY1 - fw.y, WY1 + fw.y, fr.y));
          float far = smoothstep(0.3, 0.85, max(fw.x, fw.y));
          float cover = (WX1 - WX0) * (WY1 - WY0);
          float win = mix(wx * wy, cover, far) * side;
          float faceId = floor(vWN.x * 1.5 + 2.0) + floor(vWN.z * 1.5 + 2.0) * 3.0;
          float h = bHash(id * vec2(1.0, 1.37) + vSeed * 0.0731 + faceId * 3.1);
          float h2 = bHash(id.yx * 0.71 + vSeed * 0.113 + faceId);
          float lit = mix(step(1.0 - LIT_P, h), LIT_P, far);
          vec3 litCol = mix(vec3(1.0, 0.70, 0.40), vec3(0.78, 0.88, 1.0), step(0.72, h2)) * (0.55 + 0.9 * h2);
          diffuseColor.rgb = mix(diffuseColor.rgb, GLASS_COL, win * 0.92);
          diffuseColor.rgb *= mix(ROOF_DARK, 1.0, side);
          gWin = win;
          gLit = litCol * lit * win * EMIT;
          float gf = side * step(0.3, vWP.y) * (1.0 - step(FLOOR_H, vWP.y)) * STORE;
          gLit += gf * win * vec3(1.0, 0.82, 0.55) * 0.9 * step(0.35, bHash(vec2(floor(u / 7.0), vSeed.x * 0.37 + faceId)));
          gLit *= uLights;
        }`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.08, gWin);
          metalnessFactor = mix(metalnessFactor, GLASS_METAL, gWin);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += gLit;`);
  };
  mat.customProgramCacheKey = () => 'win_' + p.key;
  return mat;
}

const BMAT = {
  office: windowMaterial({ key: 'office', winW: 3.0, floorH: 3.6, wx0: 0.16, wx1: 0.84, wy0: 0.26, wy1: 0.86, lit: 0.36, emit: 1.5, store: 1, glass: [0.06, 0.08, 0.11], glassMetal: 0.7 }),
  glass: windowMaterial({ key: 'glass', winW: 1.6, floorH: 3.8, wx0: 0.05, wx1: 0.95, wy0: 0.07, wy1: 0.97, lit: 0.3, emit: 1.4, store: 1, glass: [0.05, 0.085, 0.11], glassMetal: 1.0, rough: 0.5, metal: 0.3 }),
  apt: windowMaterial({ key: 'apt', winW: 3.3, floorH: 2.9, wx0: 0.07, wx1: 0.93, wy0: 0.36, wy1: 0.86, lit: 0.5, emit: 1.3, store: 0, glass: [0.09, 0.1, 0.11], glassMetal: 0.5, rough: 0.9 }),
  low: windowMaterial({ key: 'low', winW: 2.6, floorH: 3.3, wx0: 0.14, wx1: 0.86, wy0: 0.3, wy1: 0.86, lit: 0.45, emit: 1.4, store: 1.2, glass: [0.07, 0.07, 0.08], glassMetal: 0.5 }),
  gold: windowMaterial({ key: 'gold', winW: 1.4, floorH: 3.0, wx0: 0.03, wx1: 0.97, wy0: 0.05, wy1: 0.97, lit: 0.22, emit: 1.3, store: 0, glass: [0.6, 0.4, 0.12], glassMetal: 1.0, rough: 0.4, metal: 0.5, roofDark: 0.9 }),
  lotte: windowMaterial({ key: 'lotte', winW: 1.3, floorH: 4.0, wx0: 0.03, wx1: 0.97, wy0: 0.04, wy1: 0.98, lit: 0.2, emit: 1.2, store: 0, glass: [0.3, 0.37, 0.45], glassMetal: 1.0, rough: 0.4, metal: 0.4, roofDark: 0.9 }),
};

// 공용 재질
const M = {
  concrete: stdMat(0x9a958d, 0.9), darkConcrete: stdMat(0x5f5b56, 0.9), stone: stdMat(0xb3a993, 0.85),
  granite: stdMat(0xc9c3b6, 0.7), metal: stdMat(0x5a6066, 0.45, 0.7), darkMetal: stdMat(0x2a2d31, 0.5, 0.6),
  white: stdMat(0xe9e6df, 0.6), red: stdMat(0x8e2a1e, 0.7), green: stdMat(0x2c6b5a, 0.7), wood: stdMat(0x6b4a30, 0.8),
  bronze: stdMat(0x5b4a32, 0.45, 0.85), gold: stdMat(0xd9a43a, 0.3, 1.0), black: new THREE.MeshBasicMaterial({ color: 0x050505 }),
  grass: stdMat(0x4f6b34, 1.0), roofProp: stdMat(0x8a8a86, 0.85, 0.1), trunk: stdMat(0x4a3526, 0.95),
};
const roofTex = canvasTex(64, 64, (g) => {
  g.fillStyle = '#3a3f3c'; g.fillRect(0, 0, 64, 64);
  for (let x = 0; x < 64; x += 8) { g.fillStyle = '#2b302e'; g.fillRect(x, 0, 3, 64); g.fillStyle = '#4a504c'; g.fillRect(x + 4, 0, 2, 64); }
}, { repeat: true });
M.roofTile = stdMat(0xffffff, 0.8, 0, { map: roofTex, side: THREE.DoubleSide });
const roofBlueTex = canvasTex(64, 64, (g) => {
  g.fillStyle = '#1c4f86'; g.fillRect(0, 0, 64, 64);
  for (let x = 0; x < 64; x += 8) { g.fillStyle = '#143b66'; g.fillRect(x, 0, 3, 64); g.fillStyle = '#2d6cab'; g.fillRect(x + 4, 0, 2, 64); }
}, { repeat: true });
M.roofBlue = stdMat(0xffffff, 0.55, 0.1, { map: roofBlueTex, side: THREE.DoubleSide });
const dancheongTex = canvasTex(128, 32, (g) => {
  g.fillStyle = '#2f7f6e'; g.fillRect(0, 0, 128, 32);
  for (let x = 0; x < 128; x += 16) {
    g.fillStyle = '#c0392b'; g.fillRect(x + 2, 4, 4, 24); g.fillStyle = '#f1c40f'; g.fillRect(x + 7, 10, 3, 12);
    g.fillStyle = '#1f4e8c'; g.fillRect(x + 11, 6, 3, 20);
  }
  g.fillStyle = '#e8e2d0'; g.fillRect(0, 0, 128, 2); g.fillRect(0, 30, 128, 2);
}, { repeat: true });
M.dancheong = stdMat(0xffffff, 0.8, 0, { map: dancheongTex });
const latticeTex = canvasTex(64, 64, (g) => {
  g.fillStyle = '#7a2f22'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#d9cfb8'; for (let y = 6; y < 58; y += 7) for (let x = 6; x < 58; x += 7) g.fillRect(x, y, 5, 5);
}, { repeat: true });
M.lattice = stdMat(0xffffff, 0.85, 0, { map: latticeTex });

// 같은 재질끼리 지오메트리를 합쳐 드로우콜을 줄이는 배치
class Batch {
  constructor() { this.map = new Map(); }
  add(geo, mat, x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(m);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat).push(g);
    return this;
  }
  box(mat, w, h, d, x, y, z, ry = 0) { return this.add(GEO.box, mat, x, y, z, ry, w, h, d); }
  build(parent, shadow = true) {
    for (const [mat, list] of this.map) {
      const merged = mergeGeometries(list, false);
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = shadow; mesh.receiveShadow = true;
      parent.add(mesh);
      list.forEach(g => g.dispose());
    }
    this.map.clear();
  }
}
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),                       // 중심 기준
  boxB: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), // 바닥 기준
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  sphere: new THREE.SphereGeometry(1, 16, 12),
  plane: new THREE.PlaneGeometry(1, 1),
};

// 한옥 기와지붕 (오목한 곡선 + 처마 끝이 들림)
function hanokRoof(w, d, h, over = 1.4, lift = 0.8) {
  const W = w / 2 + over, D = d / 2 + over;
  const rh = Math.max(0.4, W - D * 0.95);
  const pos = [], uv = [], idx = [];
  const NU = 10, NT = 6;
  function face(e0, e1, r0, r1, len) {
    const base = pos.length / 3;
    for (let j = 0; j <= NT; j++) {
      const t = j / NT;
      for (let i = 0; i <= NU; i++) {
        const u = i / NU;
        const ex = lerp(e0[0], e1[0], u), ez = lerp(e0[1], e1[1], u);
        const rx = lerp(r0[0], r1[0], u), rz = lerp(r0[1], r1[1], u);
        const lift2 = lift * Math.pow(Math.abs(2 * u - 1), 3) * (1 - t);
        pos.push(lerp(ex, rx, t), h * Math.pow(t, 1.6) + lift2, lerp(ez, rz, t));
        uv.push(u * len / 1.2, t * 3);
      }
    }
    for (let j = 0; j < NT; j++) for (let i = 0; i < NU; i++) {
      const a = base + j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d2 = c + 1;
      idx.push(a, c, b, b, c, d2);
    }
  }
  const E0 = [-W, -D], E1 = [W, -D], E2 = [W, D], E3 = [-W, D], R0 = [-rh, 0], R1 = [rh, 0];
  face(E3, E2, R0, R1, 2 * W);
  face(E1, E0, R1, R0, 2 * W);
  face(E0, E3, R0, R0, 2 * D);
  face(E2, E1, R1, R1, 2 * D);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return { geo: g, ridge: rh };
}
// 한옥 건물: 기둥 + 벽(창살) + 단청 + 겹지붕
function hanok(batch, cx, cz, w, d, baseY, wallH, roofH, tiers = 1, ry = 0, open = false, roofMat = M.roofTile) {
  const cos = Math.cos(ry), sin = Math.sin(ry);
  const P = (lx, lz) => [cx + lx * cos + lz * sin, cz - lx * sin + lz * cos];
  if (!open) batch.add(GEO.box, M.lattice, cx, baseY + wallH / 2, cz, ry, w - 0.8, wallH, d - 0.8);
  const nx = Math.max(2, Math.round(w / 3.2)), nz = Math.max(2, Math.round(d / 3.2));
  for (let i = 0; i <= nx; i++) for (const sz of [-1, 1]) {
    const [x, z] = P(-w / 2 + (w * i) / nx, sz * d / 2);
    batch.add(GEO.cyl, M.red, x, baseY + wallH / 2, z, 0, 0.28, wallH, 0.28);
  }
  for (let i = 1; i < nz; i++) for (const sx of [-1, 1]) {
    const [x, z] = P(sx * w / 2, -d / 2 + (d * i) / nz);
    batch.add(GEO.cyl, M.red, x, baseY + wallH / 2, z, 0, 0.28, wallH, 0.28);
  }
  batch.add(GEO.box, M.dancheong, cx, baseY + wallH + 0.35, cz, ry, w + 0.6, 0.7, d + 0.6);
  let y = baseY + wallH + 0.7;
  for (let t = 0; t < tiers; t++) {
    const k = t === 0 ? 1 : 0.78;
    const rf = hanokRoof(w * k, d * k, roofH * (t === tiers - 1 ? 1 : 0.55), t === 0 ? 1.6 : 1.2, 0.8);
    batch.add(rf.geo, roofMat, cx, y, cz, ry);
    if (t === tiers - 1) {
      batch.add(GEO.box, M.darkConcrete, cx, y + roofH + 0.15, cz, ry, rf.ridge * 2 + 1.0, 0.5, 0.6);
    } else {
      batch.add(GEO.box, M.dancheong, cx, y + roofH * 0.55 + 0.4, cz, ry, w * 0.78 + 0.4, 0.9, d * 0.78 + 0.4);
      y += roofH * 0.55 + 0.8;
    }
  }
}
