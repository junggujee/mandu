// 360° 돌려보기 뷰어: 손가락(마우스) 드래그 = 회전, 두 손가락/휠 = 확대, 가만히 두면 자동 회전
import * as THREE from "three";
import { createSeal, createSword, applyEnvironment } from "./models.js";

export class Viewer360 {
  constructor(container) {
    this.el = container;
    this.yaw = 0.4; this.pitch = 0.25; this.vYaw = 0; this.dist = 1; this.idle = 0;
    this.pointers = new Map(); this.pinch0 = 0; this.dist0 = 1;
  }

  _init() {
    if (this.renderer) return;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
    r.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:none;";
    this.el.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.5));
    const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(1, 2, 2); this.scene.add(d);
    const b = new THREE.DirectionalLight(0xbfd8ff, 0.9); b.position.set(-2, 0.5, -2); this.scene.add(b);
    applyEnvironment(r, this.scene); // 금속 광택 반사
    this.pivot = new THREE.Group(); this.scene.add(this.pivot);

    const c = r.domElement;
    c.addEventListener("pointerdown", (e) => { c.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); this._pinchStart(); this.idle = 0; this.vYaw = 0; });
    c.addEventListener("pointermove", (e) => {
      const p = this.pointers.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (this.pointers.size === 1) {
        this.yaw += dx * 0.012; this.vYaw = dx * 0.012;
        this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch + dy * 0.01));
      } else if (this.pointers.size === 2) {
        const d = this._pinchDist(); if (this.pinch0) this.dist = Math.max(0.45, Math.min(2.5, this.dist0 * this.pinch0 / d));
      }
      this.idle = 0;
    });
    const up = (e) => { this.pointers.delete(e.pointerId); this._pinchStart(); };
    c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
    c.addEventListener("wheel", (e) => { e.preventDefault(); this.dist = Math.max(0.45, Math.min(2.5, this.dist * (1 + e.deltaY * 0.001))); }, { passive: false });
    addEventListener("resize", () => this._resize());
  }
  _pinchDist() { const [a, b] = [...this.pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; }
  _pinchStart() { if (this.pointers.size === 2) { this.pinch0 = this._pinchDist(); this.dist0 = this.dist; } else this.pinch0 = 0; }
  _resize() {
    if (!this.renderer) return;
    const w = this.el.clientWidth || innerWidth, h = this.el.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  open(kind) {
    this._init();
    this.pivot.clear();
    const model = kind === "sword" ? createSword() : createSeal();
    // 모델 중심을 원점으로
    // 크기 계산은 메시만(숨겨 둔 파티클 제외)
    const box = new THREE.Box3(); model.updateMatrixWorld(true);
    model.traverse((o) => { if (o.isMesh && o.material.blending !== THREE.AdditiveBlending) box.expandByObject(o); });
    const ctr = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    model.position.sub(ctr);
    this.pivot.add(model);
    this.model = model;
    this.size = Math.max(size.x, size.y, size.z);
    this.yaw = kind === "sword" ? 0.6 : 0.5; this.pitch = 0.2; this.dist = 1; this.vYaw = 0; this.idle = 0;
    this._resize();
    const clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
      this.idle += dt;
      if (this.pointers.size === 0) {
        this.yaw += this.vYaw; this.vYaw *= 0.92; // 관성
        if (this.idle > 2.5) this.yaw += dt * 0.6; // 자동 회전
      }
      if (model.userData.update) model.userData.update(dt, t); // 헤엄 / 불꽃 스파크
      // 화면(세로/가로) 어느 쪽이든 모델 전체가 들어오는 거리
      const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)), half = this.size / 2;
      const R = (Math.max(half / tanV, half / (tanV * this.camera.aspect)) * 1.15 + half * 0.5) * this.dist;
      this.camera.position.set(Math.sin(this.yaw) * Math.cos(this.pitch) * R, Math.sin(this.pitch) * R, Math.cos(this.yaw) * Math.cos(this.pitch) * R);
      this.camera.lookAt(0, 0, 0);
      this.renderer.render(this.scene, this.camera);
    });
  }

  close() { if (this.renderer) this.renderer.setAnimationLoop(null); }
}
