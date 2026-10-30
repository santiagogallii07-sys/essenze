// Cuenta del cliente en la tienda: crear cuenta, ingresar y salir; los favoritos se guardan también en la cuenta.
// La sesión es una cookie que el navegador no deja leer: acá se recuerda solo que hay una cuenta abierta,
// para mostrar al instante los precios exclusivos (el servidor igual los vuelve a calcular en cada pedido).
import { obtenerFavoritos, reemplazarFavoritos } from './favoritos.js';

const CLAVE = 'essenze-cuenta-v1';

function leer() {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE));
    return v && v.email ? v : null;
  } catch {
    return null;
  }
}

let estado = leer();

function guardar(v) {
  const antes = estado?.email || null;
  estado = v;
  try {
    if (v) localStorage.setItem(CLAVE, JSON.stringify(v));
    else localStorage.removeItem(CLAVE);
  } catch { /* modo privado: la cuenta queda abierta solo en esta pestaña */ }
  if (antes !== (v?.email || null)) document.dispatchEvent(new CustomEvent('cuenta:cambio', { detail: estado }));
}

// { email, nombre } si hay una cuenta abierta en este navegador; si no, null.
export const cuentaAbierta = () => estado;

async function pedir(ruta, { metodo = 'GET', datos } = {}) {
  let r;
  try {
    r = await fetch(`/api/cuenta${ruta}`, {
      method: metodo,
      credentials: 'same-origin',
      headers: datos === undefined ? { Accept: 'application/json' } : { 'Content-Type': 'application/json' },
      body: datos === undefined ? undefined : JSON.stringify(datos),
    });
  } catch {
    throw new Error('Sin conexión. Revisá internet y probá de nuevo.');
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'No se pudo completar. Probá de nuevo.');
  return d;
}

function subirFavoritos(ids) {
  pedir('/favoritos', { metodo: 'PUT', datos: { favoritos: ids } }).catch(() => {});
}

// Datos completos (puntos, pedidos y favoritos). Si la sesión venció, la cuenta queda cerrada.
// Los favoritos de la cuenta se juntan con los de este navegador.
export async function traerCuenta() {
  const d = await pedir('');
  if (!d.cuenta) {
    guardar(null);
    return null;
  }
  guardar({ email: d.cuenta.email, nombre: d.cuenta.nombre || '' });
  const locales = obtenerFavoritos();
  const juntos = [...new Set([...locales, ...d.favoritos])];
  if (juntos.length !== locales.length) reemplazarFavoritos(juntos);
  if (juntos.length !== d.favoritos.length) subirFavoritos(juntos);
  return d;
}

export async function crearCuenta(email, contrasena) {
  const d = await pedir('/registro', { metodo: 'POST', datos: { email, contrasena, favoritos: obtenerFavoritos() } });
  guardar({ email: d.cuenta.email, nombre: d.cuenta.nombre || '' });
  return d.cuenta;
}

export async function ingresar(email, contrasena) {
  await pedir('/ingreso', { metodo: 'POST', datos: { email, contrasena } });
  return traerCuenta();
}

export async function salir() {
  await pedir('/salir', { metodo: 'POST', datos: {} }).catch(() => {});
  guardar(null);
}

// Con la cuenta abierta, cada cambio de favoritos se guarda también en la cuenta (se ve en cualquier celular).
let espera = 0;
document.addEventListener('favoritos:cambio', (e) => {
  if (!estado) return;
  clearTimeout(espera);
  espera = setTimeout(() => subirFavoritos(e.detail.ids), 800);
});

// Entrar o salir en otra pestaña abierta de la tienda.
window.addEventListener('storage', (e) => {
  if (e.key !== CLAVE) return;
  const antes = estado?.email || null;
  estado = leer();
  if (antes !== (estado?.email || null)) document.dispatchEvent(new CustomEvent('cuenta:cambio', { detail: estado }));
});
