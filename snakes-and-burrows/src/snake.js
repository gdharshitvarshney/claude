/* One snake: a thick tube swept along its burrow, with a Snake Pass-ish head —
   oversized blue eyes under a heavy brow, a cream muzzle, a wide smile, and a
   forked tongue it flicks out while it waits.

   The spine is a Catmull-Rom through the same control points the 2D prototype
   used for its track, with two extra points dropped inside the hole so the tail
   descends into the ground instead of being clipped. Control points are laid out
   two per cell, so level k always lands exactly on control index 2k + 1 —
   fractional levels interpolate between them, which is what makes the slide
   continuous.

   The last stretch of body arcs upward so the head lifts off the board and tilts
   back. Without that, a near-overhead camera only ever sees the top of the skull
   and none of the face. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { THEME, REDUCED } from './theme.js';
import { axis } from './board.js';

const RAD = 12;                 // radial segments around the body
const RINGS_PER_CELL = 13;
const PRE = 2;                  // control points buried inside the hole
const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _s = new THREE.Vector3();
const _u = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion(), _qi = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Bake a mesh's local transform into its geometry so parts sharing a material
    can collapse into one draw call. A board of snakes is hundreds of tiny
    meshes otherwise. */
function baked(geo, { pos, scale, rot } = {}) {
  const g = geo.clone();
  if (scale) g.scale(scale[0], scale[1], scale[2]);
  if (rot) { g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]); }
  if (pos) g.translate(pos[0], pos[1], pos[2]);
  return g;
}
const weld = parts => mergeGeometries(parts, false);

function trackPoints(path, n) {
  const C = path.map(([r, c]) => new THREE.Vector3(axis(c, n), 0, axis(r, n)));
  const L = C.length;
  const e = 0.5 - THEME.headR * 0.8;
  const pts = [];
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

export class Snake {
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
    this.tongueAt = 1.5 + seed * 5;
    this.tongueT = -1;
    this.cheerT = 0;
    this.level = 0;
    this.look = new THREE.Vector2();

    const base = new THREE.Color(locked ? THEME.locked : color);
    this.color = base;
    this.group = new THREE.Group();
    parent.add(this.group);

    /* ---- body tube ---- */
    this.maxRings = RINGS_PER_CELL * (this.L + 1) + 10;
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
    // pale underside, like the reference — a fixed function of the radial angle
    const belly = new THREE.Color(THEME.belly);
    for (let i = 0; i < this.maxRings; i++) {
      for (let j = 0; j <= RAD; j++) {
        const a = (j / RAD) * Math.PI * 2;
        const down = clamp(-Math.sin(a), 0, 1);
        const c = base.clone().lerp(belly, Math.pow(down, 1.6) * (locked ? 0.35 : 0.85));
        const o = (i * (RAD + 1) + j) * 3;
        colr[o] = c.r; colr[o + 1] = c.g; colr[o + 2] = c.b;
      }
    }
    this.bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34 });
    this.body = new THREE.Mesh(g, this.bodyMat);
    this.body.castShadow = true;
    this.body.frustumCulled = false;
    this.group.add(this.body);

    /* ---- head ---- */
    this.head = new THREE.Group();
    this.group.add(this.head);
    const skin = new THREE.MeshStandardMaterial({ color: base, roughness: 0.34 });
    const R = THEME.headR;

    // skull plus the two brow ridges that give it an expression
    this.head.add(Object.assign(new THREE.Mesh(weld([
      baked(new THREE.SphereGeometry(R, 22, 16), { scale: [0.98, 0.84, 1.26] }),
      baked(new THREE.SphereGeometry(THEME.browR, 14, 10),
        { scale: [1.45, 0.45, 1.35], pos: [-R * 0.55, R * 0.66, R * 0.14] }),
      baked(new THREE.SphereGeometry(THEME.browR, 14, 10),
        { scale: [1.45, 0.45, 1.35], pos: [R * 0.55, R * 0.66, R * 0.14] }),
    ]), skin), { castShadow: true }));

    // cream muzzle wrapping the snout and lower jaw
    const cream = new THREE.MeshStandardMaterial({ color: new THREE.Color(THEME.belly), roughness: 0.42 });
    this.head.add(new THREE.Mesh(weld([
      baked(new THREE.SphereGeometry(R * 0.78, 18, 12),
        { scale: [0.96, 0.72, 1.04], pos: [0, -R * 0.24, R * 0.52] }),
    ]), cream));

    // the smile: a dark slot at the front of the muzzle, plus a crease either side
    const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(THEME.mouth), roughness: 0.6 });
    const grin = Math.PI * 0.74;
    this.head.add(new THREE.Mesh(weld([
      baked(new THREE.SphereGeometry(R * 0.40, 16, 12),
        { scale: [1.15, 0.34, 0.42], pos: [0, -R * 0.36, R * 0.86] }),
      baked(new THREE.TorusGeometry(R * 0.42, R * 0.05, 6, 26, grin),
        { rot: [0, 0, Math.PI * 1.5 - grin / 2], pos: [0, -R * 0.06, R * 0.90] }),
    ]), dark));

    for (const sx of [-1, 1]) {
      const nz = new THREE.Mesh(new THREE.SphereGeometry(R * 0.05, 6, 5), dark);
      nz.position.set(sx * R * 0.17, R * 0.06, R * 1.05);
      this.head.add(nz);
    }

    /* ---- eyes: both always do the same thing, so each layer is one mesh ---- */
    const eR = THEME.eyeR;
    const gaze = new THREE.Vector3(0, 0.66, 0.75).normalize();   // up and forward
    const at = sx => [sx * R * THEME.eyeSpread, R * THEME.eyeRise, R * 0.40];
    const pair = (geo, off) => weld([-1, 1].map(sx => baked(geo, {
      pos: [at(sx)[0] + off[0] * sx, at(sx)[1] + off[1], at(sx)[2] + off[2]],
    })));
    const along = (d, extra = [0, 0, 0]) =>
      [gaze.x * d + extra[0], gaze.y * d + extra[1], gaze.z * d + extra[2]];

    this.balls = new THREE.Mesh(pair(new THREE.SphereGeometry(eR, 20, 16), [0, 0, 0]),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 }));
    this.balls.castShadow = true;
    this.iris = new THREE.Mesh(pair(new THREE.SphereGeometry(eR * 0.66, 16, 12), along(eR * 0.52)),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(THEME.iris), roughness: 0.18 }));
    this.pupils = new THREE.Mesh(pair(new THREE.SphereGeometry(eR * 0.36, 14, 10), along(eR * 0.78)),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(THEME.pupil), roughness: 0.2 }));
    this.sparks = new THREE.Mesh(
      pair(new THREE.SphereGeometry(eR * 0.17, 8, 6), along(eR * 0.86, [-eR * 0.30, eR * 0.16, 0])),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.head.add(this.balls, this.iris, this.pupils, this.sparks);

    // lids stay separate: each has to swing about its own eye
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const lid = new THREE.Mesh(
        new THREE.SphereGeometry(eR * 1.05, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), skin);
      lid.position.set(...at(sx));
      lid.rotation.x = -2.1;
      this.head.add(lid);
      this.eyes.push({ lid, sx });
    }

    /* ---- forked tongue ---- */
    const tongueMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(THEME.tongue), roughness: 0.45 });
    const tw = R * 0.075, tl = R * 0.62;
    this.tongue = new THREE.Mesh(weld([
      baked(new THREE.BoxGeometry(tw, tw * 0.6, tl), { pos: [0, 0, tl * 0.5] }),
      baked(new THREE.BoxGeometry(tw * 0.8, tw * 0.5, tl * 0.5),
        { rot: [0, 0.42, 0], pos: [-tl * 0.10, 0, tl * 1.10] }),
      baked(new THREE.BoxGeometry(tw * 0.8, tw * 0.5, tl * 0.5),
        { rot: [0, -0.42, 0], pos: [tl * 0.10, 0, tl * 1.10] }),
    ]), tongueMat);
    this.tongue.position.set(0, -R * 0.40, R * 0.92);
    this.tongue.visible = false;
    this.head.add(this.tongue);

    this.setVisible(false);
  }

  setVisible(v) { this.body.visible = v; this.head.visible = v; }

  idxOf(level) { return 2 * level + PRE - 1; }

  update(level, dt, time, lookTarget) {
    this.level = level;
    const iHead = this.idxOf(level);
    if (iHead <= PRE - 0.5) { this.setVisible(false); return; }
    this.setVisible(true);

    const tHead = clamp(iHead, 0, this.N - 1) / (this.N - 1);
    const cells = Math.max(0.35, level);
    const rings = clamp(Math.round(cells * RINGS_PER_CELL) + 6, 8, this.maxRings);

    const idle = REDUCED ? 0.25 : 1;
    const cheer = this.cheerT > 0 ? Math.sin(this.cheerT * 22) * Math.min(1, this.cheerT * 3) : 0;
    const sway = THEME.idleAmp * idle + Math.abs(cheer) * 0.05;
    const breath = 1 + Math.sin(time * THEME.breathSpeed + this.phase) * THEME.breathAmp * idle;
    // the head only rears up once there is enough body out to do it with
    const lift = THEME.headLift * Math.min(1, level / 1.3);
    const liftFrom = 1 - Math.min(0.92, THEME.headLiftRun / cells);

    if (!this._samples) this._samples = Array.from({ length: this.maxRings }, () => new THREE.Vector3());
    const P = this._samples;
    for (let i = 0; i < rings; i++) {
      this.curve.getPoint((i / (rings - 1)) * tHead, P[i]);
      P[i].y += lift * smooth(liftFrom, 1, i / (rings - 1));
    }

    const pos = this.pos, nrm = this.nrm;
    const prevSide = this._side || (this._side = new THREE.Vector3(1, 0, 0));
    for (let i = 0; i < rings; i++) {
      const u = i / (rings - 1);
      const a = P[Math.max(0, i - 1)], b = P[Math.min(rings - 1, i + 1)];
      _t.subVectors(b, a);
      if (_t.lengthSq() < 1e-9) _t.set(0, 0, 1);
      _t.normalize();
      _s.crossVectors(_t, UP);
      if (_s.lengthSq() < 1e-6) _s.copy(prevSide); else _s.normalize();
      prevSide.copy(_s);
      _u.crossVectors(_s, _t).normalize();

      // body wave: strongest mid-body, nothing at the head so it keeps its line
      const taper = Math.sin(Math.min(1, u * 1.35) * Math.PI);
      const wave = Math.sin(this.phase + time * THEME.idleSpeed - u * cells * THEME.idleWaves * 6.28)
                 * sway * taper * (this.locked ? 0.45 : 1);
      const grow = THEME.bodyTail + (1 - THEME.bodyTail) * Math.pow(Math.min(1, u / 0.5), 0.65);
      const neck = 1 - 0.22 * Math.max(0, (u - 0.84) / 0.16);
      const bump = 1 + THEME.scaleBump * Math.sin(u * cells * THEME.scaleFreq * 6.28);
      const r = THEME.bodyR * grow * neck * breath * bump;
      const ry = r * THEME.bodyFlat;

      const cx = P[i].x + _s.x * wave, cy = P[i].y + _s.y * wave, cz = P[i].z + _s.z * wave;
      for (let j = 0; j <= RAD; j++) {
        const ang = (j / RAD) * Math.PI * 2;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const o = (i * (RAD + 1) + j) * 3;
        pos[o] = cx + _s.x * ca * r + _u.x * sa * ry;
        pos[o + 1] = cy + _s.y * ca * r + _u.y * sa * ry + ry * 0.82;
        pos[o + 2] = cz + _s.z * ca * r + _u.z * sa * ry;
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
    const hp = P[rings - 1], ha = P[Math.max(0, rings - 3)];
    _t.subVectors(hp, ha);
    if (_t.lengthSq() < 1e-9) _t.set(0, 0, 1);
    _t.normalize();
    _s.crossVectors(_t, UP);
    if (_s.lengthSq() < 1e-6) _s.set(1, 0, 0); else _s.normalize();
    _u.crossVectors(_s, _t).normalize();
    _m.makeBasis(_s, _u, _t);
    _q.setFromRotationMatrix(_m);
    const bob = Math.sin(time * THEME.breathSpeed * 1.3 + this.phase) * 0.014 * idle
              + (this.cheerT > 0 ? Math.abs(Math.sin(this.cheerT * 12)) * 0.09 : 0);
    this.head.position.set(hp.x, hp.y + THEME.bodyR * 0.86 + bob, hp.z);
    const yaw = Math.sin(time * 0.7 + this.phase * 1.7) * 0.09 * idle
              + Math.sin(this.phase * 3.1) * 0.10;
    _q.multiply(_q2.setFromAxisAngle(UP, yaw));
    _q.multiply(_q2.setFromAxisAngle(RIGHT, -THEME.headPitch));
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
    this.iris.visible = shut < 0.85;

    /* ---- tongue flicks while it waits ---- */
    if (!this.locked && idle > 0.5) {
      if (this.tongueT >= 0) {
        this.tongueT += dt;
        const k = this.tongueT / THEME.tongueDur;
        if (k >= 1) {
          this.tongueT = -1;
          this.tongue.visible = false;
          this.tongueAt = time + lerp(THEME.tongueMin, THEME.tongueMax, Math.random());
        } else {
          // out, a couple of quick flicks, back in
          const ext = Math.sin(k * Math.PI) * (0.72 + 0.28 * Math.sin(k * 26));
          this.tongue.visible = true;
          this.tongue.scale.set(1, 1, Math.max(0.02, ext));
          this.tongue.rotation.y = Math.sin(k * 19) * 0.22 * ext;
          this.tongue.rotation.x = -0.12 + Math.sin(k * 13) * 0.1;
        }
      } else if (time >= this.tongueAt && shut < 0.3) {
        this.tongueT = 0;
      }
    }

    /* ---- eyes follow the finger, but only while it is actually dragging ---- */
    if (lookTarget && !this.locked) {
      _v.copy(lookTarget).sub(this.head.position);
      _qi.copy(_q).invert();
      const local = _v.applyQuaternion(_qi);
      const k = THEME.eyeR * 0.22;
      const tx = clamp(local.x * 0.5, -1, 1), ty = clamp(local.z * 0.5, -1, 1);
      this.look.x += (tx - this.look.x) * Math.min(1, dt * THEME.lookSpeed);
      this.look.y += (ty - this.look.y) * Math.min(1, dt * THEME.lookSpeed);
    } else {
      this.look.x += (0 - this.look.x) * Math.min(1, dt * 3);
      this.look.y += (0 - this.look.y) * Math.min(1, dt * 3);
    }
    const k = THEME.eyeR * 0.22;
    this.iris.position.set(this.look.x * k * 0.6, this.look.y * k * 0.4, 0);
    this.pupils.position.copy(this.iris.position);
    this.sparks.position.copy(this.iris.position);

    if (this.cheerT > 0) this.cheerT = Math.max(0, this.cheerT - dt);
  }

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
