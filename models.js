// 코드로 만든 3D 선물 모델 (외부 파일 없음). 모델은 Y가 위쪽, 앞쪽이 +Z 입니다.
// 각 모델은 userData.update(dt, time) 로 스스로 움직입니다(헤엄, 불꽃 등).
import * as THREE from "three";
import { RoundedBoxGeometry } from "./lib/RoundedBoxGeometry.js";
import { RoomEnvironment } from "./lib/addons/environments/RoomEnvironment.js";

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });

// 금속 반사용 환경맵 (장면마다 한 번)
export function applyEnvironment(renderer, scene) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
}

// 둥근 빛 점 텍스처
const dotTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,.7)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const bubbleTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d");
  x.strokeStyle = "rgba(255,255,255,.9)"; x.lineWidth = 4; x.beginPath(); x.arc(32, 32, 26, 0, Math.PI * 2); x.stroke();
  x.fillStyle = "rgba(200,240,255,.25)"; x.fill();
  x.fillStyle = "rgba(255,255,255,.95)"; x.beginPath(); x.arc(22, 22, 6, 0, Math.PI * 2); x.fill();
  return new THREE.CanvasTexture(c);
})();

// 털 가닥 텍스처 (점마다 길이가 다른 털)
const furTex = (() => {
  const N = 256, c = document.createElement("canvas"); c.width = c.height = N;
  const x = c.getContext("2d"), img = x.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const v = Math.random() < 0.55 ? Math.floor(Math.pow(Math.random(), 0.6) * 255) : 0;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 7);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
})();

// mesh 위에 털 껍질(shell)을 여러 겹 쌓아서 입체적인 복슬복슬 털을 만듦
function addFur(mesh, length, layers = 14) {
  const base = mesh.geometry, pos = base.attributes.position, nrm = base.attributes.normal;
  for (let i = 1; i <= layers; i++) {
    const h = i / layers, g = base.clone(), p = g.attributes.position;
    const droop = -0.25 * h * h * length; // 털 끝이 살짝 아래로 처짐
    for (let k = 0; k < p.count; k++) {
      p.setXYZ(k, pos.getX(k) + nrm.getX(k) * length * h, pos.getY(k) + nrm.getY(k) * length * h + droop, pos.getZ(k) + nrm.getZ(k) * length * h);
    }
    const shade = 0.82 + 0.18 * h; // 털 뿌리 쪽은 살짝 어둡게(입체감)
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(shade, shade, Math.min(1, shade * 1.01)), roughness: 1, alphaMap: furTex, alphaTest: 0.08 + h * 0.85,
    });
    const shell = new THREE.Mesh(g, m);
    shell.renderOrder = i;
    mesh.add(shell);
  }
}

// ───────── 하프물범 필통 ─────────
export function createSeal() {
  const g = new THREE.Group();
  const A = 0.5, B = 0.43, C = 0.72; // 몸통 타원체 반지름 (x, y, z)
  const FUR = 0.045;

  const geo = new THREE.SphereGeometry(1, 72, 48);
  geo.scale(A, B, C); geo.computeVertexNormals();
  const skin = new THREE.MeshPhysicalMaterial({ color: 0xe8e8ee, roughness: 1, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.5 });
  const body = new THREE.Mesh(geo, skin);
  addFur(body, FUR);
  g.add(body);

  const onSurface = (x, y, off = 0) => {
    const z = C * Math.sqrt(Math.max(0, 1 - (x / A) ** 2 - (y / B) ** 2));
    return new THREE.Vector3(x, y, z + off);
  };

  // 눈 (반짝이는 검은 자수 단추) — 털 위로 나오도록 바깥쪽에
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x0c0c10, roughness: 0.25, clearcoat: 1 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.066, 24, 16), eyeMat);
    e.position.copy(onSurface(0.2 * s, 0.02, FUR * 0.6));
    e.scale.z = 0.6;
    g.add(e);
    const br = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.07, 4, 8), std(0x9a9aa6));
    br.position.copy(onSurface(0.22 * s, 0.14, FUR * 0.8));
    br.rotation.z = Math.PI / 2 + 0.25 * s;
    g.add(br);
  }
  // 코 (회색 퐁퐁 두 개, 털 질감)
  const noseGeo = new THREE.SphereGeometry(0.072, 24, 16);
  for (const s of [-1, 1]) {
    const n = new THREE.Mesh(noseGeo, std(0xb4b5c0, { roughness: 1 }));
    n.position.copy(onSurface(0.048 * s, -0.09, FUR * 0.7));
    addFur(n, 0.012, 6);
    g.add(n);
  }
  const nd = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), eyeMat);
  nd.position.copy(onSurface(0, -0.035, FUR + 0.03));
  g.add(nd);

  // 지퍼 (등 위, 털 사이로 보이게)
  const pts = [];
  for (let z = -0.56; z <= 0.3; z += 0.04) pts.push(new THREE.Vector3(0, B * Math.sqrt(Math.max(0, 1 - (z / C) ** 2)) + FUR * 0.7, z));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.024, 8), std(0xd5d7dd, { roughness: 0.4, metalness: 0.3 })));
  const pull = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.02, 0.08, 2, 0.008), std(0xc9ccd4, { metalness: 0.8, roughness: 0.3 }));
  pull.position.set(0, B * Math.sqrt(1 - (0.3 / C) ** 2) + FUR, 0.33); g.add(pull);

  // 지느러미 (털 포함) — 관절(pivot)에 달아서 퍼덕이게
  const flipGeo = new THREE.SphereGeometry(1, 24, 16);
  const makeFlipper = (sx, sy, sz, px, py, pz, rx, ry, rz, offX, offZ) => {
    const pivot = new THREE.Group(); pivot.position.set(px, py, pz); pivot.rotation.set(rx, ry, rz);
    const fg = flipGeo.clone(); fg.scale(sx, sy, sz); fg.translate(offX, 0, offZ); fg.computeVertexNormals();
    const f = new THREE.Mesh(fg, skin); addFur(f, 0.02, 8); pivot.add(f);
    pivot.userData.base = pivot.rotation.clone();
    g.add(pivot); return pivot;
  };
  const front = [-1, 1].map((s) => makeFlipper(0.13, 0.045, 0.1, 0.4 * s, -0.28, 0.2, 0, -0.6 * s, -0.4 * s, 0.08 * s, 0));
  const back = [-1, 1].map((s) => makeFlipper(0.11, 0.045, 0.14, 0.07 * s, -0.24, -0.68, 0.3, 0.6 * s, 0.15 * s, 0, -0.1));

  g.position.y = B + FUR; // 바닥이 y=0
  const wrap = new THREE.Group();
  wrap.add(g);

  // 공기방울 (헤엄칠 때)
  const NB = 18, bpos = new Float32Array(NB * 3), blife = new Float32Array(NB);
  const bgeo = new THREE.BufferGeometry(); bgeo.setAttribute("position", new THREE.BufferAttribute(bpos, 3));
  const bubbles = new THREE.Points(bgeo, new THREE.PointsMaterial({ size: 0.06, map: bubbleTex, transparent: true, depthWrite: false }));
  bubbles.frustumCulled = false; wrap.add(bubbles);
  for (let i = 0; i < NB; i++) { blife[i] = Math.random() * 2; bpos[i * 3 + 1] = -99; }

  wrap.userData.height = (B + FUR) * 2;
  wrap.userData.update = (dt, t) => {
    // 헤엄: 몸이 물결처럼 들썩, 앞지느러미 노 젓기, 뒷지느러미 위아래 퍼덕
    g.rotation.x = 0.07 * Math.sin(t * 3.2);
    g.position.y = B + FUR + 0.03 * Math.sin(t * 3.2 + 1);
    front.forEach((p, i) => { const s = i ? 1 : -1; p.rotation.set(p.userData.base.x + 0.5 * Math.sin(t * 4.5), p.userData.base.y, p.userData.base.z + 0.35 * s * Math.sin(t * 4.5 + 0.6)); });
    back.forEach((p, i) => { p.rotation.set(p.userData.base.x + 0.45 * Math.sin(t * 3.2 + i * 0.4), p.userData.base.y, p.userData.base.z); });
    // 공기방울: 코 위에서 생겨 위로 올라감
    for (let i = 0; i < NB; i++) {
      blife[i] -= dt;
      if (blife[i] <= 0) { blife[i] = 1.2 + Math.random() * 1.2; bpos.set([(Math.random() - 0.5) * 0.15, 0.45 + Math.random() * 0.1, 0.65 + Math.random() * 0.1], i * 3); }
      bpos[i * 3 + 1] += dt * 0.35; bpos[i * 3] += Math.sin(t * 5 + i) * dt * 0.05;
    }
    bgeo.attributes.position.needsUpdate = true;
  };
  return wrap;
}

// ───────── 스타 스파크 배틀 컷 (글씨 없음) ─────────
export function createSword() {
  const root = new THREE.Group();
  // 칼날: 손잡이(가드 아래 ~0.44)의 약 3배 → 다시 25% 더 길게
  const L = 1.55, TIP = 0.1;

  const bladeShape = (w, len, tip) => {
    const s = new THREE.Shape();
    s.moveTo(-w, 0); s.lineTo(w, 0); s.lineTo(w, len); s.lineTo(-w, len + tip); s.lineTo(-w, 0);
    return s;
  };
  // 칼등: 광택 있는 검은 금속
  const blade = new THREE.Mesh(
    new THREE.ExtrudeGeometry(bladeShape(0.05, L, TIP), { depth: 0.03, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 }),
    new THREE.MeshPhysicalMaterial({ color: 0x15151a, metalness: 0.9, roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.2, envMapIntensity: 0.35 })
  );
  blade.geometry.translate(0, 0, -0.015);
  blade.position.y = 0.06;
  root.add(blade);

  // 무지개로 빛나는 날 (색이 칼날을 따라 흐름)
  const glowShape = new THREE.Shape();
  glowShape.moveTo(0.036, 0); glowShape.lineTo(0.06, 0); glowShape.lineTo(0.06, L); glowShape.lineTo(0.036, L + 0.016); glowShape.lineTo(0.036, 0);
  const uT = { value: 0 };
  const rainbow = "vec3 hsv(float h){ return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }";
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { uT },
    vertexShader: "varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: `varying float vY; uniform float uT; ${rainbow}
      void main(){ vec3 c = hsv(fract(vY*0.55 - uT*0.35)); gl_FragColor = vec4(mix(c, vec3(1.), 0.35) * 1.2, 1.); }`,
  });
  const glow = new THREE.Mesh(new THREE.ExtrudeGeometry(glowShape, { depth: 0.038, bevelEnabled: false }), glowMat);
  glow.geometry.translate(0, 0, -0.019);
  glow.position.y = 0.06;
  root.add(glow);

  // 빛 번짐(후광): 서로 엇갈린 두 장의 가산 혼합 판 → 어느 각도에서 봐도 빛남
  const haloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uT },
    vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: `varying vec2 vUv; uniform float uT; ${rainbow}
      void main(){
        float d = abs(vUv.x-0.5)*2.;
        float ends = smoothstep(0.,0.06,vUv.y)*smoothstep(1.,0.92,vUv.y);
        float a = pow(max(0.,1.-d),2.5) * ends * (0.75 + 0.25*sin(uT*7.));
        vec3 c = hsv(fract(vUv.y*${(L * 0.55).toFixed(3)} - uT*0.35));
        gl_FragColor = vec4(c*0.9, a);
      }`,
  });
  for (const ry of [0, Math.PI / 2]) {
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.42, L + 0.2), haloMat);
    halo.position.set(0.048, 0.06 + L / 2, 0); halo.rotation.y = ry;
    root.add(halo);
  }

  // 붉은 가드 (광택 + 은은한 발광)
  const redGlow = new THREE.MeshPhysicalMaterial({ color: 0xd9232d, metalness: 0.4, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 0.45, emissive: 0xff2a1a, emissiveIntensity: 0.35 });
  const gs = new THREE.Shape();
  const gw = 0.2, gh = 0.07;
  gs.moveTo(-gw, 0); gs.lineTo(-gw + 0.05, gh); gs.lineTo(gw - 0.05, gh); gs.lineTo(gw, 0); gs.lineTo(gw - 0.05, -gh); gs.lineTo(-gw + 0.05, -gh); gs.lineTo(-gw, 0);
  const guard = new THREE.Mesh(new THREE.ExtrudeGeometry(gs, { depth: 0.07, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 }), redGlow);
  guard.geometry.translate(0, 0, -0.035);
  guard.position.y = 0.04;
  root.add(guard);

  // 손잡이: 광택 나는 금속(건메탈) + 크롬 링 + 붉은 포인트
  const metal = new THREE.MeshPhysicalMaterial({ color: 0x4a4f5a, metalness: 1, roughness: 0.2, clearcoat: 0.4, envMapIntensity: 0.8 });
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xe6e8ee, metalness: 1, roughness: 0.06 });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.09, 24), chrome);
  core.position.y = 0.07; root.add(core);
  const handle = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.36, 0.06, 3, 0.02), metal);
  handle.position.y = -0.16; root.add(handle);
  for (const y of [-0.04, -0.28]) {
    const ring = new THREE.Mesh(new RoundedBoxGeometry(0.095, 0.022, 0.07, 2, 0.008), chrome);
    ring.position.y = y; root.add(ring);
  }
  for (const y of [-0.12, -0.2]) {
    const st = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.025, 0.065, 2, 0.008), redGlow);
    st.position.y = y; root.add(st);
  }
  const pommel = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.07, 0.085, 3, 0.02), redGlow);
  pommel.position.y = -0.37; root.add(pommel);

  // 손잡이·가드에서 튀는 불꽃 스파크 (노랑 → 주황 → 빨강으로 식어감)
  const N = 220, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N), max = new Float32Array(N);
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); sgeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const sparks = new THREE.Points(sgeo, new THREE.PointsMaterial({ size: 0.07, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false; root.add(sparks);
  for (let i = 0; i < N; i++) { max[i] = 1; life[i] = Math.random() * 0.8; pos[i * 3 + 1] = -99; }
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  flare.position.set(0, 0.06, 0); flare.scale.setScalar(0.35); root.add(flare);
  const c = new THREE.Color();

  // 회전 중심이 검 길이의 가운데가 되도록 정렬 (아래 끝 -0.41 ~ 칼끝 L+0.16)
  const outer = new THREE.Group();
  root.position.y = -((L + 0.16) + -0.41) / 2;
  outer.add(root);
  outer.userData.glowMat = glowMat;
  outer.userData.height = L + 0.57;
  outer.userData.update = (dt, t) => {
    uT.value = t;
    redGlow.emissiveIntensity = 0.3 + 0.15 * Math.sin(t * 6);
    flare.material.opacity = 0.6 + 0.4 * Math.sin(t * 23) * Math.sin(t * 9);
    flare.scale.setScalar(0.3 + 0.08 * Math.sin(t * 17));
    const burst = Math.sin(t * 2.3) > 0.85; // 가끔 한꺼번에 '파박!'
    for (let i = 0; i < N; i++) {
      life[i] -= dt * (burst ? 1.6 : 1);
      if (life[i] <= 0) {
        max[i] = life[i] = 0.35 + Math.random() * 0.6;
        // 가드 양 끝과 손잡이 윗부분에서 생성
        const side = Math.random() < 0.5 ? -1 : 1, fromGuard = Math.random() < 0.7;
        pos.set(fromGuard ? [side * (0.05 + Math.random() * 0.15), 0.04 + (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08]
                          : [(Math.random() - 0.5) * 0.08, -0.05 - Math.random() * 0.2, (Math.random() - 0.5) * 0.07], i * 3);
        const a = Math.random() * Math.PI * 2, sp = 0.5 + Math.random() * 0.9;
        vel.set([side * (0.3 + Math.random() * 0.6) + Math.cos(a) * 0.2, (Math.random() - 0.3) * sp, Math.sin(a) * sp * 0.7], i * 3);
      }
      vel[i * 3 + 1] -= 1.6 * dt; // 중력
      for (let k = 0; k < 3; k++) pos[i * 3 + k] += vel[i * 3 + k] * dt;
      const f = Math.max(0, life[i] / max[i]); // 1 → 0
      c.setHSL(0.03 + 0.12 * f, 1, 0.35 + 0.45 * f);
      col[i * 3] = c.r * f; col[i * 3 + 1] = c.g * f; col[i * 3 + 2] = c.b * f;
    }
    sgeo.attributes.position.needsUpdate = true; sgeo.attributes.color.needsUpdate = true;
  };
  return outer;
}
