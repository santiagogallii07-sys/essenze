// Piezas de interfaz del panel: formato, avisos, hojas (diálogos), confirmaciones y miniaturas.
import { icono } from '/js/iconos.js';
import { frascoSVG } from '/js/frasco.js';
import { arrastrarParaCerrar } from '/js/arrastre.js';

export { icono };

export function escapar(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const fmt0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const fmt2 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function usd(n) {
  const v = Number(n) || 0;
  return `USD ${Number.isInteger(Math.round(v * 100) / 100) ? fmt0.format(v) : fmt2.format(v)}`;
}

export function ars(n) {
  return `$ ${fmt0.format(Math.round(Number(n) || 0))}`;
}

// El panel muestra todo en pesos; los montos guardados en dólares se convierten con el dólar de Ajustes.
let dolar = 0;
export function fijarDolar(valor) {
  dolar = Number(valor) || 0;
}
export function dolarActual() {
  return dolar;
}
export function pesos(montoUsd) {
  return dolar ? ars((Number(montoUsd) || 0) * dolar) : usd(montoUsd);
}
// Pesos grande con dólares chico al lado (para precios de catálogo, que se cargan en USD).
export function precioDoble(montoUsd) {
  return dolar ? `${ars(Math.round(((Number(montoUsd) || 0) * dolar) / 100) * 100)} <small class="usd">${usd(montoUsd)}</small>` : usd(montoUsd);
}

export function fecha(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

// Las fechas de la base están en UTC ("2026-10-20 18:06:41").
export function fechaHora(utc) {
  if (!utc) return '';
  const d = new Date(`${utc.replace(' ', 'T')}Z`);
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Cordoba' });
}

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function nombreMes(mes, corto = false) {
  const [a, m] = mes.split('-').map(Number);
  const n = MESES[m - 1];
  return corto ? n.slice(0, 3) : `${n[0].toUpperCase()}${n.slice(1)} ${a}`;
}

export function hoy() {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

export function demorar(fn, ms = 200) {
  let t = 0;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

// Las fotos subidas en lote ("h-…") tienen una copia chica "<id>-m"; para miniaturas alcanza con esa.
export const urlFotoChica = (id) => `/foto/${escapar(id)}${/^h-/.test(id) ? '-m' : ''}`;

export function miniatura(p, clase = 'mini') {
  if (p.imagen) return `<img class="${clase} ${p.fondo === 'recorte' || p.imagen_fondo === 'recorte' ? 'es-recorte' : ''}" src="${urlFotoChica(p.imagen)}" alt="" loading="lazy" decoding="async">`;
  return `<span class="${clase} ${clase}--svg">${frascoSVG(p, { etiqueta: false })}</span>`;
}

/* ---------- Avisos ---------- */

let zona;
export function aviso(texto, tipo = 'ok') {
  if (!zona) {
    zona = document.createElement('div');
    zona.className = 'avisos';
    zona.setAttribute('role', 'status');
    zona.setAttribute('aria-live', 'polite');
  }
  const destino = document.querySelector('dialog[open]') || document.body;
  if (zona.parentElement !== destino) destino.append(zona);
  const el = document.createElement('div');
  el.className = `aviso aviso--${tipo}`;
  el.innerHTML = `${icono(tipo === 'error' ? 'alerta' : 'check')}<span>${escapar(texto)}</span>`;
  zona.append(el);
  setTimeout(() => el.classList.add('es-saliente'), tipo === 'error' ? 5200 : 2800);
  setTimeout(() => el.remove(), tipo === 'error' ? 5600 : 3200);
}

export function avisoError(e) {
  aviso(e?.message || 'Algo salió mal. Probá de nuevo.', 'error');
}

/* ---------- Hojas (diálogos) ---------- */

/**
 * Abre una hoja: abajo en el celular, centrada en la compu.
 * @returns {{dialogo: HTMLDialogElement, cuerpo: HTMLElement, cerrar: Function, cerrada: Promise}}
 */
export function hoja({ titulo, html = '', pie = '', ancho = 560, clase = '' }) {
  const d = document.createElement('dialog');
  d.className = `hoja-admin ${clase}`;
  d.style.setProperty('--ancho', `${ancho}px`);
  d.innerHTML = `
    <div class="hoja-admin__panel">
      <header class="hoja-admin__cabecera">
        <span class="hoja-admin__asa" aria-hidden="true"></span>
        <h2 class="hoja-admin__titulo">${escapar(titulo)}</h2>
        <button class="boton-icono" type="button" data-cerrar aria-label="Cerrar">${icono('cerrar')}</button>
      </header>
      <div class="hoja-admin__cuerpo">${html}</div>
      ${pie ? `<footer class="hoja-admin__pie">${pie}</footer>` : ''}
    </div>`;
  document.body.append(d);
  let resolver;
  const cerrada = new Promise((r) => { resolver = r; });
  const panel = d.querySelector('.hoja-admin__panel');
  const cerrar = (valor) => {
    if (!d.open) return;
    d.classList.remove('es-visible');
    setTimeout(() => {
      d.close();
      d.remove();
      resolver(valor);
    }, 220);
  };
  d.addEventListener('cancel', (e) => {
    e.preventDefault();
    cerrar();
  });
  d.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('[data-cerrar]')) cerrar();
  });
  arrastrarParaCerrar(panel, d.querySelector('.hoja-admin__cabecera'), () => cerrar());
  d.showModal();
  requestAnimationFrame(() => d.classList.add('es-visible'));
  return { dialogo: d, cuerpo: d.querySelector('.hoja-admin__cuerpo'), cerrar, cerrada };
}

export function confirmar(mensaje, { aceptar = 'Aceptar', peligro = false, detalle = '' } = {}) {
  const h = hoja({
    titulo: 'Confirmar',
    ancho: 420,
    html: `<p class="confirmar__texto">${escapar(mensaje)}</p>${detalle ? `<p class="confirmar__detalle">${escapar(detalle)}</p>` : ''}`,
    pie: `<button class="boton boton--contorno" type="button" data-cerrar>Cancelar</button>
          <button class="boton ${peligro ? 'boton--peligro' : 'boton--lleno'}" type="button" data-aceptar>${escapar(aceptar)}</button>`,
  });
  h.dialogo.querySelector('[data-aceptar]').addEventListener('click', () => h.cerrar(true));
  setTimeout(() => h.dialogo.querySelector('[data-aceptar]').focus(), 50);
  return h.cerrada.then((v) => v === true);
}

// Botón con estado "guardando…" mientras dura una promesa.
export async function conCarga(boton, fn) {
  if (boton.disabled) return undefined;
  const original = boton.innerHTML;
  boton.disabled = true;
  boton.classList.add('es-cargando');
  try {
    return await fn();
  } finally {
    boton.disabled = false;
    boton.classList.remove('es-cargando');
    boton.innerHTML = original;
  }
}

export const TIPOS = {
  'arabe-masculino': 'Árabes masculinos',
  'arabe-femenino': 'Árabes femeninos',
  'disenador-masculino': 'Diseñador masculino',
  'disenador-femenino': 'Diseñador femenino',
  nicho: 'Nicho',
};

export const ESTADOS = {
  nuevo: 'Nuevo',
  confirmado: 'Confirmado',
  cobrado: 'Cobrado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

// Número de WhatsApp argentino a partir de lo que escribió el cliente.
export function whatsappDe(telefono) {
  let d = String(telefono || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.startsWith('54')) return d.startsWith('549') ? d : `549${d.slice(2)}`;
  if (d.length === 10) return `549${d}`;
  return d;
}
