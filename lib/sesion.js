// Sesión del panel: cookie firmada con HMAC (sin base de datos de usuarios).
// La contraseña vive en el secreto ADMIN_PASSWORD y la firma en SESSION_SECRET.

const COOKIE = 'essenze_admin';
const DURACION = 30 * 24 * 3600; // 30 días

const codificador = new TextEncoder();

async function clave(env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 16) {
    throw new Error('Falta configurar SESSION_SECRET (mínimo 16 caracteres).');
  }
  return crypto.subtle.importKey('raw', codificador.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function aHex(buf) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function deHex(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

export async function cookieDeSesion(env, segura = true) {
  const vence = Math.floor(Date.now() / 1000) + DURACION;
  const firma = await crypto.subtle.sign('HMAC', await clave(env), codificador.encode(String(vence)));
  const valor = `${vence}.${aHex(firma)}`;
  return `${COOKIE}=${valor}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DURACION}${segura ? '; Secure' : ''}`;
}

export function cookieDeCierre(segura = true) {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${segura ? '; Secure' : ''}`;
}

export async function sesionValida(request, env) {
  const cookies = request.headers.get('Cookie') || '';
  const m = cookies.match(new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)\\.([0-9a-f]{64})`));
  if (!m) return false;
  const vence = Number(m[1]);
  if (vence * 1000 < Date.now()) return false;
  try {
    return await crypto.subtle.verify('HMAC', await clave(env), deHex(m[2]), codificador.encode(String(vence)));
  } catch {
    return false;
  }
}

// Comparación en tiempo constante de la contraseña (compara los hash).
export async function contrasenaCorrecta(env, intento) {
  if (!env.ADMIN_PASSWORD) throw new Error('Falta configurar ADMIN_PASSWORD.');
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', codificador.encode(String(intento || ''))),
    crypto.subtle.digest('SHA-256', codificador.encode(env.ADMIN_PASSWORD)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let dif = 0;
  for (let i = 0; i < x.length; i++) dif |= x[i] ^ y[i];
  return dif === 0;
}

export function esHttps(request) {
  return new URL(request.url).protocol === 'https:';
}
