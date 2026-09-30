import { applyPatch, getCatalog, TIPOS, ESTILOS, MARCOS, BARROTES } from "./catalog.js";
import { runDesign } from "./design.js";

const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

const TOOLS = [
  {
    name: "aplicar_diseno",
    description:
      "Cambia el diseño de la reja o el portón. Solo los campos que pidió el usuario. Metros, kilos y electrodos los calcula el motor; no los inventes.",
    parameters: {
      type: "object",
      properties: {
        tipo: {
          type: "string",
          enum: TIPOS.map((t) => t.id),
        },
        estilo: {
          type: "string",
          enum: ESTILOS.map((e) => e.id),
        },
        ancho: { type: "number", description: "Ancho en milímetros" },
        alto: { type: "number", description: "Alto en milímetros" },
        marco_perfil: { type: "string", enum: MARCOS.map((m) => m.id) },
        barrote: { type: "string", enum: BARROTES.map((b) => b.id) },
        luz_mm: { type: "number", description: "Luz entre barrotes, en mm" },
        travesanos: { type: "integer" },
        lado_bisagra: { type: "string", enum: ["izquierda", "derecha", "exterior"] },
        incluir_umbral: { type: "boolean" },
      },
    },
  },
];

function systemPrompt(design) {
  const { spec, bom } = design;
  return `Sos el asistente de taller de DIY Pando, en Uruguay. Hablás uruguayo, breve y concreto.
Terminología de casa de hierros y ferretería: caño estructural, hierro redondo del 12, electrodo 6013 (electrodo 13) de 2,5 o 3,2, caños de 6 m, antióxido, esmalte sintético, mano izquierda/derecha, tarugos, riel, falleba.
El usuario arma puertas y rejas. Podés cambiar el diseño con la herramienta aplicar_diseno.
NUNCA inventes metros, kg ni electrodos: usá solo los datos calculados que te pasan.
Si pide cambio de medidas, tipo, caños o luz, llamá aplicar_diseno.
Si solo pregunta, contestá con la lista para pedir.

Tipos: ${TIPOS.map((t) => t.id).join(", ")}
Caños de marco: ${MARCOS.map((m) => m.id).join(", ")}
Barrotes: ${BARROTES.map((b) => b.id).join(", ")}

Diseño actual (JSON): ${JSON.stringify(spec)}
Lista calculada (JSON): ${JSON.stringify({
    cortes: bom.cortes.map((c) => ({
      material: c.perfil,
      pedir: c.pedido,
      cortes_taller: c.detalle,
    })),
    electrodos: bom.electrodos,
    resumen: bom.resumen,
  })}`;
}

function extractToolCalls(result) {
  if (!result) return [];
  if (Array.isArray(result.tool_calls) && result.tool_calls.length) return result.tool_calls;
  if (result.response && Array.isArray(result.response.tool_calls)) return result.response.tool_calls;
  return [];
}

function extractText(result) {
  if (!result) return "";
  if (typeof result.response === "string") return result.response;
  if (typeof result === "string") return result;
  if (result.response && typeof result.response.response === "string") return result.response.response;
  if (Array.isArray(result.response)) {
    return result.response.map((p) => p.content || p.text || "").join("\n");
  }
  return "";
}

function toolArgs(call) {
  const raw = call.arguments ?? call.function?.arguments ?? call.params ?? {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" ? raw : {};
}

function parseJsonPatch(text) {
  if (!text) return null;
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const blob = fenced ? fenced[1] : text.match(/\{[\s\S]*\}/)?.[0];
  if (!blob) return null;
  try {
    const data = JSON.parse(blob);
    if (data.patch && typeof data.patch === "object") return data;
    if (data.tipo || data.ancho || data.alto || data.barrote || data.luz_mm) {
      return { patch: data, reply: data.reply || "" };
    }
  } catch {
    return null;
  }
  return null;
}

export function localPatchFromText(text) {
  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const patch = {};

  if (/\bventana\b/.test(t)) patch.tipo = "reja_ventana";
  else if (/corrediz/.test(t)) patch.tipo = "porton_corredizo";
  else if (/dos hojas|2 hojas|doble hoja/.test(t)) patch.tipo = "porton_dos_hojas";
  else if (/peatonal|puerta reja|cancela/.test(t)) patch.tipo = "puerta_reja_peatonal";

  if (/horizontal/.test(t)) patch.estilo = "barrotes_horizontales";
  else if (/\bmixto\b/.test(t)) patch.estilo = "mixto";
  else if (/vertical/.test(t)) patch.estilo = "barrotes_verticales";

  if (/redondo(?:\s+del)?\s*14|hierro del 14|ø\s*14|o14/.test(t)) patch.barrote = "14_redondo";
  else if (/redondo(?:\s+del)?\s*12|hierro del 12|ø\s*12|o12/.test(t)) patch.barrote = "12_redondo";
  else if (/redondo(?:\s+del)?\s*10|hierro del 10|ø\s*10|o10/.test(t)) patch.barrote = "10_redondo";
  else if (/25\s*x\s*25/.test(t)) patch.barrote = "25x25x1.2";
  else if (/16\s*x\s*16/.test(t)) patch.barrote = "16x16x1.2";
  else if (/20\s*x\s*20/.test(t)) patch.barrote = "20x20x1.2";

  if (/80\s*x\s*40/.test(t)) patch.marco_perfil = "80x40x1.6";
  else if (/50\s*x\s*50/.test(t)) patch.marco_perfil = "50x50x1.6";
  else if (/40\s*x\s*20/.test(t)) patch.marco_perfil = "40x20x1.6";
  else if (/30\s*x\s*30/.test(t)) patch.marco_perfil = "30x30x1.2";
  else if (/40\s*x\s*40/.test(t)) patch.marco_perfil = "40x40x1.6";

  const luzCm = t.match(/luz\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*cm/);
  const luzMm = t.match(/luz\s*(?:de\s*)?(\d+)\s*mm/);
  if (luzCm) patch.luz_mm = Math.round(Number(luzCm[1].replace(",", ".")) * 10);
  else if (luzMm) patch.luz_mm = Number(luzMm[1]);

  const metros = t.match(/(\d+(?:[.,]\d+)?)\s*m(?:ts|etros)?\s*(?:x|por)\s*(\d+(?:[.,]\d+)?)\s*m/);
  const mmPair = t.match(/(\d{3,4})\s*(?:x|por)\s*(\d{3,4})/);
  const cmPair = t.match(/(\d{2,3})\s*(?:x|por)\s*(\d{2,3})(?!\d)/);
  if (metros) {
    patch.ancho = Math.round(Number(metros[1].replace(",", ".")) * 1000);
    patch.alto = Math.round(Number(metros[2].replace(",", ".")) * 1000);
  } else if (mmPair) {
    patch.ancho = Number(mmPair[1]);
    patch.alto = Number(mmPair[2]);
  } else if (cmPair) {
    const a = Number(cmPair[1]);
    const b = Number(cmPair[2]);
    if (a < 400 && b < 400) {
      patch.ancho = a * 10;
      patch.alto = b * 10;
    }
  }

  const trav = t.match(/(\d+)\s*travesan/);
  if (trav) patch.travesanos = Number(trav[1]);
  if (/sin umbral|sin travesano de abajo/.test(t)) patch.incluir_umbral = false;
  if (/con umbral|con travesano de abajo/.test(t)) patch.incluir_umbral = true;
  if (/(?:bisagra|mano)\s*(a la\s*)?derecha/.test(t)) patch.lado_bisagra = "derecha";
  if (/(?:bisagra|mano)\s*(a la\s*)?izquierda/.test(t)) patch.lado_bisagra = "izquierda";

  return patch;
}

function describeLocal(design, patch) {
  const keys = Object.keys(patch);
  const { bom, spec } = design;
  const e = bom.electrodos;
  const changed = keys.length
    ? `Listo, actualicé el pedido.`
    : "No marqué un cambio; te dejo lo que hay que pedir ahora.";
  return `${changed} ${spec.ancho}×${spec.alto} mm, ${bom.tipo}. ${bom.resumen.barrotes} barrotes, luz ${bom.resumen.luz_real_mm} mm. Electrodo ${e.tipo} de ${e.diametro_txt || e.diametro_mm} mm: ${e.pedido}. Peso aprox. ${bom.resumen.peso_kg} kg. Estimado de taller, no es presupuesto.`;
}

async function runModel(env, payload) {
  if (!env.AI || typeof env.AI.run !== "function") {
    throw new Error("AI binding unavailable");
  }
  return env.AI.run(MODEL, payload);
}

export async function chatDesign(env, body) {
  const catalog = getCatalog();
  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  let design = runDesign(body.spec || catalog.default_spec);
  let source = "local";

  const localPatch = localPatchFromText(lastUser);
  const chatMessages = [
    { role: "system", content: systemPrompt(design) },
    ...messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 4000),
    })),
  ];

  try {
    const first = await runModel(env, {
      messages: chatMessages,
      tools: TOOLS,
      max_tokens: 800,
      temperature: 0.2,
    });
    const calls = extractToolCalls(first);
    const text = extractText(first);
    let patch = {};
    if (calls.length) {
      const apply = calls.find((c) => (c.name || c.function?.name) === "aplicar_diseno") || calls[0];
      patch = toolArgs(apply);
    } else {
      const parsed = parseJsonPatch(text);
      if (parsed?.patch) patch = parsed.patch;
    }

    if (Object.keys(patch).length) {
      design = runDesign(applyPatch(design.spec, patch));
      source = "workers-ai";
      try {
        const second = await runModel(env, {
          messages: [
            { role: "system", content: systemPrompt(design) },
            ...chatMessages.slice(1),
            {
              role: "tool",
              content: JSON.stringify({
                ok: true,
                spec: design.spec,
                electrodos: design.bom.electrodos,
                resumen: design.bom.resumen,
              }),
            },
          ],
          max_tokens: 500,
          temperature: 0.2,
        });
        const reply = extractText(second) || describeLocal(design, patch);
        return { reply, source, ...design };
      } catch {
        return { reply: describeLocal(design, patch), source, ...design };
      }
    }

    if (text.trim()) {
      source = "workers-ai";
      return { reply: text.trim(), source, ...design };
    }
  } catch {
    source = "local";
  }

  if (Object.keys(localPatch).length) {
    design = runDesign(applyPatch(design.spec, localPatch));
  }
  return { reply: describeLocal(design, localPatch), source, ...design };
}
