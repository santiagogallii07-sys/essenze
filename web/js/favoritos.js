// Favoritos guardados en el navegador del cliente (solo los ids, el más nuevo primero).
const CLAVE = 'essenze-favoritos-v1';
const MAXIMO = 60;

function leer() {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE));
    return Array.isArray(v) ? v.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

let ids = leer();

function avisar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(ids));
  } catch {
    /* modo privado: los favoritos viven solo en esta pestaña */
  }
  document.dispatchEvent(new CustomEvent('favoritos:cambio', { detail: { ids: [...ids] } }));
}

export function obtenerFavoritos() {
  return [...ids];
}

export function esFavorito(id) {
  return ids.includes(id);
}

// Devuelve true si quedó guardado y false si se quitó.
export function alternarFavorito(id) {
  if (ids.includes(id)) {
    ids = ids.filter((x) => x !== id);
    avisar();
    return false;
  }
  ids = [id, ...ids].slice(0, MAXIMO);
  avisar();
  return true;
}

export function quitarFavorito(id) {
  if (!ids.includes(id)) return;
  ids = ids.filter((x) => x !== id);
  avisar();
}

// Al ingresar a la cuenta: los favoritos guardados en la cuenta se juntan con los de este navegador.
export function reemplazarFavoritos(lista) {
  ids = [...new Set(lista.filter((id) => typeof id === 'string'))].slice(0, MAXIMO);
  avisar();
}

// Saca los perfumes que ya no están en el catálogo (borrados u ocultos).
export function depurarFavoritos(existe) {
  const vigentes = ids.filter(existe);
  if (vigentes.length === ids.length) return;
  ids = vigentes;
  avisar();
}

// Sincroniza entre pestañas abiertas del sitio.
window.addEventListener('storage', (e) => {
  if (e.key !== CLAVE) return;
  ids = leer();
  document.dispatchEvent(new CustomEvent('favoritos:cambio', { detail: { ids: [...ids] } }));
});
