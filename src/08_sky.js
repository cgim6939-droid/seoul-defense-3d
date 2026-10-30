// ============================================================
//  하늘 · 조명 · 시간대 · 후처리
// ============================================================
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.castShadow = true;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0x8090c0, 0x403028, 0.6);
scene.add(hemi);
scene.fog = new THREE.FogExp2(0x9c8fa0, 0.0009);
const sunDir = new THREE.Vector3();
// 무기 화면 조명
const wHemi = new THREE.HemisphereLight(0xb0b8d0, 0x403830, 0.8);
const wSun = new THREE.DirectionalLight(0xffffff, 1.4);
weaponScene.add(wHemi, wSun, wSun.target);

const TOD = {
  dusk:  { elev: 7, az: -68, sun: 0xff9a58, sunI: 2.0, hs: 0x7a80b0, hg: 0x3a2a22, hI: 0.45, fog: 0x8a7c90, fogD: 0.00085, exp: 0.48, lights: 0.75, envI: 0.55,
           turb: 7, ray: 2.4, mie: 0.006, mieG: 0.86, cLit: [1.25, 0.72, 0.5], cDark: [0.42, 0.36, 0.48], cover: 0.5, stars: 0, bg: 1 },
  night: { elev: -12, az: -68, sun: 0x8899ff, sunI: 0.35, hs: 0x26304a, hg: 0x15100c, hI: 0.45, fog: 0x161c2c, fogD: 0.001, exp: 0.85, lights: 1.5, envI: 0.35,
           turb: 2, ray: 1, mie: 0.004, mieG: 0.8, cLit: [0.05, 0.06, 0.09], cDark: [0.02, 0.025, 0.04], cover: 0.6, stars: 0.75, bg: 0.35, moon: true },
  day:   { elev: 42, az: -40, sun: 0xfff1dd, sunI: 3.2, hs: 0xa8c0e0, hg: 0x5a5040, hI: 0.9, fog: 0xaebfcf, fogD: 0.0007, exp: 0.45, lights: 0.08, envI: 0.8,
           turb: 3.5, ray: 1.2, mie: 0.004, mieG: 0.8, cLit: [1.3, 1.3, 1.35], cDark: [0.7, 0.74, 0.82], cover: 0.55, stars: 0, bg: 1 },
};
const skyScene = new THREE.Scene();
const sky = new Sky(); sky.scale.setScalar(1000); skyScene.add(sky);
const cloudMat = new THREE.ShaderMaterial({
  uniforms: { sunDir: { value: new THREE.Vector3() }, litCol: { value: new THREE.Color() }, darkCol: { value: new THREE.Color() }, cover: { value: 0.5 } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 sunDir; uniform vec3 litCol; uniform vec3 darkCol; uniform float cover; varying vec3 vDir;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 6; i++){ v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
    void main(){
      vec3 d = normalize(vDir);
      if (d.y < 0.0) discard;
      vec2 uv = d.xz / (d.y + 0.1) * 1.4;
      float n = fbm(uv * 1.2 + vec2(3.0, 1.0)) * 0.75 + fbm(uv * 3.3 - 4.0) * 0.35;
      float dens = smoothstep(cover, cover + 0.3, n);
      float thick = smoothstep(cover, cover + 0.55, n);
      float horizon = smoothstep(0.0, 0.1, d.y);
      float sunAmt = pow(max(dot(d, sunDir), 0.0), 4.0);
      vec3 col = mix(litCol, darkCol, thick * 0.75) + litCol * sunAmt * 1.6 * (1.0 - thick * 0.6);
      gl_FragColor = vec4(col, dens * horizon * 0.92);
    }`,
  side: THREE.BackSide, transparent: true, depthWrite: false,
});
const cloudDome = new THREE.Mesh(new THREE.SphereGeometry(900, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), cloudMat);
skyScene.add(cloudDome);
// 별
const starGeo = new THREE.BufferGeometry(); {
  const n = 1400, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 0.9 + 0.12, Math.random() * 2 - 1).normalize().multiplyScalar(950); p.set([v.x, v.y, v.z], i * 3); }
  starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
}
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.1, sizeAttenuation: false, transparent: true, opacity: 0, fog: false });
skyScene.add(new THREE.Points(starGeo, starMat));
const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.1, 2.8), fog: false }));
skyScene.add(moon);
const cubeRT = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
const cubeCam = new THREE.CubeCamera(1, 3000, cubeRT); skyScene.add(cubeCam);
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;

function applyTOD(name) {
  const T = TOD[name] || TOD.dusk;
  const el = THREE.MathUtils.degToRad(T.elev), az = THREE.MathUtils.degToRad(T.az);
  sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  sky.material.uniforms.sunPosition.value.copy(sunDir);
  sky.material.uniforms.turbidity.value = T.turb; sky.material.uniforms.rayleigh.value = T.ray;
  sky.material.uniforms.mieCoefficient.value = T.mie; sky.material.uniforms.mieDirectionalG.value = T.mieG;
  cloudMat.uniforms.sunDir.value.copy(sunDir);
  cloudMat.uniforms.litCol.value.setRGB(...T.cLit); cloudMat.uniforms.darkCol.value.setRGB(...T.cDark);
  cloudMat.uniforms.cover.value = T.cover;
  starMat.opacity = T.stars;
  moon.visible = !!T.moon;
  const lightDir = sunDir.clone();
  if (T.moon) { lightDir.set(0.35, 0.6, -0.55).normalize(); moon.position.copy(lightDir).multiplyScalar(800); }
  G.lightDir = lightDir;
  sun.color.set(T.sun); sun.intensity = T.sunI;
  hemi.color.set(T.hs); hemi.groundColor.set(T.hg); hemi.intensity = T.hI;
  wHemi.color.set(T.hs); wHemi.groundColor.set(T.hg); wHemi.intensity = T.hI + 0.25; wSun.color.set(T.sun); wSun.intensity = T.sunI * 0.6 + 0.3;
  scene.fog.color.set(T.fog); scene.fog.density = T.fogD;
  renderer.toneMappingExposure = T.exp;
  U.lights.value = T.lights;
  const L = T.lights;
  if (WORLD_FX.lampHead) WORLD_FX.lampHead.color.setRGB(4, 3.3, 2.3).multiplyScalar(Math.max(0.25, L * 0.8));
  if (WORLD_FX.lampPool) WORLD_FX.lampPool.opacity = clamp(L - 0.2, 0, 1.4);
  if (WORLD_FX.signs) for (const m of WORLD_FX.signs) m.color.setScalar(lerp(0.9, 1.7, clamp(L, 0, 1)));
  if (WORLD_FX.carLights) for (const m of WORLD_FX.carLights) m.color.setScalar(lerp(1.2, 3.2, clamp(L, 0, 1)));
  if (WORLD_FX.fountain) WORLD_FX.fountain.uniforms.uOn.value = L > 0.5 ? 1 : 0.35;
  cubeCam.update(renderer, skyScene);
  scene.background = cubeRT.texture;
  if (envRT) envRT.dispose();
  envRT = pmrem.fromCubemap(cubeRT.texture);
  scene.environment = envRT.texture;
  weaponScene.environment = envRT.texture;
  scene.backgroundIntensity = T.bg;
  setEnvIntensity(T.envI ?? 0.6);
}

function setEnvIntensity(k) {
  const seen = new Set();
  scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) if (m.isMeshStandardMaterial && !seen.has(m) && m !== WATER.mat) { seen.add(m); m.envMapIntensity = k; } });
}
let composer = null, bloomPass = null;
function applyQuality() {
  const q = QUALITY[SETTINGS.quality] || QUALITY.medium;
  AR.i = 0; AR.ema = 16; AR.cool = 3;
  renderer.setPixelRatio(q.pr);
  renderer.setSize(innerWidth, innerHeight);
  if (renderer.shadowMap.enabled !== q.shadows) {
    renderer.shadowMap.enabled = q.shadows;
    scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
  }
  sun.castShadow = q.shadows;
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  if (sun.shadow.mapSize.x !== q.shadowSize) { sun.shadow.mapSize.set(q.shadowSize, q.shadowSize); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  const cam = sun.shadow.camera; const r = q.shadowRange;
  cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r; cam.near = 1; cam.far = 1100; cam.updateProjectionMatrix();
  G.shadowRange = r; G.shadowSize = q.shadowSize;
  if (composer) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); composer = null; }
  if (q.bloom) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: q.samples });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(q.pr); composer.setSize(innerWidth, innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    const wp = new RenderPass(weaponScene, weaponCam); wp.clear = false; wp.clearDepth = true;
    composer.addPass(wp);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth >> 1, innerHeight >> 1), 0.5, 0.5, 0.85);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }
  PARTICLE_SCALE.value = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}
// 프레임이 떨어지면 렌더 해상도를 단계적으로 낮추고, 여유가 생기면 다시 올린다
const AR = { levels: [1, 0.85, 0.72, 0.6, 0.5], i: 0, ema: 16, t: 0, cool: 3 };
function setRenderScale(k) {
  const pr = (QUALITY[SETTINGS.quality] || QUALITY.medium).pr * k;
  renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight);
  if (composer) { composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight); }
  PARTICLE_SCALE.value = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}
function adaptResolution(dt) {
  if (G.state !== 'play') return;
  AR.ema += (dt * 1000 - AR.ema) * 0.04; AR.t += dt; AR.cool -= dt;
  if (AR.t < 1 || AR.cool > 0) return; AR.t = 0;
  if (AR.ema > 19 && AR.i < AR.levels.length - 1) { AR.i++; AR.cool = 3; setRenderScale(AR.levels[AR.i]); }
  else if (AR.ema < 12.5 && AR.i > 0) { AR.i--; AR.cool = 8; setRenderScale(AR.levels[AR.i]); }
}
function renderFrame() {
  if (composer) composer.render();
  else {
    renderer.autoClear = false; renderer.setRenderTarget(null); renderer.clear();
    renderer.render(scene, camera); renderer.clearDepth(); renderer.render(weaponScene, weaponCam);
  }
}
addEventListener('resize', () => {
  camera.aspect = weaponCam.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix(); weaponCam.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
  PARTICLE_SCALE.value = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
});
// 그림자 카메라를 플레이어 주변에 붙이고 텍셀 단위로 스냅 (흔들림 방지)
const _sv = new THREE.Vector3();
function updateShadowCam(cx, cz) {
  const r = G.shadowRange || 90, step = (2 * r) / (G.shadowSize || 2048);
  _sv.set(Math.round(cx / step) * step, 0, Math.round(cz / step) * step);
  sun.target.position.copy(_sv);
  sun.position.copy(_sv).addScaledVector(G.lightDir || sunDir, 500);
  sun.target.updateMatrixWorld();
}
