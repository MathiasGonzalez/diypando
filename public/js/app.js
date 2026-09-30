import { createScene } from "./scene3d.js";
import { draw2d, mark2d } from "./drawing2d.js";

const $ = (id) => document.getElementById(id);

const state = {
  catalog: null,
  spec: null,
  design: null,
  messages: [],
  timer: 0,
};

const scene = createScene($("view-3d"));

const pick = { pin: null, hover: null };

function piezaDe(id) {
  if (!id || !state.design) return null;
  return state.design.parts.find((part) => part.id === id) || null;
}

function tituloDe(part) {
  const hoja = /-b(?:$|-)/.test(part.id)
    ? " · hoja derecha"
    : /-a(?:$|-)/.test(part.id)
      ? " · hoja izquierda"
      : "";
  const base = part.id.replace(/-a(?=-|$)/, "").replace(/-b(?=-|$)/, "");
  const fijos = {
    "poste-izq": "Poste izquierdo",
    "poste-der": "Poste derecho",
    "travesano-sup": "Travesaño superior",
    umbral: "Travesaño de abajo",
    "guia-inferior": "Guía inferior",
    tirante: "Tirante",
  };
  if (fijos[base]) return fijos[base] + hoja;
  const match = base.match(/^(barrote-[vh]|tirante|refuerzo|bisagra|rueda|travesano)-(\d+)$/);
  const nombres = {
    "barrote-v": "Barrote",
    "barrote-h": "Barrote",
    tirante: "Tirante",
    refuerzo: "Refuerzo",
    bisagra: "Bisagra",
    rueda: "Rueda",
    travesano: "Travesaño",
  };
  if (match) return `${nombres[match[1]]} ${match[2]}${hoja}`;
  const roles = {
    marco: "Marco",
    travesano: "Travesaño",
    barrote: "Barrote",
    refuerzo: "Refuerzo",
    tirante: "Tirante",
    herraje: "Herraje",
    guia: "Guía",
  };
  return (roles[part.role] || "Pieza") + hoja;
}

function renderPieza() {
  const part = piezaDe(pick.hover || pick.pin);
  const card = $("pieza");
  if (!part) {
    card.classList.add("is-hidden");
    card.classList.remove("is-pinned");
    return;
  }
  const pinned = part.id === pick.pin && !pick.hover;
  card.classList.remove("is-hidden");
  card.classList.toggle("is-pinned", pinned);
  $("pieza-cerrar").classList.toggle("is-hidden", !pinned);
  $("pieza-titulo").textContent = tituloDe(part);
  $("pieza-perfil").textContent = part.profile?.nombre || "";
  const esHerraje = part.kind === "hinge" || part.kind === "wheel";
  $("pieza-corte").textContent = part.kind === "hinge"
    ? "A soldar · 100 mm"
    : esHerraje
      ? ""
      : `Corte ${Math.round(part.length || 0).toLocaleString("es-UY")} mm`;
}

function onHoverPieza(id) {
  if (pick.hover === id) return;
  pick.hover = id;
  scene.highlightPart(id);
  mark2d(pick.pin, id);
  renderPieza();
}

function onSelectPieza(id) {
  pick.pin = id && pick.pin === id ? null : id;
  pick.hover = null;
  scene.highlightPart(null);
  scene.selectPart(pick.pin);
  mark2d(pick.pin, null);
  renderPieza();
}

function specFromForm() {
  const form = $("form");
  return {
    tipo: state.spec?.tipo || "puerta_reja_peatonal",
    estilo: form.estilo.value,
    ancho: Number(form.ancho.value),
    alto: Number(form.alto.value),
    marco_perfil: form.marco_perfil.value,
    travesano_perfil: form.travesano_perfil.value,
    tirante_perfil: form.tirante_perfil.value,
    refuerzo_perfil: form.refuerzo_perfil.value,
    barrote: form.barrote.value,
    luz_mm: Number(form.luz_mm.value),
    travesanos: Number(form.travesanos.value),
    lado_bisagra: form.lado_bisagra.value,
    incluir_umbral: form.incluir_umbral.checked,
  };
}

function fillSelect(el, items, value) {
  el.replaceChildren(
    ...items.map((item) => {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = item.nombre;
      return opt;
    }),
  );
  if (value) el.value = value;
}

function renderCatalog() {
  const box = $("tipos");
  box.replaceChildren(
    ...state.catalog.tipos.map((tipo) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tipo" + (tipo.id === state.spec.tipo ? " is-on" : "");
      btn.innerHTML = `<strong>${tipo.nombre}</strong><small>${tipo.descripcion}</small>`;
      btn.addEventListener("click", () => {
        state.spec = { tipo: tipo.id, ...tipo.defaults };
        syncForm();
        void refreshDesign();
        renderCatalog();
      });
      return btn;
    }),
  );
}

function syncForm() {
  const s = state.spec;
  $("estilo").value = s.estilo;
  $("ancho").value = s.ancho;
  $("alto").value = s.alto;
  $("marco_perfil").value = s.marco_perfil;
  $("travesano_perfil").value = s.travesano_perfil;
  $("tirante_perfil").value = s.tirante_perfil;
  $("refuerzo_perfil").value = s.refuerzo_perfil;
  $("barrote").value = s.barrote;
  $("luz_mm").value = s.luz_mm;
  $("travesanos").value = s.travesanos;
  $("lado_bisagra").value = s.lado_bisagra;
  $("incluir_umbral").checked = s.incluir_umbral;
}

function uyNum(n, digits = 2) {
  return Number(n).toLocaleString("es-UY", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const FOTOS = [
  { test: /redondo/i, src: "/img/materiales/hierro-redondo.jpg", alt: "Barras de hierro redondo liso" },
  { test: /caño/i, src: "/img/materiales/cano-marcado.jpg", alt: "Caño estructural hueco" },
  { test: /electrodo|6013/i, src: "/img/materiales/electrodos.jpg", alt: "Electrodos 6013" },
  { test: /disco de corte/i, src: "/img/materiales/disco-corte.jpg", alt: "Disco de corte para metal" },
  { test: /desbaste/i, src: "/img/materiales/disco-desbaste.jpg", alt: "Disco de desbaste, más grueso que el de corte" },
  { test: /flap|láminas/i, src: "/img/materiales/disco-flap.jpg", alt: "Disco flap de láminas" },
  { test: /tarugo|tornillo/i, src: "/img/materiales/tarugos.jpg", alt: "Tarugos plásticos y tornillos" },
  { test: /bisagra/i, src: "/img/materiales/bisagra.jpg", alt: "Bisagra de pomo" },
  { test: /pasador/i, src: "/img/materiales/pasador.jpg", alt: "Pasador de puerta" },
  { test: /esmalte/i, src: "/img/materiales/esmalte.jpg", alt: "Latas de esmalte sintético" },
];

function fotoDe(texto) {
  return FOTOS.find((f) => f.test.test(texto)) || null;
}

function liConFoto(html, texto) {
  const foto = fotoDe(texto);
  if (!foto) return `<li>${html}</li>`;
  return `<li class="con-foto"><img src="${foto.src}" alt="${foto.alt}"><span>${html}</span></li>`;
}

function nombrePerfil(lista, id) {
  return lista?.find((p) => p.id === id)?.nombre || "";
}

function renderFotosMaterial(spec) {
  const box = $("fotos-material");
  const nombres = [
    nombrePerfil(state.catalog.marcos, spec.marco_perfil),
    nombrePerfil(state.catalog.estructurales, spec.travesano_perfil),
    nombrePerfil(state.catalog.estructurales, spec.tirante_perfil),
    nombrePerfil(state.catalog.estructurales, spec.refuerzo_perfil),
    nombrePerfil(state.catalog.barrotes, spec.barrote),
  ].filter(Boolean);
  const cards = [];
  for (const nombre of nombres) {
    const foto = fotoDe(nombre);
    if (!foto) continue;
    const previa = cards.find((c) => c.foto.src === foto.src);
    if (previa) {
      if (!previa.nombre.includes(nombre)) previa.nombre = `${previa.nombre} · ${nombre}`;
    } else {
      cards.push({ nombre, foto });
    }
  }
  box.replaceChildren(
    ...cards.filter((c) => c.foto).map((c) => {
      const fig = document.createElement("figure");
      const img = document.createElement("img");
      img.src = c.foto.src;
      img.alt = c.foto.alt;
      const cap = document.createElement("figcaption");
      cap.textContent = c.nombre;
      fig.append(img, cap);
      return fig;
    }),
  );
}

function renderBom(design) {
  const { bom, spec } = design;
  $("aviso").textContent = bom.aviso;
  $("resumen").innerHTML = `
    <div><span>Trabajo</span><strong>${bom.tipo}</strong></div>
    <div><span>Medida</span><strong>${spec.ancho} × ${spec.alto} mm</strong></div>
    <div><span>Barrotes</span><strong>${bom.resumen.barrotes}</strong></div>
    <div><span>Luz real</span><strong>${bom.resumen.luz_real_mm} mm</strong></div>
    <div><span>Peso</span><strong>${uyNum(bom.resumen.peso_kg, 2)} kg</strong></div>
    <div><span>Antióxido</span><strong>${uyNum(bom.resumen.pintura_m2, 2)} m²</strong></div>
  `;
  $("pedido-hierros").innerHTML = bom.cortes
    .map((c) => liConFoto(`<strong>${c.pedido}</strong> de ${c.perfil}`, c.perfil))
    .join("");
  renderFotosMaterial(spec);
  $("cortes").innerHTML = `
    <table>
      <thead>
        <tr><th>Material</th><th>Cortes</th></tr>
      </thead>
      <tbody>
        ${bom.cortes
          .map(
            (c) =>
              `<tr><td>${c.perfil}</td><td>${c.detalle.join(" · ")}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `;
  const e = bom.electrodos;
  const fotoElectro = fotoDe(e.pedido);
  $("electrodos").innerHTML = `
    ${fotoElectro ? `<img src="${fotoElectro.src}" alt="${fotoElectro.alt}">` : ""}
    <div><strong>${e.pedido}</strong></div>
    <div>${e.nota}</div>
  `;
  $("discos").innerHTML = (bom.discos || [])
    .map((h) => liConFoto(`<strong>${h.cantidad} ${h.unidad}</strong> · ${h.item} <small>(${h.para})</small>`, h.item))
    .join("");
  $("herrajes").innerHTML = bom.herrajes
    .map((h) => liConFoto(`${h.cantidad} ${h.unidad} · ${h.item}`, h.item))
    .join("");
  $("pintura").innerHTML = (bom.pintura || [])
    .map((h) => liConFoto(`${uyNum(h.cantidad, 2)} ${h.unidad} · ${h.item}`, h.item))
    .join("");
  renderPasos(design.pasos);
}

function renderPasos(pasos) {
  const box = $("pasos");
  if (!pasos?.etapas) {
    box.replaceChildren();
    return;
  }
  box.replaceChildren(
    ...pasos.etapas.map((etapa) => {
      const li = document.createElement("li");
      const h = document.createElement("h3");
      h.textContent = etapa.titulo;
      const ul = document.createElement("ul");
      for (const item of etapa.items) {
        const row = document.createElement("li");
        row.textContent = item;
        ul.appendChild(row);
      }
      li.append(h, ul);
      return li;
    }),
  );
}

function weldCaption(info) {
  if (!info || !info.total) return "Sin uniones";
  if (info.done) return `Soldadura ${info.total} / ${info.total} · listo`;
  if (!info.current) return `0 / ${info.total} · dale reproducir (puntear y cordón)`;
  const note = info.joint?.note || "unión";
  return `Soldadura ${info.current} / ${info.total} · ${note} (puntear y cordón)`;
}

function resistCaption(info) {
  const pct = Math.round((info?.load || 0) * 100);
  if (!pct) return "Sin carga · mapa de calor apagado";
  return `Viento ${pct}% · mapa de pedido aparente, no es un cálculo`;
}

function syncHeatLegend() {
  const show3d = !$("view-3d").classList.contains("is-hidden");
  $("heat-legend").classList.toggle("is-hidden", viewMode !== "resistencia" || !show3d);
}

let viewMode = "soldar";

function setViewMode(mode) {
  viewMode = mode === "resistencia" ? "resistencia" : "soldar";
  scene.setMode(viewMode);
  const soldar = viewMode === "soldar";
  $("mode-soldar").classList.toggle("is-on", soldar);
  $("mode-resist").classList.toggle("is-on", !soldar);
  $("mode-soldar").setAttribute("aria-pressed", soldar ? "true" : "false");
  $("mode-resist").setAttribute("aria-pressed", soldar ? "false" : "true");
  $("weld-controls").classList.toggle("is-hidden", !soldar);
  $("resist-controls").classList.toggle("is-hidden", soldar);
  syncHeatLegend();
}

function bindWelds() {
  scene.setJoints([], (info) => {
    if (viewMode === "soldar") $("weld-label").textContent = weldCaption(info);
  });
  scene.setResistChange((info) => {
    if (viewMode !== "resistencia") return;
    $("weld-label").textContent = resistCaption(info);
    const slider = $("resist-load");
    const next = String(Math.round((info.load || 0) * 100));
    if (slider.value !== next) slider.value = next;
  });
  $("weld-play").addEventListener("click", () => scene.play());
  $("weld-pause").addEventListener("click", () => scene.pause());
  $("weld-step").addEventListener("click", () => scene.step());
  $("weld-restart").addEventListener("click", () => scene.restart());
  $("weld-speed").addEventListener("change", (event) => scene.setSpeed(event.target.value));
  $("mode-soldar").addEventListener("click", () => setViewMode("soldar"));
  $("mode-resist").addEventListener("click", () => setViewMode("resistencia"));
  $("resist-play").addEventListener("click", () => scene.playResist());
  $("resist-pause").addEventListener("click", () => scene.pauseResist());
  $("resist-reset").addEventListener("click", () => scene.resetResist());
  $("resist-load").addEventListener("input", (event) => {
    scene.setLoad(Number(event.target.value) / 100);
  });
}

function applyDesign(design) {
  state.design = design;
  state.spec = design.spec;
  syncForm();
  renderCatalog();
  scene.setParts(design.parts, design.spec, design.meta);
  pick.pin = null;
  pick.hover = null;
  renderPieza();
  scene.setJoints(design.joints, (info) => {
    if (viewMode === "soldar") $("weld-label").textContent = weldCaption(info);
  });
  draw2d($("view-2d"), design.views2d, {
    onHover: onHoverPieza,
    onSelect: onSelectPieza,
  });
  renderBom(design);
  $("status").textContent = `${design.parts.length} piezas · ${design.joints.length} uniones a soldar`;
  if (viewMode === "resistencia") {
    $("weld-label").textContent = resistCaption({ load: 0 });
    $("resist-load").value = "0";
  }
}

async function refreshDesign() {
  $("status").textContent = "Calculando…";
  const res = await fetch("/api/design", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ spec: specFromForm() }),
  });
  const data = await res.json();
  if (!res.ok) {
    $("status").textContent = data.error || "Error de cálculo";
    return;
  }
  applyDesign(data);
}

function scheduleRefresh() {
  clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    void refreshDesign();
  }, 300);
}

function addMsg(role, text) {
  state.messages.push({ role, content: text });
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = (role === "user" ? "Vos: " : "Taller: ") + text;
  $("chat-log").appendChild(el);
  $("chat-log").scrollTop = $("chat-log").scrollHeight;
}

async function sendChat(text) {
  addMsg("user", text);
  $("chat-source").textContent = "Pensando…";
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ spec: specFromForm(), messages: state.messages }),
  });
  const data = await res.json();
  if (!res.ok) {
    addMsg("assistant", data.error || "No pude responder");
    $("chat-source").textContent = "";
    return;
  }
  addMsg("assistant", data.reply);
  applyDesign(data);
  $("chat-source").textContent =
    data.source === "workers-ai"
      ? "Respuesta con Workers AI. Las cantidades las calcula el taller, no la IA."
      : "Asistente local. Las cantidades son para pedir, no un presupuesto.";
}

function bindTabs() {
  const tabs = [...document.querySelectorAll(".tabs .tab")];
  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const view = tab.dataset.view;
      for (const t of tabs) {
        const on = t.dataset.view === view;
        t.classList.toggle("is-on", on);
        t.setAttribute("aria-pressed", on ? "true" : "false");
      }
      $("view-3d").classList.toggle("is-hidden", view !== "3d");
      $("view-2d").classList.toggle("is-hidden", view !== "2d");
      $("weld-bar").classList.toggle("is-hidden", view !== "3d");
      syncHeatLegend();
      if (view === "3d") scene.resize();
    });
  }
}

async function boot() {
  const res = await fetch("/api/catalog");
  state.catalog = await res.json();
  fillSelect($("estilo"), state.catalog.estilos);
  fillSelect($("marco_perfil"), state.catalog.marcos);
  fillSelect($("travesano_perfil"), state.catalog.estructurales);
  fillSelect($("tirante_perfil"), state.catalog.estructurales);
  fillSelect($("refuerzo_perfil"), state.catalog.estructurales);
  fillSelect($("barrote"), state.catalog.barrotes);
  state.spec = state.catalog.default_spec;
  syncForm();
  renderCatalog();
  bindTabs();
  bindWelds();
  scene.setPickHandlers({ onHover: onHoverPieza, onSelect: onSelectPieza });
  $("pieza-cerrar").addEventListener("click", () => onSelectPieza(null));
  $("form").addEventListener("input", scheduleRefresh);
  $("form").addEventListener("change", scheduleRefresh);
  $("chat-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("chat-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    void sendChat(text);
  });
  await refreshDesign();
}

void boot();
