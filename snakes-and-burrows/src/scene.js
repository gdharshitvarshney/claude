/* Renderer, camera framing and lighting.
   The camera sits nearly overhead, so almost none of the depth comes from the
   angle — it comes from the key light's shadows, the bevels and the eye
   highlights. That is why the light rig here is doing more work than usual. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { THEME } from './theme.js';

export class Stage {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    // ACES desaturates saturated colour hard; the neutral curve keeps neon neon
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;   // soft edges without the deprecated PCFSoft

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(THEME.fov, 1, 0.5, 120);
    this.root = new THREE.Group();
    this.scene.add(this.root);

    // soft studio reflections give the pieces their toy-plastic sheen
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.42;
    pmrem.dispose();

    const hemi = new THREE.HemisphereLight(0xf2f7ff, 0x9aa6b4, 0.62);
    this.scene.add(hemi);

    this.key = new THREE.DirectionalLight(0xfff4e0, 2.1);
    this.key.position.set(-4.5, 9, 5);
    this.key.castShadow = true;
    // shadows are ~60% of the frame here, so keep the map small and the blur cheap
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.bias = -0.0008;
    this.key.shadow.normalBias = 0.03;
    this.key.shadow.radius = 3.5;
    this.key.shadow.blurSamples = 8;
    this.scene.add(this.key, this.key.target);

    const fill = new THREE.DirectionalLight(0xbfe9ff, 0.45);
    fill.position.set(5, 4, -6);
    this.scene.add(fill);

    this.dist = 14;
    this.half = 4;
    this.tiltDeg = THEME.tiltDeg;
    this.yawDeg = THEME.yawDeg;
    this.zoom = THEME.zoom;
    this.tilt = THREE.MathUtils.degToRad(this.tiltDeg);
    this.yaw = THREE.MathUtils.degToRad(this.yawDeg);
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  /** Frame a board that spans `span` cells per side (grid + clue gutter + rim). */
  frame(span) {
    this.half = span / 2;
    const s = this.key.shadow.camera;
    const r = this.half + 2;
    s.left = -r; s.right = r; s.top = r; s.bottom = -r; s.near = 1; s.far = 30;
    s.updateProjectionMatrix();
    this.resize();
  }

  /** Player-facing camera controls: tilt off vertical, orbit, and zoom. */
  setView({ tilt, yaw, zoom }) {
    if (tilt != null) this.tiltDeg = tilt;
    if (yaw != null) this.yawDeg = yaw;
    if (zoom != null) this.zoom = zoom;
    this.tilt = THREE.MathUtils.degToRad(this.tiltDeg);
    this.yaw = THREE.MathUtils.degToRad(this.yawDeg);
    this.resize();
  }

  resize() {
    const el = this.renderer.domElement.parentElement;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;

    // fit the board in both axes; the tilt stretches what the camera must cover,
    // and an orbited square presents a wider silhouette than an axis-aligned one
    const tan = Math.tan(THREE.MathUtils.degToRad(THEME.fov) / 2);
    const spin = Math.abs(Math.cos(this.yaw)) + Math.abs(Math.sin(this.yaw));
    const need = this.half * spin;
    const dV = (need / Math.cos(this.tilt)) / tan;
    const dH = need / (tan * this.camera.aspect);
    this.dist = Math.max(dV, dH) * 1.02 / this.zoom;

    this.camera.updateProjectionMatrix();
    this.place();
  }

  /** The camera is fixed. It used to drift with the pointer, which made the
      whole board sway under the cursor — more distracting than dimensional. */
  place() {
    const d = this.dist, r = Math.sin(this.tilt) * d;
    this.camera.position.set(Math.sin(this.yaw) * r, Math.cos(this.tilt) * d, Math.cos(this.yaw) * r);
    this.camera.lookAt(0, 0, 0);
    this.key.target.position.set(0, 0, 0);
    this.key.target.updateMatrixWorld();
  }

  /** Where a pointer event lands on the board's top plane, in world space. */
  pick(ev, out = new THREE.Vector3()) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const nx = ((ev.clientX - r.left) / r.width) * 2 - 1;
    const ny = -((ev.clientY - r.top) / r.height) * 2 + 1;
    this.raycaster.setFromCamera({ x: nx, y: ny }, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.plane, out);
    return hit ? out : null;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
