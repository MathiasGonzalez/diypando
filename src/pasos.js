import { isHardware, tipoById } from "./catalog.js";

function esVertical(part) {
  return Math.abs(part.to[1] - part.from[1]) >= Math.abs(part.to[0] - part.from[0]);
}

export function etiquetaPieza(part) {
  const id = part.id || "";
  if (id === "riel-superior") return "riel superior";
  if (id === "guia-piso") return "guía de piso";
  if (part.role === "guia") return "riel / guía";
  if (part.role === "tirante") return "tirante";
  if (part.role === "refuerzo") return "parante (palo de pie intermedio)";
  if (part.role === "barrote") return "barrote";
  if (part.role === "travesano") return "travesaño intermedio";
  if (id.includes("umbral")) return "travesaño de abajo";
  if (id.includes("travesano-sup") || id.includes("sup")) return "travesaño de arriba";
  if (part.role === "marco" && esVertical(part)) return "larguero (palo de pie)";
  if (part.role === "marco") return "travesaño del marco";
  return part.role || "pieza";
}

export function ordenPieza(part) {
  const etiqueta = etiquetaPieza(part);
  if (etiqueta.startsWith("larguero")) return 10;
  if (etiqueta.includes("abajo")) return 20;
  if (etiqueta.includes("arriba")) return 30;
  if (etiqueta === "travesaño del marco") return 35;
  if (etiqueta === "riel / guía") return 40;
  if (etiqueta === "riel superior") return 40;
  if (etiqueta === "guía de piso") return 42;
  if (etiqueta.startsWith("parante")) return 50;
  if (etiqueta === "tirante") return 55;
  if (etiqueta === "travesaño intermedio") return 60;
  if (etiqueta === "barrote") return 70;
  return 80;
}

export function discosAmoladora(nCortes) {
  const corte = Math.max(3, Math.ceil(nCortes / 8));
  const desbaste = nCortes > 20 ? 2 : 1;
  const flap = nCortes > 30 ? 2 : 1;
  return [
    {
      item: "disco de corte para metal 115 × 1,0 mm",
      cantidad: corte,
      unidad: "unid.",
      para: "cortar caño y redondo (amoladora 4½\")",
    },
    {
      item: "disco de desbaste 115 × 6 mm",
      cantidad: desbaste,
      unidad: "unid.",
      para: "rebabas y cordones",
    },
    {
      item: "disco flap (láminas) 115 mm grano 40",
      cantidad: flap,
      unidad: "unid.",
      para: "limpiar antes del antióxido",
    },
  ];
}

function pluralEtiqueta(etiqueta, n) {
  if (n === 1) return etiqueta;
  if (etiqueta === "larguero (palo de pie)") return "largueros (palos de pie)";
  if (etiqueta === "travesaño de abajo") return "travesaños de abajo";
  if (etiqueta === "travesaño de arriba") return "travesaños de arriba";
  if (etiqueta === "travesaño del marco") return "travesaños del marco";
  if (etiqueta === "travesaño intermedio") return "travesaños intermedios";
  if (etiqueta === "barrote") return "barrotes";
  if (etiqueta.startsWith("parante")) return "parantes (palos de pie intermedios)";
  if (etiqueta === "tirante") return "tirantes";
  if (etiqueta === "riel / guía") return "rieles / guías";
  if (etiqueta === "riel superior") return "rieles superiores";
  if (etiqueta === "guía de piso") return "guías de piso";
  return etiqueta;
}

function agruparCortes(parts) {
  const map = new Map();
  for (const part of parts) {
    if (isHardware(part)) continue;
    const largo = Math.round(part.length);
    const etiqueta = etiquetaPieza(part);
    const key = `${ordenPieza(part)}|${etiqueta}|${part.profile.id}|${largo}`;
    if (!map.has(key)) {
      map.set(key, {
        orden: ordenPieza(part),
        etiqueta,
        perfil: part.profile.nombre,
        largo,
        cantidad: 0,
      });
    }
    map.get(key).cantidad += 1;
  }
  return [...map.values()].sort((a, b) => a.orden - b.orden || b.largo - a.largo);
}

function itemsArriostrado(spec, grupos) {
  const items = [];
  const hasParante = grupos.some((g) => g.etiqueta.startsWith("parante"));
  const hasTrav = grupos.some((g) => g.etiqueta === "travesaño intermedio");
  const hasTirante = grupos.some((g) => g.etiqueta === "tirante");
  if (hasParante) {
    items.push("Colocá los parantes (palos de pie intermedios) a escuadra, punteá y soldá.");
  }
  if (hasTrav) {
    items.push("Colocá los travesaños intermedios en su lugar, a escuadra, punteá y soldá.");
  }
  if (hasTirante) {
    const cable = grupos.some((g) => g.etiqueta === "tirante" && /cable de acero/.test(g.perfil));
    const abierto = grupos.some((g) => g.etiqueta === "tirante" && /planchuela|ángulo/.test(g.perfil));
    if (cable) {
      const donde =
        spec.tipo === "porton_corredizo"
          ? "En cada paño, de la esquina de abajo a la izquierda a la de arriba a la derecha."
          : spec.tipo === "porton_dos_hojas"
            ? "En cada hoja, de abajo del lado de la bisagra hacia arriba del lado libre. Cerrado se ve como una V."
            : "De abajo del lado de la bisagra hacia arriba del lado libre.";
      items.push(
        `El tirante es cable: no se suelda. ${donde} Soldá un cáncamo en cada esquina, armá el ojal con guardacabo y prensacables, y templá con el tensor. Sin eso el marco se va a paralelogramo.`,
      );
    } else if (spec.tipo === "porton_corredizo") {
      items.push(
        `El tirante va antes de los barrotes. En cada paño: de la esquina de abajo a la izquierda a la de arriba a la derecha. Presentá, marcá las puntas, punteá y soldá.${abierto ? " Si es planchuela o ángulo, la cara ancha apoya en el marco." : ""} Sin esto el marco se va a paralelogramo y baja una punta.`,
      );
    } else if (spec.tipo === "porton_dos_hojas") {
      items.push(
        `El tirante va antes de los barrotes. En cada hoja: de abajo, del lado de la bisagra, hacia arriba del lado libre (el encuentro). Cerrado se ve como una V. Presentá, punteá y soldá.${abierto ? " Si es planchuela o ángulo, la cara ancha apoya en el marco." : ""}`,
      );
    } else {
      items.push(
        `El tirante va antes de los barrotes: de abajo del lado de la bisagra hacia arriba del lado libre. Presentá, punteá y soldá.${abierto ? " Si es planchuela o ángulo, la cara ancha apoya en el marco." : ""} Así no baja el picaporte.`,
      );
    }
  }
  if (!items.length) {
    items.push("En este diseño no hay travesaño intermedio ni tirante: seguí a los barrotes.");
  }
  return items;
}

function colocacion(spec) {
  if (spec.tipo === "reja_ventana") {
    return [
      "Con la reja ya seca, presentala en el vano y marcá los agujeros.",
      "Perforá la pared, meté los tarugos y atornillá. No cuelgue de un solo lado.",
      "Controlá que quede a plomo. Listo.",
    ];
  }
  if (spec.tipo === "porton_corredizo") {
    if (spec.soporte === "granero") {
      return [
        "Fijá el riel arriba, a nivel, más largo que la hoja (recorrido de apertura).",
        "Colgá los carritos del riel y atornillalos al travesaño de arriba. Probá que corra sin trabarse.",
        "Colocá la guía corta al piso, el tope y la cerradura. La guía no carga: solo evita que se menee.",
      ];
    }
    return [
      "Fijá el riel abajo, a nivel, en todo el recorrido (hoja + holgura de apertura).",
      "Apoyá las ruedas sobre el riel y probá que corra sin trabarse.",
      "Colocá el rodillo guía arriba del lado de cola, el tope y la cerradura. No lo dejes sin tope: se sale.",
    ];
  }
  if (spec.tipo === "porton_dos_hojas") {
    return [
      "Presentá cada hoja en el vano, con holgura de 5 a 8 mm al piso y al dintel.",
      "Marcá y fijá las bisagras en el marco de obra (o en los postes), a plomo.",
      "Colgá una hoja, después la otra. El encuentro al medio tiene que cerrar sin rozar.",
      "Ponete la falleba y los pasadores. Probá abrir y cerrar las dos.",
    ];
  }
  const mano = spec.lado_bisagra === "derecha" ? "mano derecha" : "mano izquierda";
  return [
    `Presentá la puerta en el vano, ${mano}, con holgura de 5 a 8 mm al piso y a los lados.`,
    "Marcá las bisagras en el marco de obra. Perforá y fijá con la puerta en plomo.",
    "Colgá la hoja, colocá cerradura y pasador. Probá que abra y cierre sin rozar.",
  ];
}

export function buildPasos(spec, geometry, bom) {
  const aceros = geometry.parts.filter((p) => !isHardware(p));
  const grupos = agruparCortes(aceros);
  const discos = discosAmoladora(aceros.length);
  const tipo = tipoById(spec.tipo).nombre;

  const cortes = grupos.map((g) => {
    const nombre = pluralEtiqueta(g.etiqueta, g.cantidad);
    const igual = g.cantidad > 1 ? " Todas iguales." : "";
    if (g.etiqueta === "tirante" && /cable de acero/.test(g.perfil)) {
      return `Cortá ${g.cantidad} ${nombre} de ${g.largo} mm de ${g.perfil}, y sumá unos 300 mm por punta para el ojal. No va a inglete ni se suelda.`;
    }
    if (g.etiqueta === "tirante") {
      const presentá = g.cantidad > 1 ? "Presentalos" : "Presentalo";
      return `Cortá ${g.cantidad} ${nombre} de ${g.largo} mm, en ${g.perfil}.${igual} ${presentá} en el marco ya escuadrado y marcá las puntas; el corte va a inglete para apoyar en las dos esquinas.`;
    }
    return `Cortá ${g.cantidad} ${nombre} de ${g.largo} mm, en ${g.perfil}.${igual} Marcá con tiza, traba en la morsa, disco de corte a 90°.`;
  });

  return {
    discos,
    etapas: [
      {
        titulo: "0. No des nada por hecho",
        items: [
          "Todavía no hay marco, ni cortes, ni pintura. Empezá de cero.",
          "Si no tenés las herramientas, compralas antes de cortar: amoladora 115 mm (4½\"), morsa o prensa, metro, escuadra, tiza, soldadora inverter, pinza de masa, careta de soldar, lentes, tapones, guantes, cepillo de alambre y nivel.",
          "Trabajá en un piso firme, seco, lejos de pasto o nafta. La soldadora necesita toma a tierra.",
        ],
      },
      {
        titulo: "1. Medí el vano en obra",
        items: [
          `Este trabajo es ${tipo} de ${spec.ancho} × ${spec.alto} mm en el plano. Medí vos el hueco: ancho arriba, al medio y abajo; alto a izquierda y derecha.`,
          "Si el vano no da, cambiá las medidas en la pantalla y volvé a generar el pedido. No cortes con una medida que no controlaste.",
        ],
      },
      {
        titulo: "2. Comprá en la casa de hierros",
        items: [
          "Pedí barras enteras de 6 m (no la reja cortada):",
          ...bom.cortes.map((c) => `${c.pedido} de ${c.perfil}.`),
          `Revisá que te den el espesor que pediste.${bom.cortes.some((c) => c.shape === "cable") ? " El cable se pide por metro, con sobra para los ojales." : ""} Cargá derecho, sin doblar los caños.`,
        ],
      },
      {
        titulo: "3. Comprá en la ferretería",
        items: [
          "Electrodos: " + bom.electrodos.pedido + ".",
          "Discos de amoladora (sin disco no cortás nada):",
          ...discos.map((d) => `${d.cantidad} ${d.unidad} · ${d.item} (${d.para}).`),
          ...bom.herrajes.map((h) => `${h.cantidad} ${h.unidad} · ${h.item}.`),
          `Antióxido para ~${bom.resumen.pintura_m2} m².`,
          `Esmalte sintético para ~${bom.resumen.pintura_m2} m².`,
        ],
      },
      {
        titulo: "4. Armá el lugar de trabajo",
        items: [
          "Apoyá dos caballetes o una mesa. Atornillá la morsa.",
          "Poné el disco de corte 115 × 1,0 mm en la amoladora (eje apretado, guarda puesta). Probá que gire sin roce.",
          "Enganchá la masa de la soldadora a una pieza de hierro limpia. Regulá para electrodo 13 de " +
            (bom.electrodos.diametro_txt || "2,5") +
            " mm.",
        ],
      },
      {
        titulo: "5. Cortes (amoladora)",
        items: [
          "De cada barra de 6 m vas a ir sacando las piezas. Marcá todas las medidas de un mismo caño antes de cortar, dejando ~2 mm de merma por disco entre marca y marca.",
          "Orden: primero los palos de pie, después abajo y arriba, después parantes y tirantes, después travesaños, al final los barrotes.",
          ...cortes,
          "Si el disco se come, se pandea o chispea raro, cambialo. No termines el trabajo con un disco gastado.",
        ],
      },
      {
        titulo: "6. Rebabas",
        items: [
          "Cambiá al disco de desbaste 115 × 6 mm.",
          "Sacale el filo a cada boca de corte, por dentro y por fuera. Si no, no encastra y el cordón queda sucio.",
        ],
      },
      {
        titulo: "7. Armá el marco (todavía no hay reja)",
        items: [
          "En el piso, acomodá los dos largueros y los travesaños de arriba y abajo. Escuadra en las 4 puntas.",
          "Medí las dos diagonales: tienen que dar igual. Si no, empujá el marco hasta que cierren.",
          "Punteá (un piquito de soldadura en cada esquina). Volvé a medir diagonales. Recién ahí soldá las esquinas del todo.",
        ],
      },
      {
        titulo: "8. Parantes, travesaños y tirantes",
        items: itemsArriostrado(spec, grupos),
      },
      {
        titulo: "9. Barrotes",
        items: [
          `La luz real entre barrotes es ${bom.resumen.luz_real_mm} mm. Marcá las posiciones en el travesaño de arriba y el de abajo.`,
          "Presentá cada barrote, punteá arriba y abajo, controlá que queden a plomo, y recién soldá.",
          "No saltees el punteo: si soldás de una, se te vira el marco.",
        ],
      },
      {
        titulo: "10. Herrajes",
        items: [
          spec.tipo === "reja_ventana"
            ? "Esta reja no lleva bisagras. Las fijaciones van cuando la coloques en la pared."
            : spec.tipo === "porton_corredizo"
              ? spec.soporte === "granero"
                ? "Atornillá los carritos al travesaño de arriba, alineados con el riel. El riel se fija en obra, al dintel o a la pared."
                : "Soldá o atornillá las ruedas abajo, alineadas con el riel. El riel se fija en obra, no ahora en el aire."
              : "Soldá o atornillá las bisagras del lado de la mano que elegiste. Probá el movimiento antes de la pintura.",
          "Cerradura y pasadores: presentalos, marcá, y fijalos. Si pintás primero, después no pegan bien los tornillos.",
        ],
      },
      {
        titulo: "11. Limpieza y pintura",
        items: [
          "Cepillo de alambre en todo el cordón. Después disco flap grano 40 hasta sacar cascarilla y óxido.",
          `Dá antióxido en las ${bom.resumen.pintura_m2} m² de hierro (adentro del caño también, si podés). Dejá secar.`,
          "Después esmalte sintético, dos manos. No coloques hasta que esté seco al tacto.",
        ],
      },
      {
        titulo: "12. Colocar y terminar",
        items: colocacion(spec),
      },
    ],
  };
}
