/* The board: slab, tiles, burrow tunnels, holes, clue chips, wooden blocks.
   Cell (r,c) sits at world (axis(c), 0, axis(r)); the playfield surface — what
   the geckos walk on — is y = 0, and everything else hangs below it. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { THEME } from './theme.js';

export const axis = (i, n) => i + 1.5 - (n + 1) / 2;
export const boardSpan = n => n + 1 + 2 * THEME.slabMargin;

const RING_SEGS = 48;
const col = hex => new THREE.Color(hex);   // Color() already maps sRGB -> working space
const mix = (a, b, t) => col(a).lerp(col(b), t);

function stdMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.62, metalness: 0.0, ...opts,
  });
}

/* ---------- flat stroked ribbon along a burrow path ----------
   Built in the XY plane with plain counter-clockwise winding and then laid flat,
   which is the only way to be sure every triangle ends up facing the sky. A mixed
   winding here renders half the ribbon as back faces with inverted normals — it
   looks like mould growing on the board. */
function tunnelGeometry(path, n) {
  const w = THEME.tunnelW / 2;
  const v = [];
  const tri = (a, b, c) => v.push(a[0], a[1], 0, b[0], b[1], 0, c[0], c[1], 0);
  // 2D y is -worldZ, so that rotateX(-90) puts it back where it belongs
  const P = path.map(([r, c]) => [axis(c, n), -axis(r, n)]);

  const disc = (p, r) => {
    const N = 22;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
      tri(p, [p[0] + Math.cos(a0) * r, p[1] + Math.sin(a0) * r],
             [p[0] + Math.cos(a1) * r, p[1] + Math.sin(a1) * r]);
    }
  };
  const bar = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    if (L < 1e-4) return;
    const nx = (-dy / L) * w, ny = (dx / L) * w;
    const p1 = [a[0] - nx, a[1] - ny], p2 = [b[0] - nx, b[1] - ny];
    const p3 = [b[0] + nx, b[1] + ny], p4 = [a[0] + nx, a[1] + ny];
    tri(p1, p2, p3); tri(p1, p3, p4);
  };

  for (let k = 1; k < P.length; k++) disc(P[k], w);   // round join at every bend
  for (let k = 0; k < P.length - 1; k++) {
    let a = P[k];
    if (k === 0) {                                    // start at the hole's rim
      const dx = P[1][0] - a[0], dy = P[1][1] - a[1], L = Math.hypot(dx, dy);
      a = [a[0] + (dx / L) * THEME.holeR, a[1] + (dy / L) * THEME.holeR];
    }
    bar(a, P[k + 1]);
  }
  if (P.length > 1) {                                 // the mouth the head pokes from
    const a = P[P.length - 1], b = P[P.length - 2];
    const dx = a[0] - b[0], dy = a[1] - b[1], L = Math.hypot(dx, dy);
    const e = 0.5 - THEME.tunnelW / 2;
    const tip = [a[0] + (dx / L) * e, a[1] + (dy / L) * e];
    bar(a, tip); disc(tip, w);
  } else {
    disc(P[0], w);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/* ---------- the board slab, with a well cut for every burrow ---------- */
function roundedRectShape(half, radius) {
  const s = half, r = radius, sh = new THREE.Shape();
  sh.moveTo(-s + r, -s);
  sh.lineTo(s - r, -s); sh.quadraticCurveTo(s, -s, s, -s + r);
  sh.lineTo(s, s - r);  sh.quadraticCurveTo(s, s, s - r, s);
  sh.lineTo(-s + r, s); sh.quadraticCurveTo(-s, s, -s, s - r);
  sh.lineTo(-s, -s + r); sh.quadraticCurveTo(-s, -s, -s + r, -s);
  return sh;
}

function slabGeometry(span, wells) {
  const sh = roundedRectShape(span / 2, THEME.slabRadius);
  for (const [x, z] of wells) {
    sh.holes.push(new THREE.Path().absarc(x, -z, THEME.holeR, 0, Math.PI * 2, true));
  }
  const bevel = 0.05;
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: THEME.slabH, bevelEnabled: true, bevelSize: bevel,
    bevelThickness: bevel, bevelSegments: 1, curveSegments: 18,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -(THEME.slabH + bevel) - 0.10, 0);   // top face lands at y = -0.10
  return g;
}

/* ---------- a tile with a burrow mouth cut out of it ---------- */
function holedTileGeometry() {
  const sh = roundedRectShape(THEME.tileSize / 2, THEME.tileRadius);
  sh.holes.push(new THREE.Path().absarc(0, 0, THEME.holeR, 0, Math.PI * 2, true));
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: THEME.tileH, bevelEnabled: true, bevelSize: 0.02,
    bevelThickness: 0.02, bevelSegments: 1, curveSegments: 20,
  });
  g.rotateX(-Math.PI / 2);       // shape plane XY -> XZ, extrusion runs +Y
  g.translate(0, -THEME.tileH - 0.02, 0);
  return g;
}

export class Board {
  constructor(stage) {
    this.stage = stage;
    this.owned = [];
    this.group = new THREE.Group();
    stage.root.add(this.group);
    this.chipCanvas = new Map();

    this.geo = {
      tile: new RoundedBoxGeometry(THEME.tileSize, THEME.tileH, THEME.tileSize, 2, THEME.tileRadius),
      holed: holedTileGeometry(),
      chip: new RoundedBoxGeometry(THEME.chipSize, THEME.chipH, THEME.chipSize, 2, THEME.chipRadius),
      block: new RoundedBoxGeometry(THEME.blockSize, THEME.blockH, THEME.blockSize, 2, 0.07),
      pip: new THREE.CylinderGeometry(0.055, 0.055, 0.02, 10),
      wall: new THREE.CylinderGeometry(THEME.holeR + 0.006, THEME.holeR * 0.8, THEME.holeDepth, 22, 1, true),
      floor: new THREE.CircleGeometry(THEME.holeR * 0.86, 22),
      rim: new THREE.TorusGeometry(THEME.holeR + THEME.holeRimR * 0.45, THEME.holeRimR, 6, 26),
      plate: new THREE.PlaneGeometry(THEME.chipSize * 0.98, THEME.chipSize * 0.98),
      ring: new THREE.RingGeometry(0.30, 0.38, RING_SEGS, 1, Math.PI / 2, -Math.PI * 2),
    };
    this.mat = {
      tile: stdMat(col(THEME.tile)),
      tileAlt: stdMat(col(THEME.tileAlt)),
      tileSolved: stdMat(col(THEME.tileSolved)),
      frame: stdMat(col(THEME.frame), { roughness: 0.7 }),
      chip: stdMat(col(THEME.chip), { roughness: 0.5 }),
      hole: stdMat(col(THEME.hole), { roughness: 0.95, side: THREE.DoubleSide }),
      holeDeep: stdMat(col(THEME.holeDeep), { roughness: 1 }),
      block: stdMat(col(THEME.block), { roughness: 0.8 }),
      pip: stdMat(col(THEME.dot), { roughness: 0.9 }),
      ring: new THREE.MeshBasicMaterial({ color: col(THEME.chipInk), transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
    };
  }

  /** Per-build geometries and materials are one-offs; the pools in this.geo /
      this.mat are shared and must survive. Track and free only the one-offs. */
  own(x) { this.owned.push(x); return x; }

  clear() {
    for (const o of this.owned || []) o.dispose();
    this.owned = [];
    this.group.clear();
    this.tiles = []; this.blocks = []; this.pips = [];
    this.chips = { rows: [], cols: [] };
    this.tunnels = [];
  }

  /** Rebuild every static piece for a freshly generated board. */
  build(S, colors) {
    this.clear();
    const n = S.n;
    this.n = n;
    const span = boardSpan(n);

    const wells = S.burrows.map(t => [axis(t[0][1], n), axis(t[0][0], n)]);
    const slab = new THREE.Mesh(this.own(slabGeometry(span, wells)), this.mat.frame);
    slab.receiveShadow = true;
    this.group.add(slab);

    // playfield tiles
    const holeCell = new Map();
    S.burrows.forEach((t, i) => holeCell.set(t[0][0] * n + t[0][1], i));
    for (let r = 0; r < n; r++) {
      this.tiles[r] = [];
      for (let c = 0; c < n; c++) {
        const gi = holeCell.get(r * n + c);
        const isHole = gi !== undefined;
        const m = new THREE.Mesh(isHole ? this.geo.holed : this.geo.tile,
          ((r + c) & 1) ? this.mat.tileAlt : this.mat.tile);
        m.position.set(axis(c, n), isHole ? 0 : -THEME.tileH / 2, axis(r, n));
        m.userData.isHole = isHole;
        m.receiveShadow = true; m.castShadow = !isHole;
        this.group.add(m);
        this.tiles[r][c] = { mesh: m, lift: 0, target: 0, solved: false };

        const block = new THREE.Mesh(this.geo.block, this.mat.block);
        block.position.set(axis(c, n), THEME.blockH / 2, axis(r, n));
        block.castShadow = true; block.visible = false;
        block.userData.drop = 0;
        this.group.add(block);
        this.blocks.push(block);
        this.tiles[r][c].block = block;

        const pip = new THREE.Mesh(this.geo.pip, this.mat.pip);
        pip.position.set(axis(c, n), 0.02, axis(r, n));
        pip.visible = false;
        this.group.add(pip);
        this.tiles[r][c].pip = pip;
      }
    }

    // burrow tunnels + holes, tinted with their gecko's colour
    S.burrows.forEach((path, i) => {
      const gc = colors[i];
      const tun = new THREE.Mesh(this.own(tunnelGeometry(path, n)),
        this.own(stdMat(mix(THEME.tile, gc, THEME.tunnelTint), { roughness: 0.72 })));
      tun.position.y = THEME.tunnelLift;
      this.group.add(tun);
      this.tunnels.push(tun);

      const [hr, hc] = path[0];
      const x = axis(hc, n), z = axis(hr, n);
      const wall = new THREE.Mesh(this.geo.wall, this.mat.hole);
      wall.position.set(x, -THEME.holeDepth / 2, z);
      this.group.add(wall);
      const floor = new THREE.Mesh(this.geo.floor, this.mat.holeDeep);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(x, -THEME.holeDepth, z);
      this.group.add(floor);
      const rim = new THREE.Mesh(this.geo.rim, this.own(stdMat(col(gc), { roughness: 0.42 })));
      rim.rotation.x = Math.PI / 2;
      rim.position.set(x, -0.01, z);
      rim.castShadow = true;
      this.group.add(rim);
    });

    // clue chips in the gutter
    const mkChip = (x, z, key) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(this.geo.chip, this.mat.chip);
      body.castShadow = true; body.receiveShadow = true;
      body.position.y = -THEME.chipH / 2 + 0.03;
      const cvs = document.createElement('canvas');
      cvs.width = cvs.height = 128;
      const tex = new THREE.CanvasTexture(cvs);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const face = new THREE.Mesh(this.geo.plate, this.own(
        new THREE.MeshStandardMaterial({ map: this.own(tex), roughness: 0.55, transparent: true })));
      face.rotation.x = -Math.PI / 2;
      face.position.y = 0.032;
      g.add(body, face);
      g.position.set(x, 0, z);
      this.group.add(g);
      const chip = { group: g, cvs, ctx: cvs.getContext('2d'), tex, last: null, pop: 0 };
      this.chipCanvas.set(key, chip);
      return chip;
    };
    for (let c = 0; c < n; c++) this.chips.cols[c] = mkChip(axis(c, n), axis(-1, n), 'c' + c);
    for (let r = 0; r < n; r++) this.chips.rows[r] = mkChip(axis(-1, n), axis(r, n), 'r' + r);

    this.holdRing = new THREE.Mesh(this.geo.ring, this.mat.ring);
    this.holdRing.rotation.x = -Math.PI / 2;
    this.holdRing.position.y = 0.05;
    this.holdRing.visible = false;
    this.group.add(this.holdRing);

    this.stage.frame(span);
  }

  /* ---------- per-frame / on-change refresh ---------- */

  drawChip(chip, cur, clue, done, live) {
    const key = `${cur}|${clue}|${done}|${live}`;
    if (chip.last === key) return;
    chip.last = key;
    const g = chip.ctx, S = 128;
    const over = cur > clue;
    g.clearRect(0, 0, S, S);
    g.fillStyle = done ? THEME.chipDone : over ? THEME.chipOver : THEME.chip;
    const r = 30;
    g.beginPath(); g.moveTo(r, 0);
    g.arcTo(S, 0, S, S, r); g.arcTo(S, S, 0, S, r);
    g.arcTo(0, S, 0, 0, r); g.arcTo(0, 0, S, 0, r);
    g.closePath(); g.fill();
    const fg = (done || over) ? '#FFFFFF' : THEME.chipInk;
    if (done && live) {
      g.strokeStyle = fg; g.lineWidth = 13; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(34, 66); g.lineTo(54, 88); g.lineTo(96, 42); g.stroke();
    } else {
      g.fillStyle = fg;
      g.font = "700 74px Fredoka, system-ui, sans-serif";
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(live ? clue - cur : clue), S / 2, S / 2 + 4);
    }
    chip.tex.needsUpdate = true;
  }

  update(S, counts, opt, dt, now) {
    const n = S.n;
    const rowDone = counts.rows.map((v, i) => v === S.clues.rows[i]);
    const colDone = counts.cols.map((v, i) => v === S.clues.cols[i]);
    for (let c = 0; c < n; c++)
      this.drawChip(this.chips.cols[c], counts.cols[c], S.clues.cols[c], colDone[c], opt.count);
    for (let r = 0; r < n; r++)
      this.drawChip(this.chips.rows[r], counts.rows[r], S.clues.rows[r], rowDone[r], opt.count);

    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const t = this.tiles[r][c];
      const solved = opt.dim && rowDone[r] && colDone[c];
      if (solved !== t.solved) {
        t.solved = solved;
        if (!t.mesh.userData.isHole) {
          t.mesh.material = solved ? this.mat.tileSolved
            : ((r + c) & 1) ? this.mat.tileAlt : this.mat.tile;
        }
        t.target = solved ? 0.055 : 0;
      }
      if (Math.abs(t.lift - t.target) > 1e-4) {
        t.lift += (t.target - t.lift) * Math.min(1, dt * 9);
        t.mesh.position.y = (t.mesh.userData.isHole ? 0 : -THEME.tileH / 2) + t.lift;
      }
      // wooden block drop-in
      const b = t.block;
      if (b.visible) {
        b.userData.drop = Math.min(1, b.userData.drop + dt * 5.5);
        const k = b.userData.drop;
        const e = 1 - Math.pow(1 - k, 3);
        b.position.y = THEME.blockH / 2 + (1 - e) * 1.2;
        const sq = 1 + Math.sin(k * Math.PI) * 0.12 * (1 - k);
        b.scale.set(sq, 2 - sq, sq);
      }
    }
    return { rowDone, colDone };
  }

  setBlocked(S, blocked, showPips) {
    const n = S.n;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      this.tiles[r][c].block.visible = false;
      this.tiles[r][c].pip.visible = false;
    }
    S.burrows.forEach((t, i) => {
      for (let k = S.cap[i]; k < t.length; k++) {
        const cell = this.tiles[t[k][0]][t[k][1]];
        if (!cell.block.visible) { cell.block.visible = true; cell.block.userData.drop = 0; }
      }
      if (!showPips) return;
      for (let k = blocked[i]; k < Math.min(t.length, S.cap[i]); k++)
        this.tiles[t[k][0]][t[k][1]].pip.visible = true;
    });
  }

  setHold(cell, progress, n) {
    if (!cell) { this.holdRing.visible = false; return; }
    this.holdRing.visible = true;
    this.holdRing.position.set(axis(cell[1], n), 0.05, axis(cell[0], n));
    // one ring, revealed a segment at a time — no per-frame geometry churn
    this.holdRing.geometry.setDrawRange(0, Math.ceil(progress * RING_SEGS) * 6);
  }
}
