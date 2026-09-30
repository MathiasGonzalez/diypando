import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries, toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const MM = 0.001;
const SPEEDS = {
  lenta: { spark: 220, grow: 800 },
  normal: { spark: 120, grow: 400 },
  rapida: { spark: 50, grow: 140 },
};
const RESIST_PERIOD = 2800;
const HEAT_STOPS = [
  [0, new THREE.Color(0x1e3a5f)],
  [0.22, new THREE.Color(0x2b6cb0)],
  [0.42, new THREE.Color(0x2f9e6b)],
  [0.62, new THREE.Color(0xe8c372)],
  [0.82, new THREE.Color(0xd4652f)],
  [1, new THREE.Color(0x9b1c1c)],
];

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

function leafKey(id) {
  if (/-b(?:$|-)/.test(id)) return "b";
  if (/-a(?:$|-)/.test(id)) return "a";
  return "main";
}

export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd6cfc4);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 40);
  camera.position.set(2.2, 1.6, 3.2);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.75;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0.5, 1, 0);

  scene.add(new THREE.AmbientLight(0xe8e2d8, 0.55));
  const key = new THREE.DirectionalLight(0xfff6ea, 1.9);
  key.position.set(2.5, 4, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.01;
  scene.add(key);
  scene.add(key.target);
  const fill = new THREE.DirectionalLight(0xc5d0dc, 0.55);
  fill.position.set(-3, 1, -2);
  scene.add(fill);

  const grid = new THREE.GridHelper(6, 30, 0x9a9084, 0xc2b9ad);
  scene.add(grid);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.28 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const group = new THREE.Group();
  scene.add(group);
  const weldsGroup = new THREE.Group();
  scene.add(weldsGroup);

  const sparkLight = new THREE.PointLight(0xffb24a, 0, 0.22, 2);
  scene.add(sparkLight);

  const steel = new THREE.MeshStandardMaterial({
    color: 0x8d97a3,
    metalness: 0.82,
    roughness: 0.32,
  });
  const rust = new THREE.MeshStandardMaterial({
    color: 0xd4652f,
    metalness: 0.4,
    roughness: 0.5,
  });
  const zinc = new THREE.MeshStandardMaterial({
    color: 0xcfd8e0,
    metalness: 0.58,
    roughness: 0.36,
  });
  const zincDark = new THREE.MeshStandardMaterial({
    color: 0x9aa5ae,
    metalness: 0.62,
    roughness: 0.3,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x4a433c,
    metalness: 0.6,
    roughness: 0.45,
  });
  const beadHot = new THREE.MeshStandardMaterial({
    color: 0xff6a1a,
    emissive: 0xff4300,
    emissiveIntensity: 1.4,
    metalness: 0.2,
    roughness: 0.35,
  });
  const beadCold = new THREE.MeshStandardMaterial({
    color: 0x3a322c,
    metalness: 0.55,
    roughness: 0.45,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });
  const nylon = new THREE.MeshStandardMaterial({
    color: 0xe8e0d4,
    metalness: 0.05,
    roughness: 0.68,
  });
  const sharedMats = new Set([steel, rust, dark, zinc, zincDark, nylon, beadHot, beadCold]);

  const player = {
    joints: [],
    index: 0,
    playing: false,
    speed: "normal",
    phase: "idle",
    t0: 0,
    mesh: null,
    onChange: null,
  };

  const resist = {
    mode: "soldar",
    playing: false,
    load: 0,
    t0: 0,
    spec: null,
    leaves: [],
    amp: 0.08,
    arriostrado: false,
    parantes: 0,
    onChange: null,
    lastNotify: 0,
  };

  const _world = new THREE.Vector3();
  const _local = new THREE.Vector3();
  const _inv = new THREE.Matrix4();
  const _heat = new THREE.Color();
  const _heatB = new THREE.Color();

  function materialFor(part) {
    if (part.profile?.shape === "cable") return zinc;
    if (part.role === "herraje" || part.role === "guia") return rust;
    if (part.role === "barrote") return steel;
    return dark;
  }

  function angleGeometry(wMm, dMm, tMm, length) {
    const w = wMm * MM;
    const d = dMm * MM;
    const t = Math.max(tMm * MM, 0.002);
    const flangeA = new THREE.BoxGeometry(w, length, t, 1, 12, 1);
    flangeA.translate(0, 0, -d / 2 + t / 2);
    const flangeB = new THREE.BoxGeometry(t, length, Math.max(d - t, t), 1, 12, 1);
    flangeB.translate(-w / 2 + t / 2, 0, t / 2);
    const geo = mergeGeometries([flangeA, flangeB]);
    flangeA.dispose();
    flangeB.dispose();
    return geo;
  }

  function hollowTubeGeometry(wMm, dMm, tMm, length, steps) {
    const w = wMm * MM;
    const d = dMm * MM;
    const t = Math.min(Math.max(tMm * MM * 1.5, 0.002), Math.min(w, d) * 0.3);
    const rOut = Math.min(Math.min(w, d) * 0.22, t * 2.2);
    const rIn = Math.max(rOut - t, 0.0004);
    const rounded = (shape, hw, hd, r) => {
      shape.moveTo(-hw + r, -hd);
      shape.lineTo(hw - r, -hd);
      shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
      shape.lineTo(hw, hd - r);
      shape.quadraticCurveTo(hw, hd, hw - r, hd);
      shape.lineTo(-hw + r, hd);
      shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
      shape.lineTo(-hw, -hd + r);
      shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
    };
    const outer = new THREE.Shape();
    rounded(outer, w / 2, d / 2, rOut);
    const hole = new THREE.Path();
    rounded(hole, w / 2 - t, d / 2 - t, rIn);
    outer.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(outer, {
      depth: length,
      steps,
      bevelEnabled: false,
      curveSegments: 2,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -length / 2, 0);
    return geo;
  }

  function mitreEnds(geo, dir, length) {
    const n = dir.clone().normalize();
    const ex = new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n));
    const horizontal = Math.abs(n.y) >= Math.abs(n.x);
    const axis = horizontal ? n.y : n.x;
    if (Math.abs(axis) < 0.2) return 0;
    const slope = (horizontal ? ex.y : ex.x) / axis;
    const limit = length * 0.25;
    const pos = geo.attributes.position;
    const half = length / 2 - 1e-5;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (Math.abs(y) < half) continue;
      const shift = Math.max(-limit, Math.min(limit, -pos.getX(i) * slope));
      pos.setY(i, y + shift);
    }
    pos.needsUpdate = true;
    return Math.atan(Math.abs(slope));
  }

  function memberGeometry(part, length, tubeSteps) {
    if (part.kind === "round") {
      const r = (part.profile.w * MM) / 2;
      return new THREE.CylinderGeometry(r, r, length, part.profile.shape === "cable" ? 8 : 14, 18);
    }
    if (part.kind === "angle") {
      return angleGeometry(part.profile.w, part.profile.d, part.profile.t, length);
    }
    if (part.profile.shape === "rect") {
      return hollowTubeGeometry(part.profile.w, part.profile.d, part.profile.t, length, tubeSteps);
    }
    return new THREE.BoxGeometry(part.profile.w * MM, length, part.profile.d * MM, 1, 18, 1);
  }

  function addHinge(part, at) {
    const sign = part.side === "derecha" ? 1 : -1;
    const r = 0.01;
    const h = 0.1;
    const gap = 0.0028;
    const half = (h - gap) / 2;
    const pinR = 0.0044;
    const flagT = 0.0036;
    const flagIn = 0.034;
    const flagOut = 0.02;
    const flagH = half * 0.86;

    const hinge = new THREE.Group();
    const front = at.z * 2;
    hinge.position.set(at.x + sign * r, at.y, front + r);

    const lower = new THREE.Mesh(new THREE.CylinderGeometry(r, r, half, 22), zinc);
    lower.position.y = -(half + gap) / 2;
    hinge.add(lower);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(r, r, half, 22), zinc);
    upper.position.y = (half + gap) / 2;
    hinge.add(upper);

    const pin = new THREE.Mesh(new THREE.CylinderGeometry(pinR, pinR, h + 0.01, 14), zincDark);
    pin.position.y = 0.003;
    hinge.add(pin);

    const washer = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.92, gap, 18), zincDark);
    hinge.add(washer);

    const pomo = new THREE.Mesh(new THREE.SphereGeometry(r * 0.78, 16, 12), zinc);
    pomo.scale.y = 0.72;
    pomo.position.y = h / 2 + 0.002;
    hinge.add(pomo);

    const base = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 12, 8), zincDark);
    base.scale.y = 0.55;
    base.position.y = -h / 2;
    hinge.add(base);

    const aletaPuerta = new THREE.Mesh(new THREE.BoxGeometry(flagIn, flagH, flagT), zinc);
    aletaPuerta.position.set(-sign * (r + flagIn / 2 - 0.0015), upper.position.y, -r);
    hinge.add(aletaPuerta);

    const aletaMarco = new THREE.Mesh(new THREE.BoxGeometry(flagOut, flagH, flagT), zinc);
    aletaMarco.position.set(sign * (r + flagOut / 2 - 0.0015), lower.position.y, -r);
    hinge.add(aletaMarco);

    hinge.userData.kind = "hinge";
    hinge.userData.part = part;
    hinge.userData.restPos = hinge.position.clone();
    group.add(hinge);
  }

  function addFork(target, wheelR, mat) {
    const plateT = 0.006;
    const plateH = wheelR * 2 + 0.018;
    const plateW = 0.03;
    const spanZ = 0.016;
    const left = new THREE.Mesh(new THREE.BoxGeometry(plateW, plateH, plateT), mat);
    left.position.set(0, wheelR * 0.08, -spanZ);
    const right = left.clone();
    right.position.z = spanZ;
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, spanZ * 2 + 0.008, 10), mat);
    axle.rotation.x = Math.PI / 2;
    const hang = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.036, plateT * 2 + spanZ), mat);
    hang.position.set(0, wheelR + 0.016, 0);
    target.add(left, right, axle, hang);
  }

  function addWheel(part, at) {
    const g = new THREE.Group();
    g.position.copy(at);
    const style = part.style || "canal_v";
    const R = 0.04;
    if (style === "nylon") {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.022, 24), nylon);
      tire.rotation.x = Math.PI / 2;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.026, 16), zinc);
      hub.rotation.x = Math.PI / 2;
      g.add(tire, hub);
    } else if (style === "canal_u") {
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.62, R * 0.62, 0.02, 22), rust);
      inner.rotation.x = Math.PI / 2;
      const f1 = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.005, 22), rust);
      f1.rotation.x = Math.PI / 2;
      f1.position.z = 0.012;
      const f2 = f1.clone();
      f2.position.z = -0.012;
      g.add(inner, f1, f2);
    } else {
      const cone = new THREE.ConeGeometry(R, 0.018, 20);
      const c1 = new THREE.Mesh(cone, rust);
      c1.rotation.x = Math.PI / 2;
      c1.position.z = -0.009;
      const c2 = new THREE.Mesh(cone.clone(), rust);
      c2.rotation.x = -Math.PI / 2;
      c2.position.z = 0.009;
      g.add(c1, c2);
    }
    addFork(g, R, zincDark);
    g.userData.kind = "wheel";
    g.userData.part = part;
    g.userData.restPos = at.clone();
    group.add(g);
  }

  function addTrolley(part, at) {
    const g = new THREE.Group();
    g.position.copy(at);
    const double = part.style === "carrito_doble";
    const rollerR = 0.018;
    const lift = 0.048;
    const makeRoller = (dx) => {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(rollerR, rollerR, 0.016, 16), rust);
      r.rotation.x = Math.PI / 2;
      r.position.set(dx, lift, 0);
      return r;
    };
    if (double) g.add(makeRoller(-0.028), makeRoller(0.028));
    else g.add(makeRoller(0));
    const plate = new THREE.Mesh(new THREE.BoxGeometry(double ? 0.082 : 0.048, 0.058, 0.007), zinc);
    plate.position.set(0, lift * 0.45, 0.022);
    g.add(plate);
    g.userData.kind = "trolley";
    g.userData.part = part;
    g.userData.restPos = at.clone();
    group.add(g);
  }

  function addLock(part, at) {
    const g = new THREE.Group();
    g.position.copy(at);
    const side = part.side === "derecha" ? 1 : -1;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.04), zinc);
    box.position.set(side * 0.028, 0, 0.032);
    g.add(box);
    if (part.style === "pasador") {
      const rodH = Math.max((part.length || 900) * MM, 0.2);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, rodH, 8), zincDark);
      rod.position.set(side * 0.028, -rodH / 2 + 0.04, 0.05);
      g.add(rod);
    } else {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.012, 0.012), zincDark);
      arm.position.set(side * 0.082, 0.01, 0.032);
      const hook = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.038, 0.012), zincDark);
      hook.position.set(side * 0.1, -0.008, 0.032);
      g.add(arm, hook);
    }
    g.userData.kind = "lock";
    g.userData.part = part;
    g.userData.restPos = at.clone();
    group.add(g);
  }

  function addGuideRoller(part, at) {
    const g = new THREE.Group();
    g.position.copy(at);
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.032, 14), rust);
    roll.rotation.x = Math.PI / 2;
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.028, 0.008), zinc);
    bracket.position.set(0, 0.008, 0.018);
    g.add(roll, bracket);
    g.userData.kind = "guide_roller";
    g.userData.part = part;
    g.userData.restPos = at.clone();
    group.add(g);
  }

  function addPart(part) {
    const a = new THREE.Vector3(part.from[0] * MM, part.from[1] * MM, part.from[2] * MM);
    const b = new THREE.Vector3(part.to[0] * MM, part.to[1] * MM, part.to[2] * MM);

    if (part.kind === "hinge") {
      addHinge(part, a);
      return;
    }
    if (part.kind === "wheel") {
      addWheel(part, a);
      return;
    }
    if (part.kind === "trolley") {
      addTrolley(part, a);
      return;
    }
    if (part.kind === "lock") {
      addLock(part, a);
      return;
    }
    if (part.kind === "guide_roller") {
      addGuideRoller(part, a);
      return;
    }

    const dir = new THREE.Vector3().subVectors(b, a);
    const length = dir.length();
    if (length < 0.0005) return;
    const midPt = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const yAxis = new THREE.Vector3(0, 1, 0);
    const crowded = group.children.length > 24;
    const geo = memberGeometry(part, length, crowded && part.role === "barrote" ? 8 : 14);
    let miter = 0;
    if (part.role === "tirante" && part.kind !== "round") miter = mitreEnds(geo, dir, length);
    let shaded = geo;
    if (part.kind !== "round") {
      geo.deleteAttribute("uv");
      shaded = toCreasedNormals(geo, 0.6);
      geo.dispose();
    }
    const base = materialFor(part);
    const deformable = part.role !== "guia";
    const mat = deformable ? base.clone() : base;
    if (deformable) {
      mat.vertexColors = true;
      mat.color.set(0xffffff);
    }
    const mesh = new THREE.Mesh(shaded, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.miter = miter;
    mesh.position.copy(midPt);
    mesh.quaternion.setFromUnitVectors(yAxis, dir.clone().normalize());
    mesh.userData.kind = "member";
    mesh.userData.part = part;
    mesh.userData.role = part.role;
    mesh.userData.id = part.id;
    mesh.userData.deform = deformable;
    mesh.userData.baseColor = base.color.clone();
    group.add(mesh);
    mesh.updateMatrixWorld(true);
    if (deformable) {
      const pos = shaded.attributes.position;
      mesh.userData.rest = pos.array.slice();
      mesh.userData.restNormals = shaded.attributes.normal.array.slice();
      const colors = new Float32Array(pos.count * 3);
      shaded.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }
  }

  function frame() {
    const box = new THREE.Box3().setFromObject(group);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    grid.position.y = box.min.y;
    floor.position.y = box.min.y - 0.001;
    const reach = Math.max(size.x, size.y, size.z, 0.8) * 2.2;
    const sc = key.shadow.camera;
    sc.left = -reach;
    sc.right = reach;
    sc.top = reach;
    sc.bottom = -reach;
    sc.near = 0.1;
    sc.far = reach * 6;
    sc.updateProjectionMatrix();
    key.target.position.copy(center);
    key.position.set(center.x + reach * 0.55, center.y + reach * 1.1, center.z + reach * 0.75);
    controls.target.copy(center);
    const span = Math.max(size.x, size.y, size.z, 0.8);
    camera.position.set(center.x + span * 0.9, center.y + span * 0.45, center.z + span * 1.15);
    camera.near = span / 50;
    camera.far = span * 20;
    camera.updateProjectionMatrix();
    controls.update();
    rememberHome();
  }

  function disposeObj(obj) {
    for (const child of [...obj.children]) {
      obj.remove(child);
      disposeObj(child);
    }
    obj.geometry?.dispose?.();
    if (obj.material && !sharedMats.has(obj.material)) {
      obj.material.map?.dispose?.();
      obj.material.dispose?.();
    }
  }

  function clearGroup(target) {
    while (target.children.length) {
      const child = target.children[0];
      target.remove(child);
      disposeObj(child);
    }
  }

  function notify() {
    if (!player.onChange) return;
    const total = player.joints.length;
    const welding = player.phase !== "idle";
    const current = welding ? player.index + 1 : player.index;
    const joint = welding
      ? player.joints[player.index]
      : player.joints[Math.max(0, player.index - 1)] || null;
    player.onChange({
      current,
      total,
      joint,
      playing: player.playing,
      done: !welding && player.index >= total && total > 0,
    });
  }

  function notifyResist(force) {
    if (!resist.onChange) return;
    const now = performance.now();
    if (!force && now - resist.lastNotify < 80) return;
    resist.lastNotify = now;
    resist.onChange({
      mode: resist.mode,
      load: resist.load,
      playing: resist.playing,
    });
  }

  function buildLeaves(parts, spec) {
    const buckets = new Map();
    for (const part of parts) {
      if (
        part.kind === "hinge" ||
        part.kind === "wheel" ||
        part.kind === "trolley" ||
        part.kind === "lock" ||
        part.kind === "guide_roller" ||
        part.role === "guia"
      ) {
        continue;
      }
      const key = leafKey(part.id);
      let b = buckets.get(key);
      if (!b) {
        b = { xs: [], ys: [] };
        buckets.set(key, b);
      }
      b.xs.push(part.from[0] * MM, part.to[0] * MM);
      b.ys.push(part.from[1] * MM, part.to[1] * MM);
    }
    const tipo = spec?.tipo || "puerta_reja_peatonal";
    const leaves = [];
    for (const [key, b] of buckets) {
      if (!b.xs.length) continue;
      let hinge = null;
      if (tipo === "porton_dos_hojas") hinge = key === "b" ? "derecha" : "izquierda";
      else if (tipo !== "reja_ventana" && tipo !== "porton_corredizo") {
        hinge = spec?.lado_bisagra === "derecha" ? "derecha" : "izquierda";
      }
      const xmin = Math.min(...b.xs);
      const xmax = Math.max(...b.xs);
      const ymin = Math.min(...b.ys);
      const ymax = Math.max(...b.ys);
      leaves.push({
        key,
        xmin,
        xmax,
        ymin,
        ymax,
        hinge,
        tipo,
        spanY: Math.max(ymax - ymin, 0.3),
      });
    }
    const spanY = Math.max(...leaves.map((l) => l.spanY), 0.8);
    resist.leaves = leaves;
    const braced = resist.arriostrado ? 0.45 : resist.parantes ? 0.75 : 1;
    resist.amp = 0.16 * spanY * braced;
  }

  function pickLeaf(x, y) {
    const leaves = resist.leaves;
    if (!leaves.length) return null;
    let leaf = leaves[0];
    let best = Infinity;
    for (const item of leaves) {
      if (x >= item.xmin - 0.04 && x <= item.xmax + 0.04) {
        leaf = item;
        best = -1;
        break;
      }
      const d = Math.abs(x - (item.xmin + item.xmax) / 2);
      if (d < best) {
        best = d;
        leaf = item;
      }
    }
    const nx = clamp01((x - leaf.xmin) / Math.max(leaf.xmax - leaf.xmin, 0.05));
    const ny = clamp01((y - leaf.ymin) / Math.max(leaf.ymax - leaf.ymin, 0.05));
    return { leaf, nx, ny };
  }

  function windShape(x, y) {
    const at = pickLeaf(x, y);
    if (!at) return 0;
    const { leaf, nx, ny } = at;
    if (leaf.tipo === "reja_ventana") return 16 * nx * (1 - nx) * ny * (1 - ny);
    if (leaf.tipo === "porton_corredizo") return 4 * nx * (1 - nx) * (0.25 + 0.75 * ny);
    if (leaf.hinge === "derecha") return (1 - nx) * (1 - nx) * (0.4 + 0.6 * ny);
    return nx * nx * (0.4 + 0.6 * ny);
  }

  function windDemand(x, y) {
    const at = pickLeaf(x, y);
    if (!at) return 0;
    const { leaf, nx, ny } = at;
    if (leaf.tipo === "reja_ventana") return 16 * nx * (1 - nx) * ny * (1 - ny);
    if (leaf.tipo === "porton_corredizo") return 4 * nx * (1 - nx) * (0.35 + 0.65 * ny);
    const support = leaf.hinge === "derecha" ? nx : 1 - nx;
    return clamp01(support ** 1.25 * (0.28 + 0.72 * ny) + 0.22 * 4 * nx * (1 - nx) * ny);
  }

  function heatColor(base, demand, load) {
    if (load <= 0.02) {
      _heat.copy(base);
      return _heat;
    }
    const t = clamp01(demand);
    for (let i = 1; i < HEAT_STOPS.length; i++) {
      const [t1, c1] = HEAT_STOPS[i];
      const [t0, c0] = HEAT_STOPS[i - 1];
      if (t <= t1) {
        const u = (t - t0) / Math.max(t1 - t0, 1e-6);
        _heat.copy(c0);
        _heatB.copy(c1);
        return _heat.lerp(_heatB, u);
      }
    }
    return _heat.copy(HEAT_STOPS[HEAT_STOPS.length - 1][1]);
  }

  function applyDeform() {
    const load = resist.mode === "resistencia" ? resist.load : 0;
    const amp = resist.amp;
    for (const mesh of group.children) {
      if (
        mesh.userData.kind === "hinge" ||
        mesh.userData.kind === "wheel" ||
        mesh.userData.kind === "trolley" ||
        mesh.userData.kind === "lock" ||
        mesh.userData.kind === "guide_roller"
      ) {
        const rest = mesh.userData.restPos;
        if (!rest) continue;
        const k = windShape(rest.x, rest.y);
        mesh.position.set(rest.x, rest.y, rest.z + load * amp * k);
        continue;
      }
      if (!mesh.userData.deform || !mesh.userData.rest) continue;
      const rest = mesh.userData.rest;
      const pos = mesh.geometry.attributes.position;
      const col = mesh.geometry.attributes.color;
      const base = mesh.userData.baseColor;
      const heatOn = load > 0.02;
      const isTirante = mesh.userData.role === "tirante";
      const boost = isTirante ? 1.4 : mesh.userData.role === "barrote" ? 1.1 : 1;
      mesh.material.metalness = heatOn ? 0.08 : mesh.userData.role === "barrote" ? 0.82 : 0.6;
      mesh.material.roughness = heatOn ? 0.72 : 0.4;
      if (load <= 0) {
        if (!mesh.userData.clean) {
          pos.array.set(rest);
          mesh.geometry.attributes.normal.array.set(mesh.userData.restNormals);
          for (let i = 0; i < pos.count; i++) col.setXYZ(i, base.r, base.g, base.b);
          pos.needsUpdate = true;
          col.needsUpdate = true;
          mesh.geometry.attributes.normal.needsUpdate = true;
          mesh.userData.clean = true;
        }
        continue;
      }
      mesh.userData.clean = false;
      mesh.updateMatrixWorld(true);
      _inv.copy(mesh.matrixWorld).invert();
      for (let i = 0; i < pos.count; i++) {
        _world.set(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]);
        _world.applyMatrix4(mesh.matrixWorld);
        const k = windShape(_world.x, _world.y);
        let demand = windDemand(_world.x, _world.y);
        if (isTirante) demand = Math.max(demand, 0.88);
        _world.z += load * amp * k;
        _local.copy(_world).applyMatrix4(_inv);
        pos.setXYZ(i, _local.x, _local.y, _local.z);
        const c = heatColor(base, clamp01(demand * load * boost), load);
        col.setXYZ(i, c.r, c.g, c.b);
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    }
    if (hoverMesh || pinMesh) paintHighlight();
  }

  function placeBead(joint, scaleY, hot) {
    const a = new THREE.Vector3(joint.from_w[0] * MM, joint.from_w[1] * MM, joint.from_w[2] * MM);
    const b = new THREE.Vector3(joint.to_w[0] * MM, joint.to_w[1] * MM, joint.to_w[2] * MM);
    const dir = new THREE.Vector3().subVectors(b, a);
    const length = Math.max(dir.length(), 0.008);
    const geo = beadGeometry(length, 0.0065);
    const mesh = new THREE.Mesh(geo, hot ? beadHot : beadCold);
    const n = dir.clone().normalize();
    const y = Math.max(0.02, scaleY);
    mesh.position.copy(a).addScaledVector(n, (length * y) / 2);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    mesh.scale.set(1, y, 1);
    mesh.userData.length = length;
    mesh.userData.from = a;
    mesh.userData.dir = n;
    return mesh;
  }

  function setBeadScale(mesh, y) {
    const s = Math.max(0.02, y);
    mesh.scale.set(1, s, 1);
    mesh.position.copy(mesh.userData.from).addScaledVector(mesh.userData.dir, (mesh.userData.length * s) / 2);
  }

  function finishBead() {
    if (player.mesh) {
      player.mesh.material = beadCold;
      player.mesh.material.emissiveIntensity = 0;
      setBeadScale(player.mesh, 1);
      player.mesh = null;
      player.tacks = [];
    }
    for (const t of player.tacks || []) t.material = beadCold;
    player.tacks = [];
    sparkLight.intensity = 0;
    player.index += 1;
    player.phase = "idle";
  }

  function startJoint() {
    if (player.index >= player.joints.length) {
      player.playing = false;
      player.phase = "idle";
      sparkLight.intensity = 0;
      notify();
      return;
    }
    const joint = player.joints[player.index];
    const at = new THREE.Vector3(joint.at[0] * MM, joint.at[1] * MM, joint.at[2] * MM);
    sparkLight.position.copy(at);
    sparkLight.intensity = 8;
    player.mesh = placeBead(joint, 0.02, true);
    player.mesh.castShadow = true;
    weldsGroup.add(player.mesh);
    player.tacks = [joint.from_w, joint.to_w].map((p) => {
      const t = new THREE.Mesh(new THREE.SphereGeometry(0.0072, 10, 8), beadHot);
      t.scale.y = 0.7;
      t.position.set(p[0] * MM, p[1] * MM, p[2] * MM);
      weldsGroup.add(t);
      return t;
    });
    emitSparks(at, 14, 1.2);
    player.phase = "spark";
    player.t0 = performance.now();
    notify();
  }

  function timings() {
    return SPEEDS[player.speed] || SPEEDS.normal;
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const highlight = new THREE.Group();
  scene.add(highlight);
  const hoverMat = new THREE.LineBasicMaterial({ color: 0xd4652f });
  const pinMat = new THREE.LineBasicMaterial({ color: 0xe8c372 });
  sharedMats.add(hoverMat);
  sharedMats.add(pinMat);

  let hoverMesh = null;
  let pinMesh = null;
  let lastHoverId = null;
  let pickHandlers = {};
  let pointerDown = null;

  const home = {
    pos: new THREE.Vector3(),
    target: new THREE.Vector3(),
    ready: false,
  };
  const aim = {
    on: false,
    pos: new THREE.Vector3(),
    target: new THREE.Vector3(),
  };
  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const _p = new THREE.Vector3();

  function rememberHome() {
    home.pos.copy(camera.position);
    home.target.copy(controls.target);
    home.ready = true;
  }

  function clearHighlight() {
    disposeObj(highlight);
  }

  function outlineOf(obj, mat) {
    if (!obj.geometry) {
      const wrap = new THREE.Group();
      for (const child of obj.children) {
        const line = outlineOf(child, mat);
        if (line) wrap.add(line);
      }
      return wrap.children.length ? wrap : null;
    }
    const edges = new THREE.EdgesGeometry(obj.geometry, 18);
    const line = new THREE.LineSegments(edges, mat);
    obj.updateWorldMatrix(true, false);
    line.matrix.copy(obj.matrixWorld);
    line.matrixAutoUpdate = false;
    return line;
  }

  function paintHighlight() {
    clearHighlight();
    if (hoverMesh && hoverMesh !== pinMesh) {
      const line = outlineOf(hoverMesh, hoverMat);
      if (line) highlight.add(line);
    }
    if (pinMesh) {
      const line = outlineOf(pinMesh, pinMat);
      if (line) highlight.add(line);
    }
  }

  function meshById(id) {
    if (!id) return null;
    return group.children.find((mesh) => mesh.userData.part?.id === id) || null;
  }

  function projectPx(v, rect) {
    _p.copy(v).project(camera);
    return {
      x: (_p.x * 0.5 + 0.5) * rect.width,
      y: (-_p.y * 0.5 + 0.5) * rect.height,
      behind: _p.z > 1,
    };
  }

  function distToSeg(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const len2 = abx * abx + aby * aby;
    const t = len2 < 1e-6 ? 0 : Math.min(1, Math.max(0, ((px - ax) * abx + (py - ay) * aby) / len2));
    const dx = px - (ax + abx * t);
    const dy = py - (ay + aby * t);
    return Math.hypot(dx, dy);
  }

  function partRoot(obj) {
    let cur = obj;
    while (cur && cur !== group && cur !== scene) {
      if (cur.userData?.part) return cur;
      cur = cur.parent;
    }
    return null;
  }

  function pickMesh(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(group.children, true);
    if (hits.length) {
      const root = partRoot(hits[0].object);
      if (root) return root;
    }

    if (asm.active) return null;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    let best = null;
    let bestD = 18;
    for (const mesh of group.children) {
      const part = mesh.userData.part;
      if (!part) continue;
      _a.set(part.from[0] * MM, part.from[1] * MM, part.from[2] * MM);
      _b.set(part.to[0] * MM, part.to[1] * MM, part.to[2] * MM);
      const A = projectPx(_a, rect);
      const B = projectPx(_b, rect);
      if (A.behind && B.behind) continue;
      const d = distToSeg(px, py, A.x, A.y, B.x, B.y);
      if (d < bestD) {
        bestD = d;
        best = mesh;
      }
    }
    return best;
  }

  function focusOn(mesh) {
    const part = mesh.userData.part;
    if (!part) return;
    const mid = new THREE.Vector3(
      ((part.from[0] + part.to[0]) / 2) * MM,
      ((part.from[1] + part.to[1]) / 2) * MM,
      ((part.from[2] + part.to[2]) / 2) * MM,
    );
    if (asm.active) mid.copy(mesh.position);
    const span = Math.max((part.length || 80) * MM, (part.profile?.w || 20) * MM, 0.12);
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(1, 0.45, 1);
    dir.normalize();
    aim.target.copy(mid);
    aim.pos.copy(mid).addScaledVector(dir, Math.max(span * 2.6, 0.6));
    aim.on = true;
  }

  function focusHome() {
    if (!home.ready) {
      aim.on = false;
      return;
    }
    aim.pos.copy(home.pos);
    aim.target.copy(home.target);
    aim.on = true;
  }

  function highlightPart(id) {
    const next = meshById(id);
    if (next === hoverMesh) return;
    hoverMesh = next;
    paintHighlight();
    renderer.domElement.style.cursor = hoverMesh ? "pointer" : "";
  }

  function selectPart(id) {
    const next = meshById(id);
    const changed = next !== pinMesh;
    pinMesh = next;
    paintHighlight();
    if (!changed) return;
    if (pinMesh) focusOn(pinMesh);
    else focusHome();
  }

  controls.addEventListener("start", () => {
    aim.on = false;
    asm.holdUntil = Infinity;
  });
  controls.addEventListener("end", () => {
    asm.viewDir.copy(camera.position).sub(controls.target).normalize();
    asm.holdUntil = performance.now() + 4000;
  });

  renderer.domElement.addEventListener("pointermove", (event) => {
    const mesh = pickMesh(event.clientX, event.clientY);
    const id = mesh?.userData.part?.id || null;
    if (id === lastHoverId) return;
    lastHoverId = id;
    pickHandlers.onHover?.(id);
  });
  renderer.domElement.addEventListener("pointerleave", () => {
    if (!lastHoverId) return;
    lastHoverId = null;
    pickHandlers.onHover?.(null);
  });
  renderer.domElement.addEventListener("pointerdown", (event) => {
    pointerDown = { x: event.clientX, y: event.clientY };
  });
  renderer.domElement.addEventListener("pointerup", (event) => {
    if (!pointerDown) return;
    const dx = event.clientX - pointerDown.x;
    const dy = event.clientY - pointerDown.y;
    pointerDown = null;
    if (dx * dx + dy * dy > 25) return;
    const mesh = pickMesh(event.clientX, event.clientY);
    const id = mesh?.userData.part?.id || null;
    pickHandlers.onSelect?.(id);
    lastHoverId = null;
    const still = pickMesh(event.clientX, event.clientY);
    lastHoverId = still?.userData.part?.id || null;
    pickHandlers.onHover?.(lastHoverId);
  });

  // ---------------------------------------------------------------- ensamble
  const SPEED_ASM = { lenta: 0.5, normal: 1, rapida: 2.6 };
  const Q_LIE = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
  const ghostMat = new THREE.MeshBasicMaterial({
    color: 0xe8c372,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  sharedMats.add(ghostMat);

  const asmGroup = new THREE.Group();
  asmGroup.visible = false;
  scene.add(asmGroup);

  const asm = {
    active: false,
    items: [],
    welds: [],
    steps: [],
    events: [],
    evIndex: 0,
    T: 0,
    total: 0,
    playing: false,
    speed: "normal",
    last: 0,
    lastNotify: 0,
    lastStep: -2,
    holdUntil: 0,
    viewDir: new THREE.Vector3(0.45, 0.6, 1).normalize(),
    cutX: 0,
    gateBox: null,
    layoutBox: null,
    fullBox: null,
    grinder: null,
    onChange: null,
  };

  const ease = (t) => t * t * (3 - 2 * t);
  const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  function makeLabel(text) {
    const cv = document.createElement("canvas");
    cv.width = 512;
    cv.height = 96;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "rgba(30,26,22,0.82)";
    ctx.beginPath();
    ctx.roundRect(4, 4, 504, 88, 14);
    ctx.fill();
    ctx.fillStyle = "#f4ead8";
    ctx.font = "600 34px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 22, 50, 470);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sprite.scale.set(0.62, 0.116, 1);
    sprite.renderOrder = 10;
    return sprite;
  }

  function makeGrinder() {
    const g = new THREE.Group();
    const tilt = new THREE.Group();
    tilt.rotation.z = Math.PI / 2;
    const spin = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.0025, 40), zinc);
    spin.add(disc);
    for (let i = 0; i < 4; i++) {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.003, 0.004), dark);
      const a = (i * Math.PI) / 2;
      mark.position.set(Math.cos(a) * 0.032, 0, Math.sin(a) * 0.032);
      mark.rotation.y = -a;
      spin.add(mark);
    }
    tilt.add(spin);
    g.add(tilt);
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.022, 28, 1, false, 0, Math.PI), rust);
    guard.rotation.z = Math.PI / 2;
    guard.position.y = 0.004;
    g.add(guard);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.075), rust);
    body.position.set(0, 0.095, 0);
    g.add(body);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.17, 12), dark);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, 0.105, 0.12);
    g.add(handle);
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    g.userData.spin = spin;
    g.userData.outer = g;
    return g;
  }

  function clearAssembly() {
    clearGroup(asmGroup);
    asm.items = [];
    asm.welds = [];
    asm.steps = [];
    asm.events = [];
    asm.grinder = null;
    asm.T = 0;
    asm.total = 0;
    asm.playing = false;
  }

  function buildAssembly(joints) {
    clearAssembly();
    const src = group.children.filter((m) => m.userData.part);
    if (!src.length) return;
    const box = new THREE.Box3().setFromObject(group);
    const floorY = box.min.y;
    const cx = (box.min.x + box.max.x) / 2;

    const items = src.map((mesh) => {
      const part = mesh.userData.part;
      const hw = mesh.userData.kind !== "member";
      const guia = part.role === "guia";
      return {
        id: part.id,
        mesh,
        part,
        hw,
        guia,
        orden: part.orden ?? 80,
        etiqueta: part.etiqueta || part.role || "pieza",
        hoja: leafKey(part.id) === "b" ? 1 : 0,
        restPos: (mesh.userData.restPos || mesh.position).clone(),
        restQuat: mesh.quaternion.clone(),
        lay: new THREE.Vector3(),
        layQuat: new THREE.Quaternion(),
        cut: null,
        move: null,
        stub: null,
        ghost: null,
        len: (part.length || 0) * MM,
      };
    });
    const byId = new Map(items.map((it) => [it.id, it]));
    const cuttable = items.filter((it) => !it.hw);
    const hardware = items.filter((it) => it.hw);

    // ---- layout de taller: barras sobre el piso, agrupadas por medida
    const maxLen = Math.max(0.6, ...cuttable.map((it) => it.len));
    const RX = cx + maxLen / 2;
    const groups = new Map();
    for (const it of cuttable) {
      const key = `${it.orden}|${it.etiqueta}|${it.part.profile.id}|${Math.round(it.part.length)}`;
      if (!groups.has(key)) {
        groups.set(key, { key, orden: it.orden, etiqueta: it.etiqueta, largo: Math.round(it.part.length), perfil: it.part.profile.nombre, items: [] });
      }
      groups.get(key).items.push(it);
    }
    const ordered = [...groups.values()].sort((a, b) => a.orden - b.orden || b.largo - a.largo);
    let z = box.max.z + 0.6;
    const zStart = z;
    for (const g of ordered) {
      const pitch = Math.max(g.items[0].part.profile.d, 10) * MM + 0.028;
      g.z0 = z;
      g.items.forEach((it, k) => {
        it.lay.set(RX - it.len / 2, floorY + it.part.profile.w * MM * 0.5, z + k * pitch);
        it.layQuat.copy(Q_LIE);
        it.group = g;
      });
      g.z1 = z + g.items.length * pitch;
      z = g.z1 + 0.1;
    }
    let hx = cx - 0.6;
    const hz = z + 0.15;
    for (const it of hardware) {
      it.lay.set(hx, floorY + 0.06, hz);
      it.layQuat.copy(it.restQuat);
      hx += 0.26;
    }
    const zEnd = hardware.length ? hz + 0.2 : z;

    asm.layoutBox = new THREE.Box3(
      new THREE.Vector3(RX - maxLen - 0.2, floorY, zStart - 0.1),
      new THREE.Vector3(RX + 0.9, floorY + 0.3, zEnd),
    );
    asm.fullBox = box.clone().union(asm.layoutBox);
    asm.gateBox = box.clone();
    asm.cutX = RX + 0.002;

    // ---- piezas auxiliares: tramo de barra, fantasma y rótulos
    const stubLen = 0.4;
    for (const it of cuttable) {
      const stub = new THREE.Mesh(memberGeometry(it.part, stubLen, 2), steel);
      stub.castShadow = true;
      stub.quaternion.copy(Q_LIE);
      stub.position.set(RX + 0.004 + stubLen / 2, it.lay.y, it.lay.z);
      asmGroup.add(stub);
      it.stub = stub;
      const ghost = new THREE.Mesh(it.mesh.geometry, ghostMat);
      ghost.position.copy(it.restPos);
      ghost.quaternion.copy(it.restQuat);
      ghost.visible = false;
      asmGroup.add(ghost);
      it.ghost = ghost;
    }
    for (const g of ordered) {
      const n = g.items.length;
      const label = makeLabel(`${n > 1 ? `${n} × ` : ""}${g.etiqueta} · ${g.largo} mm`);
      label.position.set(RX + stubLen + 0.42, floorY + 0.07, (g.z0 + g.z1) / 2 - 0.05);
      asmGroup.add(label);
      g.label = label;
    }
    if (hardware.length) {
      const label = makeLabel("herrajes (se compran hechos)");
      label.position.set(cx - 0.3, floorY + 0.2, hz);
      asmGroup.add(label);
      asm.hwLabel = label;
    } else {
      asm.hwLabel = null;
    }

    // ---- uniones de soldadura: cordón con ondas + dos punteos
    const coldColor = new THREE.Color(0x4a4f57);
    const hotColor = new THREE.Color(0xff7a22);
    const welds = [];
    for (const j of joints || []) {
      const ia = byId.get(j.a);
      const ib = byId.get(j.b);
      if (!ia || !ib) continue;
      const a = new THREE.Vector3(j.from_w[0] * MM, j.from_w[1] * MM, j.from_w[2] * MM);
      const b = new THREE.Vector3(j.to_w[0] * MM, j.to_w[1] * MM, j.to_w[2] * MM);
      const dir = new THREE.Vector3().subVectors(b, a);
      const length = Math.max(dir.length(), 0.008);
      const n = dir.clone().normalize();
      const radius = THREE.MathUtils.clamp(j.fillet_mm * 0.0007, 0.0048, 0.009);
      const mat = beadCold.clone();
      mat.color.copy(hotColor);
      mat.emissive.copy(hotColor);
      mat.emissiveIntensity = 1.6;
      const bead = new THREE.Mesh(beadGeometry(length, radius), mat);
      bead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      bead.castShadow = true;
      bead.visible = false;
      const tacks = [a, b].map((p) => {
        const t = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.15, 10, 8), mat);
        t.scale.y = 0.7;
        t.position.copy(p);
        t.visible = false;
        asmGroup.add(t);
        return t;
      });
      asmGroup.add(bead);
      welds.push({ joint: j, a, n, length, bead, tacks, mat, ia, ib, start: 0, dur: 1 });
    }
    welds.sort((p, q) => p.joint.orden - q.joint.orden);
    asm.welds = welds;
    asm.items = items;
    asm.coldColor = coldColor;
    asm.hotColor = hotColor;

    const grinder = makeGrinder();
    grinder.visible = false;
    asmGroup.add(grinder);
    asm.grinder = grinder;

    buildTimeline(ordered, items, welds, RX, floorY);
  }

  function bucketOf(it) {
    if (it.hw) return { key: 10099, name: "herrajes", phase: "Herrajes" };
    if (it.guia) return { key: 10095, name: "rieles", phase: "Colocación" };
    const b = it.orden <= 35 ? 10 : it.orden <= 50 ? 50 : it.orden <= 55 ? 55 : it.orden <= 60 ? 60 : it.orden <= 70 ? 70 : 80;
    return { key: it.hoja * 100 + b, name: b === 10 ? "marco" : it.etiqueta, phase: "Armado" };
  }

  function buildTimeline(ordered, items, welds, RX, floorY) {
    const steps = [];
    const events = [];
    let cursor = 0.4;
    const GAP = 0.25;
    const push = (st) => {
      st.start = cursor;
      st.len = st.dur + st.stagger * (st.list.length - 1);
      cursor += st.len + GAP;
      steps.push(st);
      return st;
    };
    const itemStart = (st, i) => st.start + i * st.stagger;

    // 1) cortes
    for (const g of ordered) {
      const singles = g.items.length <= 2 ? g.items.length : 2;
      const rest = g.items.slice(singles);
      const mitre = g.items[0].mesh.userData.miter > 0.05;
      const cable = /cable/.test(g.perfil);
      for (let i = 0; i < singles; i++) {
        const it = g.items[i];
        const st = push({
          type: "cut",
          phase: "Corte",
          single: true,
          list: [it],
          dur: 1.9,
          stagger: 0,
          label: `Cortar ${g.etiqueta} de ${g.largo} mm · ${g.perfil}${mitre ? " · a inglete" : ""}${cable ? " · cortar recto, sin soldar" : ""}`,
        });
        it.cut = { start: st.start, dur: st.dur };
        const x = RX + 0.002;
        for (let t = 0.2; t < 0.66; t += 0.035) {
          events.push({ t: st.start + st.dur * t, pos: new THREE.Vector3(x, floorY + 0.02, it.lay.z), kind: "cut" });
        }
      }
      if (rest.length) {
        const st = push({
          type: "cut",
          phase: "Corte",
          list: rest,
          dur: 0.9,
          stagger: 0.14,
          label: `Cortar las ${rest.length} ${g.etiqueta} restantes de ${g.largo} mm · todas iguales`,
        });
        rest.forEach((it, i) => {
          const s0 = itemStart(st, i);
          it.cut = { start: s0, dur: st.dur };
          for (let t = 0.2; t < 0.66; t += 0.12) {
            events.push({ t: s0 + st.dur * t, pos: new THREE.Vector3(RX + 0.002, floorY + 0.02, it.lay.z), kind: "cut" });
          }
        });
      }
    }

    // 2) armado por etapas + soldadura
    const buckets = new Map();
    for (const it of items) {
      const b = bucketOf(it);
      if (!buckets.has(b.key)) buckets.set(b.key, { ...b, items: [] });
      buckets.get(b.key).items.push(it);
    }
    const placed = new Set();
    const scheduled = new Set();
    for (const bucket of [...buckets.values()].sort((a, b) => a.key - b.key)) {
      const list = bucket.items.sort(
        (p, q) => p.restPos.x - q.restPos.x || p.restPos.y - q.restPos.y,
      );
      const singles = list.length <= 4 ? list.length : 2;
      const mkLabel = (it) =>
        bucket.name === "herrajes"
          ? `Colocar ${it.etiqueta}`
          : bucket.name === "rieles"
            ? `Colocar ${it.etiqueta} (se fija en obra)`
            : `Colocar ${it.etiqueta}`;
      for (let i = 0; i < singles; i++) {
        const st = push({ type: "move", phase: bucket.phase, list: [list[i]], dur: 1.4, stagger: 0, label: mkLabel(list[i]) });
        list[i].move = { start: st.start, dur: st.dur };
        placed.add(list[i].id);
      }
      const rest = list.slice(singles);
      if (rest.length) {
        const st = push({
          type: "move",
          phase: bucket.phase,
          list: rest,
          dur: 1.3,
          stagger: 0.11,
          label: `Colocar ${rest.length} ${rest[0].etiqueta} más, a plomo y a escuadra`,
        });
        rest.forEach((it, i) => {
          it.move = { start: itemStart(st, i), dur: st.dur };
          placed.add(it.id);
        });
      }
      const ready = welds.filter((w) => !scheduled.has(w) && placed.has(w.joint.a) && placed.has(w.joint.b));
      ready.forEach((w) => scheduled.add(w));
      const wSingles = Math.min(ready.length, 3);
      const setWeld = (w, start, dur, quick) => {
        w.start = start;
        w.dur = dur;
        const step = quick ? 0.12 : 0.07;
        events.push({ t: start + dur * 0.05, pos: w.a.clone(), kind: "weld" });
        for (let q = 0.3; q < 1; q += step) {
          events.push({ t: start + dur * q, pos: w.a.clone().addScaledVector(w.n, w.length * ((q - 0.3) / 0.7)), kind: "weld" });
        }
      };
      for (let i = 0; i < wSingles; i++) {
        const st = push({
          type: "weld",
          phase: "Soldadura",
          list: [ready[i]],
          dur: 1.7,
          stagger: 0,
          label: `Puntear y soldar · ${ready[i].joint.note}`,
        });
        setWeld(ready[i], st.start, st.dur, false);
      }
      for (let i = wSingles; i < ready.length; i += 16) {
        const chunk = ready.slice(i, i + 16);
        const notes = [...new Set(chunk.map((w) => w.joint.note))].slice(0, 2).join(" / ");
        const st = push({
          type: "weld",
          phase: "Soldadura",
          list: chunk,
          dur: 1.0,
          stagger: 0.1,
          label: `Puntear y soldar ${chunk.length} uniones · ${notes}`,
        });
        chunk.forEach((w, k) => setWeld(w, itemStart(st, k), st.dur, true));
      }
    }
    // uniones que quedaron sin resolver (p. ej. con herrajes)
    const left = welds.filter((w) => !scheduled.has(w));
    if (left.length) {
      const st = push({ type: "weld", phase: "Soldadura", list: left, dur: 1.0, stagger: 0.1, label: `Soldar ${left.length} uniones restantes` });
      left.forEach((w, k) => {
        w.start = itemStart(st, k);
        w.dur = st.dur;
      });
    }
    events.sort((p, q) => p.t - q.t);
    asm.steps = steps;
    asm.events = events;
    asm.total = cursor + 0.5;
    asm.T = 0;
    asm.evIndex = 0;
  }

  function beadGeometry(length, radius) {
    const geo = new THREE.CylinderGeometry(radius, radius, length, 12, 28);
    const pos = geo.attributes.position;
    const waves = Math.max(3, Math.round(length / 0.0042));
    for (let i = 0; i < pos.count; i++) {
      const t = THREE.MathUtils.clamp(pos.getY(i) / length + 0.5, 0.001, 0.999);
      const taper = Math.pow(Math.sin(Math.PI * t), 0.35);
      const noise = 0.04 * Math.sin(t * 91.7 + radius * 4000);
      const k = taper * (1 + 0.15 * Math.sin(t * waves * Math.PI * 2) + noise);
      pos.setX(i, pos.getX(i) * k);
      pos.setZ(i, pos.getZ(i) * k * 0.85);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function currentStep() {
    let idx = -1;
    for (let i = 0; i < asm.steps.length; i++) {
      if (asm.steps[i].start <= asm.T + 1e-6) idx = i;
      else break;
    }
    return idx;
  }

  function applyAssembly() {
    const T = asm.T;
    const reduce = reduceMotion();
    for (const it of asm.items) {
      let slide = 0;
      if (it.cut) {
        const u = THREE.MathUtils.clamp((T - it.cut.start - 0.6 * it.cut.dur) / (0.4 * it.cut.dur), 0, 1);
        slide = (reduce ? (u > 0 ? 1 : 0) : ease(u)) * 0.06;
      }
      const from = _a.copy(it.lay);
      from.x -= slide;
      const pm = it.move ? THREE.MathUtils.clamp((T - it.move.start) / it.move.dur, 0, 1) : 0;
      const e = reduce ? (pm > 0 ? 1 : 0) : ease(pm);
      const target = it.hw || it.guia ? it.mesh : it.mesh;
      target.position.lerpVectors(from, it.restPos, e);
      if (pm > 0 && pm < 1 && !reduce) target.position.y += 0.3 * Math.sin(Math.PI * e);
      target.quaternion.slerpQuaternions(it.layQuat, it.restQuat, e);
      if (it.stub) it.stub.visible = pm < 0.5;
      if (it.ghost) it.ghost.visible = pm > 0 && pm < 1;
    }
    for (const g of new Set(asm.items.map((i) => i.group).filter(Boolean))) {
      g.label.visible = g.items.some((it) => !it.move || T < it.move.start + it.move.dur * 0.6);
    }
    if (asm.hwLabel) {
      const hw = asm.items.filter((i) => i.hw);
      asm.hwLabel.visible = hw.some((it) => !it.move || T < it.move.start + it.move.dur * 0.6);
    }

    let activeWeld = null;
    let activeQ = 0;
    for (const w of asm.welds) {
      const q = THREE.MathUtils.clamp((T - w.start) / w.dur, 0, 1);
      const started = T >= w.start && w.start > 0;
      const tackS = THREE.MathUtils.clamp((q - 0.04) / 0.1, 0, 1);
      for (const t of w.tacks) {
        t.visible = started && tackS > 0;
        t.scale.set(tackS, 0.7 * tackS, tackS);
      }
      const grow = THREE.MathUtils.clamp((q - 0.3) / 0.7, 0, 1);
      w.bead.visible = started && grow > 0;
      if (w.bead.visible) {
        const s = Math.max(0.03, ease(grow));
        w.bead.scale.set(1, s, 1);
        w.bead.position.copy(w.a).addScaledVector(w.n, (w.length * s) / 2);
      }
      const cool = q >= 1 ? THREE.MathUtils.clamp((T - (w.start + w.dur)) / 1.8, 0, 1) : 0;
      w.mat.color.lerpColors(asm.hotColor, asm.coldColor, ease(cool));
      w.mat.emissive.copy(asm.hotColor);
      w.mat.emissiveIntensity = 1.6 * (1 - ease(cool));
      if (started && q > 0.03 && q < 1) {
        activeWeld = w;
        activeQ = q;
      }
    }

    let light = 0;
    if (activeWeld) {
      const grow = THREE.MathUtils.clamp((activeQ - 0.3) / 0.7, 0, 1);
      sparkLight.position.copy(activeWeld.a).addScaledVector(activeWeld.n, activeWeld.length * grow);
      light = 5 * (1 - 0.5 * activeQ);
    }
    let grind = null;
    for (const st of asm.steps) {
      if (st.type === "cut" && st.single && T >= st.start && T <= st.start + st.dur * 0.88) {
        grind = { st, u: (T - st.start) / st.dur };
        break;
      }
    }
    const gr = asm.grinder;
    if (gr) {
      gr.visible = Boolean(grind);
      if (grind) {
        const it = grind.st.list[0];
        const u = grind.u;
        const lift = u < 0.2 ? 1 - ease(u / 0.2) : u > 0.66 ? ease((u - 0.66) / 0.22) : 0;
        gr.position.set(it.lay.x + it.len / 2 + 0.002, it.lay.y - it.part.profile.w * MM * 0.5 + 0.047, it.lay.z);
        gr.position.y += 0.17 * lift;
        gr.rotation.z = it.mesh.userData.miter > 0.05 ? it.mesh.userData.miter : 0;
        gr.userData.spin.rotation.y = T * 70;
        if (u > 0.2 && u < 0.66) {
          light = 3;
          sparkLight.position.set(gr.position.x, gr.position.y - 0.03, gr.position.z);
        }
      }
    }
    sparkLight.intensity = light;
  }

  function fireEvents(from, to) {
    const ev = asm.events;
    while (asm.evIndex < ev.length && ev[asm.evIndex].t <= to) {
      const e = ev[asm.evIndex++];
      if (e.t > from) emitSparks(e.pos, e.kind === "cut" ? 7 : 5, e.kind === "cut" ? 1.5 : 1);
    }
  }

  function seekEvents() {
    asm.evIndex = 0;
    while (asm.evIndex < asm.events.length && asm.events[asm.evIndex].t <= asm.T) asm.evIndex++;
  }

  function notifyAsm(force) {
    if (!asm.onChange) return;
    const now = performance.now();
    if (!force && now - asm.lastNotify < 60) return;
    asm.lastNotify = now;
    const i = currentStep();
    const st = asm.steps[i];
    asm.onChange({
      mode: "ensamble",
      index: i + 1,
      total: asm.steps.length,
      label: st?.label || "Barras sobre el piso · todavía sin cortar",
      phase: st?.phase || "Inicio",
      playing: asm.playing,
      done: asm.total > 0 && asm.T >= asm.total - 0.001,
      frac: asm.total ? asm.T / asm.total : 0,
    });
  }

  function aimBox(box) {
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const span = Math.max(size.x, size.y, size.z, 0.8);
    aim.target.copy(center);
    aim.pos.set(center.x + span * 0.55, center.y + span * 0.75, center.z + span * 1.0);
    aim.on = true;
    camera.far = Math.max(camera.far, span * 20);
    camera.updateProjectionMatrix();
  }

  function enterAssembly() {
    if (!asm.steps.length && !asm.items.length) return;
    asm.active = true;
    asmGroup.visible = true;
    asm.T = 0;
    asm.playing = false;
    asm.last = performance.now();
    asm.lastStep = -2;
    seekEvents();
    applyAssembly();
    if (asm.fullBox) aimBox(asm.fullBox);
    notifyAsm(true);
  }

  function exitAssembly() {
    asm.active = false;
    asm.playing = false;
    asmGroup.visible = false;
    for (const it of asm.items) {
      it.mesh.position.copy(it.restPos);
      it.mesh.quaternion.copy(it.restQuat);
    }
    sparkLight.intensity = 0;
    clearSparks();
  }

  function setAssembly(joints, onChange) {
    if (onChange) asm.onChange = onChange;
    const was = asm.active;
    buildAssembly(joints);
    if (was) {
      asm.active = true;
      asmGroup.visible = true;
      asm.last = performance.now();
      seekEvents();
      applyAssembly();
      if (asm.fullBox) aimBox(asm.fullBox);
    }
    notifyAsm(true);
  }

  function playAsm() {
    if (!asm.active || !asm.total) return;
    if (asm.T >= asm.total - 0.001) {
      asm.T = 0;
      seekEvents();
    }
    asm.playing = true;
    asm.holdUntil = 0;
    asm.last = performance.now();
    notifyAsm(true);
  }

  function pauseAsm() {
    asm.playing = false;
    notifyAsm(true);
  }

  function jumpAsm(T) {
    asm.T = THREE.MathUtils.clamp(T, 0, asm.total);
    asm.playing = false;
    asm.holdUntil = 0;
    seekEvents();
    clearSparks();
    applyAssembly();
    if (asm.T > 0) followAsm(false);
    notifyAsm(true);
  }

  function stepAsm(dir) {
    if (!asm.active) return;
    const i = currentStep();
    if (dir > 0) {
      const cur = asm.steps[i];
      const end = cur ? cur.start + cur.len : 0;
      if (cur && asm.T < end - 1e-3) return jumpAsm(end);
      const next = asm.steps[i + 1];
      return jumpAsm(next ? next.start + next.len : asm.total);
    }
    const cur = asm.steps[i];
    if (cur && asm.T > cur.start + 0.05) return jumpAsm(cur.start);
    jumpAsm(asm.steps[i - 1] ? asm.steps[i - 1].start : 0);
  }

  function seekAsm(frac) {
    if (!asm.active) return;
    jumpAsm(THREE.MathUtils.clamp(Number(frac) || 0, 0, 1) * asm.total);
  }

  const _f = new THREE.Vector3();
  const _g = new THREE.Vector3();

  function followTarget(st) {
    const T = asm.T;
    const gate = asm.gateBox;
    const gateSpan = gate ? Math.max(...gate.getSize(_g).toArray(), 0.8) : 1.5;
    const gateCenter = gate ? gate.getCenter(new THREE.Vector3()) : new THREE.Vector3();
    const first = st.list[0];
    if (st.type === "cut") {
      const x = asm.cutX;
      if (st.single) return { p: new THREE.Vector3(x, first.lay.y, first.lay.z), dist: 1.0 };
      const mid = st.list[Math.floor(st.list.length / 2)];
      const zs = st.list.map((it) => it.lay.z);
      const z = (Math.min(...zs) + Math.max(...zs)) / 2;
      return { p: new THREE.Vector3(x - 0.3, first.lay.y, z), dist: Math.max(1.6, (Math.max(...zs) - Math.min(...zs)) * 1.6 + mid.len * 0.25) };
    }
    if (st.type === "weld") {
      if (st.list.length === 1) {
        const w = st.list[0];
        const q = THREE.MathUtils.clamp((T - w.start) / w.dur, 0, 1);
        const grow = THREE.MathUtils.clamp((q - 0.3) / 0.7, 0, 1);
        return { p: w.a.clone().addScaledVector(w.n, w.length * grow), dist: 0.75 };
      }
      const active = st.list.filter((w) => T >= w.start && T <= w.start + w.dur);
      const pool = active.length ? active : st.list;
      const c = new THREE.Vector3();
      for (const w of pool) c.add(w.a);
      c.divideScalar(pool.length);
      return { p: c, dist: Math.max(1.2, gateSpan * 0.85) };
    }
    // colocar piezas: seguir a la pieza que vuela, sin perder el portón
    let moving = st.list.find((it) => it.move && T >= it.move.start && T <= it.move.start + it.move.dur);
    moving = moving || (T < st.start + st.len / 2 ? first : st.list[st.list.length - 1]);
    _f.copy(moving.mesh.position);
    const p = new THREE.Vector3().lerpVectors(_f, gateCenter, 0.45);
    const far = _f.distanceTo(gateCenter);
    return { p, dist: Math.max(gateSpan * 1.25, 1.8, far * 0.9) };
  }

  function followAsm(snap) {
    if (!asm.active || asm.holdUntil > performance.now()) return;
    const st = asm.steps[currentStep()];
    if (!st) return;
    const { p, dist } = followTarget(st);
    const dir = asm.viewDir;
    aim.target.copy(p);
    aim.pos.copy(p).addScaledVector(dir, dist);
    aim.on = true;
    if (snap) {
      controls.target.copy(aim.target);
      camera.position.copy(aim.pos);
    }
  }

  function tickAsm(now) {
    if (!asm.active) return;
    const dt = Math.min(0.1, (now - asm.last) / 1000);
    asm.last = now;
    if (!asm.playing) return;
    const prev = asm.T;
    asm.T = Math.min(asm.total, asm.T + dt * (SPEED_ASM[asm.speed] || 1));
    fireEvents(prev, asm.T);
    applyAssembly();
    followAsm(false);
    if (asm.T >= asm.total) {
      asm.playing = false;
      notifyAsm(true);
    } else {
      notifyAsm(false);
    }
  }

  // ---------------------------------------------------------------- chispas
  const SPARKS = 160;
  const sparkPos = new Float32Array(SPARKS * 3).fill(-1000);
  const sparkVel = new Float32Array(SPARKS * 3);
  const sparkLife = new Float32Array(SPARKS);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({
    color: 0xffc266,
    size: 0.011,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  sharedMats.add(sparkMat);
  const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
  sparkPoints.frustumCulled = false;
  scene.add(sparkPoints);
  let sparkCursor = 0;

  function emitSparks(at, n, power = 1) {
    for (let k = 0; k < n; k++) {
      const i = sparkCursor;
      sparkCursor = (sparkCursor + 1) % SPARKS;
      sparkPos[i * 3] = at.x;
      sparkPos[i * 3 + 1] = at.y;
      sparkPos[i * 3 + 2] = at.z;
      sparkVel[i * 3] = (Math.random() - 0.5) * 1.3 * power;
      sparkVel[i * 3 + 1] = (0.4 + Math.random() * 1.1) * power;
      sparkVel[i * 3 + 2] = (Math.random() - 0.3) * 1.3 * power;
      sparkLife[i] = 0.35 + Math.random() * 0.45;
    }
  }

  function clearSparks() {
    sparkPos.fill(-1000);
    sparkLife.fill(0);
    sparkGeo.attributes.position.needsUpdate = true;
  }

  let sparkLast = 0;
  function updateSparks(now) {
    const dt = Math.min(0.05, (now - sparkLast) / 1000);
    sparkLast = now;
    let any = false;
    for (let i = 0; i < SPARKS; i++) {
      if (sparkLife[i] <= 0) continue;
      any = true;
      sparkLife[i] -= dt;
      if (sparkLife[i] <= 0) {
        sparkPos[i * 3 + 1] = -1000;
        continue;
      }
      sparkVel[i * 3 + 1] -= 4.2 * dt;
      sparkPos[i * 3] += sparkVel[i * 3] * dt;
      sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
      sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
    }
    if (any) sparkGeo.attributes.position.needsUpdate = true;
  }

  function setParts(parts, spec, meta) {
    resist.spec = spec || resist.spec;
    resist.arriostrado = Boolean(meta?.arriostrado);
    resist.parantes = Number(meta?.parantes) || 0;
    resist.playing = false;
    resist.load = 0;
    hoverMesh = null;
    pinMesh = null;
    lastHoverId = null;
    aim.on = false;
    clearHighlight();
    renderer.domElement.style.cursor = "";
    clearGroup(group);
    if (asm.items.length) clearAssembly();
    for (const part of parts) addPart(part);
    group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    buildLeaves(parts, resist.spec);
    applyDeform();
    frame();
    notifyResist(true);
  }

  function setJoints(joints, onChange) {
    player.playing = false;
    player.phase = "idle";
    player.index = 0;
    player.mesh = null;
    player.tacks = [];
    player.joints = Array.isArray(joints) ? joints : [];
    if (onChange) player.onChange = onChange;
    sparkLight.intensity = 0;
    clearGroup(weldsGroup);
    notify();
  }

  function play() {
    if (resist.mode !== "soldar") return;
    if (!player.joints.length) return;
    if (player.index >= player.joints.length) {
      restart();
    }
    player.playing = true;
    if (player.phase === "idle") startJoint();
    notify();
  }

  function pause() {
    player.playing = false;
    notify();
  }

  function step() {
    if (resist.mode !== "soldar") return;
    player.playing = false;
    if (player.phase !== "idle") {
      finishBead();
      notify();
      return;
    }
    if (player.index >= player.joints.length) {
      restart();
      return;
    }
    startJoint();
    const joint = player.joints[player.index];
    if (player.mesh && joint) setBeadScale(player.mesh, 1);
    finishBead();
    notify();
  }

  function restart() {
    player.playing = false;
    player.phase = "idle";
    player.index = 0;
    player.mesh = null;
    player.tacks = [];
    sparkLight.intensity = 0;
    clearGroup(weldsGroup);
    notify();
  }

  function setSpeed(speed) {
    player.speed = SPEEDS[speed] ? speed : "normal";
  }

  function setMode(mode) {
    const next = mode === "resistencia" ? "resistencia" : mode === "ensamble" ? "ensamble" : "soldar";
    if (next === resist.mode) return;
    if (resist.mode === "ensamble") exitAssembly();
    resist.mode = next;
    resist.playing = false;
    weldsGroup.visible = next === "soldar";
    if (next !== "soldar") {
      player.playing = false;
      sparkLight.intensity = 0;
    }
    if (next !== "resistencia") resist.load = 0;
    applyDeform();
    if (next === "ensamble") enterAssembly();
    else if (home.ready) focusHome();
    notify();
    notifyResist(true);
  }

  function setResistChange(onChange) {
    resist.onChange = onChange;
    notifyResist(true);
  }

  function playResist() {
    if (resist.mode !== "resistencia") setMode("resistencia");
    const w = (2 * Math.PI) / (RESIST_PERIOD / 1000);
    const c = THREE.MathUtils.clamp(1 - 2 * resist.load, -1, 1);
    resist.t0 = performance.now() - (Math.acos(c) / w) * 1000;
    resist.playing = true;
    notifyResist(true);
  }

  function pauseResist() {
    resist.playing = false;
    notifyResist(true);
  }

  function setLoad(value) {
    resist.playing = false;
    resist.load = clamp01(Number(value) || 0);
    if (resist.mode === "resistencia") applyDeform();
    notifyResist(true);
  }

  function resetResist() {
    resist.playing = false;
    resist.load = 0;
    applyDeform();
    notifyResist(true);
  }

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function tick(now) {
    if (aim.on) {
      camera.position.lerp(aim.pos, 0.16);
      controls.target.lerp(aim.target, 0.16);
      if (camera.position.distanceTo(aim.pos) < 0.01 && controls.target.distanceTo(aim.target) < 0.01) {
        aim.on = false;
      }
    }
    controls.update();
    if (resist.mode === "resistencia" && resist.playing) {
      const w = (2 * Math.PI) / (RESIST_PERIOD / 1000);
      resist.load = (1 - Math.cos((w * (now - resist.t0)) / 1000)) / 2;
      applyDeform();
      notifyResist();
    }
    if (player.playing && player.phase !== "idle" && resist.mode === "soldar") {
      const { spark, grow } = timings();
      const elapsed = now - player.t0;
      if (player.phase === "spark") {
        sparkLight.intensity = 8 * (1 - elapsed / spark);
        if (elapsed >= spark) {
          player.phase = "grow";
          player.t0 = now;
          sparkLight.intensity = 1.5;
        }
      } else if (player.phase === "grow") {
        const p = Math.min(1, elapsed / grow);
        if (player.mesh) {
          setBeadScale(player.mesh, p);
          if (Math.random() < 0.6) {
            _p.copy(player.mesh.userData.from).addScaledVector(player.mesh.userData.dir, player.mesh.userData.length * p);
            emitSparks(_p, 2, 0.8);
          }
        }
        sparkLight.intensity = 1.5 * (1 - p);
        if (p >= 1) finishBead();
        if (player.playing && player.phase === "idle") startJoint();
      }
    }
    tickAsm(now);
    updateSparks(now);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  requestAnimationFrame(tick);

  return {
    setParts,
    setJoints,
    setAssembly,
    playAsm,
    pauseAsm,
    stepAsm,
    seekAsm,
    restartAsm() {
      if (asm.active) jumpAsm(0);
    },
    finishAsm() {
      if (asm.active) jumpAsm(asm.total);
    },
    setAsmSpeed(speed) {
      asm.speed = SPEED_ASM[speed] ? speed : "normal";
    },
    play,
    pause,
    step,
    restart,
    setSpeed,
    setMode,
    setResistChange,
    playResist,
    pauseResist,
    setLoad,
    resetResist,
    resize,
    setPickHandlers(handlers) {
      pickHandlers = handlers || {};
    },
    highlightPart,
    selectPart,
  };
}
