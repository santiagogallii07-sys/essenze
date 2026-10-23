// Panel de administración: ingreso, navegación y enrutado por #/seccion.
import { api } from './api.js';
import { icono, escapar, hoja, avisoError, fijarDolar } from './ui.js';

const SECCIONES = [
  { id: 'resumen', texto: 'Inicio', icono: 'inicio', modulo: './vistas/resumen.js' },
  { id: 'perfumes', texto: 'Perfumes', icono: 'frasco', modulo: './vistas/perfumes.js' },
  { id: 'pedidos', texto: 'Pedidos', icono: 'recibo', modulo: './vistas/pedidos.js' },
  { id: 'caja', texto: 'Caja', icono: 'caja', modulo: './vistas/caja.js' },
  { id: 'ofertas', texto: 'Ofertas', icono: 'etiqueta', modulo: './vistas/ofertas.js' },
  { id: 'importar', texto: 'Importar Excel', icono: 'tabla', modulo: './vistas/importar.js' },
  { id: 'ajustes', texto: 'Ajustes', icono: 'ajustes', modulo: './vistas/ajustes.js' },
];
const EN_BARRA = ['resumen', 'perfumes', 'pedidos', 'caja'];

const el = {
  ingreso: document.querySelector('[data-ingreso]'),
  panel: document.querySelector('[data-panel]'),
  vista: document.querySelector('[data-vista]'),
  titulo: document.querySelector('[data-titulo]'),
  acciones: document.querySelector('[data-acciones]'),
  volver: document.querySelector('[data-volver]'),
  navLateral: document.querySelector('[data-nav-lateral]'),
  navInferior: document.querySelector('[data-nav-inferior]'),
};

let limpiar = null;
let guardia = null;
let rutaActual = '';
let nuevosPedidos = 0;

const app = {
  titulo(texto, { volver } = {}) {
    el.titulo.textContent = texto;
    document.title = `${texto} · Panel Essenze`;
    el.volver.hidden = !volver;
    el.volver.dataset.destino = volver || '';
  },
  acciones(contenido = '') {
    if (typeof contenido === 'string') el.acciones.innerHTML = contenido;
    else el.acciones.replaceChildren(...[].concat(contenido));
  },
  ir(ruta) {
    location.hash = ruta;
  },
  // Una vista con cambios sin guardar registra una función que decide si se puede salir.
  guardia(fn) {
    guardia = fn;
  },
  refrescarPedidos: () => contarPedidos(),
};

/* ---------- Navegación ---------- */

function pintarNav(actual) {
  el.navLateral.innerHTML = SECCIONES.map((s) => `
    <a class="lateral-admin__enlace" href="#/${s.id}" ${s.id === actual ? 'aria-current="page"' : ''}>
      ${icono(s.icono)}<span>${s.texto}</span>${s.id === 'pedidos' && nuevosPedidos ? `<span class="burbuja">${nuevosPedidos}</span>` : ''}
    </a>`).join('');
  const enMas = !EN_BARRA.includes(actual);
  el.navInferior.innerHTML = `${SECCIONES.filter((s) => EN_BARRA.includes(s.id)).map((s) => `
    <a class="pestana-admin" href="#/${s.id}" ${s.id === actual ? 'aria-current="page"' : ''}>
      <span class="pestana-admin__icono">${icono(s.icono)}${s.id === 'pedidos' && nuevosPedidos ? `<span class="burbuja">${nuevosPedidos}</span>` : ''}</span>
      <span>${s.texto}</span>
    </a>`).join('')}
    <button class="pestana-admin" type="button" data-mas ${enMas ? 'aria-current="page"' : ''}>
      <span class="pestana-admin__icono">${icono('puntos')}</span><span>Más</span>
    </button>`;
}

function abrirMas() {
  const extra = SECCIONES.filter((s) => !EN_BARRA.includes(s.id));
  const h = hoja({
    titulo: 'Más opciones',
    ancho: 420,
    html: `<nav class="menu-mas">
      ${extra.map((s) => `<a href="#/${s.id}" data-cerrar>${icono(s.icono)}<span>${s.texto}</span>${icono('chevron', 'menu-mas__flecha')}</a>`).join('')}
      <a href="/" target="_blank" rel="noopener">${icono('tienda')}<span>Ver tienda</span>${icono('chevron', 'menu-mas__flecha')}</a>
      <button type="button" data-salir>${icono('salir')}<span>Cerrar sesión</span></button>
    </nav>`,
  });
  h.dialogo.querySelector('[data-salir]').addEventListener('click', () => { h.cerrar(); salir(); });
}

async function enrutar() {
  const hash = location.hash.replace(/^#\/?/, '') || 'resumen';
  if (hash === rutaActual) return;
  if (guardia && !(await guardia())) {
    history.replaceState(null, '', `#/${rutaActual}`);
    return;
  }
  guardia = null;
  const [camino, textoConsulta = ''] = hash.split('?');
  const consulta = new URLSearchParams(textoConsulta);
  const [seccion, ...params] = camino.split('/').map(decodeURIComponent);
  let destino = SECCIONES.find((s) => s.id === seccion) || SECCIONES[0];
  let modulo = destino.modulo;
  if (destino.id === 'perfumes' && params.length) modulo = './vistas/editor.js';
  if (destino.id === 'importar' && params[0] === 'fotos') modulo = './vistas/fotos-lote.js';
  rutaActual = hash;

  if (typeof limpiar === 'function') limpiar();
  limpiar = null;
  pintarNav(destino.id);
  app.titulo(destino.texto);
  app.acciones('');
  el.vista.innerHTML = '<div class="cargando" aria-busy="true"><span></span><span></span><span></span></div>';
  el.vista.scrollTop = 0;
  window.scrollTo(0, 0);
  try {
    const m = await import(modulo);
    if (rutaActual !== hash) return;
    limpiar = await m.montar({ vista: el.vista, params, consulta, app });
  } catch (e) {
    console.error(e);
    el.vista.innerHTML = `<div class="vacio-admin"><p>No se pudo abrir esta sección.</p><p class="vacio-admin__detalle">${escapar(e.message)}</p><a class="boton boton--contorno" href="">Reintentar</a></div>`;
  }
}

async function contarPedidos() {
  try {
    const { cuentas } = await api('/pedidos?estado=nuevo');
    nuevosPedidos = cuentas.nuevo || 0;
    pintarNav(SECCIONES.find((s) => rutaActual.startsWith(s.id))?.id || 'resumen');
  } catch { /* sin conexión: se reintenta en el próximo ciclo */ }
}

/* ---------- Sesión ---------- */

function mostrarIngreso() {
  el.panel.hidden = true;
  el.ingreso.hidden = false;
  el.ingreso.querySelector('input').focus();
}

async function mostrarPanel() {
  el.ingreso.hidden = true;
  el.panel.hidden = false;
  try {
    fijarDolar((await api('/ajustes')).cotizacion);
  } catch { /* sin dólar: se muestra en USD */ }
  rutaActual = '';
  await enrutar();
  contarPedidos();
}

async function salir() {
  try {
    await api('/login', { metodo: 'DELETE' });
  } finally {
    location.hash = '';
    mostrarIngreso();
  }
}

el.ingreso.querySelector('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const boton = form.querySelector('button');
  const error = form.querySelector('[data-error-ingreso]');
  error.textContent = '';
  boton.disabled = true;
  try {
    await api('/login', { metodo: 'POST', datos: { contrasena: form.elements.contrasena.value } });
    form.reset();
    await mostrarPanel();
  } catch (err) {
    error.textContent = err.message;
    form.elements.contrasena.select();
  } finally {
    boton.disabled = false;
  }
});

document.addEventListener('sesion:vencida', mostrarIngreso);
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-mas]')) abrirMas();
  if (e.target.closest('[data-salir]') && !e.target.closest('dialog')) salir();
  if (e.target.closest('[data-volver]')) app.ir(el.volver.dataset.destino);
});
window.addEventListener('hashchange', enrutar);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !el.panel.hidden) contarPedidos(); });
setInterval(() => { if (!document.hidden && !el.panel.hidden) contarPedidos(); }, 120_000);

// Íconos de los enlaces fijos del lateral.
document.querySelectorAll('[data-icono]').forEach((a) => a.insertAdjacentHTML('afterbegin', icono(a.dataset.icono)));
el.volver.innerHTML = icono('flechaIzq');

try {
  const { sesion } = await api('/login');
  if (sesion) await mostrarPanel();
  else mostrarIngreso();
} catch (e) {
  mostrarIngreso();
  avisoError(e);
}
