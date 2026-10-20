// Carrito guardado en el navegador del cliente. Solo guarda id + tamaño + cantidad;
// precios y stock se leen siempre del catálogo para que un cambio de precio se respete.
const CLAVE = 'essenze-carrito-v1';
const CLAVE_CLIENTE = 'essenze-cliente-v1';

function leer(clave, porDefecto) {
  try {
    const v = JSON.parse(localStorage.getItem(clave));
    return v ?? porDefecto;
  } catch {
    return porDefecto;
  }
}

function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* modo privado o almacenamiento bloqueado: el carrito vive solo en esta pestaña */
  }
}

let items = leer(CLAVE, []).filter((i) => i && i.id && i.ml && i.cantidad > 0);

function avisar() {
  guardar(CLAVE, items);
  document.dispatchEvent(new CustomEvent('carrito:cambio', { detail: { items: [...items] } }));
}

export function obtenerItems() {
  return [...items];
}

export function cantidadTotal() {
  return items.reduce((n, i) => n + i.cantidad, 0);
}

export function cantidadDe(id, ml) {
  return items.find((i) => i.id === id && i.ml === ml)?.cantidad ?? 0;
}

export function agregar(id, ml, cantidad = 1, maximo = Infinity) {
  const existente = items.find((i) => i.id === id && i.ml === ml);
  if (existente) existente.cantidad = Math.min(maximo, existente.cantidad + cantidad);
  else items.push({ id, ml, cantidad: Math.min(maximo, cantidad) });
  avisar();
}

export function cambiarCantidad(id, ml, cantidad) {
  if (cantidad <= 0) return quitar(id, ml);
  const item = items.find((i) => i.id === id && i.ml === ml);
  if (item) {
    item.cantidad = cantidad;
    avisar();
  }
}

export function quitar(id, ml) {
  items = items.filter((i) => !(i.id === id && i.ml === ml));
  avisar();
}

export function vaciar() {
  items = [];
  avisar();
}

export function datosCliente() {
  return leer(CLAVE_CLIENTE, { nombre: '', email: '', telefono: '' });
}

export function recordarCliente(datos) {
  guardar(CLAVE_CLIENTE, { nombre: datos.nombre, email: datos.email, telefono: datos.telefono });
}

// Sincroniza entre pestañas abiertas del sitio.
window.addEventListener('storage', (e) => {
  if (e.key !== CLAVE) return;
  items = leer(CLAVE, []);
  document.dispatchEvent(new CustomEvent('carrito:cambio', { detail: { items: [...items] } }));
});
