import { createScene } from "./scene3d.js";
import { draw2d } from "./drawing2d.js";

const $ = (id) => document.getElementById(id);

const state = {
  catalog: null,
  spec: null,
  design: null,
  messages: [],
  timer: 0,
};

const scene = createScene($("view-3d"));

function specFromForm() {
  const form = $("form");
  return {
    tipo: state.spec?.tipo || "puerta_reja_peatonal",
    estilo: form.estilo.value,
    ancho: Number(form.ancho.value),
    alto: Number(form.alto.value),
    marco_perfil: form.marco_perfil.value,
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
  $("cortes").innerHTML = `
    <table>
      <thead>
        <tr><th>Material</th><th>Piezas</th><th>Metros</th><th>Caños de 6 m</th><th>Cortes</th></tr>
      </thead>
      <tbody>
        ${bom.cortes
          .map(
            (c) =>
              `<tr><td>${c.perfil}</td><td>${c.cantidad_piezas}</td><td>${uyNum(c.metros, 2)}</td><td>${c.barras_6m}</td><td>${c.detalle.join("<br>")}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `;
  const e = bom.electrodos;
  $("electrodos").innerHTML = `
    <div><strong>electrodo ${e.tipo}</strong> de ${e.diametro_txt || e.diametro_mm} mm</div>
    <div>${e.juntas} uniones · ${uyNum(e.filete_m, 2)} m de cordón</div>
    <div>~${e.varillas_aprox} varillas · ${e.pedido || "pedir " + e.comprar_kg + " kg"}</div>
    <div>${e.nota}</div>
  `;
  $("herrajes").innerHTML = bom.herrajes
    .map((h) => `<li>${h.cantidad} ${h.unidad} · ${h.item}</li>`)
    .join("");
  $("pintura").innerHTML = (bom.pintura || [])
    .map((h) => `<li>${uyNum(h.cantidad, 2)} ${h.unidad} · ${h.item}</li>`)
    .join("");
}

function applyDesign(design) {
  state.design = design;
  state.spec = design.spec;
  syncForm();
  renderCatalog();
  scene.setParts(design.parts);
  draw2d($("view-2d"), design.views2d);
  renderBom(design);
  $("status").textContent = `${design.parts.length} piezas · ${design.joints.length} uniones a soldar`;
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
  const tabs = [...document.querySelectorAll(".tab")];
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
      if (view === "3d") scene.resize();
    });
  }
}

async function boot() {
  const res = await fetch("/api/catalog");
  state.catalog = await res.json();
  fillSelect($("estilo"), state.catalog.estilos);
  fillSelect($("marco_perfil"), state.catalog.marcos);
  fillSelect($("barrote"), state.catalog.barrotes);
  state.spec = state.catalog.default_spec;
  syncForm();
  renderCatalog();
  bindTabs();
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
