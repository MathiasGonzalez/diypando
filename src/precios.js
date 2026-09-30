const UYU_POR_KG = 95;
const UYU_ELECTRODO_KG = 540;
const UYU_M2 = [
  [/antióxido/, 55],
  [/esmalte/, 75],
];
const UYU_UNIDAD = [
  [/bisagras de pomo reforzadas/, 620],
  [/bisagras de pomo/, 380],
  [/cerradura con falleba/, 2400],
  [/cerradura de sobreponer/, 980],
  [/cerradura de gancho/, 1650],
  [/pasador al piso/, 420],
  [/pasadores/, 320],
  [/pasador/, 290],
  [/tarugos/, 18],
  [/tornillos para tarugo/, 22],
  [/carritos de dos/, 3400],
  [/carritos de un/, 2400],
  [/riel superior tipo granero/, 4800],
  [/guía de piso/, 650],
  [/ruedas canal en U/, 1900],
  [/ruedas de nylon/, 1600],
  [/ruedas canal en V/, 1850],
  [/riel \/ guía inferior/, 2800],
  [/rodillo guía/, 950],
  [/tope de portón/, 450],
  [/tensores/, 480],
  [/guardacabos/, 45],
  [/prensacables/, 40],
  [/cáncamos/, 90],
  [/disco de corte/, 85],
  [/disco de desbaste/, 130],
  [/disco flap/, 190],
];

function precioUnidad(item) {
  const hit = UYU_UNIDAD.find(([re]) => re.test(item));
  return hit ? hit[1] : 0;
}

function pesos(n) {
  return Math.round(n).toLocaleString("es-UY", { maximumFractionDigits: 0 });
}

export function estimarPrecio(bom) {
  const lineas = [];
  let hierro = 0;
  for (const corte of bom.cortes) {
    const importe =
      corte.shape === "cable"
        ? Math.round(corte.metros_compra * (corte.precio_m || 110))
        : Math.round(corte.barras_6m * corte.kg_barra * UYU_POR_KG);
    hierro += importe;
    lineas.push({ rubro: "Hierro", item: `${corte.pedido} de ${corte.perfil}`, importe });
  }

  let ferreteria = 0;
  const electrodo = Math.round(bom.electrodos.comprar_kg * UYU_ELECTRODO_KG);
  ferreteria += electrodo;
  lineas.push({ rubro: "Ferretería", item: bom.electrodos.pedido, importe: electrodo });
  for (const item of [...(bom.discos || []), ...(bom.herrajes || [])]) {
    const unit = precioUnidad(item.item);
    const importe = Math.round(unit * item.cantidad);
    ferreteria += importe;
    lineas.push({ rubro: "Ferretería", item: `${item.cantidad} ${item.unidad} · ${item.item}`, importe });
  }

  let pintura = 0;
  for (const item of bom.pintura || []) {
    const rate = UYU_M2.find(([re]) => re.test(item.item))?.[1] || 60;
    const importe = Math.round(item.cantidad * rate);
    pintura += importe;
    lineas.push({ rubro: "Pintura", item: `${item.item} (${item.cantidad} m²)`, importe });
  }

  const total = hierro + ferreteria + pintura;
  return {
    total_uyu: total,
    hierro_uyu: hierro,
    ferreteria_uyu: ferreteria,
    pintura_uyu: pintura,
    texto: `$${pesos(total)}`,
    detalle: `Hierro $${pesos(hierro)} · ferretería $${pesos(ferreteria)} · pintura $${pesos(pintura)}`,
    nota: "Estimado de mostrador en pesos, sin flete ni mano de obra. La barraca cambia el precio.",
    lineas,
  };
}
