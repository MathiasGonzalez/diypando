import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

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
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0.5, 1, 0);

  scene.add(new THREE.AmbientLight(0xe8e2d8, 1.05));
  const key = new THREE.DirectionalLight(0xfff6ea, 1.45);
  key.position.set(2.5, 4, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc5d0dc, 0.55);
  fill.position.set(-3, 1, -2);
  scene.add(fill);

  const grid = new THREE.GridHelper(6, 30, 0x9a9084, 0xc2b9ad);
  scene.add(grid);

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
  const sharedMats = new Set([steel, rust, dark, zinc, zincDark, beadHot, beadCold]);

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
    if (part.role === "herraje" || part.role === "guia") return rust;
    if (part.role === "barrote") return steel;
    return dark;
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

  function addPart(part) {
    const a = new THREE.Vector3(part.from[0] * MM, part.from[1] * MM, part.from[2] * MM);
    const b = new THREE.Vector3(part.to[0] * MM, part.to[1] * MM, part.to[2] * MM);

    if (part.kind === "hinge") {
      addHinge(part, a);
      return;
    }
    if (part.kind === "wheel") {
      const geo = new THREE.TorusGeometry(0.04, 0.012, 10, 18);
      const mesh = new THREE.Mesh(geo, rust);
      mesh.position.copy(a);
      mesh.rotation.x = Math.PI / 2;
      mesh.userData.kind = "wheel";
      mesh.userData.part = part;
      mesh.userData.restPos = a.clone();
      group.add(mesh);
      return;
    }

    const dir = new THREE.Vector3().subVectors(b, a);
    const length = dir.length();
    if (length < 0.0005) return;
    const midPt = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const yAxis = new THREE.Vector3(0, 1, 0);
    let geo;
    if (part.kind === "round") {
      const r = (part.profile.w * MM) / 2;
      geo = new THREE.CylinderGeometry(r, r, length, 12, 18);
    } else {
      geo = new THREE.BoxGeometry(part.profile.w * MM, length, part.profile.d * MM, 1, 18, 1);
    }
    const base = materialFor(part);
    const deformable = part.role !== "guia";
    const mat = deformable ? base.clone() : base;
    if (deformable) {
      mat.vertexColors = true;
      mat.color.set(0xffffff);
    }
    const mesh = new THREE.Mesh(geo, mat);
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
      const pos = geo.attributes.position;
      mesh.userData.rest = pos.array.slice();
      const colors = new Float32Array(pos.count * 3);
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }
  }

  function frame() {
    const box = new THREE.Box3().setFromObject(group);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    grid.position.y = box.min.y;
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
      if (part.kind === "hinge" || part.kind === "wheel" || part.role === "guia") continue;
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
      if (mesh.userData.kind === "hinge" || mesh.userData.kind === "wheel") {
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
    const geo = new THREE.CylinderGeometry(0.007, 0.007, length, 10);
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
    }
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
    weldsGroup.add(player.mesh);
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
    for (const part of parts) addPart(part);
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
    sparkLight.intensity = 0;
    clearGroup(weldsGroup);
    notify();
  }

  function setSpeed(speed) {
    player.speed = SPEEDS[speed] ? speed : "normal";
  }

  function setMode(mode) {
    const next = mode === "resistencia" ? "resistencia" : "soldar";
    if (next === resist.mode) return;
    resist.mode = next;
    resist.playing = false;
    if (next === "resistencia") {
      player.playing = false;
      sparkLight.intensity = 0;
      weldsGroup.visible = false;
    } else {
      resist.load = 0;
      weldsGroup.visible = true;
    }
    applyDeform();
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
        if (player.mesh) setBeadScale(player.mesh, p);
        sparkLight.intensity = 1.5 * (1 - p);
        if (p >= 1) finishBead();
        if (player.playing && player.phase === "idle") startJoint();
      }
    }
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
