export function uyNum(n, digits = 2) {
  return Number(n).toLocaleString("es-UY", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function uyEspesor(t) {
  return String(t).replace(".", ",");
}

export function nombreCaño(w, d, t) {
  return `caño estructural ${w}x${d} x ${uyEspesor(t)}`;
}

export function nombreRedondo(diam) {
  return `hierro redondo del ${diam}`;
}

export function nombrePlanchuela(w, t) {
  return `planchuela ${w} × ${uyEspesor(t)}`;
}

export function nombreAngulo(w, d, t) {
  return `ángulo ${w}×${d} × ${uyEspesor(t)}`;
}

export function nombreCable(diam) {
  return `cable de acero de ${diam} mm`;
}
