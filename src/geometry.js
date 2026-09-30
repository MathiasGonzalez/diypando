import { parsePerfil, tipoById } from "./catalog.js";

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function len(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

function mid(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

function layoutBars(inner, bar, targetLuz) {
  const n = Math.max(1, Math.floor((inner + targetLuz) / (bar + targetLuz)));
  const leftover = inner - n * bar;
  const gap = leftover / (n + 1);
  const centers = [];
  let pos = gap + bar / 2;
  for (let i = 0; i < n; i++) {
    centers.push(pos);
    pos += bar + gap;
  }
  return { n, gap, centers };
}

function addTube(parts, joints, opts) {
  const { id, role, profile, from, to, group } = opts;
  const axis = sub(to, from);
  const length = len(axis);
  if (length < 1) return;
  parts.push({
    id,
    role,
    kind: profile.shape === "round" ? "round" : "tube",
    profile: {
      id: profile.id,
      shape: profile.shape,
      w: profile.w,
      d: profile.d,
      t: profile.t,
      nombre: profile.nombre,
    },
    from,
    to,
    length,
    group: group || "estructura",
  });
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

function closestPointOnSegments(p1, p2, q1, q2) {
  const u = sub(p2, p1);
  const v = sub(q2, q1);
  const w0 = sub(p1, q1);
  const a = dot(u, u);
  const b = dot(u, v);
  const c = dot(v, v);
  const d = dot(u, w0);
  const e = dot(v, w0);
  const D = a * c - b * b;
  const EPS = 1e-6;
  let sc;
  let tc;
  if (D < EPS) {
    sc = 0;
    tc = c > EPS ? clamp01(e / c) : 0;
  } else {
    sc = clamp01((b * e - c * d) / D);
    tc = clamp01((a * e - b * d) / D);
  }
  const pa = add(p1, scale(u, sc));
  const pb = add(q1, scale(v, tc));
  return mid(pa, pb);
}

function hojaDe(id) {
  if (/-b(?:$|-)/.test(id) || id.endsWith("-b")) return 1;
  return 0;
}

function etapaDe(note) {
  if (note === "esquina inferior") return 1;
  if (note === "esquina superior") return 2;
  if (note === "travesaño a poste") return 3;
  if (note === "refuerzo") return 4;
  if (note === "tirante") return 5;
  if (note === "barrote inferior" || note === "barrote a poste") return 6;
  if (note === "barrote superior") return 7;
  if (note.startsWith("T ")) return 8;
  return 9;
}

function resolveJoints(parts, joints) {
  const byId = new Map(parts.map((p) => [p.id, p]));
  const resolved = [];
  for (const joint of joints) {
    const pa = byId.get(joint.a);
    const pb = byId.get(joint.b);
    if (!pa || !pb) continue;
    const at = closestPointOnSegments(pa.from, pa.to, pb.from, pb.to);
    const half = Math.max(14, joint.fillet_mm * 0.35);
    const from_w = [at[0], at[1], at[2] - half];
    const to_w = [at[0], at[1], at[2] + half];
    resolved.push({
      a: joint.a,
      b: joint.b,
      note: joint.note,
      fillet_mm: joint.fillet_mm,
      etapa: etapaDe(joint.note),
      hoja: Math.max(hojaDe(joint.a), hojaDe(joint.b)),
      at,
      from_w,
      to_w,
    });
  }
  resolved.sort((j, k) => {
    if (j.hoja !== k.hoja) return j.hoja - k.hoja;
    if (j.etapa !== k.etapa) return j.etapa - k.etapa;
    if (j.at[0] !== k.at[0]) return j.at[0] - k.at[0];
    return j.at[1] - k.at[1];
  });
  return resolved.map((j, i) => ({ ...j, orden: i + 1 }));
}

function weld(joints, a, b, filletMm, note) {
  joints.push({
    a,
    b,
    fillet_mm: Math.max(8, Math.round(filletMm)),
    note,
  });
}

const PANE_MAX_MM = 1500;
const PUERTA_TIRANTE_MM = 1200;
const REJA_PARANTE_MM = 1600;

function paneCount(width, height) {
  const target = Math.min(height, PANE_MAX_MM);
  return Math.max(1, Math.ceil(width / target));
}

function addTirante(parts, joints, opts) {
  const { id, profile, from, to, weldTo, fillet } = opts;
  addTube(parts, joints, {
    id,
    role: "tirante",
    profile,
    from,
    to,
    group: "marco",
  });
  const size = fillet || profile.w;
  for (const other of weldTo || []) {
    if (other) weld(joints, id, other, size, "tirante");
  }
}

function addHingeTirante(parts, joints, spec, originX, leafW, suffix, hingeSide, mw, md, hasBottom) {
  const marco = parsePerfil(spec.marco_perfil);
  const z = md / 2;
  const y0 = hasBottom ? mw : 0;
  const y1 = spec.alto - mw;
  const xIzq = originX + mw;
  const xDer = originX + leafW - mw;
  const from = hingeSide === "derecha" ? [xDer, y0, z] : [xIzq, y0, z];
  const to = hingeSide === "derecha" ? [xIzq, y1, z] : [xDer, y1, z];
  const weldTo = [`poste-izq${suffix}`, `poste-der${suffix}`, `travesano-sup${suffix}`];
  if (hasBottom) weldTo.push(`umbral${suffix}`);
  addTirante(parts, joints, {
    id: `tirante${suffix}`,
    profile: marco,
    from,
    to,
    weldTo,
    fillet: mw,
  });
}

function addCorredizoArriostrado(parts, joints, spec, mw, md) {
  const marco = parsePerfil(spec.marco_perfil);
  const z = md / 2;
  const n = paneCount(spec.ancho, spec.alto);
  const paneW = spec.ancho / n;
  const y0 = mw;
  const y1 = spec.alto - mw;

  const verticalId = (i) => {
    if (i === 0) return "poste-izq";
    if (i === n) return "poste-der";
    return `refuerzo-${i}`;
  };

  for (let i = 1; i < n; i++) {
    const id = `refuerzo-${i}`;
    addTube(parts, joints, {
      id,
      role: "refuerzo",
      profile: marco,
      from: [paneW * i, y0, z],
      to: [paneW * i, y1, z],
      group: "marco",
    });
    weld(joints, id, "umbral", mw, "refuerzo");
    weld(joints, id, "travesano-sup", mw, "refuerzo");
  }

  for (let i = 0; i < n; i++) {
    const x0 = i === 0 ? mw : paneW * i;
    const x1 = i === n - 1 ? spec.ancho - mw : paneW * (i + 1);
    addTirante(parts, joints, {
      id: `tirante-${i + 1}`,
      profile: marco,
      from: [x0, y0, z],
      to: [x1, y1, z],
      weldTo: ["umbral", "travesano-sup", verticalId(i), verticalId(i + 1)],
      fillet: mw,
    });
  }

  return { panos: n, parantes: Math.max(0, n - 1), tirantes: n };
}

function addRejaParante(parts, joints, spec, mw, md) {
  if (spec.ancho <= REJA_PARANTE_MM) return { panos: 0, parantes: 0, tirantes: 0 };
  const marco = parsePerfil(spec.marco_perfil);
  const z = md / 2;
  addTube(parts, joints, {
    id: "refuerzo-1",
    role: "refuerzo",
    profile: marco,
    from: [spec.ancho / 2, mw, z],
    to: [spec.ancho / 2, spec.alto - mw, z],
    group: "marco",
  });
  weld(joints, "refuerzo-1", "umbral", mw, "refuerzo");
  weld(joints, "refuerzo-1", "travesano-sup", mw, "refuerzo");
  return { panos: 0, parantes: 1, tirantes: 0 };
}

function needsHingeTirante(spec, leafW) {
  if (spec.tipo === "porton_dos_hojas") return true;
  if (spec.tipo === "puerta_reja_peatonal" && leafW > PUERTA_TIRANTE_MM) return true;
  return false;
}

function leafGeometry(spec, originX, leafW, suffix, hingeSide) {
  const parts = [];
  const joints = [];
  const marco = parsePerfil(spec.marco_perfil);
  const bar = parsePerfil(spec.barrote);
  const mw = marco.w;
  const md = marco.d;
  const z = md / 2;
  const hasBottom = spec.incluir_umbral || spec.tipo !== "puerta_reja_peatonal";
  const x0 = originX;
  const x1 = originX + leafW;
  const y1 = spec.alto;

  addTube(parts, joints, {
    id: `poste-izq${suffix}`,
    role: "marco",
    profile: marco,
    from: [x0 + mw / 2, 0, z],
    to: [x0 + mw / 2, y1, z],
    group: "marco",
  });
  addTube(parts, joints, {
    id: `poste-der${suffix}`,
    role: "marco",
    profile: marco,
    from: [x1 - mw / 2, 0, z],
    to: [x1 - mw / 2, y1, z],
    group: "marco",
  });
  addTube(parts, joints, {
    id: `travesano-sup${suffix}`,
    role: "marco",
    profile: marco,
    from: [x0 + mw, y1 - mw / 2, z],
    to: [x1 - mw, y1 - mw / 2, z],
    group: "marco",
  });
  weld(joints, `poste-izq${suffix}`, `travesano-sup${suffix}`, mw + md, "esquina superior");
  weld(joints, `poste-der${suffix}`, `travesano-sup${suffix}`, mw + md, "esquina superior");

  if (hasBottom) {
    addTube(parts, joints, {
      id: `umbral${suffix}`,
      role: "marco",
      profile: marco,
      from: [x0 + mw, mw / 2, z],
      to: [x1 - mw, mw / 2, z],
      group: "marco",
    });
    weld(joints, `poste-izq${suffix}`, `umbral${suffix}`, mw + md, "esquina inferior");
    weld(joints, `poste-der${suffix}`, `umbral${suffix}`, mw + md, "esquina inferior");
  }

  const innerX0 = x0 + mw;
  const innerX1 = x1 - mw;
  const innerY0 = hasBottom ? mw : 0;
  const innerY1 = y1 - mw;
  const innerW = innerX1 - innerX0;
  const innerH = innerY1 - innerY0;

  const traverseCount =
    spec.estilo === "barrotes_horizontales" ? 0 : spec.travesanos;
  const traverseYs = [];
  for (let i = 1; i <= traverseCount; i++) {
    const y = innerY0 + (innerH * i) / (traverseCount + 1);
    traverseYs.push(y);
    const id = `travesano-${i}${suffix}`;
    addTube(parts, joints, {
      id,
      role: "travesano",
      profile: marco,
      from: [innerX0, y, z],
      to: [innerX1, y, z],
      group: "marco",
    });
    weld(joints, `poste-izq${suffix}`, id, mw, "travesaño a poste");
    weld(joints, `poste-der${suffix}`, id, mw, "travesaño a poste");
  }

  const estilo = spec.estilo;
  const useVertical = estilo !== "barrotes_horizontales";
  const useHorizontal = estilo === "barrotes_horizontales";

  let actualLuz = spec.luz_mm;
  let barCount = 0;

  if (useVertical) {
    const layout = layoutBars(innerW, bar.w, spec.luz_mm);
    actualLuz = Math.round(layout.gap);
    barCount = layout.n;
    layout.centers.forEach((cx, i) => {
      const x = innerX0 + cx;
      const id = `barrote-v-${i + 1}${suffix}`;
      addTube(parts, joints, {
        id,
        role: "barrote",
        profile: bar,
        from: [x, innerY0, z],
        to: [x, innerY1, z],
        group: "barrotes",
      });
      weld(joints, id, hasBottom ? `umbral${suffix}` : `poste-izq${suffix}`, 2 * bar.w, "barrote inferior");
      weld(joints, id, `travesano-sup${suffix}`, 2 * bar.w, "barrote superior");
      for (let t = 0; t < traverseYs.length; t++) {
        weld(joints, id, `travesano-${t + 1}${suffix}`, 1.5 * bar.w, "T barrote-travesaño");
      }
    });
  }

  if (useHorizontal) {
    const layout = layoutBars(innerH, bar.w, spec.luz_mm);
    actualLuz = Math.round(layout.gap);
    barCount = layout.n;
    layout.centers.forEach((cy, i) => {
      const y = innerY0 + cy;
      const id = `barrote-h-${i + 1}${suffix}`;
      addTube(parts, joints, {
        id,
        role: "barrote",
        profile: bar,
        from: [innerX0, y, z],
        to: [innerX1, y, z],
        group: "barrotes",
      });
      weld(joints, id, `poste-izq${suffix}`, 2 * bar.w, "barrote a poste");
      weld(joints, id, `poste-der${suffix}`, 2 * bar.w, "barrote a poste");
    });
  }

  const hingeX = hingeSide === "derecha" ? x1 : x0;
  if (spec.tipo !== "reja_ventana" && spec.tipo !== "porton_corredizo") {
    const count = spec.tipo === "porton_dos_hojas" ? 3 : 3;
    for (let i = 0; i < count; i++) {
      const y = (y1 * (i + 1)) / (count + 1);
      parts.push({
        id: `bisagra-${i + 1}${suffix}`,
        role: "herraje",
        kind: "hinge",
        from: [hingeX, y, z],
        to: [hingeX, y, z],
        length: 100,
        profile: { id: "bisagra", shape: "hinge", w: 20, d: 20, t: 4, nombre: "bisagra de pomo" },
        group: "herrajes",
        side: hingeSide,
      });
    }
  }

  if (needsHingeTirante(spec, leafW)) {
    addHingeTirante(parts, joints, spec, originX, leafW, suffix, hingeSide, mw, md, hasBottom);
  }

  return { parts, joints, actualLuz, barCount, innerW, innerH, mw, md, hasBottom };
}

function hardwareParts(spec, md) {
  const parts = [];
  if (spec.tipo === "porton_corredizo") {
    const guia = parsePerfil("40x20x1.6") || {
      id: "40x20x1.6",
      shape: "rect",
      w: 40,
      d: 20,
      t: 1.6,
      nombre: "caño estructural 40x20 x 1,6",
    };
    addTube(parts, [], {
      id: "guia-inferior",
      role: "guia",
      profile: guia,
      from: [0, -25, guia.d / 2],
      to: [spec.ancho + 400, -25, guia.d / 2],
      group: "herrajes",
    });
    parts.push({
      id: "rueda-1",
      role: "herraje",
      kind: "wheel",
      from: [spec.ancho * 0.2, 0, md / 2],
      to: [spec.ancho * 0.2, 0, md / 2],
      length: 80,
      profile: { id: "rueda", shape: "wheel", w: 80, d: 80, t: 20, nombre: "rueda de portón" },
      group: "herrajes",
    });
    parts.push({
      id: "rueda-2",
      role: "herraje",
      kind: "wheel",
      from: [spec.ancho * 0.8, 0, md / 2],
      to: [spec.ancho * 0.8, 0, md / 2],
      length: 80,
      profile: { id: "rueda", shape: "wheel", w: 80, d: 80, t: 20, nombre: "rueda de portón" },
      group: "herrajes",
    });
  }
  return parts;
}

function aabbOfPart(part) {
  if (part.kind === "hinge") {
    const r = 12;
    const flag = 34;
    const toward = part.side === "derecha" ? -1 : 1;
    const pinX = part.from[0] + (part.side === "derecha" ? r : -r);
    return {
      x: toward > 0 ? pinX - r : pinX - r - flag,
      y: part.from[1] - 50,
      w: r * 2 + flag,
      h: 100,
      role: part.role,
    };
  }
  if (part.kind === "wheel") {
    const r = 40;
    return {
      x: part.from[0] - r,
      y: part.from[1] - r,
      w: r * 2,
      h: r * 2,
      role: part.role,
    };
  }
  const dx = Math.abs(part.to[0] - part.from[0]);
  const dy = Math.abs(part.to[1] - part.from[1]);
  const alongX = dx >= dy;
  const w = part.profile.w;
  if (alongX) {
    return {
      x: Math.min(part.from[0], part.to[0]),
      y: part.from[1] - w / 2,
      w: Math.max(dx, 1),
      h: w,
      role: part.role,
    };
  }
  return {
    x: part.from[0] - w / 2,
    y: Math.min(part.from[1], part.to[1]),
    w,
    h: Math.max(dy, 1),
    role: part.role,
  };
}

function buildViews2d(spec, parts, meta) {
  const members = parts.filter((p) => p.kind === "tube" || p.kind === "round");
  const rects = members
    .filter((p) => p.role !== "tirante")
    .map((p) => ({ ...aabbOfPart(p), id: p.id }));
  const segments = members
    .filter((p) => p.role === "tirante")
    .map((p) => ({
      id: p.id,
      role: p.role,
      x1: p.from[0],
      y1: p.from[1],
      x2: p.to[0],
      y2: p.to[1],
      w: p.profile.w,
    }));
  const hinges = parts
    .filter((p) => p.kind === "hinge")
    .map((p) => ({
      id: p.id,
      role: p.role,
      side: p.side,
      cx: p.from[0] + (p.side === "derecha" ? 10 : -10),
      cy: p.from[1],
      h: 100,
      r: 10,
      flagIn: 34,
      flagOut: 20,
    }));
  const circles = parts
    .filter((p) => p.kind === "wheel")
    .map((p) => ({
      id: p.id,
      role: p.role,
      cx: p.from[0],
      cy: p.from[1],
      r: 36,
    }));

  const dims = [
    {
      axis: "h",
      start: 0,
      end: spec.ancho,
      at: -80,
      label: `${spec.ancho} mm`,
    },
    {
      axis: "v",
      start: 0,
      end: spec.alto,
      at: -80,
      label: `${spec.alto} mm`,
    },
    {
      axis: "h",
      start: meta.mw,
      end: meta.mw + meta.actualLuz,
      at: spec.alto + 50,
      label: `luz ${meta.actualLuz} mm`,
    },
  ];

  return {
    front: {
      width: spec.ancho,
      height: spec.alto,
      rects,
      segments,
      hinges,
      circles,
      dims,
    },
  };
}

export function buildGeometry(spec) {
  const tipo = tipoById(spec.tipo);
  const parts = [];
  const joints = [];
  let actualLuz = spec.luz_mm;
  let barCount = 0;
  let mw = parsePerfil(spec.marco_perfil).w;
  let md = parsePerfil(spec.marco_perfil).d;
  let innerW = spec.ancho - 2 * mw;
  let innerH = spec.alto - 2 * mw;

  if (spec.tipo === "porton_dos_hojas") {
    const gap = 8;
    const leafW = (spec.ancho - gap) / 2;
    const left = leafGeometry(spec, 0, leafW, "-a", "izquierda");
    const right = leafGeometry(spec, leafW + gap, leafW, "-b", "derecha");
    parts.push(...left.parts, ...right.parts);
    joints.push(...left.joints, ...right.joints);
    actualLuz = left.actualLuz;
    barCount = left.barCount + right.barCount;
    mw = left.mw;
    md = left.md;
    innerW = left.innerW;
    innerH = left.innerH;
  } else {
    const hingeSide = spec.lado_bisagra === "derecha" ? "derecha" : "izquierda";
    const leaf = leafGeometry(spec, 0, spec.ancho, "", hingeSide);
    parts.push(...leaf.parts);
    joints.push(...leaf.joints);
    actualLuz = leaf.actualLuz;
    barCount = leaf.barCount;
    mw = leaf.mw;
    md = leaf.md;
    innerW = leaf.innerW;
    innerH = leaf.innerH;
  }

  let bracing = { panos: 0, parantes: 0, tirantes: 0 };
  if (spec.tipo === "porton_corredizo") {
    bracing = addCorredizoArriostrado(parts, joints, spec, mw, md);
    parts.push(...hardwareParts(spec, md));
  } else if (spec.tipo === "reja_ventana") {
    bracing = addRejaParante(parts, joints, spec, mw, md);
  } else {
    bracing.tirantes = parts.filter((p) => p.role === "tirante").length;
    bracing.parantes = parts.filter((p) => p.role === "refuerzo").length;
  }

  const meta = {
    actualLuz,
    barCount,
    mw,
    md,
    innerW,
    innerH,
    tipo: tipo.nombre,
    arriostrado: bracing.tirantes > 0,
    tirantes: bracing.tirantes,
    parantes: bracing.parantes,
    panos: bracing.panos,
  };
  const views2d = buildViews2d(spec, parts, meta);
  const posed = resolveJoints(parts, joints);
  return { parts, joints: posed, views2d, meta };
}

export { mid };
