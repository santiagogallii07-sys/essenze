// Encuadre de fotos: antes de subir, se mueve y se ajusta el tamaño de la foto dentro del marco
// con la misma proporción que las tarjetas de la tienda, así nunca queda cortada ni corrida.
import { hoja, avisoError } from './ui.js';
import { procesarEncuadre } from './fotos.js';

const SALIDA = { ancho: 1000, alto: 1100 }; // misma proporción que la foto en la tienda (10:11)

function cargarImagen(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo abrir la imagen. Probá con otra (JPG, PNG o WebP).'));
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * Abre el encuadre y devuelve la foto procesada lista para subir, o null si se cancela.
 * @param {Blob} archivo
 * @param {{quitarFondo?: boolean}} opciones
 */
export async function encuadrar(archivo, { quitarFondo = true } = {}) {
  const img = await cargarImagen(archivo);
  const h = hoja({
    titulo: 'Acomodar la foto',
    ancho: 560,
    clase: 'hoja-encuadre',
    html: `
      <p class="campo__ayuda">Arrastrá la foto para moverla. Con dos dedos, la rueda del mouse o la barra cambiás el tamaño. Lo que queda dentro del marco es lo que se ve en la tienda.</p>
      <div class="encuadre" data-marco>
        <img alt="" draggable="false" data-img>
        <span class="encuadre__guia" aria-hidden="true"></span>
      </div>
      <label class="campo encuadre__zoom"><span>Tamaño</span><input type="range" min="0.3" max="4" step="0.01" value="1" data-zoom aria-label="Tamaño de la foto"></label>
      <div class="botonera">
        <button class="boton boton--suave boton--chico" type="button" data-encajar>Que entre entera</button>
        <button class="boton boton--suave boton--chico" type="button" data-llenar>Llenar el marco</button>
        <button class="boton boton--suave boton--chico" type="button" data-centrar>Centrar</button>
      </div>
      <label class="interruptor">
        <span class="interruptor__texto">Quitar fondo blanco<small>El frasco queda solo, sobre el fondo oscuro de la tienda</small></span>
        <input type="checkbox" data-quitar ${quitarFondo ? 'checked' : ''}><span class="interruptor__pista"></span>
      </label>`,
    pie: '<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button><button class="boton boton--lleno" type="button" data-listo>Usar esta foto</button>',
  });
  const d = h.dialogo;
  const marco = d.querySelector('[data-marco]');
  const vista = d.querySelector('[data-img]');
  const zoom = d.querySelector('[data-zoom]');
  vista.src = img.src;

  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  let W = 0;
  let H = 0;
  let base = 1; // escala que hace "entrar entera" la foto
  let s = 1;
  let x = 0;
  let y = 0;

  const pintar = () => {
    vista.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    zoom.value = String(s / base);
  };
  const medir = () => {
    const r = marco.getBoundingClientRect();
    W = r.width;
    H = r.height;
    base = Math.min(W / iw, H / ih);
  };
  const centrar = () => {
    x = (W - iw * s) / 2;
    y = (H - ih * s) / 2;
  };
  const escalarEn = (nueva, cx, cy) => {
    const lim = Math.min(4 * base, Math.max(0.3 * base, nueva));
    x = cx - ((cx - x) * lim) / s;
    y = cy - ((cy - y) * lim) / s;
    s = lim;
    pintar();
  };
  const encajar = () => { s = base * 0.92; centrar(); pintar(); };
  const llenar = () => { s = Math.max(W / iw, H / ih); centrar(); pintar(); };

  // Mover con un dedo / mouse, zoom con dos dedos.
  const punteros = new Map();
  let distancia0 = 0;
  let escala0 = 1;
  marco.addEventListener('pointerdown', (e) => {
    marco.setPointerCapture(e.pointerId);
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      distancia0 = Math.hypot(a.x - b.x, a.y - b.y);
      escala0 = s;
    }
  });
  marco.addEventListener('pointermove', (e) => {
    const previo = punteros.get(e.pointerId);
    if (!previo) return;
    const actual = { x: e.clientX, y: e.clientY };
    punteros.set(e.pointerId, actual);
    if (punteros.size === 1) {
      x += actual.x - previo.x;
      y += actual.y - previo.y;
      pintar();
    } else if (punteros.size === 2 && distancia0) {
      const [a, b] = [...punteros.values()];
      const r = marco.getBoundingClientRect();
      escalarEn(escala0 * (Math.hypot(a.x - b.x, a.y - b.y) / distancia0), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
    }
  });
  const soltar = (e) => {
    punteros.delete(e.pointerId);
    if (punteros.size < 2) distancia0 = 0;
  };
  marco.addEventListener('pointerup', soltar);
  marco.addEventListener('pointercancel', soltar);
  marco.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = marco.getBoundingClientRect();
    escalarEn(s * (e.deltaY < 0 ? 1.08 : 1 / 1.08), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  zoom.addEventListener('input', () => escalarEn(base * Number(zoom.value), W / 2, H / 2));
  d.querySelector('[data-encajar]').addEventListener('click', encajar);
  d.querySelector('[data-llenar]').addEventListener('click', llenar);
  d.querySelector('[data-centrar]').addEventListener('click', () => { centrar(); pintar(); });

  // Se mide cuando la hoja ya está en pantalla.
  requestAnimationFrame(() => requestAnimationFrame(() => { medir(); encajar(); }));

  let resultado = null;
  d.querySelector('[data-listo]').addEventListener('click', async (e) => {
    const boton = e.currentTarget;
    boton.disabled = true;
    boton.classList.add('es-cargando');
    try {
      const c = document.createElement('canvas');
      c.width = SALIDA.ancho;
      c.height = SALIDA.alto;
      const k = SALIDA.ancho / W;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, x * k, y * k, iw * s * k, ih * s * k);
      resultado = await procesarEncuadre(c, { quitarFondo: d.querySelector('[data-quitar]').checked });
      h.cerrar();
    } catch (err) {
      avisoError(err);
      boton.disabled = false;
      boton.classList.remove('es-cargando');
    }
  });

  await h.cerrada;
  URL.revokeObjectURL(img.src);
  return resultado;
}

