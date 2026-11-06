// Deudas: lo que les deben (ventas pagadas en parte o fiadas, o cargadas a mano) y lo que deben ellos.
// Cada pago es un movimiento de la caja con esta deuda (ingreso "Cobro de deuda" o egreso "Pago de deuda"),
// en la moneda de la deuda; lo pagado es la suma de esos movimientos, así la caja y las deudas nunca se desfasan.
import { idAleatorio, texto, numero, hoyArgentina, ErrorCliente } from './util.js';

// Deuda cargada a mano.
export function limpiarDeuda(d) {
  const nombre = texto(d.nombre, 120);
  if (nombre.length < 2) throw new ErrorCliente(400, 'Escribí a nombre de quién es la deuda.');
  const monto = Math.round(numero(d.monto, 0) * 100) / 100;
  if (monto <= 0) throw new ErrorCliente(400, 'El monto tiene que ser mayor a cero.');
  return {
    tipo: d.tipo === 'pagar' ? 'pagar' : 'cobrar',
    nombre,
    telefono: texto(d.telefono, 40),
    concepto: texto(d.concepto, 300),
    moneda: d.moneda === 'USD' ? 'USD' : 'ARS',
    monto,
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') ? d.fecha : hoyArgentina(),
    notas: texto(d.notas, 600),
  };
}

// Lo pagado de la deuda `d` (en su moneda), para usar dentro de un SELECT ... FROM deudas d.
export const PAGADO_SQL = `(SELECT COALESCE(SUM(CASE WHEN m.moneda = 'ARS' THEN m.monto_original ELSE m.monto END), 0) FROM movimientos m WHERE m.deuda = d.id)`;

const redondear = (n) => Math.round(n * 100) / 100;

export function filaADeuda(f) {
  const pagado = redondear(f.pagado || 0);
  return { ...f, pagado, resta: Math.max(0, redondear(f.monto - pagado)), saldada: f.monto - pagado < 0.01 };
}

// Qué se vendió, para que la deuda diga de qué es (ej. "Venta #1023 · Lattafa Khamrah 100 ml").
function conceptoVenta(pedido) {
  const items = pedido.items.map((i) => `${i.cantidad > 1 ? `${i.cantidad} × ` : ''}${[i.marca, i.nombre].filter(Boolean).join(' ')}${i.ml ? ` ${i.ml} ml` : ''}`);
  return texto(`Venta ${pedido.numero ? `#${pedido.numero}` : pedido.id} · ${items.join(', ')}`, 300);
}

// Borra la deuda de una venta y sus pagos (al anular o eliminar la venta, o si ya no queda debiendo).
export function sentenciasBorrarDeudaPedido(env, pedidoId) {
  return [
    env.DB.prepare('DELETE FROM movimientos WHERE deuda IN (SELECT id FROM deudas WHERE pedido = ?)').bind(pedidoId),
    env.DB.prepare('DELETE FROM deudas WHERE pedido = ?').bind(pedidoId),
  ];
}

/**
 * Deuda de una venta: lo que falta pagar (`monto`, en `moneda`). Si ya tenía una, se actualiza y conserva sus pagos;
 * con monto 0 se borra. Devuelve las sentencias para el mismo batch que guarda la venta.
 */
export async function sentenciasDeudaPedido(env, pedido, { monto, moneda, fecha }) {
  if (!(monto > 0.009)) return sentenciasBorrarDeudaPedido(env, pedido.id);
  const existente = await env.DB.prepare('SELECT id FROM deudas WHERE pedido = ?').bind(pedido.id).first('id');
  const datos = [texto(pedido.nombre, 120), texto(pedido.telefono, 40), conceptoVenta(pedido), moneda === 'USD' ? 'USD' : 'ARS', redondear(monto), fecha];
  if (existente) {
    return [env.DB.prepare('UPDATE deudas SET nombre = ?, telefono = ?, concepto = ?, moneda = ?, monto = ?, fecha = ? WHERE id = ?').bind(...datos, existente)];
  }
  return [env.DB.prepare("INSERT INTO deudas (id, tipo, pedido, nombre, telefono, concepto, moneda, monto, fecha) VALUES (?, 'cobrar', ?, ?, ?, ?, ?, ?, ?)")
    .bind(idAleatorio(12), pedido.id, ...datos)];
}
