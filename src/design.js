import { validateSpec, isHardware } from "./catalog.js";
import { buildGeometry } from "./geometry.js";
import { buildBom } from "./bom.js";
import { buildPasos, etiquetaPieza, ordenPieza } from "./pasos.js";

export function runDesign(inputSpec) {
  const spec = validateSpec(inputSpec);
  const geometry = buildGeometry(spec);
  const bom = buildBom(spec, geometry);
  const pasos = buildPasos(spec, geometry, bom);
  return {
    spec,
    parts: geometry.parts.map((part) =>
      isHardware(part)
        ? { ...part, orden: 90, etiqueta: part.role || "herraje" }
        : { ...part, orden: ordenPieza(part), etiqueta: etiquetaPieza(part) },
    ),
    joints: geometry.joints,
    views2d: geometry.views2d,
    meta: geometry.meta,
    bom,
    pasos,
  };
}
