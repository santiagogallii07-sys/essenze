// Datos que usan varias vistas del panel, guardados en memoria para no bajarlos de nuevo cada vez.
import { api } from './api.js';

export const normalizar = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

let livianos = null;
let ultima = null;

function bajarLivianos() {
  return api('/perfumes?liviana=1').then((lista) => {
    lista.forEach((p) => { p.busca = normalizar(`${p.marca} ${p.nombre}`); });
    ultima = lista;
    return lista;
  });
}

// Lista liviana de perfumes (nombre, tamaños, precios, costos y foto): para cargar ventas y para el buscador del inicio.
// La primera vez tarda un momento; las siguientes es instantánea.
export function perfumesLivianos() {
  if (!livianos) {
    livianos = bajarLivianos();
    livianos.catch(() => { livianos = null; });
  }
  return livianos;
}

// Después de un cambio propio (guardar una venta cambia el último costo): la próxima vez se baja de nuevo.
export function olvidarPerfumes() {
  livianos = null;
  ultima = null;
}

// Cambio de otro administrador: la lista que ya estaba se sigue usando (abre al instante) y la nueva se baja atrás.
export function renovarPerfumes() {
  if (!ultima) {
    livianos = null;
    return;
  }
  const vieja = Promise.resolve(ultima);
  livianos = vieja;
  bajarLivianos().then((lista) => { if (livianos === vieja) livianos = Promise.resolve(lista); }).catch(() => {});
}

export function buscarEn(lista, texto, max = 8) {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  if (!palabras.length) return [];
  return lista.filter((p) => palabras.every((w) => p.busca.includes(w))).slice(0, max);
}
