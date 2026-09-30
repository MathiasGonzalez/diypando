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

function weld(joints, a, b, filletMm, note) {
  joints.push({
    a,
    b,
    fillet_mm: Math.max(8, Math.round(filletMm)),
    note,
  });
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
        length: 80,
        profile: { id: "bisagra", shape: "hinge", w: 28, d: 28, t: 4, nombre: "bisagra" },
        group: "herrajes",
        side: hingeSide,
      });
    }
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
  if (part.kind === "hinge" || part.kind === "wheel") {
    const r = part.kind === "wheel" ? 40 : 16;
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
  const rects = parts
    .filter((p) => p.kind === "tube" || p.kind === "round")
    .map((p) => ({ ...aabbOfPart(p), id: p.id }));

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

  if (spec.tipo === "porton_corredizo") {
    const marco = parsePerfil(spec.marco_perfil);
    const third = spec.ancho / 3;
    addTube(parts, joints, {
      id: "refuerzo-1",
      role: "refuerzo",
      profile: marco,
      from: [third, mw, md / 2],
      to: [third, spec.alto - mw, md / 2],
      group: "marco",
    });
    addTube(parts, joints, {
      id: "refuerzo-2",
      role: "refuerzo",
      profile: marco,
      from: [third * 2, mw, md / 2],
      to: [third * 2, spec.alto - mw, md / 2],
      group: "marco",
    });
    weld(joints, "refuerzo-1", "umbral", mw, "refuerzo");
    weld(joints, "refuerzo-1", "travesano-sup", mw, "refuerzo");
    weld(joints, "refuerzo-2", "umbral", mw, "refuerzo");
    weld(joints, "refuerzo-2", "travesano-sup", mw, "refuerzo");
    parts.push(...hardwareParts(spec, md));
  }

  const meta = { actualLuz, barCount, mw, md, innerW, innerH, tipo: tipo.nombre };
  const views2d = buildViews2d(spec, parts, meta);
  return { parts, joints, views2d, meta };
}

export { mid };
