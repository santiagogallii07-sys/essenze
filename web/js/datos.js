import { CONFIG } from './config.js';
import { cuentaAbierta } from './cuenta.js';

let catalogo = null;
let datosCatalogo = null;

async function leer(url, opciones = {}) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, ...opciones });
  if (!res.ok) throw new Error(`No se pudo leer ${url} (${res.status})`);
  return res.json();
}

function aplicarAjustes(d) {
  Object.assign(CONFIG, d.ajustes || {});
  // Estilo de las fotos (fondo blanco o escenario oscuro), elegido en el panel. Se recuerda para la próxima visita.
  const estilo = CONFIG.estiloFotos === 'oscuro' ? 'oscuro' : 'blanco';
  document.documentElement.dataset.fotos = estilo;
  try { localStorage.setItem('essenze-fotos', estilo); } catch { /* sin almacenamiento */ }
}

// Ofertas exclusivas: con la cuenta abierta, el precio para clientes pasa a ser el precio (el de lista queda tachado).
// Se puede aplicar varias veces: al entrar o salir de la cuenta, los precios se vuelven a calcular sin recargar.
export function aplicarPreciosCuenta(perfumes) {
  const conCuenta = !!cuentaAbierta();
  for (const p of perfumes) {
    for (const x of p.presentaciones) {
      x.precioLista ??= x.precio;
      if (!(x.precioCuenta && x.precioCuenta < x.precioLista)) continue;
      if (x.anteriorLista === undefined) x.anteriorLista = x.precioAnterior ?? null;
      x.exclusivo = conCuenta;
      x.precio = conCuenta ? x.precioCuenta : x.precioLista;
      x.precioAnterior = conCuenta ? Math.max(x.anteriorLista || 0, x.precioLista) : x.anteriorLista;
    }
  }
  return perfumes;
}

// Descuento de la oferta exclusiva (para invitar a crear una cuenta a quien todavía no tiene).
export function descuentoCuenta(p) {
  return p.presentaciones.reduce((max, x) => {
    const lista = x.precioLista ?? x.precio;
    return x.precioCuenta && x.precioCuenta < lista ? Math.max(max, Math.round((1 - x.precioCuenta / lista) * 100)) : max;
  }, 0);
}

export const tieneExclusiva = (p) => p.presentaciones.some((x) => x.exclusivo);

// Un solo pedido trae perfumes, ofertas vigentes, los más vendidos y datos de la tienda.
export function obtenerCatalogo() {
  if (!catalogo) {
    catalogo = leer('/api/catalogo').then((d) => {
      aplicarAjustes(d);
      aplicarPreciosCuenta(d.perfumes);
      datosCatalogo = d;
      return d;
    });
    catalogo.catch(() => { catalogo = null; });
  }
  return catalogo;
}

function avisarCambio() {
  document.dispatchEvent(new CustomEvent('catalogo:cambio', { detail: datosCatalogo }));
}

// Trae el catálogo de nuevo (cambió algo en el panel) y avisa a la página para que se vuelva a pintar.
// Los arreglos se actualizan en el lugar: las páginas que los tienen guardados ven los datos nuevos.
export async function refrescarCatalogo() {
  if (!datosCatalogo) return;
  const d = await leer('/api/catalogo', { cache: 'no-store' });
  aplicarAjustes(d);
  aplicarPreciosCuenta(d.perfumes);
  datosCatalogo.perfumes.splice(0, datosCatalogo.perfumes.length, ...d.perfumes);
  Object.assign(datosCatalogo, { ...d, perfumes: datosCatalogo.perfumes });
  avisarCambio();
}

// Al entrar o salir de la cuenta cambian los precios exclusivos.
document.addEventListener('cuenta:cambio', () => {
  if (!datosCatalogo) return;
  aplicarPreciosCuenta(datosCatalogo.perfumes);
  avisarCambio();
});

export async function obtenerPerfumes() {
  return (await obtenerCatalogo()).perfumes;
}

export async function obtenerOfertas() {
  return (await obtenerCatalogo()).ofertas;
}

// Ficha completa (descripción, fotos 360°, modelo 3D).
export async function obtenerPerfume(id) {
  const res = await fetch(`/api/perfumes/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('No se pudo cargar el perfume.');
  const p = await res.json();
  if (p?.presentaciones) aplicarPreciosCuenta([p]);
  return p;
}

export function presentacionesOrdenadas(p) {
  return [...p.presentaciones].sort((a, b) => a.ml - b.ml);
}

// Todo se puede pedir. Los tamaños con stock (lo marcan en el panel) son de entrega inmediata;
// el resto es "a pedido": lo compran cuando llega el pedido.
export const MAXIMO_POR_LINEA = 20;
export const inmediata = (x) => Number(x.stock) > 0;

export function hayInmediata(p) {
  return p.presentaciones.some(inmediata);
}

// El filtro "Entrega inmediata" aparece solo si está prendido en Ajustes y hay algo en stock.
export function verEntregaInmediata(perfumes) {
  return CONFIG.filtroInmediata !== false && perfumes.some(hayInmediata);
}

export function precioDesde(p) {
  return Math.min(...p.presentaciones.map((x) => x.precio));
}

export function textoEntrega(x) {
  return inmediata(x) ? 'Entrega inmediata' : 'A pedido';
}

export function enOferta(p) {
  return p.presentaciones.some((x) => x.precioAnterior && x.precioAnterior > x.precio);
}

export function descuentoMaximo(p) {
  return p.presentaciones.reduce((max, x) => {
    if (!x.precioAnterior || x.precioAnterior <= x.precio) return max;
    return Math.max(max, Math.round((1 - x.precio / x.precioAnterior) * 100));
  }, 0);
}

const formato = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const formato2 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const enPesos = () => CONFIG.mostrarArs && CONFIG.cotizacion > 0;

// Precio principal: en pesos (redondeado a la centena) si hay cotización cargada; si no, en dólares.
export function precio(valor) {
  if (enPesos()) return `$ ${formato.format(Math.round((valor * CONFIG.cotizacion) / 100) * 100)}`;
  return precioUsd(valor);
}

export function precioUsd(valor) {
  return `USD ${Number.isInteger(valor) ? formato.format(valor) : formato2.format(valor)}`;
}

// Precio secundario (chico, debajo): el valor en dólares, solo si el principal está en pesos
// y en Ajustes eligieron mostrarlo.
export function precioArs(valor) {
  return enPesos() && CONFIG.mostrarUsd ? precioUsd(valor) : '';
}

export function textoMl(ml) {
  return ml ? `${ml} ml` : 'Tamaño único';
}

export function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function textoBuscable(p) {
  const n = p.notas || {};
  const notas = [...(n.salida || []), ...(n.corazon || []), ...(n.fondo || []), ...(n.destacadas || [])];
  return normalizar([p.marca, p.nombre, p.familia, p.perfil, p.concentracion, ...notas, ...p.acordes.map((a) => a.nombre)].join(' '));
}

export function enlacePerfume(p) {
  return `/perfume?p=${encodeURIComponent(p.id)}`;
}
