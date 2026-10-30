// Dólar de la semana. Se toma de DolarApi (da el mismo número que muestra Dolarito) una vez por semana:
// la primera visita desde el lunes a las 00:00 (hora de Argentina) lo actualiza y queda fijo hasta el lunes siguiente.
// Así un cliente no ve cambiar el precio de un día para el otro.
import { hoyArgentina, sentenciaVersion } from './util.js';

export const FUENTES = {
  blue: 'Blue',
  oficial: 'Oficial',
  bolsa: 'MEP',
  contadoconliqui: 'Contado con liqui',
  cripto: 'Cripto',
  tarjeta: 'Tarjeta',
};

export function lunesDeLaSemana(dia = hoyArgentina()) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// Valor de venta del dólar elegido (lo que paga quien compra dólares).
export async function consultarDolar(fuente) {
  const r = await fetch(`https://dolarapi.com/v1/dolares/${FUENTES[fuente] ? fuente : 'blue'}`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`DolarApi respondió ${r.status}`);
  const venta = Number((await r.json()).venta);
  if (!(venta > 0)) throw new Error('DolarApi no mandó el valor');
  return Math.round(venta * 100) / 100;
}

const guardar = (env, clave, valor) => env.DB.prepare(
  'INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor',
).bind(clave, String(valor));

// Trae el dólar ahora y lo deja como el de esta semana.
export async function fijarDolarDeHoy(env, fuente) {
  const valor = await consultarDolar(fuente);
  await env.DB.batch([guardar(env, 'cotizacion', valor), guardar(env, 'dolar_fecha', lunesDeLaSemana()), sentenciaVersion(env)]);
  return valor;
}

// Si el dólar automático está prendido y todavía no se actualizó esta semana, lo actualiza (una sola vez).
export async function actualizarDolarSiToca(env, ajustes) {
  if (!ajustes.dolarAuto) return false;
  const lunes = lunesDeLaSemana();
  if (ajustes.dolarFecha >= lunes) return false;
  // Primero se marca la semana: si llegan varias visitas juntas, solo una consulta el dólar.
  await env.DB.prepare("INSERT OR IGNORE INTO ajustes (clave, valor) VALUES ('dolar_fecha', '')").run();
  const r = await env.DB.prepare("UPDATE ajustes SET valor = ? WHERE clave = 'dolar_fecha' AND valor < ?").bind(lunes, lunes).run();
  if (!r.meta?.changes) return false;
  try {
    await fijarDolarDeHoy(env, ajustes.dolarFuente);
    return true;
  } catch (e) {
    // Sin respuesta de DolarApi: queda el dólar anterior y se vuelve a probar en la próxima visita.
    console.error('No se pudo actualizar el dólar:', e.message);
    await env.DB.prepare("UPDATE ajustes SET valor = ? WHERE clave = 'dolar_fecha'").bind(ajustes.dolarFecha || '').run();
    return false;
  }
}
