import { validateSpec } from "./catalog.js";
import { buildGeometry } from "./geometry.js";
import { buildBom } from "./bom.js";

export function runDesign(inputSpec) {
  const spec = validateSpec(inputSpec);
  const geometry = buildGeometry(spec);
  const bom = buildBom(spec, geometry);
  return {
    spec,
    parts: geometry.parts,
    joints: geometry.joints,
    views2d: geometry.views2d,
    meta: geometry.meta,
    bom,
  };
}
