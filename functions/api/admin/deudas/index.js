// GET /api/admin/deudas?estado=pendientes|saldadas|todas&q= → deudas con lo pagado, y totales de lo pendiente
// POST {tipo, nombre, telefono, concepto, moneda, monto, fecha, notas} → cargar una deuda a mano
import { manejar, json, leerJSON, idAleatorio, sentenciaCambio, texto } from '../../../../lib/util.js';
import { asegurarEsquema } from '../../../../lib/esquema.js';
import { PAGADO_SQL, filaADeuda, limpiarDeuda } from '../../../../lib/deudas.js';

export const onRequestGet = manejar(async ({ request, env }) => {
  await asegurarEsquema(env);
  const u = new URL(request.url).searchParams;
  const q = texto(u.get('q'), 60);
  const condiciones = [];
  const valores = [];
  if (q) {
    condiciones.push('(d.nombre LIKE ? OR d.concepto LIKE ? OR d.telefono LIKE ? OR d.notas LIKE ?)');
    valores.push(...Array(4).fill(`%${q}%`));
  }
  const { results } = await env.DB.prepare(
    `SELECT d.*, ${PAGADO_SQL} AS pagado, p.numero AS pedido_numero
     FROM deudas d LEFT JOIN pedidos p ON p.id = d.pedido
     ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
     ORDER BY d.fecha DESC, d.creado DESC LIMIT 500`,
  ).bind(...valores).all();
  const todas = results.map(filaADeuda);
  // Totales de lo que falta, por tipo y moneda (las deudas se anotan en pesos o en dólares).
  const totales = { cobrar: { ARS: 0, USD: 0 }, pagar: { ARS: 0, USD: 0 } };
  const cuentas = { pendientes: 0, saldadas: 0, todas: todas.length };
  for (const d of todas) {
    if (d.saldada) cuentas.saldadas++;
    else {
      cuentas.pendientes++;
      totales[d.tipo === 'pagar' ? 'pagar' : 'cobrar'][d.moneda] += d.resta;
    }
  }
  const estado = ['saldadas', 'todas'].includes(u.get('estado')) ? u.get('estado') : 'pendientes';
  const deudas = estado === 'todas' ? todas : todas.filter((d) => d.saldada === (estado === 'saldadas'));
  return json({ deudas, totales, cuentas });
});

export const onRequestPost = manejar(async ({ request, env }) => {
  await asegurarEsquema(env);
  const d = limpiarDeuda(await leerJSON(request, 10_000));
  const id = idAleatorio(12);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO deudas (id, tipo, nombre, telefono, concepto, moneda, monto, fecha, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, d.tipo, d.nombre, d.telefono, d.concepto, d.moneda, d.monto, d.fecha, d.notas),
    sentenciaCambio(env),
  ]);
  return json({ ok: true, id }, 201);
});
