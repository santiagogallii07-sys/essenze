// Datos que usan varias vistas del panel, guardados en memoria para no bajarlos de nuevo cada vez.
import { api } from './api.js';

export const normalizar = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

let livianos = null;

// Lista liviana de perfumes (nombre, tamaños, precios, costos y foto): para cargar ventas y para el buscador del inicio.
// La primera vez tarda un momento; las siguientes es instantánea.
export function perfumesLivianos() {
  if (!livianos) {
    livianos = api('/perfumes?liviana=1').then((lista) => {
      lista.forEach((p) => { p.busca = normalizar(`${p.marca} ${p.nombre}`); });
      return lista;
    });
    livianos.catch(() => { livianos = null; });
  }
  return livianos;
}

// Después de guardar una venta (cambia el último costo) o de un cambio en el catálogo.
export function olvidarPerfumes() {
  livianos = null;
}

export function buscarEn(lista, texto, max = 8) {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  if (!palabras.length) return [];
  return lista.filter((p) => palabras.every((w) => p.busca.includes(w))).slice(0, max);
}
