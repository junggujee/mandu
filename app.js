import * as THREE from "three";
import { MindARThree } from "./lib/mindar-image-three.prod.js";
import { CONFIG } from "./config.js";
import { createSeal, createSword } from "./models.js";

const $ = (s) => document.querySelector(s);
const ui = { start: $("#start"), startBtn: $("#startBtn"), err: $("#err"), scan: $("#scan"), frame: $("#frame"),
  msg: $("#msg"), letterBtn: $("#letterBtn"), letter: $("#letter"), paper: $("#paper"), again: $("#again"), flash: $("#flash") };

// ───────── 소리 (WebAudio 합성, 파일 없음) ─────────
let actx = null;
const initAudio = () => { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (e) {} };
function tone(freq, t0, dur, type = "triangle", vol = 0.18) {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, actx.currentTime + t0);
  g.gain.setValueAtTime(0.0001, actx.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(vol, actx.currentTime + t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + t0 + dur);
  o.connect(g).connect(actx.destination); o.start(actx.currentTime + t0); o.stop(actx.currentTime + t0 + dur + 0.05);
}
function boom() {
  if (!actx) return;
  const len = actx.sampleRate * 0.5, buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
  s.buffer = buf; f.type = "lowpass"; f.frequency.value = 1800; g.gain.value = 0.5;
  s.connect(f).connect(g).connect(actx.destination); s.start();
  const o = actx.createOscillator(), og = actx.createGain();
  o.frequency.setValueAtTime(180, actx.currentTime); o.frequency.exponentialRampToValueAtTime(40, actx.currentTime + 0.4);
  og.gain.setValueAtTime(0.4, actx.currentTime); og.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.4);
  o.connect(og).connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.45);
}
function pop() { // 통!
  tone(300, 0, 0.12, "sine", 0.3); tone(600, 0.04, 0.12, "sine", 0.2);
}
function birthdayTune() { // 생일 축하 노래 첫 소절 (도도레도파미)
  const n = [[262, 0, .22], [262, .25, .22], [294, .5, .45], [262, .95, .45], [349, 1.4, .45], [330, 1.85, .8],
             [262, 2.9, .22], [262, 3.15, .22], [294, 3.4, .45], [262, 3.85, .45], [392, 4.3, .45], [349, 4.75, .8]];
  n.forEach(([f, t, d]) => { tone(f, t, d, "triangle", 0.2); tone(f * 2, t, d, "sine", 0.05); });
}

// ───────── 파티클 ─────────
const spriteTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.3, "rgba(255,255,255,.8)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

// 반짝이 폭죽 (구 모양으로 퍼짐) — 앵커 좌표계(Z가 위)
class Sparks {
  constructor(parent, n = 140) {
    this.n = n; this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.07, map: spriteTex, vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false;
    parent.add(this.points);
    this.cursor = 0;
  }
  burst(center, color, count = 70, speed = 0.9) {
    for (let k = 0; k < count; k++) {
      const i = this.cursor++ % this.n, a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1), s = speed * (0.5 + Math.random() * 0.6);
      this.pos.set([center.x, center.y, center.z], i * 3);
      this.vel.set([Math.sin(b) * Math.cos(a) * s, Math.sin(b) * Math.sin(a) * s, Math.cos(b) * s], i * 3);
      const c = new THREE.Color(color).offsetHSL((Math.random() - 0.5) * 0.08, 0, 0);
      this.col.set([c.r, c.g, c.b], i * 3); this.life[i] = 1 + Math.random() * 0.6;
    }
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.pos[i * 3 + 2] = -99; continue; }
      this.life[i] -= dt;
      this.vel[i * 3 + 2] -= 0.9 * dt;
      for (let k = 0; k < 3; k++) this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt;
      for (let k = 0; k < 3; k++) this.vel[i * 3 + k] *= 1 - 0.8 * dt;
      const f = Math.min(1, this.life[i]);
      this.col[i * 3] *= 0.5 + 0.5 * f; this.col[i * 3 + 1] *= 0.5 + 0.5 * f; this.col[i * 3 + 2] *= 0.5 + 0.5 * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

// 색종이 (회전하며 떨어짐)
class Confetti {
  constructor(parent, n = 160) {
    this.n = n;
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.035, 0.05), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), n);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.p = [...Array(n)].map(() => ({ pos: new THREE.Vector3(0, 0, -99), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), life: 0 }));
    const cols = [0xff5d73, 0xffd54a, 0x5dd6ff, 0x7dff8a, 0xc58bff, 0xff9d4a];
    for (let i = 0; i < n; i++) this.mesh.setColorAt(i, new THREE.Color(cols[i % cols.length]));
    this.mesh.instanceColor.needsUpdate = true;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.one = new THREE.Vector3(1, 1, 1);
    parent.add(this.mesh); this.cursor = 0;
    this.update(0);
  }
  burst(center, count = 90) {
    for (let k = 0; k < count; k++) {
      const p = this.p[this.cursor++ % this.n], a = Math.random() * Math.PI * 2, s = 0.25 + Math.random() * 0.55;
      p.pos.copy(center); p.vel.set(Math.cos(a) * s, Math.sin(a) * s, 0.6 + Math.random() * 0.9);
      p.spin.set(Math.random() * 8, Math.random() * 8, Math.random() * 8); p.life = 3.2 + Math.random();
    }
  }
  update(dt) {
    this.p.forEach((p, i) => {
      if (p.life > 0) {
        p.life -= dt; p.vel.z -= 1.4 * dt; p.vel.multiplyScalar(1 - 0.9 * dt); p.vel.z = Math.max(p.vel.z, -0.35);
        p.pos.addScaledVector(p.vel, dt); p.rot.x += p.spin.x * dt; p.rot.y += p.spin.y * dt; p.rot.z += p.spin.z * dt;
        if (p.pos.z < 0) { p.life = 0; }
      }
      const vis = p.life > 0;
      this.q.setFromEuler(p.rot);
      this.m.compose(vis ? p.pos : new THREE.Vector3(0, 0, -99), this.q, vis ? this.one : new THREE.Vector3(0, 0, 0));
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// 검에서 튀는 불똥 (검 좌표계, 계속 생성)
class Embers {
  constructor(parent, n = 90) {
    this.n = n; this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.life = new Float32Array(n);
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.045, map: spriteTex, color: 0xff8a2b, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.pts.frustumCulled = false; parent.add(this.pts);
    for (let i = 0; i < n; i++) this.life[i] = 0, this.pos[i * 3 + 1] = -99;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.life[i] = 0.4 + Math.random() * 0.6;
        this.pos.set([(Math.random() - 0.5) * 0.3, 0.06, (Math.random() - 0.5) * 0.06], i * 3);
        const a = Math.random() * Math.PI * 2, s = 0.3 + Math.random() * 0.5;
        this.vel.set([Math.cos(a) * s, 0.2 + Math.random() * 0.5, Math.sin(a) * s * 0.6], i * 3);
      }
      this.vel[i * 3 + 1] -= 1.2 * dt;
      for (let k = 0; k < 3; k++) this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt;
    }
    this.pts.geometry.attributes.position.needsUpdate = true;
  }
}

// ───────── 3D 장면 ─────────
const easeOutBack = (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

async function start() {
  initAudio();
  ui.startBtn.disabled = true; ui.err.textContent = "카메라 준비 중…";
  const mindar = new MindARThree({
    container: $("#ar"), imageTargetSrc: CONFIG.mindFile,
    uiLoading: "no", uiScanning: "no", uiError: "no",
    maxTrack: 2, filterMinCF: 0.0005, filterBeta: 300, missTolerance: 8, warmupTolerance: 4,
  });
  const { renderer, scene, camera } = mindar;
  
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(0.5, -1, 2); scene.add(sun);

  const kids = CONFIG.kids.map((k) => {
    const anchor = mindar.addAnchor(k.targetIndex);
    const gift = new THREE.Group();
    const model = k.gift === "sword" ? createSword() : createSeal();
    const spin = new THREE.Group(); spin.add(model); gift.add(spin);
    // 물범: 얼굴이 카메라(그림 아래쪽·위쪽)를 보도록 살짝 뒤로 기댐
    // 검: 그림 속 검처럼 칼날이 그림 위쪽을 향하고, 종이에서 비스듬히 떠오름
    gift.rotation.x = k.gift === "sword" ? 0.55 : Math.PI / 2 - 0.85;
    anchor.group.add(gift);
    gift.visible = false;
    // 마커 발광 판 + 링
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(1, k.aspect), new THREE.MeshBasicMaterial({ color: new THREE.Color(k.accent), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    anchor.group.add(flash);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.4, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    anchor.group.add(ring);
    const light = new THREE.PointLight(k.gift === "sword" ? 0xff7a2a : 0xaee6ff, 0, 2); light.position.set(0, -0.3, 0.6); anchor.group.add(light);
    const sparks = new Sparks(anchor.group), confetti = new Confetti(anchor.group);
    const embers = k.gift === "sword" ? new Embers(model) : null;
    const s = { k, anchor, gift, spin, model, flash, ring, light, sparks, confetti, embers, t: -1, revealed: false, visible: false, shown: 0, fired: new Set() };
    anchor.onTargetFound = () => onFound(s);
    anchor.onTargetLost = () => { s.visible = false; };
    return s;
  });
  let active = null;

  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { timers.splice(0).forEach(clearTimeout); };

  function setMessages(s, instant) {
    clearTimers(); ui.msg.innerHTML = ""; ui.letterBtn.classList.remove("show");
    ui.msg.style.setProperty("--c", s.k.accent);
    s.k.messages.forEach((m) => {
      const run = () => { const d = document.createElement("div"); d.className = "line " + (m.big ? "big" : "small") + (instant ? " now" : ""); d.textContent = m.text; ui.msg.appendChild(d); };
      instant ? run() : later(m.at * 1000, run);
    });
    instant ? ui.letterBtn.classList.add("show") : later(s.k.letterButtonAt * 1000, () => ui.letterBtn.classList.add("show"));
    ui.again.classList.add("show");
  }

  function reveal(s) {
    s.revealed = true; s.t = 0; s.fired.clear(); s.gift.scale.setScalar(0.0001);
    setMessages(s, false);
    // 소리
    later(100, () => { boom(); });
    later(650, () => { pop(); });
    later(900, () => { birthdayTune(); });
    ui.flash.style.transition = "none"; ui.flash.style.opacity = "0.55";
    requestAnimationFrame(() => { ui.flash.style.transition = "opacity .8s"; ui.flash.style.opacity = "0"; });
  }

  function onFound(s) {
    initAudio();
    s.visible = true; active = s;
    ui.scan.classList.add("hidden"); ui.frame.classList.add("hidden");
    if (!s.revealed) reveal(s); else setMessages(s, true);
  }

  ui.again.onclick = () => { if (active) reveal(active); };
  ui.letterBtn.onclick = () => {
    if (!active) return; const k = active.k;
    ui.paper.innerHTML = "";
    const h = document.createElement("h2"); h.textContent = k.letterTitle;
    const b = document.createElement("div"); b.className = "body"; b.textContent = k.letter;
    const hint = document.createElement("div"); hint.className = "hint"; hint.textContent = k.hint;
    const c = document.createElement("button"); c.textContent = "닫기"; c.onclick = () => ui.letter.classList.remove("show");
    ui.paper.append(h, b, hint, c); ui.letter.classList.add("show");
    tone(523, 0, 0.3, "sine", 0.2); tone(659, 0.12, 0.3, "sine", 0.2); tone(784, 0.24, 0.5, "sine", 0.2);
  };
  // 화면 탭 → 색종이 한 번 더
  $("#ar").addEventListener("pointerdown", () => {
    if (!active || !active.visible) return;
    const c = new THREE.Vector3(0, 0, 0.5); active.confetti.burst(c, 60); active.sparks.burst(c, 0xffd54a, 50); pop();
  });

  try {
    await mindar.start();
  } catch (e) {
    console.error(e);
    ui.startBtn.disabled = false;
    ui.err.textContent = location.protocol === "https:" || location.hostname === "localhost"
      ? "카메라를 켤 수 없어요.\n브라우저의 카메라 허용을 확인해 주세요."
      : "카메라는 https 주소에서만 켜져요.";
    return;
  }
  ui.start.classList.add("hidden"); ui.scan.classList.remove("hidden"); ui.frame.classList.remove("hidden");

  const clock = new THREE.Clock();
  const colors = [0xff5d73, 0xffd54a, 0x5dd6ff, 0x7dff8a, 0xc58bff];
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
    for (const s of kids) {
      s.sparks.update(dt); s.confetti.update(dt);
      if (s.model.userData.glowMat) s.model.userData.glowMat.uniforms.uT.value = time;
      if (s.embers) s.embers.update(dt);
      if (!s.revealed) continue;
      if (s.visible) s.t += dt;
      const t = Math.max(0, s.t);
      s.gift.visible = s.visible && t > 0.6;
      // 마커 발광 & 링
      const f = t < 1.2 ? Math.sin((t / 1.2) * Math.PI) : 0;
      s.flash.material.opacity = f * 0.6;
      const r = t < 1.4 ? t / 1.4 : 1; s.ring.scale.setScalar(0.3 + r * 1.6); s.ring.material.opacity = t < 1.4 ? (1 - r) * 0.9 : 0;
      s.light.intensity = (s.gift.visible ? 1.2 : 0) * (s.k.gift === "sword" ? 0.8 + 0.4 * Math.sin(time * 18) * Math.sin(time * 7) : 1);
      // 이벤트 (한 번만)
      const once = (name, at, fn) => { if (t >= at && !s.fired.has(name)) { s.fired.add(name); fn(); } };
      once("c", 0.65, () => { s.confetti.burst(new THREE.Vector3(0, 0, 0.35), 120); s.sparks.burst(new THREE.Vector3(0, 0, 0.45), colors[1], 90, 1.1); });
      once("s1", 1.1, () => s.sparks.burst(new THREE.Vector3(-0.35, 0, 0.7), colors[2], 70, 0.8));
      once("s2", 1.4, () => s.sparks.burst(new THREE.Vector3(0.35, 0, 0.75), colors[0], 70, 0.8));
      once("s3", 1.8, () => s.sparks.burst(new THREE.Vector3(0, 0, 0.95), colors[4], 80, 0.9));
      once("c2", 3.0, () => s.confetti.burst(new THREE.Vector3(0, 0, 0.6), 70));
      // 팝업 + 둥둥
      const pt = Math.min(1, Math.max(0, (t - 0.6) / 1.1));
      const sword = s.k.gift === "sword";
      s.gift.scale.setScalar(Math.max(0.0001, easeOutBack(pt) * (sword ? 0.68 : 0.42)));
      const lift = sword ? 0.28 : 0.16;
      s.gift.position.set(0, sword ? -0.05 : 0.05, lift * easeOutBack(pt) + 0.035 * Math.sin(time * 2.2) * pt);
      // 등장할 때 빙글빙글 돌다가, 이후엔 물범은 좌우로 흔들흔들 / 검은 칼날 축으로 천천히 회전
      s.spin.rotation.y = (1 - pt) * Math.PI * 4 + (sword ? (t - 0.6) * 0.9 : 0.45 * Math.sin(time * 0.9));
      if (s.k.gift === "seal") { s.model.rotation.z = 0.04 * Math.sin(time * 2.6); s.model.scale.set(1 + 0.02 * Math.sin(time * 4), 1 - 0.02 * Math.sin(time * 4), 1); }
      else s.model.rotation.z = 0.06 * Math.sin(time * 1.7);
    }
    renderer.render(scene, camera);
  });
}

ui.startBtn.addEventListener("click", start);
