function dimLine(ns, axis, dim, pad) {
  const g = document.createElementNS(ns, "g");
  g.setAttribute("class", "dim");
  const isH = axis === "h";
  const a = dim.start;
  const b = dim.end;
  const at = dim.at;
  if (isH) {
    g.innerHTML = `
      <line x1="${a}" y1="${at}" x2="${b}" y2="${at}" />
      <line x1="${a}" y1="${at - 12}" x2="${a}" y2="${at + 12}" />
      <line x1="${b}" y1="${at - 12}" x2="${b}" y2="${at + 12}" />
      <text x="${(a + b) / 2}" y="${at - 16}" text-anchor="middle">${dim.label}</text>
    `;
  } else {
    g.innerHTML = `
      <line x1="${at}" y1="${a}" x2="${at}" y2="${b}" />
      <line x1="${at - 12}" y1="${a}" x2="${at + 12}" y2="${a}" />
      <line x1="${at - 12}" y1="${b}" x2="${at + 12}" y2="${b}" />
      <text x="${at - 18}" y="${(a + b) / 2}" text-anchor="end" transform="rotate(-90 ${at - 18} ${(a + b) / 2})">${dim.label}</text>
    `;
  }
  return g;
}

const picked = [];
let pickHandlers = {};

export function mark2d(pinId, hoverId) {
  for (const el of picked) {
    const id = el.dataset.id || "";
    el.classList.toggle("is-on", Boolean(pinId) && id === pinId);
    el.classList.toggle("is-hover", Boolean(hoverId) && id === hoverId && id !== pinId);
  }
}

function drawHinge(ns, h) {
  const g = document.createElementNS(ns, "g");
  g.setAttribute("class", "herraje");
  const sign = h.side === "derecha" ? 1 : -1;
  const r = h.r;
  const hh = h.h;
  const gap = 4;
  const half = (hh - gap) / 2;
  const y0 = h.cy - hh / 2;
  const aleta = (len, y, toward) => {
    const rect = document.createElementNS(ns, "rect");
    const x = toward < 0 ? h.cx - r - len : h.cx + r;
    rect.setAttribute("x", x);
    rect.setAttribute("y", y + 6);
    rect.setAttribute("width", len);
    rect.setAttribute("height", half - 12);
    rect.setAttribute("class", "aleta");
    return rect;
  };
  const cano = (y) => {
    const rect = document.createElementNS(ns, "rect");
    rect.setAttribute("x", h.cx - r);
    rect.setAttribute("y", y);
    rect.setAttribute("width", r * 2);
    rect.setAttribute("height", half);
    rect.setAttribute("rx", r);
    rect.setAttribute("class", "cano");
    return rect;
  };
  g.append(
    aleta(h.flagOut, y0, sign),
    aleta(h.flagIn, y0 + half + gap, -sign),
    cano(y0),
    cano(y0 + half + gap),
  );
  const pomo = document.createElementNS(ns, "circle");
  pomo.setAttribute("cx", h.cx);
  pomo.setAttribute("cy", h.cy + hh / 2);
  pomo.setAttribute("r", r * 0.7);
  pomo.setAttribute("class", "pomo");
  g.appendChild(pomo);
  track(g, h.id);
  return g;
}

function svgEl(ns, tag, attrs) {
  const el = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function drawWheel2d(ns, f) {
  const g = document.createElementNS(ns, "g");
  g.setAttribute("class", "herraje fitting");
  const r = f.style === "nylon" ? 34 : 36;
  const circle = svgEl(ns, "circle", {
    cx: f.cx,
    cy: f.cy,
    r,
    class: f.style === "nylon" ? "nylon" : "herraje",
  });
  g.appendChild(circle);
  if (f.style === "canal_v") {
    g.appendChild(svgEl(ns, "circle", { cx: f.cx, cy: f.cy, r: r * 0.45, class: "pomo" }));
  } else if (f.style === "canal_u") {
    g.appendChild(svgEl(ns, "circle", { cx: f.cx, cy: f.cy, r: r * 0.55, class: "pomo" }));
  } else {
    g.appendChild(svgEl(ns, "circle", { cx: f.cx, cy: f.cy, r: 10, class: "pomo" }));
  }
  const forkH = r + 16;
  g.appendChild(svgEl(ns, "rect", {
    x: f.cx - 16,
    y: f.cy,
    width: 32,
    height: forkH,
    class: "aleta",
  }));
  track(g, f.id);
  return g;
}

function drawTrolley2d(ns, f) {
  const g = document.createElementNS(ns, "g");
  g.setAttribute("class", "herraje fitting");
  const double = f.style === "carrito_doble";
  const r = 16;
  const ys = f.cy + 46;
  const xs = double ? [f.cx - 26, f.cx + 26] : [f.cx];
  for (const x of xs) {
    g.appendChild(svgEl(ns, "circle", { cx: x, cy: ys, r, class: "herraje" }));
  }
  g.appendChild(svgEl(ns, "rect", {
    x: f.cx - (double ? 42 : 22),
    y: f.cy - 6,
    width: double ? 84 : 44,
    height: 40,
    class: "caja",
  }));
  track(g, f.id);
  return g;
}

function drawLock2d(ns, f) {
  const g = document.createElementNS(ns, "g");
  g.setAttribute("class", "herraje fitting");
  const sign = f.side === "derecha" ? 1 : -1;
  const bw = 70;
  const bh = 110;
  const x = sign > 0 ? f.cx : f.cx - bw;
  g.appendChild(svgEl(ns, "rect", { x, y: f.cy - bh / 2, width: bw, height: bh, class: "caja" }));
  if (f.style === "pasador") {
    g.appendChild(svgEl(ns, "rect", {
      x: f.cx + sign * 20 - 6,
      y: 20,
      width: 12,
      height: f.cy - 20,
      class: "gancho",
    }));
  } else {
    const hx = sign > 0 ? f.cx + bw : f.cx - bw - 36;
    g.appendChild(svgEl(ns, "rect", { x: hx, y: f.cy - 6, width: 36, height: 12, class: "gancho" }));
    g.appendChild(svgEl(ns, "rect", {
      x: sign > 0 ? hx + 24 : hx,
      y: f.cy - 28,
      width: 12,
      height: 34,
      class: "gancho",
    }));
  }
  track(g, f.id);
  return g;
}

function drawGuideRoller2d(ns, f) {
  const g = document.createElementNS(ns, "g");
  g.setAttribute("class", "herraje fitting");
  g.appendChild(svgEl(ns, "circle", { cx: f.cx, cy: f.cy, r: 18, class: "herraje" }));
  g.appendChild(svgEl(ns, "rect", {
    x: f.cx - 16,
    y: f.cy - 10,
    width: 32,
    height: 20,
    class: "aleta",
  }));
  track(g, f.id);
  return g;
}

function drawFitting(ns, f) {
  if (f.kind === "wheel") return drawWheel2d(ns, f);
  if (f.kind === "trolley") return drawTrolley2d(ns, f);
  if (f.kind === "lock") return drawLock2d(ns, f);
  if (f.kind === "guide_roller") return drawGuideRoller2d(ns, f);
  return drawWheel2d(ns, f);
}

function idFrom(el, root) {
  let n = el;
  while (n && n !== root) {
    if (n.dataset?.id) return n.dataset.id;
    n = n.parentNode;
  }
  return null;
}

function track(el, id) {
  el.dataset.id = id;
  el.style.cursor = "pointer";
  picked.push(el);
}

export function draw2d(container, views2d, handlers) {
  const front = views2d?.front;
  container.replaceChildren();
  picked.length = 0;
  if (handlers) pickHandlers = handlers;
  if (!front) return;

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  const pad = 140;
  const w = front.width + pad * 2;
  const h = front.height + pad * 2;
  svg.setAttribute("viewBox", `${-pad} ${-pad} ${w} ${h}`);
  svg.setAttribute("role", "img");
  svg.innerHTML = `
    <style>
      rect { fill: #c9d2dc; stroke: #efe6d6; stroke-width: 3; }
      rect.barrote { fill: #8aa0b3; }
      rect.marco, rect.travesano, rect.refuerzo { fill: #6d6458; }
      line.tirante { stroke: #6d6458; stroke-linecap: square; fill: none; }
      line.cable { stroke: #3e4c5a; stroke-linecap: round; stroke-dasharray: 34 16; fill: none; }
      circle.herraje { fill: #d4652f; stroke: #efe6d6; stroke-width: 3; }
      circle.nylon { fill: #e8e0d4; stroke: #efe6d6; stroke-width: 3; }
      g.herraje .cano { fill: #b8c3cc; stroke: #efe6d6; stroke-width: 3; }
      g.herraje .aleta { fill: #9aa5ae; stroke: #efe6d6; stroke-width: 3; }
      g.herraje .pomo { fill: #d4dce2; stroke: #efe6d6; stroke-width: 2; }
      g.herraje .caja { fill: #b8c3cc; stroke: #efe6d6; stroke-width: 3; }
      g.herraje .gancho { fill: #9aa5ae; stroke: #efe6d6; stroke-width: 3; }
      g.fitting.is-hover > * { stroke: #d4652f; stroke-width: 8; }
      g.fitting.is-on > * { stroke: #e8c372; stroke-width: 10; }
      .is-hover { stroke: #d4652f; }
      .is-on { stroke: #e8c372; }
      rect.is-hover, circle.is-hover, g.is-hover > * { stroke: #d4652f; stroke-width: 8; }
      rect.is-on, circle.is-on, g.is-on > * { stroke: #e8c372; stroke-width: 10; }
      .dim line { stroke: #e8c372; stroke-width: 2; }
      .dim text { fill: #e8c372; font: 52px ui-monospace, monospace; }
    </style>
  `;

  const root = document.createElementNS(ns, "g");
  root.setAttribute("transform", `translate(0 ${front.height}) scale(1 -1)`);

  for (const r of front.rects) {
    const rect = document.createElementNS(ns, "rect");
    rect.setAttribute("x", r.x);
    rect.setAttribute("y", r.y);
    rect.setAttribute("width", Math.max(r.w, 2));
    rect.setAttribute("height", Math.max(r.h, 2));
    rect.setAttribute("class", r.role || "");
    if (r.id) track(rect, r.id);
    root.appendChild(rect);
  }
  for (const s of front.segments || []) {
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", s.x1);
    line.setAttribute("y1", s.y1);
    line.setAttribute("x2", s.x2);
    line.setAttribute("y2", s.y2);
    line.setAttribute("stroke-width", Math.max(s.w || 20, 8));
    line.setAttribute("class", s.role || "tirante");
    if (s.id) track(line, s.id);
    root.appendChild(line);
  }
  for (const h of front.hinges || []) {
    root.appendChild(drawHinge(ns, h));
  }
  for (const f of front.fittings || []) {
    root.appendChild(drawFitting(ns, f));
  }
  svg.appendChild(root);
  svg.addEventListener("pointermove", (event) => {
    pickHandlers.onHover?.(idFrom(event.target, svg));
  });
  svg.addEventListener("pointerleave", () => pickHandlers.onHover?.(null));
  svg.addEventListener("click", (event) => {
    const id = idFrom(event.target, svg);
    pickHandlers.onSelect?.(id);
    pickHandlers.onHover?.(id);
  });

  for (const dim of front.dims || []) {
    svg.appendChild(dimLine(ns, dim.axis, dim, pad));
  }

  container.appendChild(svg);
}
