import { nombreCaño, nombreRedondo } from "./format.js";

export const TIPOS = [
  {
    id: "puerta_reja_peatonal",
    nombre: "Puerta de reja",
    descripcion: "Una hoja, mano a bisagra, con travesaño de abajo.",
    defaults: {
      ancho: 900,
      alto: 2100,
      marco_perfil: "40x40x1.6",
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
      barrote: "20x20x1.2",
      luz_mm: 110,
      travesanos: 2,
      lado_bisagra: "izquierda",
      incluir_umbral: true,
      estilo: "barrotes_verticales",
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

export const MARCOS = [
  { id: "30x30x1.2", nombre: "caño estructural 30x30 x 1,2" },
  { id: "40x20x1.6", nombre: "caño estructural 40x20 x 1,6" },
  { id: "40x40x1.6", nombre: "caño estructural 40x40 x 1,6" },
  { id: "50x50x1.6", nombre: "caño estructural 50x50 x 1,6" },
  { id: "80x40x1.6", nombre: "caño estructural 80x40 x 1,6" },
];

export const BARROTES = [
  { id: "16x16x1.2", nombre: "caño estructural 16x16 x 1,2" },
  { id: "20x20x1.2", nombre: "caño estructural 20x20 x 1,2" },
  { id: "25x25x1.2", nombre: "caño estructural 25x25 x 1,2" },
  { id: "10_redondo", nombre: "hierro redondo del 10" },
  { id: "12_redondo", nombre: "hierro redondo del 12" },
  { id: "14_redondo", nombre: "hierro redondo del 14" },
];

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
  const marco = parsePerfil(base.marco_perfil) ? base.marco_perfil : tipo.defaults.marco_perfil;
  const barrote = parsePerfil(base.barrote) ? base.barrote : tipo.defaults.barrote;
  const estilo = ESTILOS.some((e) => e.id === base.estilo)
    ? base.estilo
    : "barrotes_verticales";
  const lado = ["izquierda", "derecha", "exterior"].includes(base.lado_bisagra)
    ? base.lado_bisagra
    : tipo.defaults.lado_bisagra;

  return {
    tipo: tipo.id,
    estilo,
    ancho: clamp(Math.round(num(base.ancho, tipo.defaults.ancho)), ...LIMITS.ancho),
    alto: clamp(Math.round(num(base.alto, tipo.defaults.alto)), ...LIMITS.alto),
    marco_perfil: marco,
    barrote,
    luz_mm: clamp(Math.round(num(base.luz_mm, tipo.defaults.luz_mm)), ...LIMITS.luz_mm),
    travesanos: clamp(Math.round(num(base.travesanos, tipo.defaults.travesanos)), ...LIMITS.travesanos),
    lado_bisagra: lado,
    incluir_umbral: Boolean(base.incluir_umbral),
  };
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
    if (!patch.barrote) next.barrote = tipo.defaults.barrote;
  }
  return validateSpec(next);
}

export function getCatalog() {
  return {
    tipos: TIPOS,
    estilos: ESTILOS,
    marcos: MARCOS,
    barrotes: BARROTES,
    limits: {
      ancho_mm: LIMITS.ancho,
      alto_mm: LIMITS.alto,
      luz_mm: LIMITS.luz_mm,
      travesanos: LIMITS.travesanos,
    },
    default_spec: defaultSpec("puerta_reja_peatonal"),
  };
}
