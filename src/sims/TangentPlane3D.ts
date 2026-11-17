/**
 * The optional 3D view of lesson 5.3's figure (TangentPlane): the graph of f near a and the candidate plane
 * z = f(a) + J_f(a)h, both zoomed by 1/ρ in all three axes around (a, f(a)) (src/math/tangent.ts, "Zoom").
 *
 * This module imports three.js and the ink shader, so the island loads it only with a dynamic import(), after
 * webglAvailable() said yes and the reader asked for the 3D view. It renders into its own offscreen WebGL canvas,
 * on demand (no animation loop): the island draws that canvas into its 2D canvas, so the 2D figure keeps its
 * readouts, tasks and keyboard control, and still mode has nothing to stop.
 */

import * as THREE from 'three';
import { createInkMaterial, setInkColors, setInkPixelRatio } from '~/figures3d/ink';
import type { Palette } from './core/canvas';
import { mix } from './core/ink';
import { zoomedGraph, zoomedPlane, type Preset } from '~/math/tangent';

export interface View3D {
  preset: Preset;
  rho: number;
  /** CSS pixels */
  width: number;
  height: number;
  dpr: number;
  palette: Palette;
  /** orbit angles in radians */
  azimuth: number;
  elevation: number;
}

export interface Tangent3D {
  /** Render the scene and return the canvas holding the picture. */
  render(v: View3D): HTMLCanvasElement;
  dispose(): void;
}

/** Heights are clipped to |z| ≤ Z_CLIP in the zoomed picture (the caption says so). */
export const Z_CLIP = 2.5;
const RINGS = 40;
const SPOKES = 120;

/** A polar mesh over the unit disk with heights z(u₁, u₂); three.js is y-up, so (u₁, u₂, z) ↦ (u₁, z, −u₂). */
function diskGeometry(z: (u1: number, u2: number) => number): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const clip = (v: number) => (Number.isFinite(v) ? Math.max(-Z_CLIP, Math.min(Z_CLIP, v)) : 0);
  // the centre, then the rings
  pos.push(0, clip(z(0, 0)), 0);
  for (let i = 1; i <= RINGS; i++) {
    const r = i / RINGS;
    for (let j = 0; j < SPOKES; j++) {
      const t = (2 * Math.PI * j) / SPOKES;
      const u1 = r * Math.cos(t);
      const u2 = r * Math.sin(t);
      pos.push(u1, clip(z(u1, u2)), -u2);
    }
  }
  const at = (i: number, j: number) => 1 + (i - 1) * SPOKES + (((j % SPOKES) + SPOKES) % SPOKES);
  for (let j = 0; j < SPOKES; j++) idx.push(0, at(1, j), at(1, j + 1));
  for (let i = 1; i < RINGS; i++)
    for (let j = 0; j < SPOKES; j++) {
      idx.push(at(i, j), at(i + 1, j), at(i + 1, j + 1));
      idx.push(at(i, j), at(i + 1, j + 1), at(i, j + 1));
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function rimGeometry(z: (u1: number, u2: number) => number): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let j = 0; j < SPOKES; j++) {
    const t = (2 * Math.PI * j) / SPOKES;
    const v = z(Math.cos(t), Math.sin(t));
    pts.push(new THREE.Vector3(Math.cos(t), Number.isFinite(v) ? Math.max(-Z_CLIP, Math.min(Z_CLIP, v)) : 0, -Math.sin(t)));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

/**
 * A palette colour as three.js accepts it. A token with an alpha byte (#rrggbbaa, as --ink-3 is) is flattened onto
 * the paper: THREE.Color rejects eight hex digits and would keep its previous colour.
 */
function opaque(c: string, paper: string): string {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(c.trim());
  return m ? mix(paper, `#${m[1]}`, parseInt(m[2], 16) / 255) : c;
}

/** the largest |height| of a geometry built by diskGeometry (three.js is y-up) */
function maxHeight(g: THREE.BufferGeometry): number {
  const a = g.getAttribute('position');
  let m = 0;
  for (let i = 0; i < a.count; i++) m = Math.max(m, Math.abs(a.getY(i)));
  return m;
}

/** Throws when a WebGL context cannot be created: the caller then stays in the 2D view. */
export function createTangent3D(): Tangent3D {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

  // every colour is set from the palette on each render; these are placeholders
  // lit from near the viewer: the steep graphs face the camera, and with the default light from above they came out
  // in solid cross-hatching, hiding where the graph leaves the plane
  const graphMat = createInkMaterial({ color: 0, ink: 0, hatchGap: 7, light: new THREE.Vector3(-0.3, 0.5, 0.8) });
  graphMat.side = THREE.DoubleSide;
  const planeMat = createInkMaterial({ color: 0, ink: 0, hatchGap: 5, mode: 'veil' });
  const graph = new THREE.Mesh(new THREE.BufferGeometry(), graphMat);
  const plane = new THREE.Mesh(new THREE.BufferGeometry(), planeMat);
  const graphRimMat = new THREE.LineBasicMaterial();
  const planeRimMat = new THREE.LineBasicMaterial();
  const graphRim = new THREE.LineLoop(new THREE.BufferGeometry(), graphRimMat);
  const planeRim = new THREE.LineLoop(new THREE.BufferGeometry(), planeRimMat);
  const axesMat = new THREE.LineBasicMaterial();
  const axes = new THREE.LineSegments(new THREE.BufferGeometry(), axesMat);
  scene.add(axes, plane, graph, graphRim, planeRim);

  const tmp = new THREE.Vector3();
  let key = '';
  // the largest |height| of the graph and the plane: the camera backs off until both fit
  let zTop = 1;
  const rebuild = (P: Preset, rho: number) => {
    const k = `${P.id}:${rho}`;
    if (k === key) return;
    key = k;
    const zg = (u1: number, u2: number) => zoomedGraph(P, rho, u1, u2);
    // the centre of the zoomed graph is f(a) − f(a) = 0, whatever the formula does at u = 0
    const zgSafe = (u1: number, u2: number) => (u1 === 0 && u2 === 0 ? 0 : zg(u1, u2));
    const zp = (u1: number, u2: number) => zoomedPlane(P, u1, u2);
    for (const o of [graph, plane, graphRim, planeRim]) o.geometry.dispose();
    graph.geometry = diskGeometry(zgSafe);
    plane.geometry = diskGeometry(zp);
    graphRim.geometry = rimGeometry(zgSafe);
    planeRim.geometry = rimGeometry(zp);
    zTop = Math.max(0.6, maxHeight(graph.geometry), maxHeight(plane.geometry));
    axes.geometry.dispose();
    axes.geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1.2, 0, 0),
      new THREE.Vector3(1.2, 0, 0),
      new THREE.Vector3(0, 0, 1.2),
      new THREE.Vector3(0, 0, -1.2),
      new THREE.Vector3(0, -zTop, 0),
      new THREE.Vector3(0, zTop, 0),
    ]);
  };

  return {
    render(v) {
      rebuild(v.preset, v.rho);
      const p = v.palette;
      const c = (x: string) => opaque(x, p.paper);
      // the graph's own tone is a step from the page towards the ink: in the paper colour itself its lit faces vanish
      // into the background (a black hole in dark mode)
      setInkColors(graphMat, mix(c(p.paper2), c(p.curve), 0.15), c(p.curve));
      setInkColors(planeMat, c(p.limit), c(p.limit));
      graphRimMat.color.set(c(p.curve));
      planeRimMat.color.set(c(p.limit));
      axesMat.color.set(c(p.ink3));
      renderer.setPixelRatio(v.dpr);
      renderer.setSize(Math.max(1, Math.round(v.width)), Math.max(1, Math.round(v.height)), false);
      setInkPixelRatio(graphMat, v.dpr);
      setInkPixelRatio(planeMat, v.dpr);
      camera.aspect = v.width / Math.max(1, v.height);
      // Frame the scene: start where the bounding sphere (the unit disk, heights up to zTop) surely fits, then move in
      // until the projected graph and plane fill about 90% of the panel. A fixed distance cut the steep graphs off at
      // the top of the panel and left the flat ones small.
      const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
      const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
      let R = (1.05 * Math.hypot(1.2, zTop)) / Math.sin(Math.min(halfV, halfH));
      const ce = Math.cos(v.elevation);
      const place = () => {
        camera.position.set(R * ce * Math.cos(v.azimuth), R * Math.sin(v.elevation), R * ce * Math.sin(v.azimuth));
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
      };
      place();
      for (let pass = 0; pass < 2; pass++) {
        let extent = 0;
        for (const g of [graph.geometry, plane.geometry]) {
          const a = g.getAttribute('position');
          for (let i = 0; i < a.count; i += 3) {
            tmp.set(a.getX(i), a.getY(i), a.getZ(i)).project(camera);
            extent = Math.max(extent, Math.abs(tmp.x), Math.abs(tmp.y));
          }
        }
        if (!(extent > 0)) break;
        // the projected size scales about as 1/R: a smaller R enlarges it
        R *= extent / 0.9;
        place();
      }
      renderer.setClearColor(0x000000, 0);
      renderer.render(scene, camera);
      return canvas;
    },
    dispose() {
      for (const o of [graph, plane, graphRim, planeRim, axes]) o.geometry.dispose();
      for (const m of [graphMat, planeMat, graphRimMat, planeRimMat, axesMat]) m.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
