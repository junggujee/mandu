// 코드로 만든 3D 선물 모델 (외부 파일 없음). 모델은 Y가 위쪽, 앞쪽이 +Z 입니다.
import * as THREE from "three";
import { RoundedBoxGeometry } from "./lib/RoundedBoxGeometry.js";

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });

// ───────── 하프물범 필통 ─────────
export function createSeal() {
  const g = new THREE.Group();
  const A = 0.5, B = 0.43, C = 0.72; // 몸통 타원체 반지름 (x, y, z)

  // 털 느낌: 살짝 울퉁불퉁한 구 + sheen
  const geo = new THREE.SphereGeometry(1, 72, 48);
  geo.scale(A, B, C);
  const fur = new THREE.MeshPhysicalMaterial({
    color: 0xfbfbfd, roughness: 1, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.6,
  });
  const body = new THREE.Mesh(geo, fur);
  g.add(body);

  const onSurface = (x, y, off = 0) => {
    const z = C * Math.sqrt(Math.max(0, 1 - (x / A) ** 2 - (y / B) ** 2));
    return new THREE.Vector3(x, y, z + off);
  };

  // 눈 (검은 자수 단추)
  const eyeMat = std(0x111114, { roughness: 0.4 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.062, 24, 16), eyeMat);
    e.position.copy(onSurface(0.2 * s, 0.02, -0.012));
    e.scale.z = 0.6;
    g.add(e);
    // 눈썹 (작은 회색 선)
    const br = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.07, 4, 8), std(0x9a9aa6));
    br.position.copy(onSurface(0.22 * s, 0.14, 0.0));
    br.rotation.z = Math.PI / 2 + 0.25 * s;
    g.add(br);
  }
  // 코 (회색 퐁퐁 두 개)
  const noseMat = std(0xb9bac4, { roughness: 1 });
  for (const s of [-1, 1]) {
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 16), noseMat);
    n.position.copy(onSurface(0.045 * s, -0.09, 0.0));
    g.add(n);
  }
  const nd = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), eyeMat);
  nd.position.copy(onSurface(0, -0.04, 0.03));
  g.add(nd);

  // 지퍼 (등 위)
  const pts = [];
  for (let z = -0.56; z <= 0.3; z += 0.04) {
    const y = B * Math.sqrt(Math.max(0, 1 - (z / C) ** 2)) + 0.008;
    pts.push(new THREE.Vector3(0, y, z));
  }
  const zip = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.022, 8), std(0xd5d7dd, { roughness: 0.6 }));
  g.add(zip);

  // 앞지느러미 / 뒷지느러미
  const flipGeo = new THREE.SphereGeometry(1, 20, 16);
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(flipGeo, fur);
    f.scale.set(0.13, 0.045, 0.1);
    f.position.set(0.46 * s, -0.3, 0.2);
    f.rotation.set(0, -0.6 * s, -0.4 * s);
    g.add(f);
    const t = new THREE.Mesh(flipGeo, fur);
    t.scale.set(0.12, 0.045, 0.14);
    t.position.set(0.1 * s, -0.25, -0.76);
    t.rotation.set(0.3, 0.6 * s, 0.15 * s);
    g.add(t);
  }
  g.position.y = B; // 바닥이 y=0
  const wrap = new THREE.Group();
  wrap.add(g);
  wrap.userData.height = B * 2;
  return wrap;
}

// ───────── 스타 스파크 배틀 컷 (글씨 없음) ─────────
export function createSword() {
  const root = new THREE.Group();

  // 칼날 외곽선(비스듬한 끝)
  const bladeShape = (w, len, tip) => {
    const s = new THREE.Shape();
    s.moveTo(-w, 0); s.lineTo(w, 0); s.lineTo(w, len); s.lineTo(-w, len + tip); s.lineTo(-w, 0);
    return s;
  };
  const blade = new THREE.Mesh(
    new THREE.ExtrudeGeometry(bladeShape(0.05, 0.72, 0.07), { depth: 0.03, bevelEnabled: false }),
    std(0x15151a, { roughness: 0.35, metalness: 0.7 })
  );
  blade.geometry.translate(0, 0, -0.015);
  blade.position.y = 0.06;
  root.add(blade);

  // 무지개 빛나는 날 (셰이더)
  const glowShape = new THREE.Shape();
  glowShape.moveTo(0.036, 0); glowShape.lineTo(0.058, 0); glowShape.lineTo(0.058, 0.72); glowShape.lineTo(0.036, 0.72 + 0.016); glowShape.lineTo(0.036, 0);
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } },
    vertexShader: "varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: `varying float vY; uniform float uT;
      vec3 hsv(float h){ vec3 k = clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); return k; }
      void main(){ gl_FragColor = vec4(hsv(fract(vY*1.1 - uT*0.35))*1.15 + 0.15, 1.); }`,
  });
  const glow = new THREE.Mesh(new THREE.ExtrudeGeometry(glowShape, { depth: 0.036, bevelEnabled: false }), glowMat);
  glow.geometry.translate(0, 0, -0.018);
  glow.position.y = 0.06;
  root.add(glow);
  // 칼날을 감싸는 은은한 빛 (가산 혼합)
  const aura = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.95),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: glowMat.uniforms.uT },
      vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
      fragmentShader: `varying vec2 vUv; uniform float uT;
        void main(){ float d = abs(vUv.x-0.5)*2.; float a = pow(max(0.,1.-d),3.)*0.55*(0.85+0.15*sin(uT*9.)); gl_FragColor = vec4(1.,0.55,0.2,1.)*a; }`,
    })
  );
  aura.position.set(0.02, 0.45, 0.0);
  root.add(aura);

  // 붉은 가드 (육각 판)
  const gs = new THREE.Shape();
  const gw = 0.2, gh = 0.07;
  gs.moveTo(-gw, 0); gs.lineTo(-gw + 0.05, gh); gs.lineTo(gw - 0.05, gh); gs.lineTo(gw, 0); gs.lineTo(gw - 0.05, -gh); gs.lineTo(-gw + 0.05, -gh); gs.lineTo(-gw, 0);
  const guard = new THREE.Mesh(
    new THREE.ExtrudeGeometry(gs, { depth: 0.07, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 }),
    std(0xd9232d, { roughness: 0.35, metalness: 0.45 })
  );
  guard.geometry.translate(0, 0, -0.035);
  guard.position.y = 0.04;
  root.add(guard);
  const guardCore = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.09, 20), std(0x111114, { metalness: 0.8, roughness: 0.3 }));
  guardCore.position.set(0, 0.07, 0.0);
  root.add(guardCore);

  // 손잡이 (검정 + 붉은 포인트)
  const handle = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.36, 0.06, 3, 0.02), std(0x1b1b20, { roughness: 0.5, metalness: 0.4 }));
  handle.position.y = -0.16;
  root.add(handle);
  for (const y of [-0.08, -0.16, -0.24]) {
    const st = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.025, 0.065, 2, 0.008), std(0xd9232d, { roughness: 0.4 }));
    st.position.y = y;
    root.add(st);
  }
  const pommel = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.07, 0.085, 3, 0.02), std(0xd9232d, { roughness: 0.35, metalness: 0.4 }));
  pommel.position.y = -0.37;
  root.add(pommel);

  root.userData.glowMat = glowMat;
  root.userData.height = 1.0;
  root.userData.base = -0.4; // 가장 아래 y
  return root;
}
