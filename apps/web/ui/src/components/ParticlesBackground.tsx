import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/* ParticlesBackground — page-level three.js constellation used as the
   landing backdrop. Inspired by https://particles.casberry.in/ — a
   single large rotating 3D structure whose vertices are bright glowing
   nodes connected by faint lines. Each visit picks a new formation,
   rotation, and color jitter, so two loads never look identical. */

type Formation = 'sphere' | 'helix' | 'torus' | 'cube' | 'grid';

const FORMATIONS: Formation[] = ['sphere', 'helix', 'torus', 'cube', 'grid'];

/* Number of constellation nodes. Kept low (300–500) — the visual
   identity comes from the *connections*, not from sheer particle count. */
const NODE_COUNT = 280;
const NODE_COUNT_LITE = 160;

/* Max edges per node — Casberry's wireframes look like ~3-neighbor
   graphs. More than 4 quickly turns into spaghetti. */
const MAX_EDGES_PER_NODE = 3;

/* Connection distance threshold scales with formation radius. */
const CONNECT_DIST_FACTOR = 0.55;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function readAccent(el: HTMLElement): THREE.Color {
  const raw = getComputedStyle(el).getPropertyValue('--accent').trim();
  const c = new THREE.Color();
  try {
    if (raw) c.set(raw);
    else c.set('#6aa7ff');
  } catch {
    c.set('#6aa7ff');
  }
  return c;
}

function isLightBackground(): boolean {
  if (typeof document === 'undefined') return false;
  const raw = getComputedStyle(document.body).backgroundColor;
  const m = raw.match(/rgba?\(([^)]+)\)/);
  if (!m) return false;
  const parts = m[1]!.split(',').map((s) => parseFloat(s.trim()));
  const [r, g, b] = parts;
  if (r == null || g == null || b == null) return false;
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.6;
}

/* Sample `n` points on the chosen formation. Returns a flat Float32Array
   of length n*3. Radius controls overall size in world units. */
function buildPositions(formation: Formation, n: number, radius: number): Float32Array {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0, z = 0;
    switch (formation) {
      case 'sphere': {
        const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;
        x = radius * Math.sin(phi) * Math.cos(theta);
        y = radius * Math.sin(phi) * Math.sin(theta);
        z = radius * Math.cos(phi);
        break;
      }
      case 'helix': {
        const t = i / n;
        const turns = 5;
        x = radius * Math.cos(turns * 2 * Math.PI * t);
        z = radius * Math.sin(turns * 2 * Math.PI * t);
        y = (t - 0.5) * radius * 2.4;
        break;
      }
      case 'torus': {
        const t = (i / n) * 2 * Math.PI;
        const u = ((i * 7) % n) / n * 2 * Math.PI;
        const R = radius * 0.9;
        const r = radius * 0.35;
        x = (R + r * Math.cos(u)) * Math.cos(t);
        y = r * Math.sin(u);
        z = (R + r * Math.cos(u)) * Math.sin(t);
        break;
      }
      case 'cube': {
        // Uniformly distribute nodes on the SURFACE of a cube — once
        // edges connect, this gives the wireframe-box silhouette.
        const face = i % 6;
        const u = (((i * 13) % 1000) / 1000) * 2 - 1;
        const v = (((i * 7) % 1000) / 1000) * 2 - 1;
        const s = radius * 0.85;
        switch (face) {
          case 0: x =  s; y = u * s; z = v * s; break;
          case 1: x = -s; y = u * s; z = v * s; break;
          case 2: y =  s; x = u * s; z = v * s; break;
          case 3: y = -s; x = u * s; z = v * s; break;
          case 4: z =  s; x = u * s; y = v * s; break;
          case 5: z = -s; x = u * s; y = v * s; break;
        }
        break;
      }
      case 'grid': {
        // 3D lattice — Casberry's "matrix" look.
        const side = Math.ceil(Math.cbrt(n));
        const step = (radius * 2) / (side - 1);
        const ix = i % side;
        const iy = Math.floor(i / side) % side;
        const iz = Math.floor(i / (side * side)) % side;
        x = -radius + ix * step;
        y = -radius + iy * step;
        z = -radius + iz * step;
        break;
      }
    }
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
  }
  return pos;
}

/* Per-node hue jitter around the accent color. */
function buildColors(base: THREE.Color, n: number, dark: boolean): Float32Array {
  const cols = new Float32Array(n * 3);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const targetL = dark
      ? Math.min(0.55, Math.max(0.20, hsl.l * (0.45 + Math.random() * 0.45)))
      : Math.min(0.95, Math.max(0.55, hsl.l * (0.9 + Math.random() * 0.4)));
    c.setHSL(
      (hsl.h + (Math.random() - 0.5) * 0.10 + 1) % 1,
      Math.min(1, hsl.s * (0.7 + Math.random() * 0.5)),
      targetL,
    );
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  return cols;
}

/* Build a constellation edge list: for every node, find up to
   MAX_EDGES_PER_NODE nearest neighbors within `connectDist` and emit a
   line segment. Deduplicated so each edge appears once. Returns a flat
   Float32Array of vertex positions ready for THREE.LineSegments
   (2 verts per edge). */
function buildEdges(positions: Float32Array, n: number, connectDist: number): Float32Array {
  const seen = new Set<number>();
  const verts: number[] = [];
  const d2max = connectDist * connectDist;

  for (let i = 0; i < n; i++) {
    const ix = positions[i * 3]!;
    const iy = positions[i * 3 + 1]!;
    const iz = positions[i * 3 + 2]!;
    const cand: { j: number; d2: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dx = ix - positions[j * 3]!;
      const dy = iy - positions[j * 3 + 1]!;
      const dz = iz - positions[j * 3 + 2]!;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < d2max) cand.push({ j, d2 });
    }
    cand.sort((a, b) => a.d2 - b.d2);
    for (let k = 0; k < Math.min(MAX_EDGES_PER_NODE, cand.length); k++) {
      const j = cand[k]!.j;
      const a = Math.min(i, j);
      const b = Math.max(i, j);
      const key = a * n + b;
      if (seen.has(key)) continue;
      seen.add(key);
      verts.push(positions[a * 3]!, positions[a * 3 + 1]!, positions[a * 3 + 2]!);
      verts.push(positions[b * 3]!, positions[b * 3 + 1]!, positions[b * 3 + 2]!);
    }
  }
  return new Float32Array(verts);
}

/* Vertex shader for the glowing node sprites. The divisor (40.0)
   is calibrated so a node at the formation radius is ~12-20 pixels
   wide — Casberry-like dot scale, not a giant blob. */
const NODE_VERTEX = /* glsl */ `
  attribute vec3 color;
  varying vec3 vColor;
  uniform float uSize;
  uniform float uPixelRatio;
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * uPixelRatio * (40.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

/* Casberry-style node fragment: bright core + soft halo + subtle pulse. */
const NODE_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  uniform float uTime;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    if (d > 0.5) discard;
    float core = 1.0 - smoothstep(0.0, 0.12, d);
    float halo = 1.0 - smoothstep(0.12, 0.5, d);
    float pulse = 0.85 + 0.15 * sin(uTime * 1.5);
    float a = (core + halo * 0.45) * pulse;
    gl_FragColor = vec4(vColor + core * 0.5, a);
  }
`;

interface Props {
  /* Disable bloom + lower node count on lower-tier devices. */
  lite?: boolean;
}

export function ParticlesBackground({ lite = false }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Per-visit randomization.
    const formation = pick(FORMATIONS);
    const rotationDir = Math.random() < 0.5 ? -1 : 1;
    const rotationSpeed = (0.03 + Math.random() * 0.05) * rotationDir;
    const tiltX = (Math.random() - 0.5) * 0.6;
    const baseColor = readAccent(mount);
    const lightTheme = isLightBackground();

    // On light themes, additive blending blows out to a washed-out
    // square. Use plain alpha-over with darker node colors so the
    // constellation reads as soft accent-tinted dots on cream.
    const blending = lightTheme ? THREE.NormalBlending : THREE.AdditiveBlending;

    const nodeCount = lite ? NODE_COUNT_LITE : NODE_COUNT;
    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio, lite ? 1 : 1.75);
    // Scale formation radius with viewport so the structure fills the
    // screen instead of looking like a marble.
    const radius = Math.min(12, Math.max(7, Math.min(width, height) / 90));
    const connectDist = radius * CONNECT_DIST_FACTOR;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    camera.position.set(0, 0, radius * 2.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    mount.appendChild(renderer.domElement);

    // Group both layers under a single object so they rotate together.
    const structure = new THREE.Group();
    scene.add(structure);

    // ---- Nodes (glowing points) ----
    const positions = buildPositions(formation, nodeCount, radius);
    const colors = buildColors(baseColor, nodeCount, lightTheme);

    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    nodeGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const nodeUniforms = {
      uTime: { value: 0 },
      // Per-node base size in world units. Multiplied by 40/-z in the
      // vertex shader. Kept small so particles read as distinct dots.
      uSize: { value: lightTheme ? 5 : 7 },
      uPixelRatio: { value: pixelRatio },
    };
    const nodeMaterial = new THREE.ShaderMaterial({
      uniforms: nodeUniforms,
      vertexShader: NODE_VERTEX,
      fragmentShader: NODE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending,
    });
    const nodes = new THREE.Points(nodeGeometry, nodeMaterial);
    structure.add(nodes);

    // ---- Connecting lines (the "wireframe" identity) ----
    const edgeVerts = buildEdges(positions, nodeCount, connectDist);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(edgeVerts, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: lightTheme ? 0.18 : 0.28,
      blending,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    structure.add(lines);

    // ---- Optional bloom (Casberry's glow signature) ----
    let composer: EffectComposer | null = null;
    if (!lite && !lightTheme) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 1.1, 0.55, 0.0);
      bloom.strength = 0.9;
      composer.addPass(bloom);
    }

    let raf = 0;
    let running = true;
    const clock = new THREE.Clock();

    // Cursor parallax — Casberry's signature interaction. Track the
    // pointer in normalized [-1, 1] coords and lerp the structure's
    // tilt toward it. Reduced motion / coarse pointers skip this.
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const wantsPointerParallax =
      !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches &&
      !window.matchMedia?.('(pointer: coarse)').matches;
    function onPointerMove(e: PointerEvent) {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    }
    if (wantsPointerParallax) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
    }

    // Scramble burst — when the user clicks the logo (or any UI fires
    // the event), the structure briefly spins up faster and pulses
    // outward, then settles back. Cheap, no buffer reallocation.
    let burst = 0;          // 0..1, decays exponentially
    let burstRotation = 0;  // integrates burst over time into a real spin
    function onScramble() { burst = 1; }
    window.addEventListener('openhermit:scramble', onScramble);

    function tick() {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      // IMPORTANT: getDelta first, then derive elapsed from clock.elapsedTime.
      // Calling getElapsedTime() advances the internal clock and would make
      // a subsequent getDelta() return 0, breaking time-based decay.
      const dt = clock.getDelta();
      const t = clock.elapsedTime;
      nodeUniforms.uTime.value = t;

      // Lerp pointer (smooth follow).
      pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 4);
      pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 4);

      // Burst decay (~0.6s half-life: 0.5 ≈ 0.3^0.6 → base ≈ 0.3).
      if (burst > 0.001) burst *= Math.pow(0.3, dt);
      else burst = 0;
      // Integrate the burst into a real rotation accumulator so the
      // structure actually *spins* rather than snapping to an offset.
      // Peak angular velocity at burst=1: 12 rad/s ≈ 2 full spins/s.
      burstRotation += burst * 12 * dt;

      const burstScale = 1 + burst * 0.22;
      structure.rotation.y = t * rotationSpeed + burstRotation + pointer.x * 0.35;
      structure.rotation.x = tiltX + Math.sin(t * 0.1) * 0.05 + pointer.y * 0.25;
      structure.scale.setScalar(burstScale);
      if (composer) composer.render();
      else renderer.render(scene, camera);
    }
    clock.getDelta(); // prime so first dt is small
    tick();

    function onVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        clock.getDelta();
        tick();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      if (composer) composer.setSize(w, h);
    });
    ro.observe(mount);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('openhermit:scramble', onScramble);
      if (wantsPointerParallax) {
        window.removeEventListener('pointermove', onPointerMove);
      }
      ro.disconnect();
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      composer?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [lite]);

  return <div ref={mountRef} className="landing__particles" aria-hidden />;
}
