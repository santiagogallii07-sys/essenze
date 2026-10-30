// Panel de administración: ingreso, navegación y enrutado por #/seccion.
import { api, cambioPropioReciente } from './api.js';
import { icono, escapar, hoja, aviso, avisoError, fijarDolar } from './ui.js';
import { olvidarPerfumes } from './datos.js';
import { reproducir } from '/js/personaje.js';

const SECCIONES = [
  { id: 'resumen', texto: 'Inicio', icono: 'inicio', modulo: './vistas/resumen.js' },
  { id: 'perfumes', texto: 'Perfumes', icono: 'frasco', modulo: './vistas/perfumes.js' },
  { id: 'pedidos', texto: 'Pedidos', icono: 'recibo', modulo: './vistas/pedidos.js' },
  { id: 'caja', texto: 'Caja', icono: 'caja', modulo: './vistas/caja.js' },
  { id: 'ofertas', texto: 'Ofertas', icono: 'etiqueta', modulo: './vistas/ofertas.js' },
  { id: 'clientes', texto: 'Clientes', icono: 'usuario', modulo: './vistas/clientes.js' },
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

// Qué vista corresponde a una ruta (#/seccion/params?consulta).
function resolver(hash) {
  const [camino, textoConsulta = ''] = hash.split('?');
  const consulta = new URLSearchParams(textoConsulta);
  const [seccion, ...params] = camino.split('/').map(decodeURIComponent);
  const destino = SECCIONES.find((s) => s.id === seccion) || SECCIONES[0];
  let modulo = destino.modulo;
  if (destino.id === 'perfumes' && params.length) modulo = './vistas/editor.js';
  if (destino.id === 'importar' && params[0] === 'fotos') modulo = './vistas/fotos-lote.js';
  return { destino, modulo, params, consulta };
}

async function enrutar() {
  const hash = location.hash.replace(/^#\/?/, '') || 'resumen';
  if (hash === rutaActual) return;
  if (guardia && !(await guardia())) {
    history.replaceState(null, '', `#/${rutaActual}`);
    return;
  }
  guardia = null;
  const { destino, modulo, params, consulta } = resolver(hash);
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

/* ---------- Actualización en vivo ---------- */

// Como en el sistema de REFIRE: si el otro dueño carga algo o entra un pedido de la web, la pantalla se actualiza
// sola, sin recargar. El panel pregunta cada 5 segundos (solo con la pestaña a la vista) si hubo cambios.
let cambiosVistos = null;
let repintarPendiente = false;

function puedeRepintar() {
  if (document.querySelector('dialog[open]')) return false; // una venta o un formulario a medio cargar
  const foco = document.activeElement;
  if (foco && el.vista.contains(foco) && foco.matches('input, textarea, select')) return false; // escribiendo
  if (guardia) return false; // el editor con cambios sin guardar
  return !/^(perfumes\/|importar)/.test(rutaActual); // el editor y la importación no se tocan
}

// Vuelve a armar la vista actual con los datos nuevos, sin el cartel de "cargando" y en el mismo lugar de la pantalla.
async function repintarVista() {
  const hash = rutaActual;
  const { modulo, params, consulta } = resolver(hash);
  // Los atajos ("?venta", "?gasto") abren una ventana: al repintar no se repiten.
  consulta.delete('venta');
  consulta.delete('gasto');
  const y = window.scrollY;
  try {
    const m = await import(modulo);
    if (rutaActual !== hash || !puedeRepintar()) return;
    if (typeof limpiar === 'function') limpiar();
    limpiar = await m.montar({ vista: el.vista, params, consulta, app });
    window.scrollTo(0, y);
  } catch (e) {
    console.error(e);
  }
}

async function revisarCambios() {
  if (document.hidden || el.panel.hidden) return;
  let r;
  try {
    r = await api('/vivo');
  } catch {
    return; // sin conexión: se vuelve a probar en la próxima vuelta
  }
  if (cambiosVistos !== null && r.nuevos > nuevosPedidos) {
    const n = r.nuevos - nuevosPedidos;
    aviso(n === 1 ? 'Entró un pedido nuevo' : `Entraron ${n} pedidos nuevos`);
  }
  if (r.nuevos !== nuevosPedidos) {
    nuevosPedidos = r.nuevos;
    pintarNav(SECCIONES.find((s) => rutaActual.startsWith(s.id))?.id || 'resumen');
  }
  if (cambiosVistos === null) {
    cambiosVistos = r.cambios;
    return;
  }
  if (r.cambios !== cambiosVistos) {
    cambiosVistos = r.cambios;
    olvidarPerfumes();
    // Lo que cambió uno mismo ya se ve: solo se repinta por cambios de otros.
    if (!cambioPropioReciente()) repintarPendiente = true;
  }
  if (repintarPendiente && puedeRepintar()) {
    repintarPendiente = false;
    repintarVista();
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
  // El cocodrilo de la marca dibuja el logo arriba del formulario.
  reproducir(el.ingreso.querySelector('.ingreso__personaje'));
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
document.addEventListener('visibilitychange', () => { if (!document.hidden && !el.panel.hidden) revisarCambios(); });
setInterval(revisarCambios, 5000);

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
