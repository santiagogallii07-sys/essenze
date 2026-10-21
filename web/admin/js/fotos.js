// Procesa fotos en el navegador antes de subirlas:
// 1. Si el fondo es blanco liso, lo vuelve transparente (relleno desde los bordes, con borde suavizado).
// 2. Recorta el espacio vacío y deja un margen parejo.
// 3. Reduce el tamaño y la guarda en WebP (o PNG si el navegador no sabe hacer WebP).

const BLANCO = 236;      // canal mínimo para considerar un píxel "fondo blanco"
const TOLERANCIA = 26;   // diferencia máxima entre canales (fondo sin color)

function esFondo(d, i) {
  if (d[i + 3] < 12) return true; // lo transparente (márgenes del encuadre) también es fondo
  const r = d[i], g = d[i + 1], b = d[i + 2];
  return r >= BLANCO && g >= BLANCO && b >= BLANCO && Math.max(r, g, b) - Math.min(r, g, b) <= TOLERANCIA;
}

// ¿Cuánto del borde es blanco? Si es la mayoría, la foto es de producto sobre fondo blanco.
function proporcionBordeBlanco(d, w, h) {
  let blancos = 0;
  let total = 0;
  const paso = Math.max(1, Math.floor((w + h) / 300));
  for (let x = 0; x < w; x += paso) {
    for (const y of [0, h - 1]) { total++; if (esFondo(d, (y * w + x) * 4)) blancos++; }
  }
  for (let y = 0; y < h; y += paso) {
    for (const x of [0, w - 1]) { total++; if (esFondo(d, (y * w + x) * 4)) blancos++; }
  }
  return blancos / total;
}

function quitarFondoBlanco(img) {
  const { data: d, width: w, height: h } = img;
  const fondo = new Uint8Array(w * h);
  const pila = [];
  const sembrar = (x, y) => {
    const p = y * w + x;
    if (!fondo[p] && esFondo(d, p * 4)) { fondo[p] = 1; pila.push(p); }
  };
  for (let x = 0; x < w; x++) { sembrar(x, 0); sembrar(x, h - 1); }
  for (let y = 0; y < h; y++) { sembrar(0, y); sembrar(w - 1, y); }
  while (pila.length) {
    const p = pila.pop();
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) sembrar(x - 1, y);
    if (x < w - 1) sembrar(x + 1, y);
    if (y > 0) sembrar(x, y - 1);
    if (y < h - 1) sembrar(x, y + 1);
  }
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (fondo[p]) {
      d[i + 3] = 0;
      continue;
    }
    // Borde: píxeles pegados al fondo se vuelven semitransparentes según lo blancos que sean,
    // y se les quita el blanco mezclado para que no quede un halo claro sobre el negro.
    const x = p % w;
    const y = (p - x) / w;
    const vecino = (x > 0 && fondo[p - 1]) || (x < w - 1 && fondo[p + 1]) || (y > 0 && fondo[p - w]) || (y < h - 1 && fondo[p + w]);
    if (!vecino) continue;
    const minimo = Math.min(d[i], d[i + 1], d[i + 2]);
    const a = Math.min(1, Math.max(0.15, (255 - minimo) / (255 - 180)));
    for (let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(255, Math.round((d[i + c] - 255 * (1 - a)) / a)));
    d[i + 3] = Math.round(a * 255);
  }
  return img;
}

function limites(img) {
  const { data: d, width: w, height: h } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? { x0: 0, y0: 0, x1: w - 1, y1: h - 1 } : { x0, y0, x1, y1 };
}

function lienzo(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function aBlob(canvas, tipo, calidad) {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, calidad));
}

/**
 * @param {Blob} archivo  imagen original
 * @param {{quitarFondo?: boolean, maximo?: number}} opciones
 * @returns {Promise<{blob: Blob, tipo: string, fondo: 'recorte'|'foto', ancho: number, alto: number}>}
 */
export async function procesarFoto(archivo, { quitarFondo = true, maximo = 1000 } = {}) {
  const bmp = await createImageBitmap(archivo);
  const escala = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * escala));
  const h = Math.max(1, Math.round(bmp.height * escala));
  const base = lienzo(w, h);
  const ctx = base.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();

  let img = ctx.getImageData(0, 0, w, h);
  let fondo = 'foto';
  if (quitarFondo && proporcionBordeBlanco(img.data, w, h) > 0.7) {
    img = quitarFondoBlanco(img);
    ctx.putImageData(img, 0, 0);
    fondo = 'recorte';
  }

  // Recorte del espacio vacío con un margen del 4%.
  const l = fondo === 'recorte' ? limites(img) : { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
  const cw = l.x1 - l.x0 + 1;
  const ch = l.y1 - l.y0 + 1;
  const margen = fondo === 'recorte' ? Math.round(Math.max(cw, ch) * 0.04) : 0;
  const ajuste = Math.min(1, maximo / (Math.max(cw, ch) + margen * 2));
  const fw = Math.round((cw + margen * 2) * ajuste);
  const fh = Math.round((ch + margen * 2) * ajuste);
  const final = lienzo(fw, fh);
  const fctx = final.getContext('2d');
  fctx.imageSmoothingQuality = 'high';
  fctx.drawImage(base, l.x0, l.y0, cw, ch, margen * ajuste, margen * ajuste, cw * ajuste, ch * ajuste);

  let blob = await aBlob(final, 'image/webp', fondo === 'recorte' ? 0.9 : 0.85);
  if (!blob || blob.type !== 'image/webp') blob = await aBlob(final, fondo === 'recorte' ? 'image/png' : 'image/jpeg', 0.88);
  return { blob, tipo: blob.type, fondo, ancho: fw, alto: fh };
}

// Foto ya encuadrada a mano: se quita el fondo blanco (opcional) pero se respeta el encuadre.
export async function procesarEncuadre(canvas, { quitarFondo = true } = {}) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let transparentes = 0;
  for (let i = 3; i < d.length; i += 400) if (d[i] < 12) transparentes++;
  const conMargen = transparentes > 0;
  let fondo = conMargen ? 'recorte' : 'foto';
  if (quitarFondo && proporcionBordeBlanco(d, canvas.width, canvas.height) > 0.6) {
    img = quitarFondoBlanco(img);
    ctx.putImageData(img, 0, 0);
    fondo = 'recorte';
  }
  let blob = await aBlob(canvas, 'image/webp', 0.9);
  if (!blob || blob.type !== 'image/webp') blob = await aBlob(canvas, fondo === 'recorte' ? 'image/png' : 'image/jpeg', 0.9);
  return { blob, tipo: blob.type, fondo, ancho: canvas.width, alto: canvas.height };
}

// Banner de publicidad: se respeta la imagen tal cual (sin recortes), solo se achica y comprime.
export async function procesarBanner(archivo, { ancho = 2400 } = {}) {
  const bmp = await createImageBitmap(archivo);
  const escala = Math.min(1, ancho / bmp.width);
  const c = lienzo(Math.round(bmp.width * escala), Math.round(bmp.height * escala));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  let blob = null;
  for (const calidad of [0.88, 0.8, 0.7]) {
    blob = await aBlob(c, 'image/webp', calidad);
    if (!blob || blob.type !== 'image/webp') blob = await aBlob(c, 'image/jpeg', calidad);
    if (blob.size < 1_600_000) break;
  }
  return { blob, tipo: blob.type, fondo: 'foto', ancho: c.width, alto: c.height };
}

// Previsualización para mostrar antes de subir.
export function urlTemporal(blob) {
  return URL.createObjectURL(blob);
}
