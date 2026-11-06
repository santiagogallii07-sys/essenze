// GET /api/admin/deudas/:id → la deuda con sus pagos
// PUT → editar (las de una venta: solo nombre, teléfono y notas; el monto sale de la venta)
// POST {monto, metodo, fecha} → registrar un pago (va a la caja) · POST {borrarPago: id} → borrar un pago
// DELETE → borrar la deuda y sus pagos
import { manejar, json, error, leerJSON, idAleatorio, sentenciaCambio, texto, numero, hoyArgentina, leerAjustes } from '../../../../lib/util.js';
import { asegurarEsquema } from '../../../../lib/esquema.js';
import { PAGADO_SQL, filaADeuda, limpiarDeuda } from '../../../../lib/deudas.js';

async function buscar(env, id) {
  const f = await env.DB.prepare(`SELECT d.*, ${PAGADO_SQL} AS pagado, p.numero AS pedido_numero FROM deudas d LEFT JOIN pedidos p ON p.id = d.pedido WHERE d.id = ?`).bind(String(id)).first();
  return f ? filaADeuda(f) : null;
}

export const onRequestGet = manejar(async ({ params, env }) => {
  await asegurarEsquema(env);
  const deuda = await buscar(env, params.id);
  if (!deuda) return error(404, 'No existe esa deuda.');
  const { results } = await env.DB.prepare('SELECT * FROM movimientos WHERE deuda = ? ORDER BY fecha, creado').bind(deuda.id).all();
  return json({ deuda, pagos: results });
});

export const onRequestPut = manejar(async ({ params, request, env }) => {
  const deuda = await buscar(env, params.id);
  if (!deuda) return error(404, 'No existe esa deuda.');
  const d = await leerJSON(request, 10_000);
  if (deuda.pedido) {
    await env.DB.batch([
      env.DB.prepare('UPDATE deudas SET nombre = ?, telefono = ?, notas = ? WHERE id = ?')
        .bind(texto(d.nombre, 120) || deuda.nombre, texto(d.telefono, 40), texto(d.notas, 600), deuda.id),
      sentenciaCambio(env),
    ]);
  } else {
    const l = limpiarDeuda(d);
    if (l.moneda !== deuda.moneda && deuda.pagado > 0) return error(409, 'Ya tiene pagos cargados: no se le puede cambiar la moneda.');
    await env.DB.batch([
      env.DB.prepare('UPDATE deudas SET tipo = ?, nombre = ?, telefono = ?, concepto = ?, moneda = ?, monto = ?, fecha = ?, notas = ? WHERE id = ?')
        .bind(l.tipo, l.nombre, l.telefono, l.concepto, l.moneda, l.monto, l.fecha, l.notas, deuda.id),
      sentenciaCambio(env),
    ]);
  }
  return json({ ok: true, deuda: await buscar(env, deuda.id) });
});

export const onRequestPost = manejar(async ({ params, request, env }) => {
  const deuda = await buscar(env, params.id);
  if (!deuda) return error(404, 'No existe esa deuda.');
  const d = await leerJSON(request, 5000);

  if (d.borrarPago) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM movimientos WHERE id = ? AND deuda = ?').bind(String(d.borrarPago), deuda.id),
      sentenciaCambio(env),
    ]);
    return json({ ok: true, deuda: await buscar(env, deuda.id) });
  }

  // Pago: entra (o sale) de la caja en la moneda de la deuda.
  const monto = Math.round(numero(d.monto, 0) * 100) / 100;
  if (monto <= 0) return error(400, 'El pago tiene que ser mayor a cero.');
  if (monto > deuda.resta + 0.01) return error(400, `El pago es más de lo que falta (${deuda.moneda === 'ARS' ? '$' : 'USD'} ${deuda.resta}).`);
  let cotizacion = null;
  if (deuda.moneda === 'ARS') {
    cotizacion = (await leerAjustes(env)).cotizacion;
    if (!cotizacion) return error(400, 'Cargá la cotización del dólar en Ajustes.');
  }
  const cobrar = deuda.tipo !== 'pagar';
  const metodo = texto(d.metodo, 40);
  const descripcion = texto(`${cobrar ? 'Cobro' : 'Pago'} de deuda · ${deuda.nombre}${metodo ? ` · ${metodo}` : ''}${deuda.concepto ? ` · ${deuda.concepto}` : ''}`, 200);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO movimientos (id, fecha, tipo, categoria, descripcion, monto, moneda, monto_original, cotizacion, deuda)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      idAleatorio(12),
      /^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') ? d.fecha : hoyArgentina(),
      cobrar ? 'ingreso' : 'egreso',
      cobrar ? 'Cobro de deuda' : 'Pago de deuda',
      descripcion,
      cotizacion ? Math.round((monto / cotizacion) * 100) / 100 : monto,
      deuda.moneda,
      cotizacion ? monto : null,
      cotizacion,
      deuda.id,
    ),
    sentenciaCambio(env),
  ]);
  return json({ ok: true, deuda: await buscar(env, deuda.id) });
});

export const onRequestDelete = manejar(async ({ params, env }) => {
  const deuda = await buscar(env, params.id);
  if (!deuda) return error(404, 'No existe esa deuda.');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM movimientos WHERE deuda = ?').bind(deuda.id),
    env.DB.prepare('DELETE FROM deudas WHERE id = ?').bind(deuda.id),
    sentenciaCambio(env),
  ]);
  return json({ ok: true });
});
