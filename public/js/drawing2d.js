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

export function draw2d(container, views2d) {
  const front = views2d?.front;
  container.replaceChildren();
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
    root.appendChild(rect);
  }
  svg.appendChild(root);

  for (const dim of front.dims || []) {
    svg.appendChild(dimLine(ns, dim.axis, dim, pad));
  }

  container.appendChild(svg);
}
