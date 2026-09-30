import { parsePerfil, tipoById } from "./catalog.js";
import { uyEspesor } from "./format.js";

const STEEL = 7850;
const STOCK = 6000;
const KERF = 3;
const FILLET_KG_PER_M = 0.05;

function sectionAreaMm2(profile) {
  if (profile.shape === "round") {
    return Math.PI * (profile.w / 2) ** 2;
  }
  const { w, d, t } = profile;
  const innerW = Math.max(0, w - 2 * t);
  const innerD = Math.max(0, d - 2 * t);
  return w * d - innerW * innerD;
}

function perimeterMm(profile) {
  if (profile.shape === "round") return Math.PI * profile.w;
  return 2 * (profile.w + profile.d);
}

function packCuts(lengthsMm) {
  const sorted = [...lengthsMm].sort((a, b) => b - a);
  const bars = [];
  for (const L of sorted) {
    let placed = false;
    for (const bar of bars) {
      const used = bar.cuts.reduce((sum, c) => sum + c + KERF, 0);
      if (used + L <= STOCK) {
        bar.cuts.push(L);
        placed = true;
        break;
      }
    }
    if (!placed) bars.push({ cuts: [L] });
  }
  return bars;
}

function herrajesFor(spec) {
  const tipo = spec.tipo;
  if (tipo === "reja_ventana") {
    return [
      { item: "tarugos Nº 10 (para pared)", cantidad: 8, unidad: "unid." },
      { item: "tornillos para tarugo", cantidad: 8, unidad: "unid." },
    ];
  }
  if (tipo === "porton_corredizo") {
    return [
      { item: "ruedas para portón corredizo", cantidad: 2, unidad: "unid." },
      { item: "riel / guía inferior", cantidad: 1, unidad: "unid." },
      { item: "tope de portón", cantidad: 1, unidad: "unid." },
      { item: "cerradura de portón", cantidad: 1, unidad: "unid." },
    ];
  }
  if (tipo === "porton_dos_hojas") {
    return [
      { item: "bisagras reforzadas", cantidad: 6, unidad: "unid." },
      { item: "cerradura con falleba", cantidad: 1, unidad: "unid." },
      { item: "pasadores (arriba y abajo)", cantidad: 2, unidad: "unid." },
    ];
  }
  return [
    { item: "bisagras", cantidad: 3, unidad: "unid." },
    { item: "cerradura de sobreponer", cantidad: 1, unidad: "unid." },
    { item: "pasador", cantidad: 1, unidad: "unid." },
  ];
}

export function buildBom(spec, geometry) {
  const { parts, joints, meta } = geometry;
  const byProfile = new Map();

  for (const part of parts) {
    if (part.kind === "hinge" || part.kind === "wheel") continue;
    const key = part.profile.id;
    if (!byProfile.has(key)) {
      byProfile.set(key, {
        perfil: part.profile,
        cortes: [],
        roles: new Set(),
      });
    }
    const g = byProfile.get(key);
    g.cortes.push(Math.round(part.length));
    g.roles.add(part.role);
  }

  const cortes = [];
  let peso_kg = 0;
  let pintura_m2 = 0;
  let metros_lineales = 0;

  for (const group of byProfile.values()) {
    const area_m2 = sectionAreaMm2(group.perfil) / 1e6;
    const peri_m = perimeterMm(group.perfil) / 1000;
    const totalMm = group.cortes.reduce((s, n) => s + n, 0);
    const packed = packCuts(group.cortes);
    const kg = area_m2 * (totalMm / 1000) * STEEL;
    const paint = peri_m * (totalMm / 1000);
    peso_kg += kg;
    pintura_m2 += paint;
    metros_lineales += totalMm / 1000;
    const counts = new Map();
    for (const L of group.cortes) counts.set(L, (counts.get(L) || 0) + 1);
    const detalle = [...counts.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([L, n]) => `${n} de ${L} mm`);

    cortes.push({
      perfil_id: group.perfil.id,
      perfil: group.perfil.nombre,
      shape: group.perfil.shape,
      roles: [...group.roles],
      cantidad_piezas: group.cortes.length,
      metros: Number((totalMm / 1000).toFixed(2)),
      barras_6m: packed.length,
      peso_kg: Number(kg.toFixed(2)),
      pintura_m2: Number(paint.toFixed(2)),
      detalle,
    });
  }

  cortes.sort((a, b) => b.metros - a.metros);

  const wallT = parsePerfil(spec.marco_perfil).t;
  const diametro = wallT <= 1.6 ? 2.5 : 3.2;
  const filletM = joints.reduce((s, j) => s + j.fillet_mm, 0) / 1000;
  const kgBruto = filletM * FILLET_KG_PER_M;
  const gPorVarilla = diametro <= 2.5 ? 20 : 28;
  const varillas = Math.max(1, Math.ceil((kgBruto * 1000) / gPorVarilla));
  const kgCaja = Math.max(1, Math.ceil(kgBruto));
  const diamTxt = uyEspesor(diametro);

  const electrodos = {
    tipo: "6013 rutilo",
    diametro_mm: diametro,
    diametro_txt: diamTxt,
    juntas: joints.length,
    filete_m: Number(filletM.toFixed(2)),
    consumo_kg: Number(kgBruto.toFixed(3)),
    varillas_aprox: varillas,
    comprar_kg: kgCaja,
    pedido: `pedir ${kgCaja} kg (caja de electrodo 13 de ${diamTxt} mm)`,
    nota: "Estimado de taller (~50 g por metro de cordón). No es presupuesto.",
  };

  const pintura_m2_n = Number(pintura_m2.toFixed(2));

  return {
    tipo: tipoById(spec.tipo).nombre,
    cortes,
    herrajes: herrajesFor(spec),
    pintura: [
      { item: "antióxido para hierro", cantidad: pintura_m2_n, unidad: "m²" },
      { item: "esmalte sintético", cantidad: pintura_m2_n, unidad: "m²" },
    ],
    electrodos,
    resumen: {
      barrotes: meta.barCount,
      luz_real_mm: meta.actualLuz,
      peso_kg: Number(peso_kg.toFixed(2)),
      pintura_m2: pintura_m2_n,
      metros_lineales: Number(metros_lineales.toFixed(2)),
      juntas_soldadura: joints.length,
    },
    aviso: "Lista para pedir en casa de hierros y ferretería. Controlá el vano en obra (plomo y holgura).",
  };
}
