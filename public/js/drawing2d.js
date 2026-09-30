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
      circle.herraje { fill: #d4652f; stroke: #efe6d6; stroke-width: 3; }
      g.herraje .cano { fill: #b8c3cc; stroke: #efe6d6; stroke-width: 3; }
      g.herraje .aleta { fill: #9aa5ae; stroke: #efe6d6; stroke-width: 3; }
      g.herraje .pomo { fill: #d4dce2; stroke: #efe6d6; stroke-width: 2; }
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
  for (const c of front.circles || []) {
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", c.cx);
    circle.setAttribute("cy", c.cy);
    circle.setAttribute("r", c.r);
    circle.setAttribute("class", c.role || "herraje");
    if (c.id) track(circle, c.id);
    root.appendChild(circle);
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
