import { nombreAngulo, nombreCable, nombreCaño, nombrePlanchuela, nombreRedondo } from "./format.js";

export const TIPOS = [
  {
    id: "puerta_reja_peatonal",
    nombre: "Puerta de reja",
    descripcion: "Una hoja, mano a bisagra, con travesaño de abajo.",
    defaults: {
      ancho: 900,
      alto: 2100,
      marco_perfil: "40x40x1.6",
      travesano_perfil: "40x40x1.6",
      tirante_perfil: "40x40x1.6",
      refuerzo_perfil: "40x40x1.6",
      barrote: "20x20x1.2",
      luz_mm: 110,
      travesanos: 1,
      lado_bisagra: "izquierda",
      incluir_umbral: true,
      estilo: "barrotes_verticales",
    },
  },
  {
    id: "reja_ventana",
    nombre: "Reja de ventana",
    descripcion: "Fija al vano, se ancla con tarugos. Sin bisagras.",
    defaults: {
      ancho: 1200,
      alto: 1000,
      marco_perfil: "30x30x1.2",
      travesano_perfil: "30x30x1.2",
      tirante_perfil: "30x30x1.2",
      refuerzo_perfil: "30x30x1.2",
      barrote: "12_redondo",
      luz_mm: 100,
      travesanos: 0,
      lado_bisagra: "izquierda",
      incluir_umbral: true,
      estilo: "barrotes_verticales",
    },
  },
  {
    id: "porton_corredizo",
    nombre: "Portón corredizo",
    descripcion: "Una hoja sobre riel, con ruedas y tirantes.",
    defaults: {
      ancho: 3000,
      alto: 2000,
      marco_perfil: "50x50x1.6",
      travesano_perfil: "50x50x1.6",
      tirante_perfil: "50x50x1.6",
      refuerzo_perfil: "50x50x1.6",
      barrote: "20x20x1.2",
      luz_mm: 110,
      travesanos: 2,
      lado_bisagra: "izquierda",
      incluir_umbral: true,
      estilo: "barrotes_verticales",
      soporte: "riel_piso",
      rueda: "canal_v",
      cerradura: "gancho",
    },
  },
  {
    id: "porton_dos_hojas",
    nombre: "Portón de dos hojas",
    descripcion: "Dos hojas a bisagra, encuentro al medio.",
    defaults: {
      ancho: 2400,
      alto: 2000,
      marco_perfil: "40x40x1.6",
      travesano_perfil: "40x40x1.6",
      tirante_perfil: "40x40x1.6",
      refuerzo_perfil: "40x40x1.6",
      barrote: "20x20x1.2",
      luz_mm: 110,
      travesanos: 1,
      lado_bisagra: "exterior",
      incluir_umbral: true,
      estilo: "barrotes_verticales",
    },
  },
];

export const ESTILOS = [
  { id: "barrotes_verticales", nombre: "Barrotes de pie (verticales)" },
  { id: "barrotes_horizontales", nombre: "Barrotes acostados (horizontales)" },
  { id: "mixto", nombre: "Mixto (barrotes + travesaños)" },
];

export const SOPORTES_CORREDIZO = [
  { id: "riel_piso", nombre: "Riel al piso" },
  { id: "granero", nombre: "Tipo granero (riel arriba)" },
];

export const RUEDAS_RIEL = [
  { id: "canal_v", nombre: "Rueda canal en V" },
  { id: "canal_u", nombre: "Rueda canal en U" },
  { id: "nylon", nombre: "Rueda de nylon" },
];

export const RUEDAS_GRANERO = [
  { id: "carrito_simple", nombre: "Carrito de un rodillo" },
  { id: "carrito_doble", nombre: "Carrito de dos rodillos" },
];

export const CERRADURAS_CORREDIZO = [
  { id: "ninguna", nombre: "Sin cerradura" },
  { id: "gancho", nombre: "Cerradura de gancho" },
  { id: "pasador", nombre: "Pasador al piso" },
];

export const HARDWARE_KINDS = ["hinge", "wheel", "trolley", "lock", "guide_roller"];

export function isHardware(part) {
  return HARDWARE_KINDS.includes(part?.kind);
}

export function ruedasParaSoporte(soporte) {
  return soporte === "granero" ? RUEDAS_GRANERO : RUEDAS_RIEL;
}

function cano(id) {
  const perfil = parsePerfil(id);
  return { id, grupo: "Caño", nombre: perfil.nombre };
}

function planchuela(w, t) {
  return { id: `pl${w}x${t}`, grupo: "Planchuela", nombre: nombrePlanchuela(w, t) };
}

function angulo(w, t) {
  return { id: `L${w}x${w}x${t}`, grupo: "Ángulo", nombre: nombreAngulo(w, w, t) };
}

function cable(diam, precio_m) {
  return { id: `cable${diam}`, grupo: "Cable", nombre: nombreCable(diam), precio_m };
}

export const CANOS = ["30x30x1.2", "40x20x1.6", "40x40x1.6", "50x30x2", "50x50x1.6", "60x40x2", "80x40x1.6"].map(
  cano,
);

export const PLANCHUELAS = [planchuela(25, 3), planchuela(30, 3), planchuela(40, 4), planchuela(50, 5), planchuela(50, 6)];

export const ANGULOS = [angulo(25, 3), angulo(30, 3), angulo(40, 3), angulo(40, 4), angulo(50, 5)];

export const CABLES = [cable(4, 70), cable(6, 110), cable(8, 170)];

export const MARCOS = [...CANOS, ...PLANCHUELAS, ...ANGULOS];

export const BARROTES = [
  cano("16x16x1.2"),
  cano("20x20x1.2"),
  cano("25x25x1.2"),
  { id: "8_redondo", grupo: "Redondo", nombre: nombreRedondo(8) },
  { id: "10_redondo", grupo: "Redondo", nombre: nombreRedondo(10) },
  { id: "12_redondo", grupo: "Redondo", nombre: nombreRedondo(12) },
  { id: "14_redondo", grupo: "Redondo", nombre: nombreRedondo(14) },
  { id: "16_redondo", grupo: "Redondo", nombre: nombreRedondo(16) },
  { ...planchuela(12, 3), grupo: "Planchuela" },
  { ...planchuela(20, 3), grupo: "Planchuela" },
];

export const ESTRUCTURALES = [
  ...BARROTES.filter((b) => b.grupo === "Caño"),
  ...MARCOS,
];

export const TIRANTES = [...ESTRUCTURALES, ...CABLES];

const LIMITS = {
  ancho: [400, 6000],
  alto: [400, 3000],
  luz_mm: [60, 180],
  travesanos: [0, 4],
};

export function parsePerfil(id) {
  if (typeof id !== "string") return null;
  const round = id.match(/^(\d+)_redondo$/);
  if (round) {
    const d = Number(round[1]);
    return { id, shape: "round", w: d, d, t: d / 2, nombre: nombreRedondo(d) };
  }
  const rect = id.match(/^(\d+)x(\d+)x(\d+(?:\.\d+)?)$/);
  if (rect) {
    const w = Number(rect[1]);
    const depth = Number(rect[2]);
    const t = Number(rect[3]);
    return {
      id,
      shape: "rect",
      w,
      d: depth,
      t,
      nombre: nombreCaño(w, depth, t),
    };
  }
  const flat = id.match(/^pl(\d+)x(\d+(?:\.\d+)?)$/);
  if (flat) {
    const w = Number(flat[1]);
    const t = Number(flat[2]);
    return { id, shape: "flat", w, d: t, t, nombre: nombrePlanchuela(w, t) };
  }
  const ang = id.match(/^L(\d+)x(\d+)x(\d+(?:\.\d+)?)$/);
  if (ang) {
    const w = Number(ang[1]);
    const depth = Number(ang[2]);
    const t = Number(ang[3]);
    return { id, shape: "angle", w, d: depth, t, nombre: nombreAngulo(w, depth, t) };
  }
  const cab = id.match(/^cable(\d+)$/);
  if (cab) {
    const d = Number(cab[1]);
    const item = CABLES.find((c) => c.id === id);
    return {
      id,
      shape: "cable",
      w: d,
      d,
      t: d / 2,
      nombre: nombreCable(d),
      precio_m: item?.precio_m ?? 110,
    };
  }
  return null;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function tipoById(id) {
  return TIPOS.find((t) => t.id === id) || TIPOS[0];
}

export function defaultSpec(tipoId) {
  const tipo = tipoById(tipoId);
  return { tipo: tipo.id, ...tipo.defaults };
}

export function validateSpec(input = {}) {
  const tipo = tipoById(input.tipo);
  const base = { ...tipo.defaults, ...input, tipo: tipo.id };
  const idsMarco = new Set(MARCOS.map((m) => m.id));
  const idsEstructural = new Set(ESTRUCTURALES.map((m) => m.id));
  const idsTirante = new Set(TIRANTES.map((m) => m.id));
  const idsBarrote = new Set(BARROTES.map((b) => b.id));
  const marco = idsMarco.has(base.marco_perfil) ? base.marco_perfil : tipo.defaults.marco_perfil;
  const pieza = (value, fallback) => (idsEstructural.has(value) ? value : fallback);
  const travesano_perfil = pieza(base.travesano_perfil, marco);
  const tirante_perfil = idsTirante.has(base.tirante_perfil) ? base.tirante_perfil : tipo.defaults.tirante_perfil;
  const refuerzo_perfil = pieza(base.refuerzo_perfil, marco);
  const barrote = idsBarrote.has(base.barrote) ? base.barrote : tipo.defaults.barrote;
  const estilo = ESTILOS.some((e) => e.id === base.estilo)
    ? base.estilo
    : "barrotes_verticales";
  const lado = ["izquierda", "derecha", "exterior"].includes(base.lado_bisagra)
    ? base.lado_bisagra
    : tipo.defaults.lado_bisagra;

  const spec = {
    tipo: tipo.id,
    estilo,
    ancho: clamp(Math.round(num(base.ancho, tipo.defaults.ancho)), ...LIMITS.ancho),
    alto: clamp(Math.round(num(base.alto, tipo.defaults.alto)), ...LIMITS.alto),
    marco_perfil: marco,
    travesano_perfil,
    tirante_perfil,
    refuerzo_perfil,
    barrote,
    luz_mm: clamp(Math.round(num(base.luz_mm, tipo.defaults.luz_mm)), ...LIMITS.luz_mm),
    travesanos: clamp(Math.round(num(base.travesanos, tipo.defaults.travesanos)), ...LIMITS.travesanos),
    lado_bisagra: lado,
    incluir_umbral: Boolean(base.incluir_umbral),
  };

  if (tipo.id === "porton_corredizo") {
    const idsSoporte = new Set(SOPORTES_CORREDIZO.map((s) => s.id));
    const idsCerradura = new Set(CERRADURAS_CORREDIZO.map((c) => c.id));
    const soporte = idsSoporte.has(base.soporte) ? base.soporte : tipo.defaults.soporte;
    const ruedas = ruedasParaSoporte(soporte);
    const idsRueda = new Set(ruedas.map((r) => r.id));
    spec.soporte = soporte;
    spec.rueda = idsRueda.has(base.rueda) ? base.rueda : ruedas[0].id;
    spec.cerradura = idsCerradura.has(base.cerradura) ? base.cerradura : tipo.defaults.cerradura;
  }

  return spec;
}

export function applyPatch(spec, patch = {}) {
  const next = { ...spec };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null || value === "") continue;
    next[key] = value;
  }
  if (patch.tipo && patch.tipo !== spec.tipo) {
    const tipo = tipoById(patch.tipo);
    if (!patch.ancho) next.ancho = tipo.defaults.ancho;
    if (!patch.alto) next.alto = tipo.defaults.alto;
    if (!patch.marco_perfil) next.marco_perfil = tipo.defaults.marco_perfil;
    if (!patch.travesano_perfil) next.travesano_perfil = tipo.defaults.travesano_perfil;
    if (!patch.tirante_perfil) next.tirante_perfil = tipo.defaults.tirante_perfil;
    if (!patch.refuerzo_perfil) next.refuerzo_perfil = tipo.defaults.refuerzo_perfil;
    if (!patch.barrote) next.barrote = tipo.defaults.barrote;
  }
  return validateSpec(next);
}

export function getCatalog() {
  return {
    tipos: TIPOS,
    estilos: ESTILOS,
    marcos: MARCOS,
    estructurales: ESTRUCTURALES,
    tirantes: TIRANTES,
    barrotes: BARROTES,
    soportes_corredizo: SOPORTES_CORREDIZO,
    ruedas_riel: RUEDAS_RIEL,
    ruedas_granero: RUEDAS_GRANERO,
    cerraduras_corredizo: CERRADURAS_CORREDIZO,
    limits: {
      ancho_mm: LIMITS.ancho,
      alto_mm: LIMITS.alto,
      luz_mm: LIMITS.luz_mm,
      travesanos: LIMITS.travesanos,
    },
    default_spec: defaultSpec("puerta_reja_peatonal"),
  };
}
