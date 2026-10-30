// Cuentas de clientes de la tienda: contraseña guardada con PBKDF2 y sesión con un token al azar en una cookie.
// En la base queda solo el hash del token: si alguien leyera la base, no podría usar las sesiones.

const COOKIE = 'essenze_cliente';
const DURACION = 30 * 24 * 3600; // 30 días
// El plan gratis de Cloudflare corta cada pedido a los 10 ms de procesador: 10.000 vueltas tardan ~2 ms.
// Cada hash guarda sus vueltas, así que se puede subir más adelante sin romper las cuentas ya creadas.
const ITERACIONES = 10_000;
const codificador = new TextEncoder();

const aHex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
const deHex = (hex) => Uint8Array.from(hex.match(/../g) || [], (h) => parseInt(h, 16));
const sha = async (t) => aHex(await crypto.subtle.digest('SHA-256', codificador.encode(t)));

async function derivar(contrasena, sal, iteraciones) {
  const base = await crypto.subtle.importKey('raw', codificador.encode(contrasena), 'PBKDF2', false, ['deriveBits']);
  return aHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: deHex(sal), iterations: iteraciones }, base, 256));
}

export async function hashContrasena(contrasena) {
  const sal = aHex(crypto.getRandomValues(new Uint8Array(16)));
  return `pbkdf2$${ITERACIONES}$${sal}$${await derivar(contrasena, sal, ITERACIONES)}`;
}

export async function verificarContrasena(contrasena, guardada) {
  const [tipo, iteraciones, sal, hash = ''] = String(guardada || '').split('$');
  if (tipo !== 'pbkdf2') return false;
  const calculado = await derivar(contrasena, sal, Number(iteraciones));
  // Comparación en tiempo constante.
  let dif = calculado.length ^ hash.length;
  for (let i = 0; i < calculado.length; i++) dif |= calculado.charCodeAt(i) ^ (hash.charCodeAt(i) || 0);
  return dif === 0;
}

export function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 160;
}

function tokenDe(request) {
  const m = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)essenze_cliente=([0-9a-f]{64})/);
  return m ? m[1] : null;
}

const cookie = (valor, edad, segura) => `${COOKIE}=${valor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${edad}${segura ? '; Secure' : ''}`;

export async function crearSesion(env, clienteId, segura) {
  const token = aHex(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.batch([
    env.DB.prepare("INSERT INTO sesiones_clientes (token, cliente, vence) VALUES (?, ?, datetime('now', '+30 days'))").bind(await sha(token), clienteId),
    env.DB.prepare("DELETE FROM sesiones_clientes WHERE vence < datetime('now')"),
    env.DB.prepare("UPDATE clientes SET ultimo_ingreso = datetime('now') WHERE id = ?").bind(clienteId),
  ]);
  return cookie(token, DURACION, segura);
}

export async function cerrarSesion(env, request, segura) {
  const token = tokenDe(request);
  if (token) await env.DB.prepare('DELETE FROM sesiones_clientes WHERE token = ?').bind(await sha(token)).run();
  return cookie('', 0, segura);
}

// Cliente con sesión abierta (o null).
export async function clienteDeSesion(env, request) {
  const token = tokenDe(request);
  if (!token) return null;
  return env.DB.prepare(
    `SELECT c.id, c.email, c.nombre, c.telefono, c.favoritos, c.creado
     FROM sesiones_clientes s JOIN clientes c ON c.id = s.cliente
     WHERE s.token = ? AND s.vence > datetime('now')`,
  ).bind(await sha(token)).first();
}

// Puntos: 1 por cada dólar de las compras cobradas. Más adelante se van a poder canjear por descuentos.
export async function puntosDe(env, clienteId) {
  const fila = await env.DB.prepare(
    "SELECT COALESCE(SUM(ROUND(COALESCE(cobrado, total))), 0) AS puntos FROM pedidos WHERE cliente = ? AND estado IN ('cobrado', 'entregado')",
  ).bind(clienteId).first();
  return Number(fila.puntos) || 0;
}

// Precio para un cliente con cuenta: el exclusivo si es más bajo que el de lista.
export function precioParaCliente(pres, conCuenta) {
  return conCuenta && pres.precioCuenta && pres.precioCuenta < pres.precio ? pres.precioCuenta : pres.precio;
}
