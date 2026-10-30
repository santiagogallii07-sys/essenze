// Utilidades compartidas por las funciones de la API (Cloudflare Pages Functions).

export function json(datos, estado = 200, encabezados = {}) {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...encabezados },
  });
}

export function jsonCrudo(texto, estado = 200, encabezados = {}) {
  return new Response(texto, {
    status: estado,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...encabezados },
  });
}

export function error(estado, mensaje) {
  return json({ error: mensaje }, estado);
}

export async function leerJSON(request, limite = 2_000_000) {
  const largo = Number(request.headers.get('Content-Length') || 0);
  if (largo > limite) throw new ErrorCliente(413, 'El envío es demasiado grande.');
  try {
    return await request.json();
  } catch {
    throw new ErrorCliente(400, 'Los datos enviados no son válidos.');
  }
}

export class ErrorCliente extends Error {
  constructor(estado, mensaje) {
    super(mensaje);
    this.estado = estado;
  }
}

// Envuelve un manejador para que los errores esperados respondan con su mensaje.
export function manejar(fn) {
  return async (context) => {
    try {
      return await fn(context);
    } catch (e) {
      if (e instanceof ErrorCliente) return error(e.estado, e.message);
      console.error(e);
      return error(500, 'Ocurrió un error en el servidor. Probá de nuevo.');
    }
  };
}

export function idAleatorio(largo = 10) {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(largo));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

export function slug(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

export function hoyArgentina() {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

export function texto(v, max = 500) {
  return String(v ?? '').trim().slice(0, max);
}

export function numero(v, porDefecto = 0) {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : porDefecto;
}

export function listaTextos(v, max = 40, largo = 80) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => texto(x, largo)).filter(Boolean).slice(0, max);
}

// D1 devuelve los BLOB como ArrayBuffer o como arreglo de números según la versión.
export function aBytes(v) {
  if (!v) return new Uint8Array();
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  if (Array.isArray(v)) return Uint8Array.from(v);
  return new Uint8Array();
}

export async function leerAjustes(env) {
  const { results } = await env.DB.prepare('SELECT clave, valor FROM ajustes').all();
  const a = Object.fromEntries(results.map((r) => [r.clave, r.valor]));
  return {
    whatsapp: a.whatsapp || '',
    ciudad: a.ciudad || '',
    instagram: a.instagram || '',
    cotizacion: Number(a.cotizacion) || 0,
    mostrarArs: a.mostrar_ars === '1',
    mostrarUsd: a.mostrar_usd === '1',
    filtroInmediata: a.filtro_inmediata !== '0',
    // Dólar automático (lib/dolar.js): se actualiza solo los lunes con el dólar elegido.
    dolarAuto: a.dolar_auto !== '0',
    dolarFuente: ['blue', 'oficial', 'bolsa', 'contadoconliqui', 'cripto', 'tarjeta'].includes(a.dolar_fuente) ? a.dolar_fuente : 'blue',
    dolarFecha: a.dolar_fecha || '',
    // Cuentas de clientes: el cartel que invita a crear una cuenta al entrar a la tienda.
    popupCuentas: a.popup_cuentas !== '0',
    comision: a.comision_usd === undefined ? 3 : Number(a.comision_usd) || 0,
    estiloFotos: a.estilo_fotos === 'oscuro' ? 'oscuro' : 'blanco',
    personaje: leerPersonaje(a.personaje),
    version: Number(a.version) || 1,
  };
}

// Banner animado del cocodrilo en la cartelera (Panel → Ofertas): si se muestra y sus textos.
export const PERSONAJE = {
  activo: true,
  titulo: 'El lujo en cada nota',
  texto: 'Perfumes árabes, de diseñador y de nicho',
  boton: 'Ver catálogo',
  enlace: '/catalogo',
};
function leerPersonaje(valor) {
  try {
    return { ...PERSONAJE, ...JSON.parse(valor || '{}') };
  } catch {
    return { ...PERSONAJE };
  }
}

// Cada cambio desde el panel sube la versión: así el catálogo cacheado se renueva y las páginas abiertas se actualizan.
// También sube el contador de cambios del panel.
export function sentenciaVersion(env) {
  return env.DB.prepare("UPDATE ajustes SET valor = CAST(CAST(valor AS INTEGER) + 1 AS TEXT) WHERE clave IN ('version', 'cambios')");
}

// Cambios que solo ve el panel (pedidos nuevos, caja, clientes): el catálogo no se toca.
export function sentenciaCambio(env) {
  return env.DB.prepare("UPDATE ajustes SET valor = CAST(CAST(valor AS INTEGER) + 1 AS TEXT) WHERE clave = 'cambios'");
}

export async function subirVersion(env) {
  await sentenciaVersion(env).run();
}

export function ipDe(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'local';
}
