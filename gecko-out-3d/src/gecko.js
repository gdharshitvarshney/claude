/* One gecko: a tube swept along its burrow, a head with oversized blinking eyes,
   and four legs that step in time with how far it actually travelled.

   The spine is a Catmull-Rom through the same control points the 2D prototype
   used for its track, with two extra points dropped down inside the hole so the
   tail genuinely descends into the ground instead of being clipped. Because the
   control points are laid out two per cell, level k always lands exactly on
   control index 2k + 1 — fractional levels interpolate between them, which is
   what makes the slide continuous. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { THEME, REDUCED } from './theme.js';
import { axis } from './board.js';

const RAD = 10;                 // radial segments around the body
const RINGS_PER_CELL = 12;
const PRE = 2;                  // control points buried inside the hole
const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _s = new THREE.Vector3();
const _u = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

/** Bake a mesh's local transform into its geometry so several parts sharing one
    material can collapse into a single draw call. A board full of geckos is
    hundreds of tiny meshes otherwise. */
function baked(geo, { pos, scale, rot } = {}) {
  const g = geo.clone();
  if (scale) g.scale(scale[0], scale[1], scale[2]);
  if (rot) { g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]); }
  if (pos) g.translate(pos[0], pos[1], pos[2]);
  return g;
}
const weld = parts => mergeGeometries(parts, false);
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;

function trackPoints(path, n) {
  const C = path.map(([r, c]) => new THREE.Vector3(axis(c, n), 0, axis(r, n)));
  const L = C.length;
  const e = 0.5 - THEME.headR;
  const pts = [];
  // buried tail: two points down the burrow so the body rises out of the hole
  pts.push(new THREE.Vector3(C[0].x, -THEME.holeDepth * 0.72, C[0].z));
  pts.push(new THREE.Vector3(C[0].x, -THEME.holeDepth * 0.30, C[0].z));
  pts.push(C[0].clone());
  for (let k = 1; k <= L; k++) {
    const from = C[k - 1], to = k < L ? C[k] : null;
    const ax = to ? to.x - from.x : (L > 1 ? C[L - 1].x - C[L - 2].x : 1);
    const az = to ? to.z - from.z : (L > 1 ? C[L - 1].z - C[L - 2].z : 0);
    pts.push(new THREE.Vector3(from.x + Math.sign(ax) * e, 0, from.z + Math.sign(az) * e));
    if (to) pts.push(to.clone());
  }
  return pts;
}

export class Gecko {
  constructor(parent, path, n, color, locked, seed) {
    this.L = path.length;
    this.locked = locked;
    this.path = path;
    this.pts = trackPoints(path, n);
    this.curve = new THREE.CatmullRomCurve3(this.pts, false, 'centripetal', 0.5);
    this.N = this.pts.length;
    this.phase = seed * 6.28;
    this.blinkAt = 1 + seed * 4;
    this.blink = locked ? 0.62 : 0;
    this.blinkT = -1;
    this.travelled = 0;
    this.cheerT = 0;
    this.level = 0;
    this.look = new THREE.Vector2();

    const base = new THREE.Color(locked ? THEME.locked : color);
    this.color = base;
    this.group = new THREE.Group();
    parent.add(this.group);

    /* ---- body tube ---- */
    this.maxRings = RINGS_PER_CELL * (this.L + 1) + 8;
    const verts = this.maxRings * (RAD + 1);
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(verts * 3);
    this.nrm = new Float32Array(verts * 3);
    const colr = new Float32Array(verts * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    const idx = new Uint16Array((this.maxRings - 1) * RAD * 6);
    for (let i = 0, o = 0; i < this.maxRings - 1; i++) {
      for (let j = 0; j < RAD; j++) {
        const a = i * (RAD + 1) + j, b = a + RAD + 1;
        idx[o++] = a; idx[o++] = b; idx[o++] = a + 1;
        idx[o++] = a + 1; idx[o++] = b; idx[o++] = b + 1;
      }
    }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    // belly is a lighter tint of the back — a fixed function of the radial angle
    const belly = base.clone().lerp(new THREE.Color(0xffffff), THEME.geckoBelly);
    for (let i = 0; i < this.maxRings; i++) {
      for (let j = 0; j <= RAD; j++) {
        const a = (j / RAD) * Math.PI * 2;
        const down = clamp(-Math.sin(a), 0, 1);
        const c = base.clone().lerp(belly, down * down);
        const o = (i * (RAD + 1) + j) * 3;
        colr[o] = c.r; colr[o + 1] = c.g; colr[o + 2] = c.b;
      }
    }
    this.bodyMat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.38, metalness: 0.0,
    });
    this.body = new THREE.Mesh(g, this.bodyMat);
    this.body.castShadow = true;
    this.body.frustumCulled = false;
    this.group.add(this.body);

    /* ---- head ---- */
    this.head = new THREE.Group();
    this.group.add(this.head);
    const skin = new THREE.MeshStandardMaterial({ color: base, roughness: 0.38 });
    this.skin = skin;
    const R = THEME.headR;
    // skull + snout are one mesh: same material, and neither moves on its own
    const skull = new THREE.Mesh(weld([
      baked(new THREE.SphereGeometry(R, 20, 14), { scale: [1.0, 0.70, 1.22] }),
      baked(new THREE.SphereGeometry(R * 0.58, 14, 10),
        { scale: [0.92, 0.66, 0.92], pos: [0, -R * 0.10, R * 0.78] }),
    ]), skin);
    skull.castShadow = true;
    this.head.add(skull);

    const dark = new THREE.MeshStandardMaterial({ color: 0x241a20, roughness: 0.85 });
    // nostrils and a soft grin — barely visible from overhead, but they change the read
    const face = new THREE.Mesh(weld([
      baked(new THREE.SphereGeometry(R * 0.05, 6, 5), { pos: [-R * 0.15, R * 0.02, R * 1.18] }),
      baked(new THREE.SphereGeometry(R * 0.05, 6, 5), { pos: [R * 0.15, R * 0.02, R * 1.18] }),
      baked(new THREE.TorusGeometry(R * 0.26, R * 0.035, 5, 14, Math.PI * 0.9),
        { rot: [-Math.PI / 2.5, 0, Math.PI * 1.05], pos: [0, -R * 0.30, R * 0.92] }),
    ]), dark);
    this.head.add(face);

    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.12 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(THEME.pupil), roughness: 0.2 });
    const glint = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eR = THEME.eyeR;
    // both eyes always do the same thing, so each layer is one mesh spanning the pair
    const at = sx => [sx * R * THEME.eyeSpread, R * THEME.eyeRise, R * 0.28];
    const pair = (geo, off) => weld([-1, 1].map(sx => baked(geo, {
      pos: [at(sx)[0] + off(sx)[0], at(sx)[1] + off(sx)[1], at(sx)[2] + off(sx)[2]],
    })));

    this.balls = new THREE.Mesh(pair(new THREE.SphereGeometry(eR, 18, 14), () => [0, 0, 0]), white);
    this.balls.castShadow = true;
    // pupils ride high so the sclera still shows around them from this camera
    this.pupils = new THREE.Mesh(pair(new THREE.SphereGeometry(eR * 0.44, 12, 10),
      sx => [sx * eR * 0.10, eR * 0.66, eR * 0.44]), pupilMat);
    this.sparks = new THREE.Mesh(pair(new THREE.SphereGeometry(eR * 0.17, 8, 6),
      sx => [-sx * eR * 0.34, eR * 0.80, eR * 0.34]), glint);
    this.head.add(this.balls, this.pupils, this.sparks);

    // lids stay separate: each has to swing about its own eye
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const lid = new THREE.Mesh(
        new THREE.SphereGeometry(eR * 1.06, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), skin);
      lid.position.set(...at(sx));
      lid.rotation.x = -2.1;
      this.head.add(lid);
      this.eyes.push({ lid, sx });
    }

    /* ---- legs ---- */
    this.legs = [];
    const legMat = new THREE.MeshStandardMaterial({ color: base, roughness: 0.42 });
    this.legMat = legMat;
    for (let i = 0; i < 4; i++) {
      const g2 = new THREE.Group();
      if (!this.legGeo) {
        this.legGeo = weld([
          baked(new THREE.CapsuleGeometry(THEME.legR, THEME.legLen * 0.7, 2, 6),
            { rot: [0, 0, Math.PI / 2], pos: [THEME.legLen * 0.5, 0, 0] }),
          // a splayed little pad, gecko-style
          baked(new THREE.SphereGeometry(THEME.legR * 2.1, 10, 6),
            { scale: [1.2, 0.45, 1.5], pos: [THEME.legLen * 1.02, 0, 0] }),
        ]);
      }
      const limb = new THREE.Mesh(this.legGeo, legMat);
      limb.castShadow = true;
      g2.add(limb);
      g2.visible = false;
      this.group.add(g2);
      // front pair rides just behind the head, rear pair a cell and a bit back
      this.legs.push({ g: g2, side: i % 2 ? 1 : -1, back: i < 2 ? 0.9 : 2.7, ph: i < 2 ? 0 : Math.PI });
    }

    this.setVisible(false);
  }

  setVisible(v) {
    this.body.visible = v; this.head.visible = v;
    for (const l of this.legs) if (!v) l.g.visible = false;
  }

  /** world position of control index `i` (fractional allowed) */
  pointAt(i, out) { return this.curve.getPoint(clamp(i, 0, this.N - 1) / (this.N - 1), out); }

  /** level 0..L -> control index */
  idxOf(level) { return 2 * level + PRE - 1; }

  update(level, dt, time, lookTarget) {
    this.level = level;
    const iHead = this.idxOf(level);
    if (iHead <= PRE - 0.5) { this.setVisible(false); return; }   // still down the hole
    this.setVisible(true);

    const tHead = clamp(iHead, 0, this.N - 1) / (this.N - 1);
    const cells = Math.max(0.35, level);
    const rings = clamp(Math.round(cells * RINGS_PER_CELL) + 6, 8, this.maxRings);

    const idle = REDUCED ? 0.25 : 1;
    const cheer = this.cheerT > 0 ? Math.sin(this.cheerT * 22) * Math.min(1, this.cheerT * 3) : 0;
    const sway = (THEME.idleAmp * idle + Math.abs(cheer) * 0.05) ;
    const breath = 1 + Math.sin(time * THEME.breathSpeed + this.phase) * THEME.breathAmp * idle;

    // sample the spine once, then take tangents from the samples: no allocation
    if (!this._samples || this._samples.length < rings) {
      this._samples = Array.from({ length: this.maxRings }, () => new THREE.Vector3());
    }
    const P = this._samples;
    for (let i = 0; i < rings; i++) {
      this.curve.getPoint((i / (rings - 1)) * tHead, P[i]);
    }

    const pos = this.pos, nrm = this.nrm;
    let prevSide = null;
    for (let i = 0; i < rings; i++) {
      const u = i / (rings - 1);
      // tangent from neighbours
      const a = P[Math.max(0, i - 1)], b = P[Math.min(rings - 1, i + 1)];
      _t.subVectors(b, a);
      if (_t.lengthSq() < 1e-9) _t.set(0, 0, 1);
      _t.normalize();
      _s.crossVectors(_t, UP);
      if (_s.lengthSq() < 1e-6) { if (prevSide) _s.copy(prevSide); else _s.set(1, 0, 0); }
      _s.normalize();
      prevSide = prevSide || new THREE.Vector3();
      prevSide.copy(_s);
      _u.crossVectors(_s, _t).normalize();

      // body wave: strongest mid-body, nothing at the head so it keeps its line
      const taper = Math.sin(Math.min(1, u * 1.35) * Math.PI) ;
      const wave = Math.sin(this.phase + time * THEME.idleSpeed - u * cells * THEME.idleWaves * 6.28)
                 * sway * taper * (this.locked ? 0.45 : 1);
      const grow = THEME.bodyTail + (1 - THEME.bodyTail) * Math.pow(Math.min(1, u / 0.55), 0.7);
      const neck = 1 - 0.16 * Math.max(0, (u - 0.86) / 0.14);
      const r = THEME.bodyR * grow * neck * breath;
      const ry = r * THEME.bodyFlat;

      const cx = P[i].x + _s.x * wave, cy = P[i].y + _s.y * wave, cz = P[i].z + _s.z * wave;
      for (let j = 0; j <= RAD; j++) {
        const ang = (j / RAD) * Math.PI * 2;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const ox = _s.x * ca * r + _u.x * sa * ry;
        const oy = _s.y * ca * r + _u.y * sa * ry;
        const oz = _s.z * ca * r + _u.z * sa * ry;
        const o = (i * (RAD + 1) + j) * 3;
        pos[o] = cx + ox; pos[o + 1] = cy + oy + ry * 0.55; pos[o + 2] = cz + oz;
        // ellipse normal: scale the circle normal by the inverse radii
        const nx = _s.x * (ca / r) + _u.x * (sa / ry);
        const ny = _s.y * (ca / r) + _u.y * (sa / ry);
        const nz = _s.z * (ca / r) + _u.z * (sa / ry);
        const inv = 1 / Math.hypot(nx, ny, nz);
        nrm[o] = nx * inv; nrm[o + 1] = ny * inv; nrm[o + 2] = nz * inv;
      }
    }
    const geo = this.body.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    geo.setDrawRange(0, (rings - 1) * RAD * 6);

    /* ---- head ---- */
    const hp = P[rings - 1];
    const ha = P[Math.max(0, rings - 3)];
    _t.subVectors(hp, ha);
    if (_t.lengthSq() < 1e-9) _t.set(0, 0, 1);
    _t.normalize();
    _s.crossVectors(_t, UP);
    if (_s.lengthSq() < 1e-6) _s.set(1, 0, 0);
    _s.normalize();
    _u.crossVectors(_s, _t).normalize();
    _m.makeBasis(_s, _u, _t);
    _q.setFromRotationMatrix(_m);
    const bob = Math.sin(time * THEME.breathSpeed * 1.3 + this.phase) * 0.012 * idle
              + (this.cheerT > 0 ? Math.abs(Math.sin(this.cheerT * 12)) * 0.09 : 0);
    this.head.position.set(hp.x, hp.y + THEME.bodyR * 0.62 + bob, hp.z);
    // a slow look-around, plus a nod while cheering
    const yaw = Math.sin(time * 0.7 + this.phase * 1.7) * 0.10 * idle;
    _q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw));
    this.head.quaternion.copy(_q);

    /* ---- blinking ---- */
    if (!this.locked) {
      if (this.blinkT >= 0) {
        this.blinkT += dt;
        const half = THEME.blinkDur;
        this.blink = this.blinkT < half ? this.blinkT / half
                   : this.blinkT < half * 2 ? 1 - (this.blinkT - half) / half : 0;
        if (this.blinkT >= half * 2) {
          this.blinkT = -1; this.blink = 0;
          this.blinkAt = time + (this.double ? 0.16 : lerp(THEME.blinkMin, THEME.blinkMax, Math.random()));
          this.double = this.double ? false : Math.random() < 0.28;
        }
      } else if (time >= this.blinkAt) {
        this.blinkT = 0;
      }
    }
    const shut = this.locked ? 0.66 : this.blink;
    for (const e of this.eyes) e.lid.rotation.x = lerp(-2.1, 0.02, shut);
    this.sparks.visible = shut < 0.6;

    /* ---- pupils track the finger ---- */
    if (lookTarget && !this.locked) {
      _v.copy(lookTarget).sub(this.head.position);
      const local = _v.applyQuaternion(_q.clone().invert());
      const k = THEME.eyeR * 0.30;
      const tx = clamp(local.x * 0.5, -1, 1), ty = clamp(local.z * 0.5, -1, 1);
      this.look.x += (tx - this.look.x) * Math.min(1, dt * THEME.lookSpeed);
      this.look.y += (ty - this.look.y) * Math.min(1, dt * THEME.lookSpeed);
      // the resting offsets are baked in; this is the look-around delta on top
      this.pupils.position.set(this.look.x * k, this.look.y * k * 0.35, 0);
    }

    /* ---- legs ---- */
    const stride = this.travelled * THEME.stepPerCell * 6.28;
    for (const leg of this.legs) {
      const iLeg = iHead - leg.back;
      if (iLeg < PRE + 0.6) { leg.g.visible = false; continue; }
      leg.g.visible = true;
      this.pointAt(iLeg, _v);
      this.pointAt(iLeg + 0.25, _t).sub(_v);
      if (_t.lengthSq() < 1e-9) _t.set(0, 0, 1);
      _t.normalize();
      _s.crossVectors(_t, UP).normalize();
      _u.crossVectors(_s, _t).normalize();
      _m.makeBasis(_s, _u, _t);
      const swing = Math.sin(stride + leg.ph + (leg.side > 0 ? Math.PI : 0));
      const lift = Math.max(0, Math.sin(stride + leg.ph + (leg.side > 0 ? Math.PI : 0)));
      leg.g.position.set(
        _v.x + _s.x * leg.side * THEME.bodyR * 0.85,
        _v.y + THEME.bodyR * 0.16 + lift * THEME.stepLift,
        _v.z + _s.z * leg.side * THEME.bodyR * 0.85);
      leg.g.quaternion.setFromRotationMatrix(_m);
      leg.g.rotateY(leg.side > 0 ? -Math.PI / 2 : Math.PI / 2);
      leg.g.rotateY(swing * 0.42 * (leg.side > 0 ? -1 : 1));
      leg.g.rotateZ(-0.34);
    }

    if (this.cheerT > 0) this.cheerT = Math.max(0, this.cheerT - dt);
  }

  /** distance travelled feeds the leg cycle, so legs stop when the gecko stops */
  advance(delta) { this.travelled += Math.abs(delta); }
  cheer(t = 0.9) { this.cheerT = t; }

  dispose() {
    const seen = new Set();
    this.group.traverse(o => {
      if (!o.isMesh) return;
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      for (const m of [].concat(o.material)) if (m && !seen.has(m)) { seen.add(m); m.dispose(); }
    });
    this.group.parent?.remove(this.group);
  }
}
