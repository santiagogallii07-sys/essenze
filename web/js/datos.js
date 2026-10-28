import { CONFIG } from './config.js';

let catalogo = null;

async function leer(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`No se pudo leer ${url} (${res.status})`);
  return res.json();
}

// Un solo pedido trae perfumes, ofertas vigentes y datos de la tienda.
export function obtenerCatalogo() {
  if (!catalogo) {
    catalogo = leer('/api/catalogo').then((d) => {
      Object.assign(CONFIG, d.ajustes || {});
      // Estilo de las fotos (fondo blanco o escenario oscuro), elegido en el panel. Se recuerda para la próxima visita.
      const estilo = CONFIG.estiloFotos === 'oscuro' ? 'oscuro' : 'blanco';
      document.documentElement.dataset.fotos = estilo;
      try { localStorage.setItem('essenze-fotos', estilo); } catch { /* sin almacenamiento */ }
      return d;
    });
    catalogo.catch(() => { catalogo = null; });
  }
  return catalogo;
}

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
  return res.json();
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

// Precio secundario (chico, debajo): el valor en dólares cuando el principal está en pesos.
export function precioArs(valor) {
  return enPesos() ? precioUsd(valor) : '';
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
